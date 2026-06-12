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
      const hookOps = plan.operations.filter((operation) => operation.reason === 'managed_runtime_hook');
      const cleanupOps = plan.operations.filter((operation) => operation.reason === 'managed_runtime_cleanup'
        || operation.reason === 'legacy_codex_spec_first_skill_cleanup');

      expect(plan.operations.slice(-2).map((operation) => operation.path)).toEqual([
        '.codex/hooks/session-start',
        '.codex/hooks.json',
      ]);
      expect(LEGACY_CLEANUP_PATHS.every((cleanupPath) =>
        cleanupOps.some((operation) => operation.path === cleanupPath)
      )).toBe(true);
      expect(cleanupOps.some((operation) => operation.path === '.codex/skills/work')).toBe(true);
      expect(cleanupOps.every((operation) => (
        operation.kind === 'remove_dir'
        && (
          operation.reason === 'managed_runtime_cleanup'
          || operation.reason === 'legacy_codex_spec_first_skill_cleanup'
        )
      ))).toBe(true);

      const sessionStart = hookOps.find((operation) => operation.path === '.codex/hooks/session-start');
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

      const hooksJson = hookOps.find((operation) => operation.path === '.codex/hooks.json');
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
      expect(plan.summary).toEqual({ remove_dir: cleanupOps.length, write_file: 2 });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('sync plan preserves provider-owned hooks while refreshing managed SessionStart', () => {
    const projectRoot = makeTempDir();
    const graphifyHook = {
      matcher: 'Bash',
      hooks: [
        {
          type: 'command',
          command: 'graphify hook status --refresh',
        },
      ],
    };
    const customSessionStart = {
      hooks: [
        {
          type: 'command',
          command: 'echo custom-session-start',
        },
      ],
    };

    try {
      fs.mkdirSync(path.join(projectRoot, '.codex'), { recursive: true });
      fs.writeFileSync(path.join(projectRoot, '.codex', 'hooks.json'), JSON.stringify({
        hooks: {
          PreToolUse: [graphifyHook],
          SessionStart: [
            customSessionStart,
            {
              hooks: [
                {
                  type: 'command',
                  command: path.join(os.tmpdir(), 'old-project', '.codex/hooks/session-start'),
                },
              ],
            },
          ],
        },
      }, null, 2), 'utf8');

      const plan = getAdapter('codex').planRuntimeFilesSync(projectRoot);
      const hooksJson = plan.operations.find((operation) => operation.path === '.codex/hooks.json');
      const parsed = JSON.parse(hooksJson.contents);

      expect(hooksJson.kind).toBe('update_file');
      expect(parsed.hooks.PreToolUse).toEqual([graphifyHook]);
      expect(parsed.hooks.SessionStart).toHaveLength(2);
      expect(parsed.hooks.SessionStart).toContainEqual(customSessionStart);
      expect(parsed.hooks.SessionStart).toContainEqual({
        hooks: [
          {
            type: 'command',
            command: path.join(projectRoot, '.codex/hooks/session-start'),
          },
        ],
      });
      expect(JSON.stringify(parsed)).not.toContain('old-project');
      expect(getAdapter('codex').inspectRuntimeFiles(projectRoot)[1]).toMatchObject({
        level: 'WARNING',
        message: 'missing managed SessionStart hook config',
      });
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
      const cleanupOps = plan.operations.filter((operation) => operation.reason === 'managed_runtime_cleanup'
        || operation.reason === 'legacy_codex_spec_first_skill_cleanup');

      expect(hookOps.map((operation) => operation.kind)).toEqual(['update_file', 'update_file']);
      expect(cleanupOps.length).toBeGreaterThan(LEGACY_CLEANUP_PATHS.length);
      expect(plan.summary).toEqual({ remove_dir: cleanupOps.length, update_file: 2 });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('removal plan appends hook removals without dropping legacy cleanup ops', () => {
    const plan = getAdapter('codex').planRuntimeFilesRemoval('/tmp/unused');
    const cleanupOps = plan.operations.filter((operation) => operation.reason === 'managed_runtime_cleanup'
      || operation.reason === 'legacy_codex_spec_first_skill_cleanup');

    expect(LEGACY_CLEANUP_PATHS.every((cleanupPath) =>
      cleanupOps.some((operation) => operation.path === cleanupPath)
    )).toBe(true);
    expect(cleanupOps.some((operation) => operation.path === '.codex/skills/work')).toBe(true);
    expect(plan.operations.slice(-2).map((operation) => operation.path)).toEqual([
      '.codex/hooks/session-start',
      '.codex/hooks.json',
    ]);
    expect(cleanupOps.every((operation) => (
      operation.kind === 'remove_dir'
      && (
        operation.reason === 'managed_runtime_cleanup'
        || operation.reason === 'legacy_codex_spec_first_skill_cleanup'
      )
    ))).toBe(true);
    expect(plan.operations.slice(-2)).toEqual([
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
    expect(plan.summary).toEqual({ remove_dir: cleanupOps.length, remove_file: 2 });
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

      const hooksPath = path.join(projectRoot, '.codex', 'hooks.json');
      const hooksJson = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
      hooksJson.hooks.SessionStart[0].hooks[0].command = path.join(os.tmpdir(), 'old-project', '.codex/hooks/session-start');
      fs.writeFileSync(hooksPath, JSON.stringify(hooksJson, null, 2), 'utf8');
      const checks = adapter.inspectRuntimeFiles(projectRoot);
      expect(checks[0].level).toBe('PASS');
      expect(checks[1]).toMatchObject({
        level: 'WARNING',
        name: '.codex/hooks.json',
        message: 'missing managed SessionStart hook config',
      });

      fs.writeFileSync(hooksPath, '{', 'utf8');
      expect(adapter.inspectRuntimeFiles(projectRoot)[1]).toMatchObject({
        level: 'WARNING',
        name: '.codex/hooks.json',
        message: 'invalid JSON',
      });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});

describe('Codex SessionStart hook script', () => {
  test('emits a short governance pointer without re-injecting the AGENTS bootstrap block', () => {
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
      const ctx = payload.hookSpecificOutput.additionalContext;
      expect(ctx).toContain('[spec-first] using-spec-first SessionStart injection');
      expect(ctx).toContain('Workflow entry governance is active');
      expect(ctx).toContain('target_repo');
      expect(ctx).toContain('skills/using-spec-first/SKILL.md');
      // AGENTS.md already carries the block; the hook must not duplicate its body.
      expect(ctx).not.toContain('## Workflow entry governance');
      expect(ctx).not.toContain('- Codex workflow entrypoints use `$spec-*`.');
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
