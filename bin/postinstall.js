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
    sqliteDir ? path.join(sqliteDir, 'node_modules') : null,
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
  const plat = process.platform;
  const prebuildBin = sqliteDir ? (findPrebuildInstallBin(sqliteDir) || path.join(sqliteDir, 'node_modules', 'prebuild-install', 'bin.js')) : null;
  const rebuildCmd = prebuildBin
    ? `node "${prebuildBin}" --tag-prefix v`
    : `npm rebuild better-sqlite3`;

  let sslFixLines;
  if (plat === 'win32') {
    sslFixLines = [
      `  CMD:         set NODE_TLS_REJECT_UNAUTHORIZED=0 && ${rebuildCmd}`,
      `  PowerShell:  $env:NODE_TLS_REJECT_UNAUTHORIZED='0'; ${rebuildCmd}`,
    ];
  } else {
    sslFixLines = [`               NODE_TLS_REJECT_UNAUTHORIZED=0 ${rebuildCmd}`];
  }

  let compilerHint;
  if (plat === 'win32') {
    compilerHint = `  2. 安装 VS Build Tools 2022（勾选"Desktop development with C++"）后:\n` +
                   `     https://aka.ms/vs/17/release/vs_BuildTools.exe\n` +
                   `     npm rebuild better-sqlite3`;
  } else if (plat === 'darwin') {
    compilerHint = `  2. 安装 Xcode 命令行工具后:\n` +
                   `     xcode-select --install\n` +
                   `     npm rebuild better-sqlite3`;
  } else {
    compilerHint = `  2. 安装 C++ 编译环境后:\n` +
                   `     apt-get install -y build-essential python3  # Debian/Ubuntu\n` +
                   `     npm rebuild better-sqlite3`;
  }

  process.stdout.write(
    `  注意: CRG 原生模块 (better-sqlite3) 不可用\n` +
    `  spec-first init / doctor / clean 正常，spec-first crg 暂不可用\n\n` +
    `  修复方法（任选一）:\n` +
    `  1. 绕过 SSL 重新下载预编译包:\n` +
    sslFixLines.join('\n') + '\n' +
    compilerHint + '\n\n'
  );
}
