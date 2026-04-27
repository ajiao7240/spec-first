#!/usr/bin/env node

const pkg = require('../package.json');

const ver = `spec-first v${pkg.version}`;
const LINE = '─'.repeat(50);

process.stdout.write(`
┌${LINE}┐
│  ${ver.padEnd(48)}│
│  安装完成                                      │
└${LINE}┘

  下一步：spec-first doctor
        spec-first init --claude 或 spec-first init --codex
  详情：  spec-first -v
  说明：  managed assets 由 init/clean 管理，按 Claude/Codex host 生成

`);
