'use strict';

module.exports = () => {
  return async function sessionAuth(ctx, next) {
    const optional = process.env.OPS_AUTH_OPTIONAL === '1';
    const open = ctx.path === '/api/health'
      || (ctx.method === 'GET' && ctx.path === '/api/projects/template');
    if (open || ctx.method === 'OPTIONS') {
      await next();
      return;
    }

    const header = ctx.get('authorization') || '';
    const bearer = header.replace(/^Bearer\s+/i, '');
    const queryToken = String(ctx.query.access_token || '');
    const token = bearer || queryToken;

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
