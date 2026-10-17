'use strict';

const { spawn } = require('child_process');

function bins(app) {
  const cfg = app.config.mediaTools || {};
  return {
    ffmpeg: cfg.ffmpeg || 'ffmpeg',
    ffprobe: cfg.ffprobe || 'ffprobe',
  };
}

function run(bin, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    const stderrLines = [];
    let stdout = '';
    let settled = false;
    const fail = err => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    child.stdout.on('data', chunk => {
      const text = chunk.toString();
      stdout += text;
      if (opts.onStdout) opts.onStdout(text);
    });
    child.stderr.on('data', chunk => {
      String(chunk).split(/\r?\n/).forEach(line => {
        if (!line) return;
        stderrLines.push(line);
        if (stderrLines.length > 40) stderrLines.shift();
      });
    });
    child.on('error', err => {
      const wrapped = new Error(err.code === 'ENOENT' ? `找不到 ${bin}` : err.message);
      wrapped.status = 500;
      wrapped.code = err.code;
      fail(wrapped);
    });
    child.on('close', code => {
      if (settled) return;
      settled = true;
      if (code === 0) resolve({ stdout, stderr: stderrLines.join('\n') });
      else {
        const err = new Error(`${bin} 退出码 ${code}\n${stderrLines.slice(-8).join('\n')}`.trim());
        err.status = 500;
        err.exitCode = code;
        reject(err);
      }
    });
  });
}

function versionOf(bin) {
  return new Promise(resolve => {
    let text = '';
    let settled = false;
    const finish = ok => {
      if (settled) return;
      settled = true;
      resolve({ ok, version: ok ? text.trim() : '' });
    };
    let child;
    try {
      child = spawn(bin, [ '-version' ], { windowsHide: true });
    } catch {
      finish(false);
      return;
    }
    const take = chunk => {
      if (!text) text = String(chunk).split(/\r?\n/).find(line => line.trim()) || '';
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', () => finish(false));
    child.on('close', code => finish(code === 0));
  });
}

async function inspect(app) {
  const { ffmpeg, ffprobe } = bins(app);
  const [ video, probe ] = await Promise.all([ versionOf(ffmpeg), versionOf(ffprobe) ]);
  return {
    ffmpeg: video.ok,
    ffprobe: probe.ok,
    ffmpeg_version: video.version,
  };
}

function parseProbe(stdout) {
  const data = JSON.parse(stdout || '{}');
  const streams = data.streams || [];
  const video = streams.find(item => item.codec_type === 'video');
  const hasAudio = streams.some(item => item.codec_type === 'audio');
  const raw = video?.duration || data.format?.duration;
  const durationMs = raw ? Math.round(Number(raw) * 1000) : 0;
  if (!durationMs) {
    const err = new Error('读不到时长');
    err.status = 400;
    throw err;
  }
  return {
    durationMs,
    width: video?.width ? Number(video.width) : null,
    height: video?.height ? Number(video.height) : null,
    hasAudio,
  };
}

async function probeFile(app, file) {
  const { ffprobe } = bins(app);
  const { stdout } = await run(ffprobe, [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    file,
  ]);
  return parseProbe(stdout);
}

function parseOutTimeMs(line) {
  const match = /^out_time=(\d+):(\d+):(\d+)[.](\d+)/.exec(line.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const fraction = Number(match[4].padEnd(3, '0').slice(0, 3));
  return ((hours * 3600 + minutes * 60 + seconds) * 1000) + fraction;
}

module.exports = { bins, run, inspect, probeFile, parseOutTimeMs };
