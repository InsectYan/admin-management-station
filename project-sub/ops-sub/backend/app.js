'use strict';

const { syncSchemaOnStartup } = require('./app/lib/schemaSync');

module.exports = app => {
  app.beforeStart(async () => {
    await syncSchemaOnStartup(app);
    const ctx = app.createAnonymousContext();
    await ctx.service.deployDispatch.resumeQueued();
    const ms = Number(app.config.contentOps?.watchIntervalMs || 60000);
    if (app.opsWatchTimer) clearInterval(app.opsWatchTimer);
    const runTick = () => {
      app.createAnonymousContext().service.content.tick()
        .catch(err => app.logger.warn('[contentWatch] %s', err.message));
    };
    app.opsWatchTimer = setInterval(runTick, ms);
    if (typeof app.opsWatchTimer.unref === 'function') app.opsWatchTimer.unref();
    setTimeout(runTick, 3000).unref?.();
  });
};
