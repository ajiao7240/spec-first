'use strict';

const fs = require('node:fs');
const os = require('node:os');
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

function removeDirectoryIfExists(directoryPath) {
  try {
    fs.rmSync(directoryPath, { recursive: true, force: true });
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

function buildBackupEntry(key, sourceDir, backupRoot) {
  const backupDir = path.join(backupRoot, key);
  const sourceExisted = fs.existsSync(sourceDir);
  if (sourceExisted) {
    copyDirectory(sourceDir, backupDir);
  }

  return { key, sourceDir, backupDir, sourceExisted };
}

function createBootstrapBackup({
  contextDir,
  controlPlaneDir,
  generatedAt = new Date().toISOString(),
  backupRoot,
} = {}) {
  if (!contextDir || !controlPlaneDir) {
    return null;
  }

  const contextExists = fs.existsSync(contextDir);
  const controlPlaneExists = fs.existsSync(controlPlaneDir);
  if (!contextExists && !controlPlaneExists) {
    return null;
  }

  const effectiveBackupRoot = backupRoot || fs.mkdtempSync(
    path.join(os.tmpdir(), `spec-first-bootstrap-backup-${generatedAt.replace(/[:.]/g, '-')}-`)
  );
  fs.mkdirSync(effectiveBackupRoot, { recursive: true });

  const manifest = [
    buildBackupEntry('context', contextDir, effectiveBackupRoot),
    buildBackupEntry('control-plane', controlPlaneDir, effectiveBackupRoot),
  ];

  for (const entry of manifest) {
    if (!entry.sourceExisted) continue;
    if (countFiles(entry.sourceDir) !== countFiles(entry.backupDir)) {
      throw new Error('bootstrap backup validation failed');
    }
  }

  return {
    backupRoot: effectiveBackupRoot,
    manifest,
  };
}

function restoreBootstrapBackup(bootstrapBackup) {
  if (!bootstrapBackup || !Array.isArray(bootstrapBackup.manifest)) {
    return false;
  }

  for (const entry of bootstrapBackup.manifest) {
    removeDirectoryIfExists(entry.sourceDir);
    if (entry.sourceExisted && fs.existsSync(entry.backupDir)) {
      copyDirectory(entry.backupDir, entry.sourceDir);
    }
  }

  return true;
}

function removeBootstrapBackup(bootstrapBackup) {
  if (!bootstrapBackup || !bootstrapBackup.backupRoot || !fs.existsSync(bootstrapBackup.backupRoot)) {
    return false;
  }

  fs.rmSync(bootstrapBackup.backupRoot, { recursive: true, force: true });
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
    removeDirectoryIfExists(entry.sourceDir);
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
