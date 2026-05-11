const fs = require('node:fs');
const path = require('node:path');

const GITNEXUS_START = '<!-- gitnexus:start -->';
const GITNEXUS_END = '<!-- gitnexus:end -->';
const GUIDANCE_FILES = ['AGENTS.md', 'CLAUDE.md'];

function renderGitNexusInstructionBlock(options = {}) {
  const repoName = sanitizeRepoName(options.repoName || 'unknown');
  const lang = options.lang === 'en' ? 'en' : 'zh';
  const body = lang === 'en'
    ? renderEnglishGitNexusBody(repoName)
    : renderChineseGitNexusBody(repoName);

  return `${GITNEXUS_START}\n${body}\n${GITNEXUS_END}`;
}

function normalizeGitNexusInstructionBlock(existing, options = {}) {
  const content = typeof existing === 'string' ? existing : '';

  const startIdx = content.indexOf(GITNEXUS_START);
  const endIdx = content.indexOf(GITNEXUS_END);
  if (startIdx === -1 && endIdx === -1) {
    if (options.createMissing) {
      const repoName = sanitizeRepoName(options.defaultRepoName || 'unknown');
      const lang = options.lang || detectInstructionLanguage(content);
      const nextBlock = renderGitNexusInstructionBlock({ repoName, lang });
      return {
        status: 'created',
        content: appendGitNexusInstructionBlock(content, nextBlock),
        changed: true,
        repoName,
      };
    }

    return {
      status: 'missing',
      content,
      changed: false,
      repoName: '',
    };
  }

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return {
      status: 'partial',
      content,
      changed: false,
      repoName: '',
    };
  }

  const blockEnd = endIdx + GITNEXUS_END.length;
  const currentBlock = content.slice(startIdx, blockEnd);
  const repoName = extractGitNexusRepoName(currentBlock, options.defaultRepoName);
  const lang = options.lang || detectInstructionLanguage(content);
  const nextBlock = renderGitNexusInstructionBlock({ repoName, lang });
  const nextContent = `${content.slice(0, startIdx)}${nextBlock}${content.slice(blockEnd)}`;

  return {
    status: nextContent === content ? 'already-current' : 'updated',
    content: nextContent,
    changed: nextContent !== content,
    repoName,
  };
}

function normalizeGitNexusInstructionFiles(projectRoot, options = {}) {
  const results = [];
  for (const fileName of GUIDANCE_FILES) {
    const filePath = path.join(projectRoot, fileName);
    if (!fs.existsSync(filePath)) {
      results.push({
        file: fileName,
        status: 'missing-file',
        changed: false,
        repoName: '',
      });
      continue;
    }

    const existing = fs.readFileSync(filePath, 'utf8');
    const result = normalizeGitNexusInstructionBlock(existing, {
      createMissing: options.createMissing,
      defaultRepoName: options.defaultRepoName || path.basename(projectRoot),
      lang: options.lang,
    });
    if (options.write && result.changed) {
      writeFileAtomic(filePath, result.content);
    }
    const action = describeInstructionFileAction(result, options.write);
    results.push({
      file: fileName,
      status: result.status,
      changed: result.changed,
      wouldChange: result.changed,
      written: Boolean(options.write && result.changed),
      action,
      repoName: result.repoName,
    });
  }
  return results;
}

function runGitNexusInstructionBlockCommand(argv) {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    printHelp();
    return 0;
  }

  if (parsed.error) {
    console.error(`gitnexus-instruction: ${parsed.error}`);
    return 2;
  }

  if (parsed.subcommand !== 'normalize') {
    console.error('gitnexus-instruction: expected subcommand "normalize"');
    return 2;
  }

  const projectRoot = path.resolve(parsed.repoRoot || process.cwd());
  const results = normalizeGitNexusInstructionFiles(projectRoot, {
    write: parsed.write,
    createMissing: true,
    lang: parsed.lang,
    defaultRepoName: parsed.repoName || path.basename(projectRoot),
  });
  const summary = summarizeGitNexusInstructionResults(results);

  if (parsed.json) {
    process.stdout.write(`${JSON.stringify({
      schema_version: 'gitnexus-instruction-normalize.v1',
      repo_root: projectRoot,
      write: parsed.write,
      overall_status: summary.overallStatus,
      reason_code: summary.reasonCode,
      results,
    }, null, 2)}\n`);
  } else if (!parsed.quiet) {
    if (summary.reasonCode === 'gitnexus-instruction-block-partial') {
      console.error('gitnexus-instruction: found a partial GitNexus instruction block; repair the start/end markers before normalizing.');
    }
    for (const result of results) {
      if (result.action !== 'none') {
        console.log(`${formatInstructionAction(result.action)} ${result.file}`);
      }
    }
  }

  return summary.exitCode;
}

function summarizeGitNexusInstructionResults(results) {
  if (results.some((result) => result.status === 'partial')) {
    return {
      overallStatus: 'partial',
      reasonCode: 'gitnexus-instruction-block-partial',
      exitCode: 3,
    };
  }

  if (results.some((result) => (result.status === 'updated' || result.status === 'created') && result.changed)) {
    return {
      overallStatus: 'normalized',
      reasonCode: null,
      exitCode: 0,
    };
  }

  if (results.some((result) => result.status === 'already-current')) {
    return {
      overallStatus: 'unchanged',
      reasonCode: null,
      exitCode: 0,
    };
  }

  return {
    overallStatus: 'not-applicable',
    reasonCode: results.some((result) => result.status === 'missing-file')
      ? 'gitnexus-instruction-file-missing'
      : 'gitnexus-instruction-block-missing',
    exitCode: 0,
  };
}

function extractGitNexusRepoName(block, fallback = 'unknown') {
  const patterns = [
    /This project is indexed by GitNexus as \*\*([^*]+)\*\*/u,
    /This project has GitNexus graph support for \*\*([^*]+)\*\*/u,
    /本项目已配置 GitNexus 图谱支持，仓库标识：\*\*([^*]+)\*\*/u,
  ];

  for (const pattern of patterns) {
    const match = block.match(pattern);
    if (match && match[1]) {
      return sanitizeRepoName(match[1]);
    }
  }

  return sanitizeRepoName(fallback || 'unknown');
}

function detectInstructionLanguage(content) {
  const langBlock = extractManagedLanguageBlock(content);
  if (langBlock.includes('English / 英文') || langBlock.includes('Language setting:')) {
    return 'en';
  }
  if (langBlock.includes('Chinese / 中文') || langBlock.includes('语言设置')) {
    return 'zh';
  }
  return 'zh';
}

function extractManagedLanguageBlock(content) {
  const start = content.indexOf('<!-- spec-first:lang:start -->');
  const end = content.indexOf('<!-- spec-first:lang:end -->');
  if (start === -1 || end === -1 || end <= start) {
    return '';
  }
  return content.slice(start, end);
}

function renderChineseGitNexusBody(repoName) {
  return `# GitNexus — Code Intelligence

本项目已配置 GitNexus 图谱支持，仓库标识：**${repoName}**。当索引新鲜且 query-ready 时，优先把 GitNexus 作为代码理解、影响分析和审查证据来源。

本 block 是 spec-first 生成的轻量 GitNexus 使用边界。使用证据时，以本 block、\`.spec-first/graph/*\` readiness facts、源码和测试结果为准。

## 适用场景

- 在大范围代码修改前，查找 execution flows、架构上下文和 symbol relationships。
- 对共享函数、类、方法、路由和跨模块改动做 blast radius 检查。
- 在 commit 或 review 前运行 change detection，对比预期与实际受影响流程。

## 使用边界

- 将 stale、degraded、definitions-only 或 unavailable 的 GitNexus 结果视为有限证据。
- 不要让 GitNexus 替代直接源码阅读、测试或 spec-first workflow 判断。
- 如果 GitNexus 证据与源码、测试或 compiled readiness facts 冲突，明确说明冲突并优先采用已验证事实。`;
}

function renderEnglishGitNexusBody(repoName) {
  return `# GitNexus — Code Intelligence

This project has GitNexus graph support for **${repoName}**. When the index is fresh and query-ready, prefer GitNexus as evidence for code understanding, impact analysis, and review.

This block is the lightweight GitNexus usage boundary generated by spec-first. When consuming evidence, use this block, \`.spec-first/graph/*\` readiness facts, source code, and test results as the local authority.

## Use For

- Find execution flows, architecture context, and symbol relationships before broad code changes.
- Check blast radius for shared functions, classes, methods, routes, and cross-module changes.
- Run change detection before commit or review to compare expected and actual affected flows.

## Boundaries

- Treat stale, degraded, definitions-only, or unavailable GitNexus results as limited evidence.
- Do not let GitNexus replace direct source reads, tests, or spec-first workflow judgment.
- If GitNexus evidence conflicts with source, tests, or compiled readiness facts, disclose the conflict and prefer verified facts.`;
}

function sanitizeRepoName(value) {
  return String(value || 'unknown')
    .replace(/[\r\n]/g, ' ')
    .replace(/\*/g, '')
    .trim() || 'unknown';
}

function appendGitNexusInstructionBlock(existing, block) {
  if (!existing) {
    return `${block}\n`;
  }
  if (existing.endsWith('\n\n')) {
    return `${existing}${block}\n`;
  }
  if (existing.endsWith('\n')) {
    return `${existing}\n${block}\n`;
  }
  return `${existing}\n\n${block}\n`;
}

function describeInstructionFileAction(result, write) {
  if (!result.changed) {
    return 'none';
  }
  if (result.status === 'created') {
    return write ? 'created' : 'would-create';
  }
  if (result.status === 'updated') {
    return write ? 'normalized' : 'would-normalize';
  }
  return write ? 'updated' : 'would-update';
}

function formatInstructionAction(action) {
  switch (action) {
    case 'would-create':
      return 'would create';
    case 'would-normalize':
      return 'would normalize';
    case 'would-update':
      return 'would update';
    default:
      return action;
  }
}

function writeFileAtomic(filePath, content) {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function parseArgs(argv) {
  const parsed = {
    subcommand: '',
    repoRoot: '',
    repoName: '',
    lang: '',
    write: false,
    json: false,
    quiet: false,
    help: false,
    error: '',
  };

  const args = [...argv];
  parsed.subcommand = args.shift() || '';

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    if (arg === '--repo-root') {
      parsed.repoRoot = args.shift() || '';
      if (!parsed.repoRoot) {
        parsed.error = '--repo-root requires a value';
        break;
      }
      continue;
    }
    if (arg === '--repo-name') {
      parsed.repoName = args.shift() || '';
      if (!parsed.repoName) {
        parsed.error = '--repo-name requires a value';
        break;
      }
      continue;
    }
    if (arg === '--lang') {
      parsed.lang = args.shift() || '';
      if (parsed.lang !== 'zh' && parsed.lang !== 'en') {
        parsed.error = '--lang must be zh or en';
        break;
      }
      continue;
    }
    if (arg === '--write') {
      parsed.write = true;
      continue;
    }
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (arg === '--quiet') {
      parsed.quiet = true;
      continue;
    }
    parsed.error = `unknown option "${arg}"`;
    break;
  }

  return parsed;
}

function printHelp() {
  console.log([
    'Usage: spec-first gitnexus-instruction normalize [--repo-root <path>] [--repo-name <name>] [--lang zh|en] [--write] [--json] [--quiet]',
    '',
    'Create or normalize GitNexus instruction blocks into the spec-first evidence contract.',
  ].join('\n'));
}

module.exports = {
  GITNEXUS_END,
  GITNEXUS_START,
  renderGitNexusInstructionBlock,
  normalizeGitNexusInstructionBlock,
  normalizeGitNexusInstructionFiles,
  runGitNexusInstructionBlockCommand,
  summarizeGitNexusInstructionResults,
};
