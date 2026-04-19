'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { runRegression } = require('../benchmarks/regression/run-regression');

function buildBaselineUpdate({ metrics } = {}) {
  return {
    schema_version: 'v2',
    benchmark_contract_version: metrics.benchmark_contract_version,
    analyzer_revision: metrics.analyzer_revision,
    review_input_digest: metrics.review_input_digest,
    repo_qa_input_digest: metrics.repo_qa_input_digest,
    context_efficiency_input_digest: metrics.context_efficiency_input_digest,
    review_average_hit_rate_min: metrics.review_average_hit_rate,
    repo_qa_average_hit_rate_min: metrics.repo_qa_average_hit_rate,
    context_efficiency_irrelevant_ratio_max: metrics.context_efficiency_irrelevant_ratio,
    fallback_rate_max: metrics.fallback_rate,
  };
}

function writeBaselineUpdate({ baselinePath, baseline, dryRun = false } = {}) {
  if (dryRun) {
    return baseline;
  }

  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
  return baseline;
}

function main(argv = process.argv.slice(2)) {
  const repoRoot = process.cwd();
  const baselinePath = path.join(repoRoot, 'benchmarks', 'regression', 'baselines.json');
  const dryRun = argv.includes('--dry-run');
  const result = runRegression({ repoRoot, baselinePath });
  const baseline = buildBaselineUpdate({
    metrics: {
      ...result.metrics,
      benchmark_contract_version: result.benchmark_contract_version,
      analyzer_revision: result.analyzer_revision,
      review_input_digest: result.inputs.review_input_digest,
      repo_qa_input_digest: result.inputs.repo_qa_input_digest,
      context_efficiency_input_digest: result.inputs.context_efficiency_input_digest,
    },
  });
  const output = writeBaselineUpdate({ baselinePath, baseline, dryRun });
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildBaselineUpdate,
  main,
  writeBaselineUpdate,
};
