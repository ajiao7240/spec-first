const fs = require('node:fs');
const path = require('node:path');
const { writeFileAtomic } = require('./atomic-write');

const GITNEXUS_START = '<!-- gitnexus:start -->';
const GITNEXUS_END = '<!-- gitnexus:end -->';
const GUIDANCE_FILES = ['AGENTS.md', 'CLAUDE.md'];
const GIT_ROOT_TOPOLOGIES = new Set(['single-repo', 'multi-repo-workspace']);

function renderGitNexusInstructionBlock(options = {}) {
  const repoName = sanitizeRepoName(options.repoName || 'unknown');
  const lang = options.lang === 'en' ? 'en' : 'zh';
  const gitRootTopology = normalizeGitRootTopology(options.gitRootTopology);
  const body = lang === 'en'
    ? renderEnglishGitNexusBody(repoName, gitRootTopology)
    : renderChineseGitNexusBody(repoName, gitRootTopology);

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
      const gitRootTopology = normalizeGitRootTopology(options.gitRootTopology);
      const nextBlock = renderGitNexusInstructionBlock({ repoName, lang, gitRootTopology });
      return {
        status: 'created',
        content: appendGitNexusInstructionBlock(content, nextBlock),
        changed: true,
        repoName,
        gitRootTopology,
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
  const gitRootTopology = normalizeGitRootTopology(options.gitRootTopology);
  const nextBlock = renderGitNexusInstructionBlock({ repoName, lang, gitRootTopology });
  const nextContent = `${content.slice(0, startIdx)}${nextBlock}${content.slice(blockEnd)}`;

  return {
    status: nextContent === content ? 'already-current' : 'updated',
    content: nextContent,
    changed: nextContent !== content,
    repoName,
    gitRootTopology,
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
      gitRootTopology: options.gitRootTopology,
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
      gitRootTopology: result.gitRootTopology || normalizeGitRootTopology(options.gitRootTopology),
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
    gitRootTopology: parsed.gitRootTopology,
  });
  const summary = summarizeGitNexusInstructionResults(results);

  if (parsed.json) {
    process.stdout.write(`${JSON.stringify({
      schema_version: 'gitnexus-instruction-normalize.v1',
      repo_root: projectRoot,
      write: parsed.write,
      git_root_topology: parsed.gitRootTopology,
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

function renderChineseGitNexusBody(repoName, gitRootTopology) {
  if (gitRootTopology === 'multi-repo-workspace') {
    return `# GitNexus — Code Intelligence

本工作区包含多个 child Git repo，GitNexus repo-local artifacts 由各 child repo 拥有。

跨 repo 代码查询、影响分析、代码理解类任务，**必须先**读取 \`.spec-first/workspace/graph-targets.json\` 和 \`.spec-first/workspace/gitnexus-readiness.json\`（如已生成），按 \`group.status\` / \`recommended_query_path\` 分流：\`group-ready\` 优先使用 group query，\`group-missing\` 或 \`not-evaluated-no-mcp-input\` 走 \`bounded-registry-fanout\` / per-repo fallback；可用时**使用 GitNexus 作为首选工具**，不可用时 fallback 到 grep/Read 并说明降级原因。Parent workspace 不拥有 child repo 的 \`.spec-first/graph/*\` canonical artifacts。GitNexus 结果与源码或测试冲突时，优先采用已验证事实。`;
  }

  return `# GitNexus — Code Intelligence

本项目已配置 GitNexus 图谱支持，仓库标识：**${repoName}**。

代码查询、影响分析、代码理解类任务，**必须先**读取 \`.spec-first/graph/graph-facts.json\`，确认 \`capabilities.query_global_graph\` 为 true 且 \`provider_summary.ready_primary_providers\` 包含 \`gitnexus\`；可用时**使用 GitNexus 作为首选工具**，不可用时 fallback 到 grep/Read 并说明降级原因。GitNexus 结果与源码或测试冲突时，优先采用已验证事实。`;
}

function renderEnglishGitNexusBody(repoName, gitRootTopology) {
  if (gitRootTopology === 'multi-repo-workspace') {
    return `# GitNexus — Code Intelligence

This workspace contains multiple child Git repos. GitNexus repo-local artifacts are owned by each child repo.

For cross-repo code queries, impact analysis, and code understanding, **first** read \`.spec-first/workspace/graph-targets.json\` and \`.spec-first/workspace/gitnexus-readiness.json\` when present, then branch on \`group.status\` / \`recommended_query_path\`: prefer group query for \`group-ready\`, and use \`bounded-registry-fanout\` / per-repo fallback for \`group-missing\` or \`not-evaluated-no-mcp-input\`; when available, **use GitNexus as the preferred tool**; otherwise fall back to grep/Read and state the degraded reason. The parent workspace does not own child repo \`.spec-first/graph/*\` canonical artifacts. If GitNexus conflicts with source or tests, prefer verified facts.`;
  }

  return `# GitNexus — Code Intelligence

This project has GitNexus graph support for **${repoName}**.

For code queries, impact analysis, and code understanding, **first** read \`.spec-first/graph/graph-facts.json\` and confirm \`capabilities.query_global_graph\` is true and \`provider_summary.ready_primary_providers\` includes \`gitnexus\`; when available, **use GitNexus as the preferred tool**; otherwise fall back to grep/Read and state the degraded reason. If GitNexus conflicts with source or tests, prefer verified facts.`;
}

function sanitizeRepoName(value) {
  return String(value || 'unknown')
    .replace(/[\r\n]/g, ' ')
    .replace(/\*/g, '')
    .trim() || 'unknown';
}

function normalizeGitRootTopology(value) {
  return GIT_ROOT_TOPOLOGIES.has(value) ? value : 'single-repo';
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

function parseArgs(argv) {
  const parsed = {
    subcommand: '',
    repoRoot: '',
    repoName: '',
    lang: '',
    gitRootTopology: 'single-repo',
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
    if (arg === '--git-root-topology') {
      parsed.gitRootTopology = args.shift() || '';
      if (!GIT_ROOT_TOPOLOGIES.has(parsed.gitRootTopology)) {
        parsed.error = '--git-root-topology must be single-repo or multi-repo-workspace';
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
    'Usage: spec-first gitnexus-instruction normalize [--repo-root <path>] [--repo-name <name>] [--lang zh|en] [--git-root-topology single-repo|multi-repo-workspace] [--write] [--json] [--quiet]',
    '',
    'Create or normalize GitNexus instruction blocks into the spec-first evidence contract.',
  ].join('\n'));
}

module.exports = {
  GITNEXUS_END,
  GITNEXUS_START,
  GIT_ROOT_TOPOLOGIES,
  renderGitNexusInstructionBlock,
  normalizeGitNexusInstructionBlock,
  normalizeGitNexusInstructionFiles,
  runGitNexusInstructionBlockCommand,
  summarizeGitNexusInstructionResults,
};
