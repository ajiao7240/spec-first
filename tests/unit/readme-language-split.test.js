'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const README_EN_PATH = path.join(REPO_ROOT, 'README.md');
const README_ZH_PATH = path.join(REPO_ROOT, 'README.zh-CN.md');

describe('README language split contract', () => {
  test('repository keeps both English and Chinese README entrypoints', () => {
    expect(fs.existsSync(README_EN_PATH)).toBe(true);
    expect(fs.existsSync(README_ZH_PATH)).toBe(true);

    const englishReadme = fs.readFileSync(README_EN_PATH, 'utf8');

    expect(englishReadme).toContain('[English](./README.md) | [简体中文](./README.zh-CN.md)');
  });

  test('English README marks Chinese-first docs explicitly to avoid misleading readers', () => {
    const englishReadme = fs.readFileSync(README_EN_PATH, 'utf8');

    expect(englishReadme).toContain('Detailed manuals and implementation docs are currently Chinese-first.');
    expect(englishReadme).toContain('[Chinese Architecture Overview](./docs/02-架构设计/01-整体架构.md)');
    expect(englishReadme).toContain('[Chinese Development Guide](./docs/03-实施方案/06-开发规范.md)');
    expect(englishReadme).toContain('[Chinese Testing Plan](./docs/03-实施方案/04-测试方案.md)');
    expect(englishReadme).toContain('[Chinese Release Notes](./docs/08-版本更新/README.md)');
  });
});
