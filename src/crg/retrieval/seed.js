'use strict';

const { searchNodes } = require('../search');
const { resolveRetrievalProfile } = require('./profiles');
const { tokenizeQuery } = require('./tokenize');

function extractTerms(query) {
  return tokenizeQuery(query).filter((item) => item.length >= 3);
}

function loadNodesByFiles(db, filePaths) {
  if (!Array.isArray(filePaths) || filePaths.length === 0) return [];
  const placeholders = filePaths.map(() => '?').join(',');
  return db.prepare(`
    SELECT id AS node_id, name, file_path, kind, retrieval_text, 1.0 AS score
    FROM nodes
    WHERE file_path IN (${placeholders})
  `).all(...filePaths);
}

function searchNodesByLike(db, term, limit) {
  const safe = `%${term}%`;
  return db.prepare(`
    SELECT id AS node_id, name, file_path, kind, retrieval_text, 0.7 AS score
    FROM nodes
    WHERE lower(name) LIKE lower(?)
       OR lower(retrieval_text) LIKE lower(?)
    LIMIT ?
  `).all(safe, safe, limit);
}

function loadChunksByFiles(db, filePaths) {
  if (!Array.isArray(filePaths) || filePaths.length === 0) return [];
  const placeholders = filePaths.map(() => '?').join(',');
  try {
    return db.prepare(`
      SELECT id AS node_id, name, file_path, kind, retrieval_text, 1.1 AS score
      FROM chunks
      WHERE file_path IN (${placeholders})
    `).all(...filePaths);
  } catch (_) {
    return [];
  }
}

function buildSeedSet(db, {
  profile = 'review',
  query = '',
  changedFiles = [],
  candidateTests = [],
  limit,
} = {}) {
  const config = resolveRetrievalProfile(profile);
  const terms = extractTerms(query);
  const finalTerms = terms.length > 0 ? terms : config.default_terms;
  const resultMap = new Map();
  const lexicalSearch = typeof searchNodes === 'function'
    ? searchNodes
    : (() => []);

  for (const term of finalTerms) {
    const hits = lexicalSearch(db, term, { limit: config.seed_limit });
    const effectiveHits = hits.length > 0 ? hits : searchNodesByLike(db, term, config.seed_limit);
    for (const hit of effectiveHits) {
      const existing = resultMap.get(hit.node_id);
      if (!existing || existing.score < hit.score) {
        resultMap.set(hit.node_id, {
          ...hit,
          type: 'node',
          reasons: [`fts:${term}`],
        });
      }
    }
  }

  for (const row of loadNodesByFiles(db, changedFiles)) {
    const existing = resultMap.get(row.node_id);
    resultMap.set(row.node_id, {
      ...row,
      type: 'node',
      score: Math.max(existing ? existing.score : 0, row.score),
      reasons: [...new Set([...(existing ? existing.reasons : []), 'changed_file'])],
    });
  }

  for (const row of loadNodesByFiles(db, candidateTests)) {
    const existing = resultMap.get(row.node_id);
    resultMap.set(row.node_id, {
      ...row,
      type: 'node',
      score: Math.max(existing ? existing.score : 0, row.score),
      reasons: [...new Set([...(existing ? existing.reasons : []), 'candidate_test'])],
    });
  }

  for (const row of loadChunksByFiles(db, changedFiles)) {
    const existing = resultMap.get(row.node_id);
    resultMap.set(row.node_id, {
      ...row,
      type: 'chunk',
      score: Math.max(existing ? existing.score : 0, row.score),
      reasons: [...new Set([...(existing ? existing.reasons : []), 'changed_file', 'chunk'])],
    });
  }

  return {
    terms: finalTerms,
    seeds: [...resultMap.values()]
      .sort((left, right) => right.score - left.score)
      .slice(0, limit || config.seed_limit),
  };
}

module.exports = {
  buildSeedSet,
  extractTerms,
};
