'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { extractAnalytics } = require('../../skills/spec-app-consistency-audit/scripts/extract-analytics');

function write(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe('spec-app-consistency-audit analytics extraction', () => {
  test('extracts event candidates and key-path coverage facts', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-analytics-'));
    try {
      write(repoRoot, 'shared/src/commonMain/kotlin/trade/TradeAnalytics.kt', [
        'analytics.track("trade_page_view")',
        'analytics.track("trade_submit", mapOf("symbol" to symbol))',
        'analytics.track("trade_success")',
        'analytics.track("trade_failed", mapOf("failure_reason" to reason))',
        'analytics.track("trade_button_click")',
      ].join('\n'));

      const artifact = extractAnalytics({ repoRoot, source: repoRoot });

      expect(artifact.schema_version).toBe('analytics-contract.v1');
      expect(artifact.events.map((entry) => entry.name)).toEqual(expect.arrayContaining([
        'trade_page_view',
        'trade_submit',
        'trade_success',
        'trade_failed',
        'trade_button_click',
      ]));
      expect(artifact.key_path_coverage).toEqual(expect.objectContaining({
        has_page_view: true,
        has_click: true,
        has_submit: true,
        has_success: true,
        has_failed: true,
      }));
      expect(artifact.events.find((entry) => entry.name === 'trade_failed').has_failure_reason).toBe(true);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
