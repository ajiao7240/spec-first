'use strict';

function estimateTokens(item) {
  return Math.max(80, Math.ceil(String(item.retrieval_text || '').length / 4));
}

function packContext(items, { budget = 1400 } = {}) {
  const packed = [];
  const seenFiles = new Map();
  let usedTokens = 0;

  for (const item of items) {
    const cost = estimateTokens(item);
    const fileCount = seenFiles.get(item.file_path) || 0;
    if (fileCount >= 2) continue;
    if (packed.length > 0 && usedTokens + cost > budget) continue;
    packed.push({
      id: item.node_id,
      file_path: item.file_path,
      kind: item.kind,
      name: item.name,
      type: item.type || 'node',
      score: item.score,
      score_breakdown: item.score_breakdown || null,
      reasons: item.reasons || [],
      retrieval_text: item.retrieval_text,
      estimated_tokens: cost,
    });
    seenFiles.set(item.file_path, fileCount + 1);
    usedTokens += cost;
  }

  return {
    estimated_tokens: usedTokens,
    ranked_context: packed,
  };
}

module.exports = {
  estimateTokens,
  packContext,
};
