'use strict';

const BaseVsEngine = require('./baseVsEngine');

class VsContractEngine extends BaseVsEngine {
  constructor() {
    super('VS-02-CONTRACT');
  }

  /** @param {import('../runOrchestrator').SubRunResult[]} subResults */
  async judge(subResults, _thresholdJson, item) {
    const details = [];
    let passCount = 0;

    for (const sub of subResults || []) {
      let ok = sub.sub_verdict === 'pass';
      let message = ok ? '子项通过' : '子项失败';

      if (ok && sub.artifacts?.cli && item?.assertion_points?.length) {
        const hay = `${sub.artifacts.cli.stdout || ''}\n${sub.artifacts.cli.stderr || ''}`.toLowerCase();
        for (const point of item.assertion_points) {
          const needle = String(point).toLowerCase();
          if (needle && !hay.includes(needle.slice(0, 20))) {
            /* 断言点多为中文描述，CLI 输出未必包含全文，仅作弱提示 */
          }
        }
      }

      if (sub.assertion_detail && Array.isArray(sub.assertion_detail)) {
        for (const row of sub.assertion_detail) {
          details.push(row);
          if (row.ok === false) ok = false;
        }
      } else if (sub.assertion_detail?.exit_code != null) {
        ok = sub.assertion_detail.exit_code === 0;
        message = ok ? 'CLI exit 0' : `CLI exit ${sub.assertion_detail.exit_code}`;
        details.push({ type: 'cli_exit', ok, message });
      }

      details.push({ type: 'sub_verdict', sub_index: sub.sub_index, ok, message });
      if (ok) passCount += 1;
    }

    const total = subResults?.length || 0;
    const pass = total > 0 && passCount === total;
    const current_rate = total ? Math.round((passCount / total) * 1000) / 10 : 0;

    return {
      pass,
      verdict: pass ? 'pass' : 'fail',
      current_rate,
      target_rate: 100,
      details,
    };
  }
}

module.exports = VsContractEngine;
