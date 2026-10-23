'use strict';

module.exports = (app) => {
  const { router, controller } = app;

  router.get('/api/health', controller.health.index);

  router.get('/api/novel-enums', controller.novelEnum.index);

  router.get('/api/story-templates', controller.novel.templates);
  router.get('/api/novels', controller.novel.index);
  router.post('/api/novels/from-template', controller.novel.createFromTemplate);
  router.post('/api/novels', controller.novel.create);
  router.post('/api/novels/batch-delete', controller.novel.batchDestroy);
  router.get('/api/novels/:id', controller.novel.show);
  router.put('/api/novels/:id', controller.novel.update);
  router.delete('/api/novels/:id', controller.novel.destroy);
  router.get('/api/novels/:id/setting', controller.novel.getSetting);
  router.put('/api/novels/:id/setting', controller.novel.updateSetting);
  router.get('/api/novels/:id/chapters', controller.novel.listChapterMeta);
  router.get('/api/novels/:id/chapters/empty', controller.novel.listEmptyChapters);
  router.get('/api/novels/:id/reader', controller.novel.reader);
  router.get('/api/novels/:id/chapters/:chapterId', controller.novel.showChapterBody);
  router.put('/api/novels/:id/chapters/:chapterId', controller.novel.updateChapterBody);
  router.get('/api/novels/:id/packages', controller.storyDesk.overview);
  router.get('/api/novels/:id/packages/diff', controller.storyDesk.comparePackages);
  router.post('/api/novels/:id/packages', controller.storyDesk.publish);
  router.post('/api/novels/:id/consistency/run', controller.storyDesk.runConsistency);
  router.post('/api/novels/:id/exports', controller.storyDesk.recordExport);
  router.get('/api/novels/:id/plotlines', controller.storyDesk.listPlotlines);
  router.post('/api/novels/:id/plotlines', controller.storyDesk.createPlotline);
  router.put('/api/novels/:id/plotlines/:plotlineId', controller.storyDesk.updatePlotline);
  router.delete('/api/novels/:id/plotlines/:plotlineId', controller.storyDesk.removePlotline);
  router.post('/api/novels/:id/chapters/:chapterId/plotlines', controller.storyDesk.bindChapterPlotlines);
  router.get('/api/novels/:id/scripts', controller.storyDesk.listScripts);
  router.post('/api/novels/:id/scripts/suggest', controller.storyDesk.suggestScript);
  router.post('/api/novels/:id/scripts', controller.storyDesk.createScript);
  router.put('/api/novels/:id/scripts/:scriptId', controller.storyDesk.updateScript);
  router.delete('/api/novels/:id/scripts/:scriptId', controller.storyDesk.removeScript);
  router.get('/api/novels/:id/intent-shots', controller.storyDesk.listIntentShots);
  router.post('/api/novels/:id/intent-shots/suggest', controller.storyDesk.suggestIntentShots);
  router.post('/api/novels/:id/intent-shots', controller.storyDesk.createIntentShot);
  router.put('/api/novels/:id/intent-shots/:shotId', controller.storyDesk.updateIntentShot);
  router.delete('/api/novels/:id/intent-shots/:shotId', controller.storyDesk.removeIntentShot);
  router.post('/api/novels/:id/terms', controller.storyDesk.createTerm);
  router.delete('/api/novels/:id/terms/:termId', controller.storyDesk.removeTerm);
  router.post('/api/novels/:id/promotions/:promotionId/apply', controller.storyDesk.applyPromotion);
  router.post('/api/novels/:id/promotions/:promotionId/reject', controller.storyDesk.rejectPromotion);
  router.get('/api/packages/:packageId', controller.storyDesk.showPackage);
  router.post('/api/internal/promotions', controller.storyDesk.createPromotion);
  router.post('/api/internal/downstreams', controller.storyDesk.saveDownstream);
  router.get('/api/internal/ops/summary', controller.storyDesk.opsSummary);
  router.get('/api/internal/ops/tasks', controller.storyDesk.opsTasks);
  router.get('/api/internal/ops/tasks/:id', controller.storyDesk.opsTask);

  router.get('/api/ai/sessions', controller.aiSession.index);
  router.post('/api/ai/sessions', controller.aiSession.create);
  router.patch('/api/ai/sessions/:id', controller.aiSession.update);
  router.delete('/api/ai/sessions/:id', controller.aiSession.destroy);
  router.get('/api/ai/sessions/:id/messages', controller.aiSession.messages);
  router.post('/api/ai/sessions/:id/turns', controller.aiSession.turns);
  router.post('/api/ai/sessions/:id/turns/stream', controller.aiSession.turnsStream);
  router.post('/api/ai/sessions/:id/apply', controller.aiSession.apply);
  router.post('/api/ai/dispatch', controller.aiSession.dispatch);
  router.post('/api/ai/cover/generate', controller.aiCover.generate);

  router.get('/api/ai/review/modules', controller.aiReview.modules);
  router.post('/api/ai/review', controller.aiReview.create);
  router.get('/api/novels/:id/qa', controller.aiReview.show);
  router.post('/api/novels/:id/qa/ignore', controller.aiReview.ignore);

  router.get('/api/anomaly-reports', controller.novelAnomaly.index);
  router.post('/api/anomaly-reports', controller.novelAnomaly.create);
  router.get('/api/anomaly-reports/:id', controller.novelAnomaly.show);
  router.post('/api/anomaly-reports/:id/tasks/:taskId/run', controller.novelAnomaly.runTask);
  router.post('/api/anomaly-reports/:id/tasks/:taskId/status', controller.novelAnomaly.setTaskStatus);
};
