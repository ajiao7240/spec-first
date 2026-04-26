'use strict';

const { inferEntrySource } = require('../../src/crg/flows/entrypoints');

describe('crg flow entrypoints', () => {
  test('将入口来源表达为候选信号而非运行时真相', () => {
    expect(inferEntrySource({ file_path: 'src/cli/build.js', name: 'run' })).toEqual(expect.objectContaining({
      entry_source: 'cli_like',
      entry_confidence: 'Inferred',
    }));
    expect(inferEntrySource({ file_path: 'src/routes/user.js', name: 'handler' })).toEqual(expect.objectContaining({
      entry_source: 'route_like',
      entry_confidence: 'Inferred',
    }));
    expect(inferEntrySource({ file_path: 'src/app.js', name: 'worker' })).toEqual(expect.objectContaining({
      entry_source: 'zero_in_degree_calls',
      entry_confidence: 'Inferred',
    }));
  });
});
