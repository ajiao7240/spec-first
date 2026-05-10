'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'npm-install-matrix-smoke.js');
const WORKFLOW_PATH = path.join(REPO_ROOT, '.github', 'workflows', 'npm-install-matrix.yml');

const {
  buildCmdCommandLine,
  createArtifactWriter,
  getEnvValue,
  normalizeArtifactFileName,
  resolveNpmCliPath,
} = require('../../scripts/npm-install-matrix-smoke');

describe('npm install matrix smoke script', () => {
  test('reads Windows-style environment keys case-insensitively', () => {
    expect(getEnvValue({ COMSPEC: 'C:\\Windows\\System32\\cmd.exe' }, 'ComSpec')).toBe('C:\\Windows\\System32\\cmd.exe');
    expect(getEnvValue({ NPM_EXECPATH: 'C:\\npm\\bin\\npm-cli.js' }, 'npm_execpath')).toBe('C:\\npm\\bin\\npm-cli.js');
  });

  test('resolves npm CLI JavaScript entrypoint without shelling out to npm.cmd', () => {
    const existing = new Set([
      '/opt/node/lib/node_modules/npm/bin/npm-cli.js',
      'C:\\hostedtoolcache\\node\\20\\x64\\node_modules\\npm\\bin\\npm-cli.js',
      'C:\\npm\\bin\\npm-cli.js',
    ]);
    const existsSync = (candidate) => existing.has(candidate);

    expect(resolveNpmCliPath({
      env: {},
      execPath: '/opt/node/bin/node',
      existsSync,
    })).toBe('/opt/node/lib/node_modules/npm/bin/npm-cli.js');

    expect(resolveNpmCliPath({
      env: {},
      execPath: 'C:\\hostedtoolcache\\node\\20\\x64\\node.exe',
      existsSync,
    })).toBe('C:\\hostedtoolcache\\node\\20\\x64\\node_modules\\npm\\bin\\npm-cli.js');

    expect(resolveNpmCliPath({
      env: { NPM_EXECPATH: 'C:\\npm\\bin\\npm-cli.js' },
      execPath: 'C:\\hostedtoolcache\\node\\20\\x64\\node.exe',
      existsSync,
    })).toBe('C:\\npm\\bin\\npm-cli.js');
  });

  test('quotes Windows cmd shim path with spaces as one command line', () => {
    expect(buildCmdCommandLine('C:\\Temp\\prefix with spaces\\spec-first.cmd', ['--help'])).toBe('"C:\\Temp\\prefix with spaces\\spec-first.cmd" "--help"');
  });

  test('optional CI artifact writer stores JSON summaries in a workspace directory', () => {
    const previous = process.env.SPEC_FIRST_SMOKE_ARTIFACT_DIR;
    const artifactDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'spec-first-smoke-artifacts-'));

    try {
      process.env.SPEC_FIRST_SMOKE_ARTIFACT_DIR = artifactDir;
      const writer = createArtifactWriter();
      writer.write('summary.json', { status: 'passed' });

      expect(writer.dir).toBe(path.resolve(artifactDir));
      expect(JSON.parse(fs.readFileSync(path.join(artifactDir, 'summary.json'), 'utf8'))).toEqual({
        status: 'passed',
      });
    } finally {
      if (previous === undefined) {
        delete process.env.SPEC_FIRST_SMOKE_ARTIFACT_DIR;
      } else {
        process.env.SPEC_FIRST_SMOKE_ARTIFACT_DIR = previous;
      }
      fs.rmSync(artifactDir, { recursive: true, force: true });
    }
  });

  test('CI artifact writer rejects path traversal and Windows-invalid file names', () => {
    expect(normalizeArtifactFileName('summary.json')).toBe('summary.json');
    expect(normalizeArtifactFileName('pack-output.log')).toBe('pack-output.log');

    for (const unsafe of ['../summary.json', '..\\summary.json', '/tmp/summary.json', 'C:\\tmp\\summary.json', 'bad:name.log', '']) {
      expect(() => normalizeArtifactFileName(unsafe)).toThrow(/Unsafe smoke artifact file name/);
    }
  });

  test('workflow uses reusable smoke script and avoids shell true fallback', () => {
    const script = fs.readFileSync(SCRIPT_PATH, 'utf8');
    const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

    expect(workflow).toContain('run: node scripts/npm-install-matrix-smoke.js');
    expect(workflow).toContain('os: [ubuntu-latest, macos-latest, windows-latest]');
    expect(workflow).toContain('node: [20, 22, 24]');
    expect(workflow).toContain("if: runner.os != 'Windows'");
    expect(workflow).toContain('shell: pwsh');
    expect(workflow).toContain('shell: cmd');
    expect(workflow).toContain('run: node scripts\\npm-install-matrix-smoke.js');
    expect(workflow).toContain('SPEC_FIRST_SMOKE_ARTIFACT_DIR');
    expect(workflow).toContain('actions/upload-artifact@v4');
    expect(workflow).toContain('if-no-files-found: ignore');
    for (const filter of [
      'agents/**',
      'docs/contracts/verifiers/**',
      'skills/**',
      'templates/**',
      'README.md',
      '.npmignore',
      'scripts/generate-runtime-capability-catalog.js',
      'scripts/npm-install-matrix-smoke.js',
      'scripts/run-test-suite.cjs',
      'scripts/typecheck-js.js',
    ]) {
      expect(workflow).toContain(`- '${filter}'`);
    }
    expect(workflow).not.toContain('shell: node {0}');
    expect(workflow).not.toContain('shell: process.platform ===');
    expect(script).not.toContain('shell: process.platform ===');
    expect(script).toContain('shell: false');
    expect(script).toContain('prefix with spaces');
    expect(script).toContain('workspace [win64] 中文 (paren)');
    expect(script).toContain("['init', '--claude', '-u', 'matrix', '--lang', 'en']");
    expect(script).toContain("['init', '--codex', '-u', 'matrix', '--lang', 'en']");
    expect(script).toContain("['doctor', '--json']");
    expect(script).toContain('minimal git repo [win64] 中文');
    expect(script).toContain("runGit(['init']");
    expect(script).toContain('summary.json');
    expect(script).toContain('pack-output.log');
    expect(script).toContain('cmd.exe');
  });
});
