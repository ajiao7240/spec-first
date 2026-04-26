'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EXTENSIONS = ['', '.ts', '.tsx', '.d.ts', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

function stripJsonComments(text) {
  return String(text || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function readJsonc(filePath) {
  try {
    return JSON.parse(stripJsonComments(fs.readFileSync(filePath, 'utf8')));
  } catch (_) {
    return null;
  }
}

function findConfig(repoRoot, sourceFile) {
  const sourceDir = path.dirname(path.join(repoRoot, sourceFile));
  let current = sourceDir;
  const root = path.resolve(repoRoot);
  while (current.startsWith(root)) {
    for (const name of ['tsconfig.json', 'tsconfig.app.json']) {
      const candidate = path.join(current, name);
      if (fs.existsSync(candidate)) return candidate;
    }
    if (current === root) break;
    current = path.dirname(current);
  }
  return null;
}

function mergeConfig(parent, child) {
  return {
    ...parent,
    ...child,
    compilerOptions: {
      ...(parent.compilerOptions || {}),
      ...(child.compilerOptions || {}),
      paths: {
        ...((parent.compilerOptions && parent.compilerOptions.paths) || {}),
        ...((child.compilerOptions && child.compilerOptions.paths) || {}),
      },
    },
  };
}

function loadConfig(configPath, seen = new Set()) {
  if (!configPath || seen.has(configPath)) return null;
  seen.add(configPath);
  const own = readJsonc(configPath);
  if (!own) return null;
  if (!own.extends || typeof own.extends !== 'string') return { config: own, configPath };

  const parentPath = own.extends.startsWith('.')
    ? path.resolve(path.dirname(configPath), own.extends.endsWith('.json') ? own.extends : `${own.extends}.json`)
    : null;
  const parent = parentPath ? loadConfig(parentPath, seen) : null;
  return {
    config: parent ? mergeConfig(parent.config, own) : own,
    configPath,
  };
}

function normalizeRepoPath(repoRoot, absPath) {
  return path.relative(repoRoot, absPath).replace(/\\/g, '/');
}

function makeCandidates(repoRoot, baseAbsPath) {
  const normalized = normalizeRepoPath(repoRoot, baseAbsPath);
  return EXTENSIONS.map((suffix) => `${normalized}${suffix}`);
}

function moduleIdForCandidate(db, candidates) {
  const stmt = db.prepare("SELECT id, file_path FROM nodes WHERE file_path = ? AND kind = 'module' LIMIT 1");
  for (const candidate of candidates) {
    const row = stmt.get(candidate);
    if (row) return row;
  }
  return null;
}

function pathPatternToRegex(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '(.+)');
  return new RegExp(`^${escaped}$`);
}

function expandPathTarget(targetPattern, wildcardValue) {
  return targetPattern.replace(/\*/g, wildcardValue || '');
}

function resolveTsconfigImport(db, { repoRoot, sourceFile, specifier } = {}) {
  if (!repoRoot || !sourceFile || !specifier) return null;
  if (specifier.startsWith('.') || specifier.startsWith('/') || /^[A-Za-z]:/.test(specifier)) return null;

  const configPath = findConfig(repoRoot, sourceFile);
  if (!configPath) return null;
  const loaded = loadConfig(configPath);
  if (!loaded || !loaded.config) {
    return {
      target_id: null,
      evidence: [`tsconfig parse failed: ${normalizeRepoPath(repoRoot, configPath)}`],
    };
  }

  const compilerOptions = loaded.config.compilerOptions || {};
  const baseUrl = compilerOptions.baseUrl || '.';
  const baseAbs = path.resolve(path.dirname(configPath), baseUrl);
  const paths = compilerOptions.paths && typeof compilerOptions.paths === 'object'
    ? compilerOptions.paths
    : {};
  const evidence = [`tsconfig: ${normalizeRepoPath(repoRoot, configPath)}`];

  for (const [pattern, targets] of Object.entries(paths)) {
    const regex = pathPatternToRegex(pattern);
    const match = specifier.match(regex);
    if (!match) continue;
    const wildcard = match[1] || '';
    for (const targetPattern of Array.isArray(targets) ? targets : [targets]) {
      if (typeof targetPattern !== 'string') continue;
      const expanded = expandPathTarget(targetPattern, wildcard);
      const row = moduleIdForCandidate(db, makeCandidates(repoRoot, path.resolve(baseAbs, expanded)));
      if (row) {
        return {
          target_id: row.id,
          resolution_method: 'tsconfig_paths',
          inference_reason: 'tsconfig_path_alias',
          evidence: [...evidence, `paths ${pattern} -> ${expanded} matched ${row.file_path}`],
        };
      }
    }
  }

  const baseUrlRow = moduleIdForCandidate(db, makeCandidates(repoRoot, path.resolve(baseAbs, specifier)));
  if (baseUrlRow) {
    return {
      target_id: baseUrlRow.id,
      resolution_method: 'tsconfig_base_url',
      inference_reason: 'tsconfig_base_url',
      evidence: [...evidence, `baseUrl matched ${baseUrlRow.file_path}`],
    };
  }

  return {
    target_id: null,
    evidence: [...evidence, `specifier unresolved by tsconfig: ${specifier}`],
  };
}

module.exports = {
  findConfig,
  loadConfig,
  resolveTsconfigImport,
  stripJsonComments,
};
