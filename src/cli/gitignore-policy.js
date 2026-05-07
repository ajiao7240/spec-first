'use strict';

const SPEC_FIRST_GITIGNORE_START = '# spec-first:start';
const SPEC_FIRST_GITIGNORE_END = '# spec-first:end';

const SPEC_FIRST_GITIGNORE_SECTIONS = [
  {
    title: 'spec-first generated runtime assets',
    patterns: [
      '.claude/commands/spec/',
      '.claude/skills/',
      '.claude/spec-first/',
      '.claude/agents/',
      '.claude/tasks/',
      '.claude/worktrees/',
      '.codex/commands/spec/',
      '.codex/spec-first/',
      '.codex/agents/',
      '.agents/skills/',
      '.context/spec-first/',
    ],
  },
  {
    title: 'spec-first local setup, graph readiness, standards, and workflow runtime artifacts',
    patterns: [
      '.spec-first-graph/',
      '.spec-first/*.local.yaml',
      '.spec-first/config.local.yaml',
      '.spec-first/config/*.json',
      '.spec-first/audits/',
      '.spec-first/app-audit/',
      '.spec-first/graph/',
      '.spec-first/providers/',
      '.spec-first/impact/',
      '.spec-first/workflows/',
      '.spec-first/workspace/',
      '.spec-first/standards/',
    ],
  },
  {
    title: 'local project tooling used by spec-first workflows',
    patterns: [
      '.serena/',
    ],
  },
];

function getSpecFirstGitignorePatterns() {
  return SPEC_FIRST_GITIGNORE_SECTIONS.flatMap((section) => section.patterns);
}

function buildSpecFirstGitignoreBlock() {
  const lines = [SPEC_FIRST_GITIGNORE_START];
  for (const section of SPEC_FIRST_GITIGNORE_SECTIONS) {
    lines.push(`# ${section.title}`);
    lines.push(...section.patterns);
    lines.push('');
  }
  lines.pop();
  lines.push(SPEC_FIRST_GITIGNORE_END);
  return lines.join('\n');
}

function applySpecFirstGitignoreBlock(existingContent) {
  if (typeof existingContent !== 'string') {
    throw new TypeError('existingContent must be a string');
  }

  const block = buildSpecFirstGitignoreBlock();
  const startIdx = existingContent.indexOf(SPEC_FIRST_GITIGNORE_START);
  const endIdx = existingContent.indexOf(SPEC_FIRST_GITIGNORE_END);
  const hasValidBlock = startIdx !== -1 && endIdx !== -1 && endIdx > startIdx;
  let updated;
  let status;

  if (hasValidBlock) {
    const before = existingContent.slice(0, startIdx);
    const after = existingContent.slice(endIdx + SPEC_FIRST_GITIGNORE_END.length);
    updated = `${before}${block}${after}`;
    status = updated === existingContent ? 'already-current' : 'updated';
  } else if (existingContent.length === 0) {
    updated = `${block}\n`;
    status = 'added';
  } else {
    const separator = existingContent.endsWith('\n') ? '\n' : '\n\n';
    updated = `${existingContent}${separator}${block}\n`;
    status = 'added';
  }

  const finalContent = ensureFinalNewline(updated);
  if (status === 'already-current' && finalContent !== existingContent) {
    status = 'updated';
  }

  return {
    content: finalContent,
    status,
  };
}

function ensureFinalNewline(content) {
  return content.endsWith('\n') ? content : `${content}\n`;
}

module.exports = {
  SPEC_FIRST_GITIGNORE_END,
  SPEC_FIRST_GITIGNORE_START,
  applySpecFirstGitignoreBlock,
  buildSpecFirstGitignoreBlock,
  getSpecFirstGitignorePatterns,
};
