'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { GRAPH_QUALITY_FILE, resolveGraphDir } = require('../../src/crg/artifact-paths');
const { buildWorkflowContext } = require('../../src/crg/workflow-context/stage');

describe('crg workflow context quality surface', () => {
  test('graph-quality 缺失时以 ambiguous advisory summary 暴露', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-workflow-quality-'));
    try {
      const context = buildWorkflowContext({ repoRoot, stage: 'plan' });
      expect(context.graph_quality.state).toBe('missing');
      expect(context.graph_quality.limitations[0].code).toBe('graph-quality-missing');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('读取 graph-quality compact summary', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-workflow-quality-'));
    try {
      fs.mkdirSync(resolveGraphDir(repoRoot), { recursive: true });
      fs.writeFileSync(path.join(resolveGraphDir(repoRoot), GRAPH_QUALITY_FILE), JSON.stringify({
        schema_version: 'graph-quality/v1',
        generation_id: 'gen-1',
        advisory: true,
        coverage: { parsed_count: 2 },
        graph: { node_count: 2, edge_count: 1, confidence_distribution: { edges: { Observed: 1 } } },
        unresolved_edges: { count: 0, rate: 0, by_reason: {} },
        limitations: [],
      }));

      const context = buildWorkflowContext({ repoRoot, stage: 'work' });
      expect(context.graph_quality).toEqual(expect.objectContaining({
        state: 'available',
        generation_id: 'gen-1',
      }));
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
