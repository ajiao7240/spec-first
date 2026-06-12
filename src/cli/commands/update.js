const { spawnSync } = require('node:child_process');

const pkg = require('../../../package.json');

const PACKAGE_NAME = pkg.name;
const UPGRADE_COMMAND = `npm install -g ${PACKAGE_NAME}@latest`;

/**
 * `spec-first update` — 实际执行 CLI 包升级。
 *
 * 设计边界(见 docs/plans/2026-06-12-003-feat-update-perform-upgrade-plan.md):
 * - 无条件直跑 `npm install -g spec-first@latest`:不查版本、不检测安装方式。
 *   npm 自身幂等,已是最新会自动 no-op。
 * - 升级成功后只提示用户运行 `spec-first init` 刷新本地 runtime,不代跑 init
 *   (用户用新装的 binary 另起 init,避免旧进程跑新生成逻辑的版本错位)。
 * - 已知风险(用户确认接受):非 npm-global 安装(Claude plugin / pnpm / volta 等)
 *   会被装出冲突副本;以一条静态 caveat 提示缓解,不做分支检测。
 * - 退出码:0=升级成功;1=升级失败(npm 未找到或返回非 0);2=用法错误。
 */
async function runUpdate(argv, deps = {}) {
  const args = [...argv];

  if (args.includes('-h') || args.includes('--help')) {
    printHelp();
    return 0;
  }

  // `--json` / `--claude` / `--codex` 等旧 check-only flag 已移除,视为用法错误。
  if (args.length > 0) {
    console.error(`Usage: spec-first update [-h|--help]`);
    return 2;
  }

  const runInstall = deps.runInstall || defaultRunInstall;

  console.log(`Upgrading ${PACKAGE_NAME} via: ${UPGRADE_COMMAND}`);
  console.log('');

  const result = runInstall();

  if (result && result.errorCode === 'ENOENT') {
    console.error('');
    console.error('Could not run npm: `npm` was not found on your PATH.');
    console.error('Install Node.js/npm (or run the upgrade with your own package manager), then retry.');
    return 1;
  }

  if (!result || result.status !== 0) {
    const status = result && Number.isInteger(result.status) ? result.status : 1;
    console.error('');
    console.error(`Upgrade failed (npm exited with code ${status}).`);
    console.error(`You can retry manually with: ${UPGRADE_COMMAND}`);
    return status || 1;
  }

  console.log('');
  console.log(`✅ ${PACKAGE_NAME} upgraded.`);
  console.log('Next step: run `spec-first init` to refresh this project\'s runtime assets.');
  console.log('');
  console.log('Note: if you installed spec-first as a Claude Code plugin (not via npm -g),');
  console.log('upgrade it with `claude plugin update` instead — npm -g manages a separate copy.');
  return 0;
}

// 默认 install 执行器:跨平台调用 npm,stdio 直通让 npm 进度直达用户。
// 返回 { status, errorCode },便于测试注入替身。
function defaultRunInstall() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, ['install', '-g', `${PACKAGE_NAME}@latest`], {
    stdio: 'inherit',
    windowsHide: true,
  });
  return {
    status: result.status,
    errorCode: result.error ? result.error.code : null,
  };
}

function printHelp() {
  console.log([
    '🔄 spec-first update — upgrade the spec-first CLI package',
    '',
    `Runs \`${UPGRADE_COMMAND}\` to upgrade the globally installed spec-first CLI,`,
    'then reminds you to run `spec-first init` to refresh this project\'s runtime assets.',
    '',
    '📘 Usage:',
    '  spec-first update',
    '',
    '⚙️  Options:',
    '  -h, --help      Show help',
    '',
    '🔢 Exit codes:',
    '  0  upgrade succeeded',
    '  1  upgrade failed (npm not found, or npm exited non-zero)',
    '  2  usage error (unexpected argument)',
    '',
    'Note: this upgrades the npm-installed spec-first package. If you use spec-first as a',
    'Claude Code plugin, upgrade it with `claude plugin update` inside Claude Code instead —',
    'npm -g manages a separate copy.',
    '',
    '🔗 Repository:',
    '  https://github.com/sunrain520/spec-first',
  ].join('\n'));
}

module.exports = {
  runUpdate,
};
