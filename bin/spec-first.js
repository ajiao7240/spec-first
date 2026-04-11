#!/usr/bin/env node

// CommonJS 脚本无顶层 return，用 IIFE 处理 crg 分支
(function () {
  const argv = process.argv.slice(2);

  // CRG 子命令延迟加载，不影响 init/doctor/clean 启动速度
  if (argv[0] === 'crg') {
    const { run } = require('../src/crg/cli/router');
    run(argv.slice(1));
    return;
  }

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
