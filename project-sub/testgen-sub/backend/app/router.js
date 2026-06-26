'use strict';

module.exports = app => {
  const { router, controller } = app;

  router.get('/api/health', controller.health.index);

  router.get('/api/documents', controller.document.index);
  router.post('/api/documents', controller.document.create);
  router.post('/api/documents/upload', controller.document.upload);
  router.get('/api/documents/:id', controller.document.show);
  router.delete('/api/documents/:id', controller.document.destroy);

  router.get('/api/knowledge', controller.knowledge.index);
  router.post('/api/knowledge', controller.knowledge.create);
  router.get('/api/knowledge/:id', controller.knowledge.show);
  router.put('/api/knowledge/:id', controller.knowledge.update);
  router.delete('/api/knowledge/:id', controller.knowledge.destroy);

  router.get('/api/modules', controller.module.index);

  router.post('/api/generation-jobs', controller.generationJob.create);
  router.get('/api/generation-jobs/:id', controller.generationJob.show);
  router.post('/api/generation-jobs/:id/cancel', controller.generationJob.cancel);
  router.get('/api/generation-jobs/:id/test-cases', controller.generationJob.testCases);

  router.get('/api/test-cases/export', controller.testCase.export);
  router.get('/api/test-cases', controller.testCase.index);
  router.get('/api/test-cases/:id', controller.testCase.show);
  router.put('/api/test-cases/:id', controller.testCase.update);
  router.delete('/api/test-cases/:id', controller.testCase.destroy);

  router.post('/api/tools/parse-document', controller.tools.parseDocument);
  router.get('/api/tools/knowledge', controller.tools.knowledge);
};
