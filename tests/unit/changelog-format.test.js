'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const CHANGELOG_PATH = path.join(REPO_ROOT, 'CHANGELOG.md');
const CODEX_DEVELOPER_PATH = path.join(REPO_ROOT, '.codex/spec-first/.developer');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readDeveloperName() {
  const profile = read(CODEX_DEVELOPER_PATH);
  const match = profile.match(/^name=(.+)$/m);
  if (!match) {
    throw new Error('Missing name in .codex/spec-first/.developer');
  }
  return match[1].trim();
}

describe('CHANGELOG format', () => {
  test('intro guidance keeps current project record format', () => {
    const changelog = read(CHANGELOG_PATH);

    expect(changelog).toContain('- 记录格式：`- v版本号 YYYY-MM-DD HH:MM:SS 作者: 变更摘要 [(user-visible)]`');
  });

  test('current-day entries use the Codex developer profile author and timestamped format', () => {
    const changelog = read(CHANGELOG_PATH);
    const author = readDeveloperName();
    const entryPattern = new RegExp(
      `^- v\\d+\\.\\d+\\.\\d+ 2026-05-10 \\d{2}:\\d{2}:\\d{2} ${author}: .+(?: \\(user-visible\\))?$`,
    );
    const currentDayEntries = changelog
      .split(/\r?\n/)
      .filter((line) => line.startsWith('- v') && line.includes('2026-05-10'));

    expect(currentDayEntries.length).toBeGreaterThan(0);
    expect(currentDayEntries.filter((line) => !entryPattern.test(line))).toEqual([]);
  });
});
