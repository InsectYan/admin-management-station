'use strict';

function uniquePrompt(text) {
  const value = String(text || '').replace(/\n*【后期与对白备注】[\s\S]*$/u, '').trim();
  const marker = '【风格】';
  const second = value.indexOf(marker, marker.length);
  if (second > 0) {
    const left = value.slice(0, second).trim();
    const right = value.slice(second).trim();
    if (left && left === right) return left;
  }
  return value;
}

module.exports = { uniquePrompt };
