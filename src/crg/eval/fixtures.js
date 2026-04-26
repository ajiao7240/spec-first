'use strict';

const DEFAULT_RETRIEVAL_FIXTURES = [
  {
    id: 'review-critical-change',
    profile: 'review',
    query: 'critical payment review risk',
    changed_files: ['src/a.js'],
    candidate_tests: ['tests/a.test.js'],
    relevant_ids: [
      'src/a.js#function#critical#L1',
      'tests/a.test.js#module#a.test.js#L0',
    ],
  },
  {
    id: 'plan-entrypoints',
    profile: 'plan',
    query: 'architecture modules entrypoints',
    changed_files: [],
    candidate_tests: [],
    relevant_ids: [
      'src/cli/index.js#function#runCli#L1',
      'src/crg/router.js#module#router.js#L0',
    ],
  },
];

function getRetrievalFixtures() {
  return DEFAULT_RETRIEVAL_FIXTURES.map((fixture) => ({ ...fixture }));
}

module.exports = {
  DEFAULT_RETRIEVAL_FIXTURES,
  getRetrievalFixtures,
};
