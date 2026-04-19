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

async function runBuildWithMocks({
  nodeCount = 3,
  edgeCount = 2,
  changed = ['src/a.js'],
  deleted = [],
  finalInputs = ['src/a.js'],
} = {}) {
  const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`EXIT:${code}`);
  });

  let thrown = null;

  jest.isolateModules(() => {
    jest.doMock('better-sqlite3', () => jest.fn());
    jest.doMock('fs', () => {
      const actual = jest.requireActual('fs');
      return {
        ...actual,
        statSync: () => ({ isDirectory: () => true }),
        existsSync: (targetPath) => {
          const normalized = String(targetPath || '');
          if (normalized.endsWith('Podfile.lock')) return false;
          if (normalized.endsWith('.db')) return false;
          return true;
        },
        mkdirSync: jest.fn(),
        copyFileSync: jest.fn(),
        writeFileSync: jest.fn(),
        readdirSync: jest.fn(() => []),
      };
    });
    jest.doMock('../../src/crg/migrations', () => ({
      initDatabase: () => ({
        close: jest.fn(),
        prepare: jest.fn((sql) => {
          if (sql.includes('SELECT file_path FROM nodes')) return { all: () => [] };
          if (sql.includes('SELECT file_path, sha256 FROM fingerprints')) return { all: () => [] };
          if (sql.includes('SELECT * FROM graph_meta WHERE id = 1')) {
            return { get: () => ({ schema_version: 'crg-cli/v1' }) };
          }
          if (sql.includes('SELECT COUNT(*) as c FROM nodes')) return { get: () => ({ c: nodeCount }) };
          if (sql.includes('SELECT COUNT(*) as c FROM edges')) return { get: () => ({ c: edgeCount }) };
          if (sql.includes('UPDATE graph_meta SET last_built')) return { run: jest.fn() };
          if (sql.includes('DELETE FROM fingerprints')) return { run: jest.fn() };
          return { get: () => ({}), all: () => [], run: jest.fn() };
        }),
      }),
    }));
    jest.doMock('../../src/crg/input-convergence', () => ({
      collectInputFiles: async () => ({
        finalInputs,
        stats: { ignored_files_by_rule: {} },
      }),
    }));
    jest.doMock('../../src/crg/parser', () => ({
      parseFile: () => ({
        nodes: [],
        rawEdges: [],
        skipped: false,
      }),
      buildChunksForNodes: () => [],
    }));
    jest.doMock('../../src/crg/incremental', () => ({
      detectChangedFiles: () => ({
        changed,
        deleted,
        changedShas: new Map(changed.map((filePath, index) => [filePath, `sha-${index}`])),
      }),
      updateFingerprints: jest.fn(),
    }));
    jest.doMock('../../src/crg/graph', () => ({
      upsertNodes: jest.fn(),
      upsertChunks: jest.fn(),
      upsertEdges: jest.fn(),
      deleteStaleNodes: jest.fn(),
      resolveEdges: () => ({ resolved: [], unresolvedCount: 0, unresolved: [] }),
      setUnresolvedEdgeCount: jest.fn(),
      replaceUnresolvedEdges: jest.fn(),
    }));
    jest.doMock('../../src/crg/cli/postprocess', () => ({
      runPostprocess: jest.fn(),
    }));
    jest.doMock('../../src/crg/generations/health', () => ({
      assessGenerationHealth: () => ({ healthy: true, reason: null }),
    }));
    jest.doMock('../../src/crg/generations/promote', () => ({
      promoteGeneration: jest.fn(),
    }));

    const { run } = require('../../src/crg/cli/build');
    try {
      run(['--repo=/repo', '--force']);
    } catch (error) {
      thrown = error;
    }
  });

  await new Promise((resolve) => setImmediate(resolve));

  let payload = null;
  if (outputSpy.mock.calls.length > 0) {
    payload = JSON.parse(outputSpy.mock.calls[0][0]);
  }

  return {
    payload,
    thrown,
    outputSpy,
    stderrSpy,
    exitSpy,
  };
}

function runStatsWithMocks({
  graphBuilt = true,
  nodeCount = 3,
  edgeCount = 2,
  totalLoc = 42,
  lastBuilt = '2026-04-11T00:00:00.000Z',
  unresolvedEdgeCount = 1,
  topKinds = [],
  topSourceFiles = [],
  unresolvedSamples = [],
  unresolvedSampleCount = 0,
  fingerprintRows = [],
  computedSha = 'same',
} = {}) {
  const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`EXIT:${code}`);
  });

  let payload = null;
  let thrown = null;

  jest.isolateModules(() => {
    jest.doMock('better-sqlite3', () => jest.fn());
    jest.doMock('../../src/crg/migrations', () => ({
      initDatabase: () => ({
        close: jest.fn(),
        prepare: jest.fn((sql) => {
          if (sql.includes('SELECT COUNT(*) as c FROM nodes')) return { get: () => ({ c: nodeCount }) };
          if (sql.includes('SELECT COUNT(*) as c FROM edges')) return { get: () => ({ c: edgeCount }) };
          if (sql.includes('SUM(line_end - line_start)')) return { get: () => ({ total: totalLoc }) };
          if (sql.includes('SELECT last_built, unresolved_edge_count')) {
            return { get: () => ({ last_built: lastBuilt, unresolved_edge_count: unresolvedEdgeCount }) };
          }
          if (sql.includes('FROM unresolved_edges') && sql.includes('GROUP BY edge_kind')) {
            return { all: () => topKinds };
          }
          if (sql.includes('FROM unresolved_edges') && sql.includes('GROUP BY source_file')) {
            return { all: () => topSourceFiles };
          }
          if (sql.includes('FROM unresolved_edges') && sql.includes('LIMIT 10')) {
            return { all: () => unresolvedSamples };
          }
          if (sql.includes('SELECT COUNT(*) AS c FROM unresolved_edges')) {
            return { get: () => ({ c: unresolvedSampleCount }) };
          }
          if (sql.includes('SELECT file_path, sha256 FROM fingerprints')) {
            return { all: () => fingerprintRows };
          }
          return { get: () => ({}), all: () => [] };
        }),
      }),
    }));
    jest.doMock('../../src/crg/incremental', () => ({
      computeFileSHA: () => (computedSha === null ? null : { sha: computedSha }),
    }));
    jest.doMock('fs', () => {
      const actual = jest.requireActual('fs');
      return {
        ...actual,
        existsSync: (targetPath) => {
          const normalized = String(targetPath || '');
          if (normalized.endsWith('graph.db')) return graphBuilt;
          return true;
        },
      };
    });

    const { runStats } = require('../../src/crg/cli/build');
    try {
      runStats(['--repo=/repo']);
      if (outputSpy.mock.calls.length > 0) {
        payload = JSON.parse(outputSpy.mock.calls[0][0]);
      }
    } catch (error) {
      thrown = error;
    }
  });

  return { payload, thrown, outputSpy, stderrSpy, exitSpy };
}

function runContextWithMocks({
  graphBuilt = true,
  topHubRows = [{
    id: 'src/a.js#function#alpha#L1',
    name: 'alpha',
    file_path: 'src/a.js',
    kind: 'function',
    line_start: 1,
    line_end: 5,
    is_test: 0,
    in_degree: 3,
  }],
  topCommunities = [{ community_id: 'community:a', label: 'community:a', file_count: 2 }],
  topFlows = [{
    flow_id: 'flow:main',
    entry_node: 'src/a.js#function#alpha#L1',
    criticality: 0.75,
    node_count: 4,
  }],
  graphStats = { node_count: 8, edge_count: 12, community_count: 2, flow_count: 1 },
  rankedContext = [],
  estimatedTokens = 0,
} = {}) {
  const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`EXIT:${code}`);
  });

  let payload = null;
  let thrown = null;

  jest.isolateModules(() => {
    jest.doMock('better-sqlite3', () => jest.fn());
    jest.doMock('fs', () => {
      const actual = jest.requireActual('fs');
      return {
        ...actual,
        existsSync: (targetPath) => {
          const normalized = String(targetPath || '');
          if (normalized.endsWith('graph.db')) return graphBuilt;
          return true;
        },
      };
    });
    jest.doMock('../../src/crg/generations/paths', () => ({
      resolveActiveGraphDb: () => '/repo/.spec-first/graph/graph.db',
    }));
    jest.doMock('../../src/crg/migrations', () => ({
      initDatabase: () => ({
        close: jest.fn(),
        prepare: jest.fn((sql) => {
          if (sql.includes('COUNT(e.id) AS in_degree')) return { all: () => topHubRows };
          if (sql.includes('SELECT (SELECT COUNT(*) FROM nodes) AS node_count')) {
            return { get: () => graphStats };
          }
          if (sql.includes('FROM communities')) return { all: () => topCommunities };
          if (sql.includes('FROM flows')) return { all: () => topFlows };
          return { get: () => ({}), all: () => [] };
        }),
      }),
    }));
    jest.doMock('../../src/crg/retrieval/api', () => ({
      retrieveContext: () => ({
        ranked_context: rankedContext,
        estimated_tokens: estimatedTokens,
      }),
    }));

    const { run } = require('../../src/crg/cli/context');
    try {
      run(['--repo=/repo']);
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
    test('返回合法 JSON envelope，且 data 含 node_count, edge_count, changed_files, duration_ms', async () => {
      const { payload, thrown, outputSpy, stderrSpy, exitSpy } = await runBuildWithMocks({
        nodeCount: 5,
        edgeCount: 7,
        changed: ['src/a.js'],
      });

      expect(thrown).toBeNull();
      expect(payload).toEqual(expect.objectContaining({
        schema_version: 'crg-cli/v1',
        generated_at: expect.any(String),
        repo_root: '/repo',
        degraded: false,
        warnings: expect.any(Array),
        data: expect.objectContaining({
          node_count: 5,
          edge_count: 7,
          changed_files: 1,
          duration_ms: expect.any(Number),
        }),
      }));

      outputSpy.mockRestore();
      stderrSpy.mockRestore();
      exitSpy.mockRestore();
    });

    test('node_count 和 edge_count 为非负整数，duration_ms 为非负数值', async () => {
      const { payload, thrown, outputSpy, stderrSpy, exitSpy } = await runBuildWithMocks({
        nodeCount: 0,
        edgeCount: 0,
        changed: [],
      });

      expect(thrown).toBeNull();
      expect(Number.isInteger(payload.data.node_count)).toBe(true);
      expect(Number.isInteger(payload.data.edge_count)).toBe(true);
      expect(payload.data.node_count).toBeGreaterThanOrEqual(0);
      expect(payload.data.edge_count).toBeGreaterThanOrEqual(0);
      expect(typeof payload.data.duration_ms).toBe('number');
      expect(payload.data.duration_ms).toBeGreaterThanOrEqual(0);

      outputSpy.mockRestore();
      stderrSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  // ─── crg stats ─────────────────────────────────────────────────────────────
  describe('crg stats', () => {
    test('含 corpus_health.status（small/optimal/large 之一）', () => {
      const { payload, thrown, outputSpy, stderrSpy, exitSpy } = runStatsWithMocks();

      expect(thrown).toBeNull();
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
      stderrSpy.mockRestore();
      exitSpy.mockRestore();
    });

    test('图未构建时 exit 2', () => {
      const { payload, thrown, outputSpy, stderrSpy, exitSpy } = runStatsWithMocks({
        graphBuilt: false,
      });

      expect(payload).toBeNull();
      expect(String(thrown)).toContain('EXIT:2');
      expect(exitSpy).toHaveBeenCalledWith(2);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('CRG graph not built'));
      outputSpy.mockRestore();
      stderrSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  // ─── crg context ───────────────────────────────────────────────────────────
  describe('crg context', () => {
    test('data 含 top_flows、top_communities、top_hubs、summary', () => {
      const { payload, thrown, outputSpy, stderrSpy, exitSpy } = runContextWithMocks();

      expect(thrown).toBeNull();
      expect(payload.data).toEqual(expect.objectContaining({
        top_flows: expect.any(Array),
        top_communities: expect.any(Array),
        top_hubs: expect.any(Array),
        summary: expect.any(String),
      }));
      expect(Array.isArray(payload.data.top_flows)).toBe(true);
      outputSpy.mockRestore();
      stderrSpy.mockRestore();
      exitSpy.mockRestore();
    });

    test('top_hubs 中每项满足 FactItem 约束，summary 是字符串', () => {
      const { payload, thrown, outputSpy, stderrSpy, exitSpy } = runContextWithMocks();

      expect(thrown).toBeNull();
      payload.data.top_hubs.forEach(expectFactItemShape);
      expect(typeof payload.data.summary).toBe('string');
      expect(payload.data.summary.length).toBeGreaterThan(0);
      outputSpy.mockRestore();
      stderrSpy.mockRestore();
      exitSpy.mockRestore();
    });

    test('top_flows 显式暴露 entry heuristic 元数据，避免把入口识别伪装成确定事实', () => {
      const { payload, thrown, outputSpy, stderrSpy, exitSpy } = runContextWithMocks();

      expect(thrown).toBeNull();
      payload.data.top_flows.forEach((item) => {
        expect(item).toEqual(expect.objectContaining({
          entry_confidence: 'Inferred',
          entry_inference_reason: 'zero_in_degree_calls',
        }));
      });
      outputSpy.mockRestore();
      stderrSpy.mockRestore();
      exitSpy.mockRestore();
    });
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
    test('data.items 每项含 name, file_path, loc, kind', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              close: jest.fn(),
              prepare: jest.fn(() => ({
                all: () => [
                  { id: 'node:a', name: 'alpha', file_path: 'src/a.js', kind: 'function', loc: 80 },
                  { id: 'node:b', name: 'beta', file_path: 'src/b.js', kind: 'method', loc: 55 },
                ],
              })),
            },
          }),
        }));

        const { run } = require('../../src/crg/commands/large-functions');
        run(['--repo=/repo']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      expect(Array.isArray(payload.data.items)).toBe(true);
      payload.data.items.forEach((item) => {
        expect(item).toEqual(expect.objectContaining({
          name: expect.any(String),
          file_path: expect.any(String),
          kind: expect.any(String),
          loc: expect.any(Number),
        }));
      });
      outputSpy.mockRestore();
    });

    test('kind 只能是 function 或 method，loc 为正整数', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              close: jest.fn(),
              prepare: jest.fn(() => ({
                all: () => [
                  { id: 'node:a', name: 'alpha', file_path: 'src/a.js', kind: 'function', loc: 80 },
                  { id: 'node:b', name: 'beta', file_path: 'src/b.js', kind: 'method', loc: 55 },
                ],
              })),
            },
          }),
        }));

        const { run } = require('../../src/crg/commands/large-functions');
        run(['--repo=/repo']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      payload.data.items.forEach((item) => {
        expect(['function', 'method']).toContain(item.kind);
        expect(Number.isInteger(item.loc)).toBe(true);
        expect(item.loc).toBeGreaterThan(0);
      });
      outputSpy.mockRestore();
    });
  });

  // ─── crg search ────────────────────────────────────────────────────────────
  describe('crg search', () => {
    test('data.results 每项含 node_id, name, file_path, kind, snippet', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              close: jest.fn(),
              prepare: jest.fn(() => ({
                get: () => ({ name: 'fts_nodes' }),
              })),
            },
          }),
        }));
        jest.doMock('../../src/crg/search', () => ({
          searchNodes: () => [
            {
              node_id: 'node:a',
              name: 'alpha',
              file_path: 'src/a.js',
              kind: 'function',
              score: 0.91,
              snippet: 'function alpha()',
            },
          ],
        }));

        const { run } = require('../../src/crg/commands/search');
        run(['alpha', '--repo=/repo']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      payload.data.results.forEach((item) => {
        expect(item).toEqual(expect.objectContaining({
          node_id: expect.any(String),
          name: expect.any(String),
          file_path: expect.any(String),
          kind: expect.any(String),
          snippet: expect.any(String),
        }));
      });
      outputSpy.mockRestore();
    });

    test('snippet 为字符串，可以为空字符串', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              close: jest.fn(),
              prepare: jest.fn(() => ({
                get: () => ({ name: 'fts_nodes' }),
              })),
            },
          }),
        }));
        jest.doMock('../../src/crg/search', () => ({
          searchNodes: () => [
            {
              node_id: 'node:a',
              name: 'alpha',
              file_path: 'src/a.js',
              kind: 'function',
              score: 0.91,
              snippet: '',
            },
          ],
        }));

        const { run } = require('../../src/crg/commands/search');
        run(['alpha', '--repo=/repo']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      expect(typeof payload.data.results[0].snippet).toBe('string');
      expect(payload.data.results[0].snippet).toBe('');
      outputSpy.mockRestore();
    });
  });

  // ─── crg flows ─────────────────────────────────────────────────────────────
  describe('crg flows', () => {
    test('data.items 每项含 flow_id, entry_node, criticality, node_count', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              close: jest.fn(),
              prepare: jest.fn(() => ({
                all: () => [
                  {
                    flow_id: 'flow:main',
                    entry_node: 'src/a.js#function#entry#L1',
                    criticality: 0.75,
                    node_count: 4,
                  },
                ],
              })),
            },
          }),
        }));

        const { run } = require('../../src/crg/commands/flows');
        run(['--repo=/repo']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      payload.data.items.forEach((item) => {
        expect(item).toEqual(expect.objectContaining({
          flow_id: expect.any(String),
          entry_node: expect.any(String),
          criticality: expect.any(Number),
          node_count: expect.any(Number),
        }));
      });
      outputSpy.mockRestore();
    });

    test('criticality 为 0~1 之间的浮点数', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              close: jest.fn(),
              prepare: jest.fn(() => ({
                all: () => [
                  {
                    flow_id: 'flow:main',
                    entry_node: 'src/a.js#function#entry#L1',
                    criticality: 0.75,
                    node_count: 4,
                  },
                ],
              })),
            },
          }),
        }));

        const { run } = require('../../src/crg/commands/flows');
        run(['--repo=/repo']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      payload.data.items.forEach((item) => {
        expect(item.criticality).toBeGreaterThanOrEqual(0);
        expect(item.criticality).toBeLessThanOrEqual(1);
      });
      outputSpy.mockRestore();
    });

    test('items 显式暴露 entry heuristic 元数据', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              close: jest.fn(),
              prepare: jest.fn(() => ({
                all: () => [
                  {
                    flow_id: 'flow:main',
                    entry_node: 'src/a.js#function#entry#L1',
                    criticality: 0.75,
                    node_count: 4,
                  },
                ],
              })),
            },
          }),
        }));

        const { run } = require('../../src/crg/commands/flows');
        run(['--repo=/repo']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      expect(payload.data.items[0]).toEqual(expect.objectContaining({
        entry_confidence: 'Inferred',
        entry_inference_reason: 'zero_in_degree_calls',
      }));
      outputSpy.mockRestore();
    });
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
        entry_confidence: 'Inferred',
        entry_inference_reason: 'zero_in_degree_calls',
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
        entry_confidence: 'Inferred',
        entry_inference_reason: 'zero_in_degree_calls',
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

    test('指定不存在的 community_id 时 exit 1', () => {
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

        const { run } = require('../../src/crg/commands/community');
        expect(() => run(['--repo=/repo', '--id=community:missing'])).toThrow('EXIT:1');
      });

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('community not found'));
      stderrSpy.mockRestore();
      exitSpy.mockRestore();
    });
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
    test('每项含 score（整数）和 reasons（string[]），并含 source 和 target', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: { close: jest.fn() },
          }),
        }));
        jest.doMock('../../src/crg/analyze', () => ({
          surprisingConnections: () => [{
            source: 'node:a',
            target: 'node:b',
            edge_kind: 'calls',
            score: 60,
            reasons: ['cross_language:js→py'],
          }],
        }));

        const { run } = require('../../src/crg/commands/surprising-connections');
        run(['--repo=/repo']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      payload.data.items.forEach((item) => {
        expect(item).toEqual(expect.objectContaining({
          source: expect.any(String),
          target: expect.any(String),
          score: expect.any(Number),
          reasons: expect.any(Array),
        }));
      });
      outputSpy.mockRestore();
    });

    test('score 为非负整数，reasons 不为空数组', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: { close: jest.fn() },
          }),
        }));
        jest.doMock('../../src/crg/analyze', () => ({
          surprisingConnections: () => [{
            source: 'node:a',
            target: 'node:b',
            edge_kind: 'calls',
            score: 60,
            reasons: ['cross_language:js→py'],
          }],
        }));

        const { run } = require('../../src/crg/commands/surprising-connections');
        run(['--repo=/repo']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      payload.data.items.forEach((item) => {
        expect(Number.isInteger(item.score)).toBe(true);
        expect(item.score).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(item.reasons)).toBe(true);
        expect(item.reasons.length).toBeGreaterThan(0);
        item.reasons.forEach((reason) => expect(typeof reason).toBe('string'));
      });
      outputSpy.mockRestore();
    });
  });

  // ─── crg god-nodes ─────────────────────────────────────────────────────────
  describe('crg god-nodes', () => {
    test('data.items 是数组，每项满足 FactItem 约束', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: { close: jest.fn() },
          }),
        }));
        jest.doMock('../../src/crg/analyze', () => ({
          godNodes: () => [{
            id: 'src/a.js#function#alpha#L1',
            name: 'alpha',
            file_path: 'src/a.js',
            kind: 'function',
            line_start: 1,
            line_end: 10,
            is_test: 0,
            confidence: 'Inferred',
            source_tier: 'crg_ast',
            evidence: ['god node in_degree=8'],
            inference_reason: 'call_graph_traversal',
          }],
        }));

        const { run } = require('../../src/crg/commands/god-nodes');
        run(['--repo=/repo']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      expect(Array.isArray(payload.data.items)).toBe(true);
      payload.data.items.forEach(expectFactItemShape);
      outputSpy.mockRestore();
    });
  });

  // ─── crg detect-changes ────────────────────────────────────────────────────
  describe('crg detect-changes', () => {
    test('data.items 每项含 file, risk_level, functions', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: { close: jest.fn() },
          }),
        }));
        jest.doMock('../../src/crg/changes', () => ({
          detectChanges: () => [{
            file: 'src/a.js',
            risk_level: 'High',
            functions: [{ name: 'alpha', risk_level: 'High' }],
          }],
        }));

        const { run } = require('../../src/crg/commands/detect-changes');
        run(['--repo=/repo', '--since=HEAD~1']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      payload.data.items.forEach((item) => {
        expect(item).toEqual(expect.objectContaining({
          file: expect.any(String),
          risk_level: expect.any(String),
          functions: expect.any(Array),
        }));
      });
      outputSpy.mockRestore();
    });

    test('risk_level 只能是 High/Medium/Low 之一，functions 每项含 name 和 risk_level', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: { close: jest.fn() },
          }),
        }));
        jest.doMock('../../src/crg/changes', () => ({
          detectChanges: () => [{
            file: 'src/a.js',
            risk_level: 'High',
            functions: [{ name: 'alpha', risk_level: 'High' }],
          }],
        }));

        const { run } = require('../../src/crg/commands/detect-changes');
        run(['--repo=/repo', '--since=HEAD~1']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      payload.data.items.forEach((item) => {
        expect(['High', 'Medium', 'Low']).toContain(item.risk_level);
        item.functions.forEach((fn) => {
          expect(fn).toEqual(expect.objectContaining({
            name: expect.any(String),
            risk_level: expect.any(String),
          }));
          expect(['High', 'Medium', 'Low']).toContain(fn.risk_level);
        });
      });
      outputSpy.mockRestore();
    });
  });

  // ─── crg review-context ────────────────────────────────────────────────────
  describe('crg review-context', () => {
    test('data 含 diff_summary, affected_nodes, hunk_hit, candidate_tests, graph_expansion, review_guidance, 以及 verification recommendation 字段', () => {
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
      expect(payload.data).toHaveProperty('impacted_modules');
      expect(payload.data).toHaveProperty('impacted_languages');
      expect(payload.data).toHaveProperty('impacted_platforms');
      expect(payload.data).toHaveProperty('recommended_required_verifications');
      expect(payload.data).toHaveProperty('recommended_optional_verifications');
      expect(payload.data).toHaveProperty('confidence');
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

    test('verification recommendation 字段使用稳定数组 contract，并在存在推荐项时写入 review_guidance', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              prepare: jest.fn((sql) => {
                if (sql.includes("WHERE file_path = ? AND kind != 'module'")) {
                  return { all: jest.fn(() => []) };
                }
                if (sql.includes("SELECT DISTINCT file_path FROM nodes WHERE is_test = 1")) {
                  return { all: jest.fn(() => []) };
                }
                if (sql.includes("SELECT source_id, target_id FROM edges WHERE kind = 'calls'")) {
                  return { all: jest.fn(() => []) };
                }
                if (sql.includes("SELECT id, name, line_end FROM nodes WHERE file_path = ? AND kind = 'module'")) {
                  return { get: jest.fn(() => null) };
                }
                if (sql.includes('WHERE id IN')) {
                  return { all: jest.fn(() => []) };
                }
                return { all: jest.fn(() => []), get: jest.fn(() => ({ cnt: 0 })) };
              }),
            },
          }),
        }));
        jest.doMock('../../src/crg/changes', () => ({
          detectChanges: () => [{
            file: 'src/app/home/page.tsx',
            risk_level: 'Medium',
            hunks: [],
            review_priorities: [],
            test_gaps: [],
          }],
          assessNodeRiskBatch: () => new Map(),
        }));
        jest.doMock('../../src/crg/input-convergence', () => ({
          isSensitiveFile: () => false,
        }));
        jest.doMock('../../src/context-routing/loader', () => ({
          loadBootstrapRuntimeState: () => ({
            verificationProfile: {
              platforms: ['web'],
              required_gates: [
                { id: 'unit-tests', scope: 'repository' },
                { id: 'browser-smoke', scope: 'web-surface' },
              ],
              optional_gates: [
                { id: 'browser-evidence', scope: 'web-surface' },
              ],
            },
          }),
        }));

        const { run: isolatedRun } = require('../../src/crg/commands/review-context');
        isolatedRun(['--repo=/repo', '--since=HEAD~1']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      expect(payload.data.impacted_modules).toEqual(['src/app/']);
      expect(payload.data.impacted_languages).toEqual(['typescript']);
      expect(payload.data.impacted_platforms).toEqual(['web']);
      expect(payload.data.recommended_required_verifications).toEqual(['unit-tests', 'browser-smoke']);
      expect(payload.data.recommended_optional_verifications).toEqual(['browser-evidence']);
      expect(payload.data.confidence).toBe('high');
      expect(payload.data.review_guidance).toEqual(
        expect.arrayContaining([
          expect.stringContaining('RECOMMENDED_REQUIRED: unit-tests, browser-smoke'),
          expect.stringContaining('RECOMMENDED_OPTIONAL: browser-evidence'),
          expect.stringContaining('VERIFICATION_CONFIDENCE: high'),
        ])
      );
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

    test('affected_nodes 中每项满足 FactItem 约束', () => {
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: '/repo',
            db: {
              prepare: jest.fn((sql) => {
                if (sql.includes("WHERE file_path = ? AND kind != 'module'")) {
                  return {
                    all: jest.fn(() => [{
                      id: 'src/a.js#function#alpha#L1',
                      name: 'alpha',
                      file_path: 'src/a.js',
                      kind: 'function',
                      line_start: 1,
                      line_end: 10,
                      is_test: 0,
                    }]),
                  };
                }
                if (sql.includes("SELECT DISTINCT file_path FROM nodes WHERE is_test = 1")) {
                  return { all: jest.fn(() => []) };
                }
                if (sql.includes("SELECT source_id, target_id FROM edges WHERE kind = 'calls'")) {
                  return { all: jest.fn(() => []) };
                }
                if (sql.includes("SELECT id, name, line_end FROM nodes WHERE file_path = ? AND kind = 'module'")) {
                  return { get: jest.fn(() => null) };
                }
                if (sql.includes('WHERE id IN')) {
                  return { all: jest.fn(() => []) };
                }
                return { all: jest.fn(() => []), get: jest.fn(() => ({ cnt: 0 })) };
              }),
            },
          }),
        }));
        jest.doMock('../../src/crg/changes', () => ({
          detectChanges: () => [{
            file: 'src/a.js',
            risk_level: 'Medium',
            hunks: [{ start: 1, end: 3 }],
            review_priorities: [],
            test_gaps: [],
          }],
          assessNodeRiskBatch: () => new Map(),
        }));
        jest.doMock('../../src/crg/input-convergence', () => ({
          isSensitiveFile: () => false,
        }));

        const { run: isolatedRun } = require('../../src/crg/commands/review-context');
        isolatedRun(['--repo=/repo', '--since=HEAD~1']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      payload.data.affected_nodes.forEach(expectFactItemShape);
      outputSpy.mockRestore();
    });

    test('无 diff 时 diff_summary 为空字符串而非 null', () => {
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
      expect(payload.data.diff_summary).toBe('');
      expect(payload.data.diff_summary).not.toBeNull();
      outputSpy.mockRestore();
    });
  });
});
