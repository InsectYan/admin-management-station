'use strict';

const VISUAL_STYLES = [
  { value: 'anime-jp', label: '日漫' },
  { value: 'anime-cn', label: '国漫' },
  { value: 'realistic', label: '写实' },
  { value: 'watercolor', label: '水彩' },
  { value: 'impasto', label: '厚涂' },
  { value: 'cyber', label: '赛博朋克' },
  { value: 'flat', label: '扁平' },
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
