'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');
const PACKAGE_LOCK_PATH = path.join(REPO_ROOT, 'package-lock.json');
const POSTINSTALL_PATH = path.join(REPO_ROOT, 'bin/postinstall.js');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

describe('package install contracts', () => {
  test('retired graph native packages are absent from package manifests', () => {
    const pkg = readJson(PACKAGE_JSON_PATH);
    const lock = readJson(PACKAGE_LOCK_PATH);
    const sqliteDep = 'better' + '-sqlite3';
    const parserDep = 'tree' + '-sitter';
    const nativePackages = [
      sqliteDep,
      parserDep,
      `${parserDep}-c`,
      `${parserDep}-c-sharp`,
      `${parserDep}-cpp`,
      `${parserDep}-go`,
      `${parserDep}-java`,
      `${parserDep}-javascript`,
      `${parserDep}-kotlin`,
      `${parserDep}-objc`,
      `${parserDep}-php`,
      `${parserDep}-python`,
      `${parserDep}-ruby`,
      `${parserDep}-rust`,
      `${parserDep}-scala`,
      `${parserDep}-swift`,
      `${parserDep}-typescript`,
    ];

    for (const packageName of nativePackages) {
      expect(pkg.dependencies[packageName]).toBeUndefined();
      expect(pkg.optionalDependencies?.[packageName]).toBeUndefined();
      expect(lock.packages[''].dependencies[packageName]).toBeUndefined();
      expect(lock.packages[''].optionalDependencies?.[packageName]).toBeUndefined();
      expect(lock.packages[`node_modules/${packageName}`]).toBeUndefined();
    }

    expect(pkg.files).not.toContain('vendor/');
    expect(pkg.scripts['test:e2e:' + 'crg']).toBeUndefined();
    expect(pkg.scripts.test).not.toContain('test:e2e:' + 'crg');
    expect(pkg.overrides).toBeUndefined();
  });

  test('postinstall keeps setup summary without native repair logic', () => {
    const postinstall = fs.readFileSync(POSTINSTALL_PATH, 'utf8');
    const sqliteDep = 'better' + '-sqlite3';
    const parserDep = 'tree' + '-sitter';
    const pruneScript = 'prune' + '-native';
    const prebuildTool = 'prebuild' + '-install';

    expect(postinstall).not.toMatch(new RegExp(`CRG|${sqliteDep}|${parserDep}|${pruneScript}|npm rebuild|${prebuildTool}`, 'i'));
    expect(postinstall).toMatch(/spec-first init/);
    expect(postinstall).toMatch(/managed assets/);
    expect(postinstall).toMatch(/Claude|Codex/);
  });
});
