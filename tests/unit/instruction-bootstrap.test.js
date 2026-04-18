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
    expect(updated).not.toContain('Claude workflow 入口使用 `/spec:*`');
  });

  test('repairs corrupted markers even when the stale bootstrap body was lightly edited', () => {
    const editedBody = buildBootstrapBlock('claude', 'en')
      .replace(`${BOOTSTRAP_START}\n`, '')
      .replace(`\n${BOOTSTRAP_END}`, '')
      .replace('route the request with', 'route requests with');
    const corrupted = [
      '## Existing Notes',
      editedBody,
      BOOTSTRAP_END,
    ].join('\n');

    const updated = applyManagedBootstrapBlock(corrupted, buildBootstrapBlock('codex', 'en'));

    expect(updated).toContain('## Existing Notes');
    expect(updated).toContain('Codex workflow entrypoints use `$spec-*`');
    expect(updated).not.toContain('route requests with `using-spec-first`');
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
    expect(updated).not.toContain('This project installs `using-spec-first`');
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
        .replace('This project installs', 'This repository installs'),
      '',
      'custom tail',
    ].join('\n');

    const updated = removeManagedBootstrapBlock(corrupted);

    expect(updated).toContain('# Header');
    expect(updated).toContain('custom tail');
    expect(updated).not.toContain('Workflow Entry Governance (managed by spec-first)');
    expect(updated).not.toContain('This repository installs `using-spec-first`');
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
      const drifted = fs.readFileSync(filePath, 'utf8').replace('workflow 判定', 'workflow routing');
      fs.writeFileSync(filePath, drifted, 'utf8');

      expect(inspectInstructionBootstrap(projectRoot, adapter)).toEqual({
        status: 'drifted',
        message: 'managed bootstrap block drifted from the bundled template',
      });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
