'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { detectGlobalCodexHookPollution } = require('../../src/cli/adapters/codex');
const { runDoctor } = require('../../src/cli/commands/doctor');
const { runProgrammaticInit, useIsolatedDeveloperHome } = require('./helpers/init-plan');

useIsolatedDeveloperHome();

function withCodexHome(codexHome, fn) {
  const prev = process.env.CODEX_HOME;
  const had = Object.prototype.hasOwnProperty.call(process.env, 'CODEX_HOME');
  process.env.CODEX_HOME = codexHome;
  try {
    return fn();
  } finally {
    if (had) {
      process.env.CODEX_HOME = prev;
    } else {
      delete process.env.CODEX_HOME;
    }
  }
}

function writeHooksJson(codexHome, value) {
  fs.mkdirSync(codexHome, { recursive: true });
  fs.writeFileSync(path.join(codexHome, 'hooks.json'), JSON.stringify(value));
}

function withCwd(cwd, fn) {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return fn();
  } finally {
    process.chdir(previous);
  }
}

function captureDoctor(cwd, args) {
  const logs = [];
  const errors = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (message = '') => logs.push(String(message));
  console.error = (message = '') => errors.push(String(message));
  try {
    const exitCode = withCwd(cwd, () => runDoctor(args));
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

describe('detectGlobalCodexHookPollution (doctor U2)', () => {
  let tmp;
  let codexHome;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-doctor-codex-'));
    codexHome = path.join(tmp, '.codex');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('reports pollution for a bare home-rooted SessionStart entry (the actual machine form)', () => {
    // This is the form that real machines hit: a global entry whose command is a bare
    // absolute path, which never equals a project's current exact command. A projectRoot
    // exact-match check would MISS this — the stale-tolerant predicate must catch it.
    writeHooksJson(codexHome, {
      hooks: {
        SessionStart: [
          { hooks: [{ type: 'command', command: path.join(codexHome, 'hooks/session-start') }] },
        ],
      },
    });
    withCodexHome(codexHome, () => {
      const result = detectGlobalCodexHookPollution();
      expect(result.polluted).toBe(true);
      expect(result.hooksJsonPath).toBe(path.join(codexHome, 'hooks.json'));
    });
  });

  test('not polluted when global hooks.json has no SessionStart', () => {
    writeHooksJson(codexHome, { hooks: {} });
    withCodexHome(codexHome, () => {
      expect(detectGlobalCodexHookPollution().polluted).toBe(false);
    });
  });

  test('not polluted when global hooks.json is absent', () => {
    fs.mkdirSync(codexHome, { recursive: true });
    withCodexHome(codexHome, () => {
      expect(detectGlobalCodexHookPollution().polluted).toBe(false);
    });
  });

  test('does not flag a non-spec-first SessionStart hook', () => {
    writeHooksJson(codexHome, {
      hooks: {
        SessionStart: [
          { hooks: [{ type: 'command', command: '/usr/local/bin/my-own-hook' }] },
        ],
      },
    });
    withCodexHome(codexHome, () => {
      expect(detectGlobalCodexHookPollution().polluted).toBe(false);
    });
  });

  test('does not flag a user hook whose program merely BEGINS with the managed path (suffix over-match guard)', () => {
    // A user's own script like `.codex/hooks/session-start-custom.sh` or `session-start.bak`
    // shares the managed path as a prefix but is a distinct program. The stale matcher must
    // require the managed path to END the token, so these are NOT flagged as spec-first managed.
    for (const command of [
      `${path.join(codexHome, 'hooks/session-start')}-custom.sh`,
      `${path.join(codexHome, 'hooks/session-start')}.bak`,
    ]) {
      writeHooksJson(codexHome, {
        hooks: { SessionStart: [{ hooks: [{ type: 'command', command }] }] },
      });
      withCodexHome(codexHome, () => {
        expect(detectGlobalCodexHookPollution().polluted).toBe(false);
      });
    }
  });

  test('does not flag a non-command-typed hook', () => {
    writeHooksJson(codexHome, {
      hooks: { SessionStart: [{ hooks: [{ type: 'notification', command: path.join(codexHome, 'hooks/session-start') }] }] },
    });
    withCodexHome(codexHome, () => {
      expect(detectGlobalCodexHookPollution().polluted).toBe(false);
    });
  });

  test('handles invalid JSON without throwing', () => {
    fs.mkdirSync(codexHome, { recursive: true });
    fs.writeFileSync(path.join(codexHome, 'hooks.json'), '{ not json');
    withCodexHome(codexHome, () => {
      const result = detectGlobalCodexHookPollution();
      expect(result.polluted).toBe(false);
      expect(result.invalidJson).toBe(true);
    });
  });
});

describe('doctor --codex CODEX_HOME hook skip reporting', () => {
  test('does not tell users to reinstall intentionally skipped project hooks', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-doctor-codexhome-'));
    const prevCodexHome = process.env.CODEX_HOME;
    process.env.CODEX_HOME = path.join(projectRoot, '.codex');
    const initLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      expect(withCwd(projectRoot, () => runProgrammaticInit({ projectRoot, platform: 'codex' }))).toBe(0);
      initLogSpy.mockRestore();

      const result = captureDoctor(projectRoot, ['--codex']);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('managed SessionStart hook intentionally skipped because project .codex is CODEX_HOME');
      expect(result.stdout).not.toContain('.codex/hooks/session-start: missing');
      expect(result.stdout).not.toContain('.codex/hooks.json: missing');
      expect(result.stdout).not.toContain('to install the managed SessionStart hook');
    } finally {
      if (initLogSpy.mockRestore) {
        initLogSpy.mockRestore();
      }
      if (prevCodexHome === undefined) {
        delete process.env.CODEX_HOME;
      } else {
        process.env.CODEX_HOME = prevCodexHome;
      }
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
