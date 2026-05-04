'use strict';

module.exports = {
  modulePathIgnorePatterns: [
    '<rootDir>/.worktrees/',
    '<rootDir>/.agents/',
    '<rootDir>/.claude/',
    '<rootDir>/.codex/',
    '<rootDir>/.spec-first/',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.worktrees/',
    '<rootDir>/.agents/',
    '<rootDir>/.claude/',
    '<rootDir>/.codex/',
    '<rootDir>/.spec-first/',
  ],
};
