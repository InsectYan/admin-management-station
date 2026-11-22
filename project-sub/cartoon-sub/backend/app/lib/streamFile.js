'use strict';

const fs = require('fs');
const path = require('path');

function streamFile(ctx, absolute) {
  const stat = fs.statSync(absolute);
  const ext = path.extname(absolute).toLowerCase();
  const type = { '.mp4': 'mp4', '.webm': 'webm', '.mov': 'mp4', '.mkv': 'mp4' }[ext] || 'mp4';
  ctx.set('Accept-Ranges', 'bytes');
  ctx.type = type;
  const range = ctx.get('range');
  if (!range) {
    ctx.set('Content-Length', String(stat.size));
    ctx.body = fs.createReadStream(absolute);
    return;
  }
  const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
  const unsatisfied = () => {
    ctx.status = 416;
    ctx.set('Content-Range', `bytes */${stat.size}`);
    ctx.body = '';
  };
  if (!match || stat.size <= 0) {
    unsatisfied();
    return;
  }
  let start;
  let end;
  if (match[1] === '' && match[2] !== '') {
    const suffix = Number(match[2]);
    start = Math.max(0, stat.size - suffix);
    end = stat.size - 1;
  } else {
    start = match[1] === '' ? 0 : Number(match[1]);
    end = match[2] === '' ? stat.size - 1 : Number(match[2]);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= stat.size) {
    unsatisfied();
    return;
  }
  end = Math.min(end, stat.size - 1);
  ctx.status = 206;
  ctx.set('Content-Range', `bytes ${start}-${end}/${stat.size}`);
  ctx.set('Content-Length', String(end - start + 1));
  ctx.body = fs.createReadStream(absolute, { start, end });
}

module.exports = { streamFile };
