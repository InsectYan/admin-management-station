'use strict';

const Service = require('egg').Service;
const axios = require('axios');

const VALID_METHODS = new Set([ 'GET', 'POST', 'PUT', 'DELETE', 'PATCH' ]);

function truncateBody(body, max = 2000) {
  const str = typeof body === 'string' ? body : JSON.stringify(body);
  if (!str || str.length <= max) return body;
  return `${str.slice(0, max)}…`;
}

function jsonPathGet(obj, path) {
  if (!path || !obj) return undefined;
  const normalized = path.replace(/^\$\.?/, '');
  const parts = normalized.split('.').filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [ ...values ].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

class ExecutionEngineService extends Service {
  buildUrl(baseUrl, path) {
    const base = String(baseUrl || '').replace(/\/$/, '');
    const rel = String(path || '').startsWith('/') ? path : `/${path || ''}`;
    return `${base}${rel}`;
  }

  mergeHeaders(envHeaders, caseHeaders) {
    return { ...(envHeaders || {}), ...(caseHeaders || {}) };
  }

  validateHttpConfig(httpConfig) {
    if (!httpConfig?.url) {
      const err = new Error('用例缺少 http_config.url，请先编辑用例配置请求');
      err.status = 400;
      throw err;
    }
    const method = (httpConfig.method || 'GET').toUpperCase();
    if (!VALID_METHODS.has(method)) {
      const err = new Error(`不支持的 HTTP 方法: ${method}`);
      err.status = 400;
      throw err;
    }
    return { ...httpConfig, method };
  }

  async runAssertions(assertions, { statusCode, body, responseTimeMs }) {
    const details = [];
    let passed = true;

    for (const rule of assertions || []) {
      const type = rule.type;
      let ok = true;
      let message = '';

      if (type === 'status') {
        ok = statusCode === Number(rule.expect);
        message = ok ? '状态码匹配' : `期望 ${rule.expect}，实际 ${statusCode}`;
      } else if (type === 'json_path') {
        const actual = jsonPathGet(body, rule.path);
        ok = String(actual) === String(rule.expect);
        message = ok ? 'JSONPath 匹配' : `期望 ${rule.expect}，实际 ${actual}`;
      } else if (type === 'latency_ms') {
        ok = responseTimeMs <= Number(rule.max);
        message = ok ? '响应时间达标' : `期望 ≤${rule.max}ms，实际 ${responseTimeMs}ms`;
      } else {
        ok = true;
        message = `未知断言类型: ${type}`;
      }

      if (!ok) passed = false;
      details.push({ type, ok, message, rule });
    }

    if (!assertions?.length && statusCode >= 400) {
      passed = false;
      details.push({ type: 'status', ok: false, message: `HTTP ${statusCode}` });
    }

    return { passed, details };
  }

  async executeFunctionalRequest({ httpConfig, envConfig, requestIndex = 0 }) {
    const cfg = this.validateHttpConfig(httpConfig);
    const url = this.buildUrl(envConfig.base_url, cfg.url);
    const headers = this.mergeHeaders(envConfig.headers_template, cfg.headers);
    const start = Date.now();
    let statusCode = 0;
    let responseBody = null;
    let errorMessage = null;

    try {
      const res = await axios({
        method: cfg.method,
        url,
        headers,
        data: cfg.body,
        timeout: Number(cfg.timeout_ms || 30000),
        validateStatus: () => true,
      });
      statusCode = res.status;
      responseBody = typeof res.data === 'object' ? res.data : { raw: String(res.data).slice(0, 500) };
    } catch (err) {
      errorMessage = err.message;
      statusCode = err.response?.status || 0;
      responseBody = err.response?.data ? truncateBody(err.response.data) : null;
    }

    const responseTimeMs = Date.now() - start;
    const { passed, details } = await this.runAssertions(cfg.assertions, {
      statusCode,
      body: responseBody,
      responseTimeMs,
    });

    return {
      request_index: requestIndex,
      status: passed && !errorMessage ? 'success' : 'failed',
      response_time_ms: responseTimeMs,
      http_status_code: statusCode,
      response_body: truncateBody(responseBody),
      error_message: errorMessage,
      assertion_details: details,
    };
  }

  async executeFunctionalRun(run, testCase, envConfig) {
    const httpConfig = testCase.http_config || {};
    const result = await this.executeFunctionalRequest({ httpConfig, envConfig });
    await this.ctx.model.FuncResult.create({
      run_id: run.id,
      ...result,
    });
    return {
      success: result.status === 'success',
      result,
    };
  }

  async executePerformanceRun(run, testCase, envConfig) {
    const httpConfig = this.validateHttpConfig(testCase.http_config || {});
    const perfOptions = run.perf_options || {};
    const durationSec = Number(perfOptions.duration_sec || 30);
    const targetRps = Number(perfOptions.target_rps || 10);
    const concurrency = Math.max(1, Number(run.concurrency || 1));
    const windowSec = 5;

    const endAt = Date.now() + durationSec * 1000;
    let totalRequests = 0;
    let successRequests = 0;
    let errorRequests = 0;
    const windowSamples = [];
    let windowStart = Date.now();
    let windowTimes = [];
    let windowErrors = 0;
    let windowCount = 0;

    const appendLog = async (line) => {
      const row = await this.ctx.model.TestRun.findByPk(run.id);
      const prev = row?.log_tail || '';
      const next = `${prev}${prev ? '\n' : ''}${line}`.slice(-8000);
      await this.ctx.model.TestRun.update({ log_tail: next }, { where: { id: run.id } });
    };

    await appendLog(`[perf] 开始压测 duration=${durationSec}s concurrency=${concurrency}`);

    while (Date.now() < endAt) {
      const reloaded = await this.ctx.model.TestRun.findByPk(run.id);
      if (reloaded?.status === 'cancelled') break;

      const batch = Math.min(concurrency, targetRps);
      const tasks = [];
      for (let i = 0; i < batch; i += 1) {
        tasks.push(this.executeFunctionalRequest({ httpConfig, envConfig, requestIndex: totalRequests + i }));
      }
      const results = await Promise.all(tasks);

      for (const r of results) {
        totalRequests += 1;
        windowCount += 1;
        windowTimes.push(r.response_time_ms || 0);
        if (r.status === 'success') successRequests += 1;
        else {
          errorRequests += 1;
          windowErrors += 1;
        }
      }

      const now = Date.now();
      if (now - windowStart >= windowSec * 1000) {
        const elapsedSec = (now - windowStart) / 1000;
        const tps = windowCount / elapsedSec;
        const errorRate = windowCount ? windowErrors / windowCount : 0;
        const avgRt = windowTimes.length
          ? Math.round(windowTimes.reduce((a, b) => a + b, 0) / windowTimes.length)
          : 0;
        const p95 = Math.round(percentile(windowTimes, 95));

        await this.ctx.model.PerfResult.create({
          run_id: run.id,
          window_start: new Date(windowStart),
          tps,
          avg_response_time_ms: avgRt,
          p95_response_time_ms: p95,
          error_rate: errorRate,
        });
        windowSamples.push({ tps, avg_response_time_ms: avgRt, p95_response_time_ms: p95, error_rate: errorRate });

        const progress = Math.min(99, ((now - (endAt - durationSec * 1000)) / (durationSec * 1000)) * 100);
        await this.ctx.model.TestRun.update({
          progress,
          total_requests: totalRequests,
          success_requests: successRequests,
          error_requests: errorRequests,
        }, { where: { id: run.id } });

        windowStart = now;
        windowTimes = [];
        windowErrors = 0;
        windowCount = 0;
      }

      await new Promise(r => setTimeout(r, Math.max(10, 1000 / targetRps)));
    }

    await appendLog(`[perf] 完成 total=${totalRequests} success=${successRequests} error=${errorRequests}`);

    return {
      success: errorRequests === 0 || successRequests > 0,
      totalRequests,
      successRequests,
      errorRequests,
      windowSamples,
    };
  }
}

module.exports = ExecutionEngineService;
