'use strict';

const { resolveChunkingConfig } = require('./lang-config');

const DEFAULT_MAX_CHUNK_LINES = 80;

function sanitizeChunkId(nodeId, index) {
  return `${nodeId}:chunk:${index}`;
}

function buildChunksForNodes(nodes, { maxLines = DEFAULT_MAX_CHUNK_LINES } = {}) {
  const chunks = [];
  for (const node of nodes) {
    if (!node || node.kind === 'module') continue;
    const chunkConfig = maxLines === DEFAULT_MAX_CHUNK_LINES
      ? resolveChunkingConfig(node.file_path)
      : { language: 'custom', maxChunkLines: maxLines };
    const effectiveMaxLines = chunkConfig.maxChunkLines;
    const span = Math.max((node.line_end || 0) - (node.line_start || 0) + 1, 1);
    const chunkCount = Math.max(1, Math.ceil(span / effectiveMaxLines));

    for (let index = 0; index < chunkCount; index++) {
      const start = (node.line_start || 0) + (index * effectiveMaxLines);
      const end = Math.min((node.line_end || 0), start + effectiveMaxLines - 1);
      chunks.push({
        id: sanitizeChunkId(node.id, index + 1),
        node_id: node.id,
        parent_symbol_id: node.id,
        generation_id: node.generation_id || null,
        file_path: node.file_path,
        kind: 'chunk',
        name: `${node.name}#chunk${index + 1}`,
        line_start: start,
        line_end: end,
        summary: `${chunkConfig.language} ${node.kind} ${node.name} chunk ${index + 1}/${chunkCount}`,
        retrieval_text: `${node.retrieval_text || `${node.file_path} ${node.kind} ${node.name}`} lines ${start}-${end}`,
      });
    }
  }
  return chunks;
}

module.exports = {
  DEFAULT_MAX_CHUNK_LINES,
  buildChunksForNodes,
};
