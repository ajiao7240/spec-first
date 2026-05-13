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
    expect(block.split('\n')).toHaveLength(11);
    expect(twice).toContain('轻量 workflow entry context router');
    expect(twice).toContain('完整路由策略在 `skills/using-spec-first/SKILL.md`');
    expect(twice).toContain('substantial work 前先判断是否进入公开 spec-first workflow');
    expect(twice).toContain('不要默认进入 `spec-brainstorm`');
    expect(twice).toContain('不要自动串联多个 workflow');
    expect(twice).toContain('用户询问下一步时');
    expect(twice).toContain('用 `using-spec-first` guide mode 推荐一个入口、一个理由、一个动作');
    expect(twice).toContain('bounded subagent');
    expect(twice).toContain('workspace-graph-targets.v1');
    expect(twice).toContain('target_repo');
    expect(twice).toContain('常见入口锚点：环境/MCP');
    expect(twice).toContain('可度量优化→`/spec:optimize`');
    expect(twice).toContain('不要直接暴露 internal-only skills');
    expect(twice).not.toContain('startup-reminder --codex');
    expect(twice).not.toContain('$spec-update` 由用户自主决策升级');
    expect(twice).not.toContain('spec-next');
    expect(twice).not.toContain('spec-guide');
    expect(twice).not.toContain('Routing Priority');
    expect(twice).not.toContain('Route Map');
    expect(twice).not.toContain('User Next-Step Guide Mode');
    expect(twice).not.toContain('spec-standards` 无参数运行默认为每个 discovered child repo');
    expect(twice).not.toContain('setup 和 graph bootstrap 可默认按 discovered child repos');
    expect(twice).not.toContain('完整选择策略、优先级和 red flags');
    expect(twice).not.toContain('internal-only skills：`using-spec-first`');
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
    expect(updated).toContain('thin workflow entry context router');
    expect(updated).toContain('skills/using-spec-first/SKILL.md');
    expect(updated).toContain('startup-reminder --codex');
    expect(updated).toContain('must not block routing');
    expect(updated).toContain('when the user asks what to run next');
    expect(updated).toContain('use `using-spec-first` guide mode to recommend one entrypoint, one reason, and one action');
    expect(updated).toContain('bounded subagents, leaf reviewers, and worker agents');
    expect(updated).toContain('Common entry anchors: environment/MCP');
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
      '- Common entry anchors: environment/MCP→`/spec:mcp-setup`; graph readiness compiler→`/spec:graph-bootstrap`',
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
    expect(codexZh).toContain('$spec-update');
    expect(codexZh).toContain('失败/空输出不阻塞');
    expect(codexZh).toContain('bounded subagents、leaf reviewers、worker agents 不运行');
    expect(codexZh).toContain('`$spec-doc-review` 默认多 persona dispatch');
    expect(codexZh).toContain('仅 report-only/no-agents、dispatch/runtime 缺失或安全边界不满足时降级');
    expect(codexZh).toContain('公开 `$spec-*` 调用即授权该 workflow 文档化的只读 reviewer/researcher phase');
    expect(codexZh.split('\n')).toHaveLength(13);
    expect(codexEn).toContain('a top-level orchestrator');
    expect(codexEn).toContain('failure/empty output must not block routing');
    expect(codexEn).toContain('worker agents do not run it');
    expect(codexEn).toContain('`$spec-doc-review` defaults to multi-persona dispatch');
    expect(codexEn).toContain('falls back only for report-only/no-agents, missing dispatch/runtime, or unmet safety boundaries');
    expect(codexEn).toContain('invoking public `$spec-*` authorizes');
    expect(codexEn.split('\n')).toHaveLength(13);
    expect(claudeZh).not.toContain('startup-reminder --codex');
    expect(claudeZh).not.toContain('$spec-update');
    expect(claudeZh).not.toContain('默认多 persona dispatch');
  });
});
