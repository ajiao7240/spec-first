'use strict';

describe('crg build unresolved consistency', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  test('0 变更增量 build 会回读持久化 unresolved 摘要而不是写出内存中的 0', async () => {
    const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    jest.isolateModules(() => {
      jest.doMock('better-sqlite3', () => jest.fn());
      jest.doMock('fs', () => {
        const actual = jest.requireActual('fs');
        return {
          ...actual,
          statSync: () => ({ isDirectory: () => true }),
          existsSync: () => true,
          mkdirSync: jest.fn(),
          copyFileSync: jest.fn(),
          writeFileSync: jest.fn(),
          readdirSync: () => [],
        };
      });
      jest.doMock('../../src/crg/artifact-paths', () => ({
        resolveGraphDir: () => '/repo/.spec-first/graph',
        resolveGraphDb: () => '/repo/.spec-first/graph/graph.db',
        resolveGraphInputFingerprints: () => '/repo/.spec-first/graph/input-fingerprints.json',
        resolveRepoTopology: () => '/repo/.spec-first/graph/repo-topology.json',
      }));
      jest.doMock('../../src/crg/generations/paths', () => ({
        buildGenerationId: () => 'gen-1',
        resolveActiveGraphDb: () => '/repo/.spec-first/graph/graph.db',
        resolveGenerationDb: () => '/repo/.spec-first/graph/generations/gen-1/graph.db',
        resolveGenerationDir: () => '/repo/.spec-first/graph/generations/gen-1',
      }));
      jest.doMock('../../src/crg/migrations', () => ({
        initDatabase: () => ({
          close: jest.fn(),
          prepare: jest.fn((sql) => {
            if (sql.includes('SELECT file_path FROM nodes')) return { all: () => [] };
            if (sql.includes('SELECT COUNT(*) as c FROM nodes')) return { get: () => ({ c: 5 }) };
            if (sql.includes('SELECT COUNT(*) as c FROM edges')) return { get: () => ({ c: 8 }) };
            if (sql.includes('UPDATE graph_meta SET last_built')) return { run: jest.fn() };
            if (sql.includes('FROM graph_meta WHERE id = 1')) {
              return { get: () => ({ unresolved_edge_count: 3 }) };
            }
            if (sql.includes('FROM unresolved_edges') && sql.includes('GROUP BY edge_kind')) {
              return { all: () => [{ kind: 'calls', count: 2 }, { kind: 'imports_from', count: 1 }] };
            }
            if (sql.includes('FROM unresolved_edges') && sql.includes('GROUP BY source_file')) {
              return { all: () => [{ file_path: 'src/a.js', count: 2 }, { file_path: 'src/b.js', count: 1 }] };
            }
            if (sql.includes('FROM unresolved_edges') && sql.includes('LIMIT 10')) {
              return {
                all: () => [
                  {
                    source_id: 'src/a.js#function#foo#L1',
                    source_file: 'src/a.js',
                    edge_kind: 'calls',
                    target_name: 'missingA',
                    target_path_raw: null,
                  },
                  {
                    source_id: 'src/b.js#function#bar#L1',
                    source_file: 'src/b.js',
                    edge_kind: 'imports_from',
                    target_name: null,
                    target_path_raw: './missing-b',
                  },
                ],
              };
            }
            if (sql.includes('SELECT COUNT(*) AS c FROM unresolved_edges')) {
              return { get: () => ({ c: 3 }) };
            }
            return { get: () => ({}), all: () => [], run: jest.fn() };
          }),
        }),
      }));
      jest.doMock('../../src/crg/input-convergence', () => ({
        collectInputFiles: async () => ({
          finalInputs: ['src/index.js'],
          stats: { ignored_files_by_rule: {} },
        }),
      }));
      jest.doMock('../../src/crg/parser', () => ({
        parseFile: jest.fn(),
        buildChunksForNodes: jest.fn(() => []),
      }));
      jest.doMock('../../src/crg/incremental', () => ({
        detectChangedFiles: () => ({
          changed: [],
          deleted: [],
          changedShas: new Map(),
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
        assessGenerationHealth: () => ({ healthy: true }),
      }));
      jest.doMock('../../src/crg/generations/promote', () => ({
        promoteGeneration: jest.fn(),
      }));

      const { run } = require('../../src/crg/cli/build');
      run(['--repo=/repo']);
    });

    await new Promise((resolve) => setImmediate(resolve));

    const payload = JSON.parse(outputSpy.mock.calls[0][0]);
    expect(payload.data.unresolved_edge_count).toBe(3);
    expect(payload.data.last_build_unresolved_edge_count).toBe(3);
    expect(payload.data.last_build_unresolved_summary).toEqual({
      top_kinds: [{ kind: 'calls', count: 2 }, { kind: 'imports_from', count: 1 }],
      top_source_files: [{ file_path: 'src/a.js', count: 2 }, { file_path: 'src/b.js', count: 1 }],
      sample_count: 3,
    });
    expect(payload.data.last_build_unresolved_samples).toEqual([
      {
        source_id: 'src/a.js#function#foo#L1',
        source_file: 'src/a.js',
        edge_kind: 'calls',
        target_name: 'missingA',
        target_path_raw: null,
      },
      {
        source_id: 'src/b.js#function#bar#L1',
        source_file: 'src/b.js',
        edge_kind: 'imports_from',
        target_name: null,
        target_path_raw: './missing-b',
      },
    ]);
    outputSpy.mockRestore();
  });
});
