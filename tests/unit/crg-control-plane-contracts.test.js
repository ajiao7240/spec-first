'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { validateAgainstSchema } = require('../../src/contracts/schema-validator');

const REPO_ROOT = path.join(__dirname, '..', '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
}

describe('CRG control-plane contracts', () => {
  test('graph-index-status schema validates current CRG status shape', () => {
    const schema = readJson('docs/contracts/crg/graph-index-status.schema.json');
    const status = {
      schema_version: 'graph-index-status/v1',
      generated_at: '2026-04-26T00:00:00.000Z',
      generation_id: '20260426-000000-ab12cd34',
      state: 'ready',
      stats: {
        node_count: 12,
        edge_count: 18,
        community_count: 2,
        flow_count: 1,
      },
      capabilities: {
        locate: true,
        path: true,
        explain: true,
        impact: true,
        review_context: true,
        workflow_context: true,
        hook: true,
      },
      limitations: [],
    };

    expect(validateAgainstSchema(schema, status).errors).toEqual([]);
  });

  test('code-navigation schema validates current CRG navigation shape', () => {
    const schema = readJson('docs/contracts/crg/code-navigation.schema.json');
    const navigation = {
      schema_version: 'code-navigation/v1',
      generated_at: '2026-04-26T00:00:00.000Z',
      generation_id: '20260426-000000-ab12cd34',
      entrypoints: [],
      test_roots: ['tests/unit/example.test.js'],
      high_risk_nodes: [],
      top_communities: [],
      top_flows: [],
      query_starters: [
        {
          query: 'review risks candidate tests',
          command: 'spec-first crg review-context --repo=<repo> --since=<base>',
        },
      ],
      limitations: [],
    };

    expect(validateAgainstSchema(schema, navigation).errors).toEqual([]);
  });
});
