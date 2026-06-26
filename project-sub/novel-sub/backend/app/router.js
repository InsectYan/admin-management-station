'use strict';

module.exports = app => {
  const { router, controller } = app;

  router.get('/api/health', controller.health.index);
  router.get('/api/novels', controller.novel.index);
  router.get('/api/novels/:id', controller.novel.show);
  router.post('/api/novels', controller.novel.create);
  router.put('/api/novels/:id', controller.novel.update);
  router.delete('/api/novels/:id', controller.novel.destroy);

  router.get('/api/internal/novels', controller.internal.listNovels);
};
