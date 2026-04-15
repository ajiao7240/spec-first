'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');

describe('CHANGELOG format', () => {
  test('intro guidance keeps nested explanation bullets', () => {
    const changelog = fs.readFileSync(path.join(REPO_ROOT, 'CHANGELOG.md'), 'utf8');

    expect(changelog).toContain('- 说明：\n  - `v版本号` 使用本次变更对应的发布版本\n  - 日期时间必须使用 `YYYY-MM-DD HH:MM:SS`\n  - `作者` 填写提交人或变更责任人\n  - `变更摘要` 使用中文，简明说明本次改动\n  - 用户可感知的变更在末尾追加 `(user-visible)`');
  });
});
