'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { initDatabase } = require('../../src/crg/migrations');
const { upsertNodes } = require('../../src/crg/graph');
const { retrieveContext } = require('../../src/crg/retrieval/api');

describe('crg semantic rerank', () => {
  test('未启用时主链行为不变，启用时可重排', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-rerank-'));
    const db = initDatabase(path.join(tmpDir, 'graph.db'));

    try {
      upsertNodes(db, [
        { id: 'src/a.js#function#alpha#L1', file_path: 'src/a.js', name: 'alpha', kind: 'function', line_start: 1, line_end: 10, retrieval_text: 'generic function' },
        { id: 'src/b.js#function#billingAlpha#L1', file_path: 'src/b.js', name: 'billingAlpha', kind: 'function', line_start: 1, line_end: 10, retrieval_text: 'billing payment settlement' },
      ]);

      const withoutSemantic = retrieveContext(db, {
        profile: 'plan',
        query: 'billing payment',
      });
      const withSemantic = retrieveContext(db, {
        profile: 'plan',
        query: 'billing payment',
        semantic: true,
      });

      expect(withoutSemantic.ranked_context.length).toBeGreaterThan(0);
      expect(withSemantic.ranked_context[0].file_path).toBe('src/b.js');
    } finally {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
