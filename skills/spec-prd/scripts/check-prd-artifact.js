#!/usr/bin/env node
'use strict';

// 确定性 PRD artifact 检查:只报告 Markdown 结构、frontmatter、trace、占位符等
// script-owned facts。是否构成 readiness blocker 由 PRD readiness lens 语义裁决。

const fs = require('fs');
const path = require('path');

const CORE_SECTIONS = [
  'Summary',
  'Change Delta',
  'Requirements',
  'Acceptance Examples',
  'Scope Boundaries',
  'Evidence And Assumptions',
];

const EVIDENCE_TAGS = [
  'confirmed-source',
  'user-stated',
  'source-candidate',
  'external-research',
  'assumption',
];

function parseArgs(argv) {
  const args = { target: null, error: null };
  for (const arg of argv) {
    if (!args.target) {
      args.target = arg;
    }
  }
  return args;
}

function splitLines(text) {
  return text.split(/\r?\n/);
}

function parseFrontmatter(lines) {
  if (lines[0] !== '---') {
    return { present: false, fields: {}, startLine: null, endLine: null };
  }

  const endIndex = lines.findIndex((line, index) => index > 0 && line === '---');
  if (endIndex === -1) {
    return { present: false, fields: {}, startLine: 1, endLine: null };
  }

  const fields = {};
  for (let i = 1; i < endIndex; i += 1) {
    const match = lines[i].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) {
      fields[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
    }
  }

  return {
    present: true,
    fields,
    startLine: 1,
    endLine: endIndex + 1,
  };
}

function parseHeadings(lines) {
  const headings = [];
  lines.forEach((line, index) => {
    const match = line.match(/^(#{2,6})\s+(.+?)\s*$/);
    if (!match) return;
    headings.push({
      level: match[1].length,
      title: match[2].trim(),
      line: index + 1,
    });
  });
  return headings;
}

function sectionRange(lines, headings, title) {
  const heading = headings.find((entry) => entry.title === title);
  if (!heading) return null;
  const startIndex = heading.line - 1;
  const next = headings.find((entry) => (
    entry.line > heading.line && entry.level <= heading.level
  ));
  const endIndex = next ? next.line - 2 : lines.length - 1;
  return {
    title,
    line: heading.line,
    text: lines.slice(startIndex + 1, endIndex + 1).join('\n'),
  };
}

function uniqueMatches(text, regex) {
  const values = new Set();
  for (const match of text.matchAll(regex)) {
    values.add(match[1]);
  }
  return [...values].sort();
}

function lineNumbersFor(lines, regex) {
  const matches = [];
  lines.forEach((line, index) => {
    if (regex.test(line)) {
      matches.push(index + 1);
    }
  });
  return matches;
}

function hasConcreteValueAfterColon(line) {
  const idx = line.indexOf(':');
  if (idx === -1) return false;
  const value = line.slice(idx + 1).trim();
  return Boolean(value) && !/^<.*>$/.test(value) && !/^n\/?a$/i.test(value);
}

function isTableSeparator(cells) {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function tableRows(text) {
  const rows = [];
  splitLines(text).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return;
    const cells = trimmed.slice(1, -1).split('|').map((cell) => cell.trim());
    if (isTableSeparator(cells)) return;
    rows.push(cells);
  });
  return rows.slice(1);
}

function countSectionRows(lines, headings, title) {
  const section = sectionRange(lines, headings, title);
  return section ? tableRows(section.text).length : 0;
}

function countAssumptionRows(lines, headings) {
  const section = sectionRange(lines, headings, 'Evidence And Assumptions');
  if (!section) return 0;
  return tableRows(section.text).filter((cells) => (
    cells.some((cell) => cell.toLowerCase() === 'assumption')
  )).length;
}

function priorityDistribution(lines, headings) {
  const section = sectionRange(lines, headings, 'Requirements');
  const distribution = {};
  if (!section) return distribution;
  tableRows(section.text).forEach((cells) => {
    const requirementId = cells[0] || '';
    const priority = cells[1] || '';
    if (!/\bR-\d{2,}\b/.test(requirementId) || !priority) return;
    distribution[priority] = (distribution[priority] || 0) + 1;
  });
  return distribution;
}

function detectFeatureSliceGaps(lines, headings) {
  const section = sectionRange(lines, headings, 'Feature Slices');
  if (!section) return [];

  const sectionLines = splitLines(section.text);
  const starts = [];
  sectionLines.forEach((line, index) => {
    if (/^\s*feature_id\s*:/i.test(line)) {
      starts.push(index);
    }
  });

  return starts.flatMap((start, idx) => {
    const end = idx + 1 < starts.length ? starts[idx + 1] : sectionLines.length;
    const block = sectionLines.slice(start, end);
    const absoluteLine = section.line + start + 1;
    const acceptanceLine = block.find((line) => /^\s*acceptance_refs\s*:/i.test(line));
    const hasAcceptanceRefs = acceptanceLine && hasConcreteValueAfterColon(acceptanceLine);
    const hasTraceGap = block.some((line) => /trace gap|trace_gap|缺口|未覆盖/i.test(line));
    if (hasAcceptanceRefs || hasTraceGap) return [];
    return [{
      reason_code: 'feature_slice_missing_acceptance_trace',
      line: absoluteLine,
    }];
  });
}

function buildReport(target, text) {
  const normalizedTarget = target.split(path.sep).join('/');
  const lines = splitLines(text);
  const frontmatter = parseFrontmatter(lines);
  const headings = parseHeadings(lines);
  const missingCoreSections = CORE_SECTIONS.filter((section) => (
    !headings.some((heading) => heading.title === section)
  ));
  const requirementIds = uniqueMatches(text, /\b(R-\d{2,})\b/g);
  const acceptanceIds = uniqueMatches(text, /\b(AE-\d{2,})\b/g);
  const nfrIds = uniqueMatches(text, /\b(NFR-\d{2,})\b/g);
  const acceptanceSection = sectionRange(lines, headings, 'Acceptance Examples');
  const acceptanceText = acceptanceSection ? acceptanceSection.text : '';
  const uncoveredRequirements = requirementIds.filter((id) => (
    !new RegExp(`\\b${id}\\b`).test(acceptanceText)
  ));
  const evidenceTagHits = EVIDENCE_TAGS.filter((tag) => text.includes(tag));
  const placeholderLines = lineNumbersFor(lines, /<[^>\n]+>|\bTODO\b|\bTBD\b|\bpending-tooling\b/i);
  const featureSliceGaps = detectFeatureSliceGaps(lines, headings);
  const priorities = priorityDistribution(lines, headings);
  const assumptionRowCount = countAssumptionRows(lines, headings);
  const outstandingQuestionCount = countSectionRows(lines, headings, 'Outstanding Questions');

  const findings = [];
  if (!frontmatter.present) {
    findings.push({ reason_code: 'frontmatter_missing', line: 1 });
  }
  if (frontmatter.present && frontmatter.fields.artifact_kind !== 'prd-requirements') {
    findings.push({
      reason_code: 'artifact_kind_missing_or_wrong',
      expected: 'prd-requirements',
      actual: frontmatter.fields.artifact_kind || null,
      line: frontmatter.startLine,
    });
  }
  if (/^docs\/prds\//.test(normalizedTarget) || normalizedTarget.includes('/docs/prds/')) {
    findings.push({ reason_code: 'forbidden_prds_path', path: normalizedTarget });
  }
  missingCoreSections.forEach((section) => {
    findings.push({ reason_code: 'core_section_missing', section });
  });
  uncoveredRequirements.forEach((requirement_id) => {
    findings.push({ reason_code: 'requirement_without_acceptance_ref', requirement_id });
  });
  placeholderLines.forEach((line) => {
    findings.push({ reason_code: 'placeholder_or_todo_present', line });
  });
  featureSliceGaps.forEach((finding) => findings.push(finding));

  return {
    schema_version: 'spec-prd-artifact-check.v1',
    target,
    status: 'checked',
    facts: {
      frontmatter_present: frontmatter.present,
      artifact_kind: frontmatter.fields.artifact_kind || null,
      core_sections_present: CORE_SECTIONS.filter((section) => !missingCoreSections.includes(section)),
      core_sections_missing: missingCoreSections,
      requirement_ids: requirementIds,
      acceptance_ids: acceptanceIds,
      nfr_ids: nfrIds,
      uncovered_requirements: uncoveredRequirements,
      evidence_tags_present: evidenceTagHits,
      priority_distribution: priorities,
      nfr_count: nfrIds.length,
      assumption_row_count: assumptionRowCount,
      outstanding_question_count: outstandingQuestionCount,
      placeholder_line_count: placeholderLines.length,
      feature_slice_trace_gap_count: featureSliceGaps.length,
    },
    findings,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.error || !args.target) {
    if (args.error) {
      process.stderr.write(`${args.error}\n`);
    }
    process.stderr.write('usage: check-prd-artifact.js <target-prd-path>\n');
    process.exit(2);
  }

  let targetText;
  try {
    targetText = fs.readFileSync(path.resolve(args.target), 'utf8');
  } catch (err) {
    process.stderr.write(`cannot read target: ${args.target}\n`);
    process.exit(2);
  }

  process.stdout.write(JSON.stringify(buildReport(args.target, targetText), null, 2) + '\n');
}

if (require.main === module) {
  main();
}

module.exports = {
  buildReport,
};
