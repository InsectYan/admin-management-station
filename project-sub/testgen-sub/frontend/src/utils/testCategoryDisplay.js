/**
 * 测试分类 / 执行方案 / 判定方式 — 前端展示层文案与三端分组。
 * 三端 ↔ 现有大类（T1–T12）仅为展示挂靠，不改库、不影响筛选/提交字段语义。
 */

export const ENDPOINT_GROUPS = [
  { id: 'FE', label: '前端' },
  { id: 'BE', label: '服务端' },
  { id: 'AG', label: 'Agent' },
];

/** 现有大类 → 被测端（主挂靠，每大类仅一端） */
export const MAJOR_TO_ENDPOINT = {
  T2: 'FE',
  T10: 'FE',
  T1: 'BE',
  T7: 'BE',
  T8: 'BE',
  T9: 'BE',
  T11: 'BE',
  T3: 'AG',
  T4: 'AG',
  T5: 'AG',
  T6: 'AG',
  T12: 'AG',
};

/** 跑法（TS）人话主文案 */
export const SCHEME_HUMAN_LABELS = {
  'TS-01-DET': '单次请求',
  'TS-02-BND': '多组边界',
  'TS-03-REP': '重复抽样',
  'TS-04-SET': '样本集批量',
  'TS-05-CHAIN': '多步链路',
  'TS-05-API': '接口模板链路',
  'TS-06-PAIR': '对照比较',
  'TS-07-NEG': '负向/对抗',
  'TS-08-OBS': '可观测检查',
  'TS-09-LOAD': '压测',
  'TS-10-MAN': '人工评审',
};

/** 判定（VS）人话主文案 */
export const VALIDATION_HUMAN_LABELS = {
  'VS-01-EXACT': '精确匹配',
  'VS-02-CONTRACT': '契约通过',
  'VS-03-ZERO': '零违规',
  'VS-04-CHAIN-OK': '链路全过',
  'VS-05-PRESENCE': '字段存在',
  'VS-06-COMPLETE': '字段齐全',
  'VS-07-RATE-L': '达标率（低）',
  'VS-07-RATE-M': '达标率（中）',
  'VS-07-RATE-H': '达标率（高）',
  'VS-08-PASSK': '重复稳定',
  'VS-09-BLOCK': '安全阻断',
  'VS-10-SLO': '性能达标',
  'VS-11-MAJORITY': '多数通过',
};

const ENDPOINT_LABEL_BY_ID = Object.fromEntries(
  ENDPOINT_GROUPS.map(g => [ g.id, g.label ]),
);

export function endpointIdForMajor(majorId) {
  const id = String(majorId || '');
  return MAJOR_TO_ENDPOINT[id] || null;
}

export function endpointLabelForMajor(majorId) {
  const ep = endpointIdForMajor(majorId);
  return ep ? ENDPOINT_LABEL_BY_ID[ep] : '';
}

/**
 * 纯展示：前端 · 体验与呈现
 * @param {string} majorId
 * @param {string} [majorName]
 */
export function formatCategoryDisplay(majorId, majorName = '') {
  const id = String(majorId || '');
  if (!id && !majorName) return '—';
  const scene = String(majorName || '').trim() || id;
  const ep = endpointLabelForMajor(id);
  return ep ? `${ep} · ${scene}` : scene;
}

/**
 * @param {string} schemeId
 * @param {string} [name]
 * @param {{ withCode?: boolean }} [opts]
 */
export function formatSchemeLabel(schemeId, name = '', opts = {}) {
  const id = String(schemeId || '');
  if (!id && !name) return '—';
  const human = SCHEME_HUMAN_LABELS[id] || String(name || '').trim();
  if (!human) return id || '—';
  if (opts.withCode === false || !id) return human;
  if (human === id) return id;
  return `${human}（${id}）`;
}

/**
 * @param {string} validationId
 * @param {string} [name]
 * @param {{ withCode?: boolean }} [opts]
 */
export function formatValidationLabel(validationId, name = '', opts = {}) {
  const id = String(validationId || '');
  if (!id && !name) return '—';
  let human = VALIDATION_HUMAN_LABELS[id];
  if (!human && id.startsWith('VS-07-RATE')) human = '达标率';
  if (!human && id.startsWith('VS-10-SLO')) human = '性能达标';
  if (!human) human = String(name || '').trim();
  if (!human) return id || '—';
  if (opts.withCode === false || !id) return human;
  if (human === id) return id;
  return `${human}（${id}）`;
}

/**
 * 将枚举大类列表编成三端级联 options（一级不可选叶子）。
 * @param {Array<{ category_major_id: string, name?: string }>} majors
 */
export function buildCategoryCascaderOptions(majors = []) {
  const byEp = Object.fromEntries(ENDPOINT_GROUPS.map(g => [ g.id, [] ]));
  const orphan = [];

  for (const m of majors) {
    const id = m?.category_major_id;
    if (!id) continue;
    const leaf = {
      value: id,
      label: String(m.name || id).trim() || id,
    };
    const ep = endpointIdForMajor(id);
    if (ep && byEp[ep]) byEp[ep].push(leaf);
    else orphan.push(leaf);
  }

  const options = ENDPOINT_GROUPS
    .map(g => ({
      value: g.id,
      label: g.label,
      children: byEp[g.id],
    }))
    .filter(g => g.children.length > 0);

  if (orphan.length) {
    options.push({
      value: '_OTHER',
      label: '其他',
      children: orphan,
    });
  }
  return options;
}
