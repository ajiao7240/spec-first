'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  effectiveCodexHome,
  isCodexHomeProjectRoot,
} = require('../../src/cli/helpers/global-config-dir');

function withEnv(key, value, fn) {
  const had = Object.prototype.hasOwnProperty.call(process.env, key);
  const prev = process.env[key];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    if (had) {
      process.env[key] = prev;
    } else {
      delete process.env[key];
    }
  }
}

describe('global-config-dir helper', () => {
  describe('effectiveCodexHome', () => {
    test('defaults to ~/.codex when CODEX_HOME unset', () => {
      withEnv('CODEX_HOME', undefined, () => {
        expect(effectiveCodexHome()).toBe(path.join(os.homedir(), '.codex'));
      });
    });

    test('honors CODEX_HOME env when set', () => {
      withEnv('CODEX_HOME', '/work/codex', () => {
        expect(effectiveCodexHome()).toBe('/work/codex');
      });
    });

    test('ignores empty CODEX_HOME', () => {
      withEnv('CODEX_HOME', '   ', () => {
        expect(effectiveCodexHome()).toBe(path.join(os.homedir(), '.codex'));
      });
    });
  });

  describe('isCodexHomeProjectRoot (predicate = derived position, not HOME identity)', () => {
    let tmpHome;

    beforeEach(() => {
      tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-codexhome-'));
    });

    afterEach(() => {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    });

    test('matches when projectRoot/.codex resolves to default CODEX_HOME', () => {
      // Simulate "init in $HOME": projectRoot = home, .codex falls on ~/.codex.
      withEnv('CODEX_HOME', undefined, () => {
        const home = os.homedir();
        expect(isCodexHomeProjectRoot(home)).toBe(true);
      });
    });

    test('matches the relocated CODEX_HOME parent, NOT $HOME (env override)', () => {
      // The adapter always writes <projectRoot>/.codex, so pollution is only possible when
      // CODEX_HOME ends in `.codex`. Polluting projectRoot is then dirname(CODEX_HOME),
      // while $HOME is NOT polluting because ~/.codex is no longer what Codex reads.
      const codexHome = path.join(tmpHome, 'custom', '.codex');
      const pollutingRoot = path.join(tmpHome, 'custom');
      withEnv('CODEX_HOME', codexHome, () => {
        expect(isCodexHomeProjectRoot(pollutingRoot)).toBe(true);
        expect(isCodexHomeProjectRoot(os.homedir())).toBe(false);
      });
    });

    test('does not match an ordinary project directory', () => {
      withEnv('CODEX_HOME', undefined, () => {
        const project = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-project-'));
        try {
          expect(isCodexHomeProjectRoot(project)).toBe(false);
        } finally {
          fs.rmSync(project, { recursive: true, force: true });
        }
      });
    });

    test('returns false for empty/missing projectRoot', () => {
      expect(isCodexHomeProjectRoot('')).toBe(false);
      expect(isCodexHomeProjectRoot(undefined)).toBe(false);
    });
  });
});
