#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { createFinding } = require('./lib/finding');

const TRUSTED_REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function auditSpecFirstGovernance(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const governancePath = path.join(
    repoRoot,
    'src',
    'cli',
    'contracts',
    'dual-host-governance',
    'skills-governance.json',
  );
  const sourceSkills = listSourceSkillNames(repoRoot);
  const report = {
    schema_version: 'spec-first.skill-governance-drift.v1',
    generated_at: new Date().toISOString(),
    governance_path: path.relative(repoRoot, governancePath).replace(/\\/g, '/'),
    records: [],
    filtered_asset_sets: {},
    findings: [],
    validation_error: null,
  };

  if (!fs.existsSync(governancePath)) {
    report.findings.push(createFinding({
      severity: 'P0',
      category: 'governance_missing',
      title: 'skills-governance.json is missing',
      evidence: [{ file: report.governance_path }],
      reason: 'Dual-host runtime delivery needs a governance truth source.',
      recommendation: 'Restore src/cli/contracts/dual-host-governance/skills-governance.json.',
      confidence: 'high',
    }));
    return report;
  }

  let rawGovernance = null;
  try {
    rawGovernance = JSON.parse(fs.readFileSync(governancePath, 'utf8'));
    report.records = Array.isArray(rawGovernance.skills) ? rawGovernance.skills : [];
  } catch (error) {
    report.validation_error = error instanceof Error ? error.message : String(error);
    report.findings.push(createFinding({
      severity: 'P0',
      category: 'governance_parse_error',
      title: 'Governance JSON cannot be parsed',
      evidence: [{ file: report.governance_path }],
      reason: report.validation_error,
      recommendation: 'Fix JSON syntax before running runtime delivery checks.',
      confidence: 'high',
    }));
    return report;
  }

  try {
    const plugin = options.plugin || require(path.join(
      assertTrustedSpecFirstRepo(repoRoot, 'governance audit'),
      'src',
      'cli',
      'plugin',
    ));
    const loaded = plugin.loadSkillsGovernance();
    report.records = loaded.skills;
    report.filtered_asset_sets.claude = summarizeFilteredAssetSet(plugin.buildFilteredAssetSet('claude'));
    report.filtered_asset_sets.codex = summarizeFilteredAssetSet(plugin.buildFilteredAssetSet('codex'));
  } catch (error) {
    report.validation_error = error instanceof Error ? error.message : String(error);
    report.findings.push(createFinding({
      severity: 'P0',
      category: 'governance_validation_error',
      title: 'Plugin governance validation failed',
      evidence: [{ file: report.governance_path, excerpt: report.validation_error }],
      reason: 'plugin.js is the runtime governance validator and rejected the current contract.',
      recommendation: 'Fix the governance truth source or command template metadata, then rerun the audit.',
      confidence: 'high',
    }));
  }

  const records = Array.isArray(rawGovernance.skills) ? rawGovernance.skills : [];
  const governedSkillNames = new Set(records.map((record) => record.skill_name).filter(Boolean));
  for (const skillName of sourceSkills) {
    if (governedSkillNames.has(skillName)) continue;
    report.findings.push(createFinding({
      severity: 'P0',
      category: 'missing_governance_entry',
      skill_id: skillName,
      title: 'Source skill is missing from dual-host governance contract',
      evidence: [{ file: `skills/${skillName}/SKILL.md` }],
      reason: 'Every bundled source skill must have one governance record so runtime delivery is explicit.',
      recommendation: `Add a skills-governance.json record for ${skillName}.`,
      confidence: 'high',
    }));
  }

  for (const record of records) {
    if (!record || !record.skill_name || sourceSkills.includes(record.skill_name)) continue;
    report.findings.push(createFinding({
      severity: 'P0',
      category: 'unknown_governance_skill',
      skill_id: record.skill_name,
      title: 'Governance record points at a missing source skill',
      evidence: [{ file: report.governance_path, excerpt: record.skill_name }],
      reason: 'Runtime delivery cannot install a source skill that is not bundled.',
      recommendation: 'Remove the stale governance record or restore the source skill directory.',
      confidence: 'high',
    }));
  }

  for (const finding of detectDuplicateCommandNames(records, report.governance_path)) {
    report.findings.push(finding);
  }

  report.summary = {
    source_skill_count: sourceSkills.length,
    governance_record_count: records.length,
    finding_count: report.findings.length,
    p0_count: report.findings.filter((finding) => finding.severity === 'P0').length,
  };

  return report;
}

function assertTrustedSpecFirstRepo(repoRoot, featureName) {
  const realRepoRoot = fs.realpathSync(repoRoot);
  const realTrustedRoot = fs.realpathSync(TRUSTED_REPO_ROOT);
  if (realRepoRoot !== realTrustedRoot) {
    throw new Error(`${featureName} only supports the trusted spec-first source checkout; refusing to load code from ${repoRoot}`);
  }
  return realTrustedRoot;
}

function listSourceSkillNames(repoRoot) {
  const skillsRoot = path.join(repoRoot, 'skills');
  if (!fs.existsSync(skillsRoot)) return [];
  return fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function summarizeFilteredAssetSet(assetSet) {
  return {
    platform: assetSet.platform,
    commands: assetSet.commands.map((command) => command.name),
    workflowSkills: assetSet.workflowSkills,
    skills: assetSet.skills,
    internalSkills: assetSet.internalSkills,
    skipped: assetSet.skipped,
  };
}

function detectDuplicateCommandNames(records, governancePath) {
  const byCommand = new Map();
  for (const record of records) {
    if (!record || record.entry_surface !== 'workflow_command' || !record.command_name) continue;
    if (!byCommand.has(record.command_name)) byCommand.set(record.command_name, []);
    byCommand.get(record.command_name).push(record.skill_name);
  }

  const findings = [];
  for (const [commandName, skillNames] of byCommand.entries()) {
    if (skillNames.length < 2) continue;
    findings.push(createFinding({
      severity: 'P0',
      category: 'command_name_conflict',
      title: 'Workflow command_name is duplicated',
      evidence: [{ file: governancePath, excerpt: `${commandName}: ${skillNames.join(', ')}` }],
      reason: 'A Claude command filename must map to one workflow source.',
      recommendation: `Choose a unique command_name for all but one of: ${skillNames.join(', ')}.`,
      confidence: 'high',
    }));
  }
  return findings;
}

function main(argv = process.argv.slice(2)) {
  const repoFlagIndex = argv.indexOf('--repo');
  const repoRoot = repoFlagIndex === -1 ? process.cwd() : argv[repoFlagIndex + 1];
  process.stdout.write(`${JSON.stringify(auditSpecFirstGovernance({ repoRoot }), null, 2)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  assertTrustedSpecFirstRepo,
  auditSpecFirstGovernance,
  detectDuplicateCommandNames,
  listSourceSkillNames,
};
