'use strict';

const path = require('path');

function outputRoot(app) {
  return path.resolve(app.baseDir, '../data/outputs');
}

function tmpEditRoot(app) {
  return path.resolve(app.baseDir, '../data/tmp/edit');
}

function resolveInside(root, relative) {
  if (!relative) return null;
  const absolute = path.resolve(root, relative);
  const fromRoot = path.relative(root, absolute);
  if (fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) return null;
  return absolute;
}

module.exports = { outputRoot, tmpEditRoot, resolveInside };
