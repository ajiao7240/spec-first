'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { validateAgainstSchema } = require('../../src/contracts/schema-validator');
const {
  SETUP_FACTS_MAX_AGE_MS,
  computeDecisionInputHealth,
  normalizeSetupFacts,
  normalizeSetupFactsFile,
} = require('../../src/cli/helpers/setup-facts');

const repoRoot = path.resolve(__dirname, '../..');
const helperRegistryPath = path.join(repoRoot, 'skills/spec-mcp-setup/helper-tools.json');
const providerToolsPath = path.join(repoRoot, 'skills/spec-mcp-setup/provider-tools.json');
const scanConfiguredDepsPath = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/scan-configured-deps.cjs');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-readiness-'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function providerFixture(overrides = {}) {
  return {
    schema_version: 'provider-readiness.v1',
    provider: 'generic',
    kind: 'generic',
    profile: 'minimal',
    readiness_status: 'not-run',
    lifecycle: {
      installed: false,
      configured: false,
      initialized: false,
      indexed: false,
      server_reachable: false,
      artifact_exists: false,
      query_verified: false,
      fallback_used: true,
    },
    repo_aligned: 'unknown',
    capabilities: [],
    limitations: [],
    source_read_required: true,
    fallback: {
      available: true,
      methods: ['rg', 'direct-source-read'],
      reason_code: 'provider-not-run',
    },
    next_actions: [],
    ...overrides,
  };
}

function toolFactsFixture(overrides = {}) {
  return {
    schema_version: 'tool-facts.v2',
    generated_at: '2026-06-04T00:00:00Z',
    repo_root: '/tmp/project',
    host: 'codex',
    platform: 'darwin',
    profile: 'minimal',
    tools: {
      context7: { status: 'ready' },
    },
    helper_tools: {
      'agent-browser': {
        dependency_status: 'missing',
        required: true,
        baseline_blocking: false,
        result: 'skipped',
        reason_code: 'optional-skipped',
      },
    },
    provider_readiness: [providerFixture()],
    items: [
      {
        id: 'context7',
        kind: 'mcp',
        profile: 'minimal',
        required: true,
        baseline_blocking: true,
        dependency_status: 'ready',
        configured_status: 'ready',
        result: 'ready',
        reason_code: 'ready',
        installed: true,
        missing_dependency_reason: null,
        next_action: '',
      },
    ],
    configured_dependencies: [],
    schema_capabilities: ['items', 'configured_dependencies', 'schema_capabilities', 'tool-existence'],
    ...overrides,
  };
}

describe('dependency readiness baseline contracts', () => {
  test('helper registry schema validates the single helper source', () => {
    const schema = readJson(path.join(repoRoot, 'docs/contracts/helper-tools-registry.schema.json'));
    const registry = readJson(helperRegistryPath);

    expect(validateAgainstSchema(schema, registry).errors).toEqual([]);
    expect(registry.helpers.map((helper) => helper.id)).toEqual([
      'agent-browser',
      'gh',
      'jq',
      'vhs',
      'silicon',
      'ffmpeg',
      'ast-grep',
      'ast-grep-skill',
    ]);
    expect(registry.helpers.find((helper) => helper.id === 'agent-browser')).toMatchObject({
      required: true,
      baseline_blocking: false,
    });
    expect(registry.helpers.every((helper) => helper.safety && helper.platform_required_tools && helper.runner_kind)).toBe(true);

    const invalid = {
      ...registry,
      helpers: [{ ...registry.helpers[0], profiles: ['team'] }],
    };
    expect(validateAgainstSchema(schema, invalid).errors).toContain('root.helpers[0].profiles[0]: value "team" not in enum');
  });

  test('tool facts and provider readiness schemas reject drifted enums', () => {
    const toolFactsSchema = readJson(path.join(repoRoot, 'docs/contracts/tool-facts.schema.json'));
    const providerSchema = readJson(path.join(repoRoot, 'docs/contracts/provider-readiness.schema.json'));
    const providerTools = readJson(providerToolsPath);

    expect(validateAgainstSchema(toolFactsSchema, toolFactsFixture()).errors).toEqual([]);
    expect(validateAgainstSchema(providerSchema, providerFixture({ readiness_status: 'fresh' })).errors).toEqual([]);
    expect(validateAgainstSchema(providerSchema, providerFixture({ readiness_status: 'unavailable' })).errors).toContain(
      'root.readiness_status: value "unavailable" not in enum',
    );
    expect(providerTools.providers).toEqual([]);
    expect(providerTools.generic_provider_readiness.readiness_status_values).toEqual([
      'fresh',
      'stale',
      'degraded',
      'not-run',
      'unknown',
    ]);
  });

  test('normalizer keeps v1 compatible and deterministic', () => {
    const legacyFacts = {
      schema_version: 'tool-facts.v1',
      generated_at: '2026-06-04T00:00:00Z',
      tools: {
        context7: { status: 'ready' },
      },
      helper_tools: {
        'agent-browser': { status: 'missing', required: true, baseline_blocking: false },
      },
    };

    const first = normalizeSetupFacts(legacyFacts, { now: new Date('2026-06-04T00:01:00Z') });
    const second = normalizeSetupFacts(legacyFacts, { now: new Date('2026-06-04T00:01:00Z') });

    expect(second).toEqual(first);
    expect(first.schema_versions.tool_facts).toBe('tool-facts.v1');
    expect(first.items.find((item) => item.id === 'context7')).toMatchObject({
      kind: 'mcp',
      result: 'ready',
      installed: true,
    });
    expect(first.items.find((item) => item.id === 'agent-browser')).toMatchObject({
      profile: 'minimal',
      configured_status: 'not-checked',
      baseline_blocking: false,
      missing_dependency_reason: 'missing_dependency',
    });
  });

  test('normalizer repairs contradictory ready result from stale setup facts', () => {
    const projection = normalizeSetupFacts(toolFactsFixture({
      host: 'claude',
      provider_readiness: [],
      items: [
        {
          id: 'context7',
          kind: 'mcp',
          profile: 'minimal',
          required: true,
          baseline_blocking: true,
          dependency_status: 'ready',
          configured_status: 'action-required',
          result: 'ready',
          reason_code: 'ready',
          installed: true,
          missing_dependency_reason: null,
          next_action: 'configure host',
        },
      ],
    }), { now: new Date('2026-06-04T00:01:00Z') });

    expect(projection.items.find((item) => item.id === 'context7')).toMatchObject({
      configured_status: 'action-required',
      result: 'action-required',
      reason_code: 'host-config-action-required',
    });
    expect(projection.counts.required_action).toBe(1);
  });

  test('normalizer treats registry args drift as degraded, not required action', () => {
    const projection = normalizeSetupFacts(toolFactsFixture({
      provider_readiness: [],
      items: [
        {
          id: 'context7',
          kind: 'mcp',
          profile: 'minimal',
          required: true,
          baseline_blocking: true,
          dependency_status: 'ready',
          configured_status: 'registry-args-drift',
          result: 'degraded',
          reason_code: 'host-config-version-drift',
          installed: true,
          missing_dependency_reason: null,
          next_action: '',
        },
      ],
    }), { now: new Date('2026-06-04T00:01:00Z') });

    expect(projection.items.find((item) => item.id === 'context7')).toMatchObject({
      result: 'degraded',
      reason_code: 'host-config-version-drift',
    });
    expect(projection.counts.required_action).toBe(0);
    expect(projection.counts.degraded).toBe(1);
  });

  test('normalizer reports unreadable, invalid, and unsupported facts distinctly', () => {
    const tmp = makeTempDir();
    try {
      const invalidPath = path.join(tmp, 'invalid.json');
      const unsupportedPath = path.join(tmp, 'unsupported.json');
      fs.writeFileSync(invalidPath, '{', 'utf8');
      writeJson(unsupportedPath, { schema_version: 'tool-facts.v999' });

      expect(normalizeSetupFactsFile(path.join(tmp, 'missing.json')).reason_code).toBe('setup-facts-missing');
      expect(normalizeSetupFactsFile(invalidPath).reason_code).toBe('setup-facts-unreadable');
      expect(normalizeSetupFactsFile(unsupportedPath).reason_code).toBe('setup-facts-schema-unsupported');
      expect(normalizeSetupFacts(null).reason_code).toBe('setup-facts-invalid');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('doctor decision input health is computed from setup facts', () => {
    const tmp = makeTempDir();
    try {
      const factsPath = path.join(tmp, '.spec-first/config/tool-facts.json');
      const now = new Date('2026-06-04T00:00:00Z');

      expect(computeDecisionInputHealth({ projectRoot: tmp, platforms: [] })).toMatchObject({
        status: 'not_checked',
        basis: { reason_code: 'no-host-selected' },
      });
      expect(computeDecisionInputHealth({ projectRoot: tmp, platforms: ['codex'] })).toMatchObject({
        status: 'missing',
        basis: { reason_code: 'setup-facts-missing' },
      });

      writeJson(factsPath, toolFactsFixture({
        host: 'claude',
        generated_at: '2026-06-04T00:00:00Z',
        provider_readiness: [],
      }));
      expect(computeDecisionInputHealth({ projectRoot: tmp, platforms: ['codex'], now })).toMatchObject({
        status: 'missing',
        basis: {
          reason_code: 'setup-facts-host-mismatch',
          facts_host: 'claude',
          requested_platforms: ['codex'],
        },
      });

      fs.mkdirSync(path.dirname(factsPath), { recursive: true });
      fs.writeFileSync(factsPath, '{', 'utf8');
      expect(computeDecisionInputHealth({ projectRoot: tmp, platforms: ['codex'], now })).toMatchObject({
        status: 'error',
        basis: { reason_code: 'setup-facts-invalid' },
      });

      writeJson(factsPath, toolFactsFixture({
        generated_at: '2026-05-01T00:00:00Z',
        provider_readiness: [],
      }));
      expect(computeDecisionInputHealth({ projectRoot: tmp, platforms: ['codex'], now })).toMatchObject({
        status: 'stale',
        basis: { reason_code: 'setup-facts-stale' },
      });

      writeJson(factsPath, toolFactsFixture({
        generated_at: '2026-06-04T00:00:00Z',
        provider_readiness: [],
        items: [
          {
            id: 'context7',
            kind: 'mcp',
            profile: 'minimal',
            required: true,
            baseline_blocking: true,
            dependency_status: 'missing',
            configured_status: 'missing',
            result: 'action-required',
            reason_code: 'missing_dependency',
            installed: false,
            missing_dependency_reason: 'missing_dependency',
            next_action: 'install context7',
          },
        ],
      }));
      expect(computeDecisionInputHealth({ projectRoot: tmp, platforms: ['codex'], now })).toMatchObject({
        status: 'error',
        basis: { reason_code: 'required-runtime-action-required' },
      });

      writeJson(factsPath, toolFactsFixture({
        generated_at: '2026-06-04T00:00:00Z',
        provider_readiness: [providerFixture({ readiness_status: 'stale' })],
      }));
      expect(computeDecisionInputHealth({ projectRoot: tmp, platforms: ['codex'], now })).toMatchObject({
        status: 'warn',
        basis: { reason_code: 'optional-capability-degraded' },
      });

      writeJson(factsPath, toolFactsFixture({
        generated_at: '2026-06-04T00:00:00Z',
        provider_readiness: [],
      }));
      const ready = computeDecisionInputHealth({ projectRoot: tmp, platforms: ['codex'], now });
      expect(ready).toMatchObject({
        status: 'pass',
        basis: { reason_code: 'setup-facts-ready' },
      });
      expect(ready.basis.artifact_refs).toEqual([factsPath]);
      expect(ready.basis.freshness.max_age_ms).toBe(SETUP_FACTS_MAX_AGE_MS);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('configured dependency scanner covers hooks, allowlist, setup scripts, mcp facts, and verification commands', () => {
    const tmp = makeTempDir();
    try {
      writeJson(path.join(tmp, 'package.json'), {
        scripts: {
          setup: 'definitely-missing-setup-tool --init',
          test: 'node test.js',
        },
      });
      writeJson(path.join(tmp, '.claude/settings.json'), {
        mcpServers: {
          local: { command: 'node', args: ['server.js'] },
        },
        permissions: {
          allow: ['Bash(definitely-missing-allow-tool check *)', 'Read(*)'],
        },
        hooks: {
          SessionStart: [
            {
              matcher: 'startup',
              hooks: [
                { type: 'command', command: 'node .claude/hooks/session-start' },
              ],
            },
          ],
        },
      });
      writeJson(path.join(tmp, 'spec-first.verification.json'), {
        checks: [
          { id: 'lint', command: 'definitely-missing-verifier --strict' },
        ],
      });
      const factsPath = path.join(tmp, 'facts.json');
      writeJson(factsPath, {
        tools: {
          context7: { status: 'ready', host_config_status: 'ready' },
          'sequential-thinking': { dependency_status: 'ready', host_config_status: 'registry-args-drift' },
        },
      });

      const result = spawnSync('node', [scanConfiguredDepsPath, '--repo-root', tmp, '--facts-file', factsPath], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      const payload = JSON.parse(result.stdout);
      const byKind = new Map(payload.configured_dependencies.map((entry) => [entry.kind, entry]));
      expect(payload.configured_dependencies.find((entry) => entry.id === 'mcp-config:context7')).toMatchObject({
        command: 'context7',
        result: 'ready',
      });
      expect(payload.configured_dependencies.find((entry) => entry.id === 'mcp-config:sequential-thinking')).toMatchObject({
        configured_status: 'registry-args-drift',
        result: 'degraded',
        reason_code: 'host-config-version-drift',
      });
      expect(payload.configured_dependencies.find((entry) => entry.id === 'mcp-config:local')).toMatchObject({
        kind: 'mcp-config',
        command: 'node',
        declared_status: 'declared',
      });
      expect(byKind.get('hook')).toMatchObject({ command: 'node', declared_status: 'declared' });
      expect(byKind.get('permission-allowlist')).toMatchObject({
        command: 'definitely-missing-allow-tool',
        result: 'action-required',
        reason_code: 'configured-dependency-undeclared',
      });
      expect(byKind.get('setup-script')).toMatchObject({
        command: 'definitely-missing-setup-tool',
        result: 'action-required',
        reason_code: 'configured-dependency-undeclared',
      });
      expect(byKind.get('verification-command')).toMatchObject({
        command: 'definitely-missing-verifier',
        result: 'action-required',
        reason_code: 'configured-dependency-undeclared',
      });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
