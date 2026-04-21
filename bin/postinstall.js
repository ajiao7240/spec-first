#!/usr/bin/env node

const path = require('node:path');
const pkg = require('../package.json');
const { execFileSync, spawnSync } = require('node:child_process');

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

// 修复 CRG 原生模块（better-sqlite3 是 optionalDependency，安装失败时主动修复）
repairCrgNativeModule();

function probeBetterSqlite() {
  try { require('better-sqlite3'); return true; } catch (_) { return false; }
}

function findBetterSqliteDir() {
  try {
    return path.dirname(require.resolve('better-sqlite3/package.json'));
  } catch (_) { return null; }
}

function findPrebuildInstallBin(sqliteDir) {
  const searchPaths = [
    sqliteDir,
    path.join(sqliteDir, 'node_modules'),
    path.join(__dirname, '..', 'node_modules'),
    __dirname,
  ].filter(Boolean);
  try {
    return require.resolve('prebuild-install/bin.js', { paths: searchPaths });
  } catch (_) { return null; }
}

function repairCrgNativeModule() {
  if (probeBetterSqlite()) return;

  const sqliteDir = findBetterSqliteDir();
  if (!sqliteDir) {
    showCrgHint(null);
    return;
  }

  process.stdout.write('  正在修复 CRG 原生模块 (better-sqlite3)...\n');

  // Strategy 1: prebuild-install + SSL bypass（覆盖企业代理 / 证书拦截场景）
  const prebuildBin = findPrebuildInstallBin(sqliteDir);
  if (prebuildBin) {
    const r1 = spawnSync(process.execPath, [prebuildBin, '--tag-prefix', 'v'], {
      cwd: sqliteDir,
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' },
      timeout: 60000,
      encoding: 'utf8',
    });
    if (r1.status === 0 && probeBetterSqlite()) {
      process.stdout.write('  CRG 原生模块修复成功 (预编译包)\n\n');
      return;
    }
  }

  // Strategy 2: node-gyp rebuild（需要 C++ 编译环境）
  const r2 = spawnSync('node-gyp', ['rebuild', '--release'], {
    cwd: sqliteDir,
    timeout: 120000,
    encoding: 'utf8',
    shell: true,
  });
  if (r2.status === 0 && probeBetterSqlite()) {
    process.stdout.write('  CRG 原生模块修复成功 (从源码编译)\n\n');
    return;
  }

  showCrgHint(sqliteDir);
}

function showCrgHint(sqliteDir) {
  const isWin = process.platform === 'win32';
  const rebuildBase = sqliteDir
    ? `cd "${sqliteDir}" && node "${findPrebuildInstallBin(sqliteDir) || 'node_modules/prebuild-install/bin.js'}" --tag-prefix v`
    : `npm rebuild better-sqlite3`;
  const sslPrefix = isWin ? 'set NODE_TLS_REJECT_UNAUTHORIZED=0 &&' : 'NODE_TLS_REJECT_UNAUTHORIZED=0';
  const vsUrl = 'https://aka.ms/vs/17/release/vs_BuildTools.exe';

  process.stdout.write(
    `  注意: CRG 原生模块 (better-sqlite3) 不可用\n` +
    `  spec-first init / doctor / clean 正常，spec-first crg 暂不可用\n\n` +
    `  修复方法（任选一）:\n` +
    `  1. 绕过 SSL 重新下载预编译包:\n` +
    `     ${sslPrefix} ${rebuildBase}\n` +
    `  2. 安装 VS Build Tools 2022 后执行 npm rebuild better-sqlite3\n` +
    `     ${isWin ? vsUrl : '（当前平台不适用）'}\n\n`
  );
}
