'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { tryReadJson } = require('./io');

function computeReadiness(repoRoot) {
  const snapshot = currentRepoSnapshot(repoRoot);
  const providerStatusPath = path.join(repoRoot, '.spec-first/graph/provider-status.json');
  const graphFactsPath = path.join(repoRoot, '.spec-first/graph/graph-facts.json');
  const impactCapabilitiesPath = path.join(repoRoot, '.spec-first/impact/bootstrap-impact-capabilities.json');
  const providerStatus = tryReadJson(providerStatusPath);
  const graphFacts = tryReadJson(graphFactsPath);
  const impactCapabilities = tryReadJson(impactCapabilitiesPath);
  const providers = Array.isArray(providerStatus.value && providerStatus.value.providers)
    ? providerStatus.value.providers
    : [];
  const targetProvider = providers.find((provider) => provider.provider === 'gitnexus') || null;
  const artifactInventory = buildArtifactInventory(repoRoot, providers);

  if (!providerStatus.ok || !graphFacts.ok || !impactCapabilities.ok) {
    return {
      readiness: 'provider-unavailable',
      reason_code: 'canonical_artifact_missing',
      snapshot,
      target_provider: targetProvider,
      normalized_artifact_inventory: artifactInventory,
    };
  }

  if (!targetProvider || targetProvider.query_ready !== true) {
    return {
      readiness: 'provider-unavailable',
      reason_code: 'provider_query_unavailable',
      snapshot,
      target_provider: targetProvider,
      normalized_artifact_inventory: artifactInventory,
    };
  }

  const recordedRevision = graphFacts.value.source_revision || graphFacts.value.staleness_hints?.source_revision || '';
  const recordedDirty = graphFacts.value.worktree_dirty;
  const recordedStatusHash = graphFacts.value.worktree_status_hash
    || graphFacts.value.staleness_hints?.worktree_status_hash
    || '';
  if (
    snapshot.source_revision
    && recordedRevision === snapshot.source_revision
    && recordedDirty === snapshot.worktree_dirty
    && recordedStatusHash === snapshot.worktree_status_hash
  ) {
    return {
      readiness: 'graph-fresh',
      reason_code: 'snapshot_match',
      snapshot,
      target_provider: targetProvider,
      normalized_artifact_inventory: artifactInventory,
    };
  }

  return {
    readiness: 'graph-stale',
    reason_code: 'snapshot_mismatch',
    snapshot,
    recorded_snapshot: {
      source_revision: recordedRevision,
      worktree_dirty: recordedDirty,
      worktree_status_hash: recordedStatusHash,
    },
    target_provider: targetProvider,
    normalized_artifact_inventory: artifactInventory,
  };
}

function currentRepoSnapshot(repoRoot) {
  const sourceRevision = execGit(repoRoot, ['rev-parse', '--verify', 'HEAD^{commit}']).trim();
  const status = execGit(repoRoot, ['status', '--porcelain']).replace(/\n+$/g, '');
  return {
    source_revision: sourceRevision,
    worktree_dirty: status.length > 0,
    worktree_status_hash: `sha256:${crypto.createHash('sha256').update(status).digest('hex')}`,
  };
}

function execGit(repoRoot, args) {
  try {
    return execFileSync('git', ['-C', repoRoot, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (_error) {
    return '';
  }
}

function buildArtifactInventory(repoRoot, providers) {
  const inventory = [];
  for (const provider of providers) {
    const artifacts = provider.normalized_artifacts && typeof provider.normalized_artifacts === 'object'
      ? provider.normalized_artifacts
      : {};
    for (const [artifactId, relPath] of Object.entries(artifacts)) {
      const artifactPath = path.join(repoRoot, relPath);
      const parsed = tryReadJson(artifactPath);
      inventory.push({
        provider: provider.provider,
        artifact_id: artifactId,
        path: relPath,
        readable: parsed.ok,
        schema_version: parsed.ok ? parsed.value.schema_version || null : null,
        fields: parsed.ok ? Object.keys(parsed.value).sort() : [],
        available_query_surfaces: parsed.ok && Array.isArray(parsed.value.available_query_surfaces)
          ? parsed.value.available_query_surfaces
          : [],
        has_semantic_facts: parsed.ok && Array.isArray(parsed.value.facts) && parsed.value.facts.length > 0,
      });
    }
  }
  return inventory;
}

module.exports = {
  computeReadiness,
  currentRepoSnapshot,
  buildArtifactInventory,
};
