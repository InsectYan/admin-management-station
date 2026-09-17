'use strict';

const PATTERNS = [
  /Bearer\s+[A-Za-z0-9._\-+=/]+/gi,
  /access_token[=:\s]+[^\s&'"]+/gi,
  /(?<=(?:password|passwd|pwd|secret|token|api[_-]?key)\s*[=:]\s*)\S+/gi,
  /x-access-token:[^@\s]+@/gi,
  /https:\/\/[^/@:\s]+:[^/@\s]+@/gi,
  /ghp_[A-Za-z0-9]+/g,
  /github_pat_[A-Za-z0-9_]+/g,
  /AKIA[0-9A-Z]{16}/g,
  /LTAI[0-9A-Za-z]{12,}/g,
  /AccessKeySecret[=:\s]+\S+/gi,
];

function redactDeployLog(text) {
  let out = String(text == null ? '' : text);
  for (const pattern of PATTERNS) {
    out = out.replace(pattern, '***');
  }
  return out;
}

module.exports = { redactDeployLog };
