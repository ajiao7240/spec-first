'use strict';

const { resolveChunkingConfig } = require('./lang-config');

const DEFAULT_MAX_CHUNK_LINES = 80;

function sanitizeChunkId(nodeId, index) {
  return `${nodeId}:chunk:${index}`;
}

function resolveChunkText(node, index, maxLines) {
  const rawText = typeof node.source_text === 'string' && node.source_text
    ? node.source_text
    : (typeof node.retrieval_text === 'string' && node.retrieval_text ? node.retrieval_text : null);
  if (!rawText) return null;

  const lines = rawText.split(/\r?\n/);
  const slice = lines.slice(index * maxLines, (index + 1) * maxLines)
    .join('\n')
    .trim();
  return slice || rawText || null;
}

function buildChunksForNodes(nodes, { maxLines = DEFAULT_MAX_CHUNK_LINES } = {}) {
  const chunks = [];
  for (const node of nodes) {
    if (!node || node.kind === 'module') continue;
    const chunkConfig = maxLines === DEFAULT_MAX_CHUNK_LINES
      ? resolveChunkingConfig(node.file_path)
      : { language: 'custom', maxChunkLines: maxLines };
    const effectiveMaxLines = chunkConfig.maxChunkLines;
    const lineStart = Number.isFinite(node.line_start) ? node.line_start : 0;
    const rawLineEnd = Number.isFinite(node.line_end) ? node.line_end : lineStart;
    const invalidSpan = rawLineEnd < lineStart;
    const lineEnd = invalidSpan ? lineStart : rawLineEnd;
    const span = Math.max(lineEnd - lineStart + 1, 1);
    const chunkCount = Math.max(1, Math.ceil(span / effectiveMaxLines));

    for (let index = 0; index < chunkCount; index++) {
      const start = lineStart + (index * effectiveMaxLines);
      const end = invalidSpan ? lineStart : Math.min(lineEnd, start + effectiveMaxLines - 1);
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
        summary: invalidSpan ? null : `${chunkConfig.language} ${node.kind} ${node.name} chunk ${index + 1}/${chunkCount}`,
        retrieval_text: invalidSpan
          ? (node.retrieval_text || null)
          : resolveChunkText(node, index, effectiveMaxLines),
      });
    }
  }
  return chunks;
}

module.exports = {
  DEFAULT_MAX_CHUNK_LINES,
  buildChunksForNodes,
};
