'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { getAdapter } = require('../../src/cli/adapters');

const REPO_ROOT = path.join(__dirname, '..', '..');
const TRUSTED_CLI_PATH = path.join(REPO_ROOT, 'bin', 'spec-first.js');
const LEGACY_CLEANUP_PATHS = [
  '.codex/commands/spec',
  '.codex/spec-first/commands',
  '.codex/skills',
  '.agents/plugins',
  'plugins/spec',
  'plugins/spec-first',
];

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-codex-hook-'));
}

function writeRenderedCodexHook(projectRoot, transform = (content) => content) {
  const adapter = getAdapter('codex');
  const hookOperation = adapter
    .planRuntimeFilesSync(projectRoot)
    .operations
    .find((operation) => operation.path === '.codex/hooks/session-start');
  const hookPath = path.join(projectRoot, '.codex', 'hooks', 'session-start');
  fs.mkdirSync(path.dirname(hookPath), { recursive: true });
  fs.writeFileSync(hookPath, transform(hookOperation.contents), 'utf8');
  fs.chmodSync(hookPath, 0o755);
  return hookPath;
}

function replaceTrustedCliPath(content, nextPath) {
  return content.replace(JSON.stringify(TRUSTED_CLI_PATH), JSON.stringify(nextPath));
}

function runHook(hookPath, options = {}) {
  return spawnSync('bash', [hookPath], {
    cwd: options.cwd || path.dirname(path.dirname(path.dirname(hookPath))),
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: options.home || path.join(path.dirname(path.dirname(path.dirname(hookPath))), 'home'),
      ...options.env,
    },
  });
}

describe('Codex SessionStart hook runtime plan', () => {
  test('sync plan appends hook writes without replacing legacy cleanup ops', () => {
    const projectRoot = makeTempDir();

    try {
      const adapter = getAdapter('codex');
      const plan = adapter.planRuntimeFilesSync(projectRoot);

      expect(plan.operations.map((operation) => operation.path)).toEqual([
        ...LEGACY_CLEANUP_PATHS,
        '.codex/hooks/session-start',
        '.codex/hooks.json',
      ]);
      expect(plan.operations.slice(0, LEGACY_CLEANUP_PATHS.length).every((operation) => (
        operation.kind === 'remove_dir' && operation.reason === 'managed_runtime_cleanup'
      ))).toBe(true);

      const sessionStart = plan.operations.find((operation) => operation.path === '.codex/hooks/session-start');
      expect(sessionStart).toMatchObject({
        kind: 'write_file',
        reason: 'managed_runtime_hook',
        mode: 0o755,
      });
      expect(sessionStart.contents).toContain('using-spec-first SessionStart injection');
      expect(sessionStart.contents).toContain('--codex');
      expect(sessionStart.contents).toContain('process.execPath');
      expect(sessionStart.contents).toContain(TRUSTED_CLI_PATH);
      expect(sessionStart.contents).not.toContain('const SPEC_FIRST_CLI_PATH = "__SPEC_FIRST_CLI_PATH__";');
      expect(sessionStart.contents).not.toContain("spawnSync('spec-first'");

      const hooksJson = plan.operations.find((operation) => operation.path === '.codex/hooks.json');
      expect(hooksJson).toMatchObject({
        kind: 'write_file',
        reason: 'managed_runtime_hook',
      });
      const parsed = JSON.parse(hooksJson.contents);
      expect(parsed).toEqual({
        hooks: {
          SessionStart: [
            {
              hooks: [
                {
                  type: 'command',
                  command: path.join(projectRoot, '.codex/hooks/session-start'),
                },
              ],
            },
          ],
        },
      });
      expect(path.isAbsolute(parsed.hooks.SessionStart[0].hooks[0].command)).toBe(true);
      expect(hooksJson.contents).not.toContain('__CODEX_SESSION_START_COMMAND__');
      expect(plan.summary).toEqual({ remove_dir: 6, write_file: 2 });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('sync plan switches hook files to update_file when they already exist', () => {
    const projectRoot = makeTempDir();

    try {
      fs.mkdirSync(path.join(projectRoot, '.codex', 'hooks'), { recursive: true });
      fs.writeFileSync(path.join(projectRoot, '.codex', 'hooks', 'session-start'), '#!/bin/bash\n', 'utf8');
      fs.writeFileSync(path.join(projectRoot, '.codex', 'hooks.json'), '{}\n', 'utf8');

      const plan = getAdapter('codex').planRuntimeFilesSync(projectRoot);
      const hookOps = plan.operations.filter((operation) => operation.reason === 'managed_runtime_hook');

      expect(hookOps.map((operation) => operation.kind)).toEqual(['update_file', 'update_file']);
      expect(plan.summary).toEqual({ remove_dir: 6, update_file: 2 });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('removal plan appends hook removals without dropping legacy cleanup ops', () => {
    const plan = getAdapter('codex').planRuntimeFilesRemoval('/tmp/unused');

    expect(plan.operations.map((operation) => operation.path)).toEqual([
      ...LEGACY_CLEANUP_PATHS,
      '.codex/hooks/session-start',
      '.codex/hooks.json',
    ]);
    expect(plan.operations.slice(0, LEGACY_CLEANUP_PATHS.length).every((operation) => (
      operation.kind === 'remove_dir' && operation.reason === 'managed_runtime_cleanup'
    ))).toBe(true);
    expect(plan.operations.slice(LEGACY_CLEANUP_PATHS.length)).toEqual([
      {
        kind: 'remove_file',
        path: '.codex/hooks/session-start',
        reason: 'managed_runtime_hook',
      },
      {
        kind: 'remove_file',
        path: '.codex/hooks.json',
        reason: 'managed_runtime_hook',
      },
    ]);
    expect(plan.summary).toEqual({ remove_dir: 6, remove_file: 2 });
  });

  test('runtime file inspection reports missing, present, and drifted hook assets', () => {
    const projectRoot = makeTempDir();

    try {
      const adapter = getAdapter('codex');
      expect(adapter.inspectRuntimeFiles(projectRoot).map((check) => check.message)).toEqual(['missing', 'missing']);

      const plan = adapter.planRuntimeFilesSync(projectRoot);
      for (const operation of plan.operations.filter((entry) => entry.reason === 'managed_runtime_hook')) {
        const targetPath = path.join(projectRoot, operation.path);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, operation.contents, 'utf8');
      }

      expect(adapter.inspectRuntimeFiles(projectRoot)).toEqual([
        {
          level: 'PASS',
          name: '.codex/hooks/session-start',
          message: 'managed SessionStart hook present',
        },
        {
          level: 'PASS',
          name: '.codex/hooks.json',
          message: 'managed SessionStart hook config present',
        },
      ]);

      fs.appendFileSync(path.join(projectRoot, '.codex', 'hooks.json'), '\n');
      const checks = adapter.inspectRuntimeFiles(projectRoot);
      expect(checks[0].level).toBe('PASS');
      expect(checks[1]).toMatchObject({
        level: 'WARNING',
        name: '.codex/hooks.json',
        message: 'drifted from bundled template',
      });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});

describe('Codex SessionStart hook script', () => {
  test('prints valid SessionStart JSON with the managed AGENTS bootstrap block', () => {
    const projectRoot = makeTempDir();

    try {
      fs.writeFileSync(path.join(projectRoot, 'AGENTS.md'), [
        '# AGENTS.md',
        '',
        '<!-- spec-first:bootstrap:start -->',
        '## Workflow entry governance',
        '',
        '- Codex workflow entrypoints use `$spec-*`.',
        '- Keep writes bounded to target_repo.',
        '<!-- spec-first:bootstrap:end -->',
        '',
      ].join('\n'), 'utf8');
      const hookPath = writeRenderedCodexHook(projectRoot, (content) => (
        replaceTrustedCliPath(content, path.join(projectRoot, 'missing-spec-first.js'))
      ));

      const result = runHook(hookPath, {
        env: { CODEX_PROJECT_DIR: projectRoot },
      });

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      const payload = JSON.parse(result.stdout);
      expect(payload.hookSpecificOutput.hookEventName).toBe('SessionStart');
      expect(payload.hookSpecificOutput.additionalContext).toContain('[spec-first] using-spec-first SessionStart injection');
      expect(payload.hookSpecificOutput.additionalContext).toContain('managed AGENTS.md bootstrap block');
      expect(payload.hookSpecificOutput.additionalContext).toContain('workflow-entry trigger');
      expect(payload.hookSpecificOutput.additionalContext).toContain('target_repo');
      expect(payload.hookSpecificOutput.additionalContext).toContain('Codex workflow entrypoints use `$spec-*`.');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('degrades non-blockingly when the AGENTS bootstrap block is missing', () => {
    const projectRoot = makeTempDir();

    try {
      const hookPath = writeRenderedCodexHook(projectRoot, (content) => (
        replaceTrustedCliPath(content, path.join(projectRoot, 'missing-spec-first.js'))
      ));

      const result = runHook(hookPath, {
        cwd: os.tmpdir(),
        env: { CODEX_PROJECT_DIR: projectRoot },
      });

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      const payload = JSON.parse(result.stdout);
      expect(payload.hookSpecificOutput.hookEventName).toBe('SessionStart');
      expect(payload.hookSpecificOutput.additionalContext).toContain('Managed using-spec-first bootstrap is missing from `AGENTS.md`.');
      expect(payload.hookSpecificOutput.additionalContext).toContain('spec-first init');
      expect(payload.hookSpecificOutput.additionalContext).toContain('choose Codex');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('degrades non-blockingly when AGENTS bootstrap markers are incomplete', () => {
    const projectRoot = makeTempDir();

    try {
      fs.writeFileSync(path.join(projectRoot, 'AGENTS.md'), [
        '# AGENTS.md',
        '',
        '<!-- spec-first:bootstrap:start -->',
        '## Workflow entry governance',
        '',
      ].join('\n'), 'utf8');
      const hookPath = writeRenderedCodexHook(projectRoot, (content) => (
        replaceTrustedCliPath(content, path.join(projectRoot, 'missing-spec-first.js'))
      ));

      const result = runHook(hookPath, {
        env: { CODEX_PROJECT_DIR: projectRoot },
      });

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      const payload = JSON.parse(result.stdout);
      expect(payload.hookSpecificOutput.hookEventName).toBe('SessionStart');
      expect(payload.hookSpecificOutput.additionalContext).toContain('markers are missing or incomplete in `AGENTS.md`');
      expect(payload.hookSpecificOutput.additionalContext).toContain('choose Codex');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('appends startup reminder output when the trusted helper prints one', () => {
    const projectRoot = makeTempDir();
    const fakeCliPath = path.join(projectRoot, 'spec-first.js');

    try {
      fs.writeFileSync(fakeCliPath, [
        'if (process.argv[2] === "startup-reminder" && process.argv[3] === "--codex") {',
        '  console.log("[spec-first] Update available for Codex runtime: 1.6.1 -> 1.6.2");',
        '  console.log("Run `spec-first update` in your terminal to check version and runtime freshness.");',
        '}',
      ].join('\n'), 'utf8');
      fs.writeFileSync(path.join(projectRoot, 'AGENTS.md'), [
        '<!-- spec-first:bootstrap:start -->',
        '- Codex workflow entrypoints use `$spec-*`.',
        '<!-- spec-first:bootstrap:end -->',
        '',
      ].join('\n'), 'utf8');
      const hookPath = writeRenderedCodexHook(projectRoot, (content) => (
        replaceTrustedCliPath(content, fakeCliPath)
      ));

      const result = runHook(hookPath, {
        env: { CODEX_PROJECT_DIR: projectRoot },
      });

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      const payload = JSON.parse(result.stdout);
      expect(payload.hookSpecificOutput.additionalContext).toContain('using-spec-first SessionStart injection');
      expect(payload.hookSpecificOutput.additionalContext).toContain('1.6.1 -> 1.6.2');
      expect(payload.hookSpecificOutput.additionalContext).toContain('spec-first update');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('does not execute a fake spec-first from PATH', () => {
    const projectRoot = makeTempDir();
    const fakeBin = path.join(projectRoot, 'bin');
    const sentinelPath = path.join(projectRoot, 'fake-spec-first-ran');

    try {
      fs.mkdirSync(fakeBin, { recursive: true });
      fs.writeFileSync(path.join(fakeBin, 'spec-first'), [
        '#!/bin/bash',
        `printf fake > ${JSON.stringify(sentinelPath)}`,
        'printf "%s\\n" "FAKE PATH REMINDER"',
      ].join('\n'), 'utf8');
      fs.chmodSync(path.join(fakeBin, 'spec-first'), 0o755);
      const hookPath = writeRenderedCodexHook(projectRoot, (content) => (
        replaceTrustedCliPath(content, '__SPEC_FIRST_CLI_PATH__')
      ));

      const result = runHook(hookPath, {
        env: {
          CODEX_PROJECT_DIR: projectRoot,
          PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
        },
      });

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(fs.existsSync(sentinelPath)).toBe(false);
      expect(result.stdout).not.toContain('FAKE PATH REMINDER');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('degrades non-blockingly when the trusted helper exits non-zero', () => {
    const projectRoot = makeTempDir();
    const fakeCliPath = path.join(projectRoot, 'spec-first.js');

    try {
      fs.writeFileSync(fakeCliPath, 'process.exit(23);\n', 'utf8');
      const hookPath = writeRenderedCodexHook(projectRoot, (content) => (
        replaceTrustedCliPath(content, fakeCliPath)
      ));

      const result = runHook(hookPath, {
        env: { CODEX_PROJECT_DIR: projectRoot },
      });

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      const payload = JSON.parse(result.stdout);
      expect(payload.hookSpecificOutput.hookEventName).toBe('SessionStart');
      expect(payload.hookSpecificOutput.additionalContext).toContain('using-spec-first SessionStart injection');
      expect(payload.hookSpecificOutput.additionalContext).not.toContain('Update available');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
