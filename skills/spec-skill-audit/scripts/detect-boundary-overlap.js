#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const { extractKeywordSet } = require('./lib/text-signals');

function detectBoundaryOverlap(inventory) {
  const skills = (inventory.skills || []).map((skill) => ({
    skill_id: skill.skill_id,
    keywords: keywordSet(skill),
  }));
  const candidates = [];

  for (let leftIndex = 0; leftIndex < skills.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < skills.length; rightIndex += 1) {
      const left = skills[leftIndex];
      const right = skills[rightIndex];
      const overlap = intersection(left.keywords, right.keywords);
      const unionSize = new Set([...left.keywords, ...right.keywords]).size || 1;
      const score = overlap.length / unionSize;
      if (overlap.length < 4 || score < 0.10) continue;

      candidates.push({
        left_skill_id: left.skill_id,
        right_skill_id: right.skill_id,
        overlap_score: Number(score.toFixed(3)),
        shared_keywords: overlap.slice(0, 20),
        status: 'candidate_requires_llm_review',
      });
    }
  }

  return {
    schema_version: 'spec-first.boundary-overlap-matrix.v1',
    generated_at: new Date().toISOString(),
    note: 'This report lists overlap candidates only. LLM review decides whether responsibilities actually conflict.',
    candidates: candidates.sort((left, right) => right.overlap_score - left.overlap_score),
  };
}

function keywordSet(skill) {
  const text = [
    skill.frontmatter && skill.frontmatter.description,
    ...(skill.sections || []).map((section) => section.title),
    ...(skill.declared_inputs || []),
    ...(skill.declared_outputs || []),
  ].filter(Boolean).join('\n').toLowerCase();

  return extractKeywordSet(text);
}

function intersection(leftSet, rightSet) {
  return [...leftSet].filter((value) => rightSet.has(value)).sort((left, right) => left.localeCompare(right));
}

function main(argv = process.argv.slice(2)) {
  const filePath = argv[0];
  if (!filePath) throw new Error('Usage: node detect-boundary-overlap.js <skill-source-inventory.json>');
  const inventory = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  process.stdout.write(`${JSON.stringify(detectBoundaryOverlap(inventory), null, 2)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  detectBoundaryOverlap,
  keywordSet,
};
