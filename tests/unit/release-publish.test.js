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
});
