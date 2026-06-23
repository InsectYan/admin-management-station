'use strict';

module.exports = () => {
  return async function adminAuth(ctx, next) {
    try {
      const token = ctx.get('authorization')?.replace(/^Bearer\s+/i, '');
      if (!token) {
        ctx.status = 401;
        ctx.body = { code: 401, message: '未登录', data: null };
        return;
      }
      const decoded = ctx.app.jwt.verify(token, ctx.app.config.jwt.secret);
      ctx.state.user = decoded;
    } catch (err) {
      ctx.status = 401;
      ctx.body = { code: 401, message: '令牌无效', data: null };
      return;
    }

    if (!ctx.state.user || ctx.state.user.role !== 'admin') {
      ctx.status = 403;
      ctx.body = { code: 403, message: '无权限', data: null };
      return;
    }

    await next();
  };
};
