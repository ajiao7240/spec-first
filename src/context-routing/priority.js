'use strict';

function getAssetPriority(assetPath) {
  if (assetPath.startsWith('minimal-context/')) return 0;
  if (assetPath.endsWith('.json')) return 1;
  if (assetPath.startsWith('code-facts/')) return 2;
  if (assetPath.startsWith('architecture/')) return 3;
  if (assetPath === 'README.md' || assetPath === '00-summary.md') return 4;
  return 5;
}

function estimateAssetTokens(assetPath) {
  if (assetPath.startsWith('minimal-context/')) return 240;
  if (assetPath.endsWith('.json')) return 300;
  if (assetPath.startsWith('code-facts/')) return 420;
  if (assetPath.startsWith('architecture/')) return 520;
  if (assetPath === 'README.md' || assetPath === '00-summary.md') return 600;
  return 450;
}

function sortAssets(assets) {
  return [...assets].sort((left, right) => {
    const leftPriority = getAssetPriority(left);
    const rightPriority = getAssetPriority(right);
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return left.localeCompare(right);
  });
}

function trimAssetsToBudget(assets, maxTokens) {
  if (!Number.isFinite(maxTokens) || maxTokens <= 0) {
    return {
      selectedAssets: sortAssets(assets),
      estimatedTokens: sortAssets(assets).reduce((sum, assetPath) => sum + estimateAssetTokens(assetPath), 0),
    };
  }

  const sorted = sortAssets(assets);
  const selectedAssets = [];
  let estimatedTokens = 0;

  for (const assetPath of sorted) {
    const cost = estimateAssetTokens(assetPath);
    if (selectedAssets.length > 0 && estimatedTokens + cost > maxTokens) {
      continue;
    }
    selectedAssets.push(assetPath);
    estimatedTokens += cost;
  }

  return { selectedAssets, estimatedTokens };
}

module.exports = {
  estimateAssetTokens,
  getAssetPriority,
  sortAssets,
  trimAssetsToBudget,
};
