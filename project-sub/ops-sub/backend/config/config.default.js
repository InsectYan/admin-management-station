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

  return config;
};
