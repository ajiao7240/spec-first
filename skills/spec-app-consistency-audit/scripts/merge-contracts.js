#!/usr/bin/env node
'use strict';

const path = require('node:path');

const {
  makeArtifact,
  parseCommonArgs,
  readArtifact,
  sourceInputFromFile,
  unavailableSourceInput,
  publicPath,
  unique,
  writeJsonOutput,
} = require('./lib/audit-utils');

const PROJECT_EVIDENCE_SOURCES = new Set([
  'prd',
  'product',
  'figma',
  'design',
  'code',
  'route',
  'architecture',
  'engineering_quality',
  'analytics',
  'i18n',
]);

const SEVERITY_ORDER = {
  blocker: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

function mergeContracts(options = {}) {
  const artifactPaths = options.artifacts || [];
  const artifacts = artifactPaths.map((filePath) => ({
    file: path.resolve(filePath),
    artifact: readArtifact(filePath),
  }));
  const mergedSourceInputs = artifacts.flatMap((entry) => entry.artifact.source_inputs || []);
  const degradedModes = artifacts.flatMap((entry) => entry.artifact.degraded_modes || []);

  return makeArtifact({
    schemaVersion: 'merged-app-audit-context.v1',
    artifactId: 'merged-app-audit-context',
    sourceInputs: mergedSourceInputs.length > 0
      ? mergedSourceInputs
      : [unavailableSourceInput('artifacts', 'artifacts', 'artifact_inputs_missing')],
    body: {
      artifact_count: artifacts.length,
      artifacts: artifacts.map((entry) => ({
        artifact_id: entry.artifact.artifact_id || null,
        schema_version: entry.artifact.schema_version || null,
        contract_status: entry.artifact.contract_status || null,
        file: publicPath(options.repoRoot || process.cwd(), entry.file, 'artifact-outside-repo'),
      })),
      coverage: buildCoverage(artifacts.map((entry) => entry.artifact)),
      degraded_modes: degradedModes,
      extraction_notes: [
        'Merged context preserves source artifact status and does not promote candidate facts to confirmed issues.',
      ],
    },
  });
}

function applyEvidenceGate(issues) {
  return issues.map((issue) => {
    const allEvidence = collectIssueEvidence(issue);
    const projectEvidence = collectProjectEvidence(issue);
    const rulePackEvidence = collectRulePackEvidence(issue);
    if (allEvidence.length === 0) {
      return {
        ...issue,
        contract_status: 'rejected',
        static_confirmed: false,
        evidence_gate: {
          passed: false,
          reason: 'issue_requires_evidence_or_provenance',
          project_evidence_count: 0,
          rule_pack_evidence_count: rulePackEvidence.length,
        },
      };
    }
    if (issue.contract_status === 'confirmed' && projectEvidence.length === 0) {
      return {
        ...issue,
        contract_status: 'rejected',
        static_confirmed: false,
        evidence_gate: {
          passed: false,
          reason: 'confirmed_issue_requires_project_specific_evidence',
          project_evidence_count: 0,
          rule_pack_evidence_count: rulePackEvidence.length,
        },
      };
    }
    return {
      ...issue,
      evidence_gate: {
        passed: true,
        reason: projectEvidence.length > 0
          ? 'project_specific_evidence_present'
          : 'non_confirmed_issue_has_advisory_evidence_only',
        project_evidence_count: projectEvidence.length,
        rule_pack_evidence_count: rulePackEvidence.length,
      },
    };
  });
}

function buildAuditReport(options = {}) {
  const artifacts = (options.artifacts || []).map((filePath) => readArtifact(filePath));
  const pilotValidation = options.pilotValidation ? readArtifact(options.pilotValidation) : null;
  const rawIssues = (options.issues || []).flatMap((filePath) => {
    const input = readArtifact(filePath);
    return Array.isArray(input) ? input : (input.issues || []);
  });
  const gatedIssues = applyEvidenceGate(rawIssues);
  const acceptedIssues = gatedIssues.filter((issue) => issue.contract_status !== 'rejected');
  const rejectedIssues = gatedIssues.filter((issue) => issue.contract_status === 'rejected');
  const scopeAndDegradedModes = artifacts.flatMap((artifact) => artifact.degraded_modes || []);
  const sourceInputs = [
    ...artifacts.flatMap((artifact) => artifact.source_inputs || []),
    ...(options.issues || []).map((filePath) => sourceInputFromFile('issues', filePath, options.repoRoot || process.cwd())),
    ...(options.pilotValidation ? [sourceInputFromFile('pilot-validation', options.pilotValidation, options.repoRoot || process.cwd())] : []),
  ];

  return makeArtifact({
    schemaVersion: 'spec-app-consistency-audit-report.v1',
    artifactId: 'audit-report',
    sourceInputs: sourceInputs.length > 0
      ? sourceInputs
      : [unavailableSourceInput('artifacts', 'artifacts', 'artifact_inputs_missing')],
    body: {
      summary: summarizeIssues(acceptedIssues, rejectedIssues),
      scope_and_degraded_modes: scopeAndDegradedModes,
      issues: sortIssues(acceptedIssues),
      rejected_issues: rejectedIssues,
      section_coverage: buildCoverage(artifacts),
      regression_suggestions: buildRegressionSuggestions(acceptedIssues),
      writeback_preview: buildWritebackPreview(artifacts, acceptedIssues),
      mvp_validation: buildMvpValidationGate({
        issues: acceptedIssues,
        scope_and_degraded_modes: scopeAndDegradedModes,
        section_coverage: buildCoverage(artifacts),
        writeback_preview: buildWritebackPreview(artifacts, acceptedIssues),
        pilot_validation: pilotValidation,
      }),
    },
  });
}

function buildMvpValidationGate(report) {
  const coverage = report.section_coverage || {};
  const issues = report.issues || [];
  const writeback = report.writeback_preview || {};
  const pilot = buildPilotValidationGate(report);
  const localGate = {
    static_first: true,
    has_page_route_section: Boolean(coverage.page_routes),
    has_engineering_quality_section: Boolean(coverage.engineering_quality),
    has_static_result: issues.length === 0 || issues.every((issue) => issue.evidence_gate && issue.evidence_gate.passed),
    writeback_preview_only: writeback.mode === 'preview_only' && writeback.auto_apply === false,
    evidence_gate_enforced: issues.every((issue) => !issue.evidence_gate || issue.evidence_gate.passed),
  };
  return {
    ...localGate,
    pilot_validation: pilot,
    ready_for_v0_2: Object.values(localGate).every(Boolean) && pilot.ready_for_v0_2,
  };
}

function buildPilotValidationGate(report) {
  const pilot = report.pilot_validation || null;
  if (!pilot) {
    return {
      pilot_recorded: false,
      has_real_or_historical_sample: false,
      has_static_confirmed_issue: false,
      has_two_source_evidence_issue: false,
      has_issue_counts: false,
      has_manual_confirmation_metrics: false,
      has_pre_runtime_fix_count: false,
      rule_pack_only_hits_downgraded: false,
      ready_for_v0_2: false,
    };
  }

  const issues = Array.isArray(pilot.static_confirmed_issues) && pilot.static_confirmed_issues.length > 0
    ? pilot.static_confirmed_issues
    : (report.issues || []);
  const hasTwoSourceEvidenceIssue = issues.some((issue) => {
    const sources = new Set(collectProjectEvidence(issue).map((entry) => entry.source));
    const matched = ['prd', 'figma', 'code'].filter((source) => sources.has(source));
    return issue.static_confirmed === true && matched.length >= 2;
  });
  const hasIssueCounts = ['confirmed_issue_count', 'rejected_issue_count', 'advisory_issue_count']
    .every((key) => Number.isFinite(pilot[key]));
  const hasManualConfirmationMetrics = Number.isFinite(pilot.manual_confirmation_rate)
    && Array.isArray(pilot.false_positive_reasons);

  const result = {
    pilot_recorded: true,
    has_real_or_historical_sample: pilot.sample_type === 'real_app' || pilot.sample_type === 'historical_app',
    has_static_confirmed_issue: issues.some((issue) => issue.static_confirmed === true),
    has_two_source_evidence_issue: hasTwoSourceEvidenceIssue,
    has_issue_counts: hasIssueCounts,
    has_manual_confirmation_metrics: hasManualConfirmationMetrics,
    has_pre_runtime_fix_count: Number.isFinite(pilot.pre_runtime_fixable_count),
    rule_pack_only_hits_downgraded: pilot.rule_pack_only_hits_downgraded === true,
  };

  return {
    ...result,
    ready_for_v0_2: Object.values(result).every(Boolean),
  };
}

function collectProjectEvidence(issue) {
  const entries = [];
  const evidence = issue.evidence || {};
  if (Array.isArray(evidence)) {
    entries.push(...evidence.filter(isProjectEvidence));
  }
  for (const [source, values] of Object.entries(evidence)) {
    if (Array.isArray(values)) {
      entries.push(...values.map((entry) => ({ source, ...entry })).filter(isProjectEvidence));
    }
  }
  const provenance = Array.isArray(issue.provenance) ? issue.provenance : [];
  for (const entry of provenance) {
    if (isProjectEvidence(entry)) entries.push(entry);
  }
  return entries;
}

function collectRulePackEvidence(issue) {
  const evidence = issue.evidence || {};
  const entries = [];
  if (Array.isArray(evidence)) {
    entries.push(...evidence.filter(isRulePackEvidence));
  }
  if (Array.isArray(evidence.rule_pack)) entries.push(...evidence.rule_pack);
  if (Array.isArray(evidence.rule_pack_selection)) entries.push(...evidence.rule_pack_selection);
  if (Array.isArray(issue.related_rule_packs)) entries.push(...issue.related_rule_packs.map((name) => ({ source: 'rule_pack', name })));
  return entries;
}

function collectIssueEvidence(issue) {
  const evidence = issue.evidence || {};
  const entries = [];
  if (Array.isArray(evidence)) entries.push(...evidence);
  if (evidence && typeof evidence === 'object' && !Array.isArray(evidence)) {
    for (const [source, values] of Object.entries(evidence)) {
      if (Array.isArray(values)) entries.push(...values.map((entry) => ({ source, ...entry })));
    }
  }
  if (Array.isArray(issue.provenance)) entries.push(...issue.provenance);
  return entries.filter((entry) => entry && typeof entry === 'object');
}

function isProjectEvidence(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (PROJECT_EVIDENCE_SOURCES.has(entry.source)) return true;
  if (entry.source !== 'contract') return false;
  if (isRulePackEvidence(entry)) return false;
  return Boolean(entry.file || entry.artifact_id || entry.path);
}

function isRulePackEvidence(entry) {
  if (!entry || typeof entry !== 'object') return false;
  return entry.source === 'rule_pack'
    || entry.source === 'rule_pack_selection'
    || Boolean(entry.rule_pack || entry.rule_pack_name);
}

function buildCoverage(artifacts) {
  return {
    product: artifacts.some((artifact) => artifact.artifact_id === 'product-contract'),
    figma: artifacts.some((artifact) => artifact.artifact_id === 'figma-design-contract'),
    code: artifacts.some((artifact) => artifact.artifact_id === 'codebase-contract'),
    page_routes: artifacts.some((artifact) => artifact.artifact_id === 'page-route-contract'),
    architecture: artifacts.some((artifact) => artifact.artifact_id === 'kmp-architecture-contract'),
    engineering_quality: artifacts.some((artifact) => artifact.artifact_id === 'engineering-quality-contract'),
    components: artifacts.some((artifact) => artifact.artifact_id === 'component-contract'),
    modules: artifacts.some((artifact) => artifact.artifact_id === 'module-contract'),
    analytics: artifacts.some((artifact) => artifact.artifact_id === 'analytics-contract'),
    i18n: artifacts.some((artifact) => artifact.artifact_id === 'i18n-contract'),
    industry: artifacts.some((artifact) => artifact.artifact_id === 'industry-profile'),
    rule_packs: artifacts.some((artifact) => artifact.artifact_id === 'rule-pack-selection'),
  };
}

function summarizeIssues(issues, rejectedIssues) {
  return {
    blocker_count: issues.filter((issue) => issue.severity === 'blocker').length,
    high_count: issues.filter((issue) => issue.severity === 'high').length,
    medium_count: issues.filter((issue) => issue.severity === 'medium').length,
    low_count: issues.filter((issue) => issue.severity === 'low').length,
    rejected_count: rejectedIssues.length,
    static_confirmed_count: issues.filter((issue) => issue.static_confirmed === true).length,
  };
}

function sortIssues(issues) {
  return [...issues].sort((left, right) => {
    const severity = (SEVERITY_ORDER[left.severity] ?? 99) - (SEVERITY_ORDER[right.severity] ?? 99);
    if (severity !== 0) return severity;
    return String(left.id || left.title || '').localeCompare(String(right.id || right.title || ''));
  });
}

function buildRegressionSuggestions(issues) {
  return issues.map((issue) => ({
    issue_id: issue.id || null,
    category: issue.category || 'app_consistency',
    suggestion: `Add regression coverage for: ${issue.title || issue.category || 'app consistency issue'}`,
    evidence_sources: unique(collectProjectEvidence(issue).map((entry) => entry.source)),
    status: 'candidate',
  }));
}

function buildWritebackPreview(artifacts, issues) {
  const domains = buildCoverage(artifacts);
  return {
    mode: 'preview_only',
    auto_apply: false,
    paths: [
      '.spec-first/app-audit/writeback-preview/repo-profile.patch.yaml',
      '.spec-first/app-audit/writeback-preview/suggested-standards.md',
    ],
    suggested_profile_updates: {
      app_audit_domains_seen: Object.entries(domains).filter(([, present]) => present).map(([domain]) => domain),
      issue_categories_seen: unique(issues.map((issue) => issue.category || 'uncategorized')),
    },
  };
}

if (require.main === module) {
  try {
    const options = parseCommonArgs(process.argv.slice(2));
    const result = options.issue || options.issues ? buildAuditReport(options) : mergeContracts(options);
    writeJsonOutput(result, options.output);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  applyEvidenceGate,
  buildAuditReport,
  buildMvpValidationGate,
  buildPilotValidationGate,
  mergeContracts,
};
