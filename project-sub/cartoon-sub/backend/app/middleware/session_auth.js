'use strict';

module.exports = () => {
  return async function sessionAuth(ctx, next) {
    const optional = process.env.CARTOON_AUTH_OPTIONAL !== '0';
    if (ctx.path === '/api/health' || ctx.method === 'OPTIONS') {
      await next();
      return;
    }
    if (ctx.path.startsWith('/api/internal/ops')) {
      const token = ctx.get('x-ops-token');
      const expect = process.env.OPS_INTERNAL_TOKEN || 'ops-internal-dev';
      if (!token || token !== expect) {
        ctx.status = 401;
        ctx.body = { code: 401, message: '内部令牌无效', data: null };
        return;
      }
      ctx.state.user = { sub: 0, username: 'ops-internal', role: 'admin' };
      await next();
      return;
    }
    const header = ctx.get('authorization') || '';
    const token = header.replace(/^Bearer\s+/i, '');
    if (!token) {
      if (optional) {
        ctx.state.user = { sub: 0, username: 'local', role: 'operator' };
        await next();
        return;
      }
      ctx.status = 401;
      ctx.body = { code: 401, message: '未登录', data: null };
      return;
    }
    try {
      ctx.state.user = ctx.app.jwt.verify(token, ctx.app.config.jwt.secret);
    } catch {
      ctx.status = 401;
      ctx.body = { code: 401, message: '令牌无效', data: null };
      return;
    }
    await next();
  };
};
