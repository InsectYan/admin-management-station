'use strict';

module.exports = app => {
  const { router, controller } = app;
  router.get('/api/health', controller.health.index);
  router.get('/api/projects', controller.project.index);
  router.post('/api/projects', controller.project.create);
  router.get('/api/projects/:id', controller.project.show);
  router.post('/api/projects/:id/imports', controller.project.addImport);
  router.post('/api/projects/:id/imports/from-novel', controller.project.pullNovel);
  router.post('/api/projects/:id/shots', controller.project.addShot);
  router.put('/api/shots/:id', controller.project.updateShot);
  router.post('/api/projects/:id/shots/:shotId/generate', controller.project.generate);
  router.get('/api/outputs/:id/file', controller.project.outputFile);
};
