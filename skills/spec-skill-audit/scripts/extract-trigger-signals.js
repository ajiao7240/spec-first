#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const { extractTopKeywords } = require('./lib/text-signals');

const BROAD_WORDS = [
  'anything',
  'everything',
  'general',
  'any task',
  'all tasks',
  'whatever',
  '通用',
  '任何',
  '所有',
];

const NEGATIVE_BOUNDARY_PATTERNS = [
  /do\s+not\s+use/i,
  /do\s+not\s+trigger/i,
  /don't\s+use/i,
  /not\s+for/i,
  /不触发/,
  /不用于/,
  /不适用/,
];

function extractTriggerSignals(inventory) {
  const signals = (inventory.skills || []).map((skill) => {
    const description = String((skill.frontmatter && skill.frontmatter.description) || '');
    const whenToUse = sectionText(skill, ['when-to-use', 'usage']);
    const whenNot = sectionText(skill, ['when-not-to-use']);
    const text = `${description}\n${whenToUse}\n${whenNot}`;

    return {
      skill_id: skill.skill_id,
      description,
      declared_trigger_phrases: extractBullets(whenToUse),
      declared_non_trigger_phrases: extractBullets(whenNot),
      discovery_readiness: buildDiscoveryReadiness({
        description,
        whenToUse,
        whenNot,
      }),
      referenced_workflows: extractWorkflowReferences(text, skill.skill_id),
      likely_overlap_keywords: extractTopKeywords(text),
      ambiguous_trigger_wording: BROAD_WORDS.filter((word) => text.toLowerCase().includes(word.toLowerCase())),
      requires_llm_judgment: true,
    };
  });

  return {
    schema_version: 'spec-first.trigger-routing-report.v1',
    generated_at: new Date().toISOString(),
    report_type: 'deterministic-trigger-signals',
    note: 'Scripts extract trigger signals only. LLM review decides whether the trigger behavior is semantically correct.',
    skills: signals,
  };
}

function buildDiscoveryReadiness({ description, whenToUse, whenNot }) {
  const positiveCases = extractBullets(whenToUse).slice(0, 3);
  const negativeCases = extractBullets(whenNot).slice(0, 3);
  const descriptionHasNegativeBoundary = NEGATIVE_BOUNDARY_PATTERNS.some((pattern) => pattern.test(description));
  const missing = [];
  if (!descriptionHasNegativeBoundary) missing.push('frontmatter negative boundary');
  if (positiveCases.length === 0) missing.push('positive trigger examples');
  if (negativeCases.length === 0) missing.push('negative trigger examples');

  return {
    description_has_negative_boundary: descriptionHasNegativeBoundary,
    should_trigger_case_candidates: positiveCases,
    should_not_trigger_case_candidates: negativeCases,
    readiness: missing.length === 0 ? 'ready' : 'partial',
    missing,
    requires_llm_judgment: true,
  };
}

function sectionText(skill, names) {
  const sections = new Map((skill.sections || []).map((section) => [section.normalized, section]));
  const section = names.map((name) => sections.get(name)).find(Boolean);
  return section && section.text ? section.text : '';
}

function extractBullets(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*[-*]\s+(.+)$/))
    .filter(Boolean)
    .map((match) => match[1].trim())
    .filter(Boolean)
    .slice(0, 30);
}

function extractWorkflowReferences(text, currentSkillId) {
  const found = new Set();
  const regex = /\bspec-[a-z0-9-]+\b/g;
  let match;
  while ((match = regex.exec(String(text || ''))) !== null) {
    if (match[0] !== currentSkillId) found.add(match[0]);
  }
  return [...found].sort((left, right) => left.localeCompare(right));
}

function main(argv = process.argv.slice(2)) {
  const filePath = argv[0];
  if (!filePath) throw new Error('Usage: node extract-trigger-signals.js <skill-source-inventory.json>');
  const inventory = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  process.stdout.write(`${JSON.stringify(extractTriggerSignals(inventory), null, 2)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildDiscoveryReadiness,
  extractTriggerSignals,
  extractWorkflowReferences,
};
