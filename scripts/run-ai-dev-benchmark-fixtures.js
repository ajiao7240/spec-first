#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { validateAgainstSchema } = require('../src/contracts/schema-validator');
const { resolveWorkflowArtifactDir } = require('../src/verification/artifact-paths');

const BENCHMARK_SUITE_ID = 'ai-dev-benchmark-fixtures';
const BENCHMARK_RESULT_FILE = 'benchmark-fixtures-result.json';
const DEFAULT_FIXTURE_ROOT = path.join(__dirname, '..', 'tests', 'fixtures', 'ai-dev-benchmarks');
const DEFAULT_MANIFEST_SCHEMA_PATH = path.join(
  __dirname,
  '..',
  'docs',
  'contracts',
  'quality-gates',
  'ai-dev-benchmark-fixture.schema.json'
);
const DEFAULT_RESULT_SCHEMA_PATH = path.join(
  __dirname,
  '..',
  'docs',
  'contracts',
  'quality-gates',
  'ai-dev-benchmark-fixtures-result.schema.json'
);
const VALID_SCENARIO_TYPES = new Set([
  'docs-only',
  'cli-bugfix',
  'graph-degraded-fallback',
]);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function relativeArtifactPath(repoRoot, filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

function isSafeRepoRelativePath(value) {
  if (!value || typeof value !== 'string') return false;
  if (value.includes('\\')) return false;
  if (path.isAbsolute(value) || path.win32.isAbsolute(value)) return false;
  const normalized = path.posix.normalize(value);
  if (normalized !== value) return false;
  const segments = value.split('/');
  return segments.every((segment) => segment && segment !== '.' && segment !== '..');
}

function safeFixtureArtifactPaths({ repoRoot, fixtureDir, manifest = null, manifestPath }) {
  const artifactPaths = [relativeArtifactPath(repoRoot, manifestPath)];
  if (manifest && isSafeRepoRelativePath(manifest.prompt_path)) {
    artifactPaths.push(relativeArtifactPath(repoRoot, path.join(fixtureDir, manifest.prompt_path)));
  }
  if (manifest && isSafeRepoRelativePath(manifest.repo_path)) {
    artifactPaths.push(relativeArtifactPath(repoRoot, path.join(fixtureDir, manifest.repo_path)));
  }
  return [...new Set(artifactPaths)];
}

function createFailure({ fixtureId, reasonCode, message, artifactPaths }) {
  return {
    fixture_id: fixtureId,
    reason_code: reasonCode,
    message,
    artifact_paths: artifactPaths,
  };
}

function validateFixture({ repoRoot, fixtureDir, manifestSchema }) {
  const manifestPath = path.join(fixtureDir, 'manifest.json');
  const fallbackFixtureId = path.basename(fixtureDir);
  let manifest = null;
  const failures = [];

  if (!fs.existsSync(manifestPath)) {
    const artifactPaths = [relativeArtifactPath(repoRoot, manifestPath)];
    return {
      fixture: {
        fixture_id: fallbackFixtureId,
        status: 'failed',
        reason_code: 'missing-manifest',
        artifact_paths: artifactPaths,
        advisory: true,
        validation_commands_status: 'declared_only',
        validation_commands: [],
      },
      failures: [
        createFailure({
          fixtureId: fallbackFixtureId,
          reasonCode: 'missing-manifest',
          message: 'Fixture directory is missing manifest.json.',
          artifactPaths,
        }),
      ],
    };
  }

  try {
    manifest = readJson(manifestPath);
  } catch (error) {
    const artifactPaths = [relativeArtifactPath(repoRoot, manifestPath)];
    return {
      fixture: {
        fixture_id: fallbackFixtureId,
        status: 'failed',
        reason_code: 'invalid-manifest',
        artifact_paths: artifactPaths,
        advisory: true,
        validation_commands_status: 'declared_only',
        validation_commands: [],
      },
      failures: [
        createFailure({
          fixtureId: fallbackFixtureId,
          reasonCode: 'invalid-manifest',
          message: `manifest.json is not valid JSON: ${error.message}`,
          artifactPaths,
        }),
      ],
    };
  }

  const fixtureId = typeof manifest.fixture_id === 'string' && manifest.fixture_id
    ? manifest.fixture_id
    : fallbackFixtureId;
  const artifactPaths = safeFixtureArtifactPaths({ repoRoot, fixtureDir, manifest, manifestPath });
  const schemaValidation = validateAgainstSchema(manifestSchema, manifest);

  if (!schemaValidation.valid) {
    failures.push(createFailure({
      fixtureId,
      reasonCode: 'invalid-manifest',
      message: schemaValidation.errors.join('; '),
      artifactPaths,
    }));
  }

  if (fixtureId !== fallbackFixtureId) {
    failures.push(createFailure({
      fixtureId,
      reasonCode: 'fixture-id-mismatch',
      message: `fixture_id must match directory name "${fallbackFixtureId}".`,
      artifactPaths,
    }));
  }

  if (!VALID_SCENARIO_TYPES.has(manifest.scenario_type)) {
    failures.push(createFailure({
      fixtureId,
      reasonCode: 'unknown-scenario-type',
      message: `Unknown scenario_type "${manifest.scenario_type}".`,
      artifactPaths,
    }));
  }

  const pathFields = [
    ['prompt_path', manifest.prompt_path],
    ['repo_path', manifest.repo_path],
    ...Array.isArray(manifest.expected_changed_paths)
      ? manifest.expected_changed_paths.map((value, index) => [`expected_changed_paths[${index}]`, value])
      : [],
    ...Array.isArray(manifest.expected_artifacts)
      ? manifest.expected_artifacts.map((artifact, index) => [`expected_artifacts[${index}].path`, artifact && artifact.path])
      : [],
  ];

  for (const [field, value] of pathFields) {
    if (!isSafeRepoRelativePath(value)) {
      failures.push(createFailure({
        fixtureId,
        reasonCode: 'unsafe-path',
        message: `${field} must be a safe POSIX repo-relative path.`,
        artifactPaths,
      }));
    }
  }

  if (isSafeRepoRelativePath(manifest.prompt_path)) {
    const promptPath = path.join(fixtureDir, manifest.prompt_path);
    if (!fs.existsSync(promptPath) || !fs.statSync(promptPath).isFile()) {
      failures.push(createFailure({
        fixtureId,
        reasonCode: 'missing-prompt',
        message: `${manifest.prompt_path} does not exist or is not a file.`,
        artifactPaths,
      }));
    }
  }

  if (isSafeRepoRelativePath(manifest.repo_path)) {
    const repoPath = path.join(fixtureDir, manifest.repo_path);
    if (!fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
      failures.push(createFailure({
        fixtureId,
        reasonCode: 'missing-repo',
        message: `${manifest.repo_path} does not exist or is not a directory.`,
        artifactPaths,
      }));
    }
  }

  if (!Array.isArray(manifest.expected_artifacts) || manifest.expected_artifacts.length === 0) {
    failures.push(createFailure({
      fixtureId,
      reasonCode: 'missing-artifact-expectation',
      message: 'expected_artifacts must declare at least one artifact.',
      artifactPaths,
    }));
  }

  if (!Array.isArray(manifest.validation_commands) || manifest.validation_commands.length === 0) {
    failures.push(createFailure({
      fixtureId,
      reasonCode: 'missing-validation-command',
      message: 'validation_commands must declare at least one command.',
      artifactPaths,
    }));
  }

  if (
    manifest.scenario_type === 'graph-degraded-fallback'
    && (!manifest.degraded_mode_expectations || typeof manifest.degraded_mode_expectations !== 'object')
  ) {
    failures.push(createFailure({
      fixtureId,
      reasonCode: 'missing-degraded-expectation',
      message: 'graph-degraded-fallback fixtures must declare degraded_mode_expectations.',
      artifactPaths,
    }));
  }

  return {
    fixture: {
      fixture_id: fixtureId,
      status: failures.length === 0 ? 'passed' : 'failed',
      reason_code: failures.length === 0 ? 'fixture-valid' : failures[0].reason_code,
      artifact_paths: artifactPaths,
      advisory: true,
      validation_commands_status: 'declared_only',
      validation_commands: Array.isArray(manifest.validation_commands) ? manifest.validation_commands : [],
    },
    failures,
  };
}

function listFixtureDirs(fixturesRoot) {
  if (!fs.existsSync(fixturesRoot)) return [];
  return fs.readdirSync(fixturesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(fixturesRoot, entry.name))
    .sort();
}

function buildBenchmarkResult({
  repoRoot,
  fixturesRoot = DEFAULT_FIXTURE_ROOT,
  generatedAt = new Date().toISOString(),
  manifestSchemaPath = DEFAULT_MANIFEST_SCHEMA_PATH,
} = {}) {
  const manifestSchema = readJson(manifestSchemaPath);
  const fixtureDirs = listFixtureDirs(fixturesRoot);
  const fixtures = [];
  const failures = [];

  if (fixtureDirs.length === 0) {
    failures.push(createFailure({
      fixtureId: BENCHMARK_SUITE_ID,
      reasonCode: 'missing-fixture-suite',
      message: `No fixture directories found under ${relativeArtifactPath(repoRoot, fixturesRoot)}.`,
      artifactPaths: [relativeArtifactPath(repoRoot, fixturesRoot)],
    }));
  }

  for (const fixtureDir of fixtureDirs) {
    const result = validateFixture({ repoRoot, fixtureDir, manifestSchema });
    fixtures.push(result.fixture);
    failures.push(...result.failures);
  }

  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    suite_id: BENCHMARK_SUITE_ID,
    passed: failures.length === 0,
    advisory: true,
    fixtures,
    failures,
  };
}

function validateBenchmarkResult({ result, resultSchemaPath = DEFAULT_RESULT_SCHEMA_PATH }) {
  const resultSchema = readJson(resultSchemaPath);
  return validateAgainstSchema(resultSchema, result);
}

function runAiDevBenchmarkFixtures({
  repoRoot = process.cwd(),
  fixturesRoot = DEFAULT_FIXTURE_ROOT,
  generatedAt = new Date().toISOString(),
  artifactAnchorRoot = repoRoot,
  manifestSchemaPath = DEFAULT_MANIFEST_SCHEMA_PATH,
  resultSchemaPath = DEFAULT_RESULT_SCHEMA_PATH,
} = {}) {
  const result = buildBenchmarkResult({
    repoRoot,
    fixturesRoot,
    generatedAt,
    manifestSchemaPath,
  });
  const validation = validateBenchmarkResult({ result, resultSchemaPath });
  if (!validation.valid) {
    throw new Error(`benchmark fixture result failed schema validation: ${validation.errors.join('; ')}`);
  }

  const artifactDir = resolveWorkflowArtifactDir(repoRoot, 'quality-gates', BENCHMARK_SUITE_ID, {
    artifactAnchorRoot,
  });
  const resultPath = path.join(artifactDir, BENCHMARK_RESULT_FILE);
  writeJson(resultPath, result);

  return {
    ...result,
    artifact_path: relativeArtifactPath(repoRoot, resultPath),
  };
}

if (require.main === module) {
  const result = runAiDevBenchmarkFixtures({ repoRoot: process.cwd() });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.passed) {
    process.exitCode = 1;
  }
}

module.exports = {
  BENCHMARK_RESULT_FILE,
  BENCHMARK_SUITE_ID,
  DEFAULT_FIXTURE_ROOT,
  buildBenchmarkResult,
  isSafeRepoRelativePath,
  runAiDevBenchmarkFixtures,
  validateBenchmarkResult,
  validateFixture,
};
