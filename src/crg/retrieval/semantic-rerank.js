'use strict';

// lexical overlap only: identifier-aware rerank, not dense semantic retrieval
function splitIdentifier(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[_\-./\s]+/)
    .map((item) => item.toLowerCase())
    .filter(Boolean);
}

function semanticRerank(items, { query = '', enabled = false } = {}) {
  if (!enabled) return items;

  const queryTerms = new Set(splitIdentifier(query));

  return [...items]
    .map((item) => {
      const haystackTerms = new Set([
        ...splitIdentifier(item.name || ''),
        ...splitIdentifier(item.retrieval_text || ''),
      ]);
      let overlap = 0;
      for (const term of queryTerms) {
        if (haystackTerms.has(term)) overlap++;
      }
      return {
        ...item,
        score: item.score + (overlap * 0.5),
        reasons: overlap > 0
          ? [...new Set([...(item.reasons || []), 'semantic_overlap'])]
          : [...(item.reasons || [])],
      };
    })
    .sort((left, right) => right.score - left.score);
}

module.exports = {
  semanticRerank,
};
