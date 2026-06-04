'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { printInitDryRun, runInit } = require('../../src/cli/commands/init');
const { BrandColors } = require('../../src/cli/brand');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-init-interactive-'));
}

// 现有用例隐式依赖真实 ~/.spec-first/.developer,会让 init 走"沿用确认"分支并污染机器全局 profile。
// 仓库 jest 环境下 os.homedir() 无视 process.env.HOME,改用 spy 把 HOME 钉到隔离临时目录,
// 使「无全局 profile」成为默认基线,各用例按需写入。
let isolatedHome = null;
let homedirSpy = null;

beforeEach(() => {
  isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-init-home-'));
  homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(isolatedHome);
});

afterEach(() => {
  if (homedirSpy) {
    homedirSpy.mockRestore();
    homedirSpy = null;
  }
  if (isolatedHome) {
    fs.rmSync(isolatedHome, { recursive: true, force: true });
    isolatedHome = null;
  }
});

function writeGlobalDeveloperProfile({ name = 'leokuang', lang = 'zh' } = {}) {
  const dir = path.join(isolatedHome, '.spec-first');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, '.developer'),
    `name=${name}\nlang=${lang}\ninitialized_at=2026-06-04T00:00:00.000Z\nversion=test\n`,
    'utf8',
  );
}

function readGlobalDeveloperProfile() {
  const filePath = path.join(isolatedHome, '.spec-first', '.developer');
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
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

function isReusePrompt(question) {
  const text = String(question || '');
  return text.includes('沿用') || text.includes('Reuse');
}

function interactivePrompts({
  platforms = ['codex'],
  name = 'reviewer',
  lang = 'zh',
  confirmed = true,
  reuseGlobalProfile = true,
  workspaceTarget = null,
} = {}) {
  return {
    requireTty: () => ({ ok: true, reason: null }),
    checkbox: jest.fn(() => Promise.resolve(platforms)),
    select: jest.fn((question, options) => {
      if (options.some((option) => option.value === 'zh' || option.value === 'en')) return Promise.resolve(lang);
      if (options.some((option) => option.value === null || (option.value && option.value.mode))) {
        if (workspaceTarget === 'single') return Promise.resolve(options[1].value);
        if (workspaceTarget === 'cancel') return Promise.resolve(null);
        return Promise.resolve(options[0].value);
      }
      return Promise.resolve(options[0].value);
    }),
    textInput: jest.fn(() => Promise.resolve(name)),
    // confirm 承载两个语义:沿用全局 profile(reuse)与应用更改(apply),按 question 文本分流。
    confirm: jest.fn((question) => Promise.resolve(
      isReusePrompt(question) ? reuseGlobalProfile : confirmed,
    )),
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
      const result = await captureInit(projectRoot, ['--lang', 'zh'], prompts);

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
      const result = await captureInit(projectRoot, ['--lang', 'zh'], interactivePrompts({ platforms: ['codex'] }));

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Spec-First v');
      expect(result.stdout).toContain('spec-first init (codex)');
      expect(result.stdout).toContain('Generated');
      expect(result.stdout).toContain('重启');
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
      const result = await captureInit(projectRoot, ['--lang', 'zh'], prompts);

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
      expect(result.stdout).toContain('spec-first init (codex)');
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
      expect(result.stdout).not.toContain('Spec-First v');
      expect(result.stdout).not.toContain('spec-first v');
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
      const result = await captureInit(projectRoot, ['--lang', 'zh'], interactivePrompts({ confirmed: false }));

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('已取消');
      expect(snapshotTree(projectRoot)).toEqual(before);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('first interactive run prints full art before prompts', async () => {
    const projectRoot = makeTempDir();

    try {
      const result = await captureInit(projectRoot, [], interactivePrompts({ confirmed: false }));

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Spec-First v');
      expect(result.stdout).toContain('███████╗');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('existing managed state prints only the lightweight wordmark', async () => {
    const projectRoot = makeTempDir();
    fs.mkdirSync(path.join(projectRoot, '.claude', 'spec-first'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, '.claude', 'spec-first', 'state.json'), '{}\n', 'utf8');

    try {
      const result = await captureInit(projectRoot, [], interactivePrompts({ confirmed: false }));

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('spec-first v');
      expect(result.stdout).not.toContain('███████╗');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('existing managed state is detected from a repo subdirectory', async () => {
    const projectRoot = makeTempDir();
    const subdir = path.join(projectRoot, 'packages', 'tooling');
    fs.mkdirSync(path.join(projectRoot, '.git'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, '.codex', 'spec-first'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, '.codex', 'spec-first', 'state.json'), '{}\n', 'utf8');
    fs.mkdirSync(subdir, { recursive: true });

    try {
      const result = await captureInit(subdir, [], interactivePrompts({ confirmed: false }));

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('spec-first v');
      expect(result.stdout).not.toContain('███████╗');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('non-TTY rejection does not print a banner', async () => {
    const projectRoot = makeTempDir();
    const prompts = {
      ...interactivePrompts(),
      requireTty: () => ({ ok: false, reason: 'no-stdin-tty' }),
    };

    try {
      const result = await captureInit(projectRoot, ['--lang', 'zh'], prompts);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).not.toContain('Spec-First v');
      expect(result.stdout).not.toContain('spec-first v');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('explicit --lang en localizes interactive prompts and next steps', async () => {
    const projectRoot = makeTempDir();
    const prompts = interactivePrompts({ platforms: ['codex'], confirmed: true });

    try {
      const result = await captureInit(projectRoot, ['--codex', '--lang', 'en'], prompts);

      expect(result.exitCode).toBe(0);
      expect(prompts.textInput.mock.calls[0][0]).toContain('Developer name');
      expect(prompts.confirm.mock.calls.some((call) => call[0].includes('Apply these changes'))).toBe(true);
      expect(result.stdout).toContain('Dry run: spec-first init (codex)');
      expect(result.stdout).toContain('Restart Codex');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('interactive language choice localizes later workspace prompts and cancellation', async () => {
    const workspaceRoot = makeTempDir();
    const childA = path.join(workspaceRoot, 'child-a');
    const prompts = interactivePrompts({
      lang: 'en',
      workspaceTarget: 'cancel',
    });

    try {
      fs.mkdirSync(path.join(childA, '.git'), { recursive: true });

      const result = await captureInit(workspaceRoot, [], prompts);
      const workspaceCall = prompts.select.mock.calls.find((call) => (
        call[1].some((option) => option.value === null || (option.value && option.value.mode))
      ));

      expect(result.exitCode).toBe(0);
      expect(prompts.checkbox.mock.calls[0][0]).toContain('Select host runtimes');
      expect(prompts.checkbox.mock.calls[0][2].hint).toContain('Space toggle');
      expect(prompts.textInput.mock.calls[0][0]).toContain('Developer name');
      expect(workspaceCall[0]).toContain('Select workspace target');
      expect(workspaceCall[2].hint).toContain('Enter confirm');
      expect(result.stdout).toContain('Cancelled.');
      expect(result.stdout).not.toContain('已取消');
    } finally {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  test('host checkbox receives hint and min-selection feedback options', async () => {
    const projectRoot = makeTempDir();
    const prompts = interactivePrompts({ platforms: ['codex'], confirmed: false });

    try {
      const result = await captureInit(projectRoot, ['--lang', 'zh'], prompts);
      const checkboxOptions = prompts.checkbox.mock.calls[0][2];

      expect(result.exitCode).toBe(0);
      expect(checkboxOptions.hint).toContain('空格');
      expect(checkboxOptions.onMinError(1)).toContain('1');
      expect(checkboxOptions.onMinError(1)).toContain('至少');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('preview dry-run messages localize and color semantic counts', () => {
    const logs = [];
    const originalLog = console.log;
    console.log = (message = '') => logs.push(String(message));
    try {
      printInitDryRun({
        platform: 'codex',
        lang: 'zh',
        useColor: true,
        plan: {
          summary: {
            remove_file: 1,
            write_file: 2,
          },
          operations: [],
        },
        untrackDiagnostic: {
          reason_code: 'untracked-runtime',
          count: 1,
          sample_paths: ['.codex/spec-first/.developer'],
        },
        showPathSamples: false,
      });
    } finally {
      console.log = originalLog;
    }

    const output = logs.join('\n');
    expect(output).toContain('预览: spec-first init (codex)');
    expect(output).toContain('移除');
    expect(output).toContain(`${BrandColors.remove}1${BrandColors.reset}`);
    expect(output).toContain(`${BrandColors.write}2${BrandColors.reset}`);
    expect(output).toContain(`${BrandColors.untrack}1${BrandColors.reset}`);
  });

  test('preview dry-run can render English without ANSI codes', () => {
    const logs = [];
    const originalLog = console.log;
    console.log = (message = '') => logs.push(String(message));
    try {
      printInitDryRun({
        platform: 'claude',
        lang: 'en',
        useColor: false,
        plan: {
          summary: {
            remove_file: 1,
            write_file: 1,
          },
          operations: [],
        },
        showPathSamples: false,
      });
    } finally {
      console.log = originalLog;
    }

    const output = logs.join('\n');
    expect(output).toContain('Would remove 1 managed obsolete path(s).');
    expect(output).toContain('Would write/update 1 managed file(s).');
    expect(output).not.toMatch(/\x1B\[[0-?]*[ -/]*[@-~]/);
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

  test('existing global profile reuses name and lang without re-prompting', async () => {
    const projectRoot = makeTempDir();
    writeGlobalDeveloperProfile({ name: 'leokuang', lang: 'zh' });
    const prompts = interactivePrompts({ platforms: ['codex'], reuseGlobalProfile: true });

    try {
      const result = await captureInit(projectRoot, [], prompts);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      // 沿用确认弹出,但不再追问名字或语言。
      expect(prompts.confirm.mock.calls.some((call) => isReusePrompt(call[0]))).toBe(true);
      expect(prompts.textInput).not.toHaveBeenCalled();
      expect(prompts.select).not.toHaveBeenCalled();
      // 不弹覆盖确认,全局 profile 保持原值。
      expect(prompts.confirm.mock.calls.some((call) => String(call[0]).includes('覆盖'))).toBe(false);
      expect(readGlobalDeveloperProfile()).toContain('name=leokuang');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('declining reuse re-prompts for language and developer name', async () => {
    const projectRoot = makeTempDir();
    writeGlobalDeveloperProfile({ name: 'leokuang', lang: 'zh' });
    const prompts = interactivePrompts({
      platforms: ['codex'],
      reuseGlobalProfile: false,
      name: 'newname',
      lang: 'zh',
      confirmed: true,
    });

    try {
      const result = await captureInit(projectRoot, [], prompts);

      expect(result.exitCode).toBe(0);
      // 选 No 后补回语言选择与名字输入。
      expect(prompts.select).toHaveBeenCalled();
      expect(prompts.textInput).toHaveBeenCalled();
      // 改名后弹覆盖确认并写入新值。
      expect(prompts.confirm.mock.calls.some((call) => String(call[0]).includes('覆盖'))).toBe(true);
      expect(readGlobalDeveloperProfile()).toContain('name=newname');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('no global profile keeps the original name input flow', async () => {
    const projectRoot = makeTempDir();
    const prompts = interactivePrompts({ platforms: ['codex'], name: 'reviewer', lang: 'zh' });

    try {
      const result = await captureInit(projectRoot, [], prompts);

      expect(result.exitCode).toBe(0);
      // 无全局 profile:不弹沿用确认,直接走语言选择与名字输入框。
      expect(prompts.confirm.mock.calls.some((call) => isReusePrompt(call[0]))).toBe(false);
      expect(prompts.select).toHaveBeenCalled();
      expect(prompts.textInput).toHaveBeenCalled();
      expect(readGlobalDeveloperProfile()).toContain('name=reviewer');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
