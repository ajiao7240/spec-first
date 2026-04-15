'use strict';

const RETRIEVAL_PROFILES = {
  review: {
    budget: 1400,
    seed_limit: 12,
    weights: {
      changed_file: 5,
      candidate_test: 4,
      risk_path: 3,
      graph_expand: 2,
      chunk_expand: 1,
      chunk: 2,
      entrypoint: 1,
      module: 1,
    },
    default_terms: ['review', 'risk', 'test', 'change'],
  },
  plan: {
    budget: 1400,
    seed_limit: 12,
    weights: {
      changed_file: 1,
      candidate_test: 1,
      risk_path: 1,
      graph_expand: 1,
      chunk_expand: 1,
      chunk: 2,
      entrypoint: 4,
      module: 3,
    },
    default_terms: ['entrypoint', 'module', 'architecture', 'integration'],
  },
  work: {
    budget: 1400,
    seed_limit: 12,
    weights: {
      changed_file: 4,
      candidate_test: 3,
      risk_path: 2,
      graph_expand: 2,
      chunk_expand: 1,
      chunk: 2,
      entrypoint: 1,
      module: 2,
    },
    default_terms: ['change', 'test', 'module', 'impact'],
  },
  search: {
    budget: 1200,
    seed_limit: 10,
    weights: {
      changed_file: 1,
      candidate_test: 1,
      risk_path: 1,
      graph_expand: 1,
      chunk_expand: 1,
      chunk: 1,
      entrypoint: 1,
      module: 1,
    },
    default_terms: ['search', 'symbol', 'query'],
  },
};

function resolveRetrievalProfile(profile) {
  return RETRIEVAL_PROFILES[profile] || RETRIEVAL_PROFILES.review;
}

module.exports = {
  RETRIEVAL_PROFILES,
  resolveRetrievalProfile,
};
