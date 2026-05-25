'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { extractCodeContract } = require('../../skills/spec-app-consistency-audit/scripts/extract-code-contract');
const { extractFigmaContract } = require('../../skills/spec-app-consistency-audit/scripts/extract-figma-contract');
const { extractPageRoutes } = require('../../skills/spec-app-consistency-audit/scripts/extract-page-routes');
const { extractPrdContract } = require('../../skills/spec-app-consistency-audit/scripts/extract-prd-contract');
const { listSourceTextFiles } = require('../../skills/spec-app-consistency-audit/scripts/lib/audit-utils');

function write(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

function makeRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-contract-'));
  const prd = write(repoRoot, 'prd.md', [
    '# Trade Buy',
    '- 页面: TradeBuyScreen',
    '- 流程: QuoteDetail -> TradeBuyScreen -> TradeConfirmDialog -> OrderResultScreen',
    '- 提交订单前必须展示确认弹窗',
    '- analytics: trade_page_view trade_submit trade_success trade_failed',
    '- i18n: trade_confirm_title trade_submit_button trade_failed_reason',
    '- 行业术语: 股票 买入 委托 风控',
  ].join('\n'));
  const figmaContext = write(repoRoot, 'figma-context.json', JSON.stringify({
    nodes: [
      {
        id: '12:34',
        type: 'FRAME',
        name: 'TradeBuyScreen',
        children: [
          { id: '12:35', type: 'TEXT', name: '买入', characters: '买入' },
          { id: '12:36', type: 'COMPONENT', name: 'PrimaryButton Loading Disabled' },
          { id: '12:37', type: 'INSTANCE', name: 'SubmitBuyButton' },
        ],
      },
    ],
  }));
  write(repoRoot, 'shared/src/commonMain/kotlin/trade/TradeBuyScreen.kt', [
    'class TradeBuyScreen',
    'class TradeBuyViewModel',
    'sealed class TradeBuyUiState',
    'sealed class TradeBuyUiEvent',
    'class SubmitTradeOrderUseCase',
    'interface TradeRepository',
    'fun routes() { navController.navigate("trade/buy/{symbol}") }',
    'fun render() { PrimaryButton() }',
  ].join('\n'));
  return { repoRoot, prd, figmaContext };
}

describe('spec-app-consistency-audit contract extraction', () => {
  test('extracts PRD, Figma, code, and page route candidate contracts separately', () => {
    const fixture = makeRepo();
    try {
      const product = extractPrdContract({ repoRoot: fixture.repoRoot, prd: fixture.prd });
      const figma = extractFigmaContract({ repoRoot: fixture.repoRoot, figmaContext: fixture.figmaContext });
      const code = extractCodeContract({ repoRoot: fixture.repoRoot, source: fixture.repoRoot });
      const routes = extractPageRoutes({
        repoRoot: fixture.repoRoot,
        prd: fixture.prd,
        figmaContext: fixture.figmaContext,
        source: fixture.repoRoot,
      });

      expect(product.schema_version).toBe('product-contract.v1');
      expect(product.pages.map((page) => page.name)).toContain('TradeBuyScreen');
      expect(product.features[0].business_rules[0].contract_status).toBeUndefined();
      expect(product.features[0].business_rules[0].status).toBe('candidate');
      expect(product.features[0].analytics_requirements.map((entry) => entry.name)).toContain('trade_failed');

      expect(figma.schema_version).toBe('figma-design-contract.v1');
      expect(figma.screens[0]).toEqual(expect.objectContaining({
        node_id: '12:34',
        name: 'TradeBuyScreen',
        raw_label: 'TradeBuyScreen',
        raw_label_omitted: false,
        redaction_level: 'internal',
        status: 'candidate',
      }));
      expect(figma.screens[0].components[0]).toEqual(expect.objectContaining({
        label_hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        name: 'PrimaryButton Loading Disabled',
        raw_label_omitted: false,
      }));
      expect(figma.screens[0].texts[0]).toEqual(expect.objectContaining({
        node_id: '12:35',
        text: '买入',
        text_hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        character_count: 2,
        raw_text_omitted: false,
      }));
      expect(JSON.stringify(figma)).toContain('TradeBuyScreen');
      expect(JSON.stringify(figma)).toContain('买入');
      expect(JSON.stringify(figma)).toContain('PrimaryButton Loading Disabled');
      expect(figma.raw_label_policy).toBe('internal');

      expect(code.schema_version).toBe('codebase-contract.v1');
      expect(code.screens[0]).toEqual(expect.objectContaining({
        name: 'TradeBuyScreen',
        view_model: 'TradeBuyViewModel',
        ui_state: 'TradeBuyUiState',
      }));
      expect(code.routes[0]).toEqual(expect.objectContaining({
        path: 'trade/buy/{symbol}',
        required_params: ['symbol'],
        status: 'candidate',
      }));

      expect(routes.schema_version).toBe('page-route-contract.v1');
      expect(routes.coverage_gaps.map((entry) => entry.type)).not.toContain('figma_screen_without_code_route');
      expect(routes.routes.find((route) => route.trace.code_screen === 'TradeBuyScreen').trace).toEqual(expect.objectContaining({
        code_route: 'trade/buy/{symbol}',
        code_screen: 'TradeBuyScreen',
        figma_screen: 'TradeBuyScreen',
      }));
      expect(routes.routes.every((route) => route.status === 'candidate')).toBe(true);
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  test('strict Figma redaction keeps hashes but omits raw labels and text', () => {
    const fixture = makeRepo();
    try {
      const figma = extractFigmaContract({
        repoRoot: fixture.repoRoot,
        figmaContext: fixture.figmaContext,
        redaction: 'strict',
      });

      expect(figma.raw_label_policy).toBe('strict');
      expect(figma.screens[0]).not.toHaveProperty('name');
      expect(figma.screens[0]).not.toHaveProperty('raw_label');
      expect(figma.screens[0].raw_label_omitted).toBe(true);
      expect(figma.screens[0].texts[0]).not.toHaveProperty('text');
      expect(figma.screens[0].texts[0].raw_text_omitted).toBe(true);
      expect(JSON.stringify(figma)).not.toContain('TradeBuyScreen');
      expect(JSON.stringify(figma)).not.toContain('买入');
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  test('internal Figma redaction omits URL and credential-like raw labels and text', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-figma-redaction-'));
    try {
      const figmaContext = write(repoRoot, 'figma-context.json', JSON.stringify({
        nodes: [{
          id: '99:1',
          type: 'FRAME',
          name: 'https://internal.example.test/design',
          children: [
            { id: '99:2', type: 'TEXT', name: 'Token label', characters: 'Authorization: Bearer abc.def.ghi' },
            { id: '99:3', type: 'COMPONENT', name: 'PrimaryButton Cookie: session=secret' },
          ],
        }],
      }));

      const figma = extractFigmaContract({ repoRoot, figmaContext });
      const serialized = JSON.stringify(figma);

      expect(figma.screens[0].raw_label_omitted).toBe(true);
      expect(figma.screens[0]).not.toHaveProperty('raw_label');
      expect(figma.screens[0].texts[0].raw_text_omitted).toBe(true);
      expect(figma.screens[0].texts[0]).not.toHaveProperty('text');
      expect(figma.screens[0].components[0].raw_label_omitted).toBe(true);
      expect(serialized).not.toContain('https://internal.example.test');
      expect(serialized).not.toContain('Authorization: Bearer');
      expect(serialized).not.toContain('Cookie: session');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('code source hash changes when file content changes without path changes', () => {
    const fixture = makeRepo();
    const sourceFile = path.join(fixture.repoRoot, 'shared/src/commonMain/kotlin/trade/TradeBuyScreen.kt');
    try {
      const before = extractCodeContract({ repoRoot: fixture.repoRoot, source: fixture.repoRoot });
      fs.writeFileSync(sourceFile, [
        'class TradeBuyScreen',
        'class TradeBuyViewModel',
        'class NewTradeRepository',
      ].join('\n'));
      const after = extractCodeContract({ repoRoot: fixture.repoRoot, source: fixture.repoRoot });

      expect(after.source_inputs[0].source_hash).not.toBe(before.source_inputs[0].source_hash);
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  test('source scan truncation does not claim full current-worktree hash freshness', () => {
    const fixture = makeRepo();
    try {
      const artifact = extractCodeContract({
        repoRoot: fixture.repoRoot,
        source: fixture.repoRoot,
        maxFiles: 1,
      });

      expect(artifact.source_inputs[0]).toEqual(expect.objectContaining({
        source_hash_unavailable_reason: 'file_scan_truncated',
        freshness: 'partial-worktree',
      }));
      expect(artifact.degraded_modes).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'source_scan_truncated' }),
      ]));
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  test('code contract reports partial semantic extraction when source reads are truncated', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-partial-read-'));
    try {
      write(repoRoot, 'src/LargeScreen.kt', `${'// filler\n'.repeat(15000)}\nclass LateScreen\n`);

      const artifact = extractCodeContract({ repoRoot, source: repoRoot });

      expect(artifact.source_inputs[0].freshness).toBe('current-worktree');
      expect(artifact.screens.map((screen) => screen.name)).not.toContain('LateScreen');
      expect(artifact.degraded_modes).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: 'semantic_extraction_partial',
          path: 'src/LargeScreen.kt',
        }),
      ]));
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('source scan excludes spec-first runtime/control-plane directories', () => {
    const fixture = makeRepo();
    try {
      write(fixture.repoRoot, '.spec-first/app-audit/runs/run/GhostScreen.kt', 'class GhostScreen');
      write(fixture.repoRoot, '.claude/agents/GhostAgent.kt', 'class GhostAgent');
      write(fixture.repoRoot, '.gitnexus/index/GhostIndex.kt', 'class GhostIndex');

      const artifact = extractCodeContract({ repoRoot: fixture.repoRoot, source: fixture.repoRoot });
      const serialized = JSON.stringify(artifact);

      expect(serialized).not.toContain('GhostScreen');
      expect(serialized).not.toContain('GhostAgent');
      expect(serialized).not.toContain('GhostIndex');
      expect(artifact.screens.map((screen) => screen.name)).toContain('TradeBuyScreen');
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  test('bounded source scan has stable ordering and rejects invalid maxFiles', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-scan-order-'));
    try {
      write(repoRoot, 'z/ZScreen.kt', 'class ZScreen');
      write(repoRoot, 'a/AScreen.kt', 'class AScreen');

      const first = listSourceTextFiles({ repoRoot, source: repoRoot, maxFiles: 1 });
      const second = listSourceTextFiles({ repoRoot, source: repoRoot, maxFiles: 1 });
      const repoRealRoot = fs.realpathSync(repoRoot);

      expect(first.files.map((filePath) => path.relative(repoRealRoot, filePath))).toEqual(['a/AScreen.kt']);
      expect(second.files.map((filePath) => path.relative(repoRealRoot, filePath))).toEqual(['a/AScreen.kt']);
      expect(() => listSourceTextFiles({ repoRoot, source: repoRoot, maxFiles: -1 })).toThrow('maxFiles must be a positive integer');
      expect(() => listSourceTextFiles({ repoRoot, source: repoRoot, maxFiles: 0 })).toThrow('maxFiles must be a positive integer');
      expect(() => listSourceTextFiles({ repoRoot, source: repoRoot, maxFiles: Number.NaN })).toThrow('maxFiles must be a positive integer');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('Figma context must stay inside repo unless explicitly allowlisted', () => {
    const fixture = makeRepo();
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-figma-outside-'));
    try {
      const outsideContext = path.join(outside, 'figma-context.json');
      fs.writeFileSync(outsideContext, JSON.stringify({ nodes: [] }));

      expect(() => extractFigmaContract({
        repoRoot: fixture.repoRoot,
        figmaContext: outsideContext,
      })).toThrow(/outside repo root|allowlisted/);

      const artifact = extractFigmaContract({
        repoRoot: fixture.repoRoot,
        figmaContext: outsideContext,
        allowOutside: [outside],
      });
      expect(artifact.schema_version).toBe('figma-design-contract.v1');
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  test('PRD and source extractors enforce repo boundary unless explicitly allowlisted', () => {
    const fixture = makeRepo();
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-source-outside-'));
    try {
      const outsidePrd = path.join(outside, 'outside-prd.md');
      const outsideSource = path.join(outside, 'src');
      fs.mkdirSync(outsideSource);
      fs.writeFileSync(outsidePrd, '# Outside PRD\n');
      fs.writeFileSync(path.join(outsideSource, 'OutsideScreen.kt'), 'class OutsideScreen');

      expect(() => extractPrdContract({
        repoRoot: fixture.repoRoot,
        prd: outsidePrd,
      })).toThrow(/outside repo root|allowlisted/);
      expect(() => extractCodeContract({
        repoRoot: fixture.repoRoot,
        source: outsideSource,
      })).toThrow(/outside repo root|allowlisted/);

      const product = extractPrdContract({
        repoRoot: fixture.repoRoot,
        prd: outsidePrd,
        allowOutside: [outside],
      });
      const code = extractCodeContract({
        repoRoot: fixture.repoRoot,
        source: outsideSource,
        allowOutside: [outside],
      });

      expect(product.source_inputs[0].path).toMatch(/^<prd-outside-repo:/);
      expect(code.source_inputs[0].path).toMatch(/^<source-outside-repo:/);
      expect(code.screens[0].file).toMatch(/^<outside-repo-file:/);
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  test('source extractor rejects repo-internal symlink escapes', () => {
    const fixture = makeRepo();
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-symlink-source-'));
    try {
      fs.writeFileSync(path.join(outside, 'OutsideScreen.kt'), 'class OutsideScreen');
      const linkedSource = path.join(fixture.repoRoot, 'linked-source');
      fs.symlinkSync(outside, linkedSource);

      expect(() => extractCodeContract({
        repoRoot: fixture.repoRoot,
        source: linkedSource,
      })).toThrow(/symlink/);
    } finally {
      fs.rmSync(fixture.repoRoot, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });
});
