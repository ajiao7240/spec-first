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

const REPO_ROOT = path.join(__dirname, '..', '..');
const SESSION_START_TEMPLATE_PATH = path.join(REPO_ROOT, 'templates', 'claude', 'hooks', 'session-start');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-claude-settings-'));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
        '## Workflow 入口治理（由 spec-first 管理）',
        '',
        '- 本 block 是 spec-first workflow 入口提醒；`using-spec-first` 是 standalone meta skill，不是 workflow command',
        '- 修改文件、运行会改变状态的命令、或做架构/prompt/workflow 决策前，先判断是否应进入公开 spec-first workflow；轻量问答和窄事实查询可直接回答',
        '- Claude workflow 入口使用 `/spec:*`',
        '- 不要把 `using-spec-first` 本身当作 command-backed workflow',
        '<!-- spec-first:bootstrap:end -->',
        '',
      ].join('\n'), 'utf8');

      const result = spawnSync('bash', [SESSION_START_TEMPLATE_PATH], {
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
      expect(payload.hookSpecificOutput.additionalContext).toContain('先判断是否应进入公开 spec-first workflow');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('session-start hook degrades non-blockingly when the bootstrap block is missing', () => {
    const projectRoot = makeTempDir();

    try {
      const result = spawnSync('bash', [SESSION_START_TEMPLATE_PATH], {
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
      expect(payload.hookSpecificOutput.additionalContext).toContain('spec-first init --claude');
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
