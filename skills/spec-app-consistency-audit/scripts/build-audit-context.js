#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { validateArtifact } = require('./validate-artifacts');

function buildAuditContext(options = {}) {
  const artifactsDir = path.resolve(options.artifactsDir || '.spec-first/app-audit');
  const files = listJsonFiles(artifactsDir);
  const artifacts = [];
  const validation = [];

  for (const filePath of files) {
    let artifact = null;
    try {
      artifact = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      validation.push({
        file: toPosix(path.relative(artifactsDir, filePath)),
        valid: false,
        errors: [{ path: 'file', code: 'invalid_json', message: error.message }],
      });
      continue;
    }

    const result = validateArtifact(artifact);
    validation.push({
      file: toPosix(path.relative(artifactsDir, filePath)),
      valid: result.valid,
      errors: result.errors,
    });
    artifacts.push({
      artifact_id: artifact.artifact_id || null,
      schema_version: artifact.schema_version || null,
      contract_status: artifact.contract_status || null,
      generated_at: artifact.generated_at || null,
      source_inputs: artifact.source_inputs || [],
      consumers: artifact.consumers || [],
      file: toPosix(path.relative(artifactsDir, filePath)),
    });
  }

  const context = {
    schema_version: 'spec-app-consistency-audit-context.v1',
    generated_at: new Date().toISOString(),
    artifacts_dir: '.',
    artifact_count: artifacts.length,
    valid: validation.every((entry) => entry.valid),
    artifacts,
    validation,
    degraded_modes: validation
      .filter((entry) => !entry.valid)
      .map((entry) => ({
        code: 'invalid_artifact',
        severity: 'error',
        summary: `Artifact failed validation: ${entry.file}`,
        path: entry.file,
      })),
  };

  return context;
}

function listJsonFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/');
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--artifacts-dir') options.artifactsDir = argv[++index];
    else if (arg === '--output') options.output = argv[++index];
  }
  return options;
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const context = buildAuditContext(options);
    const json = `${JSON.stringify(context, null, 2)}\n`;
    if (options.output) {
      fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
      fs.writeFileSync(path.resolve(options.output), json);
    } else {
      process.stdout.write(json);
    }
    if (!context.valid) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildAuditContext,
};
