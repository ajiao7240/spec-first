'use strict';

describe('crg generation-aware build', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('正常 build 产生新 generation 并 promote 为 current', async () => {
    const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const copyFileSync = jest.fn();
    const writeFileSync = jest.fn();

    jest.isolateModules(() => {
      jest.doMock('better-sqlite3', () => jest.fn());
      jest.doMock('fs', () => {
        const actual = jest.requireActual('fs');
        return {
          ...actual,
          statSync: () => ({ isDirectory: () => true }),
          existsSync: (targetPath) => targetPath === '/repo/.spec-first/graph/graph.db',
          mkdirSync: jest.fn(),
          copyFileSync,
          writeFileSync,
        };
      });
      jest.doMock('../../src/crg/generations/paths', () => ({
        buildGenerationId: () => '20260415160000',
        resolveActiveGraphDb: () => '/repo/.spec-first/graph/graph.db',
        resolveGenerationDir: () => '/repo/.spec-first/graph/generations/20260415160000',
        resolveGenerationDb: () => '/repo/.spec-first/graph/generations/20260415160000/graph.db',
        writeGraphPointer: jest.fn(),
      }));
      jest.doMock('../../src/crg/migrations', () => ({
        initDatabase: () => ({
          close: jest.fn(),
          prepare: jest.fn((sql) => {
            if (sql.includes('SELECT file_path FROM nodes')) return { all: () => [] };
            if (sql.includes('SELECT COUNT(*) as c FROM nodes')) return { get: () => ({ c: 1 }) };
            if (sql.includes('SELECT COUNT(*) as c FROM edges')) return { get: () => ({ c: 0 }) };
            if (sql.includes('SELECT COUNT(*) AS count FROM communities')) return { get: () => ({ count: 7 }) };
            if (sql.includes('SELECT COUNT(*) AS count FROM flows')) return { get: () => ({ count: 9 }) };
            if (sql.includes('FROM communities')) {
              return {
                all: () => [1, 2, 3, 4, 5].map((index) => ({
                  community_id: `c${index}`,
                  label: `community ${index}`,
                  file_count: index,
                })),
              };
            }
            if (sql.includes('FROM flows')) {
              return {
                all: () => [1, 2, 3, 4, 5].map((index) => ({
                  flow_id: `f${index}`,
                  entry_node: `n${index}`,
                  name: `flow ${index}`,
                  criticality: index,
                  node_count: index,
                })),
              };
            }
            if (sql.includes('UPDATE graph_meta SET last_built')) return { run: jest.fn() };
            return { get: () => ({}), all: () => [], run: jest.fn() };
          }),
        }),
      }));
      jest.doMock('../../src/crg/input-convergence', () => ({
        collectInputFiles: async () => ({ finalInputs: [], stats: { ignored_files_by_rule: {} } }),
      }));
      jest.doMock('../../src/crg/parser', () => ({
        parseFile: () => ({ nodes: [], rawEdges: [], skipped: false }),
      }));
      jest.doMock('../../src/crg/incremental', () => ({
        detectChangedFiles: () => ({ changed: [], deleted: [], changedShas: new Map() }),
        updateFingerprints: jest.fn(),
      }));
      jest.doMock('../../src/crg/graph', () => ({
        upsertNodes: jest.fn(),
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
        assessGenerationHealth: () => ({
          healthy: true,
          reason: null,
          node_count: 1,
          edge_count: 0,
        }),
      }));
      const promoteGeneration = jest.fn();
      jest.doMock('../../src/crg/generations/promote', () => ({
        promoteGeneration,
      }));

      const { run } = require('../../src/crg/cli/build');
      run(['--repo=/repo', '--force']);
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(copyFileSync).toHaveBeenCalledWith(
      '/repo/.spec-first/graph/graph.db',
      '/repo/.spec-first/graph/generations/20260415160000/graph.db'
    );
    const statusWrite = writeFileSync.mock.calls.find(([filePath]) => (
      String(filePath).endsWith('/.spec-first/graph/graph-index-status.json')
    ));
    const navigationWrite = writeFileSync.mock.calls.find(([filePath]) => (
      String(filePath).endsWith('/.spec-first/graph/code-navigation.json')
    ));
    expect(statusWrite).toBeTruthy();
    expect(navigationWrite).toBeTruthy();

    const status = JSON.parse(statusWrite[1]);
    expect(status.stats.community_count).toBe(7);
    expect(status.stats.flow_count).toBe(9);

    const navigation = JSON.parse(navigationWrite[1]);
    expect(navigation.query_starters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        command: expect.stringContaining('--repo=<repo>'),
      }),
    ]));
    outputSpy.mockRestore();
  });

  test('health check 失败时不 promote current generation', async () => {
    const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const promoteGeneration = jest.fn();

    jest.isolateModules(() => {
      jest.doMock('better-sqlite3', () => jest.fn());
      jest.doMock('fs', () => {
        const actual = jest.requireActual('fs');
        return {
          ...actual,
          statSync: () => ({ isDirectory: () => true }),
          existsSync: () => false,
          mkdirSync: jest.fn(),
          copyFileSync: jest.fn(),
          writeFileSync: jest.fn(),
        };
      });
      jest.doMock('../../src/crg/generations/paths', () => ({
        buildGenerationId: () => '20260415160001',
        resolveActiveGraphDb: () => '/repo/.spec-first/graph/graph.db',
        resolveGenerationDir: () => '/repo/.spec-first/graph/generations/20260415160001',
        resolveGenerationDb: () => '/repo/.spec-first/graph/generations/20260415160001/graph.db',
        writeGraphPointer: jest.fn(),
      }));
      jest.doMock('../../src/crg/migrations', () => ({
        initDatabase: () => ({
          close: jest.fn(),
          prepare: jest.fn((sql) => {
            if (sql.includes('SELECT file_path FROM nodes')) return { all: () => [] };
            if (sql.includes('SELECT COUNT(*) as c FROM nodes')) return { get: () => ({ c: 0 }) };
            if (sql.includes('SELECT COUNT(*) as c FROM edges')) return { get: () => ({ c: 0 }) };
            if (sql.includes('UPDATE graph_meta SET last_built')) return { run: jest.fn() };
            return { get: () => ({}), all: () => [], run: jest.fn() };
          }),
        }),
      }));
      jest.doMock('../../src/crg/input-convergence', () => ({
        collectInputFiles: async () => ({ finalInputs: [], stats: { ignored_files_by_rule: {} } }),
      }));
      jest.doMock('../../src/crg/parser', () => ({
        parseFile: () => ({ nodes: [], rawEdges: [], skipped: false }),
      }));
      jest.doMock('../../src/crg/incremental', () => ({
        detectChangedFiles: () => ({ changed: [], deleted: [], changedShas: new Map() }),
        updateFingerprints: jest.fn(),
      }));
      jest.doMock('../../src/crg/graph', () => ({
        upsertNodes: jest.fn(),
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
        assessGenerationHealth: () => ({
          healthy: false,
          reason: 'empty_graph',
          node_count: 0,
          edge_count: 0,
        }),
      }));
      jest.doMock('../../src/crg/generations/promote', () => ({
        promoteGeneration,
      }));

      const { run } = require('../../src/crg/cli/build');
      run(['--repo=/repo', '--force']);
    });

    await new Promise((resolve) => setImmediate(resolve));

    const envelope = JSON.parse(outputSpy.mock.calls[0][0]);
    expect(promoteGeneration).not.toHaveBeenCalled();
    expect(envelope.data.generation_id).toBe('20260415160001');
    outputSpy.mockRestore();
  });
});
