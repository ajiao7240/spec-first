'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildManagedBlock } = require('../../src/cli/lang-policy');
const { getAdapter } = require('../../src/cli/adapters');
const {
  BOOTSTRAP_END,
  BOOTSTRAP_START,
  applyManagedBootstrapBlock,
  buildBootstrapBlock,
  inspectInstructionBootstrap,
  removeManagedBootstrapBlock,
  writeInstructionBootstrap,
} = require('../../src/cli/instruction-bootstrap');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-bootstrap-'));
}

describe('instruction bootstrap', () => {
  test('writes the managed block into an empty instruction file', () => {
    const block = buildBootstrapBlock('claude', 'zh');

    expect(applyManagedBootstrapBlock('', block)).toBe(block);
  });

  test('is idempotent and coexists with the language block in stable order', () => {
    const existing = buildManagedBlock('zh');
    const block = buildBootstrapBlock('claude', 'zh');
    const once = applyManagedBootstrapBlock(existing, block);
    const twice = applyManagedBootstrapBlock(once, block);

    expect(twice).toBe(once);
    expect(twice.indexOf('<!-- spec-first:lang:start -->')).toBeLessThan(twice.indexOf(BOOTSTRAP_START));
    expect(twice.match(/<!-- spec-first:bootstrap:start -->/g)).toHaveLength(1);
    expect(twice).toContain('## Workflow 入口治理');
    expect(twice).not.toContain('## Workflow 入口治理（由 spec-first 管理）');
    expect(twice).toContain('Claude workflow 入口使用 `/spec:*`');
    // 抗膨胀上界断言(替代旧的 toHaveLength(12) 精确行数断言):
    // body 是核心决策集,行数随内容增长,但需有上界防膨胀。
    expect(block.split('\n').length).toBeGreaterThan(8);
    expect(block.split('\n').length).toBeLessThan(26);
    // 核心决策集四段在场(替代旧 thin-router 措辞断言):
    expect(twice).toContain('核心决策集');
    expect(twice).toContain('何时进入 workflow');
    expect(twice).toContain('如何路由');
    expect(twice).toContain('优先级(高→低)');
    expect(twice).toContain('反合理化红旗');
    expect(twice).toContain('完整路由策略与细节仍在 `skills/using-spec-first/SKILL.md`');
    expect(twice).toContain('substantial work');
    expect(twice).toContain('不默认进入 `spec-brainstorm`');
    expect(twice).toContain('不自动串联多个 workflow');
    expect(twice).toContain('用户询问下一步时');
    expect(twice).toContain('用 `using-spec-first` guide mode 给一个入口、一个理由、一个动作');
    expect(twice).toContain('用户可见输出语言以本文件的 `spec-first:lang` managed block 为准');
    expect(twice).toContain('当前会话惯性不得覆盖该策略');
    expect(twice).toContain('bounded subagent');
    expect(twice).toContain('bounded direct reads');
    expect(twice).toContain('target_repo');
    expect(twice).toContain('Runtime context 默认排除 `.spec-first/audits/**`');
    expect(twice).toContain('generated mirrors（`.claude/**`、`.codex/**`、`.agents/skills/**`）');
    expect(twice).toContain('入口映射(意图→入口)');
    expect(twice).toContain('可度量优化实验→`/spec:optimize`');
    expect(twice).toContain('不要直接暴露 internal-only skills');
    // R2 哲学守护:保留「不强制」,严禁滑向 1% 强制全拦截语义
    expect(twice).toContain('不强制每个任务走 workflow');
    expect(twice).not.toMatch(/1%|任何可能.*必须 invoke|any chance.*must invoke/i);
    expect(twice).not.toContain('startup-reminder --codex');
    expect(twice).not.toContain('$spec-update` 由用户自主决策升级');
    expect(twice).not.toContain('spec-next');
    expect(twice).not.toContain('spec-guide');
    expect(twice).not.toContain('User Next-Step Guide Mode');
    expect(twice).not.toContain('discovered child repo');
    expect(twice).not.toContain('高级路由');
  });

  test('repairs corrupted markers by removing stray lines and appending one clean block', () => {
    const corrupted = [
      '## Existing Notes',
      BOOTSTRAP_START,
      buildBootstrapBlock('claude', 'zh').replace(`${BOOTSTRAP_START}\n`, '').replace(`\n${BOOTSTRAP_END}`, ''),
    ].join('\n');

    const updated = applyManagedBootstrapBlock(corrupted, buildBootstrapBlock('codex', 'en'));

    expect(updated.match(/<!-- spec-first:bootstrap:start -->/g)).toHaveLength(1);
    expect(updated.match(/<!-- spec-first:bootstrap:end -->/g)).toHaveLength(1);
    expect(updated).toContain('## Existing Notes');
    expect(updated).toContain('## Workflow Entry Governance');
    expect(updated).not.toContain('## Workflow Entry Governance (managed by spec-first)');
    expect(updated).toContain('Codex workflow entrypoints use `$spec-*`');
    expect(updated).toContain('core decision set');
    expect(updated).toContain('skills/using-spec-first/SKILL.md');
    expect(updated).toContain('startup-reminder --codex');
    expect(updated).toContain('must not block routing');
    expect(updated).toContain("when the user asks what's next");
    expect(updated).toContain('use `using-spec-first` guide mode for one entrypoint, one reason, one action');
    expect(updated).toContain("User-visible output language follows this file's `spec-first:lang` managed block");
    expect(updated).toContain('conversation inertia must not override it');
    expect(updated).toContain('bounded subagents, leaf reviewers, and worker agents');
    expect(updated).toContain('Runtime context excludes `.spec-first/audits/**`');
    expect(updated).toContain('generated mirrors (`.claude/**`, `.codex/**`, `.agents/skills/**`)');
    expect(updated).toContain('Entry map (intent→entrypoint): environment/MCP');
    expect(updated).toContain('measurable optimization→`$spec-optimize`');
    expect(updated).not.toContain('priority rules, and red flags');
    expect(updated).not.toContain('Claude workflow 入口使用 `/spec:*`');
  });

  test('repairs corrupted markers even when the stale bootstrap body was lightly edited', () => {
    const editedBody = buildBootstrapBlock('claude', 'en')
      .replace(`${BOOTSTRAP_START}\n`, '')
      .replace(`\n${BOOTSTRAP_END}`, '')
      .replace('decide whether to enter a public spec-first workflow', 'perform route checks');
    const corrupted = [
      '## Existing Notes',
      editedBody,
      BOOTSTRAP_END,
    ].join('\n');

    const updated = applyManagedBootstrapBlock(corrupted, buildBootstrapBlock('codex', 'en'));

    expect(updated).toContain('## Existing Notes');
    expect(updated).toContain('Codex workflow entrypoints use `$spec-*`');
    expect(updated).not.toContain('perform route checks');
    expect(updated).not.toContain('Claude workflow entrypoints use `/spec:*`');
    expect(updated.match(/<!-- spec-first:bootstrap:start -->/g)).toHaveLength(1);
  });

  test('preserves a clean-heading user section when markers are corrupted', () => {
    const corrupted = [
      '# Header',
      '',
      BOOTSTRAP_START,
      '## Workflow Entry Governance',
      '',
      '- Custom workflow note.',
      '- Keep the local planning checklist.',
      '- Require owner approval before changing commands.',
      '- Do not remove this section.',
      '',
      '# Tail',
    ].join('\n');

    const updated = applyManagedBootstrapBlock(corrupted, buildBootstrapBlock('codex', 'en'));

    expect(updated).toContain('- Custom workflow note.');
    expect(updated).toContain('- Do not remove this section.');
    expect(updated).toContain('# Tail');
    expect(updated.match(/<!-- spec-first:bootstrap:start -->/g)).toHaveLength(1);
    expect(updated.match(/^## Workflow Entry Governance$/gm)).toHaveLength(2);
  });

  test('remove preserves a clean-heading user section when markers are corrupted', () => {
    const corrupted = [
      '# Header',
      '',
      BOOTSTRAP_START,
      '## Workflow Entry Governance',
      '',
      '- Custom workflow note.',
      '- Keep the local planning checklist.',
      '- Require owner approval before changing commands.',
      '- Do not remove this section.',
      '',
      '# Tail',
    ].join('\n');

    const updated = removeManagedBootstrapBlock(corrupted);

    expect(updated).toContain('- Custom workflow note.');
    expect(updated).toContain('- Do not remove this section.');
    expect(updated).toContain('# Tail');
    expect(updated).not.toContain(BOOTSTRAP_START);
    expect(updated.match(/^## Workflow Entry Governance$/gm)).toHaveLength(1);
  });

  test('clears a clean-heading generated-like body when markers are corrupted', () => {
    const corrupted = [
      '# Header',
      '',
      BOOTSTRAP_START,
      '## Workflow Entry Governance',
      '',
      '- This block is the spec-first workflow entry reminder; `using-spec-first` is a standalone meta skill, not a workflow command',
      '- Common entry anchors: environment/MCP→`/spec:mcp-setup`; version/runtime check→run `spec-first update` in the terminal; execution→`/spec:work`',
      '- Do not expose internal-only skills directly',
      '- CUSTOM DRIFT',
      '',
      '# Tail',
    ].join('\n');

    const updated = applyManagedBootstrapBlock(corrupted, buildBootstrapBlock('codex', 'en'));

    expect(updated).toContain('# Header');
    expect(updated).toContain('# Tail');
    expect(updated).not.toContain('CUSTOM DRIFT');
    expect(updated.match(/^## Workflow Entry Governance$/gm)).toHaveLength(1);
    expect(updated).toContain(BOOTSTRAP_END);
  });

  test('removes only the managed block and preserves user content', () => {
    const content = [
      '# Header',
      '',
      buildBootstrapBlock('claude', 'zh'),
      '',
      'custom tail',
      '',
    ].join('\n');

    const updated = removeManagedBootstrapBlock(content);

    expect(updated).toContain('# Header');
    expect(updated).toContain('custom tail');
    expect(updated).not.toContain(BOOTSTRAP_START);
    expect(updated).not.toContain(BOOTSTRAP_END);
  });

  test('removeManagedBootstrapBlock clears stale managed body when markers are corrupted', () => {
    const corrupted = [
      '# Header',
      '',
      buildBootstrapBlock('claude', 'en')
        .replace('## Workflow Entry Governance', '## Workflow Entry Governance (managed by spec-first)')
        .replace(`${BOOTSTRAP_START}\n`, ''),
      '',
      'custom tail',
    ].join('\n');

    const updated = removeManagedBootstrapBlock(corrupted);

    expect(updated).toContain('# Header');
    expect(updated).toContain('custom tail');
    expect(updated).not.toContain('Workflow Entry Governance (managed by spec-first)');
    expect(updated).not.toContain('This block is the spec-first workflow entry reminder');
  });

  test('removeManagedBootstrapBlock clears corrupted stale body after light edits', () => {
    const corrupted = [
      '# Header',
      '',
      BOOTSTRAP_END,
      '',
      buildBootstrapBlock('claude', 'en')
        .replace(`${BOOTSTRAP_START}\n`, '')
        .replace(`\n${BOOTSTRAP_END}`, '')
        .replace('This block is the spec-first workflow entry reminder', 'This repository enables spec-first workflow entry governance'),
      '',
      'custom tail',
    ].join('\n');

    const updated = removeManagedBootstrapBlock(corrupted);

    expect(updated).toContain('# Header');
    expect(updated).toContain('custom tail');
    expect(updated).not.toContain('Workflow Entry Governance (managed by spec-first)');
    expect(updated).not.toContain('This repository enables spec-first workflow entry governance');
  });

  test('inspects installed and drifted bootstrap blocks', () => {
    const projectRoot = makeTempDir();
    const adapter = getAdapter('claude');

    try {
      writeInstructionBootstrap(projectRoot, adapter, 'zh');
      expect(inspectInstructionBootstrap(projectRoot, adapter)).toEqual({
        status: 'installed',
        message: 'managed bootstrap block present',
      });

      const filePath = path.join(projectRoot, adapter.instructionFile);
      const drifted = fs.readFileSync(filePath, 'utf8').replace('公开 spec-first workflow', 'workflow 判定');
      fs.writeFileSync(filePath, drifted, 'utf8');

      expect(inspectInstructionBootstrap(projectRoot, adapter)).toEqual({
        status: 'drifted',
        message: 'managed bootstrap block drifted from the bundled template',
      });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Codex bootstrap includes best-effort top-level startup version reminder guidance', () => {
    const codexZh = buildBootstrapBlock('codex', 'zh');
    const codexEn = buildBootstrapBlock('codex', 'en');
    const claudeZh = buildBootstrapBlock('claude', 'zh');

    expect(codexZh).toContain('Codex：进入公开 `$spec-*` 前');
    expect(codexZh).toContain('spec-first startup-reminder --codex');
    expect(codexZh).toContain('只提示在终端运行 `spec-first update`');
    expect(codexZh).toContain('失败/空输出不阻塞');
    expect(codexZh).toContain('bounded subagents、leaf reviewers、worker agents 不运行');
    expect(codexZh).toContain('`$spec-doc-review` 默认多 persona dispatch');
    expect(codexZh).toContain('仅 report-only/no-agents、dispatch/runtime 缺失或安全边界不满足时降级');
    expect(codexZh).toContain('公开 `$spec-*` 调用即授权该 workflow 文档化的只读 reviewer/researcher phase');
    expect(codexZh.split('\n').length).toBeGreaterThan(10);
    expect(codexZh.split('\n').length).toBeLessThan(28);
    expect(codexEn).toContain('a top-level orchestrator');
    expect(codexEn).toContain('failure/empty output must not block routing');
    expect(codexEn).toContain('worker agents do not run it');
    expect(codexEn).toContain('`$spec-doc-review` defaults to multi-persona dispatch');
    expect(codexEn).toContain('falls back only for report-only/no-agents, missing dispatch/runtime, or unmet safety boundaries');
    expect(codexEn).toContain('invoking public `$spec-*` authorizes');
    expect(codexEn.split('\n').length).toBeGreaterThan(10);
    expect(codexEn.split('\n').length).toBeLessThan(28);
    expect(claudeZh).not.toContain('startup-reminder --codex');
    expect(claudeZh).not.toContain('$spec-update');
    expect(claudeZh).not.toContain('默认多 persona dispatch');
  });

  // U3: 核心决策集四段 + R2 哲学守护(AE1/AE2)
  test('core decision set carries all four segments without 1% coercion (AE1/AE2)', () => {
    for (const host of ['claude', 'codex']) {
      for (const lang of ['zh', 'en']) {
        const block = buildBootstrapBlock(host, lang);
        // 四段在场
        if (lang === 'zh') {
          expect(block).toContain('何时进入 workflow');
          expect(block).toContain('如何路由');
          expect(block).toContain('优先级(高→低)');
          expect(block).toContain('反合理化红旗');
          expect(block).toContain('不强制每个任务走 workflow');
        } else {
          expect(block).toContain('When to enter a workflow');
          expect(block).toContain('How to route');
          expect(block).toContain('Priority (high→low)');
          expect(block).toContain('Anti-rationalization red flags');
          expect(block).toContain('does NOT mean brainstorming-first');
        }
        // R2: 严禁 1% 强制全拦截语义
        expect(block).not.toMatch(/1%/);
        expect(block).not.toMatch(/any chance.*must invoke/i);
        expect(block).not.toMatch(/任何可能.*必须/);
        // R5: subagent 豁免在场
        expect(block.toLowerCase()).toContain('bounded subagent');
      }
    }
  });

  // U3: drift 不变量 — Route Map identifier 集合(P1-④, AE4/R6)
  // 用 identifier 集合而非措辞片段:identifier 不因措辞改写消失,误红率低。
  // 能力边界(诚实标注,不 overclaim):
  //   - block ⊆ SKILL 方向:断言 block 不含 SKILL Route Map 之外的入口(抓 block 自造入口)。
  //   - mandatory-core 正向:断言 block 覆盖一组高频核心入口(抓 block 静默删除核心入口)。
  //   - 本测试**不**自动抓 SKILL 端新增入口是否同步进 block(block 是 curated 子集,
  //     有意省略 polish-beta/slack-research 等低频入口);SKILL 新增高频入口需人工决定
  //     是否进 MANDATORY_CORE 并在此同步。也**不**保证语义等价(优先级层数/route 语义改写需人工同步)。
  test('drift invariant: block Route Map identifiers stay within SKILL and cover the mandatory core (AE4/R6)', () => {
    const skillPath = path.join(__dirname, '..', '..', 'skills', 'using-spec-first', 'SKILL.md');
    const skill = fs.readFileSync(skillPath, 'utf8');
    // 从 SKILL 的 Route Map 区提取公开 workflow identifier(/spec:NAME 形式)
    const routeMapSection = skill.slice(skill.indexOf('### Route Map'));
    const skillIds = new Set(
      [...routeMapSection.matchAll(/\/spec:([a-z-]+)/g)].map((m) => m[1]),
    );
    expect(skillIds.size).toBeGreaterThan(10); // SKILL Route Map 应有充足条目(防提取失败)

    // block 必须覆盖的高频核心入口(防静默删除)。SKILL 端 Route Map 新增高频入口时,
    // 需人工评估是否补入此列表;低频入口(polish-beta/slack-research)有意不在 block。
    const MANDATORY_CORE = [
      'mcp-setup', 'debug', 'code-review', 'doc-review', 'brainstorm', 'prd',
      'plan', 'work', 'optimize', 'ideate', 'compound', 'compound-refresh',
      'skill-audit', 'app-consistency-audit', 'sessions', 'release-notes',
    ];
    // 守护:MANDATORY_CORE 本身必须都在 SKILL Route Map 内(否则列表自身 stale)
    for (const id of MANDATORY_CORE) {
      expect(skillIds.has(id)).toBe(true);
    }

    for (const host of ['claude', 'codex']) {
      for (const lang of ['zh', 'en']) {
        const block = buildBootstrapBlock(host, lang);
        const prefix = host === 'claude' ? '/spec:' : '$spec-';
        const re = new RegExp(prefix.replace(/[$]/g, '\\$') + '([a-z-]+)', 'g');
        const blockIds = new Set([...block.matchAll(re)].map((m) => m[1]));
        // block ⊆ SKILL:不得含 SKILL Route Map 之外的入口(防自造入口/drift)
        for (const id of blockIds) {
          expect(skillIds.has(id)).toBe(true);
        }
        // mandatory-core 正向:每个高频核心入口都必须在 block(防静默删除高频入口)
        for (const id of MANDATORY_CORE) {
          expect(blockIds.has(id)).toBe(true);
        }
      }
    }
  });

  // U3: R8 双宿主对齐 — claude 与 codex 除入口语法外四段核心语义对齐(AE5)
  test('dual-host alignment: claude and codex blocks share core decision semantics (AE5)', () => {
    for (const lang of ['zh', 'en']) {
      const claude = buildBootstrapBlock('claude', lang);
      const codex = buildBootstrapBlock('codex', lang);
      // 把入口语法差异归一化后,四段核心语义点应两端都在
      const segmentProbes = lang === 'zh'
        ? ['何时进入 workflow', '如何路由', '优先级(高→低)', '反合理化红旗', '入口映射(意图→入口)', 'bounded subagent']
        : ['When to enter a workflow', 'How to route', 'Priority (high→low)', 'Anti-rationalization red flags', 'Entry map (intent→entrypoint)', 'bounded subagent'];
      for (const probe of segmentProbes) {
        expect(claude).toContain(probe);
        expect(codex).toContain(probe);
      }
    }
  });
});
