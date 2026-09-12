'use strict';

const { syncSchemaOnStartup } = require('./app/lib/schemaSync');

module.exports = app => {
  app.beforeStart(async () => {
    await syncSchemaOnStartup(app);
  });
};
