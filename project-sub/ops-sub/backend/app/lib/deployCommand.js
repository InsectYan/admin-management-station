'use strict';

const ALLOWED = new Set([ 'git', 'npm', 'pnpm', 'yarn', 'node' ]);
const FORBIDDEN = /(\brm\b|\bcurl\b|\bwget\b|\bchmod\b|\bsudo\b|[;|`]|\$\(|(?<!=)>\s*|<\s*)/i;

function tokenize(command) {
  const tokens = [];
  let current = '';
  let quote = '';
  for (const ch of String(command || '')) {
    if (quote) {
      if (ch === quote) quote = '';
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === '\'') {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (quote) throw new Error('命令引号未闭合');
  if (current) tokens.push(current);
  return tokens;
}

function resolveBin(name) {
  const base = String(name || '').replace(/\\/g, '/').split('/').pop();
  if (process.platform === 'win32' && [ 'npm', 'pnpm', 'yarn' ].includes(base)) {
    return `${base}.cmd`;
  }
  return base;
}

function assertSafeArgv(argv) {
  if (!argv.length) throw new Error('命令为空');
  const bin = resolveBin(argv[0]).replace(/\.cmd$/i, '');
  if (!ALLOWED.has(bin)) {
    throw new Error(`不允许的命令：${bin}（仅 git / npm / pnpm / yarn / node）`);
  }
  const joined = argv.join(' ');
  if (FORBIDDEN.test(joined)) {
    throw new Error('命令含有禁止片段');
  }
  return [ resolveBin(argv[0]), ...argv.slice(1) ];
}

function splitAndParse(command) {
  const raw = String(command || '').trim();
  if (!raw) throw new Error('命令为空');
  if (FORBIDDEN.test(raw) && !/^node\s+-e\b/.test(raw)) {
    const looksShell = /[;|`]|\$\(/.test(raw);
    if (looksShell) throw new Error('命令含有禁止片段');
  }
  return raw.split(/\s*&&\s*/).map(part => assertSafeArgv(tokenize(part)));
}

module.exports = { splitAndParse, assertSafeArgv, tokenize, resolveBin, ALLOWED };
