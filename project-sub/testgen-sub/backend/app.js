'use strict';

const { syncSchemaOnStartup } = require('./app/lib/schemaSync');

module.exports = app => {
  app.beforeStart(async () => {
    await syncSchemaOnStartup(app);
  });

  app.ready(async () => {
    const ctx = app.createAnonymousContext();
    try {
      await ctx.service.generationQueue.recoverStuckOnStartup();
      const actionable = await ctx.model.GenerationJobQueue.count({
        where: { queue_status: [ 'waiting', 'running' ] },
      });
      if (actionable > 0) {
        await ctx.service.generationQueue.ensureWorker();
        app.logger.info('[generationQueue] worker started on boot, %s actionable job(s)', actionable);
      }
    } catch (err) {
      app.logger.warn('[generationQueue] boot init skipped: %s', err.message);
    }
  });
};
