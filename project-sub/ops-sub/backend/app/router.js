'use strict';

module.exports = app => {
  const { router, controller } = app;
  router.get('/api/health', controller.health.index);
  router.get('/api/projects/template', controller.project.template);
  router.post('/api/projects/import', controller.project.importFile);
  router.post('/api/projects/generate', controller.project.generate);
  router.post('/api/projects/:id/generate', controller.project.generateApply);
  router.get('/api/projects/:id/export', controller.project.exportFile);
  router.get('/api/projects', controller.project.index);
  router.post('/api/projects', controller.project.create);
  router.get('/api/projects/:id', controller.project.show);
  router.put('/api/projects/:id', controller.project.update);
  router.delete('/api/projects/:id', controller.project.destroy);
};
