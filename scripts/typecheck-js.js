#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.join(__dirname, '..');
const CHECK_ROOTS = ['bin', 'src', 'scripts', 'skills'];
const CHECK_EXTENSIONS = new Set(['.cjs', '.js']);

function listJavaScriptFiles(rootDir) {
  const results = [];

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (entry.isFile() && CHECK_EXTENSIONS.has(path.extname(entry.name))) {
        results.push(absolutePath);
      }
    }
  }

  walk(rootDir);
  return results;
}

function main() {
  const files = CHECK_ROOTS
    .map((relativeRoot) => path.join(REPO_ROOT, relativeRoot))
    .filter((rootDir) => fs.existsSync(rootDir))
    .flatMap(listJavaScriptFiles)
    .sort((left, right) => left.localeCompare(right));

  for (const filePath of files) {
    const result = spawnSync(process.execPath, ['--check', filePath], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    if (result.status === 0) continue;

    process.stderr.write(result.stderr || result.stdout || `node --check failed: ${path.relative(REPO_ROOT, filePath)}\n`);
    return 1;
  }

  console.log(`typecheck passed (${files.length} files checked)`);
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  CHECK_ROOTS,
  listJavaScriptFiles,
  main,
};
