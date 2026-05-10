'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');

function walkShellFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) {
    return results;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkShellFiles(absolutePath));
    } else if (entry.isFile() && entry.name.endsWith('.sh')) {
      results.push(absolutePath);
    }
  }
  return results;
}

describe('shell portability contracts', () => {
  test('all checked-in .sh helpers declare bash explicitly', () => {
    const shellFiles = ['scripts', 'skills', 'tests']
      .flatMap((root) => walkShellFiles(path.join(REPO_ROOT, root)));
    const offenders = shellFiles.filter((filePath) => {
      const firstLine = fs.readFileSync(filePath, 'utf8').split(/\r?\n/, 1)[0];
      return firstLine !== '#!/bin/bash' && firstLine !== '#!/usr/bin/env bash';
    }).map((filePath) => path.relative(REPO_ROOT, filePath).split(path.sep).join('/'));

    expect(offenders).toEqual([]);
  });

  test('repo-level shell helpers use bash strict mode', () => {
    const shellFiles = walkShellFiles(path.join(REPO_ROOT, 'scripts'));
    const offenders = shellFiles.filter((filePath) => {
      const text = fs.readFileSync(filePath, 'utf8');
      return !text.includes('set -euo pipefail');
    }).map((filePath) => path.relative(REPO_ROOT, filePath).split(path.sep).join('/'));

    expect(offenders).toEqual([]);
  });

  test('source shell scripts do not use macOS-only sed -i syntax', () => {
    const shellFiles = ['scripts', 'skills']
      .flatMap((root) => walkShellFiles(path.join(REPO_ROOT, root)));
    const offenders = shellFiles.filter((filePath) => {
      const text = fs.readFileSync(filePath, 'utf8');
      return /\bsed\s+-i\s+''/.test(text);
    }).map((filePath) => path.relative(REPO_ROOT, filePath).split(path.sep).join('/'));

    expect(offenders).toEqual([]);
  });
});
