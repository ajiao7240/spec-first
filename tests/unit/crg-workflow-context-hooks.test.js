'use strict';

describe('crg workflow-context and hooks', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  test('workflow-context returns direct-read fallback without opening graph db when graph is missing', () => {
    const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    jest.isolateModules(() => {
      jest.doMock('fs', () => {
        const actual = jest.requireActual('fs');
        return {
          ...actual,
          existsSync: (targetPath) => !String(targetPath).endsWith('graph.db'),
        };
      });

      const { run } = require('../../src/crg/commands/workflow-context');
      run(['--repo=/repo', '--stage=plan', '--task=change cli']);
    });

    const payload = JSON.parse(outputSpy.mock.calls[0][0]);
    expect(payload.data.stage).toBe('plan');
    expect(payload.data.graph_status.state).toBe('missing');
    expect(payload.data.fallback.mode).toBe('direct_repo_reads');
    expect(payload.data.fallback.suggested_reads).not.toContain('docs/contexts');
  });

  test('hook before-plan wraps workflow-context and keeps LLM decision boundary explicit', () => {
    const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    jest.isolateModules(() => {
      jest.doMock('../../src/crg/workflow-context/stage', () => ({
        buildWorkflowContext: () => ({
          stage: 'plan',
          graph_status: { state: 'ready' },
          recommended_queries: [],
        }),
      }));

      const { run } = require('../../src/crg/commands/hook');
      run(['before-plan', '--repo=/repo', '--task=add locate']);
    });

    const payload = JSON.parse(outputSpy.mock.calls[0][0]);
    expect(payload.data.hook_id).toBe('before_plan');
    expect(payload.data.candidate_surface_policy).toContain('LLM selects');
  });

  test('workflow-context includes repo-local topology as advisory decision input when available', () => {
    jest.dontMock('../../src/crg/workflow-context/stage');
    jest.isolateModules(() => {
      jest.doMock('../../src/crg/workflow-context/status', () => ({
        buildGraphStatus: () => ({
          state: 'ready',
          limitations: [],
        }),
      }));
      jest.doMock('../../src/crg/workflow-context/navigation', () => ({
        readCodeNavigation: () => ({
          source: 'artifact',
          limitations: [],
        }),
        buildRecommendedQueries: () => [],
      }));
      jest.doMock('../../src/crg/topology/modules', () => ({
        readRepoTopology: () => ({
          source: 'artifact',
          kind: 'monorepo_multi_module',
          units: [{ id: 'maven:service-a', path: 'service-a' }],
          limitations: [],
        }),
      }));

      const { buildWorkflowContext } = require('../../src/crg/workflow-context/stage');
      const context = buildWorkflowContext({ repoRoot: '/repo', stage: 'plan' });

      expect(context.repo_topology.kind).toBe('monorepo_multi_module');
      expect(context.decision_inputs).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: 'repo_topology',
          decision_input_kind: 'observed',
        }),
      ]));
    });
  });
});
