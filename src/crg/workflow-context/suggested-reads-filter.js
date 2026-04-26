'use strict';

const path = require('node:path');

const DENY_SEGMENTS = new Set([
  '.spec-first',
  '.claude',
  '.codex',
  '.agents',
]);

const SENSITIVE_BASENAME = /(^\.env(?:\.|$)|credential|credentials|secret|private[-_]?key|id_rsa|id_dsa|id_ed25519)/i;
const GENERATED_SEGMENT = /(^|\/)(node_modules|dist|build|coverage|vendor|\.git)(\/|$)/;
const STAGE0_SEGMENT = /(^|\/)(docs\/contexts|minimal-context)(\/|$)|(^|\/)injection-index\.yaml$/;

function normalizeRepoPath(filePath) {
  return String(filePath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

function isDeniedSuggestedRead(filePath) {
  const normalized = normalizeRepoPath(filePath);
  if (!normalized) return true;
  if (path.isAbsolute(filePath)) return true;
  if (normalized.split('/').some((segment) => DENY_SEGMENTS.has(segment))) return true;
  if (SENSITIVE_BASENAME.test(path.basename(normalized))) return true;
  if (GENERATED_SEGMENT.test(normalized)) return true;
  if (STAGE0_SEGMENT.test(normalized)) return true;
  return false;
}

function filterSuggestedReads(paths) {
  const kept = [];
  const denied = [];
  for (const candidate of Array.isArray(paths) ? paths : []) {
    const normalized = normalizeRepoPath(candidate);
    if (isDeniedSuggestedRead(normalized)) {
      denied.push(normalized);
    } else if (!kept.includes(normalized)) {
      kept.push(normalized);
    }
  }
  return { kept, denied };
}

module.exports = {
  filterSuggestedReads,
  isDeniedSuggestedRead,
  normalizeRepoPath,
};
