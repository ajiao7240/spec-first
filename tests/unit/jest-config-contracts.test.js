'use strict';

const jestConfig = require('../../jest.config');

describe('jest config contracts', () => {
  test('ignores scratch worktrees and generated runtime roots', () => {
    expect(jestConfig.modulePathIgnorePatterns).toEqual(expect.arrayContaining([
      '<rootDir>/.worktrees/',
      '<rootDir>/.agents/',
      '<rootDir>/.claude/',
      '<rootDir>/.codex/',
      '<rootDir>/.spec-first/',
    ]));
    expect(jestConfig.testPathIgnorePatterns).toEqual(expect.arrayContaining([
      '<rootDir>/node_modules/',
      '<rootDir>/.worktrees/',
      '<rootDir>/.agents/',
      '<rootDir>/.claude/',
      '<rootDir>/.codex/',
      '<rootDir>/.spec-first/',
      '<rootDir>/tests/fixtures/ai-dev-benchmarks/',
    ]));
  });
});
