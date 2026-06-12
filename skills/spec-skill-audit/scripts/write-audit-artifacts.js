#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { auditRuntimeDrift } = require('./audit-runtime-drift');
const { auditSpecFirstGovernance } = require('./audit-spec-first-governance');
const { buildPromiseImplementationReport } = require('./check-promise-implementation');
const {
  collectReviewerGuardCoverage,
  collectRuleMaturityObservations,
  collectSkillFacts,
} = require('./collect-skill-facts');
const { detectBoundaryOverlap } = require('./detect-boundary-overlap');
const { extractTriggerSignals } = require('./extract-trigger-signals');
const { assignFindingIds, compareFindings, countBySeverity } = require('./lib/finding');
const {
  createRunDirectories,
  refreshLatest,
  renderImprovementPlan,
  renderPatchPreview,
  renderSummaryMarkdown,
  writeJson,
  writeText,
} = require('./lib/report-writer');
const { buildScorecard } = require('./lib/scoring');
const { lintSkillStructure } = require('./lint-skill-structure');
const { buildSecurityReport, scanInstructionSecurity } = require('./scan-instruction-security');

function runSelfAudit(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const targetPath = options.targetPath || '.';
  const executorContext = buildExecutorContext(repoRoot, {
    scriptPath: options.executorScriptPath,
  });
  const inventory = collectSkillFacts({ repoRoot, targetPath });
  const reviewerGuardCoverageReport = collectReviewerGuardCoverage({ repoRoot });
  const ruleMaturityObservationsReport = collectRuleMaturityObservations({ repoRoot });
  if (inventory.layout.mode === 'no_skills') {
    throw new Error(`NO_SKILLS_FOUND: no SKILL.md found for target "${targetPath}". Searched the target directory and its direct child skill directories.`);
  }
  if (inventory.layout.mode === 'generic') {
    throw new Error('spec-skill-audit generic collection audit is deferred; pass the spec-first repo root or one local skill directory under skills/.');
  }
  if (!['self', 'single'].includes(inventory.layout.mode)) {
    throw new Error(`Unsupported skill audit layout: ${inventory.layout.mode}`);
  }

  const structureFindings = lintSkillStructure(inventory);
  const securityFindings = scanInstructionSecurity({ repoRoot, inventory });
  const triggerReport = extractTriggerSignals(inventory);
  const boundaryReport = detectBoundaryOverlap(inventory);
  const evalReport = buildEvalReadinessReport(inventory);
  const isRepoWideSelfAudit = inventory.layout.mode === 'self';
  const isAuditToolSingleTarget = inventory.layout.mode === 'single'
    && inventory.skills.length === 1
    && inventory.skills[0].skill_id === 'spec-skill-audit';
  const promiseReport = isRepoWideSelfAudit || isAuditToolSingleTarget
    ? buildPromiseImplementationReport({ repoRoot })
    : skippedPromiseImplementationReport('promise implementation audit checks the audit tool itself and runs only for repo-wide self audit or the spec-skill-audit target');
  const governanceReport = !isRepoWideSelfAudit
    ? skippedReport('spec-first.skill-governance-drift.v1', 'governance audit runs only for spec-first self audit')
    : options.includeGovernance === false
    ? skippedReport('spec-first.skill-governance-drift.v1', 'governance audit skipped')
    : auditSpecFirstGovernance({ repoRoot });
  const runtimeReport = !isRepoWideSelfAudit
    ? skippedReport('spec-first.runtime-drift-report.v1', 'runtime drift audit runs only for spec-first self audit')
    : options.includeRuntime === false
    ? skippedReport('spec-first.runtime-drift-report.v1', 'runtime drift audit skipped')
    : auditRuntimeDrift({ repoRoot });

  const allFindings = assignFindingIds('SKILL-AUDIT', [
    ...structureFindings,
    ...securityFindings,
    ...((promiseReport && promiseReport.findings) || []),
    ...((governanceReport && governanceReport.findings) || []),
    ...((runtimeReport && runtimeReport.findings) || []),
  ]).sort(compareFindings);
  const auditReport = buildAuditReport({ inventory, findings: allFindings, executorContext });
  const scorecard = buildScorecard({
    inventory,
    structureFindings,
    securityFindings,
    governanceReport,
    boundaryReport,
  });
  auditReport.summary.average_score = averageScore(scorecard.skills);
  const securityReport = buildSecurityReport(securityFindings);
  const summaryMarkdown = renderSummaryMarkdown({
    inventory,
    auditReport,
    scorecard,
    governanceReport,
    runtimeReport,
    securityReport,
    promiseReport,
    executorContext,
  });
  const improvementPlan = renderImprovementPlan({ auditReport });

  return {
    inventory,
    reviewerGuardCoverageReport,
    ruleMaturityObservationsReport,
    auditReport,
    scorecard,
    triggerReport,
    boundaryReport,
    securityReport,
    evalReport,
    promiseReport,
    governanceReport,
    runtimeReport,
    summaryMarkdown,
    improvementPlan,
    executorContext,
  };
}

function writeAuditArtifacts(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const reports = runSelfAudit(options);
  const dirs = createRunDirectories(repoRoot, { runId: options.runId });

  writeJson(path.join(dirs.runDir, 'skill-source-inventory.json'), reports.inventory);
  writeJson(path.join(dirs.runDir, 'reviewer-guard-coverage-report.json'), reports.reviewerGuardCoverageReport);
  writeJson(path.join(dirs.runDir, 'rule-maturity-observations.json'), reports.ruleMaturityObservationsReport);
  writeJson(path.join(dirs.runDir, 'expert-scorecard.json'), reports.scorecard);
  writeJson(path.join(dirs.runDir, 'skill-audit-report.json'), reports.auditReport);
  writeJson(path.join(dirs.runDir, 'trigger-routing-report.json'), reports.triggerReport);
  writeJson(path.join(dirs.runDir, 'boundary-overlap-matrix.json'), reports.boundaryReport);
  writeJson(path.join(dirs.runDir, 'security-risk-report.json'), reports.securityReport);
  writeJson(path.join(dirs.runDir, 'eval-readiness-report.json'), reports.evalReport);
  writeJson(path.join(dirs.runDir, 'promise-implementation-report.json'), reports.promiseReport);
  writeJson(path.join(dirs.runDir, 'governance-drift-report.json'), reports.governanceReport);
  writeJson(path.join(dirs.runDir, 'runtime-drift-report.json'), reports.runtimeReport);
  writeJson(path.join(dirs.runDir, 'executor-context.json'), reports.executorContext);
  writeText(path.join(dirs.runDir, 'skill-audit-summary.md'), reports.summaryMarkdown);
  writeText(path.join(dirs.runDir, 'skill-improvement-plan.md'), reports.improvementPlan);

  if (options.includePatchPreview) {
    const preview = renderPatchPreview({ auditReport: reports.auditReport });
    writeText(path.join(dirs.runDir, 'patch-preview', 'summary.md'), preview.summary);
    for (const entry of preview.entries) {
      writeText(path.join(dirs.runDir, 'patch-preview', entry.fileName), entry.content);
    }
  }

  refreshLatest(dirs.runDir, dirs.latestDir);

  return {
    schema_version: 'spec-first.skill-audit-run.v1',
    run_id: dirs.runId,
    run_dir: path.relative(repoRoot, dirs.runDir).replace(/\\/g, '/'),
    latest_dir: path.relative(repoRoot, dirs.latestDir).replace(/\\/g, '/'),
    executor_context: reports.executorContext,
    files: listFiles(dirs.runDir).map((filePath) => path.relative(dirs.runDir, filePath).replace(/\\/g, '/')),
  };
}

function buildAuditReport({ inventory, findings, executorContext }) {
  const counts = countBySeverity(findings);
  return {
    schema_version: 'spec-first.skill-audit-report.v1',
    generated_at: new Date().toISOString(),
    summary: {
      total_skills: (inventory.skills || []).length,
      p0_count: counts.P0 || 0,
      p1_count: counts.P1 || 0,
      p2_count: counts.P2 || 0,
      p3_count: counts.P3 || 0,
      average_score: null,
      requires_llm_review: true,
    },
    executor_context: executorContext,
    findings,
  };
}

function buildExecutorContext(repoRoot, options = {}) {
  const resolvedRepoRoot = path.resolve(repoRoot || process.cwd());
  const executorPath = path.resolve(options.scriptPath || __filename);
  const sourceScriptPath = path.join(
    resolvedRepoRoot,
    'skills',
    'spec-skill-audit',
    'scripts',
    'write-audit-artifacts.js',
  );
  const sourceExists = fs.existsSync(sourceScriptPath);
  const driftKnown = compareExecutorToSource(executorPath, sourceScriptPath, sourceExists);
  const origin = detectExecutorOrigin(executorPath, sourceScriptPath, { sourceExists });
  const warnings = [];

  if (sourceExists && executorPath !== sourceScriptPath && origin === 'runtime') {
    warnings.push(
      'running generated runtime audit script inside spec-first source repo; source-of-truth script exists at skills/spec-skill-audit/scripts/write-audit-artifacts.js',
    );
  } else if (sourceExists && executorPath !== sourceScriptPath) {
    warnings.push(
      'running non-source audit script inside spec-first source repo; source-of-truth script exists at skills/spec-skill-audit/scripts/write-audit-artifacts.js',
    );
  }
  if (driftKnown === true) {
    warnings.push('executor script content differs from the source-of-truth audit script');
  }

  return {
    schema_version: 'spec-first.skill-audit-executor-context.v1',
    generated_at: new Date().toISOString(),
    executor_origin: origin,
    executor_path: displayPath(resolvedRepoRoot, executorPath),
    source_script_path: sourceExists
      ? displayPath(resolvedRepoRoot, sourceScriptPath)
      : 'skills/spec-skill-audit/scripts/write-audit-artifacts.js (not found under audited repo)',
    source_runtime_drift_known: driftKnown,
    warnings,
  };
}

function compareExecutorToSource(executorPath, sourceScriptPath, sourceExists) {
  if (!sourceExists) return 'not_checked';
  if (executorPath === sourceScriptPath) return false;
  try {
    return fs.readFileSync(executorPath, 'utf8') !== fs.readFileSync(sourceScriptPath, 'utf8');
  } catch (_error) {
    return 'not_checked';
  }
}

function detectExecutorOrigin(executorPath, sourceScriptPath, options = {}) {
  if (executorPath === sourceScriptPath) return 'source';
  const parts = executorPath.split(path.sep).filter(Boolean);
  const runtimeRoots = new Set(['.agents', '.claude', '.codex']);
  const runtimeIndex = parts.findIndex((part) => runtimeRoots.has(part));
  const tail = ['skills', 'spec-skill-audit', 'scripts', 'write-audit-artifacts.js'];
  const hasExpectedTail = endsWithParts(parts, tail);
  if (runtimeIndex !== -1 && hasExpectedTail) return 'runtime';
  if (hasExpectedTail && !options.sourceExists) return 'source';
  return 'unknown';
}

function endsWithParts(parts, tail) {
  if (parts.length < tail.length) return false;
  const offset = parts.length - tail.length;
  return tail.every((part, index) => parts[offset + index] === part);
}

function displayPath(repoRoot, targetPath) {
  const relative = path.relative(repoRoot, targetPath);
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
    return relative.replace(/\\/g, '/');
  }
  return targetPath.replace(/\\/g, '/');
}

function buildEvalReadinessReport(inventory) {
  const skills = (inventory.skills || []).map((skill) => {
    const evalFiles = skill.resources && skill.resources.evals ? skill.resources.evals.files : [];
    const hasTrigger = evalFiles.some((file) => /trigger/i.test(file));
    const hasBoundary = evalFiles.some((file) => /boundary/i.test(file));
    const hasFailure = evalFiles.some((file) => /failure/i.test(file));
    const hasExpected = evalFiles.some((file) => /expected/i.test(file));
    const missing = [];
    if (!hasTrigger) missing.push('trigger cases');
    if (!hasBoundary) missing.push('boundary cases');
    if (!hasFailure) missing.push('failure cases');
    if (!hasExpected) missing.push('expected behavior');

    return {
      skill_id: skill.skill_id,
      has_evals: skill.has_evals,
      eval_files: evalFiles,
      readiness: missing.length === 0 ? 'ready' : skill.has_evals ? 'partial' : 'missing',
      missing,
    };
  });

  return {
    schema_version: 'spec-first.eval-readiness-report.v1',
    generated_at: new Date().toISOString(),
    skills,
  };
}

function averageScore(skills) {
  if (!Array.isArray(skills) || skills.length === 0) return null;
  const total = skills.reduce((sum, skill) => sum + (Number(skill.overall_score) || 0), 0);
  return Math.round(total / skills.length);
}

function skippedReport(schemaVersion, reason) {
  return {
    schema_version: schemaVersion,
    generated_at: new Date().toISOString(),
    skipped: true,
    reason,
    findings: [],
  };
}

function skippedPromiseImplementationReport(reason) {
  return {
    schema_version: 'spec-first.promise-implementation-report.v1',
    generated_at: new Date().toISOString(),
    report_type: 'deterministic-promise-implementation-signals',
    skipped: true,
    reason,
    note: 'Promise implementation audit is scoped to spec-skill-audit tool promises, not arbitrary target skills.',
    findings: [],
  };
}

function listFiles(rootPath) {
  const files = [];
  function walk(currentPath) {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (entry.isFile()) {
        files.push(entryPath);
      }
    }
  }
  walk(rootPath);
  return files.sort((left, right) => left.localeCompare(right));
}

function parseArgs(argv) {
  const args = {
    repoRoot: process.cwd(),
    targetPath: '.',
    includeRuntime: false,
    includeGovernance: true,
    includePatchPreview: false,
    runId: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--repo') {
      args.repoRoot = requireValue(argv, index, token);
      index += 1;
    } else if (token === '--target') {
      args.targetPath = requireValue(argv, index, token);
      index += 1;
    } else if (token === '--runtime') {
      args.includeRuntime = true;
    } else if (token === '--no-governance') {
      args.includeGovernance = false;
    } else if (token === '--patch-preview') {
      args.includePatchPreview = true;
    } else if (token === '--run-id') {
      args.runId = requireValue(argv, index, token);
      index += 1;
    } else if (!token.startsWith('--')) {
      if (args.targetPath !== '.') {
        throw new Error(`Unexpected extra target path: ${token}`);
      }
      args.targetPath = token;
    } else {
      throw new Error(`Unknown option: ${token}`);
    }
  }

  return args;
}

function requireValue(argv, index, token) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${token} requires a value.`);
  }
  return value;
}

function main(argv = process.argv.slice(2)) {
  const result = writeAuditArtifacts(parseArgs(argv));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildAuditReport,
  buildEvalReadinessReport,
  buildExecutorContext,
  averageScore,
  runSelfAudit,
  writeAuditArtifacts,
};
