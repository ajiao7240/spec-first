'use strict';

function uniqueById(items) {
  const map = new Map();
  for (const item of items) {
    if (!item || !item.node_id) continue;
    if (!map.has(item.node_id)) {
      map.set(item.node_id, item);
    }
  }
  return [...map.values()];
}

function loadNeighborNodes(db, nodeIds) {
  if (!Array.isArray(nodeIds) || nodeIds.length === 0) return [];
  const placeholders = nodeIds.map(() => '?').join(',');
  return db.prepare(`
    SELECT DISTINCT n.id AS node_id, n.name, n.file_path, n.kind, n.retrieval_text
    FROM edges e
    JOIN nodes n
      ON (n.id = e.target_id OR n.id = e.source_id)
    WHERE (e.source_id IN (${placeholders}) OR e.target_id IN (${placeholders}))
      AND n.id NOT IN (${placeholders})
  `).all(...nodeIds, ...nodeIds, ...nodeIds).map((row) => ({
    ...row,
    type: 'node',
    score: 0.8,
    reasons: ['graph_expand'],
  }));
}

function loadChunksByParents(db, nodeIds) {
  if (!Array.isArray(nodeIds) || nodeIds.length === 0) return [];
  const placeholders = nodeIds.map(() => '?').join(',');
  try {
    return db.prepare(`
      SELECT id AS node_id, name, file_path, kind, retrieval_text, parent_symbol_id
      FROM chunks
      WHERE parent_symbol_id IN (${placeholders})
    `).all(...nodeIds).map((row) => ({
      ...row,
      type: 'chunk',
      score: 0.9,
      reasons: ['chunk_expand'],
    }));
  } catch (_) {
    return [];
  }
}

function expandSeedSet(db, seeds) {
  const seedIds = seeds.map((item) => item.node_id);
  return uniqueById([
    ...seeds,
    ...loadNeighborNodes(db, seedIds),
    ...loadChunksByParents(db, seedIds),
  ]).map((item) => ({
    ...item,
    depth: seeds.some((seed) => seed.node_id === item.node_id) ? 0 : 1,
  }));
}

module.exports = {
  expandSeedSet,
};
