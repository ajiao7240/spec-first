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

  test('renderFullArt keeps plain output ANSI-free with stable dividers', () => {
    const shortVersion = renderFullArt('0.1.0', { useColor: false });
    const longVersion = renderFullArt('0.99.0-beta.10', { useColor: false });
    const shortLines = visibleLines(shortVersion);
    const longLines = visibleLines(longVersion);

    // Plain output must never leak ANSI escape sequences.
    expect(shortVersion).not.toMatch(ANSI_PATTERN);
    expect(longVersion).not.toMatch(ANSI_PATTERN);

    // New layout uses top/bottom divider lines (no ╔═╗ box). For each render,
    // first and last lines are pure `─` dividers of equal length. The block art
    // glyph itself contains box-drawing shadow chars (║ etc.), so we assert the
    // divider lines specifically, not "no box chars anywhere".
    for (const lines of [shortLines, longLines]) {
      const top = lines[0];
      const bottom = lines[lines.length - 1];
      expect(top).toMatch(/^─+$/);
      expect(bottom).toMatch(/^─+$/);
      expect(top.length).toBe(bottom.length);
      // No full-box corner characters on the divider rows.
      expect(top).not.toMatch(/[╔╗╚╝]/);
      expect(bottom).not.toMatch(/[╔╗╚╝]/);
    }

    // Divider width follows content, so a longer version never produces a
    // shorter divider than a shorter version.
    expect(longLines[0].length).toBeGreaterThanOrEqual(shortLines[0].length);

    // The six art glyph rows are rectangular (equal visible width).
    const artRows = shortLines.slice(1, 7);
    expect(new Set(artRows.map((line) => [...line].length)).size).toBe(1);
  });

  test('renderWordmark returns one visible line with brand prefix', () => {
    const plain = renderWordmark('1.0.0', { useColor: false });
    expect(plain).toBe('─ spec-first v1.0.0');
    expect(plain).not.toContain('\n');
    expect(plain).not.toMatch(ANSI_PATTERN);
  });

  test('explicit useColor avoids consulting terminal color detection', () => {
    withColorEnv({ NO_COLOR: '1' }, false, () => {
      expect(renderFullArt('1.0.0', { useColor: true })).toMatch(ANSI_PATTERN);
      expect(renderWordmark('1.0.0', { useColor: true })).toMatch(ANSI_PATTERN);
    });
  });
});
