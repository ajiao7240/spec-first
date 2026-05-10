'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createAtomicTempPath,
  writeFileAtomic,
} = require('../../src/cli/atomic-write');
const {
  applyOperationPlan,
  writeState,
} = require('../../src/cli/state');

const STATE_SOURCE_PATH = path.join(__dirname, '..', '..', 'src', 'cli', 'state.js');

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

  test('state executor uses the shared atomic helper for managed writes', () => {
    const source = fs.readFileSync(STATE_SOURCE_PATH, 'utf8');

    expect(source).toContain("const { writeFileAtomic } = require('./atomic-write');");
    expect(source).toContain('writeFileAtomic(statePath,');
    expect(source).toContain('writeFileAtomic(filePath, contents);');
    expect(source).toContain("writeFileAtomic(filePath, contents || '', 'utf8');");
    expect(source).not.toContain('fs.writeFileSync(statePath,');
    expect(source).not.toContain('fs.writeFileSync(filePath,');
  });

  test('operation plan preserves buffer writes and chmod through atomic writes', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-managed-write-'));
    const textPath = path.join(root, 'runtime', 'command.md');
    const bufferPath = path.join(root, 'runtime', 'tool');

    try {
      applyOperationPlan(root, {
        operations: [
          {
            kind: 'write_file',
            path: 'runtime/command.md',
            contents: 'hello\n',
          },
          {
            kind: 'write_file',
            path: 'runtime/tool',
            contents: Buffer.from([0, 1, 2, 3]),
            encoding: 'buffer',
            mode: 0o755,
          },
        ],
      });

      expect(fs.readFileSync(textPath, 'utf8')).toBe('hello\n');
      expect([...fs.readFileSync(bufferPath)]).toEqual([0, 1, 2, 3]);
      expect(fs.statSync(bufferPath).mode & 0o777).toBe(0o755);
      expect(fs.readdirSync(path.dirname(bufferPath)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('managed state file writes do not leave temporary files behind', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-managed-state-'));
    const adapter = { stateFile: '.codex/spec-first/state.json' };
    const stateDir = path.join(root, '.codex', 'spec-first');

    try {
      writeState(root, {
        manifestVersion: 'test',
        platform: 'codex',
        commands: [],
        skills: [],
        workflowSkills: [],
        agents: [],
        agentSupportFiles: [],
      }, adapter);

      const statePath = path.join(stateDir, 'state.json');
      expect(JSON.parse(fs.readFileSync(statePath, 'utf8'))).toMatchObject({
        manifestVersion: 'test',
        platform: 'codex',
      });
      expect(fs.readdirSync(stateDir).filter((name) => name.endsWith('.tmp'))).toEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
