'use strict';

const APP_CODE = 'cartoon';
const READ_CODES = new Set([ 'viewer', 'maker', 'reviewer', 'pipeline' ]);
const verified = new Map();

function isRead(method) {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

function isSuperUser(user) {
  if (!user) return false;
  if (user.username === 'local') return true;
  if (user.account_type === 'super_admin') return true;
  return user.role === 'admin';
}

module.exports = () => {
  return async function roleGate(ctx, next) {
    if (ctx.path === '/api/health' || ctx.path.startsWith('/api/internal/ops') || ctx.method === 'OPTIONS') {
      await next();
      return;
    }
    const user = ctx.state.user || {};
    if (isSuperUser(user)) {
      ctx.state.access = { super: true, codes: [ '*' ] };
      await next();
      return;
    }
    const header = ctx.get('authorization') || '';
    const token = header.replace(/^Bearer\s+/i, '');
    const access = await loadAccess(ctx, token, user.sub || user.id);
    if (!access) return;
    const allowed = access.super || access.codes.some(code => READ_CODES.has(code));
    if (!allowed) {
      ctx.status = 403;
      ctx.body = { code: 403, message: '没有漫剧角色', data: null };
      return;
    }
    if (!isRead(ctx.method) && !access.super && !access.codes.includes('maker')) {
      ctx.status = 403;
      ctx.body = { code: 403, message: '需要制作角色', data: null };
      return;
    }
    await next();
  };
};

async function loadAccess(ctx, token, userId) {
  const base = String(ctx.app.config.main?.baseUrl || '').replace(/\/$/, '');
  const key = String(userId || '');
  try {
    const res = await ctx.curl(`${base}/api/auth/me`, {
      method: 'GET',
      dataType: 'json',
      timeout: 8000,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      ctx.status = 401;
      ctx.body = { code: 401, message: '登录已失效', data: null };
      return null;
    }
    if (res.status !== 200) throw new Error(`main ${res.status}`);
    const body = res.data || {};
    const profile = body.data?.user || body.user || {};
    const roles = Array.isArray(profile.roles) ? profile.roles : [];
    const access = {
      super: isSuperUser(profile),
      codes: roles.filter(item => item.app_code === APP_CODE).map(item => item.code),
    };
    if (key) verified.set(key, access);
    ctx.state.access = access;
    return access;
  } catch (err) {
    if (ctx.status === 401) return null;
    const cached = key ? verified.get(key) : null;
    if (isRead(ctx.method) && cached) {
      ctx.state.access = cached;
      return cached;
    }
    ctx.status = 503;
    ctx.body = { code: 503, message: '主应用暂时不可用', data: null };
    return null;
  }
}
