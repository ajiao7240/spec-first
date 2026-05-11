'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const RELEASE_PUBLISH_PATH = path.join(REPO_ROOT, 'scripts/release-publish.cjs');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('release publish script', () => {
  test('real publish explicitly targets npmjs registry and disables pnpm git checks', () => {
    const script = read(RELEASE_PUBLISH_PATH);

    expect(script).toContain("runNpmChecked(['publish', '--registry=https://registry.npmjs.org', '--no-git-checks'])");
  });

  test('release gates run after target package version is written and before pack', () => {
    const script = read(RELEASE_PUBLISH_PATH);
    const releaseGateIndex = script.indexOf("runNpmChecked(['run', 'test:release'])");
    const websiteGateIndex = script.indexOf("runNpmChecked(['run', 'test:release:website'])");
    const versionWriteIndex = script.indexOf('writePackageJson(nextPkg)');
    const packIndex = script.indexOf("runNpmChecked(['pack'])");
    const dryRunPackIndex = script.indexOf("runNpmChecked(['pack', '--dry-run'])");
    const restoreIndex = script.lastIndexOf('writePackageJson(pkg)');

    expect(releaseGateIndex).toBeGreaterThan(-1);
    expect(websiteGateIndex).toBeGreaterThan(-1);
    expect(versionWriteIndex).toBeGreaterThan(-1);
    expect(packIndex).toBeGreaterThan(-1);
    expect(dryRunPackIndex).toBeGreaterThan(-1);
    expect(restoreIndex).toBeGreaterThan(packIndex);
    expect(versionWriteIndex).toBeLessThan(releaseGateIndex);
    expect(versionWriteIndex).toBeLessThan(websiteGateIndex);
    expect(websiteGateIndex).toBeLessThan(packIndex);
    expect(websiteGateIndex).toBeLessThan(dryRunPackIndex);
  });
});
