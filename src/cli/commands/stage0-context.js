'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { compileWorkspaceContext } = require('../../bootstrap-compiler/workspace-compiler');
const { recordWorkflowTelemetry } = require('../../context-routing/telemetry');
const { resolveStage0Entry } = require('../../context-routing/entry-resolver');
const { resolveProfile } = require('../../context-routing/profiles');

function normalizePath(filePath) {
  return String(filePath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
}

function resolveMaybeRelative(baseDir, inputPath) {
  if (!inputPath) return null;
  return path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(baseDir, inputPath);
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function defaultWorkflowForStage(stage) {
  if (stage === 'plan') return 'spec-plan';
  if (stage === 'work') return 'spec-work';
  if (stage === 'review') return 'spec-review';
  return '';
}

function aggregateFreshnessStatus(evaluations = []) {
  const freshnessValues = evaluations
    .map((item) => item && item.freshness_status)
    .filter(Boolean);

  if (freshnessValues.includes('stale')) return 'stale';
  if (freshnessValues.includes('healthy')) return 'healthy';
  return 'unknown';
}

function buildStage0TelemetryEvaluation(
  context,
  { workspaceSlug = null, matchedChildSlugs = [], fallbackReason = null } = {},
) {
  const repoEvaluations = Array.isArray(context.repos)
    ? context.repos
      .map((repo) => repo && repo.evaluation)
      .filter(Boolean)
    : [];
  const primaryEvaluation = repoEvaluations[0] || null;

  return {
    stage: context.stage,
    profile: (primaryEvaluation && primaryEvaluation.profile) || resolveProfile(context.stage),
    mode: context.mode,
    workspace_slug: context.workspace_slug || workspaceSlug,
    matched_child_slugs: Array.isArray(context.matched_child_slugs)
      ? context.matched_child_slugs
      : matchedChildSlugs,
    selection_subject: context.selection_subject || null,
    selected_contexts: Array.isArray(context.selected_contexts) ? context.selected_contexts : [],
    selected_context_count: Array.isArray(context.selected_contexts)
      ? context.selected_contexts.length
      : Array.isArray(context.selected_assets) ? context.selected_assets.length : 0,
    selected_assets: Array.isArray(context.selected_assets) ? context.selected_assets : [],
    skipped_rules: unique(repoEvaluations.flatMap((item) => item.skipped_rules || [])),
    fallback_reason: context.fallback_reason
      || (primaryEvaluation && primaryEvaluation.fallback_reason)
      || fallbackReason
      || null,
    freshness_status: aggregateFreshnessStatus(repoEvaluations),
    level: context.level || (primaryEvaluation && primaryEvaluation.level) || null,
    verification_summary: context.verification_summary || null,
    verifier_dispatch: context.verifier_dispatch || null,
    ai_dev_quality_gate_result: context.ai_dev_quality_gate_result || null,
    verification_evidence: context.verification_evidence || null,
    verification_gate_state: context.verification_gate_state || null,
  };
}

function resolveTelemetrySlug(context, { workspaceSlug = null } = {}) {
  if (context.mode === 'workspace') {
    return context.workspace_slug || workspaceSlug || null;
  }

  if (Array.isArray(context.repos) && context.repos[0] && context.repos[0].slug) {
    return context.repos[0].slug;
  }

  return workspaceSlug || null;
}

function parseStage0ContextArgs(argv) {
  const parsed = {
    help: false,
    stage: '',
    workflow: '',
    format: 'json',
    cwd: process.cwd(),
    target: '',
    repoRoots: [],
    changedFiles: [],
    unknown: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '-h' || arg === '--help') {
      parsed.help = true;
      continue;
    }

    if (arg === '--stage') {
      const next = argv[index + 1];
      if (!next || next.startsWith('-')) {
        parsed.unknown.push(arg);
        continue;
      }
      parsed.stage = next;
      index += 1;
      continue;
    }

    if (arg.startsWith('--stage=')) {
      parsed.stage = arg.slice('--stage='.length);
      continue;
    }

    if (arg === '--workflow') {
      const next = argv[index + 1];
      if (!next || next.startsWith('-')) {
        parsed.unknown.push(arg);
        continue;
      }
      parsed.workflow = next;
      index += 1;
      continue;
    }

    if (arg.startsWith('--workflow=')) {
      parsed.workflow = arg.slice('--workflow='.length);
      continue;
    }

    if (arg === '--format') {
      const next = argv[index + 1];
      if (!next || next.startsWith('-')) {
        parsed.unknown.push(arg);
        continue;
      }
      parsed.format = next;
      index += 1;
      continue;
    }

    if (arg.startsWith('--format=')) {
      parsed.format = arg.slice('--format='.length);
      continue;
    }

    if (arg === '--cwd') {
      const next = argv[index + 1];
      if (!next || next.startsWith('-')) {
        parsed.unknown.push(arg);
        continue;
      }
      parsed.cwd = next;
      index += 1;
      continue;
    }

    if (arg.startsWith('--cwd=')) {
      parsed.cwd = arg.slice('--cwd='.length);
      continue;
    }

    if (arg === '--target') {
      const next = argv[index + 1];
      if (!next || next.startsWith('-')) {
        parsed.unknown.push(arg);
        continue;
      }
      parsed.target = next;
      index += 1;
      continue;
    }

    if (arg.startsWith('--target=')) {
      parsed.target = arg.slice('--target='.length);
      continue;
    }

    if (arg === '--repo-root') {
      const next = argv[index + 1];
      if (!next || next.startsWith('-')) {
        parsed.unknown.push(arg);
        continue;
      }
      parsed.repoRoots.push(next);
      index += 1;
      continue;
    }

    if (arg.startsWith('--repo-root=')) {
      parsed.repoRoots.push(arg.slice('--repo-root='.length));
      continue;
    }

    if (arg === '--changed-file') {
      const next = argv[index + 1];
      if (!next || next.startsWith('-')) {
        parsed.unknown.push(arg);
        continue;
      }
      parsed.changedFiles.push(next);
      index += 1;
      continue;
    }

    if (arg.startsWith('--changed-file=')) {
      parsed.changedFiles.push(arg.slice('--changed-file='.length));
      continue;
    }

    parsed.unknown.push(arg);
  }

  return parsed;
}

function readGitOutput(repoRoot, args) {
  try {
    return execFileSync('git', ['-C', repoRoot, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (_error) {
    return '';
  }
}

function splitGitLines(output) {
  return output
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

function detectGitRoot(cwd) {
  const output = readGitOutput(cwd, ['rev-parse', '--show-toplevel']);
  return output ? path.resolve(output) : null;
}

function resolveDefaultBranchRef(repoRoot) {
  const symbolic = readGitOutput(repoRoot, ['symbolic-ref', 'refs/remotes/origin/HEAD']);
  if (symbolic) {
    return symbolic.replace(/^refs\/remotes\//, '');
  }

  for (const candidate of ['origin/main', 'origin/master', 'main', 'master']) {
    const resolved = readGitOutput(repoRoot, ['rev-parse', '--verify', candidate]);
    if (resolved) return candidate;
  }

  return null;
}

function detectChangedFilesFromGit({ cwd, stage }) {
  const repoRoot = detectGitRoot(cwd);
  if (!repoRoot) return [];

  const changed = [];
  changed.push(...splitGitLines(readGitOutput(repoRoot, ['diff', '--name-only', 'HEAD'])));
  changed.push(...splitGitLines(readGitOutput(repoRoot, ['ls-files', '--others', '--exclude-standard'])));

  if (stage === 'work' || stage === 'review') {
    const defaultRef = resolveDefaultBranchRef(repoRoot);
    if (defaultRef) {
      const mergeBase = readGitOutput(repoRoot, ['merge-base', 'HEAD', defaultRef]);
      if (mergeBase) {
        changed.push(...splitGitLines(readGitOutput(repoRoot, ['diff', '--name-only', `${mergeBase}...HEAD`])));
      }
    }
  }

  return unique(changed.map(normalizePath));
}

function summarizeContextForOutput(context) {
  const primaryRepo = Array.isArray(context.repos) && context.repos.length > 0
    ? context.repos[0]
    : null;
  const primaryEvaluation = primaryRepo && primaryRepo.evaluation ? primaryRepo.evaluation : null;

  return {
    schema_version: context.schema_version,
    stage: context.stage,
    mode: context.mode,
    repo_count: context.repo_count,
    workspace_slug: context.workspace_slug || null,
    matched_child_slugs: Array.isArray(context.matched_child_slugs) ? context.matched_child_slugs : [],
    selection_subject: context.selection_subject || (primaryEvaluation ? primaryEvaluation.selection_subject || null : null),
    selected_contexts: Array.isArray(context.selected_contexts) ? context.selected_contexts : [],
    selected_assets: Array.isArray(context.selected_assets) ? context.selected_assets : [],
    fallback_reason: context.fallback_reason || (primaryEvaluation ? primaryEvaluation.fallback_reason || null : null),
    level: context.level || (primaryEvaluation ? primaryEvaluation.level || null : null),
    skipped_rules: primaryEvaluation && Array.isArray(primaryEvaluation.skipped_rules)
      ? primaryEvaluation.skipped_rules
      : [],
    repos: Array.isArray(context.repos)
      ? context.repos.map((repo) => ({
        repo_root: repo.repo_root,
        slug: repo.slug,
        status: repo.status || null,
      }))
      : [],
    verification_summary: context.verification_summary || null,
    verifier_dispatch: context.verifier_dispatch || null,
    ai_dev_quality_gate_result: context.ai_dev_quality_gate_result || null,
    verification_evidence: context.verification_evidence || null,
    verification_gate_state: context.verification_gate_state || null,
  };
}

function printHelp(stream = process.stdout) {
  stream.write([
    'Usage: spec-first stage0-context --stage <plan|work|review> [options]',
    '',
    'Options:',
    '  --workflow <id>         Workflow id recorded in telemetry. Defaults to spec-<stage>.',
    '  --format <json>           Output format. Only json is currently supported.',
    '  --cwd <path>             Working directory used for repo discovery. Defaults to process.cwd().',
    '  --target <path>          Target path used for workspace routing. Defaults to cwd.',
    '  --repo-root <path>       Explicit repo root. Repeatable.',
    '  --changed-file <path>    Explicit changed file relative to repo/workspace. Repeatable.',
    '  -h, --help               Show help.',
    '',
  ].join('\n'));
}

function runStage0Context(argv, io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const parsed = parseStage0ContextArgs(argv);

  if (parsed.help) {
    printHelp(stdout);
    return 0;
  }

  if (parsed.unknown.length > 0) {
    stderr.write(`Unknown or invalid arguments: ${parsed.unknown.join(', ')}\n`);
    printHelp(stderr);
    return 1;
  }

  if (!['plan', 'work', 'review'].includes(parsed.stage)) {
    stderr.write('Error: --stage must be one of plan, work, or review.\n');
    printHelp(stderr);
    return 1;
  }

  if (parsed.format !== 'json') {
    stderr.write('Error: --format currently only supports json.\n');
    printHelp(stderr);
    return 1;
  }

  const resolvedCwd = resolveMaybeRelative(process.cwd(), parsed.cwd) || process.cwd();
  const resolvedTarget = resolveMaybeRelative(resolvedCwd, parsed.target) || resolvedCwd;
  const repoRoots = parsed.repoRoots.map((item) => resolveMaybeRelative(resolvedCwd, item));
  const changedFiles = parsed.changedFiles.length > 0
    ? parsed.changedFiles.map(normalizePath)
    : detectChangedFilesFromGit({ cwd: resolvedCwd, stage: parsed.stage });
  const workflow = parsed.workflow || defaultWorkflowForStage(parsed.stage);
  const entry = resolveStage0Entry({
    cwd: resolvedCwd,
    target: resolvedTarget,
    repoRoots,
    changedFiles,
  });

  const compiled = compileWorkspaceContext({
    repoRoots,
    stage: parsed.stage,
    cwd: resolvedCwd,
    target: resolvedTarget,
    changedFiles,
  });
  const telemetryEvaluation = buildStage0TelemetryEvaluation(compiled, {
    workspaceSlug: entry.workspaceSlug,
    matchedChildSlugs: entry.matchedChildSlugs,
    fallbackReason: entry.fallbackReason,
  });

  try {
    recordWorkflowTelemetry({
      repoRoot: (Array.isArray(repoRoots) && repoRoots[0]) || resolvedCwd,
      workflow,
      slug: resolveTelemetrySlug(compiled, { workspaceSlug: entry.workspaceSlug }),
      evaluation: telemetryEvaluation,
      freshnessStatus: telemetryEvaluation.freshness_status,
      artifactAnchorRoot: entry.artifactAnchorRoot || resolvedCwd,
    });
  } catch (_error) {
    // best-effort telemetry: runtime context output must stay non-blocking
  }

  const output = summarizeContextForOutput(compiled);
  stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  return 0;
}

module.exports = {
  buildStage0TelemetryEvaluation,
  defaultWorkflowForStage,
  detectChangedFilesFromGit,
  parseStage0ContextArgs,
  resolveTelemetrySlug,
  runStage0Context,
  summarizeContextForOutput,
};
