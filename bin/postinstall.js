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
  详情：  spec-first -v

`);
