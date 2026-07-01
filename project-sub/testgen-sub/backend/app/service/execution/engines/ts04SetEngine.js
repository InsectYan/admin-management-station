'use strict';

const { emitProgress } = require('../../../lib/fitnessRunEvents');
const BaseTsEngine = require('./baseTsEngine');
const { resolveHttpBody, methodNeedsBody } = require('../../../lib/httpRequestBody');
const { runHttp } = require('../runners/httpRunner');

class Ts04SetEngine extends BaseTsEngine {
  constructor() {
    super('TS-04-SET');
  }

  /** @param {import('../runOrchestrator').ExecutionContext} ctx */
  async execute(ctx) {
    const { item, env, run, runConfig, ctx: eggCtx } = ctx;
    const sampleSetId = runConfig?.sample_set_id;
    if (!sampleSetId) {
      const err = new Error('TS-04-SET 需要绑定样本集，请先在方案配置页保存 sample_set_id');
      err.status = 400;
      err.code = 'SAMPLE_SET_REQUIRED';
      throw err;
    }

    if (!env?.bff_coach_url) {
      const err = new Error('执行环境未配置 bff_coach_url');
      err.status = 400;
      err.code = 'ENV_NOT_CONFIGURED';
      throw err;
    }

    const samples = await eggCtx.model.FtSampleItem.findAll({
      where: { sample_set_id: sampleSetId },
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
    });

    if (!samples.length) {
      const err = new Error('样本集为空，请添加至少一条 HTTP 样本');
      err.status = 400;
      err.code = 'SAMPLE_SET_EMPTY';
      throw err;
    }

    const configJson = runConfig?.config_json || {};
    const results = [];
    let passCount = 0;
    const total = samples.length;
    const runId = run.id;

    for (let i = 0; i < samples.length; i += 1) {
      const sample = samples[i];
      const input = sample.input_data || {};
      const runner = input.runner || 'http';

      if (runner !== 'http') {
        const err = new Error(`样本 #${i + 1} 非 HTTP 类型，E2 仅支持 input_data.runner=http`);
        err.status = 400;
        err.code = 'RUNNER_NOT_SUPPORTED';
        throw err;
      }

      const path = input.path || input.endpoint_path;
      if (!path) {
        const err = new Error(`样本 #${i + 1} 缺少 path`);
        err.status = 400;
        err.code = 'SAMPLE_INVALID';
        throw err;
      }

      const method = (input.method || input.http_method || 'GET').toUpperCase();
      const expectStatus = input.expect_status ?? input.http_status_expected ?? 200;
      const headers = {
        'X-Test-Run-Id': String(runId),
        'X-Test-Item-Id': item.item_id,
        ...(configJson.headers || {}),
        ...(input.headers || {}),
      };

      const body = methodNeedsBody(method) ? resolveHttpBody(method, input) : undefined;
      const httpResult = await runHttp(eggCtx, {
        baseUrl: env.bff_coach_url,
        path,
        method,
        headers,
        body,
      });

      const statusOk = httpResult.statusCode === Number(expectStatus);
      const subVerdict = statusOk ? 'pass' : 'fail';
      if (statusOk) passCount += 1;

      const currentRate = Math.round((passCount / (i + 1)) * 1000) / 10;
      if (runId) {
        emitProgress(runId, {
          phase: 'running',
          percent: Math.min(69, Math.round(20 + ((i + 1) / total) * 50)),
          pass_rate: currentRate,
          completed: i + 1,
          total,
          run_id: runId,
        });
      }

      results.push({
        sub_index: i,
        input_summary: `${method} ${path} (expect ${expectStatus})`,
        output_summary: `HTTP ${httpResult.statusCode} (${httpResult.responseTimeMs}ms)`,
        assertion_detail: [{
          type: 'status',
          expect: expectStatus,
          actual: httpResult.statusCode,
          ok: statusOk,
          message: statusOk ? 'status match' : `expected ${expectStatus}, got ${httpResult.statusCode}`,
        }],
        sub_verdict: subVerdict,
        artifacts: { http: httpResult, sample_id: sample.id },
      });
    }

    return results;
  }
}

module.exports = Ts04SetEngine;
