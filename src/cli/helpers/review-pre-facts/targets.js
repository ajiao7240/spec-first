'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { LIMITS, IMPACT_DIRECTIONS } = require('./constants');
const {
  isInsidePath,
  pathHasSymlink,
  safeLstat,
  safeRealpath,
  safeStat,
} = require('./io');
const { normalizeNonEmptyString } = require('./budget');

function extractTargets(options) {
  const explicitTargets = [];
  if (options.symbolFile) explicitTargets.push(options.symbolFile);
  if (options.impactTarget && looksLikePath(options.impactTarget)) explicitTargets.push(options.impactTarget);
  if (options.workflow === 'code-review') {
    return [...explicitTargets, ...parsePathList(options.changedFiles || '')];
  }
  if (!options.document) return explicitTargets;
  const documentFile = resolveReadableRepoFile(options.repoRoot, options.document, {
    maxBytes: LIMITS.maxDocumentBytes,
  });
  if (!documentFile.ok) return explicitTargets;
  const content = fs.readFileSync(documentFile.real, 'utf8');
  return [...explicitTargets, ...extractTargetsFromDocument(content)];
}

function extractTargetsFromDocument(content) {
  const targets = [];
  const add = (value) => {
    for (const item of parsePathList(value)) {
      targets.push(item);
    }
  };
  const backtickRegex = /`([^`]+)`/g;
  let match;
  while ((match = backtickRegex.exec(content)) !== null) {
    if (looksLikePath(match[1])) add(match[1]);
  }
  const lineRegex = /(?:Sources? & References|Context & Research|Context & Evidence|Patterns to follow|Files?|文件|上下文与依据|上下文与研究|来源与参考|参考资料|Patterns to follow：|文件：)[^:\n：]*[:：]\s*(.+)$/gim;
  while ((match = lineRegex.exec(content)) !== null) {
    add(match[1]);
  }
  for (const symbolTarget of parseSymbolTargetsFromDocument(content)) {
    if (symbolTarget.file_path) add(symbolTarget.file_path);
  }
  const unique = [];
  const seen = new Set();
  for (const target of targets) {
    if (seen.has(target)) continue;
    seen.add(target);
    unique.push(target);
  }
  return unique;
}

function parsePathList(value) {
  return String(value)
    .split(/[,，\n]/)
    .map((entry) => entry
      .trim()
      .replace(/^[-*]\s*/, '')
      .replace(/^(Create|Modify|Test|Read|Pattern|Patterns)\s*:\s*/i, '')
      .replace(/^["'`]+|["'`]+$/g, '')
      .trim())
    .filter((entry) => entry && looksLikePath(entry));
}

function looksLikePath(value) {
  if (!value || /^https?:\/\//i.test(value)) return false;
  if (/\s/.test(value) && !value.includes('/')) return false;
  return /[/.]/.test(value) && /\.(md|mdx|js|json|sh|ps1|ts|tsx|jsx|yml|yaml|cjs|mjs|txt)$/.test(value);
}

function resolveTargets(repoRoot, rawTargets) {
  const seen = new Set();
  const resolved = [];
  for (const original of rawTargets) {
    const normalized = normalizeTargetPath(original);
    if (!normalized.ok) {
      resolved.push({ original, status: 'omitted', reason_code: normalized.reason_code });
      continue;
    }
    if (seen.has(normalized.path)) continue;
    seen.add(normalized.path);
    const file = resolveReadableRepoFile(repoRoot, normalized.path, {
      maxBytes: LIMITS.maxDirectReadBytes,
    });
    if (!file.ok) {
      resolved.push({ original, path: normalized.path, status: 'omitted', reason_code: file.reason_code });
      continue;
    }
    resolved.push({ original, path: normalized.path, absolute: file.absolute, real: file.real, status: 'readable' });
  }
  return orderTargets(resolved);
}

function resolveReadableRepoFile(repoRoot, rawPath, options = {}) {
  const normalized = normalizeTargetPath(rawPath);
  if (!normalized.ok) return { ok: false, reason_code: normalized.reason_code };

  const repoReal = safeRealpath(repoRoot) || path.resolve(repoRoot);
  const absolute = path.resolve(repoRoot, normalized.path);
  const lstat = safeLstat(absolute);
  if (!lstat) {
    return { ok: false, path: normalized.path, reason_code: 'target_not_readable' };
  }

  const real = safeRealpath(absolute);
  if (!real || (!isInsidePath(repoReal, real) && real !== repoReal)) {
    return {
      ok: false,
      path: normalized.path,
      reason_code: pathHasSymlink(repoRoot, normalized.path) ? 'target_symlink_escape' : 'target_outside_repo',
    };
  }

  if (!lstat.isFile()) {
    return { ok: false, path: normalized.path, reason_code: 'target_not_readable' };
  }

  try {
    fs.accessSync(real, fs.constants.R_OK);
  } catch (_error) {
    return { ok: false, path: normalized.path, reason_code: 'target_not_readable' };
  }

  const stat = safeStat(real);
  if (!stat || !stat.isFile()) {
    return { ok: false, path: normalized.path, reason_code: 'target_not_readable' };
  }
  if (options.maxBytes && stat.size > options.maxBytes) {
    return { ok: false, path: normalized.path, reason_code: 'target_too_large' };
  }

  return { ok: true, path: normalized.path, absolute, real, size: stat.size };
}

function normalizeTargetPath(value) {
  const cleaned = String(value).trim().replace(/^["'`]+|["'`]+$/g, '');
  if (!cleaned || path.isAbsolute(cleaned) || /^[A-Za-z]:[\\/]/.test(cleaned)) {
    return { ok: false, reason_code: 'target_outside_repo' };
  }
  if (cleaned.includes('\\')) {
    return { ok: false, reason_code: 'target_outside_repo' };
  }
  const normalized = path.posix.normalize(cleaned);
  if (normalized === '.' || normalized.startsWith('../') || normalized === '..' || normalized.includes('/../')) {
    return { ok: false, reason_code: 'target_outside_repo' };
  }
  return { ok: true, path: normalized };
}

function orderTargets(targets) {
  const score = (target) => {
    const rel = target.path || target.original || '';
    if (/^(AGENTS|CLAUDE|README|CHANGELOG|package\.json)/.test(rel)) return 0;
    if (/^(src|bin|skills|agents|templates)\//.test(rel)) return 1;
    if (/^docs\/contracts\//.test(rel)) return 2;
    if (/^tests\//.test(rel)) return 3;
    if (/^docs\//.test(rel)) return 4;
    return 5;
  };
  return [...targets].sort((a, b) => score(a) - score(b));
}

function extractSymbolTargets(options) {
  const targets = [];
  if (options.symbol || options.symbolFile || options.symbolKind) {
    targets.push(normalizeSymbolTarget({
      name: options.symbol,
      file_path: options.symbolFile,
      kind: options.symbolKind,
      impact_direction: options.impactDirection,
      source: 'argv',
    }));
  }
  if (options.document) {
    const documentFile = resolveReadableRepoFile(options.repoRoot, options.document, {
      maxBytes: LIMITS.maxDocumentBytes,
    });
    if (documentFile.ok) {
      const content = fs.readFileSync(documentFile.real, 'utf8');
      for (const target of parseSymbolTargetsFromDocument(content)) {
        targets.push(normalizeSymbolTarget(target));
      }
    }
  }
  const unique = [];
  const seen = new Set();
  for (const target of targets.filter(Boolean)) {
    const key = [target.uid || '', target.name || '', target.file_path || '', target.kind || ''].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(target);
  }
  return unique;
}

function parseSymbolTargetsFromDocument(content) {
  const targets = [];
  for (const line of String(content || '').split(/\r?\n/)) {
    if (!/\bsymbol(?:_target)?\b/i.test(line)) continue;
    const uid = keyValueFromLine(line, 'uid');
    const name = keyValueFromLine(line, 'name')
      || (line.match(/\bsymbol(?:_target)?\s*[:：]\s*([A-Za-z_$][\w$.-]*)/i) || [])[1];
    const filePath = keyValueFromLine(line, 'file_path')
      || keyValueFromLine(line, 'file')
      || keyValueFromLine(line, 'path')
      || (line.match(/@\s*([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)\b/) || [])[1];
    const kind = keyValueFromLine(line, 'kind');
    const direction = keyValueFromLine(line, 'direction') || keyValueFromLine(line, 'impact_direction');
    if (uid || name || filePath || kind) {
      targets.push({
        uid,
        name,
        file_path: filePath,
        kind,
        impact_direction: direction,
        source: 'document',
      });
    }
  }
  return targets;
}

function keyValueFromLine(line, key) {
  const pattern = new RegExp(`\\b${key}\\s*=\\s*["'\`]?([^\\s,"\`]+)`, 'i');
  const match = String(line || '').match(pattern);
  return match ? match[1] : undefined;
}

function normalizeSymbolTarget(target) {
  if (!target || typeof target !== 'object') return null;
  const filePath = normalizeMaybeRepoPath(target.file_path);
  const direction = IMPACT_DIRECTIONS.has(target.impact_direction) ? target.impact_direction : undefined;
  return {
    uid: normalizeNonEmptyString(target.uid),
    name: normalizeNonEmptyString(target.name),
    file_path: filePath,
    kind: normalizeNonEmptyString(target.kind),
    impact_direction: direction,
    source: target.source || 'unknown',
  };
}

function hasOperationIntent(options) {
  return Boolean(
    options.changeScope
    || options.symbol
    || options.symbolFile
    || options.symbolKind
    || options.impactTarget
    || extractSymbolTargets(options).length > 0,
  );
}

function normalizeMaybeRepoPath(value) {
  if (!value) return undefined;
  const normalized = normalizeTargetPath(value);
  return normalized.ok ? normalized.path : undefined;
}

module.exports = {
  extractTargets,
  extractTargetsFromDocument,
  parsePathList,
  looksLikePath,
  resolveTargets,
  resolveReadableRepoFile,
  normalizeTargetPath,
  orderTargets,
  extractSymbolTargets,
  parseSymbolTargetsFromDocument,
  normalizeSymbolTarget,
  hasOperationIntent,
  normalizeMaybeRepoPath,
};
