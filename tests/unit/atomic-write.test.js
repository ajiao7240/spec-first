'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createAtomicTempPath,
  writeFileAtomic,
} = require('../../src/cli/atomic-write');

describe('atomic file write helper', () => {
  test('uses unique same-directory temporary files instead of a fixed .tmp sibling', () => {
    const filePath = path.join(os.tmpdir(), 'spec-first atomic', 'AGENTS.md');
    const first = createAtomicTempPath(filePath);
    const second = createAtomicTempPath(filePath);

    expect(path.dirname(first)).toBe(path.dirname(filePath));
    expect(path.basename(first)).toMatch(/^\.AGENTS\.md\.\d+\.\d+\.[a-f0-9]{12}\.tmp$/);
    expect(first).not.toBe(`${filePath}.tmp`);
    expect(second).not.toBe(first);
  });

  test('writes content and removes temp file after rename', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-atomic-write-'));
    const filePath = path.join(root, 'nested', 'CLAUDE.md');

    try {
      writeFileAtomic(filePath, 'first\n');
      writeFileAtomic(filePath, 'second\n');

      expect(fs.readFileSync(filePath, 'utf8')).toBe('second\n');
      expect(fs.readdirSync(path.dirname(filePath)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
