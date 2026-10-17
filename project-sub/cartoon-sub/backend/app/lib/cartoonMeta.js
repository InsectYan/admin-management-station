'use strict';

const VISUAL_STYLES = [
  { value: 'anime-jp', label: '日漫' },
  { value: 'anime-cn', label: '国漫' },
  { value: 'cel', label: '赛璐璐' },
  { value: 'shinkai', label: '新海诚' },
  { value: 'ghibli', label: '吉卜力' },
  { value: 'shoujo', label: '少女漫' },
  { value: 'manga-bw', label: '黑白漫画' },
  { value: 'comic-us', label: '美漫' },
  { value: 'webtoon', label: '韩漫条漫' },
  { value: 'chibi', label: 'Q版' },
  { value: 'motion-comic', label: '动态漫' },
  { value: 'anime-3d', label: '三维动画' },
  { value: 'toon-shader', label: '三渲二' },
  { value: 'pixar', label: '皮克斯' },
  { value: 'realistic', label: '写实' },
  { value: 'semi-real', label: '半写实' },
  { value: 'cinematic', label: '电影感' },
  { value: 'film', label: '复古胶片' },
  { value: 'impasto', label: '厚涂' },
  { value: 'watercolor', label: '水彩' },
  { value: 'oil', label: '油画' },
  { value: 'ink', label: '水墨' },
  { value: 'ink-wuxia', label: '武侠水墨' },
  { value: 'gongbi', label: '工笔' },
  { value: 'guofeng', label: '古风国风' },
  { value: 'neo-guofeng', label: '新国风' },
  { value: 'dunhuang', label: '敦煌' },
  { value: 'ukiyoe', label: '浮世绘' },
  { value: 'xianxia', label: '仙侠' },
  { value: 'illustration', label: '商业插画' },
  { value: 'concept', label: '概念原画' },
  { value: 'picture-book', label: '绘本' },
  { value: 'fairy', label: '童话' },
  { value: 'flat', label: '扁平' },
  { value: 'sketch', label: '素描' },
  { value: 'lineart', label: '线稿' },
  { value: 'pixel', label: '像素' },
  { value: 'clay', label: '黏土' },
  { value: 'papercut', label: '剪纸' },
  { value: 'lowpoly', label: '低多边形' },
  { value: 'cyber', label: '赛博朋克' },
  { value: 'steampunk', label: '蒸汽朋克' },
  { value: 'vaporwave', label: '蒸汽波' },
  { value: 'gothic', label: '哥特' },
  { value: 'dark', label: '暗黑' },
  { value: 'horror', label: '惊悚漫画' },
  { value: 'campus', label: '校园清新' },
];

const SHOT_SIZES = [ '远景', '全景', '中景', '近景', '特写' ];
const CAMERA_MOVES = [ '固定', '推', '拉', '摇', '跟', '升', '降' ];

function assertEnum(value, options, label) {
  const text = String(value || '').trim();
  if (!text) return '';
  const allowed = options.map(item => (typeof item === 'string' ? item : item.value));
  if (!allowed.includes(text)) {
    const err = new Error(`${label}不在可选范围内`);
    err.status = 400;
    throw err;
  }
  return text;
}

module.exports = {
  VISUAL_STYLES,
  SHOT_SIZES,
  CAMERA_MOVES,
  assertEnum,
  meta() {
    return { visual_styles: VISUAL_STYLES, shot_sizes: SHOT_SIZES, camera_moves: CAMERA_MOVES };
  },
};
