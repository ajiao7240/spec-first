'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');
const PACKAGE_LOCK_PATH = path.join(REPO_ROOT, 'package-lock.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

describe('package install contracts', () => {
  test('Kotlin tree-sitter grammar does not block Windows global installs', () => {
    const pkg = readJson(PACKAGE_JSON_PATH);
    const lock = readJson(PACKAGE_LOCK_PATH);

    expect(pkg.dependencies['tree-sitter-kotlin']).toBeUndefined();
    expect(pkg.optionalDependencies['tree-sitter-kotlin']).toBe('~0.3.0');
    expect(lock.packages[''].dependencies['tree-sitter-kotlin']).toBeUndefined();
    expect(lock.packages[''].optionalDependencies['tree-sitter-kotlin']).toBe('~0.3.0');
    expect(lock.packages['node_modules/tree-sitter-kotlin'].optional).toBe(true);
  });
});
