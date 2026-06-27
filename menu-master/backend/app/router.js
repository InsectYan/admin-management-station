'use strict';

module.exports = app => {
  const { router, controller, middleware } = app;
  const adminAuth = middleware.adminAuth();

  router.get('/api/health', controller.health.index);
  router.get('/api/menus', controller.menu.index);
  router.get('/api/menus/root', controller.menu.root);
  router.get('/api/llm/profiles', controller.llm.profiles);
  router.post('/api/menus', adminAuth, controller.menu.create);
  router.put('/api/menus/:id', adminAuth, controller.menu.update);
  router.delete('/api/menus/:id', adminAuth, controller.menu.destroy);
};
