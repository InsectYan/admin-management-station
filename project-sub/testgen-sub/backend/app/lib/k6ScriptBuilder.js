'use strict';

/**
 * 根据 TS-09 配置生成 k6 脚本（可离线执行）
 * @param {object} cfg config_json
 * @param {object} env ft_execution_env row
 */
function buildK6Script(cfg = {}, env = {}) {
  const vu = Math.max(1, Number(cfg.vu ?? 5));
  const durationSec = Math.max(1, Number(cfg.duration_sec ?? 30));
  const path = cfg.path || '/health';
  const method = String(cfg.method || 'GET').toUpperCase();
  const baseUrl = (env.bff_coach_url || env.base_url || 'http://localhost:8080').replace(/\/$/, '');
  const p99Max = Number(cfg.p99_max_ms ?? 500);
  const errorRateMax = Number(cfg.error_rate_max ?? 1);

  const httpCall = method === 'GET'
    ? `http.get(url, { headers })`
    : `http.${method.toLowerCase()}(url, JSON.stringify(body), { headers })`;

  const bodyBlock = method === 'GET' ? '' : `
  const body = ${JSON.stringify(cfg.body || { ping: true })};
`;

  return `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: ${vu},
  duration: '${durationSec}s',
  thresholds: {
    http_req_duration: ['p(99)<${p99Max}'],
    http_req_failed: ['rate<${(errorRateMax / 100).toFixed(4)}'],
  },
};

const baseUrl = '${baseUrl}';
const path = '${path}';
${bodyBlock}
export default function () {
  const url = \`\${baseUrl}\${path}\`;
  const headers = { 'Content-Type': 'application/json', 'X-Test-Source': 'k6-export' };
  const res = ${httpCall};
  check(res, {
    'status 2xx/3xx': (r) => r.status >= 200 && r.status < 400,
  });
  sleep(0.05);
}
`;
}

module.exports = { buildK6Script };
