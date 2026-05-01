#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { detectSkillLayout } = require('./detect-skill-layout');
const { parseSkillMarkdownFile } = require('./parse-skill-md');
const { repoRelative, toPosixPath } = require('./lib/path-rules');

const RESOURCE_DIRS = ['scripts', 'references', 'examples', 'assets', 'evals'];

function collectSkillFacts(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const layout = options.layout || detectSkillLayout({
    repoRoot,
    targetPath: options.targetPath || '.',
  });
  const skillDirs = resolveSkillDirs(repoRoot, layout);
  const skills = skillDirs.map((skillDir) => collectSingleSkill(repoRoot, skillDir));

  return {
    schema_version: 'spec-first.skill-source-inventory.v1',
    generated_at: new Date().toISOString(),
    mode: layout.mode,
    repo_root: repoRoot,
    source_root: layout.source_skill_root,
    layout,
    skills,
  };
}

function collectSingleSkill(repoRoot, skillDir) {
  const skillId = path.basename(skillDir);
  const skillFile = path.join(skillDir, 'SKILL.md');
  const hasSkillMd = fs.existsSync(skillFile);
  const parsed = hasSkillMd
    ? parseSkillMarkdownFile(skillFile, { repoRoot, skillDir })
    : emptyParsedSkill(repoRoot, skillFile);
  const resourceDirs = Object.fromEntries(RESOURCE_DIRS.map((dirName) => {
    const absoluteDir = path.join(skillDir, dirName);
    return [dirName, {
      exists: fs.existsSync(absoluteDir),
      files: fs.existsSync(absoluteDir) ? listFiles(repoRoot, absoluteDir) : [],
    }];
  }));

  return {
    skill_id: skillId,
    source_path: repoRelative(repoRoot, skillDir),
    skill_file: repoRelative(repoRoot, skillFile),
    has_skill_md: hasSkillMd,
    frontmatter: parsed.frontmatter,
    has_frontmatter: parsed.has_frontmatter,
    sections: parsed.sections,
    headings: parsed.headings,
    local_links: parsed.links,
    path_references: parsed.path_references,
    declared_inputs: parsed.declared_inputs,
    declared_outputs: parsed.declared_outputs,
    has_scripts: resourceDirs.scripts.exists,
    has_references: resourceDirs.references.exists,
    has_examples: resourceDirs.examples.exists,
    has_assets: resourceDirs.assets.exists,
    has_evals: resourceDirs.evals.exists,
    resources: resourceDirs,
    estimated_tokens: parsed.estimated_tokens,
    parser_warnings: parsed.parser_warnings,
    body_excerpt: hasSkillMd ? fs.readFileSync(skillFile, 'utf8').slice(0, 1200) : '',
  };
}

function resolveSkillDirs(repoRoot, layout) {
  if (layout.mode === 'self') {
    return fs
      .readdirSync(path.join(repoRoot, 'skills'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(repoRoot, 'skills', entry.name))
      .sort((left, right) => left.localeCompare(right));
  }

  return (layout.skill_dirs || [])
    .map((skillDir) => path.resolve(repoRoot, skillDir))
    .sort((left, right) => left.localeCompare(right));
}

function listFiles(repoRoot, rootPath) {
  const files = [];

  function walk(currentPath) {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }
      if (entry.isFile()) {
        files.push(toPosixPath(repoRelative(repoRoot, entryPath)));
      }
    }
  }

  walk(rootPath);
  return files.sort((left, right) => left.localeCompare(right));
}

function emptyParsedSkill(repoRoot, skillFile) {
  return {
    schema_version: 'spec-skill-audit.parsed-skill.v1',
    file: repoRelative(repoRoot, skillFile),
    frontmatter: {},
    has_frontmatter: false,
    headings: [],
    sections: [],
    links: [],
    path_references: [],
    declared_inputs: [],
    declared_outputs: [],
    estimated_tokens: 0,
    parser_warnings: [{ code: 'MISSING_SKILL_MD' }],
  };
}

function parseArgs(argv) {
  const args = { repoRoot: process.cwd(), targetPath: '.' };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--repo') {
      args.repoRoot = argv[index + 1];
      index += 1;
    } else if (token === '--target') {
      args.targetPath = argv[index + 1];
      index += 1;
    } else if (!token.startsWith('--')) {
      args.targetPath = token;
    }
  }
  return args;
}

function main(argv = process.argv.slice(2)) {
  const result = collectSkillFacts(parseArgs(argv));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  collectSkillFacts,
  collectSingleSkill,
};
