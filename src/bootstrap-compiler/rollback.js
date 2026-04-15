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

  fs.rmSync(contextDir, { recursive: true, force: true });
  copyDirectory(backupDir, contextDir);
  return true;
}

function removeBootstrapBackup(backupDir) {
  if (!backupDir || !fs.existsSync(backupDir)) return false;
  fs.rmSync(backupDir, { recursive: true, force: true });
  return true;
}

module.exports = {
  copyDirectory,
  countFiles,
  createBootstrapBackup,
  removeBootstrapBackup,
  restoreBootstrapBackup,
};
