'use strict';

function buildReviewQueue({ assets = [], freshness, contradictions } = {}) {
  const queue = [];
  let index = 0;

  function nextId(prefix) {
    index += 1;
    return `${prefix}-${index}`;
  }

  for (const asset of assets) {
    if (!asset.last_verified) {
      queue.push({
        id: nextId('review-queue'),
        type: 'unverified_asset',
        status: 'open',
        asset_path: asset.asset_path,
        owner: asset.owner || null,
        reviewer: asset.reviewer || null,
      });
    }
  }
  if (freshness && freshness.status === 'stale') {
    queue.push({
      id: nextId('review-queue'),
      type: 'stale_context',
      status: 'open',
      reasons: freshness.stale_reasons || [],
    });
  }
  if (contradictions && Array.isArray(contradictions.contradictions)) {
    for (const item of contradictions.contradictions) {
      queue.push({
        id: nextId('review-queue'),
        type: 'contradiction',
        status: 'open',
        fact_key: item.fact_key,
        assets: item.assets,
      });
    }
  }
  return queue;
}

module.exports = {
  buildReviewQueue,
};
