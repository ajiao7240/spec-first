'use strict';

const {
  CODING_GUIDELINES_END,
  CODING_GUIDELINES_START,
  removeManagedCodingGuidelinesBlock,
} = require('../../src/cli/coding-guidelines');

function managedCodingGuidelinesBlock() {
  return [
    CODING_GUIDELINES_START,
    '## Coding Execution Guidelines',
    '',
    '- Retired managed block body kept short for the removal test.',
    '',
    CODING_GUIDELINES_END,
  ].join('\n');
}

describe('coding guidelines instruction cleanup', () => {
  test('exports marker constants and cleanup helper', () => {
    const codingGuidelines = require('../../src/cli/coding-guidelines');

    expect(codingGuidelines).toEqual({
      CODING_GUIDELINES_END,
      CODING_GUIDELINES_START,
      removeManagedCodingGuidelinesBlock,
    });
  });

  test('removes the managed marker block and preserves surrounding content', () => {
    const content = [
      '# Header',
      '',
      managedCodingGuidelinesBlock(),
      '',
      '## Next',
      '',
    ].join('\n');

    const updated = removeManagedCodingGuidelinesBlock(content);

    expect(updated).toContain('# Header');
    expect(updated).toContain('## Next');
    expect(updated).not.toContain(CODING_GUIDELINES_START);
    expect(updated).not.toContain(CODING_GUIDELINES_END);
  });

  test('repairs partial managed markers by stripping standalone marker lines', () => {
    const corrupted = [
      '# Header',
      '',
      CODING_GUIDELINES_START,
      '## Coding Execution Guidelines',
      '',
      '- Keep this user-authored prose.',
      '',
      '## Next',
      '',
      '- Keep this next section.',
    ].join('\n');

    const updated = removeManagedCodingGuidelinesBlock(corrupted);

    expect(updated).toContain('# Header');
    expect(updated).toContain('## Coding Execution Guidelines');
    expect(updated).toContain('Keep this user-authored prose.');
    expect(updated).toContain('## Next');
    expect(updated).toContain('Keep this next section.');
    expect(updated).not.toContain(CODING_GUIDELINES_START);
  });

  test('strips an orphaned end marker', () => {
    const corrupted = [
      '# Header',
      '',
      CODING_GUIDELINES_END,
      '',
      '## Coding Execution Guidelines',
    ].join('\n');

    const updated = removeManagedCodingGuidelinesBlock(corrupted);

    expect(updated).toContain('# Header');
    expect(updated).toContain('## Coding Execution Guidelines');
    expect(updated).not.toContain(CODING_GUIDELINES_END);
  });

  test('preserves a managed-form body when only one marker survives (no aggressive scrub)', () => {
    const corrupted = [
      '# Header',
      '',
      CODING_GUIDELINES_START,
      '## Coding Execution Guidelines (managed by spec-first)',
      '',
      '- This legacy managed body is intentionally preserved, not scrubbed.',
      '',
      '## Next',
    ].join('\n');

    const updated = removeManagedCodingGuidelinesBlock(corrupted);

    expect(updated).not.toContain(CODING_GUIDELINES_START);
    expect(updated).toContain('## Coding Execution Guidelines (managed by spec-first)');
    expect(updated).toContain('intentionally preserved, not scrubbed.');
    expect(updated).toContain('## Next');
  });

  test('leaves a user-authored heading without markers unchanged', () => {
    const content = [
      '# Header',
      '',
      '## Coding Execution Guidelines',
      '',
      '- User-authored section that is not a spec-first managed block.',
      '',
    ].join('\n');

    expect(removeManagedCodingGuidelinesBlock(content)).toBe(content);
  });
});
