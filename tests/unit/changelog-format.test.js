'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const CHANGELOG_PATH = path.join(REPO_ROOT, 'CHANGELOG.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('CHANGELOG format', () => {
  test('intro guidance keeps current project record format', () => {
    const changelog = read(CHANGELOG_PATH);

    expect(changelog).toContain('- 记录格式：`- v版本号 YYYY-MM-DD HH:MM:SS 作者: 变更摘要 [(user-visible)]`');
    expect(changelog).toContain('- 条目保持 compact：记录 source surface、用户可见影响、验证/未验证状态和必要 artifact 路径；长推理放 requirements、plan、review 或 validation 文档');
  });

  test('latest dated entries use timestamped format without constraining author identity', () => {
    const changelog = read(CHANGELOG_PATH);
    const entries = changelog
      .split(/\r?\n/)
      .filter((line) => line.startsWith('- v'));
    const latestEntry = entries[0] || '';
    const latestDateMatch = latestEntry.match(/^- v\d+\.\d+\.\d+ (\d{4}-\d{2}-\d{2}) /);

    expect(latestDateMatch).not.toBeNull();
    const latestDate = latestDateMatch[1];
    const entryPattern = new RegExp(
      `^- v\\d+\\.\\d+\\.\\d+ ${latestDate} \\d{2}:\\d{2}:\\d{2} [^:]+: .+(?: \\(user-visible\\))?$`,
    );
    const latestDateEntries = entries
      .filter((line) => line.includes(latestDate));

    expect(latestDateEntries.length).toBeGreaterThan(0);
    expect(latestDateEntries.filter((line) => !entryPattern.test(line))).toEqual([]);
  });
});
