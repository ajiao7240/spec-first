'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { validateAgainstSchema } = require('../../src/contracts/schema-validator');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'npm-install-matrix-smoke.js');
const WORKFLOW_PATH = path.join(REPO_ROOT, '.github', 'workflows', 'npm-install-matrix.yml');
const RELEASE_EVIDENCE_SCHEMA_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'release-package-evidence.schema.json');

const {
  buildInitDryRunEvidence,
  buildPackageContentManifest,
  buildCmdCommandLine,
  buildReleaseArtifactSummary,
  createArtifactWriter,
  getEnvValue,
  normalizeArtifactFileName,
  resolveNpmCliPath,
} = require('../../scripts/npm-install-matrix-smoke');

const VALID_PACK_FILES = [
  'bin/spec-first.js',
  'src/cli/index.js',
  'skills/spec-work/SKILL.md',
  'skills/spec-plan/SKILL.md',
  'templates/claude/commands/spec/work.md',
  'README.md',
].map((filePath, index) => ({
  path: filePath,
  size: index + 1,
  mode: 420,
}));

function packJson(files = VALID_PACK_FILES) {
  return JSON.stringify([
    {
      name: 'spec-first',
      version: '1.8.1',
      filename: 'spec-first-1.8.1.tgz',
      files,
    },
  ]);
}

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
    expect(normalizeArtifactFileName('package-content-manifest.json')).toBe('package-content-manifest.json');
    expect(normalizeArtifactFileName('release-artifact-summary.json')).toBe('release-artifact-summary.json');
    expect(normalizeArtifactFileName('init-claude-dry-run.log')).toBe('init-claude-dry-run.log');
    expect(normalizeArtifactFileName('init-codex-dry-run.log')).toBe('init-codex-dry-run.log');

    for (const unsafe of ['../summary.json', '..\\summary.json', '/tmp/summary.json', 'C:\\tmp\\summary.json', 'bad:name.log', '']) {
      expect(() => normalizeArtifactFileName(unsafe)).toThrow(/Unsafe smoke artifact file name/);
    }
  });

  test('package content manifest records npm pack dry-run file facts and required paths', () => {
    const manifest = buildPackageContentManifest(packJson(), {
      generatedAt: '2026-05-11T12:00:00.000Z',
    });

    expect(manifest).toEqual(expect.objectContaining({
      schema_version: 'package-content-manifest.v1',
      source: 'npm pack --dry-run --json',
      file_count: VALID_PACK_FILES.length,
      passed: true,
      failures: [],
    }));
    expect(manifest.package).toEqual({
      name: 'spec-first',
      version: '1.8.1',
      filename: 'spec-first-1.8.1.tgz',
    });
    expect(manifest.files.map((file) => file.path)).toEqual([
      'bin/spec-first.js',
      'README.md',
      'skills/spec-plan/SKILL.md',
      'skills/spec-work/SKILL.md',
      'src/cli/index.js',
      'templates/claude/commands/spec/work.md',
    ].sort((a, b) => a.localeCompare(b)));
    expect(manifest.required_paths.every((item) => item.present)).toBe(true);
    expect(manifest.checks.every((check) => check.passed)).toBe(true);
  });

  test('package content manifest fails with reason codes for missing required and forbidden paths', () => {
    const files = [
      ...VALID_PACK_FILES.filter((file) => file.path !== 'README.md'),
      { path: 'src/crg/index.js', size: 12, mode: 420 },
      { path: 'skills/spec-work/scripts/__pycache__/tool.pyc', size: 13, mode: 420 },
    ];
    const manifest = buildPackageContentManifest(packJson(files), {
      generatedAt: '2026-05-11T12:00:00.000Z',
    });

    expect(manifest.passed).toBe(false);
    expect(manifest.failures).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason_code: 'required-package-path-missing',
        paths: ['README.md'],
      }),
      expect.objectContaining({
        reason_code: 'forbidden-package-path-present',
        paths: ['src/crg/index.js'],
      }),
      expect.objectContaining({
        reason_code: 'forbidden-package-path-present',
        paths: ['skills/spec-work/scripts/__pycache__/tool.pyc'],
      }),
    ]));
  });

  test('package content manifest rejects unsafe package paths', () => {
    expect(() => buildPackageContentManifest(packJson([
      ...VALID_PACK_FILES,
      { path: '../outside.js', size: 1, mode: 420 },
    ]))).toThrow(/Unsafe package content path/);

    expect(() => buildPackageContentManifest(packJson([
      ...VALID_PACK_FILES,
      { path: 'C:\\tmp\\outside.js', size: 1, mode: 420 },
    ]))).toThrow(/Unsafe package content path/);
  });

  test('release artifact summary follows the consumer schema and rejects absolute public artifact paths', () => {
    const schema = JSON.parse(fs.readFileSync(RELEASE_EVIDENCE_SCHEMA_PATH, 'utf8'));
    const summary = buildReleaseArtifactSummary({
      generatedAt: '2026-05-11T12:00:00.000Z',
      status: 'passed',
      packageInfo: {
        name: 'spec-first',
        version: '1.8.1',
      },
      tarballName: 'spec-first-1.8.1.tgz',
      platform: 'darwin',
      node: 'v24.0.0',
      checks: [
        {
          check_id: 'package-content-manifest',
          status: 'passed',
          reason_code: 'package-content-manifest-passed',
          summary: 'ok',
          artifact_path: 'package-content-manifest.json',
        },
      ],
      failures: [],
    });

    expect(validateAgainstSchema(schema, summary).errors).toEqual([]);
    expect(summary.artifacts).toEqual({
      summary: 'summary.json',
      pack_output: 'pack-output.log',
      package_content_manifest: 'package-content-manifest.json',
      init_claude_dry_run_log: 'init-claude-dry-run.log',
      init_codex_dry_run_log: 'init-codex-dry-run.log',
      release_artifact_summary: 'release-artifact-summary.json',
    });

    const invalid = {
      ...summary,
      artifacts: {
        ...summary.artifacts,
        package_content_manifest: '/tmp/package-content-manifest.json',
      },
    };
    expect(validateAgainstSchema(schema, invalid).errors).toContain('root.artifacts.package_content_manifest: value "/tmp/package-content-manifest.json" does not equal const "package-content-manifest.json"');
    expect(Object.values(invalid.artifacts).some((artifactPath) => path.isAbsolute(artifactPath))).toBe(true);
    expect(Object.values(summary.artifacts).some((artifactPath) => path.isAbsolute(artifactPath))).toBe(false);
  });

  test('failed release artifact summary requires a failure entry', () => {
    const schema = JSON.parse(fs.readFileSync(RELEASE_EVIDENCE_SCHEMA_PATH, 'utf8'));
    const invalid = buildReleaseArtifactSummary({
      generatedAt: '2026-05-11T12:00:00.000Z',
      status: 'failed',
      failures: [],
    });

    expect(validateAgainstSchema(schema, invalid).errors).toContain('root.failures: expected at least 1 item(s), received 0');
  });

  test('init dry-run evidence detects marker and no-mutation behavior', () => {
    const passed = buildInitDryRunEvidence({
      host: 'claude',
      result: {
        status: 0,
        stdout: 'Dry run: spec-first init (claude)\nNo files were changed.',
        stderr: '',
      },
      beforeSnapshot: [],
      afterSnapshot: [],
    });

    expect(passed).toEqual(expect.objectContaining({
      host: 'claude',
      status: 0,
      passed: true,
      reason_code: 'init-dry-run-passed',
      has_dry_run_marker: true,
      mutated: false,
    }));

    const failed = buildInitDryRunEvidence({
      host: 'codex',
      result: {
        status: 0,
        stdout: 'Dry run: spec-first init (codex)\nNo files were changed.',
        stderr: '',
      },
      beforeSnapshot: [],
      afterSnapshot: ['AGENTS.md:changed'],
    });

    expect(failed).toEqual(expect.objectContaining({
      host: 'codex',
      passed: false,
      reason_code: 'init-dry-run-failed',
      has_dry_run_marker: true,
      mutated: true,
    }));
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
      'docs/contracts/release-package-evidence.schema.json',
      'scripts/generate-runtime-capability-catalog.js',
      'scripts/npm-install-matrix-smoke.js',
      'scripts/run-test-suite.cjs',
      'scripts/typecheck-js.js',
      'tests/unit/npm-install-matrix-smoke.test.js',
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
    expect(script).toContain('package-content-manifest.json');
    expect(script).toContain('release-artifact-summary.json');
    expect(script).toContain('init-claude-dry-run.log');
    expect(script).toContain('init-codex-dry-run.log');
    expect(script).toContain("['init', '--claude', '--dry-run', '-u', 'matrix', '--lang', 'en']");
    expect(script).toContain("['init', '--codex', '--dry-run', '-u', 'matrix', '--lang', 'en']");
    expect(script).toContain('cmd.exe');
  });
});
