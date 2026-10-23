'use strict';

module.exports = app => {
  const { router, controller } = app;
  router.get('/api/health', controller.health.index);
  router.get('/api/runtimes', controller.runtime.index);
  router.get('/api/runtimes/:id/probe', controller.runtime.probe);
  router.post('/api/runtimes/:id/start', controller.runtime.start);
  router.get('/api/workflows', controller.workflow.index);
  router.post('/api/workflows', controller.workflow.create);
  router.post('/api/workflows/inspect', controller.workflow.inspect);
  router.post('/api/workflows/fields', controller.workflow.fields);
  router.post('/api/workflows/drafts/:key/preview', controller.workflow.startDraftPreview);
  router.get('/api/workflows/drafts/:key/preview', controller.workflow.draftStatus);
  router.get('/api/workflows/drafts/:key/file', controller.workflow.draftFile);
  router.put('/api/workflows/:id', controller.workflow.update);
  router.get('/api/workflows/:id/dependencies', controller.workflow.dependencies);
  router.post('/api/workflows/:id/bind', controller.workflow.bind);
  router.post('/api/workflows/:id/preview', controller.workflow.startPreview);
  router.get('/api/workflows/:id/preview', controller.workflow.previewStatus);
  router.get('/api/workflows/:id/preview/file', controller.workflow.previewFile);
  router.get('/api/workflows/:id', controller.workflow.show);
};
