'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  GRAPH_CURRENT_FILE,
  GRAPH_LAST_KNOWN_GOOD_FILE,
  resolveGraphDb,
} = require('../artifact-paths');
const { writeGraphPointer } = require('./paths');

function promoteGeneration(repoRoot, { generationId, dbPath, health, qualityPath = null }) {
  const relativeDbPath = path.relative(repoRoot, dbPath);
  const payload = {
    generation_id: generationId,
    db_path: relativeDbPath,
    promoted_at: new Date().toISOString(),
    status: 'healthy',
    node_count: health.node_count,
    edge_count: health.edge_count,
    quality_path: qualityPath,
  };

  writeGraphPointer(repoRoot, GRAPH_CURRENT_FILE, payload);
  writeGraphPointer(repoRoot, GRAPH_LAST_KNOWN_GOOD_FILE, payload);

  fs.copyFileSync(dbPath, resolveGraphDb(repoRoot));

  return payload;
}

module.exports = { promoteGeneration };
