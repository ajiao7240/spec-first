'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { extractEngineeringQuality } = require('../../skills/spec-app-consistency-audit/scripts/extract-engineering-quality');

function write(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe('spec-app-consistency-audit engineering quality extraction', () => {
  test('extracts App engineering quality candidates without confirming issues', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-eq-'));
    try {
      write(repoRoot, 'shared/src/commonMain/kotlin/trade/TradeViewModel.kt', [
        'class TradeViewModel {',
        '  fun submitOrder() { repository.submit() }',
        '  fun load() { for (item in items) { api.fetch(item.id) } }',
        '  fun risky() { Log.d("pwd", password) }',
        '  fun ignored() { try { api.fetch() } catch (e: Exception) { } }',
        '}',
      ].join('\n'));

      const artifact = extractEngineeringQuality({ repoRoot, source: repoRoot });
      const types = artifact.candidates.map((entry) => entry.type);

      expect(artifact.schema_version).toBe('engineering-quality-contract.v1');
      expect(types).toEqual(expect.arrayContaining([
        'loop_remote_or_db_call',
        'sensitive_log_candidate',
        'swallowed_exception',
        'submit_without_duplicate_guard_signal',
      ]));
      expect(artifact.candidates.every((entry) => entry.status === 'candidate')).toBe(true);
      expect(artifact.candidates.every((entry) => entry.needs_semantic_review)).toBe(true);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
