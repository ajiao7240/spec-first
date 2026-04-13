#!/usr/bin/env node

/**
 * prune-native.js — 安装后裁剪 tree-sitter grammar 包
 *
 * 每个 grammar 包默认包含 6 个平台的 prebuild + parser.c + grammar.js 等构建产物，
 * 用户实际只需要当前平台的 native binary。
 *
 * 本脚本在 postinstall 中运行，删除不需要的文件，将磁盘占用从 ~180MB 降到 ~35MB。
 */

const fs = require('node:fs');
const path = require('node:path');

const os = require('node:os');
const platform = os.platform();
const arch = os.arch();

// node-gyp-build 使用的目录名格式: {platform}-{arch}
const neededDir = `${platform}-${arch}`;

// 需要裁剪的 grammar 包目录
const grammarPackages = [
  'tree-sitter-c',
  'tree-sitter-c-sharp',
  'tree-sitter-cpp',
  'tree-sitter-go',
  'tree-sitter-java',
  'tree-sitter-javascript',
  'tree-sitter-kotlin',
  'tree-sitter-objc',
  'tree-sitter-php',
  'tree-sitter-python',
  'tree-sitter-ruby',
  'tree-sitter-rust',
  'tree-sitter-scala',
  'tree-sitter-swift',
  'tree-sitter-typescript',
];

// 需要删除的非当前平台 prebuild 目录名
const allPlatformDirs = [
  'darwin-arm64',
  'darwin-x64',
  'linux-arm64',
  'linux-x64',
  'win32-arm64',
  'win32-x64',
];

const prunePlatformDirs = allPlatformDirs.filter(d => d !== neededDir);

// 可安全删除的构建产物（相对于 grammar 包根目录）
const pruneFiles = [
  'src/parser.c',
  'src/grammar.json',
  'src/node-types.json',
  'src/tree_sitter',
  'grammar.js',
  'binding.gyp',
  'queries',
  'tree-sitter.json',
  // WASM 文件（已有 native prebuild 时不需要）
  // 保留 .wasm 作为 fallback —— 如果 native prebuild 缺失，WASM 可用
];

function findPackageRoot() {
  // 策略：从脚本所在目录向上查找包含 tree-sitter grammar 包的 node_modules
  // 场景 1: 全局安装 — {prefix}/lib/node_modules/spec-first/node_modules/
  // 场景 2: 项目安装 — {project}/node_modules/ (依赖提升到顶层)
  // 场景 3: 开发仓库 — repo/node_modules/ (file: symlink)

  let dir = path.resolve(__dirname);
  for (let i = 0; i < 10; i++) {
    const nmDir = path.join(dir, 'node_modules');
    if (fs.existsSync(nmDir)) {
      // 检查是否有 tree-sitter 包
      try {
        const entries = fs.readdirSync(nmDir);
        if (entries.some(e => e.startsWith('tree-sitter-'))) {
          return nmDir;
        }
      } catch (_) {}
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function rmRecursive(p) {
  if (!fs.existsSync(p)) return 0;
  let bytes = 0;
  try {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(p);
      for (const entry of entries) {
        bytes += rmRecursive(path.join(p, entry));
      }
      fs.rmdirSync(p);
    } else {
      bytes += stat.size;
      fs.unlinkSync(p);
    }
  } catch (_) {
    // 忽略权限或并发访问错误
  }
  return bytes;
}

function pruneGrammarPackage(pkgDir) {
  let freed = 0;

  // 1. 删除非当前平台的 prebuild 目录
  const prebuildsDir = path.join(pkgDir, 'prebuilds');
  if (fs.existsSync(prebuildsDir)) {
    for (const dir of prunePlatformDirs) {
      const target = path.join(prebuildsDir, dir);
      freed += rmRecursive(target);
    }
  }

  // 2. 删除构建产物
  for (const file of pruneFiles) {
    const target = path.join(pkgDir, file);
    freed += rmRecursive(target);
  }

  return freed;
}

function main() {
  const nmDir = findPackageRoot();
  if (!nmDir) {
    // 静默退出 —— 可能是开发环境或非标准安装
    return;
  }

  let totalFreed = 0;

  for (const pkg of grammarPackages) {
    const pkgDir = path.join(nmDir, pkg);
    if (!fs.existsSync(pkgDir)) continue;

    try {
      const stat = fs.lstatSync(pkgDir);
      if (stat.isSymbolicLink()) {
        // file: 协议的 vendor 包
        const linkTarget = fs.readlinkSync(pkgDir);
        const resolved = path.resolve(path.dirname(pkgDir), linkTarget);

        // 只裁剪包内的 vendor 目录（路径含 node_modules/spec-first/vendor/）
        // 不裁剪开发仓库的 vendor 目录（路径含 /spec-first/vendor/，且不在 node_modules/spec-first/ 内）
        if (resolved.includes(path.join('node_modules', 'spec-first', 'vendor'))) {
          totalFreed += pruneGrammarPackage(resolved);
        }
        continue;
      }
    } catch (_) { continue; }

    const freed = pruneGrammarPackage(pkgDir);
    totalFreed += freed;
  }

  if (totalFreed > 0) {
    const mb = (totalFreed / 1024 / 1024).toFixed(1);
    // 输出到 stderr 不干扰 npm lifecycle
    process.stderr.write(`  spec-first: native pruning freed ${mb} MB (${platform}-${arch})\n`);
  }
}

main();
