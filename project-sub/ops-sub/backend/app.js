'use strict';

const { syncSchemaOnStartup } = require('./app/lib/schemaSync');

module.exports = app => {
  app.beforeStart(async () => {
    await syncSchemaOnStartup(app);
    const ctx = app.createAnonymousContext();
    await ctx.service.deployDispatch.resumeQueued();
  });
};
