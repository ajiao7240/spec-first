'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { validateAgainstSchema } = require('../../contracts/schema-validator');
const {
  collectGitDiffSignals,
  normalizeRepoPath,
  topDirsForPaths,
} = require('./git-diff-signals');

const SCHEMA_VERSION = 'task-governance-signals.v1';
const SCHEMA_PATH = path.join(__dirname, '..', '..', '..', 'docs', 'contracts', 'governance', 'task-governance-signals.schema.json');
const CRITICAL_PATH_PREFIXES = [
  'skills/',
  'agents/',
  'templates/',
  'src/cli/',
  'src/contracts/',
  'docs/contracts/',
  'CLAUDE.md',
  'AGENTS.md',
];
const KEYWORDS = [
  ['contract', 'contract'],
  ['schema', 'contract'],
  ['workflow', 'workflow'],
  ['runtime', 'runtime'],
  ['generated runtime', 'runtime'],
  ['host', 'runtime'],
  ['security', 'security'],
  ['secret', 'security'],
  ['permission', 'security'],
  ['migration', 'migration'],
  ['breaking', 'release'],
  ['治理', 'governance'],
  ['契约', 'contract'],
  ['合同', 'contract'],
  ['工作流', 'workflow'],
  ['运行时', 'runtime'],
  ['生成资产', 'runtime'],
  ['双宿主', 'runtime'],
  ['安全', 'security'],
  ['权限', 'security'],
  ['迁移', 'migration'],
];

let cachedSchema = null;

function runCli(argv) {
  const parsed = parseArgs(argv);
  if (parsed.errors.length > 0) {
    writeJson({ schema_version: SCHEMA_VERSION, status: 'rejected', reason_code: 'invalid-arguments', errors: parsed.errors });
    return 2;
  }
  const output = collectTaskGovernanceSignals(parsed);
  const validation = validateOutput(output);
  if (validation.schemaUnavailable) {
    // 合同 schema 缺失(如发布包未携带 docs/contracts/governance/)时降级为结构化拒绝,
    // 不抛未捕获异常,让 spec-plan 等 consumer 可按 "helper unavailable" 继续。
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
    source: 'plan-declared',
    inputPath: '',
    targetRepo: '',
    baseRef: '',
    errors: [],
  };

  // 取 flag 的值:若缺值或下一个 token 又是一个 flag,记错误而非静默赋空字符串。
  const takeValue = (flag, index) => {
    const value = args[index + 1];
    if (value === undefined || value.startsWith('--')) {
      parsed.errors.push(`${flag} requires a value`);
      return null;
    }
    return value;
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') continue;
    if (arg === '--source') {
      const value = takeValue('--source', index);
      if (value !== null) { parsed.source = value; index += 1; }
      continue;
    }
    if (arg === '--input') {
      const value = takeValue('--input', index);
      if (value !== null) { parsed.inputPath = value; index += 1; }
      continue;
    }
    if (arg === '--target-repo') {
      const value = takeValue('--target-repo', index);
      if (value !== null) { parsed.targetRepo = value; index += 1; }
      continue;
    }
    if (arg === '--base-ref') {
      const value = takeValue('--base-ref', index);
      if (value !== null) { parsed.baseRef = value; index += 1; }
      continue;
    }
    parsed.errors.push(`unknown argument: ${arg}`);
  }

  if (!['plan-declared', 'git-diff'].includes(parsed.source)) {
    parsed.errors.push('--source must be plan-declared or git-diff');
  }
  if (parsed.source === 'git-diff' && !parsed.targetRepo) {
    parsed.errors.push('--target-repo is required for git-diff source');
  }
  if (parsed.source === 'git-diff' && parsed.inputPath) {
    parsed.errors.push('--input is not used with --source git-diff');
  }
  // baseRef 直接拼到 `git diff --numstat <ref>`;以 '-' 开头会被 git 当成选项(如
  // --output 任意写文件、--ext-diff 触发外部命令)。execFileSync 数组式只防 shell 注入,
  // 不防 git 参数注入,这里显式拒绝;git-diff-signals 再叠加 --end-of-options 兜底。
  if (parsed.baseRef && parsed.baseRef.startsWith('-')) {
    parsed.errors.push('--base-ref must not start with "-"');
  }
  return parsed;
}

function collectTaskGovernanceSignals(options = {}) {
  if (options.source === 'git-diff') return collectFromGitDiff(options);
  return collectFromPlanDeclared(readPlanningContext(options.inputPath));
}

function collectFromGitDiff({ targetRepo, baseRef = '' }) {
  const diff = collectGitDiffSignals({ targetRepo, baseRef });
  const paths = diff.paths || [];
  const topDirs = topDirsForPaths(paths);
  const keywordHits = findKeywordHits(paths.join('\n'));
  const criticalPathHits = criticalPathHitsFor(paths);
  const signals = {
    signal_source: 'git-diff',
    file_count: diff.file_count || 0,
    line_delta: diff.line_delta || 0,
    declared_path_count: 0,
    source_ref_count: 0,
    target_area_count: topDirs.length,
    cross_module: topDirs.length >= 2,
    top_dirs: topDirs,
    critical_path_hits: criticalPathHits,
    keyword_hits: keywordHits,
  };
  return buildOutput(signals, [
    diff.reason_code || 'git-diff-collected',
    ...bucketReasonCodes(signals),
  ]);
}

function collectFromPlanDeclared(context) {
  const paths = uniqueStrings([
    ...context.candidate_paths,
    ...context.paths,
  ]).map(normalizeRepoPath);
  const sourceRefs = uniqueStrings(context.source_refs).map(normalizeRepoPath);
  const targetAreas = uniqueStrings([
    ...context.target_areas,
    ...topDirsForPaths(paths),
  ]);
  const text = [
    context.request,
    context.origin_text,
    context.text,
    paths.join('\n'),
    sourceRefs.join('\n'),
  ].join('\n');
  const signals = {
    signal_source: 'plan-declared',
    file_count: 0,
    line_delta: 0,
    declared_path_count: paths.length,
    source_ref_count: sourceRefs.length,
    target_area_count: targetAreas.length,
    cross_module: targetAreas.length >= 2,
    top_dirs: targetAreas.sort(),
    critical_path_hits: criticalPathHitsFor([...paths, ...sourceRefs]),
    keyword_hits: findKeywordHits(text),
  };
  // 输入不可读时不能伪装成干净的 lightweight 任务,把 reason_code 透传给 consumer。
  return buildOutput(signals, [
    context.reason_code || 'plan-declared-collected',
    ...bucketReasonCodes(signals),
  ]);
}

function readPlanningContext(inputPath) {
  if (!inputPath) return emptyPlanningContext();
  try {
    const payload = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
    return {
      ...emptyPlanningContext(),
      ...payload,
      candidate_paths: toStringArray(payload.candidate_paths),
      paths: toStringArray(payload.paths),
      source_refs: toStringArray(payload.source_refs),
      target_areas: toStringArray(payload.target_areas),
      request: typeof payload.request === 'string' ? payload.request : '',
      origin_text: typeof payload.origin_text === 'string' ? payload.origin_text : '',
      text: typeof payload.text === 'string' ? payload.text : '',
    };
  } catch (_error) {
    return {
      ...emptyPlanningContext(),
      reason_code: 'planning-context-unreadable',
    };
  }
}

function emptyPlanningContext() {
  return {
    request: '',
    origin_text: '',
    text: '',
    candidate_paths: [],
    paths: [],
    source_refs: [],
    target_areas: [],
  };
}

// 采集可信度,独立于 candidate_level:采集失败时 candidate_level 仍会落到某个 enum 值
// (空信号→lightweight),consumer 不能据此判低风险。collection_status 暴露"这次采集是否可信",
// 失败由 source reason_code(reasonCodes[0])映射,exit 仍 0(advisory 不阻断)。
function mapCollectionStatus(sourceReasonCode) {
  switch (sourceReasonCode) {
    case 'not-a-repo':
      return 'unavailable';
    case 'no-diff-base':
    case 'git-diff-failed':
    case 'planning-context-unreadable':
      return 'degraded';
    default:
      return 'ok';
  }
}

function buildOutput(signals, reasonCodes) {
  const candidateLevel = classifyCandidate(signals);
  const riskDomains = riskDomainsFor(signals);
  return {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    collection_status: mapCollectionStatus(reasonCodes[0]),
    candidate_level: candidateLevel,
    signals,
    risk_domains: riskDomains,
    recommended_artifacts: recommendedArtifacts(candidateLevel, riskDomains),
    recommended_gate_lenses: recommendedGateLenses(candidateLevel, riskDomains),
    reason_codes: uniqueStrings([
      ...reasonCodes,
      `candidate-${candidateLevel}`,
    ]),
  };
}

function classifyCandidate(signals) {
  if (
    signals.line_delta >= 1000
    || signals.file_count >= 10
    || signals.declared_path_count >= 8
    || signals.source_ref_count >= 6
    || signals.target_area_count >= 4
    || signals.critical_path_hits.length >= 2
  ) {
    return 'deep';
  }
  if (
    signals.line_delta >= 400
    || signals.file_count >= 4
    || signals.declared_path_count >= 3
    || signals.source_ref_count >= 2
    || signals.cross_module
    || signals.keyword_hits.length > 0
    || signals.critical_path_hits.length > 0
  ) {
    return 'standard';
  }
  return 'lightweight';
}

function bucketReasonCodes(signals) {
  const codes = [];
  if (signals.cross_module) codes.push('cross-module');
  if (signals.line_delta >= 1000) codes.push('very-large-diff');
  else if (signals.line_delta >= 400) codes.push('large-diff');
  if (signals.file_count >= 10 || signals.declared_path_count >= 8) codes.push('many-files-or-paths');
  if (signals.critical_path_hits.length > 0) codes.push('critical-path-hit');
  if (signals.keyword_hits.length > 0) codes.push('keyword-hit');
  return codes;
}

function riskDomainsFor(signals) {
  return uniqueStrings([
    ...signals.keyword_hits.map((hit) => hit.risk_domain),
    ...signals.critical_path_hits.map((hit) => {
      if (hit.startsWith('docs/contracts/') || hit.startsWith('src/contracts/')) return 'contract';
      if (hit.startsWith('skills/') || hit.startsWith('agents/')) return 'workflow';
      if (hit.startsWith('templates/') || hit === 'CLAUDE.md' || hit === 'AGENTS.md') return 'runtime';
      if (hit.startsWith('src/cli/')) return 'cli';
      return 'governance';
    }),
  ]).sort();
}

function recommendedArtifacts(candidateLevel, riskDomains) {
  const artifacts = ['plan'];
  if (candidateLevel !== 'lightweight') artifacts.push('verification');
  if (candidateLevel === 'deep' || riskDomains.includes('security') || riskDomains.includes('contract')) artifacts.push('review');
  if (riskDomains.includes('runtime')) artifacts.push('runtime-regeneration');
  if (riskDomains.includes('contract') || candidateLevel === 'deep') artifacts.push('changelog');
  return uniqueStrings(artifacts);
}

function recommendedGateLenses(candidateLevel, riskDomains) {
  const lenses = ['planning'];
  if (candidateLevel !== 'lightweight') lenses.push('exploration', 'verification');
  if (candidateLevel === 'deep' || riskDomains.includes('contract')) lenses.push('review');
  if (riskDomains.includes('runtime')) lenses.push('preflight');
  return uniqueStrings(lenses);
}

function criticalPathHitsFor(paths) {
  return uniqueStrings((paths || [])
    .map(normalizeRepoPath)
    .filter((filePath) => CRITICAL_PATH_PREFIXES.some((prefix) =>
      prefix.endsWith('/') ? filePath.startsWith(prefix) : filePath === prefix,
    )));
}

function findKeywordHits(text) {
  const lower = String(text || '').toLowerCase();
  const hits = [];
  for (const [keyword, riskDomain] of KEYWORDS) {
    if (lower.includes(keyword.toLowerCase())) {
      hits.push({ keyword, risk_domain: riskDomain });
    }
  }
  return uniqueBy(hits, (hit) => `${hit.keyword}:${hit.risk_domain}`);
}

function toStringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function uniqueStrings(values) {
  return Array.from(new Set((values || []).filter((value) => typeof value === 'string' && value.trim() !== '')));
}

function uniqueBy(values, keyFn) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const key = keyFn(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function validateOutput(output) {
  if (!cachedSchema) {
    try {
      cachedSchema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    } catch (error) {
      // schema 文件缺失(发布包未携带)或不可解析:返回降级标记,由 runCli 输出结构化拒绝。
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
  collectTaskGovernanceSignals,
  findKeywordHits,
  runCli,
  validateOutput,
};
