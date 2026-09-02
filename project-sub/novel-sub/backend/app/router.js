'use strict';

module.exports = (app) => {
  const { router, controller } = app;

  router.get('/api/health', controller.health.index);

  router.get('/api/novel-enums', controller.novelEnum.index);

  router.get('/api/novels', controller.novel.index);
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
};
