'use strict';

const fs = require('node:fs');

function assessGenerationHealth({ dbPath, nodeCount, edgeCount }) {
  if (!fs.existsSync(dbPath)) {
    return {
      healthy: false,
      reason: 'db_missing',
      node_count: nodeCount,
      edge_count: edgeCount,
    };
  }

  if (!Number.isFinite(nodeCount) || nodeCount <= 0) {
    return {
      healthy: false,
      reason: 'empty_graph',
      node_count: nodeCount,
      edge_count: edgeCount,
    };
  }

  return {
    healthy: true,
    reason: null,
    node_count: nodeCount,
    edge_count: edgeCount,
  };
}

module.exports = { assessGenerationHealth };
