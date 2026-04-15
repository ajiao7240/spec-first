'use strict';

const { resolveRetrievalProfile } = require('./profiles');

function rerankContext(items, {
  profile = 'review',
  changedFiles = [],
  candidateTests = [],
  riskPaths = [],
} = {}) {
  const config = resolveRetrievalProfile(profile);
  const changedSet = new Set(changedFiles);
  const testSet = new Set(candidateTests);
  const riskSet = new Set(riskPaths);

  return items
    .map((item) => {
      let score = item.score || 0;
      const scoreBreakdown = {
        base: item.score || 0,
        changed_file: 0,
        candidate_test: 0,
        risk_path: 0,
        graph_expand: 0,
        chunk_expand: 0,
        chunk: 0,
        module: 0,
        entrypoint: 0,
      };
      const reasons = new Set(item.reasons || []);

      if (changedSet.has(item.file_path)) {
        score += config.weights.changed_file;
        scoreBreakdown.changed_file = config.weights.changed_file;
        reasons.add('changed_file');
      }
      if (testSet.has(item.file_path) || /test|spec/i.test(item.file_path)) {
        score += config.weights.candidate_test;
        scoreBreakdown.candidate_test = config.weights.candidate_test;
        reasons.add('candidate_test');
      }
      if (riskSet.has(item.file_path)) {
        score += config.weights.risk_path;
        scoreBreakdown.risk_path = config.weights.risk_path;
        reasons.add('risk_path');
      }
      if (reasons.has('graph_expand')) {
        score += config.weights.graph_expand;
        scoreBreakdown.graph_expand = config.weights.graph_expand;
      }
      if (reasons.has('chunk_expand')) {
        score += config.weights.chunk_expand;
        scoreBreakdown.chunk_expand = config.weights.chunk_expand;
      }
      if (item.type === 'chunk') {
        score += config.weights.chunk;
        scoreBreakdown.chunk = config.weights.chunk;
        reasons.add('chunk');
      }
      if (item.kind === 'module') {
        score += config.weights.module;
        scoreBreakdown.module = config.weights.module;
        reasons.add('module');
      }
      if (item.kind === 'function' || item.kind === 'class') {
        score += config.weights.entrypoint;
        scoreBreakdown.entrypoint = config.weights.entrypoint;
        reasons.add('entrypoint');
      }

      return {
        ...item,
        score,
        score_breakdown: {
          ...scoreBreakdown,
          total: score,
        },
        reasons: [...reasons],
      };
    })
    .sort((left, right) => right.score - left.score);
}

module.exports = {
  rerankContext,
};
