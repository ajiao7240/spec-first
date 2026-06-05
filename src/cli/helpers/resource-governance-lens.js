'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { validateAgainstSchema } = require('../../contracts/schema-validator');
const {
  collectGitCachedNameStatus,
  collectGitDiffSignals,
  collectGitStatusPorcelain,
  normalizeRepoPath,
  resolveRepoPath,
} = require('./git-diff-signals');
const {
  GENERATED_RUNTIME_PREFIXES,
  resolveTargetRepoRoot,
} = require('./target-repo');

const SCHEMA_VERSION = 'resource-governance-lens.v1';
const SCHEMA_PATH = path.join(__dirname, '..', '..', '..', 'docs', 'contracts', 'governance', 'resource-governance-lens.schema.json');
// 单次 lens 输出的 advisory item 上限:避免在超大/批量变更(如 vendored 目录刷新、生成资产提交)
// 下产出无界 JSON,撑爆消费它的 review/closeout LLM 上下文。超限时补一条 items-truncated 汇总项。
const MAX_ADVISORY_ITEMS = 200;
const DEFAULT_RESOURCE_POLICY = {
  maxGitFileSizeBytes: 5 * 1024 * 1024,
  rawLogMaxBytes: 512 * 1024,
  // 按值复制冻结的 denylist,避免把安全校验用的同一引用暴露进可变输出。
  generatedRuntimePrefixes: [...GENERATED_RUNTIME_PREFIXES],
  retainedRuntimeDirectories: [
    'tmp',
    'temp',
    'test-results',
    'playwright-report',
    'coverage',
    '.spec-first/workflows',
  ],
  owners: {
    docs: 'documentation',
    'docs/contracts': 'contracts',
    skills: 'workflow',
    agents: 'workflow',
    'src/cli': 'cli',
  },
  modules: {
    contracts: { path: 'docs/contracts', owner: 'contracts' },
    workflows: { path: 'skills', owner: 'workflow' },
    cli: { path: 'src/cli', owner: 'cli' },
  },
};

let cachedSchema = null;

function runCli(argv) {
  const parsed = parseArgs(argv);
  if (parsed.errors.length > 0) {
    writeJson({ schema_version: SCHEMA_VERSION, status: 'rejected', reason_code: 'invalid-arguments', errors: parsed.errors });
    return 2;
  }
  const output = collectResourceGovernanceLens(parsed);
  const validation = validateOutput(output);
  if (validation.schemaUnavailable) {
    writeJson({ schema_version: SCHEMA_VERSION, status: 'rejected', reason_code: 'schema-unavailable', errors: validation.errors });
    return 2;
  }
  if (validation.errors.length > 0) {
    writeJson({ schema_version: SCHEMA_VERSION, status: 'rejected', reason_code: 'schema-invalid', errors: validation.errors });
    return 2;
  }
  writeJson(output);
  return 0;
}

function parseArgs(args) {
  const parsed = {
    targetRepo: '',
    errors: [],
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') continue;
    if (arg === '--target-repo') {
      const value = args[index + 1];
      if (value === undefined || value.startsWith('--')) {
        parsed.errors.push('--target-repo requires a value');
      } else {
        parsed.targetRepo = value;
        index += 1;
      }
      continue;
    }
    parsed.errors.push(`unknown argument: ${arg}`);
  }
  if (!parsed.targetRepo) parsed.errors.push('--target-repo is required');
  return parsed;
}

function collectResourceGovernanceLens({ targetRepo }) {
  const target = resolveTargetRepoRoot(targetRepo);
  if (!target.ok) {
    return buildOutput('unavailable', [], ['not-a-repo']);
  }

  const policy = DEFAULT_RESOURCE_POLICY;
  const diff = collectGitDiffSignals({ targetRepo });
  const staged = collectGitCachedNameStatus(targetRepo);
  const status = collectGitStatusPorcelain(targetRepo);
  const entries = mergeEntries(diff, staged, status);
  const items = [];

  for (const entry of entries) {
    items.push(...resourceItemsForEntry(target.root, entry, policy));
  }

  const stagedGenerated = entries.filter((entry) =>
    entry.staged && isGeneratedRuntimePath(entry.path, policy),
  );
  for (const entry of stagedGenerated) {
    items.push(advisoryItem('summary', 'staging-scope', 'staged-generated-runtime', entry.path, 'git-diff:cached', {
      status: entry.status || null,
    }));
  }
  if (stagedGenerated.length > 0) {
    items.push(advisoryItem('summary', 'staging-scope', 'git-add-dot-risk-inferred', '.', 'git-status:porcelain', {
      basis: 'generated runtime path is staged; command history is not observed',
      staged_generated_count: stagedGenerated.length,
    }));
  }

  const uniqueItems = uniqueAdvisoryItems(items);
  const totalItems = uniqueItems.length;
  const truncated = totalItems > MAX_ADVISORY_ITEMS;
  const cappedItems = truncated ? uniqueItems.slice(0, MAX_ADVISORY_ITEMS) : uniqueItems;
  if (truncated) {
    cappedItems.push(advisoryItem('summary', 'staging-scope', 'items-truncated', '.', 'git-status:porcelain', {
      total_items: totalItems,
      reported_items: MAX_ADVISORY_ITEMS,
    }));
  }
  return buildOutput(cappedItems.length > 0 ? 'advisory' : 'ok', cappedItems, [
    diff.reason_code,
    staged.reason_code,
    status.reason_code,
    cappedItems.length > 0 ? 'resource-advisory-present' : 'resource-advisory-none',
    truncated ? 'items-truncated' : null,
  ].filter(Boolean));
}

function mergeEntries(diff, staged, status) {
  const byPath = new Map();
  for (const entry of diff.entries || []) {
    const repoPath = normalizeRepoPath(entry.path);
    byPath.set(repoPath, {
      path: repoPath,
      added: entry.added,
      deleted: entry.deleted,
      staged: false,
      status: 'modified',
    });
  }
  for (const entry of staged.entries || []) {
    const repoPath = normalizeRepoPath(entry.path);
    byPath.set(repoPath, {
      ...(byPath.get(repoPath) || { path: repoPath }),
      staged: true,
      status: entry.status,
    });
  }
  for (const entry of status.entries || []) {
    const repoPath = normalizeRepoPath(entry.path);
    const existing = byPath.get(repoPath);
    byPath.set(repoPath, {
      ...(existing || { path: repoPath }),
      staged: existing ? existing.staged : entry.index !== ' ' && entry.index !== '?',
      // staged diff(--name-status)给的是精确单字符状态;porcelain 的 index+worktree 拼接是不同口径,
      // 仅在该 path 尚无 staged 状态时才用,避免覆盖更精确的 staged 状态。
      status: existing && existing.staged ? existing.status : (`${entry.index}${entry.worktree}`.trim() || 'unknown'),
    });
  }
  return Array.from(byPath.values()).filter((entry) => entry.path);
}

function resourceItemsForEntry(repoRoot, entry, policy) {
  const items = [];
  const repoPath = normalizeRepoPath(entry.path);
  const absolutePath = resolveRepoPath(repoRoot, repoPath);
  // 单次取 size 复用给 raw-log 与 large-file 两处判断,避免对同一路径重复 stat。
  const size = fileSizeOrNull(absolutePath);

  if (isGeneratedRuntimePath(repoPath, policy)) {
    items.push(advisoryItem('summary', 'generated-output', 'generated-runtime-path', repoPath, entry.staged ? 'git-diff:cached' : 'git-status:porcelain'));
  }

  // retained 白名单(coverage/、test-results/、.spec-first/workflows 等)本就是放体积日志/产物的地方,
  // 在这些目录命中的 raw-log 不误报。此前该守卫挂在 generated-output 上是死代码(retained 与
  // generated 前缀零交集),挪到 raw-log 检查才有实际抑制作用。
  if (isRawLogPath(repoPath) && !isRetainedRuntimePath(repoPath, policy)
    && (size === null || size > policy.rawLogMaxBytes)) {
    items.push(advisoryItem('summary', 'raw-log', size === null ? 'raw-log-unreadable' : 'raw-log-large', repoPath, 'git-status:porcelain', {
      size_bytes: size,
      raw_log_max_bytes: policy.rawLogMaxBytes,
    }));
  }

  if (size !== null && size > policy.maxGitFileSizeBytes) {
    items.push(advisoryItem('summary', 'large-file', 'large-file-added', repoPath, 'git-status:porcelain', {
      size_bytes: size,
      max_git_file_size_bytes: policy.maxGitFileSizeBytes,
    }));
  }

  const owner = ownerForPath(repoPath, policy);
  if (owner) {
    items.push(advisoryItem('review', 'owner-hint', 'owner-path-hint', repoPath, 'git-status:porcelain', owner));
  }

  return items;
}

function advisoryItem(lensFamily, dimension, reasonCode, subjectPath, evidenceRef, details = {}) {
  return {
    lens_family: lensFamily,
    dimension,
    severity: 'advisory',
    reason_code: reasonCode,
    subject_path: normalizeRepoPath(subjectPath),
    evidence_ref: evidenceRef,
    details,
  };
}

function isGeneratedRuntimePath(repoPath, policy) {
  const normalized = normalizeRepoPath(repoPath);
  return policy.generatedRuntimePrefixes.some((prefix) => normalized.startsWith(prefix));
}

function isRetainedRuntimePath(repoPath, policy) {
  const normalized = normalizeRepoPath(repoPath);
  return policy.retainedRuntimeDirectories.some((directory) =>
    normalized === directory || normalized.startsWith(`${directory}/`),
  );
}

function isRawLogPath(repoPath) {
  const normalized = normalizeRepoPath(repoPath).toLowerCase();
  return normalized.endsWith('.log') || normalized.includes('/logs/');
}

function fileSizeOrNull(absolutePath) {
  try {
    // lstat 不跟随符号链接:被跟踪的 symlink 指向仓库外目标时,statSync 会把外部文件大小
    // 误报成仓库内 advisory,跨越仓库边界。symlink 不参与 size 判断,返回 null。
    const stats = fs.lstatSync(absolutePath);
    if (stats.isSymbolicLink() || !stats.isFile()) return null;
    return stats.size;
  } catch (_error) {
    return null;
  }
}

function ownerForPath(repoPath, policy) {
  const normalized = normalizeRepoPath(repoPath);
  const ownerEntries = Object.entries(policy.owners || {}).sort((left, right) =>
    normalizeRepoPath(right[0]).length - normalizeRepoPath(left[0]).length,
  );
  for (const [prefix, owner] of ownerEntries) {
    const normalizedPrefix = normalizeRepoPath(prefix);
    if (normalized === normalizedPrefix || normalized.startsWith(`${normalizedPrefix}/`)) {
      return { owner, match: normalizedPrefix };
    }
  }
  const moduleEntries = Object.entries(policy.modules || {}).sort((left, right) =>
    normalizeRepoPath(right[1].path).length - normalizeRepoPath(left[1].path).length,
  );
  for (const [moduleName, moduleInfo] of moduleEntries) {
    const modulePath = normalizeRepoPath(moduleInfo.path);
    if (normalized === modulePath || normalized.startsWith(`${modulePath}/`)) {
      return { owner: moduleInfo.owner, module: moduleName, match: modulePath };
    }
  }
  return null;
}

function uniqueAdvisoryItems(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = `${item.dimension}:${item.reason_code}:${item.subject_path}:${item.evidence_ref}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function buildOutput(status, items, reasonCodes) {
  return {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    status,
    items,
    reason_codes: Array.from(new Set(reasonCodes.length > 0 ? reasonCodes : ['resource-lens-no-reason'])),
    policy: {
      maxGitFileSizeBytes: DEFAULT_RESOURCE_POLICY.maxGitFileSizeBytes,
      rawLogMaxBytes: DEFAULT_RESOURCE_POLICY.rawLogMaxBytes,
      // 输出独立副本:消费者就地修改 policy 数组也不会污染共享默认 policy。
      generatedRuntimePrefixes: [...DEFAULT_RESOURCE_POLICY.generatedRuntimePrefixes],
      retainedRuntimeDirectories: [...DEFAULT_RESOURCE_POLICY.retainedRuntimeDirectories],
    },
  };
}

function validateOutput(output) {
  if (!cachedSchema) {
    try {
      cachedSchema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    } catch (error) {
      return { schemaUnavailable: true, errors: [`schema unavailable: ${error.message}`] };
    }
  }
  return validateAgainstSchema(cachedSchema, output);
}

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

if (require.main === module) {
  process.exitCode = runCli(process.argv.slice(2));
}

module.exports = {
  DEFAULT_RESOURCE_POLICY,
  collectResourceGovernanceLens,
  runCli,
  validateOutput,
};
