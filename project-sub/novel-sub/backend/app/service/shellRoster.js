'use strict';

const Service = require('egg').Service;

class ShellRosterService extends Service {
  bases() {
    const configured = String(this.config.main?.baseUrl || 'http://127.0.0.1:5200').replace(/\/$/, '');
    const list = [ configured ];
    if (/127\.0\.0\.1|localhost/.test(configured)) {
      list.push(configured.replace(/127\.0\.0\.1|localhost/, 'host.docker.internal'));
    }
    return list;
  }

  async list(appKey, projectId) {
    const auth = this.ctx.get('authorization');
    if (!auth) return { rows: [], note: '登录后才能看到壳上登记的成员' };
    let last = null;
    for (const base of this.bases()) {
      try {
        const res = await fetch(`${base}/api/project-members?app_key=${encodeURIComponent(appKey)}&project_id=${projectId}`, {
          headers: { authorization: auth },
          signal: AbortSignal.timeout(8000),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) return { rows: [], note: json?.message || '壳上的成员名单暂时读不到' };
        return { rows: json?.data?.rows || [], note: '' };
      } catch (err) {
        last = err;
      }
    }
    this.ctx.logger.warn('[shellRoster] %s', last?.message || '失败');
    return { rows: [], note: '壳上的成员名单暂时读不到' };
  }
}

module.exports = ShellRosterService;
