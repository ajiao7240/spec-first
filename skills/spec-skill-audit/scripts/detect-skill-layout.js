#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { repoRelative, resolveTarget, toPosixPath } = require('./lib/path-rules');

function detectSkillLayout(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const targetPath = path.resolve(resolveTarget(repoRoot, options.targetPath || '.'));
  const packagePath = path.join(repoRoot, 'package.json');
  const skillsRoot = path.join(repoRoot, 'skills');
  const isSpecFirstRepo = isSpecFirstPackage(packagePath) && fs.existsSync(skillsRoot);
  const targetHasSkill = fs.existsSync(path.join(targetPath, 'SKILL.md'));
  const targetSkillDirs = targetHasSkill ? [targetPath] : listSkillDirs(targetPath);

  let mode = 'no_skills';
  if (isSpecFirstRepo && targetPath === repoRoot) {
    mode = 'self';
  } else if (targetHasSkill) {
    mode = 'single';
  } else if (targetSkillDirs.length > 0) {
    mode = isSpecFirstRepo && targetPath === skillsRoot ? 'self' : 'generic';
  }

  return {
    schema_version: 'spec-skill-audit.layout.v1',
    mode,
    root: repoRelative(repoRoot, targetPath) || '.',
    absolute_root: targetPath,
    repo_root: repoRoot,
    is_spec_first_repo: isSpecFirstRepo,
    source_skill_root: fs.existsSync(skillsRoot) ? 'skills' : null,
    has_governance_contract: fs.existsSync(path.join(
      repoRoot,
      'src',
      'cli',
      'contracts',
      'dual-host-governance',
      'skills-governance.json',
    )),
    skill_dirs: targetSkillDirs
      .map((skillDir) => repoRelative(repoRoot, skillDir))
      .sort((left, right) => left.localeCompare(right)),
  };
}

function listSkillDirs(rootPath) {
  if (!fs.existsSync(rootPath)) return [];

  return fs
    .readdirSync(rootPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(rootPath, entry.name))
    .filter((skillDir) => fs.existsSync(path.join(skillDir, 'SKILL.md')))
    .sort((left, right) => left.localeCompare(right));
}

function isSpecFirstPackage(packagePath) {
  if (!fs.existsSync(packagePath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return pkg && pkg.name === 'spec-first';
  } catch (_error) {
    return false;
  }
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
  const result = detectSkillLayout(parseArgs(argv));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  detectSkillLayout,
  listSkillDirs,
};
