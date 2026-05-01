'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_ROOT = path.join(REPO_ROOT, 'skills/spec-app-consistency-audit');

function write(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

function runNode(args, cwd = REPO_ROOT) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Command failed: node ${args.join(' ')}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  return result;
}

function script(name) {
  return path.join(SKILL_ROOT, 'scripts', name);
}

describe('spec-app-consistency-audit CLI e2e', () => {
  test('source assets keep LF frontmatter and executable JS entrypoints', () => {
    const skill = fs.readFileSync(path.join(SKILL_ROOT, 'SKILL.md'));
    const command = fs.readFileSync(path.join(REPO_ROOT, 'templates/claude/commands/spec/app-consistency-audit.md'));

    expect(skill.includes(Buffer.from('\n'))).toBe(true);
    expect(command.includes(Buffer.from('\n'))).toBe(true);
    expect(skill.toString('utf8').startsWith('---\nname: spec-app-consistency-audit\n')).toBe(true);
    expect(command.toString('utf8').startsWith('---\ndescription:')).toBe(true);

    for (const fileName of fs.readdirSync(path.join(SKILL_ROOT, 'scripts')).filter((entry) => entry.endsWith('.js'))) {
      const filePath = path.join(SKILL_ROOT, 'scripts', fileName);
      const firstBytes = fs.readFileSync(filePath, 'utf8').slice(0, 40);

      expect(firstBytes).toContain('#!/usr/bin/env node\n');
      runNode(['--check', filePath]);
    }
  });

  test('runs the static app-audit artifact chain through subprocess CLIs', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-cli-e2e-'));
    const outputDir = path.join(repoRoot, '.spec-first/app-audit');
    try {
      const prd = write(repoRoot, 'prd.md', [
        '# Trade Buy',
        '- 页面: TradeBuyScreen',
        '- 流程: QuoteDetail -> TradeBuyScreen -> OrderResultScreen',
        '- 提交订单前必须展示确认弹窗',
        '- analytics: trade_page_view trade_submit trade_success trade_failed',
        '- i18n: trade_submit_button trade_failed_reason',
        '- 行业术语: 股票 买入 委托 风控',
      ].join('\n'));
      const figmaContext = write(repoRoot, '.spec-first/app-audit/input/figma-context.json', JSON.stringify({
        nodes: [{
          id: '12:34',
          type: 'FRAME',
          name: 'TradeBuyScreen',
          children: [
            { id: '12:35', type: 'TEXT', name: '买入', characters: '买入' },
            { id: '12:36', type: 'COMPONENT', name: 'PrimaryButton Loading Disabled' },
          ],
        }],
      }));
      write(repoRoot, 'settings.gradle.kts', 'include(":app", ":shared", ":analytics")');
      write(repoRoot, 'shared/build.gradle.kts', 'dependencies { implementation(project(":analytics")) }');
      write(repoRoot, 'shared/src/commonMain/kotlin/trade/domain/SubmitTradeOrderUseCase.kt', [
        'class SubmitTradeOrderUseCase',
        'class TradeResult',
      ].join('\n'));
      write(repoRoot, 'shared/src/commonMain/kotlin/trade/ui/TradeBuyScreen.kt', [
        'class TradeBuyScreen',
        'class TradeBuyViewModel',
        'sealed class TradeBuyUiState',
        'fun routes() { navController.navigate("trade/buy/{symbol}") }',
        'fun render() { PrimaryButton() }',
      ].join('\n'));
      write(repoRoot, 'analytics/src/commonMain/kotlin/Analytics.kt', 'fun track() { trackEvent("trade_submit", "symbol" to symbol) }');
      write(repoRoot, 'app/src/main/res/values/strings.xml', '<resources><string name="trade_submit_button">买入</string></resources>');

      const artifacts = {
        preflight: path.join(outputDir, 'preflight.json'),
        product: path.join(outputDir, 'product-contract.json'),
        figma: path.join(outputDir, 'figma-design-contract.json'),
        code: path.join(outputDir, 'codebase-contract.json'),
        routes: path.join(outputDir, 'page-route-contract.json'),
        architecture: path.join(outputDir, 'kmp-architecture-contract.json'),
        quality: path.join(outputDir, 'engineering-quality-contract.json'),
        components: path.join(outputDir, 'component-contract.json'),
        modules: path.join(outputDir, 'module-contract.json'),
        analytics: path.join(outputDir, 'analytics-contract.json'),
        i18n: path.join(outputDir, 'i18n-contract.json'),
        industry: path.join(outputDir, 'industry-profile.json'),
        rules: path.join(outputDir, 'rule-pack-selection.json'),
        merged: path.join(outputDir, 'merged-context.json'),
        issues: path.join(outputDir, 'issues.json'),
        report: path.join(outputDir, 'audit-report.json'),
      };

      const commands = [
        [script('preflight.js'), '--source', repoRoot, '--prd', prd, '--figma-context', figmaContext, '--output', artifacts.preflight],
        [script('extract-prd-contract.js'), '--source', repoRoot, '--prd', prd, '--output', artifacts.product],
        [script('extract-figma-contract.js'), '--source', repoRoot, '--figma-context', figmaContext, '--output', artifacts.figma],
        [script('extract-code-contract.js'), '--source', repoRoot, '--output', artifacts.code],
        [script('extract-page-routes.js'), '--source', repoRoot, '--product-contract', artifacts.product, '--figma-contract', artifacts.figma, '--code-contract', artifacts.code, '--output', artifacts.routes],
        [script('extract-kmp-architecture.js'), '--source', repoRoot, '--output', artifacts.architecture],
        [script('extract-engineering-quality.js'), '--source', repoRoot, '--output', artifacts.quality],
        [script('extract-components.js'), '--source', repoRoot, '--figma-contract', artifacts.figma, '--output', artifacts.components],
        [script('extract-modules.js'), '--source', repoRoot, '--output', artifacts.modules],
        [script('extract-analytics.js'), '--source', repoRoot, '--output', artifacts.analytics],
        [script('extract-i18n.js'), '--source', repoRoot, '--output', artifacts.i18n],
        [script('build-industry-profile.js'), '--source', repoRoot, '--product-contract', artifacts.product, '--figma-contract', artifacts.figma, '--code-contract', artifacts.code, '--analytics-contract', artifacts.analytics, '--i18n-contract', artifacts.i18n, '--output', artifacts.industry],
        [script('select-rule-packs.js'), '--source', repoRoot, '--preflight', artifacts.preflight, '--industry-profile', artifacts.industry, '--output', artifacts.rules],
      ];

      for (const args of commands) runNode(args);

      runNode([
        script('merge-contracts.js'),
        '--artifacts', artifacts.product,
        '--artifacts', artifacts.figma,
        '--artifacts', artifacts.code,
        '--artifacts', artifacts.routes,
        '--artifacts', artifacts.architecture,
        '--artifacts', artifacts.quality,
        '--artifacts', artifacts.components,
        '--artifacts', artifacts.modules,
        '--artifacts', artifacts.analytics,
        '--artifacts', artifacts.i18n,
        '--artifacts', artifacts.industry,
        '--artifacts', artifacts.rules,
        '--output', artifacts.merged,
      ]);

      fs.writeFileSync(artifacts.issues, `${JSON.stringify({ issues: [] }, null, 2)}\n`);
      runNode([
        script('merge-contracts.js'),
        '--artifacts', artifacts.routes,
        '--artifacts', artifacts.quality,
        '--issue', artifacts.issues,
        '--output', artifacts.report,
      ]);

      const validate = runNode([
        script('validate-artifacts.js'),
        ...Object.values(artifacts).filter((filePath) => filePath !== artifacts.issues),
      ]);
      const validation = JSON.parse(validate.stdout);
      const report = JSON.parse(fs.readFileSync(artifacts.report, 'utf8'));
      const routes = JSON.parse(fs.readFileSync(artifacts.routes, 'utf8'));

      expect(validation.valid).toBe(true);
      expect(report.section_coverage).toEqual(expect.objectContaining({
        page_routes: true,
        engineering_quality: true,
      }));
      expect(routes.coverage_gaps.map((entry) => entry.type)).not.toContain('figma_screen_without_code_route');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
