'use strict';

const Service = require('egg').Service;

class ExecutionService extends Service {
  async fetch(path) {
    const { baseUrl, timeout } = this.config.agentPlatform;
    try {
      const res = await this.ctx.curl(`${baseUrl}${path}`, {
        method: 'GET',
        dataType: 'json',
        timeout,
      });
      if (res.status !== 200) {
        const err = new Error(res.data?.error || `执行轨迹 HTTP ${res.status}`);
        err.status = res.status >= 500 ? 502 : res.status;
        throw err;
      }
      return res.data;
    } catch (err) {
      if (err.status > 0) throw err;
      const wrap = new Error(`Agent 平台不可达 (${baseUrl}): ${err.message}`);
      wrap.status = 502;
      throw wrap;
    }
  }

  list(query = {}) {
    const params = new URLSearchParams();
    [ 'skill', 'status', 'app', 'page', 'pageSize' ].forEach(key => {
      if (query[key] !== undefined && query[key] !== null && query[key] !== '') {
        params.set(key, String(query[key]));
      }
    });
    const qs = params.toString();
    return this.fetch(`/api/executions${qs ? `?${qs}` : ''}`);
  }

  skills() {
    return this.fetch('/api/executions/skills');
  }

  show(id) {
    return this.fetch(`/api/executions/${encodeURIComponent(id)}`);
  }
}

module.exports = ExecutionService;
