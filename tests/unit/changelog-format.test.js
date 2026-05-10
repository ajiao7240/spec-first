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

  test('latest dated entries use the Codex developer profile author and timestamped format', () => {
    const changelog = read(CHANGELOG_PATH);
    const author = readDeveloperName();
    const entries = changelog
      .split(/\r?\n/)
      .filter((line) => line.startsWith('- v'));
    const latestEntry = entries[0] || '';
    const latestDateMatch = latestEntry.match(/^- v\d+\.\d+\.\d+ (\d{4}-\d{2}-\d{2}) /);

    expect(latestDateMatch).not.toBeNull();
    const latestDate = latestDateMatch[1];
    const entryPattern = new RegExp(
      `^- v\\d+\\.\\d+\\.\\d+ ${latestDate} \\d{2}:\\d{2}:\\d{2} ${author}: .+(?: \\(user-visible\\))?$`,
    );
    const latestDateEntries = entries
      .filter((line) => line.includes(latestDate));

    expect(latestDateEntries.length).toBeGreaterThan(0);
    expect(latestDateEntries.filter((line) => !entryPattern.test(line))).toEqual([]);
  });
});
