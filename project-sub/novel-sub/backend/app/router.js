'use strict';

module.exports = (app) => {
  const { router, controller } = app;

  router.get('/api/health', controller.health.index);

  router.get('/api/novels', controller.novel.index);
  router.post('/api/novels', controller.novel.create);
  router.post('/api/novels/batch-delete', controller.novel.batchDestroy);
  router.get('/api/novels/:id', controller.novel.show);
  router.put('/api/novels/:id', controller.novel.update);
  router.delete('/api/novels/:id', controller.novel.destroy);
  router.get('/api/novels/:id/setting', controller.novel.getSetting);
  router.put('/api/novels/:id/setting', controller.novel.updateSetting);
};
