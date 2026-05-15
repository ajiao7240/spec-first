'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DIMENSIONS_REGISTRY_PATH = path.join(__dirname, 'app-audit-fixture-dimensions.json');

function loadDimensionsRegistry() {
  return JSON.parse(fs.readFileSync(DIMENSIONS_REGISTRY_PATH, 'utf8'));
}

function write(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

function runGit(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Command failed: git ${args.join(' ')}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  return result;
}

function defaultFixturePlan() {
  return {
    prd: 'minimal',
    figma_context: 'local_materialized',
    page_routes: 'multi_language',
    kmp_shared_module: 'present',
    analytics_events: 'missing_required_events',
    i18n_resources: 'present',
  };
}

function applyDimensionCases(repoRoot, plan, runId) {
  const coverage = [];
  const paths = {};

  if (plan.prd === 'minimal') {
    paths.prd = write(repoRoot, 'prd.md', [
      '# Trade Buy',
      '- 页面: TradeBuyScreen',
      '- 流程: QuoteDetail -> TradeBuyScreen -> OrderResultScreen',
      '- 提交订单前必须展示确认弹窗',
      '- analytics: trade_page_view trade_submit trade_success trade_failed',
      '- i18n: trade_submit_button trade_failed_reason',
      '- 行业术语: 股票 买入 委托 风控',
    ].join('\n'));
    coverage.push({ dimension: 'prd', case: 'minimal' });
  } else if (plan.prd === 'missing') {
    coverage.push({ dimension: 'prd', case: 'missing' });
  } else if (plan.prd) {
    throw new Error(`Unsupported prd case: ${plan.prd}`);
  }

  if (plan.figma_context === 'local_materialized') {
    paths.figmaContext = write(
      repoRoot,
      `.spec-first/app-audit/runs/${runId}/input/figma-context.json`,
      JSON.stringify({
        nodes: [{
          id: '12:34',
          type: 'FRAME',
          name: 'TradeBuyScreen',
          children: [
            { id: '12:35', type: 'TEXT', name: '买入', characters: '买入' },
            { id: '12:36', type: 'COMPONENT', name: 'PrimaryButton Loading Disabled' },
          ],
        }],
      }),
    );
    coverage.push({ dimension: 'figma_context', case: 'local_materialized' });
  } else if (plan.figma_context === 'missing') {
    coverage.push({ dimension: 'figma_context', case: 'missing' });
  } else if (plan.figma_context) {
    throw new Error(`Unsupported figma_context case: ${plan.figma_context}`);
  }

  if (plan.kmp_shared_module === 'present') {
    write(repoRoot, 'settings.gradle.kts', 'include(":app", ":shared", ":analytics")');
    write(repoRoot, 'shared/build.gradle.kts', 'dependencies { implementation(project(":analytics")) }');
    write(repoRoot, 'shared/src/commonMain/kotlin/trade/domain/SubmitTradeOrderUseCase.kt', [
      'class SubmitTradeOrderUseCase',
      'class TradeResult',
    ].join('\n'));
    paths.screen = write(repoRoot, 'shared/src/commonMain/kotlin/trade/ui/TradeBuyScreen.kt', [
      'class TradeBuyScreen',
      'class TradeBuyViewModel',
      'sealed class TradeBuyUiState',
      'fun routes() { navController.navigate("trade/buy/{symbol}") }',
      'fun render() { PrimaryButton() }',
    ].join('\n'));
    coverage.push({ dimension: 'kmp_shared_module', case: 'present' });
    if (plan.page_routes === 'multi_language') {
      coverage.push({ dimension: 'page_routes', case: 'multi_language' });
    }
  } else if (plan.kmp_shared_module === 'absent') {
    paths.screen = write(repoRoot, 'app/src/main/kotlin/trade/ui/TradeBuyScreen.kt', [
      'class TradeBuyScreen',
      'fun routes() { navController.navigate("trade/buy/{symbol}") }',
    ].join('\n'));
    coverage.push({ dimension: 'kmp_shared_module', case: 'absent' });
    if (plan.page_routes === 'multi_language') {
      coverage.push({ dimension: 'page_routes', case: 'multi_language' });
    }
  } else if (plan.kmp_shared_module) {
    throw new Error(`Unsupported kmp_shared_module case: ${plan.kmp_shared_module}`);
  }

  if (plan.analytics_events === 'missing_required_events') {
    write(repoRoot, 'analytics/src/commonMain/kotlin/Analytics.kt', 'fun track() { trackEvent("trade_submit", "symbol" to symbol) }');
    coverage.push({ dimension: 'analytics_events', case: 'missing_required_events' });
  } else if (plan.analytics_events === 'empty') {
    coverage.push({ dimension: 'analytics_events', case: 'empty' });
  } else if (plan.analytics_events) {
    throw new Error(`Unsupported analytics_events case: ${plan.analytics_events}`);
  }

  if (plan.i18n_resources === 'present') {
    write(repoRoot, 'app/src/main/res/values/strings.xml', '<resources><string name="trade_submit_button">买入</string></resources>');
  } else if (plan.i18n_resources === 'missing') {
    coverage.push({ dimension: 'i18n_resources', case: 'missing' });
  } else if (plan.i18n_resources) {
    throw new Error(`Unsupported i18n_resources case: ${plan.i18n_resources}`);
  }

  return { coverage, paths };
}

function createAppAuditFixture(repoRoot, options = {}) {
  const runId = options.runId || '20260502-test-run';
  const plan = options.dimensions || defaultFixturePlan();
  const { coverage, paths } = applyDimensionCases(repoRoot, plan, runId);
  const outputDir = path.join(repoRoot, '.spec-first/app-audit/runs', runId);

  runGit(['init'], repoRoot);
  runGit(['config', 'user.email', 'spec-first@example.test'], repoRoot);
  runGit(['config', 'user.name', 'Spec First Test'], repoRoot);
  runGit(['add', '.'], repoRoot);
  runGit(['commit', '--no-verify', '-m', 'test: initial app audit fixture'], repoRoot);

  if (options.modifyAfterCommit !== false && paths.screen) {
    fs.appendFileSync(paths.screen, '\nfun submitOrder() { showConfirmDialog(); trackEvent("trade_submit") }\n');
  }

  return {
    runId,
    outputDir,
    plan,
    paths,
    coverage,
    repoRoot,
  };
}

function auditFixtureCoverage(coverage, options = {}) {
  const registry = loadDimensionsRegistry();
  const knownGaps = new Set(options.knownGaps || []);
  const coveredKeys = new Set();
  for (const entry of coverage || []) {
    if (entry && entry.dimension && entry.case) {
      coveredKeys.add(`${entry.dimension}:${entry.case}`);
    }
  }
  const missing = [];
  const recordedGaps = [];
  for (const dimension of registry.dimensions) {
    for (const requiredCase of dimension.required_cases || []) {
      const key = `${dimension.id}:${requiredCase}`;
      if (coveredKeys.has(key)) continue;
      if (knownGaps.has(key)) {
        recordedGaps.push(key);
        continue;
      }
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      'Fixture coverage audit failed; declare a known_gap or extend fixture coverage:\n  - '
      + missing.join('\n  - '),
    );
  }
  return {
    covered: [...coveredKeys],
    known_gaps: recordedGaps,
  };
}

module.exports = {
  DIMENSIONS_REGISTRY_PATH,
  applyDimensionCases,
  auditFixtureCoverage,
  createAppAuditFixture,
  defaultFixturePlan,
  loadDimensionsRegistry,
  runGit,
  write,
};
