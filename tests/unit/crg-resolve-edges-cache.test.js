'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { initDatabase } = require('../../src/crg/migrations');
const { upsertNodes, resolveEdges } = require('../../src/crg/graph');

describe('resolveEdges ambiguous cache', () => {
  test('同一重名符号重复解析时只执行一次全局 SQL 查询', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-resolve-edges-cache-'));
    const dbPath = path.join(tmpDir, 'graph.db');
    const db = initDatabase(dbPath);

    try {
      upsertNodes(db, [
        {
          id: 'src/a.js#function#foo#L1',
          file_path: 'src/a.js',
          name: 'foo',
          kind: 'function',
          line_start: 1,
          line_end: 3,
        },
        {
          id: 'src/b.js#function#foo#L1',
          file_path: 'src/b.js',
          name: 'foo',
          kind: 'function',
          line_start: 1,
          line_end: 3,
        },
        {
          id: 'src/a.js#function#callerOne#L10',
          file_path: 'src/a.js',
          name: 'callerOne',
          kind: 'function',
          line_start: 10,
          line_end: 14,
        },
        {
          id: 'src/a.js#function#callerTwo#L20',
          file_path: 'src/a.js',
          name: 'callerTwo',
          kind: 'function',
          line_start: 20,
          line_end: 24,
        },
      ]);

      const actualPrepare = db.prepare.bind(db);
      let ambiguousQueryCount = 0;
      const proxyDb = Object.create(db);
      proxyDb.prepare = (sql) => {
        const stmt = actualPrepare(sql);
        if (sql.includes("SELECT id, file_path FROM nodes WHERE name = ? AND kind != 'module'")) {
          return {
            ...stmt,
            all: (...args) => {
              ambiguousQueryCount++;
              return stmt.all(...args);
            },
          };
        }
        return stmt;
      };

      const result = resolveEdges(proxyDb, [
        {
          source_id: 'src/a.js#function#callerOne#L10',
          target_name: 'foo',
          target_path_raw: null,
          kind: 'calls',
        },
        {
          source_id: 'src/a.js#function#callerTwo#L20',
          target_name: 'foo',
          target_path_raw: null,
          kind: 'calls',
        },
      ]);

      expect(ambiguousQueryCount).toBe(1);
      expect(result.unresolvedCount).toBe(0);
      expect(result.resolved).toEqual([
        expect.objectContaining({ target_id: 'src/a.js#function#foo#L1' }),
        expect.objectContaining({ target_id: 'src/a.js#function#foo#L1' }),
      ]);
    } finally {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
