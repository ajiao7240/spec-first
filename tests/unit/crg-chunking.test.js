'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildChunksForNodes } = require('../../src/crg/chunking');
const { initDatabase } = require('../../src/crg/migrations');
const { upsertNodes, upsertChunks } = require('../../src/crg/graph');
const { retrieveContext } = require('../../src/crg/retrieval/api');

describe('crg chunking', () => {
  test('language-aware chunking 会对不同语言使用不同 chunk 粒度', () => {
    const chunks = buildChunksForNodes([
      { id: 'src/a.py#function#small#L1', file_path: 'src/a.py', name: 'small', kind: 'function', line_start: 1, line_end: 150, retrieval_text: 'python function' },
      { id: 'src/b.js#function#large#L1', file_path: 'src/b.js', name: 'large', kind: 'function', line_start: 1, line_end: 150, retrieval_text: 'javascript function' },
    ]);

    expect(chunks.filter((item) => item.parent_symbol_id.includes('a.py'))).toHaveLength(3);
    expect(chunks.filter((item) => item.parent_symbol_id.includes('b.js'))).toHaveLength(2);
    expect(chunks.filter((item) => item.parent_symbol_id.includes('a.py'))[0].summary).toContain('python');
  });

  test('普通函数生成单 chunk，超大函数按规则拆分', () => {
    const chunks = buildChunksForNodes([
      { id: 'src/a.js#function#small#L1', file_path: 'src/a.js', name: 'small', kind: 'function', line_start: 1, line_end: 20, retrieval_text: 'small function' },
      { id: 'src/a.js#function#large#L30', file_path: 'src/a.js', name: 'large', kind: 'function', line_start: 30, line_end: 220, retrieval_text: 'large function' },
    ], { maxLines: 80 });

    expect(chunks.filter((item) => item.parent_symbol_id.includes('#small#'))).toHaveLength(1);
    expect(chunks.filter((item) => item.parent_symbol_id.includes('#large#'))).toHaveLength(3);
  });

  test('chunk 能入库并被 retrieval API 选中', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-chunking-'));
    const db = initDatabase(path.join(tmpDir, 'graph.db'));

    try {
      upsertNodes(db, [
        { id: 'src/a.js#function#large#L1', file_path: 'src/a.js', name: 'large', kind: 'function', line_start: 1, line_end: 200, retrieval_text: 'large payment processor' },
      ]);
      const chunks = buildChunksForNodes([
        { id: 'src/a.js#function#large#L1', file_path: 'src/a.js', name: 'large', kind: 'function', line_start: 1, line_end: 200, retrieval_text: 'large payment processor' },
      ], { maxLines: 80 });
      upsertChunks(db, chunks);

      const result = retrieveContext(db, {
        profile: 'work',
        query: 'payment processor',
        changedFiles: ['src/a.js'],
      });

      expect(result.ranked_context.some((item) => item.type === 'chunk')).toBe(true);
    } finally {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
