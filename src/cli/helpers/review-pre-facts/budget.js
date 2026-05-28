'use strict';

const fs = require('node:fs');
const { LIMITS, READINESS, TIERS } = require('./constants');

function normalizeReadiness(value, fallback) {
  return READINESS.has(value) ? value : fallback;
}

function normalizeTier(value, fallback) {
  return TIERS.has(value) ? value : fallback;
}

function normalizeNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function coerceLineWindow(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const start = Number(value.start);
  const end = Number(value.end);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    return null;
  }
  return { start, end };
}

function isValidLineWindow(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Number.isInteger(value.start) && Number.isInteger(value.end) && value.start >= 1 && value.end >= value.start;
}

function truncateExcerpt(value) {
  const text = String(value);
  const limit = LIMITS.perExcerptChars;
  if (text.length <= limit) return text;
  const marker = `\n[truncated: excerpt exceeded ${limit} chars]`;
  return `${text.slice(0, Math.max(0, limit - marker.length))}${marker}`;
}

function directReadFact(repoRoot, target, readiness) {
  const content = fs.readFileSync(target.real, 'utf8');
  const selected = selectSnippet(content);
  return {
    provider: 'direct-read',
    target: target.path,
    source_path: target.path,
    line_window: {
      start: selected.start,
      end: selected.end,
    },
    excerpt: truncateExcerpt(selected.excerpt),
    readiness: normalizeReadiness(readiness, 'provider-unavailable'),
    tier: 'bounded-reads',
    reason_code: 'target_aware_direct_read',
    provenance: {
      source: 'bounded-direct-read',
      target_repo: repoRoot,
    },
  };
}

function selectSnippet(content) {
  const lines = content.split(/\r?\n/);
  const indexes = [];
  lines.forEach((line, index) => {
    if (/^(#{1,4}\s|module\.exports|exports\.|class\s|function\s|const\s+\w+\s*=|let\s+\w+\s*=|async function\s)/.test(line.trim())) {
      indexes.push(index);
    }
  });
  const startIndex = indexes.length > 0 ? Math.max(0, indexes[0] - 2) : 0;
  const collected = [];
  let endIndex = startIndex;
  for (let index = startIndex; index < lines.length; index += 1) {
    const numbered = `${index + 1}: ${lines[index]}`;
    if (collected.join('\n').length + numbered.length > LIMITS.perExcerptChars) break;
    collected.push(numbered);
    endIndex = index;
  }
  return {
    start: startIndex + 1,
    end: endIndex + 1,
    excerpt: collected.join('\n'),
  };
}

module.exports = {
  normalizeReadiness,
  normalizeTier,
  normalizeNonEmptyString,
  coerceLineWindow,
  isValidLineWindow,
  truncateExcerpt,
  directReadFact,
};
