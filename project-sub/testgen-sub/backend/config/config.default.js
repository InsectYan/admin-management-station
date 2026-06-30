require('dotenv').config();

module.exports = appInfo => {
  const config = {};

  config.keys = appInfo.name + '_testgen_sub';

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
    port: Number(process.env.POSTGRES_PORT || 5302),
    username: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD || 'admin123',
    database: process.env.POSTGRES_DB || 'testgen_db',
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
      port: Number(process.env.TESTGEN_PORT || process.env.PORT || 5202),
      hostname: '0.0.0.0',
    },
  };

  config.agentPlatform = {
    baseUrl: process.env.AGENT_PLATFORM_URL || 'http://127.0.0.1:4001',
    invokePath: '/api/skills/testgen-skill/invoke',
    judgeInvokePath: process.env.FITNESS_JUDGE_INVOKE_PATH || '/api/skills/fitness-judge-skill/invoke',
    sampleInvokePath: process.env.FITNESS_SAMPLE_INVOKE_PATH || '/api/skills/fitness-sample-skill/invoke',
    exploreInvokePath: process.env.FITNESS_EXPLORE_INVOKE_PATH || '/api/skills/fitness-explore-skill/invoke',
    perfInvokePath: process.env.PERF_SKILL_INVOKE_PATH || '/api/skills/perf-bottleneck-skill/invoke',
    timeout: Number(process.env.AGENT_PLATFORM_TIMEOUT || 300000),
    judgeTimeoutMs: Number(process.env.FITNESS_JUDGE_TIMEOUT_MS || 120000),
    sampleTimeoutMs: Number(process.env.FITNESS_SAMPLE_TIMEOUT_MS || 120000),
    exploreTimeoutMs: Number(process.env.FITNESS_EXPLORE_TIMEOUT_MS || 90000),
  };

  config.testRun = {
    maxConcurrentRuns: Number(process.env.MAX_CONCURRENT_RUNS || 5),
  };

  config.fitnessExecution = {
    fitnessAgentRoot: process.env.FITNESS_AGENT_ROOT || '',
    cliAllowlist: [ 'npm run test:stations', 'npm run test:e2e' ],
    maxConcurrentRuns: Number(process.env.FT_MAX_CONCURRENT_RUNS || 3),
    cliTimeoutMs: Number(process.env.FT_CLI_TIMEOUT_MS || 600000),
    httpTimeoutMs: Number(process.env.FT_HTTP_TIMEOUT_MS || 120000),
  };

  config.projectEnv = {
    healthTimeoutMs: Number(process.env.PROJECT_ENV_HEALTH_TIMEOUT_MS || 10000),
  };

  config.testgen = {
    maxConcurrentJobs: Number(process.env.MAX_CONCURRENT_JOBS || 3),
    parseCacheTtl: Number(process.env.PARSE_CACHE_TTL || 3600),
    uploadDir: process.env.UPLOAD_DIR || '/tmp/testgen-uploads',
    maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 20 * 1024 * 1024),
  };

  config.internalApiToken = process.env.INTERNAL_API_TOKEN || '';

  config.multipart = {
    mode: 'file',
    fileSize: '20mb',
    fileExtensions: [ '.md', '.markdown', '.txt', '.pdf', '.json', '.yaml', '.yml', '.doc', '.docx' ],
  };

  return config;
};
