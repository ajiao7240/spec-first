'use strict';

const { buildSeedSet } = require('./seed');
const { expandSeedSet } = require('./expand');
const { rerankContext } = require('./rerank');
const { packContext } = require('./pack');
const { semanticRerank } = require('./semantic-rerank');
const { resolveRetrievalProfile } = require('./profiles');
const { buildQueryPlan } = require('./query-plan');

function retrieveContext(db, {
  profile,
  query = '',
  changedFiles = [],
  candidateTests = [],
  riskPaths = [],
  budget,
  semantic = false,
} = {}) {
  const queryPlan = buildQueryPlan({
    profile,
    query,
    changedFiles,
    candidateTests,
  });
  const config = resolveRetrievalProfile(queryPlan.profile);
  const seed = buildSeedSet(db, {
    profile: queryPlan.profile,
    query,
    changedFiles,
    candidateTests,
  });
  const expanded = expandSeedSet(db, seed.seeds);
  const reranked = rerankContext(expanded, {
    profile: queryPlan.profile,
    changedFiles,
    candidateTests,
    riskPaths,
  });
  const semanticRanked = semanticRerank(reranked, { query, enabled: semantic });
  const packed = packContext(semanticRanked, { budget: budget || config.budget });

  return {
    profile: queryPlan.profile,
    query,
    query_plan: queryPlan,
    seed_terms: seed.terms,
    ranked_context: packed.ranked_context,
    estimated_tokens: packed.estimated_tokens,
  };
}

module.exports = {
  retrieveContext,
};
