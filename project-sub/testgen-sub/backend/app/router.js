'use strict';

module.exports = app => {
  const { router, controller } = app;

  router.get('/api/health', controller.health.index);

  router.get('/api/documents', controller.document.index);
  router.post('/api/documents', controller.document.create);
  router.post('/api/documents/upload', controller.document.upload);
  router.post('/api/documents/preview', controller.document.preview);
  router.get('/api/documents/staging/:id/file', controller.document.serveStagingFile);
  router.get('/api/documents/:id/preview', controller.document.previewMeta);
  router.get('/api/documents/:id/file', controller.document.serveFile);
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
  router.post('/api/generation-jobs/:id/retry', controller.generationJob.retry);
  router.get('/api/generation-jobs/:id/test-cases', controller.generationJob.testCases);
  router.post('/api/internal/generation-jobs/:id/agent-context', controller.generationJob.updateAgentContext);

  router.get('/api/test-cases/export', controller.testCase.export);
  router.get('/api/test-cases', controller.testCase.index);
  router.post('/api/test-cases/batch-delete', controller.testCase.batchDestroy);
  router.delete('/api/test-cases/all', controller.testCase.destroyAll);
  router.get('/api/test-cases/:id', controller.testCase.show);
  router.put('/api/test-cases/:id', controller.testCase.update);
  router.delete('/api/test-cases/:id', controller.testCase.destroy);

  router.get('/api/env-configs', controller.envConfig.index);
  router.post('/api/env-configs', controller.envConfig.create);
  router.get('/api/env-configs/:id', controller.envConfig.show);
  router.put('/api/env-configs/:id', controller.envConfig.update);
  router.delete('/api/env-configs/:id', controller.envConfig.destroy);

  router.post('/api/test-runs', controller.testRun.create);
  router.get('/api/test-runs', controller.testRun.index);
  router.get('/api/test-runs/:id', controller.testRun.show);
  router.post('/api/test-runs/:id/cancel', controller.testRun.cancel);
  router.get('/api/test-runs/:id/results', controller.testRun.results);

  router.post('/api/tools/parse-document', controller.tools.parseDocument);
  router.get('/api/tools/knowledge', controller.tools.knowledge);
};
