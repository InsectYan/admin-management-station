'use strict';

const bcrypt = require('bcryptjs');
const { Service } = require('egg');
const { generateSecret, verifyTotp, otpauthUrl } = require('../lib/totp');

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const TOKEN_DAYS = 7;
const MFA_ISSUER = '私人管理平台';

function publicUser(row) {
  if (!row) return null;
  const token = String(row.github_token || '').trim();
  const akId = String(row.aliyun_access_key_id || '').trim();
  const akSecret = String(row.aliyun_access_key_secret || '').trim();
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    account_type: row.account_type || (row.role === 'admin' ? 'super_admin' : 'user'),
    status: row.status,
    mfa_enabled: !!row.mfa_enabled,
    github_login: row.github_login || '',
    github_token_configured: !!token,
    aliyun_account_id: row.aliyun_account_id || '',
    aliyun_access_key_id: akId,
    aliyun_access_key_configured: !!(akId && akSecret),
    password_hint: row.password_hint || '',
  };
}

class AuthService extends Service {
  signToken(user) {
    return this.app.jwt.sign(
      { sub: user.id, username: user.username, account_type: user.account_type || (user.role === 'admin' ? 'super_admin' : 'user') },
      this.app.config.jwt.secret,
      { expiresIn: `${TOKEN_DAYS}d` },
    );
  }

  loginMessage(status) {
    if (status === 'pending') return '账号待管理员开通';
    if (status === 'disabled') return '账号已禁用';
    return '账号不可用';
  }

  async register({ username, email, password }) {
    const name = String(username || '').trim();
    const mail = String(email || '').trim().toLowerCase();
    const pwd = String(password || '');

    if (!USERNAME_RE.test(name)) {
      this.ctx.throw(400, '用户名为 3–32 位字母、数字或下划线');
    }
    if (!EMAIL_RE.test(mail)) {
      this.ctx.throw(400, '邮箱格式不正确');
    }
    if (!PASSWORD_RE.test(pwd)) {
      this.ctx.throw(400, '密码至少 8 位，且包含字母和数字');
    }

    const existed = await this.ctx.model.PlatformUser.findOne({
      where: {
        [this.app.Sequelize.Op.or]: [{ username: name }, { email: mail }],
      },
    });
    if (existed) {
      this.ctx.throw(409, existed.username === name ? '用户名已存在' : '邮箱已注册');
    }

    const row = await this.ctx.model.PlatformUser.create({
      username: name,
      email: mail,
      password_hash: bcrypt.hashSync(pwd, 10),
      status: 'pending',
      role: 'operator',
      account_type: 'user',
    });
    return publicUser(row);
  }

  async login({ username, password }) {
    const name = String(username || '').trim();
    const pwd = String(password || '');
    const row = await this.ctx.model.PlatformUser.findOne({ where: { username: name } });
    if (!row || !bcrypt.compareSync(pwd, row.password_hash)) {
      this.ctx.throw(401, '用户名或密码错误');
    }
    if (row.status !== 'active') {
      this.ctx.throw(403, this.loginMessage(row.status));
    }
    if (row.mfa_enabled) {
      const mfa_ticket = this.app.jwt.sign(
        { purpose: 'mfa', sub: row.id, username: row.username, account_type: row.account_type },
        this.app.config.jwt.secret,
        { expiresIn: '5m' },
      );
      return {
        mfa_required: true,
        mfa_ticket,
        user: { username: row.username },
      };
    }
    return {
      token: this.signToken(row),
      user: await this.withRoles(row),
    };
  }

  async loginMfa({ ticket, code }) {
    let payload;
    try {
      payload = this.app.jwt.verify(String(ticket || ''), this.app.config.jwt.secret);
    } catch {
      this.ctx.throw(401, '二次验证已过期，请重新登录');
    }
    if (payload.purpose !== 'mfa') this.ctx.throw(401, '无效的验证票据');
    const row = await this.ctx.model.PlatformUser.findByPk(payload.sub);
    if (!row || row.status !== 'active') {
      this.ctx.throw(401, this.loginMessage(row?.status));
    }
    if (!row.mfa_enabled || !verifyTotp(row.mfa_secret, code)) {
      this.ctx.throw(401, '验证码错误');
    }
    return {
      token: this.signToken(row),
      user: await this.withRoles(row),
    };
  }

  async withRoles(row) {
    const user = publicUser(row);
    const map = await this.ctx.service.role.enabledForUsers([ row.id ]);
    user.roles = map.get(Number(row.id)) || [];
    return user;
  }

  async me(userId) {
    const row = await this.ctx.model.PlatformUser.findByPk(userId);
    if (!row || row.status !== 'active') {
      this.ctx.throw(401, '登录已失效');
    }
    return this.withRoles(row);
  }

  currentUserId() {
    const payload = this.ctx.state.user || {};
    return payload.sub || payload.id;
  }

  async changePassword({ old_password, new_password, password_hint }) {
    const row = await this.ctx.model.PlatformUser.findByPk(this.currentUserId());
    if (!row || row.status !== 'active') this.ctx.throw(401, '登录已失效');
    if (!bcrypt.compareSync(String(old_password || ''), row.password_hash)) {
      this.ctx.throw(400, '原密码不正确');
    }
    if (!PASSWORD_RE.test(String(new_password || ''))) {
      this.ctx.throw(400, '新密码至少 8 位，且包含字母和数字');
    }
    if (String(old_password) === String(new_password)) {
      this.ctx.throw(400, '新密码不能与原密码相同');
    }
    const hint = String(password_hint || '').trim();
    if (!hint) {
      this.ctx.throw(400, '请填写密码提示，登录页可据此回忆密码');
    }
    if (hint.length > 200) {
      this.ctx.throw(400, '密码提示过长（最多 200 字）');
    }
    if (hint === String(new_password) || hint === String(old_password)) {
      this.ctx.throw(400, '密码提示不能与密码相同');
    }
    await row.update({
      password_hash: bcrypt.hashSync(String(new_password), 10),
      password_hint: hint,
    });
    await this.ctx.service.audit.write({
      actor: { id: row.id, username: row.username },
      action: 'change_password',
      target: row,
    });
    return publicUser(row);
  }

  /** 登录页按用户名查询密码提示（不鉴权；无提示或用户不存在均返回空串，避免枚举） */
  async lookupPasswordHint(username) {
    const name = String(username || '').trim();
    if (!name || name.length > 64) return { hint: '' };
    const row = await this.ctx.model.PlatformUser.findOne({ where: { username: name } });
    if (!row || row.status === 'disabled') return { hint: '' };
    return { hint: String(row.password_hint || '').trim() };
  }

  async mfaSetup() {
    const row = await this.ctx.model.PlatformUser.findByPk(this.currentUserId());
    if (!row || row.status !== 'active') this.ctx.throw(401, '登录已失效');
    if (row.mfa_enabled) this.ctx.throw(409, '已开启二次验证');
    const secret = generateSecret();
    await row.update({ mfa_secret: secret });
    return {
      secret,
      otpauth_url: otpauthUrl({ issuer: MFA_ISSUER, account: row.username, secret }),
    };
  }

  async mfaConfirm({ code }) {
    const row = await this.ctx.model.PlatformUser.findByPk(this.currentUserId());
    if (!row || row.status !== 'active') this.ctx.throw(401, '登录已失效');
    if (row.mfa_enabled) this.ctx.throw(409, '已开启二次验证');
    if (!row.mfa_secret || !verifyTotp(row.mfa_secret, code)) {
      this.ctx.throw(400, '验证码错误');
    }
    await row.update({ mfa_enabled: true });
    await this.ctx.service.audit.write({
      actor: { id: row.id, username: row.username },
      action: 'mfa_enable',
      target: row,
    });
    return publicUser(row);
  }

  async mfaDisable({ password, code }) {
    const row = await this.ctx.model.PlatformUser.findByPk(this.currentUserId());
    if (!row || row.status !== 'active') this.ctx.throw(401, '登录已失效');
    if (!row.mfa_enabled) this.ctx.throw(400, '未开启二次验证');
    if (!bcrypt.compareSync(String(password || ''), row.password_hash)) {
      this.ctx.throw(400, '密码不正确');
    }
    if (!verifyTotp(row.mfa_secret, code)) {
      this.ctx.throw(400, '验证码错误');
    }
    await row.update({ mfa_enabled: false, mfa_secret: null });
    await this.ctx.service.audit.write({
      actor: { id: row.id, username: row.username },
      action: 'mfa_disable',
      target: row,
      detail: { by: 'self' },
    });
    return publicUser(row);
  }

  assertGithubToken(raw) {
    const token = String(raw || '').trim();
    if (token.length < 20) {
      this.ctx.throw(400, 'GitHub Token 太短，请粘贴 Personal Access Token');
    }
    if (/\s/.test(token)) {
      this.ctx.throw(400, 'GitHub Token 不能包含空格或换行');
    }
    return token;
  }

  async saveGithubToken({ token, github_login }) {
    const row = await this.ctx.model.PlatformUser.findByPk(this.currentUserId());
    if (!row || row.status !== 'active') this.ctx.throw(401, '登录已失效');
    const nextToken = this.assertGithubToken(token);
    const login = String(github_login || '').trim().replace(/^@/, '');
    await row.update({
      github_token: nextToken,
      github_login: login || row.github_login || null,
    });
    await this.ctx.service.audit.write({
      actor: { id: row.id, username: row.username },
      action: 'github_token_save',
      target: row,
    });
    return publicUser(row);
  }

  async clearGithubToken() {
    const row = await this.ctx.model.PlatformUser.findByPk(this.currentUserId());
    if (!row || row.status !== 'active') this.ctx.throw(401, '登录已失效');
    await row.update({ github_token: null });
    await this.ctx.service.audit.write({
      actor: { id: row.id, username: row.username },
      action: 'github_token_clear',
      target: row,
    });
    return publicUser(row);
  }

  async readGithubCredential() {
    const row = await this.ctx.model.PlatformUser.findByPk(this.currentUserId());
    if (!row || row.status !== 'active') this.ctx.throw(401, '登录已失效');
    const token = String(row.github_token || '').trim();
    if (!token) {
      const err = new Error('未配置 GitHub Token');
      err.status = 404;
      err.code = 'GITHUB_TOKEN_REQUIRED';
      throw err;
    }
    return {
      token,
      github_login: row.github_login || '',
      username: row.username,
    };
  }

  async readGithubCredentialByUsername(username) {
    const name = String(username || '').trim();
    if (!name) return null;
    const row = await this.ctx.model.PlatformUser.findOne({ where: { username: name } });
    if (!row || row.status !== 'active') return null;
    const token = String(row.github_token || '').trim();
    if (!token) return null;
    return {
      token,
      github_login: row.github_login || '',
      username: row.username,
    };
  }

  async saveAliyunCredentials({ account_id, access_key_id, access_key_secret }) {
    const row = await this.ctx.model.PlatformUser.findByPk(this.currentUserId());
    if (!row || row.status !== 'active') this.ctx.throw(401, '登录已失效');
    const accountId = String(account_id || '').trim();
    const akId = String(access_key_id || '').trim();
    const akSecret = String(access_key_secret || '').trim();
    if (!accountId) this.ctx.throw(400, '请填写阿里云主账号 UID（AccountID）');
    if (!akId) this.ctx.throw(400, '请填写 AccessKey ID');
    if (!akSecret) {
      if (!String(row.aliyun_access_key_secret || '').trim()) {
        this.ctx.throw(400, '请填写 AccessKey Secret');
      }
    } else if (/\s/.test(akSecret)) {
      this.ctx.throw(400, 'AccessKey Secret 不能包含空格或换行');
    }
    const patch = {
      aliyun_account_id: accountId,
      aliyun_access_key_id: akId,
    };
    if (akSecret) patch.aliyun_access_key_secret = akSecret;
    await row.update(patch);
    await this.ctx.service.audit.write({
      actor: { id: row.id, username: row.username },
      action: 'aliyun_credentials_save',
      target: row,
    });
    return publicUser(row);
  }

  async clearAliyunCredentials() {
    const row = await this.ctx.model.PlatformUser.findByPk(this.currentUserId());
    if (!row || row.status !== 'active') this.ctx.throw(401, '登录已失效');
    await row.update({
      aliyun_account_id: null,
      aliyun_access_key_id: null,
      aliyun_access_key_secret: null,
    });
    await this.ctx.service.audit.write({
      actor: { id: row.id, username: row.username },
      action: 'aliyun_credentials_clear',
      target: row,
    });
    return publicUser(row);
  }

  async ensureBootstrapAdmin() {
    const username = process.env.ADMIN_BOOTSTRAP_USER || 'admin';
    const email = process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@local';
    const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'admin123';
    const existed = await this.ctx.model.PlatformUser.findOne({ where: { username } });
    if (!existed) {
      await this.ctx.model.PlatformUser.create({
        username,
        email,
        password_hash: bcrypt.hashSync(password, 10),
        status: 'active',
        role: 'admin',
        account_type: 'super_admin',
      });
      this.ctx.logger.info('[Auth] bootstrap admin created: %s', username);
    } else if (existed.account_type !== 'super_admin') {
      await existed.update({ account_type: 'super_admin' });
    }
    await this.ensureSuperAdminBootstrap();
    return { created: !existed, username };
  }

  /**
   * 超管账号：每次主应用启动/重新部署时注入或重置密码。
   * 默认 15536832520 / zs19930505（可用 SUPER_ADMIN_BOOTSTRAP_* 覆盖）。
   */
  async ensureSuperAdminBootstrap() {
    const username = process.env.SUPER_ADMIN_BOOTSTRAP_USER || '15536832520';
    const email = process.env.SUPER_ADMIN_BOOTSTRAP_EMAIL || `${username}@local`;
    const password = process.env.SUPER_ADMIN_BOOTSTRAP_PASSWORD || 'zs19930505';
    const hash = bcrypt.hashSync(password, 10);
    const row = await this.ctx.model.PlatformUser.findOne({ where: { username } });
    if (!row) {
      const emailClash = await this.ctx.model.PlatformUser.findOne({ where: { email } });
      await this.ctx.model.PlatformUser.create({
        username,
        email: emailClash ? `${username}.${Date.now()}@local` : email,
        password_hash: hash,
        status: 'active',
        role: 'admin',
        account_type: 'super_admin',
        password_hint: process.env.SUPER_ADMIN_BOOTSTRAP_HINT || '超管默认口令（部署会重置）',
      });
      this.ctx.logger.info('[Auth] super admin injected: %s', username);
      return { created: true, reset: false, username };
    }
    await row.update({
      password_hash: hash,
      status: 'active',
      role: 'admin',
      account_type: 'super_admin',
      password_hint: row.password_hint || process.env.SUPER_ADMIN_BOOTSTRAP_HINT || '超管默认口令（部署会重置）',
    });
    this.ctx.logger.info('[Auth] super admin password reset on deploy: %s', username);
    return { created: false, reset: true, username };
  }
}

module.exports = AuthService;
