'use strict';

const fs = require('node:fs');
const path = require('node:path');

// CRG 支持的子命令（17 个对外命令 + postprocess 管理命令）
const SUBCOMMANDS = [
  'build',
  'stats',
  'context',
  'query',
  'impact',
  'large-functions',
  'search',
  'flows',
  'flow',
  'affected-flows',
  'communities',
  'community',
  'architecture',
  'surprising-connections',
  'god-nodes',
  'detect-changes',
  'review-context',
  'locate',
  'path',
  'explain',
  'workflow-context',
  'hook',
  'postprocess',
];

// 子命令 → handler 模块路径映射（Unit 6/7/8/9 会创建这些文件）
// 值可以是路径字符串，也可以是 { module: path, fn: 'exportedFn' } 对象
const HANDLER_MAP = {
  'build':                 './build',
  'stats':                 { module: './build', fn: 'runStats' },
  'context':               './context',
  'query':                 './query',
  'impact':                '../commands/impact',
  'large-functions':       '../commands/large-functions',
  'search':                '../commands/search',
  'flows':                 '../commands/flows',
  'flow':                  '../commands/flow',
  'affected-flows':        '../commands/affected-flows',
  'communities':           '../commands/communities',
  'community':             '../commands/community',
  'architecture':          '../commands/architecture',
  'surprising-connections':'../commands/surprising-connections',
  'god-nodes':             '../commands/god-nodes',
  'detect-changes':        '../commands/detect-changes',
  'review-context':        '../commands/review-context',
  'locate':                '../commands/locate',
  'path':                  '../commands/path',
  'explain':               '../commands/explain',
  'workflow-context':      '../commands/workflow-context',
  'hook':                  '../commands/hook',
  'postprocess':           './postprocess',
};

/**
 * 解析 argv 中的 --repo=<path> 或 --repo <path>
 * 返回解析后的绝对路径，路径不合法时 exit 1
 */
function resolveRepoArg(args) {
  let repoRaw = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--repo=')) {
      repoRaw = args[i].slice('--repo='.length);
    } else if (args[i] === '--repo' && i + 1 < args.length) {
      repoRaw = args[i + 1];
    }
  }

  if (repoRaw === null) {
    return null;
  }

  const resolved = path.resolve(repoRaw);

  try {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      console.error(`error: --repo path is not a directory: ${resolved}`);
      process.exit(1);
    }
  } catch (_) {
    console.error(`error: --repo path does not exist: ${resolved}`);
    process.exit(1);
  }

  return resolved;
}

/**
 * 打印 crg 用法帮助
 */
function printHelp() {
  const lines = [
    'Usage: spec-first crg <subcommand> [options]',
    '',
    'Subcommands:',
    ...SUBCOMMANDS.map((cmd) => `  ${cmd}`),
    '',
    'Options:',
    '  --repo=<path>   Target repository root (required for most subcommands)',
    '  --help          Show this help message',
  ];
  console.log(lines.join('\n'));
}

/**
 * CRG 路由入口
 * @param {string[]} args  process.argv.slice(2).slice(1) — crg 后的参数
 */
function run(args) {
  const subCmd = args[0];

  // 无子命令或 --help
  if (!subCmd || subCmd === '--help' || subCmd === '-h') {
    printHelp();
    process.exit(0);
  }

  // 未知子命令
  if (!SUBCOMMANDS.includes(subCmd)) {
    console.error(`error: unknown crg subcommand '${subCmd}'`);
    console.error(`Run 'spec-first crg --help' to see available subcommands.`);
    process.exit(1);
  }

  // --repo 路径验证（若有）
  const resolvedRepo = resolveRepoArg(args.slice(1));

  // 重新组装传给 handler 的 argv（将 --repo 替换为绝对路径）
  let handlerArgs = args.slice(1);
  if (resolvedRepo !== null) {
    // 将原始 --repo=xxx 或 --repo xxx 替换为规范化的 --repo=<abs>
    handlerArgs = handlerArgs.filter((a, i, arr) => {
      if (a.startsWith('--repo=')) return false;
      if (a === '--repo') return false;
      // 跳过 --repo 后面的参数值
      if (i > 0 && arr[i - 1] === '--repo') return false;
      return true;
    });
    handlerArgs.push(`--repo=${resolvedRepo}`);
  }

  // 延迟 require handler，handler 模块在 Unit 6-9 才创建
  // HANDLER_MAP 值可以是路径字符串或 { module, fn } 对象
  const handlerEntry = HANDLER_MAP[subCmd];
  const handlerPath = typeof handlerEntry === 'string' ? handlerEntry : handlerEntry.module;
  const handlerFn   = typeof handlerEntry === 'string' ? 'run' : handlerEntry.fn;
  let resolvedHandlerPath;

  try {
    resolvedHandlerPath = require.resolve(handlerPath);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.error(`error: CRG graph not built, run "spec-first crg build --repo=<path>" first`);
      process.exit(2);
    }
    throw err;
  }

  let handler;
  try {
    handler = require(resolvedHandlerPath);
  } catch (err) {
    throw err;
  }

  // handler 模块需导出指定函数（默认 run）
  if (typeof handler[handlerFn] !== 'function') {
    console.error(`error: handler for '${subCmd}' does not export a ${handlerFn}() function`);
    process.exit(2);
  }

  handler[handlerFn](handlerArgs);
}

module.exports = { run };
