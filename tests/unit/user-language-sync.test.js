'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  applyUserLanguageSyncPlan,
  buildUserLanguageSyncPlan,
} = require('../../src/cli/user-language-sync');
const { samePhysicalPath } = require('../../src/cli/helpers/global-config-dir');

function makeTempDir(prefix = 'spec-first-user-language-sync-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('user-language-sync', () => {
  let isolatedHome;
  let homedirSpy;
  let previousCodexHome;
  let previousClaudeConfigDir;

  beforeEach(() => {
    isolatedHome = makeTempDir('spec-first-user-language-home-');
    homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(isolatedHome);
    previousCodexHome = process.env.CODEX_HOME;
    previousClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
    delete process.env.CODEX_HOME;
    delete process.env.CLAUDE_CONFIG_DIR;
  });

  afterEach(() => {
    if (previousCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }
    if (previousClaudeConfigDir === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR;
    } else {
      process.env.CLAUDE_CONFIG_DIR = previousClaudeConfigDir;
    }
    if (homedirSpy) {
      homedirSpy.mockRestore();
      homedirSpy = null;
    }
    fs.rmSync(isolatedHome, { recursive: true, force: true });
  });

  test('Codex enable writes user-language block to CODEX_HOME AGENTS.md and persists preference', () => {
    const projectRoot = makeTempDir();
    const codexHome = makeTempDir('spec-first-codex-home-');
    process.env.CODEX_HOME = codexHome;

    try {
      const plan = buildUserLanguageSyncPlan({
        projectRoot,
        platforms: ['codex'],
        lang: 'zh',
        preference: { value: true, source: 'explicit' },
      });
      const result = applyUserLanguageSyncPlan(plan);

      expect(result.exit_code).toBe(0);
      expect(result.status).toBe('ready');
      const agents = fs.readFileSync(path.join(codexHome, 'AGENTS.md'), 'utf8');
      expect(agents).toContain('<!-- spec-first:user-language:start -->');
      expect(agents).toContain('语言规则为绝对硬执行要求');
      const profile = fs.readFileSync(path.join(isolatedHome, '.spec-first', '.developer'), 'utf8');
      expect(profile).toContain('sync_user_language=true');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
      fs.rmSync(codexHome, { recursive: true, force: true });
    }
  });

  test('Codex override shadowing is action-required and does not modify override or persist preference', () => {
    const projectRoot = makeTempDir();
    const codexHome = makeTempDir('spec-first-codex-home-');
    process.env.CODEX_HOME = codexHome;
    fs.writeFileSync(path.join(codexHome, 'AGENTS.override.md'), 'manual override\n', 'utf8');

    try {
      const plan = buildUserLanguageSyncPlan({
        projectRoot,
        platforms: ['codex'],
        lang: 'zh',
        preference: { value: true, source: 'explicit' },
      });
      const result = applyUserLanguageSyncPlan(plan);

      expect(result.exit_code).toBe(1);
      expect(result.status).toBe('action-required');
      expect(result.operations[0].reason).toBe('codex-global-override-active');
      expect(fs.existsSync(path.join(codexHome, 'AGENTS.md'))).toBe(false);
      expect(fs.readFileSync(path.join(codexHome, 'AGENTS.override.md'), 'utf8')).toBe('manual override\n');
      expect(fs.existsSync(path.join(isolatedHome, '.spec-first', '.developer'))).toBe(false);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
      fs.rmSync(codexHome, { recursive: true, force: true });
    }
  });

  test('stored false cleanup treats missing user files as no-op without creating host dirs', () => {
    const projectRoot = makeTempDir();

    try {
      const plan = buildUserLanguageSyncPlan({
        projectRoot,
        platforms: ['codex'],
        lang: 'zh',
        preference: { value: false, source: 'stored' },
      });
      const result = applyUserLanguageSyncPlan(plan);

      expect(result.exit_code).toBe(0);
      expect(result.operations.map((operation) => operation.action)).toEqual(['missing/no-op', 'missing/no-op']);
      expect(fs.existsSync(path.join(isolatedHome, '.codex'))).toBe(false);
      expect(fs.existsSync(path.join(isolatedHome, '.claude'))).toBe(false);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Claude enable writes to ~/.claude/CLAUDE.md with fixed helper basis', () => {
    const projectRoot = makeTempDir();

    try {
      const plan = buildUserLanguageSyncPlan({
        projectRoot,
        platforms: ['claude'],
        lang: 'en',
        preference: { value: true, source: 'stored' },
      });
      const result = applyUserLanguageSyncPlan(plan);

      expect(result.exit_code).toBe(0);
      expect(plan.operations[0].basis).toBe('claude-user-instructions-claude-md-v1');
      expect(plan.operations[0].displayPath).toBe('~/.claude/CLAUDE.md');
      const claude = fs.readFileSync(path.join(isolatedHome, '.claude', 'CLAUDE.md'), 'utf8');
      expect(claude).toContain('absolute hard-execution requirement');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('both hosts selected plans one operation per supported host', () => {
    const projectRoot = makeTempDir();
    const codexHome = makeTempDir('spec-first-codex-home-');
    process.env.CODEX_HOME = codexHome;

    try {
      const plan = buildUserLanguageSyncPlan({
        projectRoot,
        platforms: ['claude', 'codex', 'codex'],
        lang: 'zh',
        preference: { value: true, source: 'stored' },
      });

      expect(plan.operations.map((operation) => operation.host)).toEqual(['codex', 'claude']);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
      fs.rmSync(codexHome, { recursive: true, force: true });
    }
  });

  test('CLAUDE_CONFIG_DIR does not relocate the v1 Claude user instruction target', () => {
    const projectRoot = makeTempDir();
    const claudeConfigDir = makeTempDir('spec-first-claude-config-');
    process.env.CLAUDE_CONFIG_DIR = claudeConfigDir;

    try {
      const plan = buildUserLanguageSyncPlan({
        projectRoot,
        platforms: ['claude'],
        lang: 'zh',
        preference: { value: true, source: 'stored' },
      });

      expect(plan.operations[0].absolutePath).toBe(path.join(isolatedHome, '.claude', 'CLAUDE.md'));
      expect(plan.operations[0].displayPath).toBe('~/.claude/CLAUDE.md');
      expect(plan.operations[0].basis).toBe('claude-user-instructions-claude-md-v1');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
      fs.rmSync(claudeConfigDir, { recursive: true, force: true });
    }
  });

  test('Claude same-physical-path collision fails instead of double-writing project instruction file', () => {
    const projectRoot = path.join(isolatedHome, '.claude');

    const plan = buildUserLanguageSyncPlan({
      projectRoot,
      platforms: ['claude'],
      lang: 'zh',
      preference: { value: true, source: 'explicit' },
    });
    const result = applyUserLanguageSyncPlan(plan);

    expect(result.exit_code).toBe(1);
    expect(result.operations[0].reason).toBe('same-physical-path-collision');
    expect(fs.existsSync(path.join(isolatedHome, '.claude', 'CLAUDE.md'))).toBe(false);
  });

  test('samePhysicalPath canonicalizes symlinked existing ancestors', () => {
    const realDir = makeTempDir('spec-first-real-config-');
    const linkDir = path.join(isolatedHome, 'config-link');
    fs.symlinkSync(realDir, linkDir, 'dir');

    try {
      expect(samePhysicalPath(
        path.join(realDir, 'nested', 'AGENTS.md'),
        path.join(linkDir, 'nested', 'AGENTS.md'),
      )).toBe(true);
    } finally {
      fs.rmSync(linkDir, { force: true });
      fs.rmSync(realDir, { recursive: true, force: true });
    }
  });

  test('same-physical-path collision fails instead of double-writing project instruction file', () => {
    const codexHome = makeTempDir('spec-first-codex-home-');
    process.env.CODEX_HOME = codexHome;

    try {
      const plan = buildUserLanguageSyncPlan({
        projectRoot: codexHome,
        platforms: ['codex'],
        lang: 'zh',
        preference: { value: true, source: 'explicit' },
      });
      const result = applyUserLanguageSyncPlan(plan);

      expect(result.exit_code).toBe(1);
      expect(result.operations[0].reason).toBe('same-physical-path-collision');
      expect(fs.existsSync(path.join(codexHome, 'AGENTS.md'))).toBe(false);
    } finally {
      fs.rmSync(codexHome, { recursive: true, force: true });
    }
  });

  test('existing non-file target reports structured failure instead of throwing', () => {
    const projectRoot = makeTempDir();
    const codexHome = makeTempDir('spec-first-codex-home-');
    process.env.CODEX_HOME = codexHome;
    fs.mkdirSync(path.join(codexHome, 'AGENTS.md'), { recursive: true });

    try {
      const plan = buildUserLanguageSyncPlan({
        projectRoot,
        platforms: ['codex'],
        lang: 'zh',
        preference: { value: true, source: 'explicit' },
      });
      const result = applyUserLanguageSyncPlan(plan);

      expect(result.exit_code).toBe(1);
      expect(result.operations[0].status).toBe('failed');
      expect(result.operations[0].reason).toBe('user-language-target-unreadable');
      expect(result.profileOperation.status).toBe('skipped');
      expect(result.profileOperation.reason).toBe('user-language-ops-not-ready');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
      fs.rmSync(codexHome, { recursive: true, force: true });
    }
  });

  test('explicit disable persists false even when residual cleanup fails', () => {
    const projectRoot = makeTempDir();
    const codexHome = makeTempDir('spec-first-codex-home-');
    process.env.CODEX_HOME = codexHome;
    fs.mkdirSync(path.join(codexHome, 'AGENTS.md'), { recursive: true });

    try {
      const plan = buildUserLanguageSyncPlan({
        projectRoot,
        platforms: ['codex'],
        lang: 'zh',
        preference: { value: false, source: 'explicit' },
      });
      const result = applyUserLanguageSyncPlan(plan);

      expect(result.exit_code).toBe(1);
      expect(result.operations[0].reason).toBe('user-language-target-unreadable');
      expect(result.profileOperation.status).toBe('ready');
      const profile = fs.readFileSync(path.join(isolatedHome, '.spec-first', '.developer'), 'utf8');
      expect(profile).toContain('sync_user_language=false');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
      fs.rmSync(codexHome, { recursive: true, force: true });
    }
  });

  test('disable removes only complete managed block and preserves surrounding content', () => {
    const projectRoot = makeTempDir();
    const codexHome = makeTempDir('spec-first-codex-home-');
    process.env.CODEX_HOME = codexHome;

    try {
      const enable = buildUserLanguageSyncPlan({
        projectRoot,
        platforms: ['codex'],
        lang: 'zh',
        preference: { value: true, source: 'stored' },
      });
      applyUserLanguageSyncPlan(enable);
      const agentsPath = path.join(codexHome, 'AGENTS.md');
      fs.writeFileSync(agentsPath, `before\n${fs.readFileSync(agentsPath, 'utf8')}\nafter\n`, 'utf8');

      const disable = buildUserLanguageSyncPlan({
        projectRoot,
        platforms: ['codex'],
        lang: 'zh',
        preference: { value: false, source: 'stored' },
      });
      const result = applyUserLanguageSyncPlan(disable);

      expect(result.exit_code).toBe(0);
      const agents = fs.readFileSync(agentsPath, 'utf8');
      expect(agents).toContain('before');
      expect(agents).toContain('after');
      expect(agents).not.toContain('<!-- spec-first:user-language:start -->');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
      fs.rmSync(codexHome, { recursive: true, force: true });
    }
  });

  test('disable apply does not recreate a user file removed after planning', () => {
    const projectRoot = makeTempDir();
    const codexHome = makeTempDir('spec-first-codex-home-');
    process.env.CODEX_HOME = codexHome;
    const agentsPath = path.join(codexHome, 'AGENTS.md');
    fs.writeFileSync(agentsPath, 'before\n<!-- spec-first:user-language:start -->\nold\n<!-- spec-first:user-language:end -->\nafter\n', 'utf8');

    try {
      const disable = buildUserLanguageSyncPlan({
        projectRoot,
        platforms: ['codex'],
        lang: 'zh',
        preference: { value: false, source: 'stored' },
      });
      fs.rmSync(agentsPath, { force: true });
      const result = applyUserLanguageSyncPlan(disable);

      expect(result.exit_code).toBe(0);
      expect(result.operations[0].action).toBe('missing/no-op');
      expect(fs.existsSync(agentsPath)).toBe(false);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
      fs.rmSync(codexHome, { recursive: true, force: true });
    }
  });

  test('profile write failure is a user-language sync failure', () => {
    const projectRoot = makeTempDir();
    const codexHome = makeTempDir('spec-first-codex-home-');
    process.env.CODEX_HOME = codexHome;
    fs.writeFileSync(path.join(isolatedHome, '.spec-first'), 'not a directory', 'utf8');

    try {
      const plan = buildUserLanguageSyncPlan({
        projectRoot,
        platforms: ['codex'],
        lang: 'zh',
        preference: { value: true, source: 'explicit' },
      });
      const result = applyUserLanguageSyncPlan(plan);

      expect(result.exit_code).toBe(1);
      expect(result.profileOperation.reason).toBe('user-language-profile-write-failed');
      expect(fs.existsSync(path.join(codexHome, 'AGENTS.md'))).toBe(true);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
      fs.rmSync(codexHome, { recursive: true, force: true });
    }
  });
});
