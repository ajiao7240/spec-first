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
    expect(twice).toContain('Claude workflow 入口使用 `/spec:*`');
    expect(twice).toContain('本 block 是 spec-first workflow 入口提醒');
    expect(twice).toContain('`using-spec-first` 是 standalone meta skill，不是 workflow command');
    expect(twice).toContain('不要默认进入 `spec-brainstorm`');
    expect(twice).toContain('不要自动串联多个 workflow');
    expect(twice).toContain('bounded subagent');
    expect(twice).toContain('常见入口锚点：环境/MCP');
    expect(twice).toContain('可度量优化→`/spec:optimize`');
    expect(twice).toContain('完整选择策略、优先级和 red flags 由 spec-first 随包的 `using-spec-first` 维护');
    expect(twice).toContain('不要直接暴露 internal-only skills');
    expect(twice).not.toContain('startup-reminder --codex');
    expect(twice).not.toContain('$spec-update` 由用户自主决策升级');
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
    expect(updated).toContain('Codex workflow entrypoints use `$spec-*`');
    expect(updated).toContain('startup-reminder --codex');
    expect(updated).toContain('must not block routing');
    expect(updated).toContain('bounded subagents, leaf reviewers, and worker agents');
    expect(updated).toContain('Common entry anchors: environment/MCP');
    expect(updated).toContain('measurable optimization→`$spec-optimize`');
    expect(updated).toContain('priority rules, and red flags');
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
      buildBootstrapBlock('claude', 'en').replace(`${BOOTSTRAP_START}\n`, ''),
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

    expect(codexZh).toContain('顶层 Codex orchestrator');
    expect(codexZh).toContain('spec-first startup-reminder --codex');
    expect(codexZh).toContain('$spec-update');
    expect(codexZh).toContain('不阻塞路由');
    expect(codexZh).toContain('bounded subagents、leaf reviewers、worker agents 不运行该检查');
    expect(codexEn).toContain('top-level Codex orchestrator');
    expect(codexEn).toContain('missing CLI, failure, or empty output must be ignored');
    expect(codexEn).toContain('must not run the check or write cooldown state');
    expect(claudeZh).not.toContain('startup-reminder --codex');
    expect(claudeZh).not.toContain('$spec-update');
  });
});
