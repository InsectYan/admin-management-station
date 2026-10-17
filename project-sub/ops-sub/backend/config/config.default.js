require('dotenv').config();

module.exports = appInfo => {
  const config = {};

  config.keys = appInfo.name + '_ops_sub';

  config.middleware = [ 'sessionAuth' ];

  config.jwt = {
    secret: process.env.JWT_SECRET || 'CHANGE_ME_LOCAL_JWT',
    enable: false,
  };

  config.security = {
    csrf: { enable: false },
  };

  config.cors = {
    origin: '*',
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS',
    allowHeaders: 'Content-Type,Authorization,X-Requested-With',
  };

  config.sequelize = {
    dialect: 'postgres',
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT || 5303),
    username: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD || 'admin123',
    database: process.env.POSTGRES_DB || 'ops_db',
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
      port: Number(process.env.OPS_PORT || process.env.PORT || 5203),
      hostname: '0.0.0.0',
    },
  };

  config.agentPlatform = {
    baseUrl: process.env.AGENT_PLATFORM_URL || 'http://127.0.0.1:4001',
    timeoutMs: Number(process.env.AGENT_PLATFORM_TIMEOUT_MS || 600000),
    skill: process.env.OPS_PROJECT_SKILL || 'ops-project-skill',
    deploySkill: process.env.OPS_DEPLOY_SKILL || 'ops-deploy-skill',
  };

  config.bodyParser = {
    jsonLimit: '16mb',
    formLimit: '16mb',
  };

  config.menuMaster = {
    baseUrl: process.env.MENU_MASTER_URL || 'http://127.0.0.1:5200',
  };

  const origin = (name, fallback) => String(process.env[name] || fallback).replace(/\/$/, '');
  config.contentOps = {
    cartoonBaseUrl: origin('CARTOON_API_ORIGIN', 'http://127.0.0.1:5205'),
    internalToken: process.env.OPS_INTERNAL_TOKEN || 'ops-internal-dev',
    watchIntervalMs: Number(process.env.OPS_WATCH_INTERVAL_MS || 60000),
    deps: [
      { key: 'menu', name: '主应用', url: `${origin('MENU_MASTER_URL', 'http://127.0.0.1:5200')}/api/health` },
      { key: 'novel', name: '小说', url: `${origin('NOVEL_API_ORIGIN', 'http://127.0.0.1:5201')}/api/health` },
      { key: 'testgen', name: '测试', url: `${origin('TESTGEN_API_ORIGIN', 'http://127.0.0.1:5202')}/api/health` },
      { key: 'precheck', name: '预检', url: `${origin('PRECHECK_API_ORIGIN', 'http://127.0.0.1:5204')}/api/health` },
      { key: 'cartoon', name: '漫剧', url: `${origin('CARTOON_API_ORIGIN', 'http://127.0.0.1:5205')}/api/health` },
      { key: 'agent', name: 'Agent', url: `${origin('AGENT_PLATFORM_URL', 'http://127.0.0.1:4001')}/health` },
      { key: 'comfy', name: 'ComfyUI', url: `${origin('COMFYUI_BASE_URL', 'http://127.0.0.1:8188')}/system_stats` },
    ],
  };

  return config;
};
