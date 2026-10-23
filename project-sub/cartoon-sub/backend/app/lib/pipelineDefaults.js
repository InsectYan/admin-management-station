'use strict';

const CONTENT_TYPES = [ 'ai_comic', 'ai_short', 'ai_science', 'ai_commerce' ];
const MODEL_PROFILES = [ 'ollama-qwen', 'comfy-local' ];

const FIXED = [
  { node_key: 'input', title: '输入', runner: 'local', skill_name: '', enabled: true, locked: true },
  { node_key: 'script', title: '脚本', runner: 'skill', skill_name: 'cartoon-script-skill', enabled: true, locked: false },
  { node_key: 'storyboard', title: '分镜', runner: 'skill', skill_name: 'cartoon-storyboard-skill', enabled: true, locked: false },
  { node_key: 'assets', title: '资产匹配', runner: 'local', skill_name: '', enabled: false, locked: false },
  { node_key: 'prompt', title: '提示词', runner: 'skill', skill_name: 'cartoon-prompt-skill', enabled: true, locked: false },
  { node_key: 'generate', title: '图生视频', runner: 'comfy', skill_name: '', enabled: true, locked: false },
  { node_key: 'voice', title: '配音', runner: 'local', skill_name: '', enabled: false, locked: false },
  { node_key: 'subtitle', title: '字幕', runner: 'local', skill_name: '', enabled: false, locked: false },
  { node_key: 'compose', title: '剪辑', runner: 'ffmpeg', skill_name: '', enabled: true, locked: false },
  { node_key: 'review', title: 'AI 初审', runner: 'local', skill_name: '', enabled: false, locked: false },
  { node_key: 'confirm', title: '人工确认', runner: 'local', skill_name: '', enabled: true, locked: true },
  { node_key: 'export', title: '导出', runner: 'ffmpeg', skill_name: '', enabled: true, locked: true },
];

const CUSTOM = {
  ai_comic: [
    { node_key: 'chapter_parse', title: '章节解析' },
    { node_key: 'character_lock', title: '角色一致性' },
    { node_key: 'episode_assets', title: '集数资产继承' },
    { node_key: 'style_lock', title: '画风锁定' },
    { node_key: 'batch_episodes', title: '多集批量' },
  ],
  ai_science: [
    { node_key: 'knowledge', title: '知识点' },
    { node_key: 'chart', title: '图表' },
    { node_key: 'terms', title: '术语' },
    { node_key: 'density', title: '信息密度' },
  ],
  ai_short: [
    { node_key: 'conflict', title: '冲突点' },
    { node_key: 'twist', title: '反转' },
    { node_key: 'rhythm', title: '情绪节奏' },
    { node_key: 'branch', title: '互动分支' },
  ],
  ai_commerce: [
    { node_key: 'product_check', title: '商品素材校验' },
    { node_key: 'selling_point', title: '卖点' },
    { node_key: 'demo_shot', title: '演示镜头' },
    { node_key: 'platform_spec', title: '多平台规格' },
  ],
};

const AGENT_SPECS = [
  { role: 'writer', label: '编剧', skill_name: 'cartoon-script-skill', local: false, needs_model: true },
  { role: 'storyboard', label: '分镜', skill_name: 'cartoon-storyboard-skill', local: false, needs_model: true },
  { role: 'asset', label: '资产', skill_name: '', local: false, needs_model: true },
  { role: 'video', label: '视频生成', skill_name: '', local: true, needs_model: true },
  { role: 'voice', label: '配音', skill_name: '', local: false, needs_model: true },
  { role: 'edit', label: '剪辑', skill_name: '', local: true, needs_model: false },
  { role: 'review', label: '审核', skill_name: '', local: false, needs_model: true },
];

function assertContentType(contentType) {
  if (!CONTENT_TYPES.includes(contentType)) {
    const err = new Error('这个内容类型还没开放');
    err.status = 400;
    throw err;
  }
}

function defaultNodes(contentType) {
  assertContentType(contentType);
  return FIXED.map(item => {
    const node = { ...item, kind: 'fixed', removable: false };
    if ((contentType === 'ai_science' || contentType === 'ai_commerce') && item.node_key === 'script') {
      node.runner = 'local';
      node.skill_name = '';
    }
    if (contentType === 'ai_science' && item.node_key === 'prompt') node.enabled = false;
    if (contentType === 'ai_science' && item.node_key === 'storyboard') node.enabled = false;
    if (contentType === 'ai_commerce' && item.node_key === 'prompt') node.enabled = false;
    return node;
  });
}

function customCatalog(contentType) {
  assertContentType(contentType);
  return (CUSTOM[contentType] || []).map(item => ({ ...item }));
}

function defaultAgents(contentType) {
  assertContentType(contentType);
  const science = contentType === 'ai_science' || contentType === 'ai_commerce';
  return AGENT_SPECS.map(spec => {
    const writer = spec.role === 'writer';
    const storyboard = spec.role === 'storyboard';
    const video = spec.role === 'video';
    const edit = spec.role === 'edit';
    const ready = !science && (writer || storyboard);
    return {
      role: spec.role,
      label: spec.label,
      skill_name: spec.skill_name,
      local: spec.local,
      needs_model: spec.needs_model,
      writes_package: false,
      input_text: writer ? (science ? '本地文案' : '已钉扎的故事包章节') : (storyboard ? '生产剧本' : ''),
      output_text: writer || storyboard ? '生产稿，不写故事包' : (video ? '镜头画面' : (edit ? '成片' : '')),
      model_profile: ready ? 'ollama-qwen' : (video ? 'comfy-local' : ''),
      rule_text: '',
      retry_count: 1,
      human_confirm: writer || storyboard,
      enabled: ready || video || edit,
    };
  });
}

function agentSpec(role) {
  return AGENT_SPECS.find(item => item.role === role) || null;
}

function agentError(spec, draft) {
  if (draft.model_profile && !MODEL_PROFILES.includes(draft.model_profile)) return '模型档位不存在';
  if (!Number.isInteger(draft.retry_count) || draft.retry_count < 0 || draft.retry_count > 5) {
    return '重试次数需要在 0 到 5 之间';
  }
  if (!draft.enabled) return null;
  if (!spec.skill_name && !spec.local) return '这个角色还没有对应的 Skill';
  if (!String(draft.input_text || '').trim() || !String(draft.output_text || '').trim()) return '配置不完整，不能启用';
  if (spec.needs_model && !draft.model_profile) return '配置不完整，不能启用';
  return null;
}

function present(contentType, savedNodes, savedAgents) {
  const fixed = defaultNodes(contentType);
  const savedNodeMap = new Map(savedNodes.map(item => [ item.node_key, item ]));
  const spine = fixed.map(node => {
    const saved = savedNodeMap.get(node.node_key);
    return {
      ...node,
      enabled: node.locked ? true : (saved ? Boolean(saved.enabled) : node.enabled),
    };
  });
  const catalog = customCatalog(contentType);
  const catalogMap = new Map(catalog.map(item => [ item.node_key, item ]));
  const custom = savedNodes
    .filter(item => item.kind === 'custom' && catalogMap.has(item.node_key))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(item => ({
      node_key: item.node_key,
      title: catalogMap.get(item.node_key).title,
      kind: 'custom',
      runner: 'local',
      skill_name: '',
      removable: true,
      locked: false,
      enabled: Boolean(item.enabled),
    }));
  const confirmAt = spine.findIndex(item => item.node_key === 'confirm');
  const nodes = spine.slice(0, confirmAt).concat(custom, spine.slice(confirmAt));
  const agentMap = new Map(savedAgents.map(item => [ item.role, item ]));
  const agents = defaultAgents(contentType).map(agent => {
    const saved = agentMap.get(agent.role);
    if (!saved) return agent;
    return {
      ...agent,
      input_text: saved.input_text || '',
      output_text: saved.output_text || '',
      model_profile: saved.model_profile || '',
      rule_text: saved.rule_text || '',
      retry_count: saved.retry_count,
      human_confirm: Boolean(saved.human_confirm),
      enabled: Boolean(saved.enabled),
      writes_package: false,
    };
  });
  return {
    content_type: contentType,
    nodes,
    agents,
    custom_catalog: catalog.filter(item => !nodes.some(node => node.node_key === item.node_key)),
    model_profiles: MODEL_PROFILES.slice(),
  };
}

module.exports = {
  MODEL_PROFILES,
  assertContentType,
  defaultNodes,
  customCatalog,
  agentSpec,
  agentError,
  present,
};
