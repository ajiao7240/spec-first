#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { parseSkillMarkdown } = require('./lib/markdown');
const { repoRelative } = require('./lib/path-rules');

function parseSkillMarkdownFile(filePath, options = {}) {
  const absoluteFilePath = path.resolve(filePath);
  const repoRoot = path.resolve(options.repoRoot || findRepoRoot(absoluteFilePath));
  const skillDir = path.resolve(options.skillDir || path.dirname(absoluteFilePath));
  const content = fs.readFileSync(absoluteFilePath, 'utf8');
  const parsed = parseSkillMarkdown(content, { skillDir, repoRoot });

  return {
    schema_version: 'spec-skill-audit.parsed-skill.v1',
    file: repoRelative(repoRoot, absoluteFilePath),
    frontmatter: parsed.frontmatter,
    has_frontmatter: parsed.has_frontmatter,
    headings: parsed.headings,
    sections: normalizeSections(parsed.sections).map((section) => ({
      title: section.title,
      normalized: section.normalized,
      level: section.level,
      start_line: section.start_line,
      end_line: section.end_line,
      text: section.text,
    })),
    links: parsed.links.map((link) => ({
      ...link,
      exists: fs.existsSync(path.join(repoRoot, link.resolved_path)),
    })),
    code_blocks: parsed.code_blocks.map((block) => ({
      language: block.language,
      line: block.line,
    })),
    path_references: parsed.path_references,
    declared_inputs: parsed.declared_inputs,
    declared_outputs: parsed.declared_outputs,
    estimated_tokens: parsed.estimated_tokens,
    parser_warnings: parsed.parser_warnings,
  };
}

function normalizeSections(sections) {
  return Array.isArray(sections) ? sections : Object.values(sections || {});
}

function findRepoRoot(startPath) {
  let current = fs.statSync(startPath).isDirectory() ? startPath : path.dirname(startPath);
  while (current && current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, 'package.json')) || fs.existsSync(path.join(current, '.git'))) {
      return current;
    }
    current = path.dirname(current);
  }
  return process.cwd();
}

function parseArgs(argv) {
  const args = { repoRoot: process.cwd(), filePath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--repo') {
      args.repoRoot = argv[index + 1];
      index += 1;
    } else if (token === '--file') {
      args.filePath = argv[index + 1];
      index += 1;
    } else if (!token.startsWith('--')) {
      args.filePath = token;
    }
  }
  return args;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args.filePath) {
    throw new Error('Usage: node parse-skill-md.js --file <SKILL.md> [--repo <repo-root>]');
  }
  const result = parseSkillMarkdownFile(path.resolve(args.repoRoot, args.filePath), { repoRoot: args.repoRoot });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  parseSkillMarkdownFile,
};
