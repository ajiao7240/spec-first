'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { initDatabase } = require('../../src/crg/migrations');

describe('crg migrations', () => {
  test('初始化时会设置 CRG 查询热点需要的 pragma', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-migrations-pragmas-'));
    const db = initDatabase(path.join(tmpDir, 'graph.db'));

    try {
      expect(db.pragma('synchronous', { simple: true })).toBe(1);
      expect(db.pragma('cache_size', { simple: true })).toBe(-64000);
      expect(db.pragma('temp_store', { simple: true })).toBe(2);
      expect(db.pragma('mmap_size', { simple: true })).toBe(268435456);
    } finally {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('edges 反向查询需要 source/target + kind 复合索引', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-migrations-indexes-'));
    const db = initDatabase(path.join(tmpDir, 'graph.db'));

    try {
      const indexNames = db.prepare("PRAGMA index_list('edges')").all().map((row) => row.name);
      expect(indexNames).toEqual(expect.arrayContaining([
        'idx_edges_target_kind',
        'idx_edges_source_kind',
      ]));

      const targetKindColumns = db.prepare("PRAGMA index_info('idx_edges_target_kind')").all();
      expect(targetKindColumns.map((row) => row.name)).toEqual(['target_id', 'kind']);

      const sourceKindColumns = db.prepare("PRAGMA index_info('idx_edges_source_kind')").all();
      expect(sourceKindColumns.map((row) => row.name)).toEqual(['source_id', 'kind']);
    } finally {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
