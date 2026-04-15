'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  GRAPH_CURRENT_FILE,
  GRAPH_DB_FILE,
  GRAPH_GENERATIONS_SUBDIR,
  GRAPH_LAST_KNOWN_GOOD_FILE,
  resolveGraphDb,
  resolveGraphDir,
} = require('../artifact-paths');

function resolveGenerationsDir(repoRoot) {
  return path.join(resolveGraphDir(repoRoot), GRAPH_GENERATIONS_SUBDIR);
}

function resolveGenerationDir(repoRoot, generationId) {
  return path.join(resolveGenerationsDir(repoRoot), generationId);
}

function resolveGenerationDb(repoRoot, generationId) {
  return path.join(resolveGenerationDir(repoRoot, generationId), GRAPH_DB_FILE);
}

function resolveGraphPointerPath(repoRoot, pointerName) {
  return path.join(resolveGraphDir(repoRoot), pointerName);
}

function readGraphPointer(repoRoot, pointerName) {
  const pointerPath = resolveGraphPointerPath(repoRoot, pointerName);
  if (!fs.existsSync(pointerPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(pointerPath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function writeGraphPointer(repoRoot, pointerName, payload) {
  fs.mkdirSync(resolveGraphDir(repoRoot), { recursive: true });
  fs.writeFileSync(
    resolveGraphPointerPath(repoRoot, pointerName),
    JSON.stringify(payload, null, 2)
  );
}

function buildGenerationId(now = new Date()) {
  return now.toISOString().replace(/[-:.TZ]/g, '');
}

function resolvePointerDbPath(repoRoot, pointerPayload) {
  if (!pointerPayload || typeof pointerPayload.db_path !== 'string') return null;
  return path.isAbsolute(pointerPayload.db_path)
    ? pointerPayload.db_path
    : path.join(repoRoot, pointerPayload.db_path);
}

function resolveActiveGraphDb(repoRoot) {
  const current = readGraphPointer(repoRoot, GRAPH_CURRENT_FILE);
  const currentDb = resolvePointerDbPath(repoRoot, current);
  if (currentDb && fs.existsSync(currentDb)) return currentDb;

  const lastKnownGood = readGraphPointer(repoRoot, GRAPH_LAST_KNOWN_GOOD_FILE);
  const lastKnownGoodDb = resolvePointerDbPath(repoRoot, lastKnownGood);
  if (lastKnownGoodDb && fs.existsSync(lastKnownGoodDb)) return lastKnownGoodDb;

  return resolveGraphDb(repoRoot);
}

module.exports = {
  buildGenerationId,
  readGraphPointer,
  resolveActiveGraphDb,
  resolveGenerationDb,
  resolveGenerationDir,
  resolveGenerationsDir,
  resolveGraphPointerPath,
  writeGraphPointer,
};
