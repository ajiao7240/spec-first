const BrandColors = {
  brand: '\x1b[36m',
  write: '\x1b[32m',
  remove: '\x1b[31m',
  untrack: '\x1b[33m',
  secondary: '\x1b[2m',
  reset: '\x1b[0m',
};

const INNER_WIDTH = 70;
const LOGO_LINES = [
  '  ____  ____  _____  ____        _____ ___ ____  ____ _____',
  ' / ___||  _ \\| ____|/ ___|      |  ___|_ _|  _ \\/ ___|_   _|',
  ' \\___ \\| |_) |  _| | |   _____ | |_   | || |_) \\___ \\ | |',
  '  ___) |  __/| |___| |__|_____|  _|  | ||  _ < ___) || |',
  ' |____/|_|   |_____|\\____|     |_|   |___|_| \\_\\____/ |_|',
];
const TAGLINE = 'AI coding harness for Claude Code & Codex';

function detectColorSupport() {
  if (Object.prototype.hasOwnProperty.call(process.env, 'NO_COLOR')) {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(process.env, 'FORCE_COLOR')) {
    return true;
  }
  if (process.stdout.isTTY !== true) {
    return false;
  }
  if (process.env.TERM === 'dumb') {
    return false;
  }
  return true;
}

function colorize(text, colorCode, useColor) {
  if (!useColor) {
    return text;
  }
  return `${colorCode}${text}${BrandColors.reset}`;
}

function renderFullArt(version, opts = {}) {
  const useColor = resolveUseColor(opts);
  const versionText = `Spec-First v${version || 'unknown'}`;
  const lines = [
    topBorder(),
    frameLine('', { useColor }),
    ...LOGO_LINES.map((line) => frameLine(line, { useColor })),
    frameLine('', { useColor }),
    frameLine(`  ${versionText}`, { useColor }),
    frameLine(`  ${TAGLINE}`, { useColor }),
    frameLine('', { useColor }),
    bottomBorder(),
  ];

  return `${lines.join('\n')}\n`;
}

function renderWordmark(version, opts = {}) {
  const useColor = resolveUseColor(opts);
  return `${colorize('spec-first', BrandColors.brand, useColor)} v${version || 'unknown'}`;
}

function resolveUseColor(opts) {
  if (Object.prototype.hasOwnProperty.call(opts, 'useColor')) {
    return opts.useColor === true;
  }
  return detectColorSupport();
}

function topBorder() {
  return `╔${'═'.repeat(INNER_WIDTH)}╗`;
}

function bottomBorder() {
  return `╚${'═'.repeat(INNER_WIDTH)}╝`;
}

function frameLine(text, { useColor }) {
  const padded = padRight(text, INNER_WIDTH);
  return `║${colorize(padded, BrandColors.brand, useColor)}║`;
}

function padRight(text, width) {
  const value = String(text);
  if (value.length >= width) {
    return value;
  }
  return `${value}${' '.repeat(width - value.length)}`;
}

module.exports = {
  BrandColors,
  colorize,
  detectColorSupport,
  renderFullArt,
  renderWordmark,
};
