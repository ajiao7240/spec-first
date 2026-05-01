'use strict';

const path = require('node:path');

function toPosixPath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function repoRelative(repoRoot, filePath) {
  return toPosixPath(path.relative(repoRoot, filePath));
}

function resolveTarget(rootPath, maybeRelativePath) {
  if (!maybeRelativePath) return rootPath;
  return path.resolve(rootPath, maybeRelativePath);
}

function isInside(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function sortByPath(left, right) {
  return String(left).localeCompare(String(right));
}

module.exports = {
  isInside,
  repoRelative,
  resolveTarget,
  sortByPath,
  toPosixPath,
};
