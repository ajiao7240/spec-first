'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');
const USER_MANUAL_README_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/README.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('user manual contracts', () => {
  test('manual version line follows package version', () => {
    const pkg = JSON.parse(read(PACKAGE_JSON_PATH));
    const manual = read(USER_MANUAL_README_PATH);

    expect(manual).toContain(`当前版本线：\`v${pkg.version}\``);
  });
});
