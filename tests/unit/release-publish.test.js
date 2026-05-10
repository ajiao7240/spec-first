'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const RELEASE_PUBLISH_PATH = path.join(REPO_ROOT, 'scripts/release-publish.cjs');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('release publish script', () => {
  test('real publish explicitly targets npmjs registry', () => {
    const script = read(RELEASE_PUBLISH_PATH);

    expect(script).toContain("run('npm', ['publish', '--registry=https://registry.npmjs.org'])");
  });

  test('release gates run before package version is written', () => {
    const script = read(RELEASE_PUBLISH_PATH);
    const releaseGateIndex = script.indexOf("run('npm', ['run', 'test:release'])");
    const websiteGateIndex = script.indexOf("run('npm', ['run', 'test:release:website'])");
    const versionWriteIndex = script.indexOf('writePackageJson(nextPkg)');
    const packIndex = script.indexOf("run('npm', ['pack'])");

    expect(releaseGateIndex).toBeGreaterThan(-1);
    expect(websiteGateIndex).toBeGreaterThan(-1);
    expect(versionWriteIndex).toBeGreaterThan(-1);
    expect(packIndex).toBeGreaterThan(-1);
    expect(releaseGateIndex).toBeLessThan(versionWriteIndex);
    expect(websiteGateIndex).toBeLessThan(versionWriteIndex);
    expect(versionWriteIndex).toBeLessThan(packIndex);
  });
});
