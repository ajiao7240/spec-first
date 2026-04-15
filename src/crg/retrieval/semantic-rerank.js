'use strict';

function semanticRerank(items, { query = '', enabled = false } = {}) {
  if (!enabled) return items;

  const terms = String(query)
    .toLowerCase()
    .split(/[^a-z0-9_./-]+/)
    .filter((item) => item.length >= 3);

  return [...items]
    .map((item) => {
      const haystack = `${item.name} ${item.retrieval_text}`.toLowerCase();
      const overlap = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return {
        ...item,
        score: item.score + (overlap * 0.5),
        reasons: [...new Set([...(item.reasons || []), 'semantic_overlap'])],
      };
    })
    .sort((left, right) => right.score - left.score);
}

module.exports = {
  semanticRerank,
};
