'use strict';

const fs = require('node:fs');

function validateOwnershipRegistry(registry) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
    throw new Error('invalid ownership registry: root must be an object');
  }
  if (registry.schema_version !== 'v1') {
    throw new Error('invalid ownership registry: schema_version must be v1');
  }
  if (!registry.entries || typeof registry.entries !== 'object' || Array.isArray(registry.entries)) {
    throw new Error('invalid ownership registry: entries must be an object');
  }

  for (const [assetPath, entry] of Object.entries(registry.entries)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`invalid ownership registry entry: ${assetPath}`);
    }
    if (typeof entry.owner !== 'string' || entry.owner.length === 0) {
      throw new Error(`invalid ownership registry owner: ${assetPath}`);
    }
    if (typeof entry.reviewer !== 'string' || entry.reviewer.length === 0) {
      throw new Error(`invalid ownership registry reviewer: ${assetPath}`);
    }
  }

  return registry;
}

function loadOwnershipRegistry(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      status: 'missing',
      entries: {},
      error: 'ownership_registry_missing',
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const validated = validateOwnershipRegistry(parsed);
    return {
      status: 'ok',
      schema_version: validated.schema_version,
      entries: validated.entries,
      error: null,
    };
  } catch (error) {
    return {
      status: 'degraded',
      entries: {},
      error: error.message,
    };
  }
}

module.exports = {
  loadOwnershipRegistry,
  validateOwnershipRegistry,
};
