'use strict';

function normalize(text) {
  return String(text ?? '').replace(/\r\n/g, '\n');
}

function lineDiff(before, after) {
  const left = normalize(before).split('\n');
  const right = normalize(after).split('\n');
  if (left.join('\n') === right.join('\n')) return [];
  const n = left.length;
  const m = right.length;
  if (n * m > 40000) {
    return [
      ...left.slice(0, 40).map((text) => ({ op: 'remove', text })),
      ...right.slice(0, 40).map((text) => ({ op: 'add', text })),
    ];
  }
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = left[i] === right[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ op: 'remove', text: left[i] });
      i += 1;
    } else {
      out.push({ op: 'add', text: right[j] });
      j += 1;
    }
  }
  while (i < n) {
    out.push({ op: 'remove', text: left[i] });
    i += 1;
  }
  while (j < m) {
    out.push({ op: 'add', text: right[j] });
    j += 1;
  }
  return out.slice(0, 240);
}

function fieldDiff(field, before, after) {
  const lines = lineDiff(before, after);
  return lines.map((line) => ({ ...line, field }));
}

module.exports = { lineDiff, fieldDiff };
