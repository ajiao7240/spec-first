'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

describe('crg command characterization baselines', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  test('flows 默认按 criticality 排序并稳定透传 alias 字段', () => {
    const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const prepareSpy = jest.fn(() => ({
      all: () => [
        {
          flow_id: 'flow:checkout',
          entry_node: 'src/checkout.js#function#checkout#L12',
          criticality: 0.92,
          node_count: 8,
        },
        {
          flow_id: 'flow:sync',
          entry_node: 'src/sync.js#function#sync#L4',
          criticality: 0.61,
          node_count: 3,
        },
      ],
    }));
    const closeSpy = jest.fn();

    jest.isolateModules(() => {
      jest.doMock('../../src/crg/cli/open-db', () => ({
        openDb: () => ({
          repoRoot: '/repo',
          db: {
            prepare: prepareSpy,
            close: closeSpy,
          },
        }),
      }));

      const { run } = require('../../src/crg/commands/flows');
      run(['--repo=/repo']);
    });

    const payload = JSON.parse(outputSpy.mock.calls[0][0]);
    expect(prepareSpy).toHaveBeenCalledWith(
      'SELECT id AS flow_id, entry_node_id AS entry_node, criticality, node_count FROM flows ORDER BY criticality DESC'
    );
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(payload.data).toEqual({
      items: [
        {
          flow_id: 'flow:checkout',
          entry_node: 'src/checkout.js#function#checkout#L12',
          criticality: 0.92,
          node_count: 8,
          entry_confidence: 'Inferred',
          entry_inference_reason: 'zero_in_degree_calls',
        },
        {
          flow_id: 'flow:sync',
          entry_node: 'src/sync.js#function#sync#L4',
          criticality: 0.61,
          node_count: 3,
          entry_confidence: 'Inferred',
          entry_inference_reason: 'zero_in_degree_calls',
        },
      ],
    });
    outputSpy.mockRestore();
  });

  test('context 输出 top_hubs/top_communities/top_flows/summary 与 retrieval baseline', () => {
    const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    jest.isolateModules(() => {
      jest.doMock('fs', () => ({
        ...jest.requireActual('fs'),
        existsSync: jest.fn(() => true),
      }));
      jest.doMock('better-sqlite3', () => jest.fn());
      jest.doMock('../../src/crg/generations/paths', () => ({
        resolveActiveGraphDb: () => '/repo/.spec-first/crg/graph.db',
      }));
      jest.doMock('../../src/crg/migrations', () => ({
        initDatabase: () => ({
          prepare: jest.fn((sql) => {
            if (sql.includes('COUNT(e.id) AS in_degree')) {
              return {
                all: () => [
                  {
                    id: 'src/core.js#function#main#L10',
                    name: 'main',
                    file_path: 'src/core.js',
                    kind: 'function',
                    line_start: 10,
                    line_end: 24,
                    is_test: 0,
                    in_degree: 7,
                  },
                  {
                    id: 'src/api.js#function#handler#L3',
                    name: 'handler',
                    file_path: 'src/api.js',
                    kind: 'function',
                    line_start: 3,
                    line_end: 14,
                    is_test: 0,
                    in_degree: 4,
                  },
                ],
              };
            }
            if (sql.includes('FROM communities') && sql.includes('ORDER BY file_count DESC')) {
              return {
                all: () => [
                  { community_id: 'src/core', label: 'core', file_count: 6 },
                  { community_id: 'src/api', label: 'api', file_count: 4 },
                ],
              };
            }
            if (sql.includes('FROM flows') && sql.includes('ORDER BY criticality DESC')) {
              return {
                all: () => [
                  {
                    flow_id: 'flow:main',
                    entry_node: 'src/core.js#function#main#L10',
                    criticality: 0.88,
                    node_count: 7,
                  },
                ],
              };
            }
            if (sql.includes('AS node_count') && sql.includes('AS flow_count')) {
              return {
                get: () => ({
                  node_count: 42,
                  edge_count: 81,
                  community_count: 5,
                  flow_count: 3,
                }),
              };
            }
            throw new Error(`unexpected sql: ${sql}`);
          }),
          close: jest.fn(),
        }),
      }));
      jest.doMock('../../src/crg/retrieval/api', () => ({
        retrieveContext: () => ({
          ranked_context: [
            {
              id: 'context:architecture',
              reason: 'topology summary',
            },
          ],
          estimated_tokens: 321,
        }),
      }));

      const { run } = require('../../src/crg/cli/context');
      run(['--repo=/repo']);
    });

    const payload = JSON.parse(outputSpy.mock.calls[0][0]);
    expect(payload.data).toEqual({
      top_hubs: [
        {
          id: 'src/core.js#function#main#L10',
          name: 'main',
          file_path: 'src/core.js',
          kind: 'function',
          line_start: 10,
          line_end: 24,
          is_test: 0,
          confidence: 'Inferred',
          source_tier: 'crg_ast',
          evidence: ['context top_hub in_degree=7'],
          inference_reason: 'call_graph_traversal',
        },
        {
          id: 'src/api.js#function#handler#L3',
          name: 'handler',
          file_path: 'src/api.js',
          kind: 'function',
          line_start: 3,
          line_end: 14,
          is_test: 0,
          confidence: 'Inferred',
          source_tier: 'crg_ast',
          evidence: ['context top_hub in_degree=4'],
          inference_reason: 'call_graph_traversal',
        },
      ],
      top_communities: [
        { community_id: 'src/core', label: 'core', file_count: 6 },
        { community_id: 'src/api', label: 'api', file_count: 4 },
      ],
      top_flows: [
        {
          flow_id: 'flow:main',
          entry_node: 'src/core.js#function#main#L10',
          criticality: 0.88,
          node_count: 7,
          entry_confidence: 'Inferred',
          entry_inference_reason: 'zero_in_degree_calls',
        },
      ],
      summary: '42 nodes, 81 edges, 5 communities, 3 flows',
      ranked_context: [
        {
          id: 'context:architecture',
          reason: 'topology summary',
        },
      ],
      retrieval_estimated_tokens: 321,
    });
    outputSpy.mockRestore();
  });

  test('review-context 走真实 change-surface 主链并稳定输出 review 基线', () => {
    const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-review-char-'));

    try {
      fs.mkdirSync(path.join(repoRoot, 'src'), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, 'package.json'), JSON.stringify({
        name: 'crg-review-char',
        scripts: {
          test: 'jest',
          'test:smoke': 'bash tests/smoke/cli.sh',
        },
      }, null, 2));
      fs.writeFileSync(path.join(repoRoot, 'src', 'foo.js'), 'module.exports = function foo() { return true; };\n');
      fs.writeFileSync(path.join(repoRoot, 'src', 'foo.test.js'), 'test(\"foo\", () => expect(true).toBe(true));\n');
      fs.writeFileSync(path.join(repoRoot, 'src', 'foo.spec.js'), 'test(\"foo spec\", () => expect(true).toBe(true));\n');

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot,
            db: {
              prepare: jest.fn((sql) => {
                if (sql.includes("WHERE file_path = ? AND kind != 'module'")) {
                  return {
                    all: jest.fn(() => [{
                      id: 'src/foo.js#function#foo#L2',
                      name: 'foo',
                      file_path: 'src/foo.js',
                      kind: 'function',
                      line_start: 2,
                      line_end: 6,
                      is_test: 0,
                    }]),
                  };
                }
                if (sql.includes("SELECT id, name, line_end FROM nodes WHERE file_path = ? AND kind = 'module'")) {
                  return {
                    get: jest.fn((filePath) => ({
                      id: `${filePath}#module`,
                      name: path.basename(filePath, path.extname(filePath)),
                      line_end: 9,
                    })),
                  };
                }
                if (sql.includes("SELECT DISTINCT file_path FROM nodes WHERE is_test = 1")) {
                  return {
                    all: jest.fn(() => [{ file_path: 'src/foo.test.js' }]),
                  };
                }
                if (sql.includes("SELECT source_id, target_id FROM edges WHERE kind = 'calls'")) {
                  return {
                    all: jest.fn(() => [{
                      source_id: 'src/bar.js#function#bar#L10',
                      target_id: 'src/foo.js#function#foo#L2',
                    }]),
                  };
                }
                if (sql.includes('WHERE id IN')) {
                  return {
                    all: jest.fn(() => [{
                      id: 'src/bar.js#function#bar#L10',
                      name: 'bar',
                      file_path: 'src/bar.js',
                      kind: 'function',
                      line_start: 10,
                      line_end: 18,
                      is_test: 0,
                    }]),
                  };
                }
                throw new Error(`unexpected sql: ${sql}`);
              }),
            },
          }),
        }));
        jest.doMock('../../src/crg/changes', () => {
          const actual = jest.requireActual('../../src/crg/changes');
          return {
            summarizeChangeSurface: actual.summarizeChangeSurface,
            detectChanges: () => [{
              file: 'src/foo.js',
              risk_level: 'High',
              hunks: [{ start: 2, end: 4 }],
              review_priorities: [{ name: 'foo', score: 0.92 }],
              test_gaps: [{ name: 'foo' }],
            }],
            assessNodeRiskBatch: () => new Map([
              ['src/bar.js#function#bar#L10', 0.73],
            ]),
          };
        });
        jest.doMock('../../src/crg/input-convergence', () => ({
          isSensitiveFile: () => false,
        }));
        jest.doMock('../../src/crg/retrieval/api', () => ({
          retrieveContext: () => ({
            ranked_context: [
              {
                id: 'context:review',
                reason: 'changed file and candidate test',
              },
            ],
          }),
        }));

        const { run } = require('../../src/crg/commands/review-context');
        run([`--repo=${repoRoot}`, '--since=HEAD~1']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      expect(payload.data).toEqual({
        diff_summary: '1 file(s) changed since HEAD~1',
        affected_nodes: [
          {
            id: 'src/foo.js#function#foo#L2',
            name: 'foo',
            file_path: 'src/foo.js',
            kind: 'function',
            line_start: 2,
            line_end: 6,
            is_test: 0,
            confidence: 'Observed',
            source_tier: 'crg_ast',
            evidence: ['changed file: src/foo.js'],
            inference_reason: null,
            risk_level: 'High',
          },
        ],
        hunk_hit: [
          {
            id: 'src/foo.js#function#foo#L2',
            name: 'foo',
            file_path: 'src/foo.js',
            kind: 'function',
            line_start: 2,
            line_end: 6,
            is_test: 0,
            confidence: 'Observed',
            source_tier: 'crg_ast',
            evidence: ['changed file: src/foo.js'],
            inference_reason: null,
            risk_level: 'High',
          },
        ],
        candidate_tests: [
          {
            id: 'src/foo.test.js#module',
            name: 'foo.test',
            file_path: 'src/foo.test.js',
            kind: 'module',
            line_start: 0,
            line_end: 9,
            is_test: 1,
            confidence: 'Inferred',
            source_tier: 'grep_glob',
            evidence: ['matched sibling test file for src/foo.js'],
            inference_reason: 'naming_convention',
          },
          {
            id: 'src/foo.spec.js#module',
            name: 'foo.spec',
            file_path: 'src/foo.spec.js',
            kind: 'module',
            line_start: 0,
            line_end: 9,
            is_test: 1,
            confidence: 'Inferred',
            source_tier: 'grep_glob',
            evidence: ['matched sibling test file for src/foo.js'],
            inference_reason: 'naming_convention',
          },
        ],
        graph_expansion: [
          {
            id: 'src/bar.js#function#bar#L10',
            name: 'bar',
            file_path: 'src/bar.js',
            kind: 'function',
            line_start: 10,
            line_end: 18,
            is_test: 0,
            confidence: 'Inferred',
            source_tier: 'crg_ast',
            evidence: ['2-hop caller of changed code'],
            inference_reason: 'call_graph_traversal',
            depth: 1,
            risk_score: 0.73,
          },
        ],
        impacted_modules: ['src/'],
        impacted_languages: ['javascript'],
        impacted_platforms: ['cli'],
        recommended_required_verifications: [
          'unit-tests',
          'cli-smoke',
        ],
        recommended_optional_verifications: [],
        confidence: 'high',
        review_guidance: [
          'HIGH_RISK: foo — score 0.92',
          'TEST_GAP: 1 node(s) lack test coverage — foo',
          'RECOMMENDED_REQUIRED: unit-tests, cli-smoke',
          'VERIFICATION_CONFIDENCE: high',
          'BLAST_RADIUS: 1 caller(s) within 2 hops of changed code',
        ],
        ranked_context: [
          {
            id: 'context:review',
            reason: 'changed file and candidate test',
          },
        ],
      });
    } finally {
      outputSpy.mockRestore();
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
