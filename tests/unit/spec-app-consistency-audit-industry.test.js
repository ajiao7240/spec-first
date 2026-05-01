'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildIndustryProfile } = require('../../skills/spec-app-consistency-audit/scripts/build-industry-profile');

function write(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe('spec-app-consistency-audit industry profile', () => {
  test('builds preview-only industry candidates with evidence and confidence', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-industry-'));
    try {
      write(repoRoot, 'prd.md', '股票买入、卖出、持仓、委托、撤单、风控确认。');
      write(repoRoot, 'shared/src/commonMain/kotlin/trade/TradeOrderUseCase.kt', 'class TradeOrderUseCase');

      const artifact = buildIndustryProfile({ repoRoot, source: repoRoot });
      const securities = artifact.industry_candidates.find((entry) => entry.industry === 'securities');

      expect(artifact.schema_version).toBe('industry-profile.v1');
      expect(artifact.preview_only).toBe(true);
      expect(artifact.requires_human_confirmation).toBe(true);
      expect(securities.confidence).toBeGreaterThan(0);
      expect(securities.evidence.length).toBeGreaterThan(0);
      expect(securities.advisory_only).toBe(true);
      expect(securities.recommended_rule_packs).toContain('securities');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('detects finance-common as preview-only and recommends the finance rule pack', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-finance-'));
    try {
      write(repoRoot, 'prd.md', '账户资产、余额、充值、提现、转账、银行卡和实名 KYC。');
      write(repoRoot, 'shared/src/commonMain/kotlin/account/BalanceUseCase.kt', 'class BalanceUseCase');

      const artifact = buildIndustryProfile({ repoRoot, source: repoRoot });
      const finance = artifact.industry_candidates.find((entry) => entry.industry === 'finance-common');

      expect(finance.confidence).toBeGreaterThan(0);
      expect(finance.advisory_only).toBe(true);
      expect(finance.recommended_rule_packs).toContain('finance-common');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
