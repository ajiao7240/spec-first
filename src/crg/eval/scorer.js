'use strict';

function normalizeIds(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => typeof item === 'string' ? item : item && (item.id || item.node_id))
    .filter(Boolean);
}

function meanReciprocalRank(results, relevantIds) {
  const relevant = new Set(normalizeIds(relevantIds));
  if (relevant.size === 0) return 0;
  const ranked = normalizeIds(results);
  const index = ranked.findIndex((id) => relevant.has(id));
  return index === -1 ? 0 : 1 / (index + 1);
}

function recallAtK(results, relevantIds, k = 10) {
  const relevant = new Set(normalizeIds(relevantIds));
  if (relevant.size === 0) return 0;
  const ranked = normalizeIds(results).slice(0, k);
  const hits = ranked.filter((id) => relevant.has(id)).length;
  return hits / relevant.size;
}

function precisionRecallF1(results, relevantIds, k = 10) {
  const relevant = new Set(normalizeIds(relevantIds));
  const ranked = normalizeIds(results).slice(0, k);
  const hits = ranked.filter((id) => relevant.has(id)).length;
  const precision = ranked.length === 0 ? 0 : hits / ranked.length;
  const recall = relevant.size === 0 ? 0 : hits / relevant.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1, hits };
}

function tokenEfficiency(results, relevantIds, tokenBudget) {
  const relevant = new Set(normalizeIds(relevantIds));
  const ranked = Array.isArray(results) ? results : [];
  const usedTokens = ranked.reduce((sum, item) => sum + (item.estimated_tokens || 0), 0);
  const relevantTokens = ranked
    .filter((item) => relevant.has(item.id || item.node_id))
    .reduce((sum, item) => sum + (item.estimated_tokens || 0), 0);
  return {
    used_tokens: usedTokens,
    relevant_tokens: relevantTokens,
    budget: tokenBudget || null,
    relevant_token_ratio: usedTokens === 0 ? 0 : relevantTokens / usedTokens,
    budget_usage: tokenBudget ? usedTokens / tokenBudget : null,
  };
}

function scoreRetrievalResult(result, fixture, options = {}) {
  const ranked = result && Array.isArray(result.ranked_context) ? result.ranked_context : [];
  const relevantIds = fixture && fixture.relevant_ids ? fixture.relevant_ids : [];
  const k = options.k || 10;
  return {
    fixture_id: fixture && fixture.id ? fixture.id : null,
    mrr: meanReciprocalRank(ranked, relevantIds),
    recall_at_k: recallAtK(ranked, relevantIds, k),
    ...precisionRecallF1(ranked, relevantIds, k),
    token_efficiency: tokenEfficiency(ranked, relevantIds, options.budget),
  };
}

module.exports = {
  meanReciprocalRank,
  precisionRecallF1,
  recallAtK,
  scoreRetrievalResult,
  tokenEfficiency,
};
