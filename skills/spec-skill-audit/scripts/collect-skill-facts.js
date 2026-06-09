#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { detectSkillLayout } = require('./detect-skill-layout');
const { parseSkillMarkdownFile } = require('./parse-skill-md');
const { repoRelative, toPosixPath } = require('./lib/path-rules');

const RESOURCE_DIRS = ['scripts', 'references', 'examples', 'assets', 'evals'];
const REVIEWER_AGENT_PATTERN = /^spec-.*-reviewer\.agent\.md$/;
const CODE_REVIEW_CATALOG_PATH = path.join('skills', 'spec-code-review', 'SKILL.md');
const DOC_REVIEW_CATALOG_PATH = path.join('skills', 'spec-doc-review', 'SKILL.md');
const REVIEW_SCOPE_PATTERNS = [
  ['what-youre-hunting-for', /^##\s+What you're hunting for\s*$/im],
  ['what-you-check', /^##\s+What you check\s*$/im],
  ['core-principles', /^##\s+Core Principles\s*$/im],
  ['analysis-protocol', /^##\s+Analysis protocol\s*$/im],
  ['review-process', /^##\s+Review Process\s*$/im],
  ['dimensional-rating', /^##\s+Dimensional rating\s*$/im],
  ['your-workflow', /^##\s+Your Workflow\s*$/im],
  ['step-evaluate', /^##\s+Step \d+:\s+Evaluate/im],
  ['reviewing-code-list', /When reviewing code, you will:/i],
  ['primary-responsibility', /Your primary responsibility is/i],
  ['you-review-scope', /\bYou review (?:code|plans|planning documents|CLI|source code|requirements)/i],
  ['you-evaluate-scope', /\bYou evaluate (?:CLI|planning documents|plans|code)/i],
  ['you-challenge-scope', /\bYou challenge plans/i],
];

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

function collectReviewerGuardCoverage(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const agentsRoot = path.join(repoRoot, 'agents');
  const codeReviewCatalog = readTextIfExists(path.join(repoRoot, CODE_REVIEW_CATALOG_PATH));
  const docReviewCatalog = readTextIfExists(path.join(repoRoot, DOC_REVIEW_CATALOG_PATH));
  const reviewers = fs.existsSync(agentsRoot)
    ? fs
      .readdirSync(agentsRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && REVIEWER_AGENT_PATTERN.test(entry.name))
      .map((entry) => collectSingleReviewer(repoRoot, path.join(agentsRoot, entry.name), {
        codeReviewCatalog,
        docReviewCatalog,
      }))
      .sort((left, right) => left.agent_id.localeCompare(right.agent_id))
    : [];

  return {
    schema_version: 'spec-first.reviewer-guard-coverage-report.v1',
    generated_at: new Date().toISOString(),
    producer: 'skills/spec-skill-audit/scripts/collect-skill-facts.js',
    consumer: 'skills/spec-skill-audit/references/expert-audit-rubric.md',
    authority_level: 'deterministic-facts',
    note: 'Reports section-presence facts only. LLM review decides whether missing or mismatched guard coverage is a real issue or N/A.',
    catalog_sources: {
      code_review: CODE_REVIEW_CATALOG_PATH,
      doc_review: DOC_REVIEW_CATALOG_PATH,
    },
    totals: {
      reviewers: reviewers.length,
      with_hunting_section: reviewers.filter((reviewer) => reviewer.has_hunting_section).length,
      with_guard_section: reviewers.filter((reviewer) => reviewer.has_guard_section).length,
      in_code_review_catalog: reviewers.filter((reviewer) => reviewer.in_code_review_catalog).length,
      in_doc_review_catalog: reviewers.filter((reviewer) => reviewer.in_doc_review_catalog).length,
    },
    reviewers,
  };
}

function collectSingleReviewer(repoRoot, agentFile, catalogs) {
  const content = fs.readFileSync(agentFile, 'utf8');
  const agentId = path.basename(agentFile, '.agent.md');
  const frontmatterName = extractFrontmatterName(content) || agentId;
  const huntingSectionSignal = detectReviewScopeSignal(content);
  const aliases = new Set([
    agentId,
    frontmatterName,
    agentId.replace(/^spec-/, ''),
    frontmatterName.replace(/^spec-/, ''),
  ].filter(Boolean));

  return {
    agent_id: agentId,
    frontmatter_name: frontmatterName,
    source_path: repoRelative(repoRoot, agentFile),
    has_hunting_section: Boolean(huntingSectionSignal),
    hunting_section_signal: huntingSectionSignal,
    has_guard_section: /^##\s+What you don't flag\s*$/im.test(content),
    in_code_review_catalog: catalogIncludesAny(catalogs.codeReviewCatalog, aliases),
    in_doc_review_catalog: catalogIncludesAny(catalogs.docReviewCatalog, aliases),
  };
}

function detectReviewScopeSignal(content) {
  for (const [signal, pattern] of REVIEW_SCOPE_PATTERNS) {
    if (pattern.test(content)) return signal;
  }
  return null;
}

function extractFrontmatterName(content) {
  const match = /^---\s*[\s\S]*?^name:\s*"?([^"\n]+)"?\s*$/m.exec(content);
  return match ? match[1].trim() : '';
}

function catalogIncludesAny(content, aliases) {
  for (const alias of aliases) {
    if (alias && content.includes(alias)) return true;
  }
  return false;
}

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
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
  collectReviewerGuardCoverage,
  collectSingleSkill,
};
