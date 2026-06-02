'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  SESSION_START_COMMAND,
  buildManagedSessionStartMatcher,
  getClaudeSettingsPath,
  inspectManagedSessionStartHook,
  removeManagedSessionStartHook,
  upsertManagedSessionStartHook,
  validateClaudeSettingsFile,
} = require('../../src/cli/claude-settings');
const { getAdapter } = require('../../src/cli/adapters');

const REPO_ROOT = path.join(__dirname, '..', '..');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-claude-settings-'));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeRenderedSessionStartHook(projectRoot, transform = (content) => content) {
  const adapter = getAdapter('claude');
  const plan = adapter.planRuntimeFilesSync(projectRoot);
  const hook = plan.operations.find((operation) => operation.path === '.claude/hooks/session-start');
  const hookPath = path.join(projectRoot, '.claude', 'hooks', 'session-start');
  fs.mkdirSync(path.dirname(hookPath), { recursive: true });
  fs.writeFileSync(hookPath, transform(hook.contents), 'utf8');
  fs.chmodSync(hookPath, 0o755);
  return hookPath;
}

describe('claude settings', () => {
  test('creates the managed SessionStart matcher in an empty settings file', () => {
    const projectRoot = makeTempDir();

    try {
      upsertManagedSessionStartHook(projectRoot);

      expect(readJson(getClaudeSettingsPath(projectRoot))).toEqual({
        hooks: {
          SessionStart: [
            buildManagedSessionStartMatcher(),
          ],
        },
      });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('appends the managed matcher without disturbing user hooks or permissions', () => {
    const projectRoot = makeTempDir();
    const settingsPath = getClaudeSettingsPath(projectRoot);

    try {
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.writeFileSync(settingsPath, `${JSON.stringify({
        permissions: {
          allow: ['Read(*)'],
        },
        hooks: {
          SessionStart: [
            {
              matcher: 'startup',
              hooks: [
                {
                  type: 'command',
                  command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/custom-start',
                },
              ],
            },
          ],
          Stop: [
            {
              matcher: '.*',
              hooks: [
                {
                  type: 'command',
                  command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/custom-stop',
                },
              ],
            },
          ],
        },
      }, null, 2)}\n`, 'utf8');

      upsertManagedSessionStartHook(projectRoot);
      const settings = readJson(settingsPath);

      expect(settings.permissions).toEqual({ allow: ['Read(*)'] });
      expect(settings.hooks.Stop).toHaveLength(1);
      expect(settings.hooks.SessionStart).toHaveLength(2);
      expect(settings.hooks.SessionStart[1]).toEqual(buildManagedSessionStartMatcher());
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('repeated upsert does not duplicate the managed matcher', () => {
    const projectRoot = makeTempDir();

    try {
      upsertManagedSessionStartHook(projectRoot);
      upsertManagedSessionStartHook(projectRoot);

      const settings = readJson(getClaudeSettingsPath(projectRoot));
      expect(settings.hooks.SessionStart).toHaveLength(1);
      expect(settings.hooks.SessionStart[0].hooks[0].command).toBe(SESSION_START_COMMAND);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('remove only deletes the managed matcher and preserves custom entries', () => {
    const projectRoot = makeTempDir();
    const settingsPath = getClaudeSettingsPath(projectRoot);

    try {
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.writeFileSync(settingsPath, `${JSON.stringify({
        hooks: {
          SessionStart: [
            buildManagedSessionStartMatcher(),
            {
              matcher: 'startup',
              hooks: [
                {
                  type: 'command',
                  command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/custom-start',
                },
              ],
            },
          ],
        },
      }, null, 2)}\n`, 'utf8');

      removeManagedSessionStartHook(projectRoot);

      expect(readJson(settingsPath)).toEqual({
        hooks: {
          SessionStart: [
            {
              matcher: 'startup',
              hooks: [
                {
                  type: 'command',
                  command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/custom-start',
                },
              ],
            },
          ],
        },
      });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('inspect reports drift when the managed command is rewritten', () => {
    const projectRoot = makeTempDir();
    const settingsPath = getClaudeSettingsPath(projectRoot);

    try {
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.writeFileSync(settingsPath, `${JSON.stringify({
        hooks: {
          SessionStart: [
            {
              matcher: 'startup|resume|clear|compact',
              hooks: [
                {
                  type: 'command',
                  command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/session-start --debug',
                },
              ],
            },
          ],
        },
      }, null, 2)}\n`, 'utf8');

      expect(inspectManagedSessionStartHook(projectRoot)).toEqual({
        status: 'drifted',
        message: 'managed SessionStart matcher drifted from the bundled template',
      });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('session-start hook emits managed wrapper plus CLAUDE.md bootstrap block', () => {
    const projectRoot = makeTempDir();
    const instructionPath = path.join(projectRoot, 'CLAUDE.md');

    try {
      fs.writeFileSync(instructionPath, [
        '# CLAUDE.md',
        '',
        '<!-- spec-first:bootstrap:start -->',
        '## Workflow 入口治理',
        '',
        '- 本 block 只做轻量 workflow entry context router；完整路由策略在 `skills/using-spec-first/SKILL.md`',
        '- substantial work 前先判断是否进入公开 spec-first workflow；轻量问答和窄事实查询可直接回答；已在 workflow 或 bounded subagent 中时不重新分流',
        '- Claude workflow 入口使用 `/spec:*`',
        '- 不要把 `using-spec-first` 本身当作 command-backed workflow',
        '<!-- spec-first:bootstrap:end -->',
        '',
      ].join('\n'), 'utf8');
      const hookPath = writeRenderedSessionStartHook(projectRoot);

      const result = spawnSync('bash', [hookPath], {
        cwd: projectRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: projectRoot,
        },
      });

      expect(result.status).toBe(0);
      const payload = JSON.parse(result.stdout);
      expect(payload.hookSpecificOutput.hookEventName).toBe('SessionStart');
      expect(payload.hookSpecificOutput.additionalContext).toContain('[spec-first] using-spec-first SessionStart injection');
      expect(payload.hookSpecificOutput.additionalContext).toContain('workflow-entry trigger');
      expect(payload.hookSpecificOutput.additionalContext).toContain('parent multi-repo workspaces');
      expect(payload.hookSpecificOutput.additionalContext).toContain('substantial work 前先判断是否进入公开 spec-first workflow');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('session-start hook appends startup version reminder when the helper prints one', () => {
    const projectRoot = makeTempDir();
    const instructionPath = path.join(projectRoot, 'CLAUDE.md');
    const fakeCliPath = path.join(projectRoot, 'spec-first.js');

    try {
      fs.writeFileSync(fakeCliPath, [
        'if (process.argv[2] === "startup-reminder" && process.argv[3] === "--claude") {',
        '  console.log("[spec-first] Update available for Claude Code runtime: 1.6.1 -> 1.6.2");',
        '  console.log("Run /spec:update when you choose to upgrade.");',
        '}',
      ].join('\n'), 'utf8');
      fs.writeFileSync(instructionPath, [
        '# CLAUDE.md',
        '',
        '<!-- spec-first:bootstrap:start -->',
        '## Workflow 入口治理',
        '',
        '- Claude workflow 入口使用 `/spec:*`',
        '<!-- spec-first:bootstrap:end -->',
        '',
      ].join('\n'), 'utf8');
      const hookPath = writeRenderedSessionStartHook(projectRoot, (content) => (
        content.replace(JSON.stringify(path.join(REPO_ROOT, 'bin', 'spec-first.js')), JSON.stringify(fakeCliPath))
      ));

      const result = spawnSync('bash', [hookPath], {
        cwd: projectRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: projectRoot,
        },
      });

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      const payload = JSON.parse(result.stdout);
      expect(payload.hookSpecificOutput.additionalContext).toContain('using-spec-first SessionStart injection');
      expect(payload.hookSpecificOutput.additionalContext).toContain('1.6.1 -> 1.6.2');
      expect(payload.hookSpecificOutput.additionalContext).toContain('/spec:update');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('session-start hook does not execute a fake spec-first from PATH', () => {
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
      const hookPath = writeRenderedSessionStartHook(projectRoot);

      const result = spawnSync('bash', [hookPath], {
        cwd: projectRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: projectRoot,
          PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
          HOME: path.join(projectRoot, 'home'),
          SPEC_FIRST_VERSION_REMINDER_LATEST: '1.6.2',
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

  test('session-start hook degrades non-blockingly when trusted helper exits non-zero', () => {
    const projectRoot = makeTempDir();
    const fakeCliPath = path.join(projectRoot, 'spec-first.js');

    try {
      fs.writeFileSync(fakeCliPath, 'process.exit(23);\n', 'utf8');
      const hookPath = writeRenderedSessionStartHook(projectRoot, (content) => (
        content.replace(JSON.stringify(path.join(REPO_ROOT, 'bin', 'spec-first.js')), JSON.stringify(fakeCliPath))
      ));

      const result = spawnSync('bash', [hookPath], {
        cwd: projectRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: projectRoot,
          HOME: path.join(projectRoot, 'home'),
        },
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

  test('session-start hook degrades non-blockingly when the bootstrap block is missing', () => {
    const projectRoot = makeTempDir();

    try {
      const hookPath = writeRenderedSessionStartHook(projectRoot);
      const result = spawnSync('bash', [hookPath], {
        cwd: projectRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: projectRoot,
        },
      });

      expect(result.status).toBe(0);
      const payload = JSON.parse(result.stdout);
      expect(payload.hookSpecificOutput.hookEventName).toBe('SessionStart');
      expect(payload.hookSpecificOutput.additionalContext).toContain('Managed using-spec-first bootstrap is missing');
      expect(payload.hookSpecificOutput.additionalContext).toContain('spec-first init');
      expect(payload.hookSpecificOutput.additionalContext).toContain('choose Claude Code');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('validateClaudeSettingsFile throws when settings JSON is invalid', () => {
    const projectRoot = makeTempDir();
    const settingsPath = getClaudeSettingsPath(projectRoot);

    try {
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.writeFileSync(settingsPath, '{"hooks":', 'utf8');

      expect(() => validateClaudeSettingsFile(projectRoot)).toThrow();
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
