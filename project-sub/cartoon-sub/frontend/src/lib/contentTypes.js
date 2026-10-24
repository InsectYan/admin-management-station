export const CONTENT_TYPES = [
  { id: 'ai_comic', label: '漫剧', bind: 'required', panel: false },
  { id: 'ai_short', label: '短剧', bind: 'required', panel: true },
  { id: 'ai_science', label: '科普', bind: 'local', panel: false },
  { id: 'ai_commerce', label: '电商', bind: 'local', panel: true },
  { id: 'ai_brand', label: '品牌', bind: 'local', panel: true },
  { id: 'ai_documentary', label: '纪录片', bind: 'required', panel: true },
  { id: 'ai_music', label: '音乐 MV', bind: 'optional', panel: true },
  { id: 'ai_children', label: '儿童', bind: 'required', panel: true },
  { id: 'ai_language', label: '语言学习', bind: 'required', panel: true },
  { id: 'ai_news', label: '新闻', bind: 'local', panel: true },
  { id: 'ai_travel', label: '旅游', bind: 'local', panel: true },
  { id: 'ai_fitness', label: '健身', bind: 'local', panel: true },
  { id: 'ai_sleep', label: '助眠', bind: 'local', panel: true },
  { id: 'ai_game', label: '游戏二创', bind: 'required', panel: true },
];

export function typeOf(value) {
  return CONTENT_TYPES.find(item => item.id === value) || null;
}

export function isLocalType(value) {
  return typeOf(value)?.bind === 'local';
}

export function isOptionalType(value) {
  return typeOf(value)?.bind === 'optional';
}

export function hasPanel(value) {
  return Boolean(typeOf(value)?.panel);
}

export function typeLabel(value) {
  return typeOf(value)?.label || '漫剧';
}
