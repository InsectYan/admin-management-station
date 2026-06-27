const { createCache } = require('./app/lib/cache');
const { syncSchemaOnStartup } = require('./app/lib/schemaSync');

module.exports = app => {
  app.cache = createCache(app.config.cache);

  app.beforeStart(async () => {
    await syncSchemaOnStartup(app);
  });
};
