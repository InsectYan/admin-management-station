const { createCache } = require('./app/lib/cache');

module.exports = app => {
  app.cache = createCache(app.config.cache);
};
