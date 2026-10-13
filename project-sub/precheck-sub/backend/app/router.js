'use strict';

module.exports = app => {
  const { router, controller } = app;
  router.get('/api/health', controller.health.index);
  router.get('/api/runtimes', controller.runtime.index);
  router.get('/api/runtimes/:id/probe', controller.runtime.probe);
  router.get('/api/workflows', controller.workflow.index);
  router.post('/api/workflows', controller.workflow.create);
  router.put('/api/workflows/:id', controller.workflow.update);
  router.get('/api/workflows/:id/dependencies', controller.workflow.dependencies);
  router.get('/api/workflows/:id', controller.workflow.show);
};
