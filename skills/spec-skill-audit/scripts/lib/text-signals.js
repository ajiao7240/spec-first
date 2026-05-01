'use strict';

const DEFAULT_STOP_WORDS = new Set([
  'this',
  'that',
  'with',
  'when',
  'from',
  'skill',
  'workflow',
  'user',
  'users',
  'use',
  'uses',
  'using',
  'and',
  'the',
  'for',
  'not',
  'to',
  'of',
  'in',
  'into',
  'current',
  'host',
  'spec',
  'first',
]);

function extractKeywordCounts(text, options = {}) {
  const stopWords = new Set([...DEFAULT_STOP_WORDS, ...(options.stopWords || [])]);
  const counts = new Map();

  for (const word of String(text || '').toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || []) {
    if (stopWords.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  return counts;
}

function extractTopKeywords(text, options = {}) {
  const limit = options.limit || 20;
  return [...extractKeywordCounts(text, options).entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

function extractKeywordSet(text, options = {}) {
  return new Set(extractTopKeywords(text, { ...options, limit: options.limit || Number.MAX_SAFE_INTEGER }));
}

module.exports = {
  DEFAULT_STOP_WORDS,
  extractKeywordCounts,
  extractKeywordSet,
  extractTopKeywords,
};
