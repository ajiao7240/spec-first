'use strict';

function loadExternalCommand(spawnSync) {
  jest.resetModules();
  jest.doMock('node:child_process', () => ({ spawnSync }));
  return require('../../src/cli/external-command');
}

describe('external command runner', () => {
  const originalTimeout = process.env.SPEC_FIRST_EXTERNAL_COMMAND_TIMEOUT_MS;

  afterEach(() => {
    jest.resetModules();
    jest.dontMock('node:child_process');
    if (originalTimeout === undefined) {
      delete process.env.SPEC_FIRST_EXTERNAL_COMMAND_TIMEOUT_MS;
    } else {
      process.env.SPEC_FIRST_EXTERNAL_COMMAND_TIMEOUT_MS = originalTimeout;
    }
  });

  test('forces non-shell execution even if a caller passes shell true', () => {
    const spawnSync = jest.fn(() => ({ status: 0 }));
    const { spawnSyncWithTimeout } = loadExternalCommand(spawnSync);
    const env = { PATH: '/usr/bin' };

    const result = spawnSyncWithTimeout('git', ['--version'], {
      encoding: 'utf8',
      env,
      shell: true,
      timeout: 123,
      windowsHide: false,
    });

    expect(result).toEqual({ status: 0 });
    expect(spawnSync).toHaveBeenCalledWith('git', ['--version'], {
      encoding: 'utf8',
      env,
      shell: false,
      timeout: 123,
      windowsHide: true,
    });
  });

  test('uses configured timeout and rejects string command lines', () => {
    const spawnSync = jest.fn(() => ({ status: 0 }));
    const { spawnSyncWithTimeout } = loadExternalCommand(spawnSync);

    process.env.SPEC_FIRST_EXTERNAL_COMMAND_TIMEOUT_MS = '456';

    expect(() => spawnSyncWithTimeout('git --version', 'ignored')).toThrow('external command args must be an array');

    spawnSyncWithTimeout('git', ['--version'], { encoding: 'utf8' });
    expect(spawnSync).toHaveBeenCalledWith('git', ['--version'], expect.objectContaining({
      shell: false,
      timeout: 456,
      windowsHide: true,
    }));
  });
});
