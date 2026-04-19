#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    encoding: 'utf8',
    shell: false,
  });

  if (result.error) {
    fail(`${command} ${args.join(' ')} 运行失败: ${result.error.message}`);
  }

  if (result.status !== 0) {
    fail(`${command} ${args.join(' ')} 退出码 ${result.status ?? 'null'}`);
  }
}

function readPackageJson() {
  return JSON.parse(readFileSync(packageJsonPath, 'utf8'));
}

function writePackageJson(pkg) {
  writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

function isSemver(value) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/.test(value);
}

function bumpVersion(currentVersion, releaseType) {
  const match = currentVersion.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    fail(`当前 package.json version 不合法: ${currentVersion}`);
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  switch (releaseType) {
    case 'auto':
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'major':
      return `${major + 1}.0.0`;
    default:
      return releaseType;
  }
}

const args = process.argv.slice(2);
const requestedVersion = args.find((arg) => !arg.startsWith('-'));
const dryRun = args.includes('--dry-run');
const pkg = readPackageJson();

if (!requestedVersion) {
  fail('缺少版本参数。用法：pnpm run release:publish -- <version>|auto|patch|minor|major [--dry-run]');
}

const targetVersion = ['auto', 'patch', 'minor', 'major'].includes(requestedVersion)
  ? bumpVersion(pkg.version, requestedVersion)
  : requestedVersion;

if (!isSemver(targetVersion)) {
  fail(`版本号不合法: ${requestedVersion}`);
}

console.log('══════════════════════════════════════');
console.log('  Spec-First 发布流程');
console.log('══════════════════════════════════════');
console.log(`▸ 包名: ${pkg.name}`);
console.log(`▸ 当前版本: ${pkg.version}`);
console.log(`▸ 目标版本: ${targetVersion}`);
console.log(`▸ 模式: ${dryRun ? 'dry-run' : 'publish'}`);

if (requestedVersion !== targetVersion) {
  console.log(`▸ ${requestedVersion} 已解析为 ${targetVersion}`);
}

if (!dryRun) {
  const nextPkg = { ...pkg, version: targetVersion };
  writePackageJson(nextPkg);
  console.log(`▸ 已将 package.json version 更新为 ${targetVersion}`);
}

const effectivePkg = readPackageJson();
if (dryRun && effectivePkg.version !== pkg.version) {
  fail('dry-run 不应修改 package.json version');
}
if (!dryRun && effectivePkg.version !== targetVersion) {
  fail(`版本写入失败：package.json=${effectivePkg.version}，目标=${targetVersion}`);
}

console.log('\n▸ 运行发布前校验...');
run('npm', ['run', 'test:release']);

console.log('\n▸ 生成发布 tarball...');
run('npm', ['pack']);

if (dryRun) {
  console.log(`\n✓ Dry-run 完成，未实际发布；当前 package.json 仍为 ${effectivePkg.version}`);
  process.exit(0);
}

console.log('\n▸ 发布到 npm...');
run('npm', ['publish']);

console.log(`\n✓ 已发布 ${effectivePkg.name}@${effectivePkg.version}`);
