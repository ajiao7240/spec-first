#!/usr/bin/env node

// CommonJS 脚本无顶层 return，用 IIFE 统一错误处理
(function () {
  const { ensureSupportedNodeVersion } = require('../src/cli/node-version');

  if (!ensureSupportedNodeVersion()) {
    process.exitCode = 1;
    return;
  }

  const argv = process.argv.slice(2);

  const { runCli } = require('../src/cli');
  runCli(argv)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
})();
