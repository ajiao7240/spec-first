'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  GRAPH_WORK_RUNS_SUBDIR,
  resolveGraphDir,
} = require('./artifact-paths');

function resolveWorkRunsDir(repoRoot) {
  return path.join(resolveGraphDir(repoRoot), GRAPH_WORK_RUNS_SUBDIR);
}

function resolveWorkRunPath(repoRoot, runId) {
  return path.join(resolveWorkRunsDir(repoRoot), `${runId}.json`);
}

function buildWorkRunId(now = new Date()) {
  return `work-${now.toISOString().replace(/[-:.TZ]/g, '')}`;
}

function writeWorkRun(repoRoot, payload) {
  const runId = payload.run_id || buildWorkRunId();
  const body = {
    schema_version: 'crg-work-run/v1',
    run_id: runId,
    generated_at: new Date().toISOString(),
    ...payload,
  };
  fs.mkdirSync(resolveWorkRunsDir(repoRoot), { recursive: true });
  fs.writeFileSync(resolveWorkRunPath(repoRoot, runId), JSON.stringify(body, null, 2));
  return body;
}

function readWorkRun(repoRoot, runId) {
  if (!runId) return null;
  const filePath = resolveWorkRunPath(repoRoot, runId);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

module.exports = {
  buildWorkRunId,
  readWorkRun,
  resolveWorkRunPath,
  resolveWorkRunsDir,
  writeWorkRun,
};
