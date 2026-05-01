'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runPreflight } = require('../../skills/spec-app-consistency-audit/scripts/preflight');
const { buildIndustryProfile } = require('../../skills/spec-app-consistency-audit/scripts/build-industry-profile');
const { selectRulePacks } = require('../../skills/spec-app-consistency-audit/scripts/select-rule-packs');

const REPO_ROOT = path.join(__dirname, '..', '..');

function write(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

describe('spec-app-consistency-audit rule pack selection', () => {
  test('selects common packs and keeps preview industry packs advisory-only unless confirmed', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-rules-'));
    try {
      write(repoRoot, 'shared/src/commonMain/kotlin/trade/TradeOrderUseCase.kt', 'class TradeOrderUseCase');
      write(repoRoot, 'shared/src/androidMain/kotlin/Platform.kt', 'actual class Platform');
      write(repoRoot, 'design-system/src/commonMain/kotlin/PrimaryButton.kt', 'class PrimaryButton');
      write(repoRoot, 'analytics/src/commonMain/kotlin/Analytics.kt', 'fun trackEvent() {}');
      write(repoRoot, 'app/src/main/res/values/strings.xml', '<resources><string name="app_name">Demo</string></resources>');
      write(repoRoot, 'prd.md', '股票 买入 卖出 持仓 委托 撤单 风控');

      const preflight = runPreflight({ repoRoot, source: repoRoot, prd: path.join(repoRoot, 'prd.md') });
      const industryProfile = buildIndustryProfile({ repoRoot, source: repoRoot });
      const preflightPath = write(repoRoot, 'preflight.json', JSON.stringify(preflight));
      const industryPath = write(repoRoot, 'industry.json', JSON.stringify(industryProfile));
      const preview = selectRulePacks({ repoRoot, preflight: preflightPath, industryProfile: industryPath });
      const confirmed = selectRulePacks({
        repoRoot,
        preflight: preflightPath,
        industryProfile: industryPath,
        industry: 'securities',
      });

      expect(preview.selected_rule_packs.map((entry) => entry.name)).toEqual(expect.arrayContaining([
        'common-app',
        'kmp-clean-architecture',
        'component-module-reuse',
        'analytics',
        'i18n',
        'securities',
      ]));
      expect(preview.selected_rule_packs.find((entry) => entry.name === 'securities').advisory_only).toBe(true);
      expect(confirmed.selected_rule_packs.find((entry) => entry.name === 'securities').advisory_only).toBe(false);
      expect(preview.confirmed_issue_policy.rule_pack_cannot_be_only_evidence).toBe(true);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('selects finance-common rule pack when explicitly confirmed', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-finance-rules-'));
    try {
      write(repoRoot, 'app/src/main/res/values/strings.xml', '<resources><string name="app_name">Demo</string></resources>');
      const preflight = runPreflight({ repoRoot, source: repoRoot });
      const preflightPath = write(repoRoot, 'preflight.json', JSON.stringify(preflight));

      const selected = selectRulePacks({
        repoRoot,
        preflight: preflightPath,
        confirmedIndustry: 'finance-common',
      });
      const finance = selected.selected_rule_packs.find((entry) => entry.name === 'finance-common');

      expect(finance.path).toBe('skills/spec-app-consistency-audit/rule-packs/industries/finance-common/rules.yaml');
      expect(finance.advisory_only).toBe(false);
      expect(finance.evidence_requirements).toContain('At least one project-specific evidence source is required for a confirmed issue.');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('selects analytics and i18n packs even when signals are missing', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-missing-quality-rules-'));
    try {
      write(repoRoot, 'app/src/main/kotlin/HomeScreen.kt', 'class HomeScreen');
      const preflight = runPreflight({ repoRoot, source: repoRoot });
      const preflightPath = write(repoRoot, 'preflight.json', JSON.stringify(preflight));
      const selected = selectRulePacks({ repoRoot, preflight: preflightPath });
      const analytics = selected.selected_rule_packs.find((entry) => entry.name === 'analytics');
      const i18n = selected.selected_rule_packs.find((entry) => entry.name === 'i18n');

      expect(preflight.has_analytics).toBe(false);
      expect(preflight.has_i18n).toBe(false);
      expect(analytics.activation_reason).toContain('missing');
      expect(i18n.activation_reason).toContain('missing');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('selected rule packs point to real YAML assets with evidence policy', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-rule-assets-'));
    try {
      const preflight = runPreflight({ repoRoot, source: repoRoot });
      const preflightPath = write(repoRoot, 'preflight.json', JSON.stringify(preflight));
      const selected = selectRulePacks({
        repoRoot,
        preflight: preflightPath,
        confirmedIndustry: 'ecommerce',
      });

      for (const entry of selected.selected_rule_packs) {
        const rulePath = path.join(REPO_ROOT, entry.path);
        const text = fs.readFileSync(rulePath, 'utf8');

        expect(fs.existsSync(rulePath)).toBe(true);
        expect(text).toContain(`id: ${entry.name}`);
        expect(text).toContain('project_specific_evidence_required: true');
        expect(text).toContain('rule_pack_cannot_be_only_evidence: true');
        expect(text).toMatch(/rules:\n\s+- id:/);
      }
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('unknown or path-like industry names are degraded instead of selected', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-unknown-rules-'));
    try {
      const selected = selectRulePacks({
        repoRoot,
        confirmedIndustry: '../../outside',
      });

      expect(selected.selected_rule_packs.map((entry) => entry.name)).not.toContain('../../outside');
      expect(selected.degraded_modes).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'unknown_industry_rule_pack' }),
      ]));
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
