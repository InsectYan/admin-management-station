require('dotenv').config();

module.exports = appInfo => {
  const config = {};
  config.keys = appInfo.name + '_precheck_sub';
  config.middleware = [ 'sessionAuth' ];
  config.jwt = {
    secret: process.env.JWT_SECRET || 'CHANGE_ME_LOCAL_JWT',
    enable: false,
  };
  config.security = { csrf: { enable: false } };
  config.cors = {
    origin: '*',
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS',
    allowHeaders: 'Content-Type,Authorization,X-Requested-With',
  };
  config.sequelize = {
    dialect: 'postgres',
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT || 5304),
    username: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD || 'admin123',
    database: process.env.POSTGRES_DB || 'precheck_db',
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
      port: Number(process.env.PORT || 5204),
      hostname: '0.0.0.0',
    },
  };
  config.bodyParser = { jsonLimit: '32mb', formLimit: '32mb' };
  config.comfyui = {
    baseUrl: process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188',
    expectedVersion: process.env.COMFYUI_EXPECTED_VERSION || '0.39.0',
  };
  return config;
};
