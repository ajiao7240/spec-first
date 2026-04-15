'use strict';

function resolveOwnershipEntries(ownership) {
  if (!ownership || typeof ownership !== 'object') return {};
  if (ownership.entries && typeof ownership.entries === 'object') {
    return ownership.entries;
  }
  return ownership;
}

function attachOwnership(assets, ownership = {}) {
  const entries = resolveOwnershipEntries(ownership);
  return assets.map((asset) => ({
    ...asset,
    owner: entries[asset.asset_path] ? entries[asset.asset_path].owner : null,
    reviewer: entries[asset.asset_path] ? entries[asset.asset_path].reviewer : null,
    last_verified: entries[asset.asset_path] ? entries[asset.asset_path].last_verified : null,
  }));
}

module.exports = {
  attachOwnership,
  resolveOwnershipEntries,
};
