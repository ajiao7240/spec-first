'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SOLUTIONS_ROOT = path.join(REPO_ROOT, 'docs/solutions');
const VALID_CATEGORIES = new Set([
  'build-errors',
  'test-failures',
  'runtime-errors',
  'performance-issues',
  'database-issues',
  'security-issues',
  'ui-bugs',
  'integration-issues',
  'logic-errors',
  'developer-experience',
  'workflow-issues',
  'best-practices',
  'documentation-gaps',
  'tooling-decisions',
  'patterns',
  'architecture-patterns',
  'conventions',
]);
const KNOWLEDGE_TYPES = new Set([
  'best_practice',
  'documentation_gap',
  'workflow_issue',
  'developer_experience',
  'tooling_decision',
  'architecture_pattern',
]);
const BUG_TYPES = new Set([
  'build_error',
  'test_failure',
  'runtime_error',
  'performance_issue',
  'database_issue',
  'security_issue',
  'ui_bug',
  'integration_issue',
  'logic_error',
]);

function listMarkdownFiles(rootPath) {
  const results = [];

  function walk(currentPath) {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
        results.push(entryPath);
      }
    }
  }

  walk(rootPath);
  return results.sort();
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    return null;
  }

  const raw = match[1];
  const fields = new Map();
  for (const line of raw.split('\n')) {
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (kv) {
      fields.set(kv[1], kv[2].trim());
    }
  }

  return { raw, fields };
}

describe('docs/solutions contracts', () => {
  test('docs/solutions only contains valid solution docs', () => {
    const files = listMarkdownFiles(SOLUTIONS_ROOT);

    for (const filePath of files) {
      expect(VALID_CATEGORIES.has(path.basename(path.dirname(filePath)))).toBe(true);
    }
  });

  test('knowledge and bug docs follow their respective frontmatter and section contracts', () => {
    const files = listMarkdownFiles(SOLUTIONS_ROOT);

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf8');
      const frontmatter = parseFrontmatter(content);
      expect(frontmatter).not.toBeNull();

      const problemType = frontmatter.fields.get('problem_type');
      expect(problemType).toBeTruthy();

      if (KNOWLEDGE_TYPES.has(problemType)) {
        expect(frontmatter.raw).toContain('applies_when:');
        expect(content).toContain('## Context');
        expect(content).toContain('## Guidance');
        expect(content).toContain('## Why This Matters');
        expect(content).toContain('## When to Apply');
        expect(content).toContain('## Examples');
      }

      if (BUG_TYPES.has(problemType)) {
        expect(frontmatter.raw).toContain('symptoms:');
        expect(frontmatter.fields.has('root_cause')).toBe(true);
        expect(frontmatter.fields.has('resolution_type')).toBe(true);
        expect(content).toContain('## Problem');
        expect(content).toContain('## Symptoms');
        expect(content).toContain('## What Didn\'t Work');
        expect(content).toContain('## Solution');
        expect(content).toContain('## Why This Works');
        expect(content).toContain('## Prevention');
      }
    }
  });

  test('knowledge-track frontmatter still allows optional diagnostic fields', () => {
    const frontmatter = parseFrontmatter(`---
title: Example
date: 2026-04-15
category: docs/solutions/workflow-issues
module: spec-first
problem_type: workflow_issue
component: documentation
severity: medium
applies_when:
  - when a workflow is being upgraded
symptoms:
  - stale workflow folders remain after init
root_cause: missing_workflow_step
resolution_type: workflow_improvement
tags: [workflow, upgrade]
---

# Example
`);

    expect(frontmatter).not.toBeNull();
    expect(frontmatter.fields.get('problem_type')).toBe('workflow_issue');
    expect(frontmatter.raw).toContain('symptoms:');
    expect(frontmatter.fields.get('root_cause')).toBe('missing_workflow_step');
    expect(frontmatter.fields.get('resolution_type')).toBe('workflow_improvement');
  });
});
