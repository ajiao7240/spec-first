'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runInit } = require('../../src/cli/commands/init');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-init-interactive-'));
}

async function withCwd(cwd, fn) {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return await fn();
  } finally {
    process.chdir(previous);
  }
}

async function captureInit(cwd, args, promptOverrides = {}) {
  const logs = [];
  const errors = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (message = '') => logs.push(String(message));
  console.error = (message = '') => errors.push(String(message));
  try {
    const exitCode = await withCwd(cwd, () => runInit(args, promptOverrides));
    return {
      exitCode,
      stdout: logs.join('\n'),
      stderr: errors.join('\n'),
    };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

function interactivePrompts({
  platforms = ['codex'],
  name = 'reviewer',
  lang = 'zh',
  confirmed = true,
  workspaceTarget = null,
} = {}) {
  return {
    requireTty: () => ({ ok: true, reason: null }),
    checkbox: jest.fn((question) => {
      if (question.includes('host runtimes')) return Promise.resolve(platforms);
      return Promise.resolve([]);
    }),
    select: jest.fn((question, options) => {
      if (question.includes('response language')) return Promise.resolve(lang);
      if (question.includes('workspace target')) {
        if (workspaceTarget === 'single') return Promise.resolve(options[1].value);
        if (workspaceTarget === 'cancel') return Promise.resolve(null);
        return Promise.resolve(options[0].value);
      }
      return Promise.resolve(options[0].value);
    }),
    textInput: jest.fn(() => Promise.resolve(name)),
    confirm: jest.fn(() => Promise.resolve(confirmed)),
  };
}

function snapshotTree(rootDir) {
  const results = [];
  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, absolutePath);
      if (entry.isDirectory()) {
        results.push(`${relativePath}/`);
        walk(absolutePath);
        continue;
      }
      results.push(`${relativePath}:${fs.readFileSync(absolutePath, 'utf8')}`);
    }
  }
  walk(rootDir);
  return results.sort();
}

describe('interactive init command', () => {
  test('help describes interactive init plus Trellis-style host shortcuts', async () => {
    const projectRoot = makeTempDir();

    try {
      const result = await captureInit(projectRoot, ['--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('spec-first init');
      expect(result.stdout).toContain('Interactive steps');
      expect(result.stdout).toContain('Select one or more host runtimes');
      expect(result.stdout).toContain('spec-first init --codex');
      expect(result.stdout).toContain('spec-first init -y');
      expect(result.stdout).toContain('Explicit --claude/--codex flags override the default host set.');
      expect(result.stdout).not.toContain('--dry-run');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('unsupported init flags are rejected before prompting', async () => {
    const projectRoot = makeTempDir();
    const prompts = interactivePrompts();

    try {
      const result = await captureInit(projectRoot, ['--dry-run'], prompts);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('unknown option --dry-run');
      expect(result.stderr).toContain('Usage: spec-first init');
      expect(prompts.checkbox).not.toHaveBeenCalled();
      expect(snapshotTree(projectRoot)).toEqual([]);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('non-TTY init exits 2 without prompting or writing files', async () => {
    const projectRoot = makeTempDir();
    const prompts = {
      ...interactivePrompts(),
      requireTty: () => ({ ok: false, reason: 'no-stdin-tty' }),
    };

    try {
      const result = await captureInit(projectRoot, [], prompts);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('requires an interactive terminal');
      expect(prompts.select).not.toHaveBeenCalled();
      expect(snapshotTree(projectRoot)).toEqual([]);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('confirmed Codex init writes runtime assets through interactive answers', async () => {
    const projectRoot = makeTempDir();

    try {
      const result = await captureInit(projectRoot, [], interactivePrompts({ platforms: ['codex'] }));

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Dry run: spec-first init (codex)');
      expect(result.stdout).toContain('Generated');
      expect(fs.existsSync(path.join(projectRoot, 'AGENTS.md'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, '.agents', 'skills', 'spec-work', 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, '.codex', 'spec-first', '.developer'))).toBe(false);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('interactive host checkbox starts with no checked hosts', async () => {
    const projectRoot = makeTempDir();
    let hostChoices = [];
    const prompts = interactivePrompts({ platforms: ['codex'], confirmed: false });
    prompts.checkbox = jest.fn((_question, options) => {
      hostChoices = options;
      return Promise.resolve(['codex']);
    });

    try {
      const result = await captureInit(projectRoot, [], prompts);

      expect(result.exitCode).toBe(0);
      expect(hostChoices).toHaveLength(2);
      expect(hostChoices.every((choice) => choice.checked === false)).toBe(true);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('explicit host flag skips only the host checkbox', async () => {
    const projectRoot = makeTempDir();
    const prompts = interactivePrompts({ platforms: ['claude'] });

    try {
      const result = await captureInit(projectRoot, ['--codex'], prompts);

      expect(result.exitCode).toBe(0);
      expect(prompts.checkbox).not.toHaveBeenCalled();
      expect(prompts.textInput).toHaveBeenCalled();
      expect(result.stdout).toContain('Dry run: spec-first init (codex)');
      expect(fs.existsSync(path.join(projectRoot, 'AGENTS.md'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'CLAUDE.md'))).toBe(false);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('-y initializes default host runtimes without prompts', async () => {
    const projectRoot = makeTempDir();
    const prompts = interactivePrompts();
    prompts.requireTty = jest.fn(() => ({ ok: false, reason: 'no-stdin-tty' }));

    try {
      const result = await captureInit(projectRoot, ['-y', '-u', 'reviewer', '--lang', 'zh'], prompts);

      expect(result.exitCode).toBe(0);
      expect(prompts.requireTty).not.toHaveBeenCalled();
      expect(prompts.checkbox).not.toHaveBeenCalled();
      expect(prompts.textInput).not.toHaveBeenCalled();
      expect(prompts.confirm).not.toHaveBeenCalled();
      expect(fs.existsSync(path.join(projectRoot, 'CLAUDE.md'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'AGENTS.md'))).toBe(true);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('explicit host flag with -y initializes only that runtime', async () => {
    const projectRoot = makeTempDir();
    const prompts = interactivePrompts();
    prompts.requireTty = jest.fn(() => ({ ok: false, reason: 'no-stdin-tty' }));

    try {
      const result = await captureInit(projectRoot, ['--codex', '-y', '-u', 'reviewer', '--lang=zh'], prompts);

      expect(result.exitCode).toBe(0);
      expect(prompts.requireTty).not.toHaveBeenCalled();
      expect(fs.existsSync(path.join(projectRoot, 'AGENTS.md'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'CLAUDE.md'))).toBe(false);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('cancel at confirm leaves disk unchanged', async () => {
    const projectRoot = makeTempDir();
    const before = snapshotTree(projectRoot);

    try {
      const result = await captureInit(projectRoot, [], interactivePrompts({ confirmed: false }));

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('已取消');
      expect(snapshotTree(projectRoot)).toEqual(before);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('parent workspace can initialize all discovered child repos', async () => {
    const workspaceRoot = makeTempDir();
    const childA = path.join(workspaceRoot, 'child-a');
    const childB = path.join(workspaceRoot, 'child-b');

    try {
      fs.mkdirSync(path.join(childA, '.git'), { recursive: true });
      fs.mkdirSync(path.join(childB, '.git'), { recursive: true });

      const result = await captureInit(workspaceRoot, [], interactivePrompts({ platforms: ['claude'] }));

      expect(result.exitCode).toBe(0);
      expect(fs.existsSync(path.join(workspaceRoot, '.spec-first', 'workspace', 'init-summary.json'))).toBe(true);
      expect(fs.existsSync(path.join(workspaceRoot, 'CLAUDE.md'))).toBe(true);
      expect(fs.existsSync(path.join(childA, 'CLAUDE.md'))).toBe(true);
      expect(fs.existsSync(path.join(childB, 'CLAUDE.md'))).toBe(true);
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});
