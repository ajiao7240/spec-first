'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { extractI18n } = require('../../skills/spec-app-consistency-audit/scripts/extract-i18n');

function write(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe('spec-app-consistency-audit i18n extraction', () => {
  test('extracts string resources, placeholders, plurals, and hardcoded text candidates', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-i18n-'));
    try {
      write(repoRoot, 'app/src/main/res/values/strings.xml', [
        '<resources>',
        '<string name="trade_failed_reason">失败原因：%1$s</string>',
        '<plurals name="order_count"><item quantity="one">%d order</item><item quantity="other">%d orders</item></plurals>',
        '</resources>',
      ].join('\n'));
      write(repoRoot, 'ios/Localizable.strings', '"trade_submit_button" = "Submit";');
      write(repoRoot, 'shared/src/commonMain/kotlin/trade/TradeScreen.kt', 'Text("提交订单失败，请重试")');

      const artifact = extractI18n({ repoRoot, source: repoRoot });

      expect(artifact.schema_version).toBe('i18n-contract.v1');
      expect(artifact.string_resources.map((entry) => entry.key)).toEqual(expect.arrayContaining([
        'trade_failed_reason',
        'order_count',
        'trade_submit_button',
      ]));
      expect(artifact.placeholder_candidates.map((entry) => entry.key)).toContain('trade_failed_reason');
      expect(artifact.plural_resources.map((entry) => entry.key)).toContain('order_count');
      expect(artifact.hardcoded_text_candidates[0]).toEqual(expect.objectContaining({
        text: '提交订单失败，请重试',
        status: 'candidate',
      }));
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
