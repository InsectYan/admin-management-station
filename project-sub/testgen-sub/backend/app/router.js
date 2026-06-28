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

  // Fitness 测试资产库
  router.get('/api/fitness/dashboard', controller.fitnessAsset.dashboard);
  router.get('/api/fitness/items/export', controller.fitnessAsset.exportItems);
  router.get('/api/fitness/items', controller.fitnessAsset.listItems);
  router.get('/api/fitness/items/:itemId', controller.fitnessAsset.showItem);
  router.get('/api/fitness/browse', controller.fitnessAsset.browse);
  router.get('/api/fitness/schemes', controller.fitnessAsset.schemes);
  router.get('/api/fitness/enums/:table', controller.fitnessAsset.listEnums);
  router.get('/api/fitness/meta/display/:table?', controller.fitnessAsset.displayMeta);
  router.get('/api/fitness/views/:view', controller.fitnessAsset.queryView);
  router.get('/api/fitness/risks', controller.fitnessAsset.listRisks);
  router.get('/api/fitness/risk-links', controller.fitnessAsset.listRiskLinks);

  // 测试计划
  router.get('/api/fitness/plans', controller.fitnessPlan.index);
  router.post('/api/fitness/plans', controller.fitnessPlan.create);
  router.get('/api/fitness/plans/:id', controller.fitnessPlan.show);
  router.put('/api/fitness/plans/:id', controller.fitnessPlan.update);
  router.post('/api/fitness/plans/:id/items', controller.fitnessPlan.appendItems);
  router.delete('/api/fitness/plans/:id', controller.fitnessPlan.destroy);
  router.post('/api/fitness/plans/:id/results', controller.fitnessPlan.saveResults);
  router.post('/api/fitness/plans/:id/export-report', controller.fitnessPlan.exportReport);

  // 执行层（引擎桩）
  router.get('/api/fitness/environments', controller.fitnessExecution.listEnvs);
  router.post('/api/fitness/environments', controller.fitnessExecution.createEnv);
  router.put('/api/fitness/environments/:id', controller.fitnessExecution.updateEnv);
  router.delete('/api/fitness/environments/:id', controller.fitnessExecution.deleteEnv);
  router.post('/api/fitness/environments/health-check', controller.fitnessExecution.healthCheck);
  router.get('/api/fitness/samples', controller.fitnessExecution.listSampleSets);
  router.post('/api/fitness/samples', controller.fitnessExecution.createSampleSet);
  router.get('/api/fitness/runs', controller.fitnessExecution.listRuns);
  router.get('/api/fitness/runs/:runId', controller.fitnessExecution.showRun);
  router.post('/api/fitness/runs/:runId/cancel', controller.fitnessExecution.cancelRun);
  router.get('/api/fitness/run-config/:itemId', controller.fitnessExecution.getRunConfig);
  router.post('/api/fitness/run-config/:itemId', controller.fitnessExecution.saveRunConfig);
  router.post('/api/fitness/run/:itemId/launch', controller.fitnessExecution.launch);
  router.post('/api/fitness/engines/:scheme/execute', controller.fitnessExecution.executeEngine);
};
