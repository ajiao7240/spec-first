'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  runChecks,
} = require('../../scripts/check-release-continuity.cjs');
const {
  buildRuntimeCapabilityCatalog,
} = require('../../scripts/generate-runtime-capability-catalog');

const REPO_ROOT = path.join(__dirname, '..', '..');

describe('release continuity guard', () => {
  test('reports deterministic release/source-runtime continuity guards with reason codes', () => {
    const runtimeCatalogPath = path.join(os.tmpdir(), `spec-first-current-runtime-catalog-${process.pid}.md`);
    fs.writeFileSync(runtimeCatalogPath, buildRuntimeCapabilityCatalog(), 'utf8');
    const result = runChecks({ runtimeCatalogPath });
    const guardsById = new Map(result.guards.map((entry) => [entry.guard_id, entry]));

    expect(result.schema_version).toBe('release-continuity-guard/v1');
    expect(result.status).toBe('passed');
    expect(result.blocking_failures).toEqual([]);
    expect(guardsById.get('runtime-capability-catalog-fresh')).toMatchObject({
      result: 'pass',
      reason_code: 'runtime-catalog-current',
      classification: 'blocking',
    });
    expect(guardsById.get('public-workflow-contract-summary-coverage')).toMatchObject({
      result: 'pass',
      reason_code: 'public-workflow-summaries-current',
      classification: 'blocking',
    });
    expect(guardsById.get('package-delivery-surface')).toMatchObject({
      result: 'pass',
      reason_code: 'package-delivery-surface-current',
      classification: 'blocking',
    });
    expect(guardsById.get('package-delivery-surface').checked_sources).toContain('npm pack --dry-run --json');
    expect(guardsById.get('website-sync-release-gate-preserved')).toMatchObject({
      result: 'pass',
      reason_code: 'website-sync-release-gate-preserved',
      classification: 'blocking',
      artifact_path: 'docs/contracts/website-sync-contract.md',
    });
    expect(guardsById.get('readme-source-runtime-boundary-links')).toMatchObject({
      result: 'pass',
      reason_code: 'readme-boundary-links-current',
      classification: 'docs-only-no-impact',
    });
    for (const guard of result.guards) {
      expect(guard.checked_sources.length).toBeGreaterThan(0);
      expect(guard.artifact_path).toEqual(expect.any(String));
      expect(guard.reason_code).toEqual(expect.any(String));
    }
  });

  test('json mode reports a structured blocking failure when runtime catalog is missing', () => {
    const missingCatalogPath = path.join(os.tmpdir(), `spec-first-missing-runtime-catalog-${process.pid}.md`);
    const result = spawnSync(process.execPath, ['scripts/check-release-continuity.cjs', '--json'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        SPEC_FIRST_RUNTIME_CATALOG_PATH: missingCatalogPath,
      },
    });
    const payload = JSON.parse(result.stdout);
    const runtimeGuard = payload.guards.find((entry) => entry.guard_id === 'runtime-capability-catalog-fresh');

    expect(result.status).toBe(1);
    expect(payload.schema_version).toBe('release-continuity-guard/v1');
    expect(payload.status).toBe('failed');
    expect(runtimeGuard).toMatchObject({
      result: 'fail',
      reason_code: 'runtime-catalog-missing',
      classification: 'blocking',
    });
    expect(payload.blocking_failures).toEqual(expect.arrayContaining([
      expect.objectContaining({
        guard_id: 'runtime-capability-catalog-fresh',
        reason_code: 'runtime-catalog-missing',
      }),
    ]));
    expect(payload.guards.map((entry) => entry.guard_id)).toContain('package-delivery-surface');
  });
});
