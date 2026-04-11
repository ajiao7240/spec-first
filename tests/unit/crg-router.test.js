'use strict';

describe('crg router', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('handler 内部依赖缺失时不应误报 graph not built', () => {
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((code) => { throw new Error(`EXIT:${code}`); });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    jest.isolateModules(() => {
      jest.doMock('../../src/crg/cli/build', () => {
        const err = new Error("Cannot find module 'missing-dep'");
        err.code = 'MODULE_NOT_FOUND';
        err.requireStack = ['/virtual/build.js'];
        throw err;
      });

      const { run } = require('../../src/crg/cli/router');

      expect(() => run(['build'])).toThrow(/missing-dep/);
    });

    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('CRG graph not built')
    );
  });
});
