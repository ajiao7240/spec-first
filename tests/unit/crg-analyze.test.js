'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { initDatabase } = require('../../src/crg/migrations');
const { upsertNodes, upsertEdges } = require('../../src/crg/graph');
const { surprisingConnections } = require('../../src/crg/analyze');

describe('crg analyze', () => {
  test('仅 cross_community 不再单独触发 surprising connection', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-analyze-'));
    const db = initDatabase(path.join(tmpDir, 'graph.db'));

    try {
      upsertNodes(db, [
        {
          id: 'src/shared.js#function#helper#L1',
          file_path: 'src/shared.js',
          name: 'helper',
          kind: 'function',
          line_start: 1,
          line_end: 3,
          community_id: 'shared',
        },
        {
          id: 'src/auth/a.js#function#entry#L10',
          file_path: 'src/auth/a.js',
          name: 'entry',
          kind: 'function',
          line_start: 10,
          line_end: 20,
          community_id: 'auth',
        },
        {
          id: 'src/payments/b.js#function#targetJs#L30',
          file_path: 'src/payments/b.js',
          name: 'targetJs',
          kind: 'function',
          line_start: 30,
          line_end: 40,
          community_id: 'payments',
        },
        {
          id: 'src/payments/c.py#function#targetPy#L50',
          file_path: 'src/payments/c.py',
          name: 'targetPy',
          kind: 'function',
          line_start: 50,
          line_end: 60,
          community_id: 'payments',
        },
      ]);
      upsertEdges(db, [
        {
          id: 'helper:entry:calls',
          source_id: 'src/shared.js#function#helper#L1',
          target_id: 'src/auth/a.js#function#entry#L10',
          kind: 'calls',
          weight: 1,
        },
        {
          id: 'entry:target-js:calls',
          source_id: 'src/auth/a.js#function#entry#L10',
          target_id: 'src/payments/b.js#function#targetJs#L30',
          kind: 'calls',
          weight: 1,
        },
        {
          id: 'entry:target-py:calls',
          source_id: 'src/auth/a.js#function#entry#L10',
          target_id: 'src/payments/c.py#function#targetPy#L50',
          kind: 'calls',
          weight: 1,
        },
      ]);

      const result = surprisingConnections(db);
      expect(result.map((item) => item.target)).toContain('src/payments/c.py#function#targetPy#L50');
      expect(result.map((item) => item.target)).not.toContain('src/payments/b.js#function#targetJs#L30');
    } finally {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
