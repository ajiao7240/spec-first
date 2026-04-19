'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { initDatabase } = require('../../src/crg/migrations');
const { upsertNodes, upsertEdges } = require('../../src/crg/graph');

describe('crg changes', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  test('getChangedHunksFromGit 会解析 unified=0 diff 的行号范围', () => {
    jest.isolateModules(() => {
      jest.doMock('child_process', () => ({
        execFileSync: jest.fn(() => [
          'diff --git a/src/a.js b/src/a.js',
          '+++ b/src/a.js',
          '@@ -10 +10 @@',
          '@@ -30,0 +31,2 @@',
          'diff --git a/src/b.js b/src/b.js',
          '+++ b/src/b.js',
          '@@ -5,2 +5 @@',
        ].join('\n')),
      }));

      const { getChangedHunksFromGit } = require('../../src/crg/changes');
      expect(getChangedHunksFromGit('/repo', 'HEAD~1')).toEqual([
        {
          file: 'src/a.js',
          hunks: [{ start: 10, end: 10 }, { start: 31, end: 32 }],
        },
        {
          file: 'src/b.js',
          hunks: [{ start: 5, end: 5 }],
        },
      ]);
    });
  });

  test('detectChanges 的文件风险查询使用批量 fan-in，而不是对每个文件做 N+1 SQL', () => {
    jest.isolateModules(() => {
      jest.doMock('child_process', () => ({
        execFileSync: jest.fn((cmd, args) => {
          if (args.includes('--name-only')) return 'src/a.js\nsrc/b.js\n';
          if (args.includes('--unified=0')) {
            return ['+++ b/src/a.js', '@@ -1 +1 @@', '+++ b/src/b.js', '@@ -1 +1 @@'].join('\n');
          }
          throw new Error(`unexpected git args: ${args.join(' ')}`);
        }),
      }));

      const { detectChanges } = require('../../src/crg/changes');
      const db = {
        prepare: jest.fn((sql) => {
          if (sql.includes("SELECT id, file_path FROM nodes WHERE kind = 'module' AND file_path IN")) {
            return {
              all: () => [
                { id: 'mod:a', file_path: 'src/a.js' },
                { id: 'mod:b', file_path: 'src/b.js' },
              ],
            };
          }
          if (sql.includes('SELECT target_id, COUNT(*) AS cnt FROM edges WHERE target_id IN')) {
            return {
              all: () => [
                { target_id: 'mod:a', cnt: 12 },
                { target_id: 'mod:b', cnt: 4 },
              ],
            };
          }
          if (sql.includes("WHERE file_path = ? AND kind IN ('function', 'method')")) {
            return { all: () => [] };
          }
          if (sql.includes("WHERE file_path = ? AND kind IN ('function', 'method', 'class')")) {
            return { all: () => [] };
          }
          if (sql.includes("file_path = ? AND kind = 'module' LIMIT 1")) {
            throw new Error('detectChanges 不应再逐文件执行 module fan-in 查询');
          }
          if (sql.includes('SELECT COUNT(*) as cnt FROM edges WHERE target_id = ?')) {
            throw new Error('detectChanges 不应再逐文件执行 fan-in COUNT 查询');
          }
          return { all: () => [], get: () => ({ cnt: 0 }) };
        }),
      };

      expect(detectChanges('/repo', 'HEAD~1', db)).toEqual([
        expect.objectContaining({ file: 'src/a.js', risk_level: 'High' }),
        expect.objectContaining({ file: 'src/b.js', risk_level: 'Medium' }),
      ]);
    });
  });

  test('单行注释 hunk 不应把整文件高风险节点带进 review_priorities/test_gaps', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-changes-'));
    const db = initDatabase(path.join(tmpDir, 'graph.db'));

    try {
      upsertNodes(db, [
        {
          id: 'src/a.js#module#a.js#L0',
          file_path: 'src/a.js',
          name: 'a.js',
          kind: 'module',
          line_start: 0,
          line_end: 0,
        },
        {
          id: 'src/a.js#function#authGate#L10',
          file_path: 'src/a.js',
          name: 'authGate',
          kind: 'function',
          line_start: 10,
          line_end: 20,
        },
        {
          id: 'src/a.js#function#renderLabel#L100',
          file_path: 'src/a.js',
          name: 'renderLabel',
          kind: 'function',
          line_start: 100,
          line_end: 110,
        },
        {
          id: 'src/caller.js#function#invoke#L1',
          file_path: 'src/caller.js',
          name: 'invoke',
          kind: 'function',
          line_start: 1,
          line_end: 5,
        },
      ]);
      upsertEdges(db, [
        {
          id: 'src/caller.js#function#invoke#L1:src/a.js#function#authGate#L10:calls',
          source_id: 'src/caller.js#function#invoke#L1',
          target_id: 'src/a.js#function#authGate#L10',
          kind: 'calls',
          weight: 1,
        },
      ]);

      jest.isolateModules(() => {
        jest.doMock('child_process', () => ({
          execFileSync: jest.fn((cmd, args) => {
            if (args.includes('--name-only')) return 'src/a.js\n';
            if (args.includes('--unified=0')) {
              return ['+++ b/src/a.js', '@@ -90 +90 @@'].join('\n');
            }
            throw new Error(`unexpected git args: ${args.join(' ')}`);
          }),
        }));

        const { detectChanges } = require('../../src/crg/changes');
        const result = detectChanges('/repo', 'HEAD~1', db);

        expect(result).toHaveLength(1);
        expect(result[0].hunks).toEqual([{ start: 90, end: 90 }]);
        expect(result[0].review_priorities).toEqual([]);
        expect(result[0].test_gaps).toEqual([]);
      });
    } finally {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('assessNodeRisk 对普通 request 命名保持克制，只在安全语境中放大 validate/verify', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-changes-risk-'));
    const db = initDatabase(path.join(tmpDir, 'graph.db'));

    try {
      upsertNodes(db, [
        {
          id: 'src/web/request.js#function#handleRequest#L1',
          file_path: 'src/web/request.js',
          name: 'handleRequest',
          kind: 'function',
          line_start: 1,
          line_end: 5,
          is_test: 0,
        },
        {
          id: 'src/auth/token.js#function#verifyJwtToken#L10',
          file_path: 'src/auth/token.js',
          name: 'verifyJwtToken',
          kind: 'function',
          line_start: 10,
          line_end: 15,
          is_test: 0,
        },
      ]);

      const { assessNodeRisk } = require('../../src/crg/changes');
      const requestRisk = assessNodeRisk('src/web/request.js#function#handleRequest#L1', db);
      const authRisk = assessNodeRisk('src/auth/token.js#function#verifyJwtToken#L10', db);

      expect(authRisk).toBeGreaterThan(requestRisk);
    } finally {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
