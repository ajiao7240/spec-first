const { spawnSync } = require('node:child_process');

const DEFAULT_EXTERNAL_COMMAND_TIMEOUT_MS = 3000;

function resolveExternalCommandTimeoutMs() {
  const raw = process.env.SPEC_FIRST_EXTERNAL_COMMAND_TIMEOUT_MS;
  const value = Number.parseInt(raw || '', 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_EXTERNAL_COMMAND_TIMEOUT_MS;
}

function spawnSyncWithTimeout(command, args = [], options = {}) {
  if (typeof command !== 'string' || command.length === 0) {
    throw new TypeError('external command must be a non-empty string');
  }
  if (!Array.isArray(args)) {
    throw new TypeError('external command args must be an array');
  }

  const timeout = Number.isFinite(options.timeout) && options.timeout > 0
    ? options.timeout
    : resolveExternalCommandTimeoutMs();
  return spawnSync(command, args, {
    ...options,
    env: options.env || process.env,
    shell: false,
    timeout,
    windowsHide: true,
  });
}

function isCommandTimeout(result) {
  return Boolean(result && result.error && result.error.code === 'ETIMEDOUT');
}

module.exports = {
  DEFAULT_EXTERNAL_COMMAND_TIMEOUT_MS,
  isCommandTimeout,
  resolveExternalCommandTimeoutMs,
  spawnSyncWithTimeout,
};
