'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { evaluateContextForRepo } = require('../../src/context-routing/evaluator');

function loadCases(casesPath) {
  const cases = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
  if (!Array.isArray(cases)) {
    throw new Error('context efficiency cases must be an array');
  }
  for (const item of cases) {
    if (!item.id || !item.repo_slug || !item.stage || !Array.isArray(item.expected_key_evidence)) {
      throw new Error(`invalid context efficiency case: ${JSON.stringify(item)}`);
    }
  }
  return cases;
}

function runContextEfficiencyBenchmark({ repoRoot, casesPath }) {
  const cases = loadCases(casesPath);
  const results = cases.map((item) => {
    const evaluation = evaluateContextForRepo({
      repoRoot,
      slug: item.repo_slug,
      stage: item.stage,
    });
    const matched = item.expected_key_evidence.filter((assetPath) => evaluation.selected_assets.includes(assetPath));
    const firstUsefulIndex = evaluation.selected_assets.findIndex((assetPath) => item.expected_key_evidence.includes(assetPath));
    const irrelevantCount = evaluation.selected_assets.filter((assetPath) => !item.expected_key_evidence.includes(assetPath)).length;

    return {
      id: item.id,
      stage: item.stage,
      level: evaluation.level,
      selected_assets: evaluation.selected_assets,
      estimated_tokens: evaluation.estimated_tokens,
      irrelevant_context_ratio: evaluation.selected_assets.length === 0 ? 0 : irrelevantCount / evaluation.selected_assets.length,
      first_useful_evidence_position: firstUsefulIndex === -1 ? null : firstUsefulIndex + 1,
      matched_evidence: matched,
      fallback_reason: evaluation.fallback_reason,
    };
  });

  return {
    generated_at: new Date().toISOString(),
    case_count: results.length,
    average_irrelevant_context_ratio: results.length === 0
      ? 0
      : results.reduce((sum, item) => sum + item.irrelevant_context_ratio, 0) / results.length,
    fallback_rate: results.length === 0
      ? 0
      : results.filter((item) => item.level !== 'L0').length / results.length,
    results,
  };
}

if (require.main === module) {
  const repoRoot = process.cwd();
  const casesPath = path.join(repoRoot, 'benchmarks', 'context-efficiency', 'cases.json');
  process.stdout.write(`${JSON.stringify(runContextEfficiencyBenchmark({ repoRoot, casesPath }), null, 2)}\n`);
}

module.exports = {
  loadCases,
  runContextEfficiencyBenchmark,
};
