'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { validateAgainstSchema } = require('../../src/bootstrap-compiler/schema-loader');
const {
  buildVerifierDispatchPosture,
  buildVerifierHintsFromRegistry,
  buildVerifierRegistry,
} = require('../../src/context-routing/verifier-registry');
const { buildVerificationProfile } = require('../../src/bootstrap-compiler/compile-verification-profile');

const REPO_ROOT = path.join(__dirname, '..', '..');
const REGISTRY_SCHEMA_PATH = path.join(
  REPO_ROOT,
  'docs',
  'contracts',
  'verifiers',
  'verifier-registry.schema.json'
);

describe('verifier registry contracts', () => {
  test('registry sample satisfies schema and keeps browser/xcode capability metadata stable', () => {
    const schema = JSON.parse(fs.readFileSync(REGISTRY_SCHEMA_PATH, 'utf8'));
    const registry = buildVerifierRegistry();

    expect(validateAgainstSchema(schema, registry).errors).toEqual([]);
    expect(registry.verifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          verifier_id: 'test-browser',
          supported_platforms: ['web'],
          prerequisites: ['agent-browser'],
          supported_gate_kinds: ['browser-verification'],
        }),
        expect.objectContaining({
          verifier_id: 'test-xcode',
          supported_platforms: ['mobile-ios'],
          prerequisites: ['XcodeBuildMCP'],
          supported_evidence_types: ['simulator-screenshot', 'simulator-logs'],
        }),
      ])
    );
  });

  test('registry maps platform focus to standalone verifier hints without inventing repo commands', () => {
    expect(buildVerifierHintsFromRegistry({ platforms: ['web'] })).toEqual([
      {
        verifier: 'test-browser',
        platforms: ['web'],
        available: true,
        prerequisites: ['agent-browser'],
        evidence_outputs: ['browser-snapshot', 'console-errors', 'network-observations'],
      },
    ]);

    expect(buildVerifierHintsFromRegistry({ platforms: ['mobile-ios'] })).toEqual([
      {
        verifier: 'test-xcode',
        platforms: ['mobile-ios'],
        available: true,
        prerequisites: ['XcodeBuildMCP'],
        evidence_outputs: ['simulator-screenshot', 'simulator-logs'],
      },
    ]);
  });

  test('verification profile compiler reuses registry-backed verifier hints for detected platforms', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'verifier-registry-web-'));

    try {
      fs.mkdirSync(path.join(repoRoot, 'src', 'app'), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, 'package.json'), JSON.stringify({
        name: 'web-app',
        scripts: {
          'test:unit': 'jest',
        },
        dependencies: {
          react: '^19.0.0',
          '@playwright/test': '^1.52.0',
        },
      }, null, 2));

      const profile = buildVerificationProfile({ repoRoot });

      expect(profile.platforms).toContain('web');
      expect(profile.verifier_hints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            verifier: 'test-browser',
            platforms: ['web'],
            prerequisites: ['agent-browser'],
          }),
          expect.objectContaining({
            verifier: 'repo-test-command',
          }),
        ])
      );
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('work stage dispatch posture maps platform verifiers separately from repo-command gates', () => {
    const posture = buildVerifierDispatchPosture({
      stage: 'work',
      requiredVerifications: ['unit-tests', 'browser-smoke'],
      optionalVerifications: ['browser-evidence'],
      gateCatalog: {
        'unit-tests': { id: 'unit-tests', scope: 'repository', kind: 'automated-test', evidence_type: 'command-output' },
        'browser-smoke': { id: 'browser-smoke', scope: 'web-surface', kind: 'browser-verification', evidence_type: 'browser-snapshot' },
        'browser-evidence': { id: 'browser-evidence', scope: 'web-surface', kind: 'browser-verification', evidence_type: 'browser-evidence' },
      },
      impactedPlatforms: ['web'],
      prerequisiteRuntimeState: {
        'agent-browser': { status: 'ready', available: true, reason: 'test' },
        XcodeBuildMCP: { status: 'unverified', available: null, reason: 'test' },
      },
    });

    expect(posture.handoff_posture).toBe('dispatch-and-manual');
    expect(posture.manual_required_verifications).toEqual(['unit-tests']);
    expect(posture.dispatch_blockers).toEqual([]);
    expect(posture.dispatch_candidates).toEqual([
      expect.objectContaining({
        verifier: 'test-browser',
        posture: 'dispatch-ready',
        target_required_verifications: ['browser-smoke'],
        target_optional_verifications: ['browser-evidence'],
      }),
    ]);
  });

  test('blocked prerequisites surface verifier blockers instead of pretending verification already ran', () => {
    const posture = buildVerifierDispatchPosture({
      stage: 'work',
      requiredVerifications: ['browser-smoke'],
      gateCatalog: {
        'browser-smoke': { id: 'browser-smoke', scope: 'web-surface', kind: 'browser-verification', evidence_type: 'browser-snapshot' },
      },
      impactedPlatforms: ['web'],
      prerequisiteRuntimeState: {
        'agent-browser': { status: 'missing', available: false, reason: 'command-not-found-in-path' },
        XcodeBuildMCP: { status: 'unverified', available: null, reason: 'test' },
      },
    });

    expect(posture.handoff_posture).toBe('blocked');
    expect(posture.dispatch_candidates).toEqual([
      expect.objectContaining({
        verifier: 'test-browser',
        posture: 'blocked',
      }),
    ]);
    expect(posture.dispatch_blockers).toEqual([
      expect.objectContaining({
        verifier: 'test-browser',
        prerequisite: 'agent-browser',
        kind: 'missing-command',
        target_verifications: ['browser-smoke'],
      }),
    ]);
  });
});
