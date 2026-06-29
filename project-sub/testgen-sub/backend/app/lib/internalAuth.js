'use strict';

/**
 * internal API token 校验（Skill 回写 BFF）
 * @param {import('egg').Context} ctx
 * @param {string} [expectedToken]
 * @returns {boolean}
 */
function checkInternalToken(ctx, expectedToken) {
  const expected = expectedToken || ctx.app.config.internalApiToken;
  if (!expected) return true;
  const token = ctx.get('X-Internal-Token');
  if (token !== expected) {
    ctx.status = 401;
    ctx.body = { code: 401, message: 'unauthorized', data: null };
    return false;
  }
  return true;
}

module.exports = { checkInternalToken };
