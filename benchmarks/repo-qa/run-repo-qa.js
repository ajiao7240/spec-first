'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { evaluateContextForRepo } = require('../../src/context-routing/evaluator');

function loadQuestions(questionsPath) {
  const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
  if (!Array.isArray(questions)) {
    throw new Error('repo qa questions must be an array');
  }
  for (const item of questions) {
    if (!item.id || !item.repo_slug || !item.stage || !item.question || !Array.isArray(item.expected_evidence)) {
      throw new Error(`invalid repo qa question: ${JSON.stringify(item)}`);
    }
  }
  return questions;
}

function runRepoQaBenchmark({ repoRoot, questionsPath }) {
  const questions = loadQuestions(questionsPath);
  const results = questions.map((item) => {
    const evaluation = evaluateContextForRepo({
      repoRoot,
      slug: item.repo_slug,
      stage: item.stage,
    });
    const matchedEvidence = item.expected_evidence.filter((assetPath) => evaluation.selected_assets.includes(assetPath));
    return {
      id: item.id,
      question: item.question,
      stage: item.stage,
      level: evaluation.level,
      hit_rate: item.expected_evidence.length === 0 ? 1 : matchedEvidence.length / item.expected_evidence.length,
      evidence_quality: matchedEvidence.length === 0 ? 'low' : matchedEvidence.length === item.expected_evidence.length ? 'high' : 'medium',
      matched_evidence: matchedEvidence,
      missing_evidence: item.expected_evidence.filter((assetPath) => !evaluation.selected_assets.includes(assetPath)),
      fallback_reason: evaluation.fallback_reason,
    };
  });

  return {
    generated_at: new Date().toISOString(),
    question_count: results.length,
    average_hit_rate: results.length === 0 ? 0 : results.reduce((sum, item) => sum + item.hit_rate, 0) / results.length,
    average_missing_evidence_count: results.length === 0
      ? 0
      : results.reduce((sum, item) => sum + item.missing_evidence.length, 0) / results.length,
    fallback_rate: results.length === 0
      ? 0
      : results.filter((item) => item.level !== 'L0').length / results.length,
    results,
  };
}

if (require.main === module) {
  const repoRoot = process.cwd();
  const questionsPath = path.join(repoRoot, 'benchmarks', 'repo-qa', 'questions.json');
  process.stdout.write(`${JSON.stringify(runRepoQaBenchmark({ repoRoot, questionsPath }), null, 2)}\n`);
}

module.exports = {
  loadQuestions,
  runRepoQaBenchmark,
};
