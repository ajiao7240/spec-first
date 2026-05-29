'use strict';

const {
  BrandColors,
  colorize,
  detectColorSupport,
  renderFullArt,
  renderWordmark,
} = require('../../src/cli/brand');

const ANSI_PATTERN = /\x1B\[[0-?]*[ -/]*[@-~]/;

function withColorEnv(env, isTTY, fn) {
  const previousEnv = { ...process.env };
  const previousDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
  process.env = {
    ...previousEnv,
    ...env,
  };
  for (const key of ['NO_COLOR', 'FORCE_COLOR', 'TERM']) {
    if (!Object.prototype.hasOwnProperty.call(env, key)) {
      delete process.env[key];
    }
  }
  Object.defineProperty(process.stdout, 'isTTY', {
    configurable: true,
    value: isTTY,
  });

  try {
    return fn();
  } finally {
    process.env = previousEnv;
    if (previousDescriptor) {
      Object.defineProperty(process.stdout, 'isTTY', previousDescriptor);
    } else {
      delete process.stdout.isTTY;
    }
  }
}

function visibleLines(text) {
  return text.trimEnd().split('\n');
}

describe('brand rendering', () => {
  test('detectColorSupport honors NO_COLOR before FORCE_COLOR', () => {
    withColorEnv({ NO_COLOR: '1', FORCE_COLOR: '1' }, true, () => {
      expect(detectColorSupport()).toBe(false);
    });
  });

  test('detectColorSupport honors FORCE_COLOR even without a TTY', () => {
    withColorEnv({ FORCE_COLOR: '1' }, undefined, () => {
      expect(detectColorSupport()).toBe(true);
    });
  });

  test('detectColorSupport rejects non-TTY and TERM=dumb', () => {
    withColorEnv({}, undefined, () => {
      expect(detectColorSupport()).toBe(false);
    });
    withColorEnv({ TERM: 'dumb' }, true, () => {
      expect(detectColorSupport()).toBe(false);
    });
  });

  test('colorize can emit or suppress ANSI codes', () => {
    expect(colorize('hello', BrandColors.brand, false)).toBe('hello');
    expect(colorize('hello', BrandColors.brand, true)).toBe(`${BrandColors.brand}hello${BrandColors.reset}`);
  });

  test('renderFullArt keeps plain output ANSI-free and aligned across version lengths', () => {
    const shortVersion = renderFullArt('0.1.0', { useColor: false });
    const longVersion = renderFullArt('0.99.0-beta.10', { useColor: false });
    const shortLines = visibleLines(shortVersion);
    const longLines = visibleLines(longVersion);

    expect(shortVersion).not.toMatch(ANSI_PATTERN);
    expect(new Set(shortLines.map((line) => line.length)).size).toBe(1);
    expect(new Set(longLines.map((line) => line.length)).size).toBe(1);
    expect(shortLines[0].length).toBe(longLines[0].length);
  });

  test('renderWordmark returns one visible line', () => {
    expect(renderWordmark('1.0.0', { useColor: false })).toBe('spec-first v1.0.0');
    expect(renderWordmark('1.0.0', { useColor: false })).not.toContain('\n');
  });

  test('explicit useColor avoids consulting terminal color detection', () => {
    withColorEnv({ NO_COLOR: '1' }, false, () => {
      expect(renderFullArt('1.0.0', { useColor: true })).toMatch(ANSI_PATTERN);
      expect(renderWordmark('1.0.0', { useColor: true })).toMatch(ANSI_PATTERN);
    });
  });
});
