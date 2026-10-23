require('dotenv').config();

module.exports = appInfo => {
  const config = {};
  config.keys = appInfo.name + '_cartoon_sub';
  config.middleware = [ 'sessionAuth', 'roleGate' ];
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
    port: Number(process.env.POSTGRES_PORT || 5305),
    username: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD || 'admin123',
    database: process.env.POSTGRES_DB || 'cartoon_db',
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
      port: Number(process.env.PORT || 5205),
      hostname: '0.0.0.0',
    },
  };
  config.bodyParser = { jsonLimit: '32mb', formLimit: '32mb' };
  config.main = {
    baseUrl: process.env.MAIN_API_ORIGIN || 'http://127.0.0.1:5200',
  };
  config.novel = {
    baseUrl: process.env.NOVEL_API_ORIGIN || 'http://127.0.0.1:5201',
  };
  config.precheck = {
    baseUrl: process.env.PRECHECK_API_ORIGIN || 'http://127.0.0.1:5204',
    t2iWorkflowId: Number(process.env.CARTOON_T2I_WORKFLOW_ID || 0),
    videoWorkflowId: Number(process.env.CARTOON_VIDEO_WORKFLOW_ID || 0),
    i2vWorkflowId: Number(process.env.CARTOON_I2V_WORKFLOW_ID || 0),
    editWorkflowId: Number(process.env.CARTOON_EDIT_WORKFLOW_ID || 0),
  };
  config.comfy = {
    baseUrl: process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188',
  };
  config.agentPlatform = {
    baseUrl: process.env.AGENT_PLATFORM_URL || 'http://127.0.0.1:4001',
    timeoutMs: Number(process.env.AGENT_PLATFORM_TIMEOUT_MS || 180000),
  };
  config.ops = {
    baseUrl: process.env.OPS_API_ORIGIN || 'http://127.0.0.1:5203',
    internalToken: process.env.OPS_INTERNAL_TOKEN || 'ops-internal-dev',
  };
  config.mediaTools = {
    ffmpeg: process.env.CARTOON_FFMPEG_BIN || 'ffmpeg',
    ffprobe: process.env.CARTOON_FFPROBE_BIN || 'ffprobe',
  };
  return config;
};
