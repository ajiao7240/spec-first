'use strict';

const {
  SPEC_FIRST_GITIGNORE_END,
  SPEC_FIRST_GITIGNORE_START,
  applySpecFirstGitignoreBlock,
  buildSpecFirstGitignoreBlock,
  getSpecFirstGitignorePatternMetadata,
  getSpecFirstGitignorePatterns,
} = require('../../src/cli/gitignore-policy');

describe('spec-first gitignore policy', () => {
  test('renders one managed block with narrow default patterns', () => {
    const block = buildSpecFirstGitignoreBlock();
    const patterns = getSpecFirstGitignorePatterns();

    expect(block).toContain(SPEC_FIRST_GITIGNORE_START);
    expect(block).toContain(SPEC_FIRST_GITIGNORE_END);
    expect(patterns).toContain('.claude/commands/spec/');
    expect(patterns).toContain('.claude/hooks/session-start');
    expect(patterns).toContain('.agents/skills/');
    expect(patterns).toContain('.gitnexus/');
    expect(patterns).toContain('.code-review-graph/');
    expect(getSpecFirstGitignorePatternMetadata()['.code-review-graph/']).toMatchObject({
      reason: 'retired-crg-residual-ignore',
      'residual-ignore-expiry': '1.9.0',
    });
    expect(patterns).toContain('.spec-first/config/*.json');
    expect(patterns).not.toContain('.spec-first/' + 'standards/');
    expect(patterns).toContain('.spec-first/sessions/');
    expect(patterns).not.toContain('.claude/');
    expect(patterns).not.toContain('.codex/');
    expect(patterns).not.toContain('.agents/');
    expect(patterns).not.toContain('.spec-first/');
    expect(patterns).not.toContain('*.tgz');
  });

  test('adds a managed block to empty content', () => {
    const result = applySpecFirstGitignoreBlock('');

    expect(result.status).toBe('added');
    expect(result.content).toBe(`${buildSpecFirstGitignoreBlock()}\n`);
    expect(countStartMarkers(result.content)).toBe(1);
  });

  test('preserves existing user content before and after the managed block', () => {
    const existing = [
      'node_modules/',
      '',
      SPEC_FIRST_GITIGNORE_START,
      '# old policy',
      '.old-spec-first/',
      SPEC_FIRST_GITIGNORE_END,
      '',
      'dist/',
      '',
    ].join('\n');

    const result = applySpecFirstGitignoreBlock(existing);

    expect(result.status).toBe('updated');
    expect(result.content.startsWith('node_modules/\n\n')).toBe(true);
    expect(result.content).toContain(`${SPEC_FIRST_GITIGNORE_END}\n\ndist/\n`);
    expect(result.content).not.toContain('.old-spec-first/');
    expect(countStartMarkers(result.content)).toBe(1);
  });

  test('adds a separating newline when existing content has no trailing newline', () => {
    const result = applySpecFirstGitignoreBlock('dist/');

    expect(result.status).toBe('added');
    expect(result.content.startsWith('dist/\n\n# spec-first:start')).toBe(true);
    expect(result.content.endsWith('\n')).toBe(true);
  });

  test('leaves an already-current block unchanged', () => {
    const existing = `# user rule\n\n${buildSpecFirstGitignoreBlock()}\n`;
    const result = applySpecFirstGitignoreBlock(existing);

    expect(result.status).toBe('already-current');
    expect(result.content).toBe(existing);
    expect(countStartMarkers(result.content)).toBe(1);
  });

  test('does not suppress duplicate standalone rules outside the managed block', () => {
    const result = applySpecFirstGitignoreBlock('.spec-first/*.local.yaml\n');

    expect(result.status).toBe('added');
    expect(result.content.match(/^\.spec-first\/\*\.local\.yaml$/gm)).toHaveLength(2);
    expect(countStartMarkers(result.content)).toBe(1);
  });

  test('rejects non-string content', () => {
    expect(() => applySpecFirstGitignoreBlock(null)).toThrow('existingContent must be a string');
  });
});

function countStartMarkers(content) {
  return (content.match(new RegExp(SPEC_FIRST_GITIGNORE_START, 'g')) || []).length;
}
