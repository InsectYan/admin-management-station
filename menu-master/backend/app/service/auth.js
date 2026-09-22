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
    role: row.role,
    status: row.status,
    mfa_enabled: !!row.mfa_enabled,
    github_login: row.github_login || '',
    github_token_configured: !!token,
    aliyun_account_id: row.aliyun_account_id || '',
    aliyun_access_key_id: akId,
    aliyun_access_key_configured: !!(akId && akSecret),
  };
}

class AuthService extends Service {
  signToken(user) {
    return this.app.jwt.sign(
      { sub: user.id, username: user.username, role: user.role },
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
        { purpose: 'mfa', sub: row.id, username: row.username, role: row.role },
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
      user: publicUser(row),
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
      user: publicUser(row),
    };
  }

  async me(userId) {
    const row = await this.ctx.model.PlatformUser.findByPk(userId);
    if (!row || row.status !== 'active') {
      this.ctx.throw(401, '登录已失效');
    }
    return publicUser(row);
  }

  currentUserId() {
    const payload = this.ctx.state.user || {};
    return payload.sub || payload.id;
  }

  async changePassword({ old_password, new_password }) {
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
    await row.update({ password_hash: bcrypt.hashSync(String(new_password), 10) });
    await this.ctx.service.audit.write({
      actor: { id: row.id, username: row.username },
      action: 'change_password',
      target: row,
    });
    return publicUser(row);
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
    if (existed) return { created: false, username };
    await this.ctx.model.PlatformUser.create({
      username,
      email,
      password_hash: bcrypt.hashSync(password, 10),
      status: 'active',
      role: 'admin',
    });
    this.ctx.logger.info('[Auth] bootstrap admin created: %s', username);
    return { created: true, username };
  }
}

module.exports = AuthService;
