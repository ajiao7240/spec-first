'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  isInsidePath,
  safeLstat,
  safeRealpath,
} = require('./io');

function validateInvocationBoundary(options) {
  if (!options.output && options.mode !== 'normalize-provider-results') {
    return { ok: true };
  }

  if (!options.runId) {
    return { ok: false, reason_code: 'missing_run_id', message: '--run-id is required for temp artifact writes' };
  }
  if (!isValidRunId(options.runId)) {
    return { ok: false, reason_code: 'invalid_run_id', message: '--run-id must be a simple path-safe token' };
  }

  const runRoot = tempRunRoot(options.runId);
  const baseRoot = path.dirname(runRoot);
  const osTempReal = safeRealpath(os.tmpdir());
  const baseAncestor = nearestExistingParent(baseRoot);
  const baseAncestorReal = safeRealpath(baseAncestor);
  if (!osTempReal || !baseAncestorReal || (!isInsidePath(osTempReal, baseAncestorReal) && osTempReal !== baseAncestorReal)) {
    return {
      ok: false,
      reason_code: 'output_temp_symlink_escape',
      message: `temp artifact base must stay under ${os.tmpdir()}`,
    };
  }
  fs.mkdirSync(baseRoot, { recursive: true });
  const baseRootReal = safeRealpath(baseRoot);
  if (!osTempReal || !baseRootReal || (!isInsidePath(osTempReal, baseRootReal) && osTempReal !== baseRootReal)) {
    return {
      ok: false,
      reason_code: 'output_temp_symlink_escape',
      message: `temp artifact base must stay under ${os.tmpdir()}`,
    };
  }
  fs.mkdirSync(runRoot, { recursive: true });
  const runRootReal = safeRealpath(runRoot);
  if (!baseRootReal || !runRootReal || (!isInsidePath(baseRootReal, runRootReal) && baseRootReal !== runRootReal)) {
    return {
      ok: false,
      reason_code: 'output_temp_symlink_escape',
      message: `run root must stay under ${baseRoot}`,
    };
  }
  const tempPaths = [
    ['summary-dir', options.summaryDir],
    ['output', options.output],
    ['query-plan', options.queryPlan],
    ['raw-result', options.rawResult],
    ['provider-results', options.providerResults],
  ].filter((entry) => entry[1]);

  for (const [label, value] of tempPaths) {
    const resolved = path.resolve(value);
    if (!isInsidePath(runRoot, resolved) && resolved !== runRoot) {
      return {
        ok: false,
        reason_code: 'output_outside_temp_run',
        message: `${label} must stay under ${runRoot}`,
      };
    }
    const realBoundary = validateTempRealBoundary({
      label,
      resolved,
      runRoot,
      runRootReal,
      repoRoot: options.repoRoot || process.cwd(),
      isDirectory: label === 'summary-dir',
    });
    if (!realBoundary.ok) {
      return realBoundary;
    }
    if (isRepoDurablePath(options.repoRoot || process.cwd(), resolved) || isRepoDurablePath(options.repoRoot || process.cwd(), realBoundary.real_parent)) {
      return {
        ok: false,
        reason_code: 'output_durable_project_path',
        message: `${label} must not write repo source, generated runtime mirrors, or canonical graph artifacts`,
      };
    }
  }

  return { ok: true };
}

function isValidRunId(runId) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) return false;
  if (runId === '.' || runId === '..' || /^\.+$/.test(runId)) return false;
  const reserved = new Set([
    'con',
    'prn',
    'aux',
    'nul',
    'com1',
    'com2',
    'com3',
    'com4',
    'com5',
    'com6',
    'com7',
    'com8',
    'com9',
    'lpt1',
    'lpt2',
    'lpt3',
    'lpt4',
    'lpt5',
    'lpt6',
    'lpt7',
    'lpt8',
    'lpt9',
  ]);
  const normalized = runId.toLowerCase().replace(/[. ]+$/g, '');
  return normalized.length > 0 && !reserved.has(normalized);
}

function validateTempRealBoundary({ label, resolved, runRoot, runRootReal, repoRoot, isDirectory }) {
  const symlinkPath = existingSymlinkComponent(runRoot, resolved);
  if (symlinkPath) {
    return {
      ok: false,
      reason_code: 'output_temp_symlink_escape',
      message: `${label} must not cross a symlink inside ${runRoot}`,
    };
  }
  const parent = nearestExistingParent(isDirectory ? resolved : path.dirname(resolved));
  const parentReal = safeRealpath(parent);
  if (!parentReal || (!isInsidePath(runRootReal, parentReal) && parentReal !== runRootReal)) {
    return {
      ok: false,
      reason_code: 'output_temp_symlink_escape',
      message: `${label} real parent must stay under ${runRoot}`,
    };
  }
  if (isRepoDurablePath(repoRoot, parentReal)) {
    return {
      ok: false,
      reason_code: 'output_durable_project_path',
      message: `${label} real parent must not be repo source, generated runtime mirrors, or canonical graph artifacts`,
    };
  }
  return { ok: true, real_parent: parentReal };
}

function nearestExistingParent(startPath) {
  let current = path.resolve(startPath);
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return current;
}

function existingSymlinkComponent(rootPath, candidatePath) {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(root, candidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return '';
  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    const lstat = safeLstat(current);
    if (!lstat) return '';
    if (lstat.isSymbolicLink()) return current;
  }
  return '';
}

function isRepoDurablePath(repoRoot, candidate) {
  const repo = path.resolve(repoRoot);
  if (!isInsidePath(repo, candidate) && candidate !== repo) return false;
  const rel = path.relative(repo, candidate).split(path.sep).join('/');
  return rel === ''
    || rel.startsWith('.claude/')
    || rel.startsWith('.codex/')
    || rel.startsWith('.agents/skills/')
    || rel.startsWith('.spec-first/graph/')
    || rel.startsWith('.spec-first/providers/')
    || !rel.startsWith('.spec-first/');
}

function tempRunRoot(runId) {
  return path.join(os.tmpdir(), 'spec-first', 'review-pre-facts', runId);
}

module.exports = {
  validateInvocationBoundary,
  isValidRunId,
  tempRunRoot,
};
