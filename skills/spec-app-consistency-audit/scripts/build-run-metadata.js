#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildAppAuditCoverageCapabilities,
  buildAppAuditInputExpectations,
  buildAppAuditVerdictScope,
  collectGitDiffFacts,
  hashText,
  listSourceTextFiles,
  parseCommonArgs,
  publicPath,
  sourceInputFromFiles,
  writeJsonOutput,
} = require('./lib/audit-utils');

function buildRunMetadata(options = {}) {
  if (options.mode === 'report-only') {
    throw new Error('mode:report-only forbids metadata artifact writes.');
  }
  if (options.mode === 'headless' && !options.base) {
    throw new Error('scope_headless_missing_base: mode:headless requires base:<ref> before metadata writes.');
  }
  const repoRoot = fs.realpathSync(path.resolve(options.repoRoot || options.source || '.'));
  const runId = options.runId || 'app-audit-run';
  const runDir = options.runDir || path.join('.spec-first', 'app-audit', 'runs', runId);
  const absoluteRunDir = path.resolve(repoRoot, runDir);
  const publicRunDir = publicPath(repoRoot, absoluteRunDir, 'run-outside-repo');
  const source = listSourceTextFiles({
    repoRoot,
    source: options.source || repoRoot,
    allowOutside: options.allowOutside,
    maxFiles: options.maxFiles || options.maxScanFiles || 2000,
  });
  const diffFacts = collectGitDiffFacts(repoRoot, options);
  const headSha = gitText(repoRoot, ['rev-parse', 'HEAD']).trim();
  const diffHash = diffFacts.diffHash;
  const sourceInput = sourceInputFromFiles('code', source.files, repoRoot, {
    sourceRoot: source.sourceRoot,
    truncated: source.truncated,
    maxFiles: source.maxFiles,
  });
  const worktreeFingerprint = hashText([
    headSha || 'no-head',
    options.base || '',
    diffHash,
    sourceInput.source_hash || sourceInput.source_hash_unavailable_reason || '',
  ].join('\n'));

  return {
    schema_version: 'spec-app-consistency-audit-metadata.v1',
    artifact_id: 'metadata',
    generated_at: new Date().toISOString(),
    source_inputs: [sourceInput],
    consumers: ['parent-workflow', 'report-writer', 'artifact-consumers'],
    contract_status: 'candidate',
    data_sensitivity: 'internal',
    run_id: runId,
    host: options.host || process.env.SPEC_FIRST_HOST || 'unknown',
    mode: options.mode || 'default',
    source_root: publicPath(repoRoot, source.sourceRoot, 'source-outside-repo'),
    branch: gitText(repoRoot, ['branch', '--show-current']).trim(),
    head_sha: headSha,
    base_ref: options.base || '',
    resolved_base_sha: diffFacts.resolved_base_sha || '',
    diff_scope_kind: diffFacts.kind,
    worktree_state: gitText(repoRoot, ['status', '--porcelain']).trim() ? 'dirty' : 'clean',
    diff_hash: diffHash,
    worktree_fingerprint: worktreeFingerprint,
    untracked_policy: 'excluded',
    included_untracked_files: [],
    generated_against: {
      head_sha: headSha,
      diff_hash: diffHash,
      diff_scope_kind: diffFacts.kind,
      resolved_base_sha: diffFacts.resolved_base_sha || '',
      source_root_hash: sourceInput.source_hash || sourceInput.source_hash_unavailable_reason,
    },
    started_at: options.startedAt || new Date().toISOString(),
    completed_at: options.completedAt || new Date().toISOString(),
    status: options.status || 'complete',
    status_reason_codes: [],
    contract_versions: {
      preflight: 'spec-app-consistency-audit-preflight.v1',
      impact_facts: 'spec-app-consistency-audit-impact-facts.v1',
      audit_report: 'spec-app-consistency-audit-report.v1',
      issue: 'spec-app-consistency-audit-issue.v1',
    },
    depth: options.depth || 'default',
    input_expectations: buildAppAuditInputExpectations(options),
    coverage_capabilities: buildAppAuditCoverageCapabilities(options),
    audit_verdict_scope: buildAppAuditVerdictScope(options),
    run_dir: publicRunDir,
    summary_path: path.posix.join(publicRunDir, 'app-consistency-audit.summary.md'),
    issues_path: path.posix.join(publicRunDir, 'issues.json'),
  };
}

function buildLatestSummary(metadata) {
  return {
    schema_version: 'spec-app-consistency-audit-latest-summary.v1',
    artifact_id: 'latest-summary',
    generated_at: new Date().toISOString(),
    run_id: metadata.run_id,
    summary_path: metadata.summary_path,
    issues_path: metadata.issues_path,
    head_sha: metadata.head_sha,
    diff_hash: metadata.diff_hash,
    worktree_fingerprint: metadata.worktree_fingerprint,
    source_hash: metadata.generated_against.source_root_hash,
    audit_verdict_scope: metadata.audit_verdict_scope,
  };
}

function gitText(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return result.status === 0 ? result.stdout : '';
}

if (require.main === module) {
  try {
    const options = parseCommonArgs(process.argv.slice(2));
    const metadata = buildRunMetadata(options);
    writeJsonOutput(metadata, options.output);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildLatestSummary,
  buildRunMetadata,
};
