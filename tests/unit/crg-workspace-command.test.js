'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function makeTempWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-workspace-cmd-'));
}

function makeGitRepo(repoRoot) {
  fs.mkdirSync(repoRoot, { recursive: true });
  execFileSync('git', ['init', '-q', repoRoot], { stdio: 'ignore' });
}

describe('crg workspace command', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  test('scan/status/context return crg-cli/v1 envelopes', () => {
    const root = makeTempWorkspace();
    makeGitRepo(path.join(root, 'repo-a'));
    const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const { run } = require('../../src/crg/commands/workspace');
    run(['scan', `--root=${root}`]);
    run(['status', `--root=${root}`]);
    run(['context', `--root=${root}`, '--task=change repo-a']);

    const payloads = outputSpy.mock.calls.map((call) => JSON.parse(call[0]));
    const childRoot = fs.realpathSync.native(path.join(root, 'repo-a'));
    expect(payloads.map((payload) => payload.schema_version)).toEqual([
      'crg-cli/v1',
      'crg-cli/v1',
      'crg-cli/v1',
    ]);
    expect(payloads[0].data.children[0].slug).toBe('repo-a');
    expect(payloads[1].data.children[0].readiness).toBe('missing');
    expect(payloads[2].data.candidates[0].recommended_commands.join('\n')).toContain(`--repo=${childRoot}`);
    expect(JSON.stringify(payloads[2])).not.toContain('selected_repo');
  });

  test('build requires one explicit child repo and rejects --all', () => {
    const root = makeTempWorkspace();
    makeGitRepo(path.join(root, 'repo-a'));
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`EXIT:${code}`);
    });

    const { run } = require('../../src/crg/commands/workspace');

    expect(() => run(['build', `--root=${root}`])).toThrow('EXIT:1');
    expect(() => run(['build', `--root=${root}`, '--repo=--all'])).toThrow('EXIT:1');
    expect(stderrSpy.mock.calls.map((call) => call[0]).join('\n')).toContain('requires --repo');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('build invokes repo-local crg build for the selected child slug only', () => {
    const root = makeTempWorkspace();
    const childRootRaw = path.join(root, 'repo-a');
    makeGitRepo(childRootRaw);
    const childRoot = fs.realpathSync.native(childRootRaw);
    const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const spawnSync = jest.fn(() => ({
      status: 0,
      stdout: JSON.stringify({
        schema_version: 'crg-cli/v1',
        degraded: true,
        warnings: [{ type: 'parse_error_files', count: 1 }],
        data: {
          generation_id: 'gen-1',
          node_count: 1,
          edge_count: 0,
        },
      }, null, 2),
      stderr: '',
    }));

    jest.isolateModules(() => {
      const actualChildProcess = jest.requireActual('node:child_process');
      jest.doMock('node:child_process', () => ({
        ...actualChildProcess,
        spawnSync,
      }));
      const { run } = require('../../src/crg/commands/workspace');
      run(['build', `--root=${root}`, '--repo=repo-a', '--force']);
    });

    expect(spawnSync).toHaveBeenCalledTimes(1);
    expect(spawnSync.mock.calls[0][1]).toEqual(expect.arrayContaining([
      'crg',
      'build',
      `--repo=${childRoot}`,
      '--force',
    ]));
    const payload = JSON.parse(outputSpy.mock.calls[0][0]);
    expect(payload.degraded).toBe(true);
    expect(payload.warnings[0]).toEqual(expect.objectContaining({
      type: 'child_build_warning',
      child_slug: 'repo-a',
    }));
    expect(payload.data.built_child.repo_root).toBe(childRoot);
    expect(payload.data.child_build_exit_code).toBe(0);
    expect(payload.data.child_build.schema_version).toBe('crg-cli/v1');
    expect(payload.data.child_build.data.generation_id).toBe('gen-1');
    expect(fs.existsSync(path.join(root, '.spec-first', 'graph', 'graph.db'))).toBe(false);
  });

  test('router does not pre-validate workspace --repo slug as a filesystem path', () => {
    const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    jest.isolateModules(() => {
      jest.doMock('../../src/crg/commands/workspace', () => ({
        run: jest.fn((argv) => {
          process.stdout.write(JSON.stringify({ argv }) + '\n');
        }),
      }));

      const { run } = require('../../src/crg/cli/router');
      run(['workspace', 'context', '--repo=repo-a']);
    });

    const payload = JSON.parse(outputSpy.mock.calls[0][0]);
    expect(payload.argv).toEqual(['context', '--repo=repo-a']);
  });
});
