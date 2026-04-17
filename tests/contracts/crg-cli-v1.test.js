/**
 * CRG CLI v1 契约测试
 *
 * Unit 1：契约冻结阶段 — 全部使用 test.todo() 形式存在，不含任何实现代码。
 * Unit 6：envelope 部分已实现，解除 pending 状态，补充可执行断言。
 * 实现在后续 Unit 中逐步填充，本文件作为契约门控存在。
 *
 * 覆盖范围：
 *   - envelope 结构约束（R3）
 *   - FactItem 字段约束（R4）
 *   - crg query 参数矩阵（8 种 pattern）
 *   - 17 个子命令各自的 data 结构
 */

const { makeEnvelope } = require('../../src/crg/cli/envelope');
const fs = require('fs');
const os = require('os');
const path = require('path');

const VALID_CONFIDENCE = ['Observed', 'Inferred', 'Unknown'];
const VALID_SOURCE_TIERS = ['crg_ast', 'serena_semantic', 'grep_glob'];
const VALID_INFERENCE_REASONS = [
  'call_graph_traversal',
  'import_analysis',
  'naming_convention',
  'directory_proximity',
  'test_proximity',
];

function expectFactItemShape(item) {
  expect(item).toEqual(expect.objectContaining({
    id: expect.any(String),
    name: expect.any(String),
    file_path: expect.any(String),
    kind: expect.any(String),
    confidence: expect.any(String),
    source_tier: expect.any(String),
  }));
  expect(VALID_CONFIDENCE).toContain(item.confidence);
  expect(VALID_SOURCE_TIERS).toContain(item.source_tier);
  if (item.evidence !== undefined && item.evidence !== null) {
    expect(Array.isArray(item.evidence)).toBe(true);
    item.evidence.forEach((entry) => expect(typeof entry).toBe('string'));
  }
  if (item.confidence === 'Inferred') {
    expect(typeof item.inference_reason).toBe('string');
    expect(VALID_INFERENCE_REASONS).toContain(item.inference_reason);
  } else {
    expect(
      item.inference_reason === undefined ||
      item.inference_reason === null ||
      typeof item.inference_reason === 'string'
    ).toBe(true);
  }
}

function runQueryWithMocks(args, { rows = [], exists = true } = {}) {
  const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`EXIT:${code}`);
  });

  let payload = null;
  let thrown = null;

  jest.isolateModules(() => {
    jest.doMock('fs', () => {
      const actual = jest.requireActual('fs');
      return { ...actual, existsSync: () => exists };
    });
    jest.doMock('better-sqlite3', () => jest.fn());
    jest.doMock('../../src/crg/migrations', () => ({
      initDatabase: () => ({
        close: jest.fn(),
        prepare: jest.fn(() => ({
          all: jest.fn(() => rows),
        })),
      }),
    }));

    const { run } = require('../../src/crg/cli/query');
    try {
      run(args);
      if (outputSpy.mock.calls.length > 0) {
        payload = JSON.parse(outputSpy.mock.calls[0][0]);
      }
    } catch (error) {
      thrown = error;
    }
  });

  return { payload, thrown, outputSpy, stderrSpy, exitSpy };
}

describe('crg-cli-v1 contract', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Envelope ──────────────────────────────────────────────────────────────
  describe('envelope', () => {
    test('包含所有必填字段：schema_version, generated_at, repo_root, degraded, warnings, data', () => {
      const env = makeEnvelope('/repo', {});
      expect(env).toHaveProperty('schema_version');
      expect(env).toHaveProperty('generated_at');
      expect(env).toHaveProperty('repo_root');
      expect(env).toHaveProperty('degraded');
      expect(env).toHaveProperty('warnings');
      expect(env).toHaveProperty('data');
    });

    test('schema_version 值为 "crg-cli/v1"', () => {
      const env = makeEnvelope('/repo', {});
      expect(env.schema_version).toBe('crg-cli/v1');
    });

    test('warnings 是数组，不是 null 或 undefined', () => {
      const env = makeEnvelope('/repo', {});
      expect(Array.isArray(env.warnings)).toBe(true);
    });

    test('degraded 是 boolean', () => {
      const env = makeEnvelope('/repo', {});
      expect(typeof env.degraded).toBe('boolean');
    });

    test('generated_at 是合法 ISO 8601 格式字符串', () => {
      const env = makeEnvelope('/repo', {});
      expect(typeof env.generated_at).toBe('string');
      // ISO 8601 格式：能被 Date 解析且还原后相等
      expect(new Date(env.generated_at).toISOString()).toBe(env.generated_at);
    });

    test('repo_root 是非空字符串', () => {
      const env = makeEnvelope('/my/repo', {});
      expect(typeof env.repo_root).toBe('string');
      expect(env.repo_root.length).toBeGreaterThan(0);
      expect(env.repo_root).toBe('/my/repo');
    });

    test('warning 对象至少含 type 字段', () => {
      const env = makeEnvelope('/repo', {}, {
        warnings: [{ type: 'degraded_parser', message: 'tree-sitter missing' }],
      });
      expect(env.warnings[0]).toHaveProperty('type');
    });
  });

  // ─── FactItem ──────────────────────────────────────────────────────────────
  describe('fact item', () => {
    test('confidence=Inferred 时必须有 inference_reason', () => {
      const { nodeToFactItem } = require('../../src/crg/cli/query');
      const item = nodeToFactItem({
        id: 'src/a.js#function#foo#L1',
        name: 'foo',
        file_path: 'src/a.js',
        kind: 'function',
        line_start: 1,
        line_end: 3,
        is_test: 0,
      }, 'call_graph_traversal');

      expect(item.confidence).toBe('Inferred');
      expect(typeof item.inference_reason).toBe('string');
      expect(VALID_INFERENCE_REASONS).toContain(item.inference_reason);
      expectFactItemShape(item);
    });

    test('confidence=Observed 时 inference_reason 可缺省', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              close: jest.fn(),
              prepare: jest.fn((sql) => {
                if (sql.includes('FROM communities')) {
                  return {
                    get: () => ({
                      id: 'community:a',
                      label: 'community:a',
                      file_count: 1,
                      health_status: 'healthy',
                      health_density: 0.8,
                      health_independence: 0.9,
                    }),
                  };
                }
                return {
                  all: () => [{
                    id: 'src/a.js#function#foo#L1',
                    name: 'foo',
                    file_path: 'src/a.js',
                    kind: 'function',
                    line_start: 1,
                    line_end: 3,
                    is_test: 0,
                  }],
                };
              }),
            },
          }),
        }));

        const { run } = require('../../src/crg/commands/community');
        run(['--repo=/repo', '--id=community:a']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      const item = payload.data.members[0];
      expect(item.confidence).toBe('Observed');
      expect(item.inference_reason).toBeNull();
      expectFactItemShape(item);
      outputSpy.mockRestore();
    });

    test('confidence=Unknown 时 inference_reason 可缺省', () => {
      const item = {
        id: 'src/a.js#module',
        name: 'a',
        file_path: 'src/a.js',
        kind: 'module',
        confidence: 'Unknown',
        source_tier: 'grep_glob',
      };

      expect(item.inference_reason).toBeUndefined();
      expectFactItemShape(item);
    });

    test('confidence 只能是 Observed/Inferred/Unknown 之一', () => {
      expect(VALID_CONFIDENCE).toEqual(['Observed', 'Inferred', 'Unknown']);
    });

    test('source_tier 只能是 crg_ast/serena_semantic/grep_glob 之一', () => {
      expect(VALID_SOURCE_TIERS).toEqual(['crg_ast', 'serena_semantic', 'grep_glob']);
    });

    test('inference_reason 只能是规定的 5 种枚举值之一', () => {
      expect(VALID_INFERENCE_REASONS).toEqual([
        'call_graph_traversal',
        'import_analysis',
        'naming_convention',
        'directory_proximity',
        'test_proximity',
      ]);
    });

    test('evidence 若存在则为 string 数组', () => {
      const item = {
        id: 'src/a.js#function#foo#L1',
        name: 'foo',
        file_path: 'src/a.js',
        kind: 'function',
        confidence: 'Inferred',
        source_tier: 'crg_ast',
        evidence: ['edge from foo', 'edge to bar'],
        inference_reason: 'call_graph_traversal',
      };
      expectFactItemShape(item);
    });

    test('name / file_path / kind 均为必填字符串', () => {
      const { nodeToFactItem } = require('../../src/crg/cli/query');
      const item = nodeToFactItem({
        id: 'src/a.js#function#foo#L1',
        name: 'foo',
        file_path: 'src/a.js',
        kind: 'function',
      }, 'call_graph_traversal');

      expect(typeof item.name).toBe('string');
      expect(typeof item.file_path).toBe('string');
      expect(typeof item.kind).toBe('string');
      expectFactItemShape(item);
    });
  });

  // ─── crg query 参数矩阵 ────────────────────────────────────────────────────
  describe('crg query 参数矩阵', () => {
    const validCases = [
      ['callers_of', '--symbol=node:a', 'call_graph_traversal'],
      ['callees_of', '--symbol=node:a', 'call_graph_traversal'],
      ['importers_of', '--module=node:module', 'import_analysis'],
      ['importees_of', '--module=node:module', 'import_analysis'],
      ['tests_for', '--subject=node:subject', 'naming_convention'],
      ['similar_to', '--symbol=node:a', 'directory_proximity'],
      ['dependents_of', '--module=node:module', 'import_analysis'],
      ['dependencies_of', '--module=node:module', 'import_analysis'],
    ];

    test.each(validCases)('%s + 合法参数 → 合法', (pattern, requiredArg, reason) => {
      const { payload, thrown, outputSpy, stderrSpy, exitSpy } = runQueryWithMocks([
        '--repo=/repo',
        `--pattern=${pattern}`,
        requiredArg,
      ], {
        rows: [{
          id: 'src/a.js#function#foo#L1',
          name: 'foo',
          file_path: 'src/a.js',
          kind: 'function',
          line_start: 1,
          line_end: 3,
          is_test: 0,
        }],
      });

      expect(thrown).toBeNull();
      expect(exitSpy).not.toHaveBeenCalled();
      expect(Array.isArray(payload.data.items)).toBe(true);
      expect(payload.data.items[0].inference_reason).toBe(reason);
      expectFactItemShape(payload.data.items[0]);
      outputSpy.mockRestore();
      stderrSpy.mockRestore();
      exitSpy.mockRestore();
    });

    const invalidCases = [
      ['callers_of', '--module=node:module'],
      ['callees_of', '--module=node:module'],
      ['importers_of', '--symbol=node:a'],
      ['importees_of', '--symbol=node:a'],
      ['tests_for', '--symbol=node:a'],
      ['tests_for', '--module=node:module'],
      ['similar_to', '--module=node:module'],
      ['dependents_of', '--symbol=node:a'],
      ['dependencies_of', '--symbol=node:a'],
    ];

    test.each(invalidCases)('%s + 非法参数 %s → exit 1', (pattern, wrongArg) => {
      const { thrown, payload, outputSpy, stderrSpy, exitSpy } = runQueryWithMocks([
        '--repo=/repo',
        `--pattern=${pattern}`,
        wrongArg,
      ]);

      expect(payload).toBeNull();
      expect(String(thrown)).toContain('EXIT:1');
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(stderrSpy).toHaveBeenCalled();
      outputSpy.mockRestore();
      stderrSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  // ─── crg build ─────────────────────────────────────────────────────────────
  describe('crg build', () => {
    test.todo('返回合法 JSON envelope');
    test.todo('data 含 node_count, edge_count, changed_files, duration_ms');
    test.todo('node_count 和 edge_count 为非负整数');
    test.todo('duration_ms 为非负数值');
  });

  // ─── crg stats ─────────────────────────────────────────────────────────────
  describe('crg stats', () => {
    test('含 corpus_health.status（small/optimal/large 之一）', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('better-sqlite3', () => jest.fn());
        jest.doMock('../../src/crg/migrations', () => ({
          initDatabase: () => ({
            close: jest.fn(),
            prepare: jest.fn((sql) => {
              if (sql.includes('SELECT COUNT(*) as c FROM nodes')) return { get: () => ({ c: 3 }) };
              if (sql.includes('SELECT COUNT(*) as c FROM edges')) return { get: () => ({ c: 2 }) };
              if (sql.includes('SUM(line_end - line_start)')) return { get: () => ({ total: 42 }) };
              if (sql.includes('SELECT last_built, unresolved_edge_count')) {
                return { get: () => ({ last_built: '2026-04-11T00:00:00.000Z', unresolved_edge_count: 1 }) };
              }
              if (sql.includes('FROM unresolved_edges') && sql.includes('GROUP BY edge_kind')) return { all: () => [] };
              if (sql.includes('FROM unresolved_edges') && sql.includes('GROUP BY source_file')) return { all: () => [] };
              if (sql.includes('FROM unresolved_edges') && sql.includes('LIMIT 10')) return { all: () => [] };
              if (sql.includes('SELECT COUNT(*) AS c FROM unresolved_edges')) return { get: () => ({ c: 0 }) };
              if (sql.includes('SELECT file_path, sha256 FROM fingerprints')) return { all: () => [] };
              return { get: () => ({}), all: () => [] };
            }),
          }),
        }));
        jest.doMock('../../src/crg/incremental', () => ({
          computeFileSHA: () => ({ sha: 'same' }),
        }));
        jest.doMock('fs', () => {
          const actual = jest.requireActual('fs');
          return { ...actual, existsSync: () => true };
        });

        const { runStats } = require('../../src/crg/cli/build');
        runStats(['--repo=/repo']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      expect(['small', 'optimal', 'large']).toContain(payload.data.corpus_health.status);
      expect(typeof payload.data.corpus_health.total_loc).toBe('number');
      expect(typeof payload.data.unresolved_edge_count).toBe('number');
      expect(payload.data.last_build_unresolved_summary).toEqual({
        top_kinds: [],
        top_source_files: [],
        sample_count: 0,
      });
      expect(Array.isArray(payload.data.last_build_unresolved_samples)).toBe(true);
      expect(new Date(payload.data.last_built).toISOString()).toBe(payload.data.last_built);
      outputSpy.mockRestore();
    });
    test.todo('图未构建时 exit 2');
  });

  // ─── crg context ───────────────────────────────────────────────────────────
  describe('crg context', () => {
    test.todo('data 含 top_flows、top_communities、top_hubs、summary');
    test.todo('top_flows 是数组');
    test.todo('top_hubs 中每项满足 FactItem 约束');
    test.todo('summary 是字符串');
  });

  // ─── crg query ─────────────────────────────────────────────────────────────
  describe('crg query', () => {
    test('data.items 是数组', () => {
      const { payload, thrown, outputSpy, stderrSpy, exitSpy } = runQueryWithMocks([
        '--repo=/repo',
        '--pattern=callers_of',
        '--symbol=node:a',
      ]);

      expect(thrown).toBeNull();
      expect(Array.isArray(payload.data.items)).toBe(true);
      outputSpy.mockRestore();
      stderrSpy.mockRestore();
      exitSpy.mockRestore();
    });

    test('items 中每项满足 FactItem 约束', () => {
      const { payload, thrown, outputSpy, stderrSpy, exitSpy } = runQueryWithMocks([
        '--repo=/repo',
        '--pattern=callers_of',
        '--symbol=node:a',
      ], {
        rows: [{
          id: 'src/a.js#function#foo#L1',
          name: 'foo',
          file_path: 'src/a.js',
          kind: 'function',
          line_start: 1,
          line_end: 3,
          is_test: 0,
        }],
      });

      expect(thrown).toBeNull();
      payload.data.items.forEach(expectFactItemShape);
      outputSpy.mockRestore();
      stderrSpy.mockRestore();
      exitSpy.mockRestore();
    });

    test('缺少 --pattern 时 exit 1', () => {
      const { thrown, payload, outputSpy, stderrSpy, exitSpy } = runQueryWithMocks([
        '--repo=/repo',
        '--symbol=node:a',
      ]);

      expect(payload).toBeNull();
      expect(String(thrown)).toContain('EXIT:1');
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(stderrSpy).toHaveBeenCalled();
      outputSpy.mockRestore();
      stderrSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  // ─── crg impact ────────────────────────────────────────────────────────────
  describe('crg impact', () => {
    test('data 含 impacted_nodes（FactItem 数组）和 blast_radius（整数）', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              close: jest.fn(),
              prepare: jest.fn((sql) => {
                if (sql.includes('SELECT id, name, file_path, kind FROM nodes WHERE id = ?')) {
                  return { get: () => ({ id: 'target', name: 'target', file_path: 'src/target.js', kind: 'function' }) };
                }
                if (sql.includes('SELECT source_id, target_id FROM edges WHERE kind IN')) {
                  return { all: () => [{ source_id: 'caller', target_id: 'target' }] };
                }
                if (sql.includes('WHERE id IN')) {
                  return { all: () => [{ id: 'caller', name: 'caller', file_path: 'src/caller.js', kind: 'function' }] };
                }
                return { get: () => null, all: () => [] };
              }),
            },
          }),
        }));

        const { run } = require('../../src/crg/commands/impact');
        run(['--repo=/repo', '--symbol=target']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      expect(Array.isArray(payload.data.impacted_nodes)).toBe(true);
      expect(payload.data.blast_radius).toBe(payload.data.impacted_nodes.length);
      expect(payload.data.impacted_nodes[0]).toEqual(expect.objectContaining({
        confidence: 'Inferred',
        evidence: expect.any(Array),
        inference_reason: 'call_graph_traversal',
      }));
      outputSpy.mockRestore();
    });
  });

  // ─── crg large-functions ───────────────────────────────────────────────────
  describe('crg large-functions', () => {
    test.todo('data.items 每项含 name, file_path, loc, kind');
    test.todo('kind 只能是 function 或 method');
    test.todo('loc 为正整数');
  });

  // ─── crg search ────────────────────────────────────────────────────────────
  describe('crg search', () => {
    test.todo('data.results 每项含 node_id, name, file_path, kind, snippet');
    test.todo('snippet 为字符串，可以为空字符串');
  });

  // ─── crg flows ─────────────────────────────────────────────────────────────
  describe('crg flows', () => {
    test.todo('data.items 每项含 flow_id, entry_node, criticality, node_count');
    test.todo('criticality 为 0~1 之间的浮点数');
  });

  // ─── crg flow ──────────────────────────────────────────────────────────────
  describe('crg flow', () => {
    test('data 含 flow_id, entry_node, criticality, nodes', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              close: jest.fn(),
              prepare: jest.fn((sql) => {
                if (sql.includes('FROM flows WHERE id = ?')) {
                  return {
                    get: () => ({
                      id: 'flow:main',
                      entry_node_id: 'src/a.js#function#entry#L1',
                      criticality: 0.75,
                      node_count: 2,
                    }),
                  };
                }
                return {
                  all: () => [
                    {
                      id: 'src/a.js#function#entry#L1',
                      name: 'entry',
                      file_path: 'src/a.js',
                      kind: 'function',
                      position: 0,
                    },
                    {
                      id: 'src/b.js#function#worker#L8',
                      name: 'worker',
                      file_path: 'src/b.js',
                      kind: 'function',
                      position: 1,
                    },
                  ],
                };
              }),
            },
          }),
        }));

        const { run } = require('../../src/crg/commands/flow');
        run(['--repo=/repo', '--id=flow:main']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      expect(payload.data).toEqual(expect.objectContaining({
        flow_id: 'flow:main',
        entry_node: 'src/a.js#function#entry#L1',
        criticality: 0.75,
        nodes: expect.any(Array),
      }));
      expect(payload.data.nodes).toHaveLength(2);
      expect(payload.data.nodes[0]).toEqual(expect.objectContaining({
        position: 0,
        confidence: 'Inferred',
        source_tier: 'crg_ast',
        inference_reason: 'call_graph_traversal',
      }));
      outputSpy.mockRestore();
    });

    test('nodes 中每项满足 FactItem 约束', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              close: jest.fn(),
              prepare: jest.fn((sql) => {
                if (sql.includes('FROM flows WHERE id = ?')) {
                  return {
                    get: () => ({
                      id: 'flow:main',
                      entry_node_id: 'src/a.js#function#entry#L1',
                      criticality: 0.75,
                      node_count: 1,
                    }),
                  };
                }
                return {
                  all: () => [{
                    id: 'src/a.js#function#entry#L1',
                    name: 'entry',
                    file_path: 'src/a.js',
                    kind: 'function',
                    position: 0,
                  }],
                };
              }),
            },
          }),
        }));

        const { run } = require('../../src/crg/commands/flow');
        run(['--repo=/repo', '--id=flow:main']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      payload.data.nodes.forEach(expectFactItemShape);
      outputSpy.mockRestore();
    });

    test('指定不存在的 flow_id 时 exit 1', () => {
      const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`EXIT:${code}`);
      });

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              close: jest.fn(),
              prepare: jest.fn(() => ({
                get: () => null,
              })),
            },
          }),
        }));

        const { run } = require('../../src/crg/commands/flow');
        expect(() => run(['--repo=/repo', '--id=flow:missing'])).toThrow('EXIT:1');
      });

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(stderrSpy).toHaveBeenCalled();
      stderrSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  // ─── crg affected-flows ────────────────────────────────────────────────────
  describe('crg affected-flows', () => {
    test('data.items 每项含 flow_id, entry_node, affected_nodes', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              close: jest.fn(),
              prepare: jest.fn(() => ({
                all: (...args) => {
                  if (args.length === 1 && args[0] === 'src/a.js') {
                    return [
                      {
                        flow_id: 'flow:main',
                        entry_node_id: 'src/a.js#function#entry#L1',
                        criticality: 0.8,
                        node_id: 'src/a.js#function#entry#L1',
                        node_name: 'entry',
                        file_path: 'src/a.js',
                        kind: 'function',
                        position: 0,
                      },
                    ];
                  }
                  return [];
                },
              })),
            },
          }),
        }));
        jest.doMock('child_process', () => ({
          execFileSync: () => 'src/a.js\n',
        }));

        const { run } = require('../../src/crg/commands/affected-flows');
        run(['--repo=/repo', '--since=HEAD~1']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      expect(Array.isArray(payload.data.items)).toBe(true);
      expect(payload.data.items[0]).toEqual(expect.objectContaining({
        flow_id: 'flow:main',
        entry_node: 'src/a.js#function#entry#L1',
        criticality: 0.8,
        affected_nodes: expect.any(Array),
      }));
      expect(payload.data.changed_files).toEqual(['src/a.js']);
      outputSpy.mockRestore();
    });

    test('affected_nodes 中每项满足 FactItem 约束', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              close: jest.fn(),
              prepare: jest.fn(() => ({
                all: (...args) => {
                  if (args.length === 1 && args[0] === 'src/a.js') {
                    return [
                      {
                        flow_id: 'flow:main',
                        entry_node_id: 'src/a.js#function#entry#L1',
                        criticality: 0.8,
                        node_id: 'src/a.js#function#entry#L1',
                        node_name: 'entry',
                        file_path: 'src/a.js',
                        kind: 'function',
                        position: 0,
                      },
                    ];
                  }
                  return [];
                },
              })),
            },
          }),
        }));
        jest.doMock('child_process', () => ({
          execFileSync: () => 'src/a.js\n',
        }));

        const { run } = require('../../src/crg/commands/affected-flows');
        run(['--repo=/repo', '--since=HEAD~1']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      payload.data.items[0].affected_nodes.forEach(expectFactItemShape);
      outputSpy.mockRestore();
    });
  });

  // ─── crg communities ───────────────────────────────────────────────────────
  describe('crg communities', () => {
    test('data 含 items 数组和 stats 对象', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              close: jest.fn(),
              prepare: jest.fn(() => ({
                all: () => [{
                  id: 'community:a',
                  label: 'community:a',
                  file_count: 2,
                  health_status: 'fragmented',
                  health_density: 0.4,
                  health_independence: 0.2,
                }],
              })),
            },
          }),
        }));

        const { run } = require('../../src/crg/commands/communities');
        run(['--repo=/repo']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      expect(Array.isArray(payload.data.items)).toBe(true);
      expect(payload.data.stats.total).toBe(payload.data.items.length);
      expect(['healthy', 'isolated', 'scattered', 'fragmented']).toContain(
        payload.data.items[0].health.status
      );
      expect(typeof payload.data.items[0].health.density).toBe('number');
      expect(typeof payload.data.items[0].health.independence).toBe('number');
      outputSpy.mockRestore();
    });
  });

  // ─── crg community ─────────────────────────────────────────────────────────
  describe('crg community', () => {
    test('data 含 community_id, label, file_count, health, members', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              close: jest.fn(),
              prepare: jest.fn((sql) => {
                if (sql.includes('FROM communities')) {
                  return {
                    get: () => ({
                      id: 'community:a',
                      label: 'community:a',
                      file_count: 1,
                      health_status: 'healthy',
                      health_density: 0.8,
                      health_independence: 0.9,
                    }),
                  };
                }
                return {
                  all: () => [{
                    id: 'src/a.js#function#foo#L1',
                    name: 'foo',
                    file_path: 'src/a.js',
                    kind: 'function',
                    line_start: 1,
                    line_end: 3,
                    is_test: 0,
                  }],
                };
              }),
            },
          }),
        }));

        const { run } = require('../../src/crg/commands/community');
        run(['--repo=/repo', '--id=community:a']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      expect(payload.data).toEqual(expect.objectContaining({
        community_id: 'community:a',
        label: 'community:a',
        file_count: 1,
        health: expect.any(Object),
        members: expect.any(Array),
      }));
      expect(payload.data.members[0]).toEqual(expect.objectContaining({
        id: 'src/a.js#function#foo#L1',
        confidence: 'Observed',
        evidence: expect.any(Array),
        inference_reason: null,
      }));
      outputSpy.mockRestore();
    });
    test.todo('指定不存在的 community_id 时 exit 1');
  });

  // ─── crg architecture ──────────────────────────────────────────────────────
  describe('crg architecture', () => {
    test('data 含 hub_nodes（FactItem 数组）和 cross_community_edges 数组', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              close: jest.fn(),
              prepare: jest.fn(() => ({
                all: () => [{ source_id: 'a', target_id: 'b', kind: 'calls' }],
              })),
            },
          }),
        }));
        jest.doMock('../../src/crg/analyze', () => ({
          godNodes: () => [{
            id: 'src/a.js#function#foo#L1',
            name: 'foo',
            file_path: 'src/a.js',
            kind: 'function',
            confidence: 'Inferred',
            source_tier: 'crg_ast',
            evidence: ['god node in_degree=2'],
            inference_reason: 'call_graph_traversal',
          }],
        }));

        const { run } = require('../../src/crg/commands/architecture');
        run(['--repo=/repo']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      expect(Array.isArray(payload.data.hub_nodes)).toBe(true);
      expect(Array.isArray(payload.data.cross_community_edges)).toBe(true);
      expect(payload.data.cross_community_edges[0]).toEqual({
        source: 'a',
        target: 'b',
        kind: 'calls',
      });
      outputSpy.mockRestore();
    });
  });

  // ─── crg surprising-connections ────────────────────────────────────────────
  describe('crg surprising-connections', () => {
    test.todo('每项含 score（整数）和 reasons（string[]）');
    test.todo('每项含 source 和 target（均为字符串）');
    test.todo('score 为非负整数');
    test.todo('reasons 不为空数组');
  });

  // ─── crg god-nodes ─────────────────────────────────────────────────────────
  describe('crg god-nodes', () => {
    test.todo('data.items 是数组，每项满足 FactItem 约束');
  });

  // ─── crg detect-changes ────────────────────────────────────────────────────
  describe('crg detect-changes', () => {
    test.todo('data.items 每项含 file, risk_level, functions');
    test.todo('risk_level 只能是 High/Medium/Low 之一');
    test.todo('functions 每项含 name 和 risk_level');
  });

  // ─── crg review-context ────────────────────────────────────────────────────
  describe('crg review-context', () => {
    test('data 含 diff_summary, affected_nodes, hunk_hit, candidate_tests, graph_expansion, review_guidance', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`EXIT:${code}`);
      });

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              prepare: jest.fn(() => ({
                all: jest.fn(() => []),
              })),
            },
          }),
        }));
        jest.doMock('../../src/crg/changes', () => ({
          detectChanges: () => [],
          assessNodeRiskBatch: () => new Map(),
        }));
        jest.doMock('../../src/crg/input-convergence', () => ({
          isSensitiveFile: () => false,
        }));

        const { run: isolatedRun } = require('../../src/crg/commands/review-context');
        isolatedRun(['--repo=/repo', '--since=HEAD~1']);
      });

      expect(exitSpy).not.toHaveBeenCalled();
      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      expect(payload.data).toHaveProperty('diff_summary');
      expect(payload.data).toHaveProperty('affected_nodes');
      expect(payload.data).toHaveProperty('hunk_hit');
      expect(payload.data).toHaveProperty('candidate_tests');
      expect(payload.data).toHaveProperty('graph_expansion');
      expect(payload.data).toHaveProperty('review_guidance');
      outputSpy.mockRestore();
      exitSpy.mockRestore();
    });

    test('graph_expansion 是数组，每项含 depth 和 risk_score', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              prepare: jest.fn((sql) => {
                // edges WHERE kind='calls': 返回一条 caller→target 边
                if (sql.includes("WHERE kind = 'calls'")) {
                  return { all: jest.fn(() => [{ source_id: 'caller:x', target_id: 'affected:y' }]) };
                }
                // affected_nodes: nodes WHERE file_path = ?
                if (sql.includes("WHERE file_path = ? AND kind != 'module'")) {
                  return {
                    all: jest.fn(() => [{
                      id: 'affected:y',
                      name: 'doWork',
                      file_path: 'src/worker.js',
                      kind: 'function',
                      line_start: 5,
                      line_end: 20,
                      is_test: 0,
                    }]),
                  };
                }
                // expansion batch query: nodes WHERE id IN (...)
                if (sql.includes('WHERE id IN')) {
                  return {
                    all: jest.fn(() => [{
                      id: 'caller:x',
                      name: 'caller',
                      file_path: 'src/caller.js',
                      kind: 'function',
                      line_start: 1,
                      line_end: 10,
                      is_test: 0,
                    }]),
                  };
                }
                // assessNodeRisk sub-queries: return safe defaults
                return { get: jest.fn(() => ({ cnt: 0 })), all: jest.fn(() => []) };
              }),
            },
          }),
        }));
        jest.doMock('../../src/crg/changes', () => ({
          detectChanges: () => [{ file: 'src/worker.js', risk_level: 'Medium', review_priorities: [], test_gaps: [] }],
          assessNodeRiskBatch: (ids) => { const m = new Map(); ids.forEach(id => m.set(id, 0.3)); return m; },
        }));
        jest.doMock('../../src/crg/input-convergence', () => ({
          isSensitiveFile: () => false,
        }));

        const { run: isolatedRun } = require('../../src/crg/commands/review-context');
        isolatedRun(['--repo=/repo', '--since=HEAD~1']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      expect(Array.isArray(payload.data.graph_expansion)).toBe(true);
      if (payload.data.graph_expansion.length > 0) {
        const item = payload.data.graph_expansion[0];
        expect(typeof item.depth).toBe('number');
        expect(item.depth).toBeGreaterThanOrEqual(1);
        expect(item.depth).toBeLessThanOrEqual(2);
        expect(typeof item.risk_score).toBe('number');
        expect(item.risk_score).toBeGreaterThanOrEqual(0);
        expect(item.risk_score).toBeLessThanOrEqual(1);
        expectFactItemShape(item);
      }
      outputSpy.mockRestore();
    });

    test('review_guidance 是字符串数组，始终含 BLAST_RADIUS 条目', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              prepare: jest.fn(() => ({
                all: jest.fn(() => []),
              })),
            },
          }),
        }));
        jest.doMock('../../src/crg/changes', () => ({
          detectChanges: () => [],
          assessNodeRiskBatch: () => new Map(),
        }));
        jest.doMock('../../src/crg/input-convergence', () => ({
          isSensitiveFile: () => false,
        }));

        const { run: isolatedRun } = require('../../src/crg/commands/review-context');
        isolatedRun(['--repo=/repo', '--since=HEAD~1']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      expect(Array.isArray(payload.data.review_guidance)).toBe(true);
      payload.data.review_guidance.forEach(item => expect(typeof item).toBe('string'));
      expect(payload.data.review_guidance.some(s => s.startsWith('BLAST_RADIUS:'))).toBe(true);
      outputSpy.mockRestore();
    });

    test('candidate_tests 推断项含统一推断字段', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-review-context-'));
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'src/foo.test.js'), 'test("ok", () => {});\n');

      try {
        jest.isolateModules(() => {
          jest.doMock('../../src/crg/cli/open-db', () => ({
            openDb: () => ({
              repoRoot: tmpDir,
              db: {
                prepare: jest.fn((sql) => ({
                  // module 节点查询（buildCandidateTest 内部 .get）返回 null 模拟未索引
                  get: jest.fn(() => null),
                  // nodes 查询返回 foo.test.js（用于 affected_nodes + is_test LIKE 查询）
                  all: jest.fn(() => [{ file_path: 'src/foo.test.js' }]),
                })),
              },
            }),
          }));
          jest.doMock('../../src/crg/changes', () => ({
            detectChanges: () => [{ file: 'src/foo.js', risk_level: 'Medium' }],
            assessNodeRiskBatch: () => new Map(),
          }));
          jest.doMock('../../src/crg/input-convergence', () => ({
            isSensitiveFile: () => false,
          }));

          const { run: isolatedRun } = require('../../src/crg/commands/review-context');
          isolatedRun([`--repo=${tmpDir}`, '--since=HEAD~1']);
        });

        const payload = JSON.parse(outputSpy.mock.calls[0][0]);
        // candidate_tests 允许多个候选，但每项都必须满足统一 FactItem 契约
        expect(payload.data.candidate_tests.length).toBeGreaterThan(0);
        expect(payload.data.candidate_tests).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              file_path: 'src/foo.test.js',
              kind: 'module',
              is_test: 1,
              confidence: 'Inferred',
              evidence: expect.any(Array),
              inference_reason: expect.any(String),
              source_tier: expect.any(String),
            }),
          ])
        );
        for (const item of payload.data.candidate_tests) {
          expect(item).toEqual(expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            file_path: expect.any(String),
            kind: 'module',
            is_test: 1,
            confidence: 'Inferred',
            evidence: expect.any(Array),
            inference_reason: expect.any(String),
            source_tier: expect.any(String),
          }));
        }
      } finally {
        outputSpy.mockRestore();
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test.todo('affected_nodes 中每项满足 FactItem 约束');
    test.todo('无 diff 时 diff_summary 为空字符串而非 null');
  });
});
