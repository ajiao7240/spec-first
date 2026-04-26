'use strict';

const { buildSeedSet } = require('./seed');
const { expandSeedSet } = require('./expand');
const { rerankContext } = require('./rerank');
const { packContext } = require('./pack');
const { semanticRerank } = require('./semantic-rerank');
const { resolveRetrievalProfile } = require('./profiles');
const { buildQueryPlan } = require('./query-plan');
const { reciprocalRankFusion } = require('./fusion');

function retrieveContext(db, {
  profile,
  query = '',
  changedFiles = [],
  candidateTests = [],
  riskPaths = [],
  budget,
  semantic = false,
  fusion = true,
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
  const fused = fusion
    ? reciprocalRankFusion([
        { name: 'seed', items: seed.seeds, weight: 1.2 },
        { name: 'expanded', items: expanded, weight: 0.9 },
        { name: 'rerank', items: reranked, weight: 1.5 },
      ])
    : reranked;
  const semanticRanked = semanticRerank(fused, { query, enabled: semantic });
  const packed = packContext(semanticRanked, { budget: budget || config.budget });

  return {
    profile: queryPlan.profile,
    query,
    query_plan: queryPlan,
    seed_terms: seed.terms,
    retrieval_algorithm: fusion ? 'rrf_fusion_v1' : 'legacy_weighted_rerank',
    ranked_context: packed.ranked_context,
    estimated_tokens: packed.estimated_tokens,
  };
}

module.exports = {
  retrieveContext,
};
