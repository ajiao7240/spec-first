'use strict';

const DEFAULT_RRF_K = 60;

function candidateId(item) {
  return item && (item.node_id || item.id);
}

function reciprocalRankFusion(sources, options = {}) {
  const k = options.k || DEFAULT_RRF_K;
  const weights = options.weights || {};
  const merged = new Map();

  for (const source of sources || []) {
    const name = source.name || 'unknown';
    const weight = weights[name] || source.weight || 1;
    const items = Array.isArray(source.items) ? source.items : [];
    items.forEach((item, index) => {
      const id = candidateId(item);
      if (!id) return;
      const contribution = weight / (k + index + 1);
      const existing = merged.get(id) || {
        ...item,
        node_id: id,
        score: 0,
        reasons: [],
        score_breakdown: { ...(item.score_breakdown || {}) },
      };
      if (item.score_breakdown) {
        for (const [key, value] of Object.entries(item.score_breakdown)) {
          if (key !== 'total' && existing.score_breakdown[key] === undefined) {
            existing.score_breakdown[key] = value;
          }
        }
      }
      existing.score += contribution;
      existing.score_breakdown[name] = (existing.score_breakdown[name] || 0) + contribution;
      existing.score_breakdown.total = existing.score;
      existing.reasons = [...new Set([...(existing.reasons || []), ...(item.reasons || []), `fusion:${name}`])];
      merged.set(id, existing);
    });
  }

  return [...merged.values()].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return String(left.node_id).localeCompare(String(right.node_id));
  });
}

function compareRankings(previousItems, fusedItems, relevantIds) {
  const relevant = new Set(relevantIds || []);
  if (relevant.size === 0) return { comparable: false, previous_first_rank: null, fused_first_rank: null, improved_or_equal: true };
  const firstRank = (items) => {
    const index = (items || []).findIndex((item) => relevant.has(candidateId(item)));
    return index === -1 ? null : index + 1;
  };
  const previousFirstRank = firstRank(previousItems);
  const fusedFirstRank = firstRank(fusedItems);
  return {
    comparable: true,
    previous_first_rank: previousFirstRank,
    fused_first_rank: fusedFirstRank,
    improved_or_equal: fusedFirstRank !== null && (previousFirstRank === null || fusedFirstRank <= previousFirstRank),
  };
}

module.exports = {
  DEFAULT_RRF_K,
  compareRankings,
  reciprocalRankFusion,
};
