/** 解析 ft_run_result.assertion_detail（兼容数组 / 包装对象 / assertions 对象） */
export function normalizeAssertionDetail(detail) {
  if (!detail || typeof detail !== 'object') {
    return { artifacts: {}, assertions: [] };
  }
  if (Array.isArray(detail)) {
    return { artifacts: {}, assertions: detail };
  }
  const artifacts = detail.artifacts || {};
  let assertions = detail.assertions;
  if (assertions && !Array.isArray(assertions)) {
    assertions = [ assertions ];
  }
  return { artifacts, assertions: assertions || [] };
}

export function truncateLogText(text, max = 12000) {
  const s = String(text ?? '');
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n…（已截断，共 ${s.length} 字符）`;
}

/**
 * 从子项结果提取控制台展示用的失败面板数据
 * @param {object} row
 */
export function buildRunFailurePanel(row) {
  const { artifacts, assertions } = normalizeAssertionDetail(row?.assertion_detail);
  const cli = artifacts.cli || null;
  const http = artifacts.http || null;
  const runner = cli ? 'cli' : http ? 'http' : assertions[0]?.runner || '—';

  const exitCode = cli?.exitCode
    ?? assertions.find(a => a.exit_code != null)?.exit_code
    ?? null;
  const durationMs = cli?.durationMs
    ?? assertions.find(a => a.duration_ms != null)?.duration_ms
    ?? null;

  const stderr = cli?.stderr
    || assertions.find(a => a.stderr_tail)?.stderr_tail
    || assertions.find(a => a.stderr)?.stderr
    || '';
  const stdout = cli?.stdout
    || artifacts.output_tail
    || assertions.find(a => a.stdout_tail)?.stdout_tail
    || assertions.find(a => a.stdout)?.stdout
    || '';

  let httpBody = '';
  if (http?.body != null) {
    httpBody = typeof http.body === 'string' ? http.body : JSON.stringify(http.body, null, 2);
  }

  return {
    sub_index: row.sub_index,
    sub_verdict: row.sub_verdict,
    input_summary: row.input_summary || '',
    output_summary: row.output_summary || '',
    runner,
    command: cli?.command || '',
    cwd: cli?.cwd || '',
    exitCode,
    durationMs,
    depsInstalled: cli?.deps_installed,
    stderr,
    stdout,
    httpStatus: http?.statusCode ?? null,
    httpBody,
    assertions,
  };
}

export function buildRunFailurePanels(results = []) {
  return results
    .filter(r => r.sub_verdict === 'fail')
    .map(buildRunFailurePanel);
}
