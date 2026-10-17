'use strict';

const CN_DIGIT = {
  零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

function cnToInt(text) {
  const raw = String(text || '');
  if (!raw) return null;
  const units = { 十: 10, 百: 100, 千: 1000 };
  let total = 0;
  let current = 0;
  let seen = false;
  for (const ch of raw) {
    if (CN_DIGIT[ch] != null) {
      current = CN_DIGIT[ch];
      seen = true;
      continue;
    }
    const unit = units[ch];
    if (!unit) return null;
    total += (current || 1) * unit;
    current = 0;
    seen = true;
  }
  if (!seen) return null;
  return total + current;
}

function parseChapterNo(title) {
  const matched = String(title || '').match(/第\s*([0-9]{1,4}|[零一二三四五六七八九十百千]+)\s*章/);
  if (!matched) return null;
  if (/^\d+$/.test(matched[1])) return Number(matched[1]);
  return cnToInt(matched[1]);
}

function flattenOutline(volumes = []) {
  const nodes = [];
  const push = (node, extra) => {
    const title = String(node?.title || '').trim();
    const id = String(node?.id || '').trim();
    if (!title && !id) return;
    nodes.push({
      id,
      title,
      index: nodes.length,
      ...extra,
    });
  };
  for (const vol of volumes || []) {
    const groups = Array.isArray(vol?.groups) ? vol.groups : [];
    if (!groups.length) {
      push(vol, { level: 'volume' });
      continue;
    }
    for (const group of groups) {
      const sections = Array.isArray(group?.sections) ? group.sections : [];
      if (!sections.length) {
        push(group, { level: 'group', volumeTitle: vol?.title || '' });
        continue;
      }
      for (const sec of sections) {
        push(sec, {
          level: 'section',
          volumeTitle: vol?.title || '',
          groupTitle: group?.title || '',
        });
      }
    }
  }
  return nodes;
}

function resolveOutline(nodes, ref) {
  const key = String(ref || '').trim();
  if (!key) return null;
  return nodes.find((node) => node.id === key || node.title === key) || null;
}

function outlineWordTarget(setting) {
  let total = 0;
  for (const vol of setting?.outline?.volumes || []) {
    total += Number(vol?.word_target) || 0;
    for (const group of vol.groups || []) {
      total += Number(group?.word_target) || 0;
      for (const sec of group.sections || []) {
        total += Number(sec?.word_target) || 0;
      }
    }
  }
  return total;
}

function wordFloor(setting, chapterCount) {
  const target = outlineWordTarget(setting);
  const count = Math.max(Number(chapterCount) || 0, 1);
  if (target > 0) return Math.max(800, Math.round((target / count) * 0.5));
  return 1500;
}

function titleTokens(title) {
  const clean = String(title || '')
    .replace(/第\s*[0-9零一二三四五六七八九十百千]+\s*[章节卷部]/g, '')
    .replace(/[\s:：,，.。!！?？、；;“”"'‘’（）()【】\[\]-]/g, '');
  const tokens = [];
  for (let i = 0; i < clean.length - 1; i += 1) {
    tokens.push(clean.slice(i, i + 2));
  }
  return [...new Set(tokens)].slice(0, 16);
}

function tokenHits(text, tokens) {
  const body = String(text || '');
  return tokens.filter((token) => token && body.includes(token)).length;
}

function listChapters(setting) {
  const chapters = Array.isArray(setting?.chapters) ? setting.chapters : [];
  return chapters
    .map((ch, index) => ({
      raw: ch,
      id: String(ch?.id || '').trim() || `idx-${index}`,
      title: String(ch?.title || '').trim() || '未命名章节',
      order: Number(ch?.order) || index + 1,
      outline_ref: String(ch?.outline_ref || '').trim(),
      index,
    }))
    .sort((a, b) => a.order - b.order || a.index - b.index);
}

function finding(partial) {
  const code = partial.code || 'x';
  const chapter = partial.chapter_id ? String(partial.chapter_id) : '';
  return {
    id: partial.id || `f_${code}_${chapter || 'book'}`,
    code,
    severity: partial.severity || 'warning',
    chapter_id: partial.chapter_id || '',
    chapter_title: partial.chapter_title || '',
    order: partial.order || null,
    message: partial.message || '',
    detail: partial.detail || '',
    evidence: partial.evidence || '',
  };
}

function inspectOutlineSequence(chapters, nodes) {
  const lines = [];
  let lastIndex = -1;
  chapters.forEach((ch) => {
    const node = resolveOutline(nodes, ch.outline_ref);
    if (!node) return;
    if (node.index < lastIndex) {
      lines.push(`「${ch.title}」关联「${node.title}」，这个大纲节点排在前面章节已用节点之前`);
    }
    lastIndex = Math.max(lastIndex, node.index);
  });
  if (!lines.length) return [];
  return [finding({
    id: 'f_outline_sequence_book',
    code: 'outline_sequence',
    severity: 'warning',
    message: `章节叙事顺序和大纲树顺序不一致，共 ${lines.length} 处`,
    detail: '章节号本身可以是连续的。这里只说明已关联的大纲节点在大纲树里发生了回退。不自动重排章节，避免打乱已经写好的正文。',
    evidence: lines.slice(0, 12).join('\n'),
  })];
}

function inspectOrder(chapters) {
  const lines = [];
  const seen = new Map();
  chapters.forEach((ch, index) => {
    if (seen.has(ch.order)) {
      const prev = chapters[seen.get(ch.order)];
      lines.push(`顺序号 ${ch.order} 重复：「${prev.title}」与「${ch.title}」`);
    } else {
      seen.set(ch.order, index);
    }
    if (ch.order !== index + 1) {
      lines.push(`「${ch.title}」排在第 ${index + 1} 位，顺序号却是 ${ch.order}`);
    }
    const no = parseChapterNo(ch.title);
    if (no != null && no !== ch.order) {
      lines.push(`「${ch.title}」标题序号是 ${no}，目录顺序是 ${ch.order}`);
    }
  });
  if (!lines.length) return [];
  return [finding({
    id: 'f_order_chaos_book',
    code: 'order_chaos',
    severity: 'error',
    message: `章节目录顺序混乱，共 ${lines.length} 处`,
    detail: '目录应按 1、2、3… 连续排列，标题里的「第 N 章」应与顺序一致，已关联大纲的章节不应倒退到更早的大纲节点。',
    evidence: lines.slice(0, 12).join('\n'),
  })];
}

function inspectWords(chapters, bodyById, floor) {
  const findings = [];
  for (const ch of chapters) {
    const wc = Number(bodyById.get(ch.id)?.word_count) || 0;
    if (wc <= 0) {
      findings.push(finding({
        code: 'word_short',
        severity: 'error',
        chapter_id: ch.id,
        chapter_title: ch.title,
        order: ch.order,
        message: `「${ch.title}」没有正文`,
        detail: `按大纲规划均摊，本章至少应有 ${floor} 字。当前 0 字。`,
        evidence: '0',
      }));
      continue;
    }
    if (wc < floor) {
      findings.push(finding({
        code: 'word_short',
        severity: 'warning',
        chapter_id: ch.id,
        chapter_title: ch.title,
        order: ch.order,
        message: `「${ch.title}」字数不够`,
        detail: `按大纲规划均摊，本章至少应有 ${floor} 字。当前 ${wc} 字。`,
        evidence: String(wc),
      }));
    }
  }
  return findings;
}

function inspectContent(chapters, nodes, bodyById, characters) {
  const findings = [];
  const names = (characters || [])
    .map((row) => String(row?.name || '').trim())
    .filter((name) => name.length >= 2);
  chapters.forEach((ch, index) => {
    const body = String(bodyById.get(ch.id)?.body || '');
    const node = resolveOutline(nodes, ch.outline_ref);
    if (!ch.outline_ref) {
      findings.push(finding({
        code: 'outline_unlinked',
        severity: 'warning',
        chapter_id: ch.id,
        chapter_title: ch.title,
        order: ch.order,
        message: `「${ch.title}」未关联大纲`,
        detail: '全面检测要求每一章对应大纲中的卷、组或小节，才能核对正文是否写到该节点。',
      }));
    } else if (!node) {
      findings.push(finding({
        code: 'outline_dangling',
        severity: 'error',
        chapter_id: ch.id,
        chapter_title: ch.title,
        order: ch.order,
        message: `「${ch.title}」的大纲关联已失效`,
        detail: `outline_ref「${ch.outline_ref}」在当前大纲里找不到。`,
        evidence: ch.outline_ref,
      }));
    } else if (body.trim()) {
      const tokens = titleTokens(node.title);
      if (tokens.length >= 2 && tokenHits(body, tokens) === 0) {
        findings.push(finding({
          code: 'outline_drift',
          severity: 'warning',
          chapter_id: ch.id,
          chapter_title: ch.title,
          order: ch.order,
          message: `「${ch.title}」正文与大纲「${node.title}」对不上`,
          detail: '本章正文没有出现所关联大纲标题中的关键用词，可能写偏了节点。',
          evidence: node.title,
        }));
      }
    }
    if (index === 0 || !body.trim()) return;
    const prev = chapters[index - 1];
    const prevBody = String(bodyById.get(prev.id)?.body || '');
    const tail = prevBody.slice(-600);
    const carried = names.filter((name) => tail.includes(name));
    if (!carried.length) return;
    const missing = carried.filter((name) => !body.includes(name));
    if (missing.length !== carried.length) return;
    const prevNode = resolveOutline(nodes, prev.outline_ref);
    const jump = node && prevNode ? node.index - prevNode.index : 0;
    if (jump <= 1 && node && prevNode) return;
    findings.push(finding({
      code: 'prev_disconnect',
      severity: 'warning',
      chapter_id: ch.id,
      chapter_title: ch.title,
      order: ch.order,
      message: `「${ch.title}」与上一章「${prev.title}」接不上`,
      detail: `上一章结尾出现的人物（${carried.slice(0, 4).join('、')}）在本章完全没有出现，且大纲节点相对上一章跳开。`,
      evidence: carried.slice(0, 6).join('、'),
    }));
  });
  return findings;
}

function buildTasks(findings) {
  const tasks = [];
  if (findings.some((row) => row.code === 'order_chaos')) {
    tasks.push({
      id: 'task_order',
      action: 'normalize_order',
      module: 'content',
      step: 6,
      label: '整理章节目录顺序',
      detail: '打开编辑页「章节目录」，按标题序号重排并重新编号。',
      status: 'pending',
      chapter_id: '',
    });
  }
  const relink = findings.filter((row) => row.code === 'outline_unlinked' || row.code === 'outline_dangling');
  if (relink.length) {
    tasks.push({
      id: 'task_relink',
      action: 'relink_outline',
      module: 'content',
      step: 6,
      label: `补上 ${relink.length} 章的大纲关联`,
      detail: '在章节目录里按标题把悬空或缺失的大纲关联补到最接近的大纲节点。',
      status: 'pending',
      chapter_id: '',
    });
  }
  const seen = new Set();
  findings
    .filter((row) => row.code === 'word_short' || row.code === 'outline_drift' || row.code === 'prev_disconnect')
    .forEach((row) => {
      if (!row.chapter_id || seen.has(row.chapter_id)) return;
      seen.add(row.chapter_id);
      const reasons = findings
        .filter((item) => item.chapter_id === row.chapter_id && item.code !== 'order_chaos')
        .map((item) => item.message);
      tasks.push({
        id: `task_rewrite_${row.chapter_id}`,
        action: 'rewrite_chapter',
        module: 'studio',
        tab: 7,
        chapter_id: row.chapter_id,
        label: `重写「${row.chapter_title || '未命名章节'}」`,
        detail: reasons.join('；'),
        status: 'pending',
      });
    });
  return tasks;
}

function summarize(mode, findings) {
  if (!findings.length) {
    return mode === 'full'
      ? '全面检测未发现章节顺序、字数、大纲或前后章关联问题'
      : '粗略检测未发现章节顺序或字数问题';
  }
  const errors = findings.filter((row) => row.severity === 'error').length;
  const warnings = findings.filter((row) => row.severity === 'warning').length;
  const label = mode === 'full' ? '全面检测' : '粗略检测';
  return `${label}发现 ${findings.length} 个问题（错误 ${errors}，警告 ${warnings}）`;
}

function inspectNovel({ setting, bodies, mode }) {
  const selected = mode === 'full' ? 'full' : 'rough';
  const chapters = listChapters(setting);
  const nodes = flattenOutline(setting?.outline?.volumes || []);
  const bodyById = new Map((bodies || []).map((row) => [String(row.chapter_id), row]));
  const floor = wordFloor(setting, chapters.length);
  let findings = [];
  if (!chapters.length) {
    findings.push(finding({
      id: 'f_order_chaos_empty',
      code: 'order_chaos',
      severity: 'error',
      message: '还没有章节目录',
      detail: '无法检查顺序和字数。请先在章节目录添加章节。',
    }));
  } else {
    findings = findings.concat(inspectOrder(chapters));
    findings = findings.concat(inspectWords(chapters, bodyById, floor));
    if (selected === 'full') {
      findings = findings.concat(inspectOutlineSequence(chapters, nodes));
      findings = findings.concat(inspectContent(
        chapters,
        nodes,
        bodyById,
        setting?.characters || [],
      ));
    }
  }
  const tasks = buildTasks(findings);
  return {
    mode: selected,
    word_floor: chapters.length ? floor : 0,
    findings,
    tasks,
    summary: summarize(selected, findings),
    issue_count: findings.length,
  };
}

function normalizeChapterOrder(chapters, volumes) {
  const list = (Array.isArray(chapters) ? chapters : []).map((ch, index) => ({ ch, index }));
  const numbered = list.filter((item) => parseChapterNo(item.ch?.title) != null);
  const nodes = flattenOutline(volumes);
  const useNumber = list.length > 0 && numbered.length >= Math.ceil(list.length * 0.6);
  list.sort((a, b) => {
    if (useNumber) {
      const left = parseChapterNo(a.ch?.title);
      const right = parseChapterNo(b.ch?.title);
      if (left != null && right != null && left !== right) return left - right;
      if (left != null && right == null) return -1;
      if (left == null && right != null) return 1;
    } else if (nodes.length) {
      const left = resolveOutline(nodes, a.ch?.outline_ref);
      const right = resolveOutline(nodes, b.ch?.outline_ref);
      const li = left ? left.index : Number.MAX_SAFE_INTEGER;
      const ri = right ? right.index : Number.MAX_SAFE_INTEGER;
      if (li !== ri) return li - ri;
    }
    return (Number(a.ch?.order) || a.index + 1) - (Number(b.ch?.order) || b.index + 1) || a.index - b.index;
  });
  return list.map((item, index) => ({ ...item.ch, order: index + 1 }));
}

function relinkOutline(chapters, volumes) {
  const nodes = flattenOutline(volumes);
  return (Array.isArray(chapters) ? chapters : []).map((ch) => {
    if (resolveOutline(nodes, ch?.outline_ref)) return ch;
    let best = null;
    let bestScore = 0;
    const chapterTokens = titleTokens(ch?.title);
    for (const node of nodes) {
      const nodeTokens = titleTokens(node.title);
      const score = chapterTokens.filter((token) => nodeTokens.includes(token)).length;
      if (score > bestScore) {
        bestScore = score;
        best = node;
      }
    }
    if (!best || bestScore < 1) return ch;
    return { ...ch, outline_ref: best.id || best.title };
  });
}

module.exports = {
  inspectNovel,
  normalizeChapterOrder,
  relinkOutline,
  parseChapterNo,
  wordFloor,
  outlineWordTarget,
};
