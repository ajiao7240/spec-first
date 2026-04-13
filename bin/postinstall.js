#!/usr/bin/env node

const pkg = require('../package.json');
const { execFileSync } = require('node:child_process');

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

// 裁剪非当前平台的 native prebuild 和构建产物
try {
  const script = require.resolve('./prune-native.js');
  const stderr = execFileSync(process.execPath, [script], {
    timeout: 15000,
    stdio: ['ignore', 'ignore', 'pipe'],
    encoding: 'utf8',
  });
  if (stderr) process.stderr.write(stderr);
} catch (_) {
  // 裁剪失败不影响安装
}
