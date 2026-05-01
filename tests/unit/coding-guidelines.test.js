'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildManagedBlock } = require('../../src/cli/lang-policy');
const {
  BOOTSTRAP_START,
  applyManagedBootstrapBlock,
  buildBootstrapBlock,
} = require('../../src/cli/instruction-bootstrap');
const {
  CODING_GUIDELINES_END,
  CODING_GUIDELINES_START,
  applyManagedCodingGuidelinesBlock,
  buildCodingGuidelinesBlock,
  inspectCodingGuidelinesBlock,
  removeManagedCodingGuidelinesBlock,
  writeCodingGuidelinesBlock,
} = require('../../src/cli/coding-guidelines');
const { getAdapter } = require('../../src/cli/adapters');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-coding-guidelines-'));
}

describe('coding guidelines instruction block', () => {
  test('writes the managed block into an empty instruction file', () => {
    const block = buildCodingGuidelinesBlock('zh');

    expect(applyManagedCodingGuidelinesBlock('', block)).toBe(block);
  });

  test('appends the managed block to existing user content without overwriting it', () => {
    const block = buildCodingGuidelinesBlock('zh');
    const existing = '# My Repo\n\nCustom user notes.\n';
    const updated = applyManagedCodingGuidelinesBlock(existing, block);

    expect(updated).toContain('# My Repo');
    expect(updated).toContain('Custom user notes.');
    expect(updated.trim().endsWith(CODING_GUIDELINES_END)).toBe(true);
    expect(updated.indexOf('# My Repo')).toBeLessThan(updated.indexOf(CODING_GUIDELINES_START));
  });

  test('is idempotent and coexists with language and bootstrap blocks in stable order', () => {
    const existing = applyManagedBootstrapBlock(
      buildManagedBlock('zh'),
      buildBootstrapBlock('claude', 'zh'),
    );
    const block = buildCodingGuidelinesBlock('zh');
    const once = applyManagedCodingGuidelinesBlock(existing, block);
    const twice = applyManagedCodingGuidelinesBlock(once, block);

    expect(twice).toBe(once);
    expect(twice.indexOf('<!-- spec-first:lang:start -->')).toBeLessThan(twice.indexOf(BOOTSTRAP_START));
    expect(twice.indexOf(BOOTSTRAP_START)).toBeLessThan(twice.indexOf(CODING_GUIDELINES_START));
    expect(twice.match(/<!-- spec-first:coding-guidelines:start -->/g)).toHaveLength(1);
  });

  test('stays scoped to execution posture instead of workflow routing', () => {
    const zh = buildCodingGuidelinesBlock('zh');
    const en = buildCodingGuidelinesBlock('en');

    expect(zh).toContain('这些准则只约束进入工作后的执行姿势，不替代 `using-spec-first` 的 workflow 入口治理。');
    expect(en).toContain('These guidelines shape execution posture after workflow routing; they do not replace spec-first workflow entry governance.');

    for (const block of [zh, en]) {
      expect(block).not.toContain('下一步');
      expect(block).not.toContain('该用哪个命令');
      expect(block).not.toContain('which command');
      expect(block).not.toContain('what to run next');
      expect(block).not.toContain('/spec:next');
      expect(block).not.toContain('$spec-next');
      expect(block).not.toContain('/spec:guide');
      expect(block).not.toContain('$spec-guide');
      expect(block).not.toContain('完整选择策略');
      expect(block).not.toContain('Common entry anchors');
    }
  });

  test('removes only the managed block and preserves surrounding user content', () => {
    const content = [
      '# Header',
      '',
      buildCodingGuidelinesBlock('zh'),
      '',
      'custom tail',
      '',
    ].join('\n');

    const updated = removeManagedCodingGuidelinesBlock(content);

    expect(updated).toContain('# Header');
    expect(updated).toContain('custom tail');
    expect(updated).not.toContain(CODING_GUIDELINES_START);
    expect(updated).not.toContain(CODING_GUIDELINES_END);
  });

  test('repairs a corrupted marker state by removing a drifted managed body before rebuilding', () => {
    const corrupted = [
      '# Header',
      '',
      CODING_GUIDELINES_START,
      '## Coding Execution Guidelines (managed by spec-first)',
      '',
      'CUSTOM DRIFT',
      '',
      '### Think Before Coding',
      '- one',
      '- two',
      '- three',
      '- four',
      '',
      '# Tail',
    ].join('\n');

    const updated = applyManagedCodingGuidelinesBlock(corrupted, buildCodingGuidelinesBlock('en'));

    expect(updated).toContain('# Header');
    expect(updated).toContain('# Tail');
    expect(updated).not.toContain('CUSTOM DRIFT');
    expect(updated.match(/## Coding Execution Guidelines \(managed by spec-first\)/g)).toHaveLength(1);
    expect(updated).toContain(CODING_GUIDELINES_END);
  });

  test('removes a drifted managed body when the markers are corrupted', () => {
    const corrupted = [
      '# Header',
      '',
      CODING_GUIDELINES_START,
      '## Coding Execution Guidelines (managed by spec-first)',
      '',
      'CUSTOM DRIFT',
      '',
      '### Think Before Coding',
      '- one',
      '- two',
      '- three',
      '- four',
      '',
      '# Tail',
    ].join('\n');

    const updated = removeManagedCodingGuidelinesBlock(corrupted);

    expect(updated).toContain('# Header');
    expect(updated).toContain('# Tail');
    expect(updated).not.toContain(CODING_GUIDELINES_START);
    expect(updated).not.toContain('## Coding Execution Guidelines (managed by spec-first)');
    expect(updated).not.toContain('CUSTOM DRIFT');
  });

  test('inspects installed and drifted coding-guidelines blocks', () => {
    const projectRoot = makeTempDir();
    const adapter = getAdapter('claude');

    try {
      writeCodingGuidelinesBlock(projectRoot, adapter, 'zh');
      expect(inspectCodingGuidelinesBlock(projectRoot, adapter)).toEqual({
        status: 'installed',
        message: 'managed coding-guidelines block present',
      });

      const filePath = path.join(projectRoot, adapter.instructionFile);
      const drifted = fs.readFileSync(filePath, 'utf8').replace('先想清楚再动手', '先想清楚再编码');
      fs.writeFileSync(filePath, drifted, 'utf8');

      expect(inspectCodingGuidelinesBlock(projectRoot, adapter)).toEqual({
        status: 'drifted',
        message: 'managed coding-guidelines block drifted from the bundled template',
      });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
