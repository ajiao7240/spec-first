'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const WINDOWS_UNSAFE_CHARS = /[<>:"|?*\x00-\x1f]/;

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, String(value), 'utf8');
}

function createRunDirectories(repoRoot, options = {}) {
  const baseDir = path.resolve(options.baseDir || path.join(repoRoot, '.spec-first', 'audits', 'skill-audit'));
  const runId = validateRunId(options.runId || new Date().toISOString().replace(/[:.]/g, '-'));
  const runDir = path.resolve(baseDir, runId);
  const latestDir = path.resolve(baseDir, 'latest');

  if (!isPathInside(baseDir, runDir)) {
    throw new Error(`Invalid run id "${runId}": run directory must stay under ${baseDir}`);
  }

  fs.rmSync(runDir, { recursive: true, force: true });
  fs.mkdirSync(runDir, { recursive: true });
  return { baseDir, runId, runDir, latestDir };
}

function validateRunId(runId) {
  const value = String(runId || '').trim();
  if (
    value === 'latest'
    || value === '.'
    || value === '..'
    || value.includes('/')
    || value.includes('\\')
    || /[. ]$/.test(value)
    || WINDOWS_RESERVED_NAMES.test(value)
    || WINDOWS_UNSAFE_CHARS.test(value)
    || !RUN_ID_PATTERN.test(value)
  ) {
    throw new Error('Invalid run id: use 1-128 letters, numbers, dots, underscores, or dashes; do not use path separators, ".", "..", "latest", Windows reserved names, or a trailing dot/space.');
  }
  return value;
}

function isPathInside(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function refreshLatest(runDir, latestDir) {
  fs.rmSync(latestDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(latestDir), { recursive: true });
  fs.cpSync(runDir, latestDir, { recursive: true });
}

function renderSummaryMarkdown({ inventory, auditReport, scorecard, governanceReport, runtimeReport, securityReport, promiseReport, executorContext }) {
  const counts = auditReport.summary || {};
  const topFindings = (auditReport.findings || [])
    .filter((finding) => ['P0', 'P1'].includes(finding.severity))
    .slice(0, 12);
  const scoreRows = (scorecard.skills || [])
    .slice()
    .sort((left, right) => left.overall_score - right.overall_score)
    .slice(0, 12);

  return [
    '# spec-skill-audit Report',
    '',
    '## Executive Summary',
    '',
    `- Skills scanned: ${inventory.skills ? inventory.skills.length : 0}`,
    `- P0 findings: ${counts.p0_count || 0}`,
    `- P1 findings: ${counts.p1_count || 0}`,
    `- P2 findings: ${counts.p2_count || 0}`,
    `- Scorecards are signals, not gates: ${scorecard.score_is_signal_not_gate ? 'yes' : 'no'}`,
    `- Score reliability: ${scorecard.score_reliability ? scorecard.score_reliability.level : 'unknown'}; conclusion ceiling: ${scorecard.conclusion_ceiling || 'tentative'}`,
    '- LLM review decides semantic quality; deterministic scripts only prepare facts.',
    '',
    '## Execution Context',
    '',
    renderExecutorContext(executorContext),
    '',
    '## P0/P1 Findings',
    '',
    topFindings.length === 0
      ? 'No P0/P1 findings were produced by deterministic checks.'
      : topFindings.map(renderFindingBullet).join('\n'),
    '',
    '## Lowest Score Signals',
    '',
    scoreRows.length === 0
      ? 'No score signals were produced.'
      : scoreRows.map((row) => `- ${row.skill_id}: ${row.overall_score} (${row.grade})`).join('\n'),
    '',
    '## Score Explanation',
    '',
    scoreRows.length === 0
      ? 'No score explanations were produced.'
      : scoreRows.map(renderScoreExplanation).join('\n'),
    '',
    '## Governance',
    '',
    renderGovernanceSummary(governanceReport),
    '',
    '## Runtime Drift',
    '',
    renderRuntimeSummary(runtimeReport),
    '',
    '## Security',
    '',
    renderSecuritySummary(securityReport),
    '',
    '## Promise Implementation',
    '',
    renderPromiseSummary(promiseReport),
    '',
    '## Next Step',
    '',
    'Read `skill-improvement-plan.md`, then let the LLM verify whether deterministic signals represent real skill-quality issues before applying source changes. Patch preview artifacts are explicit only.',
    '',
  ].join('\n');
}

function renderImprovementPlan({ auditReport }) {
  const findings = auditReport.findings || [];
  const p0 = findings.filter((finding) => finding.severity === 'P0');
  const p1 = findings.filter((finding) => finding.severity === 'P1');
  const p2 = findings.filter((finding) => finding.severity === 'P2');

  return [
    '# Skill Improvement Plan',
    '',
    '## Phase 1: Fix P0 Governance And Security Issues',
    '',
    renderFindingPlan(p0, 'No P0 issues found.'),
    '',
    '## Phase 2: Fix P1 Contract And Boundary Issues',
    '',
    renderFindingPlan(p1, 'No P1 issues found.'),
    '',
    '## Phase 3: Normalize Structure And Eval Readiness Signals',
    '',
    renderFindingPlan(p2.slice(0, 30), 'No P2 issues found.'),
    '',
    '## Phase 4: Human Review',
    '',
    '- Treat scorecards as review signals, not release gates.',
    '- Require signal, evidence, counter-evidence, decision, reason, recommendation, and confidence before applying P0/P1 fixes.',
    '- Generate patch preview only when the user explicitly asks for it.',
    '',
  ].join('\n');
}

function renderFindingBullet(finding) {
  return `- ${finding.severity} ${finding.id}: ${finding.skill_id || 'repo'} - ${finding.title}`;
}

function renderExecutorContext(context) {
  if (!context) return 'Execution context was not recorded.';
  const lines = [
    `- Executor origin: ${context.executor_origin || 'unknown'}`,
    `- Executor path: ${context.executor_path || 'unknown'}`,
    `- Source script path: ${context.source_script_path || 'unknown'}`,
    `- Source-runtime drift known: ${String(context.source_runtime_drift_known)}`,
  ];
  const warnings = context.warnings || [];
  if (warnings.length > 0) {
    lines.push(...warnings.map((warning) => `- Warning: ${warning}`));
  }
  return lines.join('\n');
}

function renderScoreExplanation(row) {
  const explanation = row.score_explanation || {};
  const notScored = explanation.not_scored_dimensions || [];
  const whyNotPerfect = explanation.why_not_perfect || [];
  const reliability = row.score_reliability || {};
  const reliabilityReasons = reliability.reasons || [];

  return [
    `- ${row.skill_id}: ${row.overall_score} (${row.grade})`,
    `  - Not scored: ${notScored.length === 0 ? 'none' : notScored.map((entry) => `${entry.dimension} (${entry.status})`).join(', ')}`,
    `  - Main non-perfect signals: ${renderNonPerfectSignals(whyNotPerfect)}`,
    `  - Reliability: ${reliability.level || 'unknown'}; ${reliabilityReasons[0] || 'score requires review'}`,
  ].join('\n');
}

function renderNonPerfectSignals(entries) {
  if (!entries || entries.length === 0) return 'none';
  return entries
    .slice(0, 4)
    .map((entry) => `${entry.dimension}=${entry.score} (${entry.reason})`)
    .join('; ');
}

function renderFindingPlan(findings, emptyText) {
  if (findings.length === 0) return emptyText;
  return findings
    .slice(0, 30)
    .map((finding) => [
      `- ${finding.id}: ${finding.title}`,
      `  - Scope: ${finding.skill_id || 'repo'}`,
      `  - Recommendation: ${finding.recommendation || 'Review with LLM judgment.'}`,
    ].join('\n'))
    .join('\n');
}

function renderGovernanceSummary(report) {
  if (!report) return 'Governance audit was skipped.';
  if (report.skipped) return `Governance audit skipped: ${report.reason || 'not in scope'}.`;
  if (report.validation_error) return `Governance validation error: ${report.validation_error}`;
  return `Governance records: ${(report.records || []).length}; findings: ${(report.findings || []).length}.`;
}

function renderRuntimeSummary(report) {
  if (!report) return 'Runtime drift audit was skipped.';
  if (report.skipped) return `Runtime drift audit skipped: ${report.reason || 'not in scope'}.`;
  const hosts = (report.hosts || []).map((host) => `${host.host}=${host.status}`).join(', ');
  return hosts || 'No runtime host status recorded.';
}

function renderSecuritySummary(report) {
  if (!report) return 'Security scan was skipped.';
  const counts = report.summary || {};
  return `Security signals: P0=${counts.p0_count || 0}, P1=${counts.p1_count || 0}, P2=${counts.p2_count || 0}, P3=${counts.p3_count || 0}.`;
}

function renderPromiseSummary(report) {
  if (!report) return 'Promise implementation audit was skipped.';
  if (report.skipped) return `Promise implementation audit skipped: ${report.reason || 'not in scope'}.`;
  return `Promise implementation signals: findings=${(report.findings || []).length}; documented options=${(report.documented_options || []).length}; implemented options=${(report.implemented_options || []).length}.`;
}

function renderPatchPreview({ auditReport }) {
  const sourceFindings = (auditReport.findings || [])
    .filter((finding) => ['P0', 'P1'].includes(finding.severity))
    .filter((finding) => finding.fix_mode !== 'runtime-init-only');
  const files = new Map();

  for (const finding of sourceFindings) {
    const evidence = finding.evidence && finding.evidence[0];
    const filePath = evidence && evidence.file ? evidence.file : 'repo';
    if (!files.has(filePath)) files.set(filePath, []);
    files.get(filePath).push(finding);
  }

  const summary = [
    '# Patch Preview Summary',
    '',
    'This preview is advisory only. It does not modify source or generated runtime assets.',
    '',
    ...[...files.keys()].map((filePath) => `- ${filePath}: ${files.get(filePath).length} suggested change(s)`),
    '',
  ].join('\n');

  const entries = [...files.entries()].map(([filePath, findings]) => ({
    fileName: safePatchFileName(filePath),
    content: renderPatchPreviewFile(filePath, findings),
  }));

  return { summary, entries };
}

function renderPatchPreviewFile(filePath, findings) {
  return [
    `# Patch Preview: ${filePath}`,
    '',
    'This file contains suggested source changes only. Review before applying.',
    '',
    ...findings.map((finding, index) => [
      `## Change ${index + 1}: ${finding.title}`,
      '',
      `Severity: ${finding.severity}`,
      '',
      '### Reason',
      '',
      finding.reason || 'Deterministic audit signal requires LLM review.',
      '',
      '### Suggested Action',
      '',
      finding.recommendation || 'Review and decide whether to update the source-of-truth file.',
      '',
      '### Requires Human Confirmation',
      '',
      'Yes.',
      '',
    ].join('\n')),
  ].join('\n');
}

function safePatchFileName(filePath) {
  const stem = String(filePath || 'repo').replace(/[^A-Za-z0-9._-]+/g, '-') || 'repo';
  const fileName = `${stem}.patch.md`;
  return WINDOWS_RESERVED_NAMES.test(fileName) ? `path-${fileName}` : fileName;
}

module.exports = {
  createRunDirectories,
  refreshLatest,
  renderImprovementPlan,
  renderPatchPreview,
  renderSummaryMarkdown,
  validateRunId,
  writeJson,
  writeText,
};
