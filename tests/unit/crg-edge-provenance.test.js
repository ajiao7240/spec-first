'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { initDatabase } = require('../../src/crg/migrations');
const { replaceUnresolvedEdges, resolveEdges, upsertEdges, upsertNodes } = require('../../src/crg/graph');

describe('crg edge provenance', () => {
  test('resolved edges 入库时保留 resolution metadata', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-edge-prov-'));
    const db = initDatabase(path.join(tmpDir, 'graph.db'));

    try {
      upsertNodes(db, [
        { id: 'src/a.js#function#a#L1', file_path: 'src/a.js', name: 'a', kind: 'function' },
        { id: 'src/b.js#function#b#L1', file_path: 'src/b.js', name: 'b', kind: 'function' },
      ]);
      const resolved = resolveEdges(db, [{
        source_id: 'src/a.js#function#a#L1',
        target_id: 'src/b.js#function#b#L1',
        kind: 'calls',
      }]).resolved;
      upsertEdges(db, resolved);

      const row = db.prepare('SELECT confidence, resolution_method, evidence FROM edges WHERE id = ?').get(resolved[0].id);
      expect(row.confidence).toBe('Observed');
      expect(row.resolution_method).toBe('direct_target_id');
      expect(JSON.parse(row.evidence)[0]).toContain('raw target_id exists');
    } finally {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('unresolved edges 保留 reason 和 evidence', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-edge-prov-'));
    const db = initDatabase(path.join(tmpDir, 'graph.db'));

    try {
      replaceUnresolvedEdges(db, [{
        source_id: 'src/a.js#function#a#L1',
        source_file: 'src/a.js',
        edge_kind: 'calls',
        target_name: 'missing',
        reason: 'no_match',
        evidence: ['not found'],
      }]);
      const row = db.prepare('SELECT reason, confidence, resolution_method, evidence FROM unresolved_edges').get();
      expect(row).toEqual(expect.objectContaining({
        reason: 'no_match',
        confidence: 'Unknown',
        resolution_method: 'unresolved',
      }));
      expect(JSON.parse(row.evidence)).toEqual(['not found']);
    } finally {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
