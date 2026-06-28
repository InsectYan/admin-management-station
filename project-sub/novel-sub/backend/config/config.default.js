require('dotenv').config();

module.exports = appInfo => {
  const config = {};

  config.keys = appInfo.name + '_novel_sub';

  config.middleware = [];

  config.security = {
    csrf: { enable: false },
  };

  config.cors = {
    origin: '*',
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS',
  };

  config.sequelize = {
    dialect: 'postgres',
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT || 5301),
    username: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD || 'admin123',
    database: process.env.POSTGRES_DB || process.env.NOVEL_POSTGRES_DB || 'novel_db',
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
      port: Number(process.env.PORT || process.env.NOVEL_PORT || 5201),
      hostname: '0.0.0.0',
    },
  };

  return config;
};
