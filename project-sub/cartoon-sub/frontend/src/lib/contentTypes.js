export function isLocalType(value) {
  return value === 'ai_science' || value === 'ai_commerce';
}

export function typeLabel(value) {
  return {
    ai_comic: '漫剧',
    ai_short: '短剧',
    ai_science: '科普',
    ai_commerce: '电商',
  }[value] || '漫剧';
}
