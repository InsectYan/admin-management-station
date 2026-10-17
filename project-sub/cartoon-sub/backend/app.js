'use strict';

const { syncSchemaOnStartup } = require('./app/lib/schemaSync');

module.exports = app => {
  app.beforeStart(async () => {
    await syncSchemaOnStartup(app);
    try {
      const ctx = app.createAnonymousContext();
      await ctx.service.editExport.failInterrupted();
    } catch (err) {
      app.logger.warn('[cartoon] 清理导出任务失败：%s', err.message);
    }
    try {
      const ctx = app.createAnonymousContext();
      const ids = await ctx.service.generate.ensureFixtures();
      app.logger.info('[cartoon] workflow ids %j', ids);
    } catch (err) {
      app.logger.warn('[cartoon] 预检工作流未登记：%s', err.message);
    }
  });
};
