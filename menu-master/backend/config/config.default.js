require('dotenv').config();

const path = require('path');

module.exports = appInfo => {
  const config = {};

  config.keys = appInfo.name + '_admin_platform';

  // egg-jwt 会自行挂上 jwt 中间件，不要再写进 middleware 数组
  config.middleware = [];

  config.security = {
    csrf: { enable: false },
  };

  config.cors = {
    origin: '*',
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS',
    allowHeaders: 'Content-Type,Authorization,X-Requested-With',
  };

  config.jwt = {
    secret: process.env.JWT_SECRET || 'CHANGE_ME_LOCAL_JWT',
    enable: true,
    ignore: ctx => {
      if (ctx.method === 'OPTIONS') return true;
      if (ctx.path === '/api/health') return true;
      if (
        ctx.path === '/api/auth/login'
        || ctx.path === '/api/auth/login/mfa'
        || ctx.path === '/api/auth/register'
        || ctx.path === '/api/auth/logout'
        || ctx.path === '/api/internal/github-credential'
      ) {
        return true;
      }
      return false;
    },
  };

  config.onerror = {
    accepts() {
      return 'json';
    },
    json(err, ctx) {
      const status = err.status || 500;
      ctx.status = status;
      ctx.body = { code: status, message: err.message || '请求失败', data: null };
    },
  };

  config.sequelize = {
    dialect: 'postgres',
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT || 5300),
    username: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD || 'admin123',
    database: process.env.POSTGRES_DB || 'admin_platform',
    define: {
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    timezone: '+08:00',
    logging: false,
  };

  config.cluster = {
    listen: {
      port: Number(process.env.PORT || process.env.MAIN_PORT || 5200),
      hostname: '0.0.0.0',
    },
  };

  config.cache = {
    driver: process.env.CACHE_DRIVER || 'memory',
    menuTtl: Number(process.env.CACHE_MENU_TTL || 300),
    subappTtl: Number(process.env.CACHE_SUBAPP_TTL || 300),
    redis: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB || 0),
    },
  };

  config.subappEntryEnv = {
    'novel-app': 'SUBAPP_NOVEL_ENTRY',
    'testgen-app': 'SUBAPP_TESTGEN_ENTRY',
    'ops-app': 'SUBAPP_OPS_ENTRY',
  };

  config.agentPlatform = {
    baseUrl: process.env.AGENT_PLATFORM_URL || 'http://127.0.0.1:4001',
    timeout: Number(process.env.AGENT_PLATFORM_TIMEOUT || 15000),
  };

  return config;
};
