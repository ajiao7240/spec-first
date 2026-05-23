'use strict';

const {
  runChecks,
} = require('../../scripts/check-release-continuity.cjs');

describe('release continuity guard', () => {
  test('reports deterministic release/source-runtime continuity guards with reason codes', () => {
    const result = runChecks();
    const guardsById = new Map(result.guards.map((entry) => [entry.guard_id, entry]));

    expect(result.schema_version).toBe('release-continuity-guard/v1');
    expect(result.status).toBe('passed');
    expect(result.blocking_failures).toEqual([]);
    expect(guardsById.get('runtime-capability-catalog-fresh')).toMatchObject({
      result: 'pass',
      reason_code: 'runtime-catalog-current',
      classification: 'blocking',
      artifact_path: 'docs/catalog/runtime-capabilities.md',
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
});
