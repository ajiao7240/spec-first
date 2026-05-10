'use strict';

const MINIMUM_NODE_MAJOR = 20;

function parseNodeMajor(version) {
  const match = /^v?(\d+)\./.exec(String(version || ''));
  return match ? Number.parseInt(match[1], 10) : NaN;
}

function isSupportedNodeVersion(version = process.version) {
  const major = parseNodeMajor(version);
  return Number.isFinite(major) && major >= MINIMUM_NODE_MAJOR;
}

function formatUnsupportedNodeMessage(version = process.version) {
  return [
    `spec-first requires Node.js >=${MINIMUM_NODE_MAJOR}.0.0.`,
    `Current Node.js: ${version || 'unknown'}.`,
    'Install Node.js 20 or newer, then retry this command.',
  ].join(' ');
}

function ensureSupportedNodeVersion(options = {}) {
  const output = options.output || process.stderr;
  const version = options.version || process.version;

  if (isSupportedNodeVersion(version)) {
    return true;
  }

  output.write(`${formatUnsupportedNodeMessage(version)}\n`);
  return false;
}

module.exports = {
  MINIMUM_NODE_MAJOR,
  ensureSupportedNodeVersion,
  formatUnsupportedNodeMessage,
  isSupportedNodeVersion,
  parseNodeMajor,
};
