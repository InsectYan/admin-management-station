'use strict';

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { generateMedia } = require('./agentProxy');

function fail(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function buildCoverPrompt(body) {
  const custom = String(body.prompt || '').trim();
  if (custom) return custom;
  const title = String(body.title || '').trim();
  const intent = String(body.creative_intent || body.summary || '').trim();
  const overview = String(body.story_overview || '').trim().slice(0, 280);
  if (!title) {
    throw fail(400, 'COVER_CONTEXT_REQUIRED', '请先填写书名，或提供自定义提示词');
  }
  return [
    '竖版小说封面插画，电影级光影，无文字、无水印、无字母、无标题。',
    `书名意象：${title}。`,
    intent ? `故事气质：${intent}` : '',
    overview ? `情节氛围（摘自概要）：${overview}` : '',
    '构图适合书店陈列，留出上方书名区，风格统一。',
  ].filter(Boolean).join('');
}

function publicBase(ctx) {
  const fromEnv = (process.env.NOVEL_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const port = process.env.NOVEL_PORT || process.env.PORT || 5201;
  return `http://127.0.0.1:${port}`;
}

async function persistImage(ctx, { b64, url }) {
  const dir = path.join(ctx.app.baseDir, 'app/public/covers');
  await fs.mkdir(dir, { recursive: true });
  const name = `cover-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.png`;
  const filePath = path.join(dir, name);

  if (b64) {
    await fs.writeFile(filePath, Buffer.from(b64, 'base64'));
  } else if (url) {
    const res = await ctx.curl(url, {
      method: 'GET',
      timeout: 60000,
      followRedirect: true,
    });
    if (res.status >= 400 || !res.data) {
      throw fail(502, 'COVER_DOWNLOAD_FAILED', '下载生成图片失败');
    }
    const buf = Buffer.isBuffer(res.data) ? res.data : Buffer.from(res.data);
    await fs.writeFile(filePath, buf);
  } else {
    throw fail(502, 'MEDIA_EMPTY', '未拿到图片数据');
  }

  return `${publicBase(ctx)}/public/covers/${name}`;
}

async function generateCover(ctx, body) {
  const prompt = buildCoverPrompt(body || {});
  const { data } = await generateMedia(ctx, {
    kind: 'image',
    prompt,
    mediaProfile: body.media_profile,
    size: body.size,
  });
  const coverUrl = await persistImage(ctx, {
    b64: data.b64 || data.b64_json,
    url: data.url,
  });
  return {
    cover_url: coverUrl,
    media_profile_id: data.media_profile_id,
    media_label: data.media_label,
    prompt,
  };
}

module.exports = { generateCover, buildCoverPrompt };
