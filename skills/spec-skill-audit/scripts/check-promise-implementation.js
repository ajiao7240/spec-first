#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { createFinding } = require('./lib/finding');

function buildPromiseImplementationReport(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const skillRoot = path.join(repoRoot, 'skills', 'spec-skill-audit');
  const reportFormatPath = path.join(skillRoot, 'references', 'report-format.md');
  const skillPath = path.join(skillRoot, 'SKILL.md');
  const writerPath = path.join(skillRoot, 'scripts', 'write-audit-artifacts.js');
  const reportFormat = readIfExists(reportFormatPath);
  const skillText = readIfExists(skillPath);
  const writerText = readIfExists(writerPath);

  const reportFormatFiles = extractReportFormatFiles(reportFormat);
  const skillOutputFiles = extractSkillOutputFiles(skillText, reportFormat);
  const scriptWrittenFiles = extractScriptWrittenFiles(writerText);
  const documentedOptions = extractDocumentedScriptOptions(`${skillText}\n${reportFormat}`);
  const scriptOptions = extractScriptOptions(writerText);
  const findings = [
    ...findMissingFiles({
      files: reportFormatFiles.required,
      writtenFiles: scriptWrittenFiles,
      sourceFile: relative(repoRoot, reportFormatPath),
      sourceKind: 'report-format-required-file',
    }),
    ...findMissingFiles({
      files: skillOutputFiles.required,
      writtenFiles: scriptWrittenFiles,
      sourceFile: relative(repoRoot, skillPath),
      sourceKind: 'skill-output-file',
    }),
    ...findMissingOptions({
      documentedOptions,
      scriptOptions,
      sourceFile: relative(repoRoot, skillPath),
    }),
    ...findUndocumentedOptions({
      documentedOptions,
      scriptOptions,
      sourceFile: relative(repoRoot, writerPath),
    }),
  ];

  return {
    schema_version: 'spec-first.promise-implementation-report.v1',
    generated_at: new Date().toISOString(),
    report_type: 'deterministic-promise-implementation-signals',
    note: 'Scripts compare documented promises with local implementation facts. LLM review decides whether mismatches are real issues.',
    sources: {
      report_format: relative(repoRoot, reportFormatPath),
      skill: relative(repoRoot, skillPath),
      writer: relative(repoRoot, writerPath),
    },
    documented_files: {
      required: reportFormatFiles.required,
      optional: reportFormatFiles.optional,
      skill_outputs: skillOutputFiles.required,
    },
    implemented_files: scriptWrittenFiles,
    documented_options: documentedOptions,
    implemented_options: scriptOptions,
    findings,
  };
}

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function extractReportFormatFiles(markdown) {
  const required = extractInlineCodeBullets(section(markdown, 'Required Files', 'Optional Files'));
  const optional = extractInlineCodeBullets(section(markdown, 'Optional Files', 'Finding Shape'));
  return { required, optional };
}

function extractSkillOutputFiles(markdown, reportFormat) {
  // run-set 的唯一真相源是 report-format.md 的「Output Location And Run Set」。
  // 当前 SKILL.md 的标题是「## Inputs And Outputs」，下面这个 `## Outputs` 分支不会命中，
  // 始终落到 report-format.md；保留它只是为兼容未来某个 skill 重新引入字面 `## Outputs` 段。
  const skillOutputs = extractInlineCodeBullets(section(markdown, 'Outputs', 'Workflow'));
  if (skillOutputs.length > 0) {
    return { required: skillOutputs };
  }
  const runSet = section(
    String(reportFormat || ''),
    'Output Location And Run Set',
    'Context-Governance Exception',
  );
  return { required: extractInlineCodeBullets(runSet) };
}

function section(markdown, heading, nextHeading) {
  const start = new RegExp(`^## ${escapeRegExp(heading)}\\s*$`, 'm').exec(markdown);
  if (!start) return '';
  const rest = markdown.slice(start.index + start[0].length);
  if (!nextHeading) return rest;
  const end = new RegExp(`^## ${escapeRegExp(nextHeading)}\\s*$`, 'm').exec(rest);
  return end ? rest.slice(0, end.index) : rest;
}

function extractInlineCodeBullets(markdown) {
  const values = [];
  const regex = /^-\s+`([^`]+)`/gm;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    values.push(normalizeArtifactPath(match[1]));
  }
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function normalizeArtifactPath(value) {
  const text = String(value || '').trim();
  if (!text || text.endsWith('/')) return '';
  const marker = '.spec-first/audits/skill-audit/latest/';
  if (text.startsWith(marker)) return text.slice(marker.length);
  return text;
}

function extractScriptWrittenFiles(scriptText) {
  const files = new Set();
  const regex = /path\.join\(dirs\.runDir,\s*([^)]+)\)/g;
  let match;
  while ((match = regex.exec(scriptText)) !== null) {
    const parts = [];
    const stringRegex = /'([^']+)'/g;
    let stringMatch;
    while ((stringMatch = stringRegex.exec(match[1])) !== null) {
      parts.push(stringMatch[1]);
    }
    if (parts.length > 0) files.add(parts.join('/'));
  }
  return [...files].sort((left, right) => left.localeCompare(right));
}

function extractOptions(text) {
  const found = new Set();
  const regex = /--[a-z][a-z0-9-]*/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    found.add(match[0]);
  }
  return [...found].sort((left, right) => left.localeCompare(right));
}

function extractDocumentedScriptOptions(text) {
  return extractOptions(String(text || '')
    .split(/\r?\n/)
    .filter((line) => line.includes('write-audit-artifacts.js'))
    .join('\n'));
}

function extractScriptOptions(scriptText) {
  const found = new Set();
  const regex = /token === '(--[a-z][a-z0-9-]*)'/g;
  let match;
  while ((match = regex.exec(scriptText)) !== null) {
    found.add(match[1]);
  }
  return [...found].sort((left, right) => left.localeCompare(right));
}

function findMissingFiles({ files, writtenFiles, sourceFile, sourceKind }) {
  const written = new Set(writtenFiles);
  return files
    .filter((file) => !isPatchPreviewFile(file))
    .filter((file) => !written.has(file))
    .map((file) => createFinding({
      severity: sourceKind === 'report-format-required-file' ? 'P1' : 'P2',
      category: 'promise_implementation_drift',
      skill_id: 'spec-skill-audit',
      title: 'Documented audit artifact is not written by implementation',
      signal: `${sourceKind}:${file}`,
      claim_type: 'relational',
      evidence: [{ file: sourceFile, excerpt: file }],
      reason: 'A documented audit artifact should be produced by the artifact writer or marked optional.',
      recommendation: `Either write ${file} from write-audit-artifacts.js or revise the documented promise.`,
      confidence: 'high',
    }));
}

function isPatchPreviewFile(file) {
  return String(file || '').startsWith('patch-preview/');
}

function findMissingOptions({ documentedOptions, scriptOptions, sourceFile }) {
  const implemented = new Set(scriptOptions);
  return documentedOptions
    .filter((option) => !implemented.has(option))
    .map((option) => createFinding({
      severity: 'P1',
      category: 'promise_implementation_drift',
      skill_id: 'spec-skill-audit',
      title: 'Documented CLI option is not parsed by implementation',
      signal: `documented-option:${option}`,
      claim_type: 'relational',
      evidence: [{ file: sourceFile, excerpt: option }],
      reason: 'A documented script option should be accepted by parseArgs or removed from the workflow documentation.',
      recommendation: `Add ${option} parsing to write-audit-artifacts.js or remove the documented option.`,
      confidence: 'high',
    }));
}

// 反向检查：实现已解析但契约未文档化的 CLI option。
// 保持为空：当前 6 个 flag 全部已在 SKILL.md 文档化（exact-set 测试守护）。只有当某个
// flag 是「刻意不对用户文档化的内部 flag」时才加入此 allowlist，否则一律文档化。
const INTERNAL_OPTION_ALLOWLIST = new Set([]);

function findUndocumentedOptions({ documentedOptions, scriptOptions, sourceFile }) {
  const documented = new Set(documentedOptions);
  return scriptOptions
    .filter((option) => !documented.has(option))
    .filter((option) => !INTERNAL_OPTION_ALLOWLIST.has(option))
    .map((option) => createFinding({
      severity: 'P2',
      category: 'promise_implementation_drift',
      skill_id: 'spec-skill-audit',
      title: 'Implemented CLI option is not documented',
      signal: `undocumented-option:${option}`,
      claim_type: 'relational',
      evidence: [{ file: sourceFile, excerpt: option }],
      reason: 'A parsed script option should be documented in the workflow or added to the internal-option allowlist.',
      recommendation: `Document ${option} in SKILL.md or add it to INTERNAL_OPTION_ALLOWLIST if it is intentionally internal.`,
      confidence: 'high',
    }));
}

function relative(repoRoot, filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function main(argv = process.argv.slice(2)) {
  const repoRoot = parseRepoRoot(argv);
  process.stdout.write(`${JSON.stringify(buildPromiseImplementationReport({ repoRoot }), null, 2)}\n`);
}

function parseRepoRoot(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--repo') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--repo requires a value.');
      return value;
    }
  }
  return process.cwd();
}

if (require.main === module) {
  main();
}

module.exports = {
  buildPromiseImplementationReport,
  extractDocumentedScriptOptions,
  extractOptions,
  extractScriptWrittenFiles,
  findUndocumentedOptions,
};
