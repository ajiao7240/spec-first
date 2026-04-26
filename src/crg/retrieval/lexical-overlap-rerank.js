'use strict';

const { splitIdentifier } = require('./tokenize');

function lexicalOverlapRerank(items, { query = '', enabled = false } = {}) {
  if (!enabled) return items;

  const queryTerms = new Set(splitIdentifier(query));
  return [...items]
    .map((item) => {
      const haystackTerms = new Set([
        ...splitIdentifier(item.name || ''),
        ...splitIdentifier(item.retrieval_text || ''),
        ...splitIdentifier(item.file_path || ''),
      ]);
      let overlap = 0;
      for (const term of queryTerms) {
        if (haystackTerms.has(term)) overlap++;
      }
      const boost = overlap * 0.5;
      const scoreBreakdown = {
        ...(item.score_breakdown || {}),
        lexical_overlap: boost,
        total: (item.score || 0) + boost,
      };
      return {
        ...item,
        score: (item.score || 0) + boost,
        score_breakdown: scoreBreakdown,
        reasons: overlap > 0
          ? [...new Set([...(item.reasons || []), 'lexical_overlap'])]
          : [...(item.reasons || [])],
      };
    })
    .sort((left, right) => right.score - left.score);
}

module.exports = {
  lexicalOverlapRerank,
  splitIdentifier,
};
