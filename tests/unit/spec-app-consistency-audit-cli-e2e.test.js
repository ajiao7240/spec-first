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

function runNodeRaw(args, cwd = REPO_ROOT) {
  return spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
}

function runGit(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Command failed: git ${args.join(' ')}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
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

  test('git commit fixtures avoid POSIX-only /dev/null hooks path', () => {
    const testSource = fs.readFileSync(__filename, 'utf8');

    expect(testSource).toContain("'commit', '--no-verify'");
    expect(testSource).not.toContain('core.hooksPath=' + '/dev/null');
  });

  test('runs the static app-audit artifact chain through subprocess CLIs', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-cli-e2e-'));
    const runId = '20260502-test-run';
    const outputDir = path.join(repoRoot, '.spec-first/app-audit/runs', runId);
    const contractsDir = path.join(outputDir, 'contracts');
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
      const figmaContext = write(repoRoot, `.spec-first/app-audit/runs/${runId}/input/figma-context.json`, JSON.stringify({
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
      const screenPath = write(repoRoot, 'shared/src/commonMain/kotlin/trade/ui/TradeBuyScreen.kt', [
        'class TradeBuyScreen',
        'class TradeBuyViewModel',
        'sealed class TradeBuyUiState',
        'fun routes() { navController.navigate("trade/buy/{symbol}") }',
        'fun render() { PrimaryButton() }',
      ].join('\n'));
      write(repoRoot, 'analytics/src/commonMain/kotlin/Analytics.kt', 'fun track() { trackEvent("trade_submit", "symbol" to symbol) }');
      write(repoRoot, 'app/src/main/res/values/strings.xml', '<resources><string name="trade_submit_button">买入</string></resources>');
      runGit(['init'], repoRoot);
      runGit(['config', 'user.email', 'spec-first@example.test'], repoRoot);
      runGit(['config', 'user.name', 'Spec First Test'], repoRoot);
      runGit(['add', '.'], repoRoot);
      runGit(['commit', '--no-verify', '-m', 'test: initial app audit fixture'], repoRoot);
      fs.appendFileSync(screenPath, '\nfun submitOrder() { showConfirmDialog(); trackEvent("trade_submit") }\n');

      const artifacts = {
        metadata: path.join(outputDir, 'metadata.json'),
        preflight: path.join(outputDir, 'preflight.json'),
        impact: path.join(outputDir, 'impact-facts.json'),
        product: path.join(contractsDir, 'product-contract.json'),
        figma: path.join(contractsDir, 'figma-design-contract.json'),
        code: path.join(contractsDir, 'codebase-contract.json'),
        routes: path.join(contractsDir, 'page-route-contract.json'),
        architecture: path.join(contractsDir, 'kmp-architecture-contract.json'),
        quality: path.join(contractsDir, 'engineering-quality-contract.json'),
        components: path.join(contractsDir, 'component-contract.json'),
        modules: path.join(contractsDir, 'module-contract.json'),
        analytics: path.join(contractsDir, 'analytics-contract.json'),
        i18n: path.join(contractsDir, 'i18n-contract.json'),
        industry: path.join(contractsDir, 'industry-profile.preview.json'),
        rules: path.join(contractsDir, 'industry-rule-pack-selection.json'),
        merged: path.join(outputDir, 'merged-context.json'),
        context: path.join(outputDir, 'app-audit-context.json'),
        issues: path.join(outputDir, 'issues.json'),
        report: path.join(outputDir, 'audit-report.json'),
        manifest: path.join(outputDir, 'artifact-manifest.json'),
        headless: path.join(outputDir, 'headless-envelope.txt'),
      };

      const commands = [
        [script('build-run-metadata.js'), 'mode:headless', `base:${runGit(['rev-parse', 'HEAD'], repoRoot).stdout.trim()}`, `run-id:${runId}`, '--source', repoRoot, '--prd', prd, '--figma-context', figmaContext, '--run-dir', outputDir, '--output', artifacts.metadata],
        [script('preflight.js'), '--source', repoRoot, '--prd', prd, '--figma-context', figmaContext, '--output', artifacts.preflight],
        [script('build-impact-facts.js'), 'mode:headless', `base:${runGit(['rev-parse', 'HEAD'], repoRoot).stdout.trim()}`, '--source', repoRoot, '--prd', prd, '--figma-context', figmaContext, '--output', artifacts.impact],
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

      const fixtureIssue = {
        id: 'APP-AUDIT-E2E-001',
        title: 'Submit interaction requires static review',
        severity: 'medium',
        category: 'interaction',
        claim_family: 'architecture_static',
        claim_type: 'submit_interaction_changed',
        affected_surface: { type: 'screen', id: 'TradeBuyScreen', file: 'shared/src/commonMain/kotlin/trade/ui/TradeBuyScreen.kt' },
        expert: 'engineering-quality-expert',
        confidence: 0.82,
        static_confirmed: true,
        contract_status: 'confirmed',
        data_sensitivity: 'internal',
        requires_runtime_verification: true,
        requires_real_device: false,
        provenance: [{ source: 'code', file: 'shared/src/commonMain/kotlin/trade/ui/TradeBuyScreen.kt', summary: 'Submit interaction changed.' }],
        evidence: { code: [{ source: 'code', file: 'shared/src/commonMain/kotlin/trade/ui/TradeBuyScreen.kt', summary: 'Submit interaction changed.' }] },
        impact: ['Submit interaction behavior may drift.'],
        recommendation: ['Review submit interaction against the App contract.'],
        related_rule_packs: ['common-app'],
        runtime_verification: { required: true, level: 'simulator', reason: 'Verify the submit interaction path.' },
        validation_status: 'not_required',
        review_lifecycle: [{ stage: 'normalize', action: 'accepted', reason_code: 'fixture' }],
      };
      const rawIssues = write(repoRoot, '.spec-first/app-audit-input/engineering-quality-review.json', JSON.stringify({
        issues: [fixtureIssue],
        rejected_issues: [{
          ...fixtureIssue,
          id: 'APP-AUDIT-E2E-REJECTED',
          title: 'Rule-pack only rejected fixture',
          contract_status: 'rejected',
          static_confirmed: false,
          evidence_gate: {
            passed: false,
            reason: 'confirmed_issue_requires_project_specific_evidence',
            project_evidence_count: 0,
            rule_pack_evidence_count: 1,
          },
        }],
      }, null, 2));
      runNode([
        script('merge-contracts.js'),
        '--issues-artifact',
        '--issue', rawIssues,
        'from:code-review',
        `run-id:${runId}`,
        '--output', artifacts.issues,
      ]);
      runNode([
        script('merge-contracts.js'),
        '--source', repoRoot,
        '--run-dir', outputDir,
        `run-id:${runId}`,
        '--artifacts', artifacts.routes,
        '--artifacts', artifacts.quality,
        '--issue', artifacts.issues,
        '--output', artifacts.report,
      ]);
      runNode([script('build-audit-context.js'), '--artifacts-dir', outputDir, '--output', artifacts.context]);
      fs.writeFileSync(path.join(outputDir, 'latest-summary.json'), `${JSON.stringify({
        schema_version: 'spec-app-consistency-audit-latest-summary.v1',
        artifact_id: 'latest-summary',
        run_id: runId,
      }, null, 2)}\n`);
      runNode([script('build-artifact-manifest.js'), '--run-dir', outputDir, `run-id:${runId}`, '--output', artifacts.manifest]);
      runNode([script('render-headless-envelope.js'), '--metadata', artifacts.metadata, '--report', artifacts.report, '--output', artifacts.headless]);

      const validate = runNode([
        script('validate-artifacts.js'),
        ...Object.values(artifacts).filter((filePath) => filePath.endsWith('.json')),
      ]);
      const validation = JSON.parse(validate.stdout);
      const report = JSON.parse(fs.readFileSync(artifacts.report, 'utf8'));
      const routes = JSON.parse(fs.readFileSync(artifacts.routes, 'utf8'));
      const impact = JSON.parse(fs.readFileSync(artifacts.impact, 'utf8'));
      const metadata = JSON.parse(fs.readFileSync(artifacts.metadata, 'utf8'));
      const manifest = JSON.parse(fs.readFileSync(artifacts.manifest, 'utf8'));
      const headless = fs.readFileSync(artifacts.headless, 'utf8');

      expect(validation.valid).toBe(true);
      expect(artifacts.report).toContain('.spec-first/app-audit/runs/20260502-test-run');
      expect(report.writeback_preview.paths).toEqual([
        '.spec-first/app-audit/runs/20260502-test-run/writeback-preview/repo-profile.patch.yaml',
        '.spec-first/app-audit/runs/20260502-test-run/writeback-preview/suggested-standards.md',
      ]);
      expect(impact.changed_files).toContain('shared/src/commonMain/kotlin/trade/ui/TradeBuyScreen.kt');
      expect(metadata.diff_hash).toBe(impact.diff_scope.diff_hash);
      expect(metadata.coverage_capabilities).toEqual(impact.coverage_capabilities);
      expect(metadata.input_expectations).toEqual(impact.input_expectations);
      expect(manifest.artifacts.map((entry) => entry.path)).toEqual(expect.arrayContaining([
        'metadata.json',
        'preflight.json',
        'impact-facts.json',
        'app-audit-context.json',
        'issues.json',
        'audit-report.json',
      ]));
      expect(manifest.artifacts.map((entry) => entry.path)).not.toContain('artifact-manifest.json');
      expect(manifest.artifacts.map((entry) => entry.path)).not.toContain('latest-summary.json');
      expect(manifest.artifacts.map((entry) => entry.path)).not.toContain('input/figma-context.json');
      expect(manifest.artifacts.find((entry) => entry.path === 'metadata.json')).toEqual(expect.objectContaining({
        producer: 'build-run-metadata.js',
        sha256: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        freshness: 'current-worktree',
      }));
      expect(impact.interaction_surface_changed[0]).toEqual(expect.objectContaining({
        type: 'interaction_surface_changed',
        affected_surface: expect.objectContaining({ id: 'TradeBuyScreen' }),
      }));
      expect(headless).toContain('App consistency audit complete (headless mode).');
      expect(headless).toContain('Code-review handoff');
      expect(headless).toContain('Rejected findings:');
      expect(headless).toContain('Runtime verification:');
      expect(report.section_coverage).toEqual(expect.objectContaining({
        page_routes: true,
        engineering_quality: true,
      }));
      expect(routes.coverage_gaps.map((entry) => entry.type)).not.toContain('figma_screen_without_code_route');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('rejects unsafe base refs without writing report-only or injected output files', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-base-injection-'));
    const leakPath = path.join(repoRoot, 'leak.diff');
    try {
      write(repoRoot, 'App.kt', 'class App');
      runGit(['init'], repoRoot);
      runGit(['config', 'user.email', 'spec-first@example.test'], repoRoot);
      runGit(['config', 'user.name', 'Spec First Test'], repoRoot);
      runGit(['add', '.'], repoRoot);
      runGit(['commit', '--no-verify', '-m', 'test: initial'], repoRoot);

      const result = runNodeRaw([
        script('build-impact-facts.js'),
        'mode:headless',
        `base:--output=${leakPath}`,
        '--source',
        repoRoot,
      ]);

      expect(result.status).not.toBe(0);
      expect(result.stdout).toContain('App consistency audit failed (headless mode).');
      expect(result.stdout).toContain('Reason code: scope_base_unresolved');
      expect(result.stdout).toContain('App consistency audit complete');
      expect(fs.existsSync(leakPath)).toBe(false);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('headless missing base returns a failed envelope with terminal signal', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-headless-failure-'));
    try {
      write(repoRoot, 'App.kt', 'class App');
      runGit(['init'], repoRoot);
      runGit(['config', 'user.email', 'spec-first@example.test'], repoRoot);
      runGit(['config', 'user.name', 'Spec First Test'], repoRoot);
      runGit(['add', '.'], repoRoot);
      runGit(['commit', '--no-verify', '-m', 'test: initial'], repoRoot);

      const result = runNodeRaw([
        script('build-impact-facts.js'),
        'mode:headless',
        '--source',
        repoRoot,
      ]);

      expect(result.status).not.toBe(0);
      expect(result.stdout).toContain('Reason code: scope_headless_missing_base');
      expect(result.stdout).toContain('App consistency audit complete');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('run metadata returns headless failed envelope before writing output', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-metadata-headless-base-'));
    const output = path.join(repoRoot, '.spec-first/app-audit/runs/test/metadata.json');
    try {
      write(repoRoot, 'App.kt', 'class App');
      runGit(['init'], repoRoot);
      runGit(['config', 'user.email', 'spec-first@example.test'], repoRoot);
      runGit(['config', 'user.name', 'Spec First Test'], repoRoot);
      runGit(['add', '.'], repoRoot);
      runGit(['commit', '--no-verify', '-m', 'test: initial'], repoRoot);

      const result = runNodeRaw([
        script('build-run-metadata.js'),
        'mode:headless',
        '--source',
        repoRoot,
        '--output',
        output,
      ]);

      expect(result.status).not.toBe(0);
      expect(result.stdout).toContain('Reason code: scope_headless_missing_base');
      expect(result.stdout).toContain('App consistency audit complete');
      expect(fs.existsSync(output)).toBe(false);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('preflight returns headless failed envelope before writing output when base is missing', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-preflight-headless-base-'));
    const output = path.join(repoRoot, '.spec-first/app-audit/runs/test/preflight.json');
    try {
      write(repoRoot, 'App.kt', 'class App');
      runGit(['init'], repoRoot);
      runGit(['config', 'user.email', 'spec-first@example.test'], repoRoot);
      runGit(['config', 'user.name', 'Spec First Test'], repoRoot);
      runGit(['add', '.'], repoRoot);
      runGit(['commit', '--no-verify', '-m', 'test: initial'], repoRoot);

      const result = runNodeRaw([
        script('preflight.js'),
        'mode:headless',
        '--source',
        repoRoot,
        '--output',
        output,
      ]);

      expect(result.status).not.toBe(0);
      expect(result.stdout).toContain('Reason code: scope_headless_missing_base');
      expect(result.stdout).toContain('App consistency audit complete');
      expect(fs.existsSync(output)).toBe(false);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('build-audit-context enforces report-only no-write contract', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-context-report-only-'));
    const output = path.join(repoRoot, '.spec-first/app-audit/runs/test/app-audit-context.json');
    try {
      const result = runNodeRaw([
        script('build-audit-context.js'),
        'mode:report-only',
        '--artifacts-dir',
        repoRoot,
        '--output',
        output,
      ]);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('mode:report-only forbids --output');
      expect(fs.existsSync(output)).toBe(false);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('run metadata and manifest builders enforce report-only no-write contract', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-report-only-writers-'));
    const metadataOutput = path.join(repoRoot, '.spec-first/app-audit/runs/test/metadata.json');
    const manifestOutput = path.join(repoRoot, '.spec-first/app-audit/runs/test/artifact-manifest.json');
    try {
      const metadata = runNodeRaw([
        script('build-run-metadata.js'),
        'mode:report-only',
        '--source',
        repoRoot,
        '--output',
        metadataOutput,
      ]);
      const manifest = runNodeRaw([
        script('build-artifact-manifest.js'),
        'mode:report-only',
        '--run-dir',
        repoRoot,
        '--output',
        manifestOutput,
      ]);

      expect(metadata.status).not.toBe(0);
      expect(metadata.stderr).toContain('mode:report-only forbids --output');
      expect(manifest.status).not.toBe(0);
      expect(manifest.stderr).toContain('mode:report-only forbids --output');
      expect(fs.existsSync(metadataOutput)).toBe(false);
      expect(fs.existsSync(manifestOutput)).toBe(false);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('keeps repo root and source root separate for monorepo app scope', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-monorepo-'));
    const runId = 'monorepo-scope';
    const outputDir = path.join(repoRoot, '.spec-first/app-audit/runs', runId);
    try {
      write(repoRoot, 'apps/mobile/src/HomeScreen.kt', 'class HomeScreen');
      write(repoRoot, 'services/api/order.ts', 'export const order = 1;');
      write(repoRoot, 'docs/prd.md', '# Mobile PRD\n');
      runGit(['init'], repoRoot);
      runGit(['config', 'user.email', 'spec-first@example.test'], repoRoot);
      runGit(['config', 'user.name', 'Spec First Test'], repoRoot);
      runGit(['add', '.'], repoRoot);
      runGit(['commit', '--no-verify', '-m', 'test: initial monorepo fixture'], repoRoot);
      const base = runGit(['rev-parse', 'HEAD'], repoRoot).stdout.trim();
      fs.appendFileSync(path.join(repoRoot, 'apps/mobile/src/HomeScreen.kt'), '\nfun navigate() { navController.navigate("home") }\n');
      fs.appendFileSync(path.join(repoRoot, 'services/api/order.ts'), '\nexport const changed = true;\n');

      const metadataPath = path.join(outputDir, 'metadata.json');
      const impactPath = path.join(outputDir, 'impact-facts.json');
      runNode([
        script('build-run-metadata.js'),
        'mode:headless',
        `base:${base}`,
        `run-id:${runId}`,
        '--repo-root',
        repoRoot,
        'source:apps/mobile',
        'prd:docs/prd.md',
        '--output',
        metadataPath,
      ]);
      runNode([
        script('build-impact-facts.js'),
        'mode:headless',
        `base:${base}`,
        '--repo-root',
        repoRoot,
        'source:apps/mobile',
        '--output',
        impactPath,
      ]);

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      const impact = JSON.parse(fs.readFileSync(impactPath, 'utf8'));

      expect(metadata.source_root).toBe('apps/mobile');
      expect(metadata.source_inputs[0].path).toBe('apps/mobile');
      expect(metadata.run_dir).toBe('.spec-first/app-audit/runs/monorepo-scope');
      expect(metadata.status).toBe('started');
      expect(metadata.completed_at).toBeUndefined();
      expect(fs.existsSync(path.join(repoRoot, 'apps/mobile/.spec-first'))).toBe(false);
      expect(impact.changed_files).toEqual(expect.arrayContaining([
        'apps/mobile/src/HomeScreen.kt',
        'services/api/order.ts',
      ]));
      expect(impact.diff_scope.source_scoped_changed_files).toEqual(['apps/mobile/src/HomeScreen.kt']);
      expect(impact.diff_scope.out_of_source_changed_files).toEqual(['services/api/order.ts']);
      expect(impact.candidate_signals.every((signal) => {
        const file = signal.affected_surface ? signal.affected_surface.file : ((signal.evidence || [])[0] || {}).file;
        return !file || file.startsWith('apps/mobile/');
      })).toBe(true);
      const explicitIndustryImpact = JSON.parse(runNode([
        script('build-impact-facts.js'),
        'mode:headless',
        `base:${base}`,
        '--repo-root',
        repoRoot,
        'source:apps/mobile',
        'industry:securities',
      ]).stdout);
      const explicitIndustrySignal = explicitIndustryImpact.candidate_signals.find((signal) => signal.type === 'industry_term_candidate');
      expect(explicitIndustrySignal).toEqual(expect.objectContaining({
        industry: 'securities',
        advisory_only: true,
      }));
      const confirmedIndustryImpact = JSON.parse(runNode([
        script('build-impact-facts.js'),
        'mode:headless',
        `base:${base}`,
        '--repo-root',
        repoRoot,
        'source:apps/mobile',
        '--confirmed-industry',
        'securities',
      ]).stdout);
      const confirmedIndustrySignal = confirmedIndustryImpact.candidate_signals.find((signal) => signal.type === 'industry_term_candidate');
      expect(confirmedIndustryImpact.coverage_capabilities.industry).toBe('confirmed_profile');
      expect(confirmedIndustrySignal).toEqual(expect.objectContaining({
        industry: 'securities',
        advisory_only: false,
      }));
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('default run metadata ids are unique and do not target a fixed run directory', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-run-id-'));
    try {
      write(repoRoot, 'App.kt', 'class App');
      runGit(['init'], repoRoot);
      runGit(['config', 'user.email', 'spec-first@example.test'], repoRoot);
      runGit(['config', 'user.name', 'Spec First Test'], repoRoot);
      runGit(['add', '.'], repoRoot);
      runGit(['commit', '--no-verify', '-m', 'test: initial'], repoRoot);

      const first = JSON.parse(runNode([
        script('build-run-metadata.js'),
        '--repo-root',
        repoRoot,
      ]).stdout);
      const second = JSON.parse(runNode([
        script('build-run-metadata.js'),
        '--repo-root',
        repoRoot,
      ]).stdout);

      expect(first.run_id).not.toBe('app-audit-run');
      expect(second.run_id).not.toBe('app-audit-run');
      expect(first.run_id).not.toBe(second.run_id);
      expect(first.run_dir).not.toBe(second.run_dir);
      expect(first.run_dir).toMatch(/^\.spec-first\/app-audit\/runs\//);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('build-audit-context resolves relative run dir against repo root regardless of cwd', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-context-cwd-'));
    try {
      write(repoRoot, '.spec-first/app-audit/runs/r1/preflight.json', JSON.stringify({
        schema_version: 'example-artifact.v1',
        artifact_id: 'example',
        generated_at: '2026-05-02T00:00:00.000Z',
        source_inputs: [{ type: 'code', path: '.', source_hash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', freshness: 'current-worktree' }],
        consumers: ['expert-agents'],
        contract_status: 'candidate',
        data_sensitivity: 'internal',
      }));

      const result = runNodeRaw([
        script('build-audit-context.js'),
        '--repo-root',
        repoRoot,
        'run-dir:.spec-first/app-audit/runs/r1',
      ], os.tmpdir());

      expect(result.status).toBe(0);
      const context = JSON.parse(result.stdout);
      expect(context.artifacts_dir).toBe('.spec-first/app-audit/runs/r1');
      expect(context.artifact_count).toBe(1);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('preflight enforces report-only no-write contract', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-preflight-report-only-'));
    const output = path.join(repoRoot, '.spec-first/app-audit/runs/test/preflight.json');
    try {
      write(repoRoot, 'App.kt', 'class App');
      const result = runNodeRaw([
        script('preflight.js'),
        'mode:report-only',
        '--source',
        repoRoot,
        '--output',
        output,
      ]);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('mode:report-only forbids --output');
      expect(fs.existsSync(output)).toBe(false);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
