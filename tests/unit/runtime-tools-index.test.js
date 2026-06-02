'use strict';

const {
  RUNTIME_TOOLS_END,
  RUNTIME_TOOLS_START,
  removeManagedRuntimeToolsBlock,
} = require('../../src/cli/runtime-tools-index');

function managedRuntimeToolsBlock() {
  return [
    RUNTIME_TOOLS_START,
    '## Runtime Tools',
    '',
    '- `spec-mcp-setup` manages required MCP servers and helper tooling.',
    '- Runtime facts are setup evidence, not source authority.',
    '',
    RUNTIME_TOOLS_END,
  ].join('\n');
}

describe('runtime tools instruction cleanup', () => {
  test('exports marker constants and cleanup helper', () => {
    const runtimeToolsIndex = require('../../src/cli/runtime-tools-index');

    expect(runtimeToolsIndex).toEqual({
      RUNTIME_TOOLS_END,
      RUNTIME_TOOLS_START,
      removeManagedRuntimeToolsBlock,
    });
  });

  test('removes the managed marker block and preserves surrounding content', () => {
    const content = [
      '# Header',
      '',
      managedRuntimeToolsBlock(),
      '',
      '## Next',
      '',
    ].join('\n');

    const updated = removeManagedRuntimeToolsBlock(content);

    expect(updated).toContain('# Header');
    expect(updated).toContain('## Next');
    expect(updated).not.toContain(RUNTIME_TOOLS_START);
    expect(updated).not.toContain(RUNTIME_TOOLS_END);
  });

  test('repairs partial managed markers by stripping standalone marker lines', () => {
    const corrupted = [
      '# Header',
      '',
      RUNTIME_TOOLS_START,
      '## Runtime Tools',
      '',
      '- Keep this user-authored prose.',
      '',
      '## Next',
      '',
      '- Keep this next section.',
    ].join('\n');

    const updated = removeManagedRuntimeToolsBlock(corrupted);

    expect(updated).toContain('# Header');
    expect(updated).toContain('## Runtime Tools');
    expect(updated).toContain('Keep this user-authored prose.');
    expect(updated).toContain('## Next');
    expect(updated).toContain('Keep this next section.');
    expect(updated).not.toContain(RUNTIME_TOOLS_START);
  });

  test('strips an orphaned end marker', () => {
    const corrupted = [
      '# Header',
      '',
      RUNTIME_TOOLS_END,
      '',
      '## Runtime Tools',
    ].join('\n');

    const updated = removeManagedRuntimeToolsBlock(corrupted);

    expect(updated).toContain('# Header');
    expect(updated).toContain('## Runtime Tools');
    expect(updated).not.toContain(RUNTIME_TOOLS_END);
  });

  test('leaves files without managed runtime tools unchanged except newline normalization', () => {
    const content = [
      '# Header',
      '',
      '## Runtime Tools',
      '',
      '- User-authored section.',
      '',
    ].join('\n');

    expect(removeManagedRuntimeToolsBlock(content)).toBe(content);
  });
});
