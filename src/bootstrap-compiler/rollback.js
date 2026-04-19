'use strict';

const fs = require('node:fs');
const path = require('node:path');

function countFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let count = 0;

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      count += countFiles(absolutePath);
      continue;
    }
    count += 1;
  }

  return count;
}

function copyDirectory(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function createBootstrapBackup({
  contextDir,
  controlPlaneDir,
  generatedAt = new Date().toISOString(),
} = {}) {
  if (!contextDir || !controlPlaneDir || !fs.existsSync(contextDir)) {
    return null;
  }

  fs.mkdirSync(controlPlaneDir, { recursive: true });
  const backupDir = path.join(
    controlPlaneDir,
    `backup_${generatedAt.replace(/[:.]/g, '-')}`
  );
  copyDirectory(contextDir, backupDir);

  if (countFiles(contextDir) !== countFiles(backupDir)) {
    throw new Error('bootstrap backup validation failed');
  }

  return backupDir;
}

function restoreBootstrapBackup({ backupDir, contextDir } = {}) {
  if (!backupDir || !contextDir || !fs.existsSync(backupDir)) {
    return false;
  }

  try {
    fs.rmSync(contextDir, { recursive: true });
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  copyDirectory(backupDir, contextDir);
  return true;
}

function removeBootstrapBackup(backupDir) {
  if (!backupDir || !fs.existsSync(backupDir)) return false;
  fs.rmSync(backupDir, { recursive: true, force: true });
  return true;
}

function createBatchBackup({ entries = [], backupRoot }) {
  if (!backupRoot) return null;
  fs.mkdirSync(backupRoot, { recursive: true });
  const manifest = [];

  for (const entry of entries) {
    if (!entry || !entry.sourceDir || !entry.key) continue;
    const backupDir = path.join(backupRoot, entry.key);
    const sourceExisted = fs.existsSync(entry.sourceDir);
    if (sourceExisted) {
      copyDirectory(entry.sourceDir, backupDir);
    }
    manifest.push({ key: entry.key, sourceDir: entry.sourceDir, backupDir, sourceExisted });
  }

  return { backupRoot, manifest };
}

function restoreBatchBackup(batchBackup) {
  if (!batchBackup || !Array.isArray(batchBackup.manifest)) return false;
  for (const entry of batchBackup.manifest) {
    try {
      fs.rmSync(entry.sourceDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    if (entry.sourceExisted && fs.existsSync(entry.backupDir)) {
      copyDirectory(entry.backupDir, entry.sourceDir);
    }
  }
  return true;
}

function removeBatchBackup(batchBackup) {
  if (!batchBackup || !batchBackup.backupRoot || !fs.existsSync(batchBackup.backupRoot)) {
    return false;
  }
  fs.rmSync(batchBackup.backupRoot, { recursive: true, force: true });
  return true;
}

module.exports = {
  copyDirectory,
  countFiles,
  createBatchBackup,
  createBootstrapBackup,
  removeBatchBackup,
  removeBootstrapBackup,
  restoreBatchBackup,
  restoreBootstrapBackup,
};
