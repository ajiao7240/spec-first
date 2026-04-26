'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { initDatabase } = require('../../src/crg/migrations');
const { upsertEdges, upsertNodes, replaceUnresolvedEdges } = require('../../src/crg/graph');
const { buildGraphQualityReport } = require('../../src/crg/quality/report');

describe('crg graph quality report', () => {
  test('报告覆盖 parser 降级、边置信度与 unresolved 统计', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-quality-'));
    const db = initDatabase(path.join(tmpDir, 'graph.db'));

    try {
      upsertNodes(db, [
        { id: 'src/a.js#function#a#L1', file_path: 'src/a.js', name: 'a', kind: 'function' },
        { id: 'src/b.js#function#b#L1', file_path: 'src/b.js', name: 'b', kind: 'function' },
      ]);
      upsertEdges(db, [
        {
          id: 'e1',
          source_id: 'src/a.js#function#a#L1',
          target_id: 'src/b.js#function#b#L1',
          kind: 'calls',
          confidence: 'Observed',
          resolution_method: 'direct_target_id',
        },
      ]);
      replaceUnresolvedEdges(db, [
        {
          source_id: 'src/a.js#function#a#L1',
          source_file: 'src/a.js',
          edge_kind: 'calls',
          target_name: 'missing',
          reason: 'no_match',
        },
      ]);

      const report = buildGraphQualityReport(db, {
        repoRoot: tmpDir,
        generationId: 'gen-1',
        buildSnapshot: {
          final_input_count: 3,
          parsed_count: 1,
          no_parser_count: 1,
          no_parser_samples: ['src/no-parser.swift'],
          parse_error_count: 1,
          parse_error_samples: ['src/bad.kt'],
        },
      });

      expect(report.schema_version).toBe('graph-quality/v1');
      expect(report.coverage.parsed_count).toBe(2);
      expect(report.coverage.changed_parsed_count).toBe(1);
      expect(report.coverage.parser_success_rate).toBeCloseTo(0.6667);
      expect(report.graph.confidence_distribution.edges.Observed).toBe(1);
      expect(report.unresolved_edges.by_reason.no_match).toBe(1);
      expect(report.limitations.map((item) => item.code)).toEqual(expect.arrayContaining([
        'no-parser-files',
        'parse-error-files',
        'unresolved-edges',
      ]));
    } finally {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
