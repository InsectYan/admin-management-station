require('dotenv').config();

const path = require('path');

module.exports = appInfo => {
  const config = {};

  config.keys = appInfo.name + '_admin_platform';

  config.middleware = [];

  config.security = {
    csrf: { enable: false },
  };

  config.cors = {
    origin: '*',
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS',
  };

  config.jwt = {
    secret: process.env.JWT_SECRET || 'CHANGE_ME_LOCAL_JWT',
    enable: true,
    ignore: ctx => {
      if (ctx.path === '/api/health') return true;
      if (ctx.method === 'GET' && (ctx.path === '/api/menus' || ctx.path === '/api/menus/root')) {
        return true;
      }
      return false;
    },
  };

  config.sequelize = {
    dialect: 'postgres',
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT || 5432),
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
      port: Number(process.env.PORT || process.env.MAIN_PORT || 7001),
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
  };

  return config;
};
