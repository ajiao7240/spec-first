'use strict';

const { resolveRetrievalProfile } = require('./profiles');

const INTENT_KEYWORDS = {
  plan: ['architecture', 'module', 'modules', 'entrypoint', 'entrypoints', 'integration', 'design'],
  work: ['implement', 'implementation', 'fix', 'patch', 'change', 'work', 'test', 'coverage'],
  review: ['review', 'risk', 'audit', 'blast', 'regression', 'diff', 'change'],
};

function tokenizeQuery(query) {
  return String(query || '')
    .toLowerCase()
    .split(/[^a-z0-9_./-]+/)
    .filter((item) => item.length >= 3);
}

function inferProfile({ profile, query, changedFiles = [], candidateTests = [] } = {}) {
  if (profile && profile !== 'search') {
    return profile;
  }

  const terms = tokenizeQuery(query);
  const scores = {
    plan: 0,
    work: changedFiles.length > 0 || candidateTests.length > 0 ? 1 : 0,
    review: 0,
  };

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (terms.includes(keyword)) {
        scores[intent] += 1;
      }
    }
  }

  const ranked = Object.entries(scores).sort((left, right) => right[1] - left[1]);
  return ranked[0][1] > 0 ? ranked[0][0] : 'review';
}

function buildQueryPlan(input = {}) {
  const resolvedProfile = inferProfile(input);
  const config = resolveRetrievalProfile(resolvedProfile);

  return {
    intent: resolvedProfile,
    profile: resolvedProfile,
    budget: config.budget,
    terms: tokenizeQuery(input.query),
    seed_strategy: {
      use_changed_files: Array.isArray(input.changedFiles) && input.changedFiles.length > 0,
      use_candidate_tests: Array.isArray(input.candidateTests) && input.candidateTests.length > 0,
    },
    ranking_emphasis: Object.keys(config.weights)
      .filter((key) => config.weights[key] > 0)
      .sort((left, right) => config.weights[right] - config.weights[left]),
  };
}

module.exports = {
  buildQueryPlan,
  inferProfile,
  tokenizeQuery,
};
