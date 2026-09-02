/** 与 BFF `NovelService.countBodyWords` 同一套：汉字计字 + 其余按空白分词。 */
export function countBodyWords(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return 0;
  const cjk = (trimmed.match(/[\u4e00-\u9fff]/g) || []).length;
  const latin = trimmed
    .replace(/[\u4e00-\u9fff]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk + latin;
}
