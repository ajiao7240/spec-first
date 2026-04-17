#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { loadSkillsGovernance } = require('../src/cli/plugin');

const REPO_ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(__dirname, 'lint-skill-entrypoints.config.json');
const DEFAULT_MARKDOWN_EXTENSIONS = ['.md'];

function loadConfig() {
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  return {
    scanRoots: Array.isArray(raw.scanRoots) ? raw.scanRoots : [],
    markdownExtensions: Array.isArray(raw.markdownExtensions) && raw.markdownExtensions.length > 0
      ? raw.markdownExtensions
      : DEFAULT_MARKDOWN_EXTENSIONS,
    ignoredLineContains: Array.isArray(raw.ignoredLineContains) ? raw.ignoredLineContains : [],
    blockedPatterns: Array.isArray(raw.blockedPatterns) ? raw.blockedPatterns : [],
    warnPatterns: Array.isArray(raw.warnPatterns) ? raw.warnPatterns : [],
  };
}

function buildRules(config = loadConfig(), governance = loadSkillsGovernance()) {
  const rules = config.blockedPatterns.map((rule) => ({
    id: rule.id,
    severity: 'error',
    regex: new RegExp(rule.pattern),
    message: rule.message,
  }));

  for (const rule of config.warnPatterns) {
    rules.push({
      id: rule.id,
      severity: 'warning',
      regex: new RegExp(rule.pattern),
      message: rule.message,
    });
  }

  rules.push({
    id: 'standalone-slash-command',
    severity: 'error',
    regex: buildStandaloneSlashCommandPattern(governance),
    message: 'Standalone skills must be described as skills, not slash commands.',
  });

  return rules;
}

function buildStandaloneSlashCommandPattern(governance = loadSkillsGovernance()) {
  const standaloneSkillNames = governance.skills
    .filter((record) => record.entry_surface === 'standalone_skill')
    .map((record) => record.skill_name)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex);

  return new RegExp(
    `(^|[^A-Za-z0-9_.:-])/(${standaloneSkillNames.join('|')})(?=$|[^A-Za-z0-9.-])`,
  );
}

function analyzeContent(content, filePath, options = {}) {
  const config = options.config || loadConfig();
  const rules = options.rules || buildRules(config, options.governance || loadSkillsGovernance());
  const findings = [];
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (config.ignoredLineContains.some((fragment) => line.includes(fragment))) {
      continue;
    }

    for (const rule of rules) {
      if (!rule.regex.test(line)) {
        continue;
      }

      findings.push({
        ruleId: rule.id,
        severity: rule.severity,
        filePath,
        line: index + 1,
        message: rule.message,
        content: line,
      });
    }
  }

  return findings;
}

function analyzeFiles(filePaths, options = {}) {
  const config = options.config || loadConfig();
  const governance = options.governance || loadSkillsGovernance();
  const rules = options.rules || buildRules(config, governance);

  return filePaths.flatMap((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    return analyzeContent(content, filePath, { config, governance, rules });
  });
}

function collectFiles(config = loadConfig()) {
  const files = [];

  for (const scanRoot of config.scanRoots) {
    const absoluteRoot = path.join(REPO_ROOT, scanRoot);
    if (!fs.existsSync(absoluteRoot)) {
      continue;
    }

    walk(absoluteRoot, (filePath) => {
      if (config.markdownExtensions.includes(path.extname(filePath))) {
        files.push(filePath);
      }
    });
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function walk(currentPath, onFile) {
  for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
    const nextPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      walk(nextPath, onFile);
      continue;
    }

    if (entry.isFile()) {
      onFile(nextPath);
    }
  }
}

function formatFindings(findings) {
  return findings
    .map((finding) => {
      const relativePath = path.relative(REPO_ROOT, finding.filePath);
      return `${finding.severity.toUpperCase()} [${finding.ruleId}] ${relativePath}:${finding.line} ${finding.message}\n  ${finding.content.trim()}`;
    })
    .join('\n');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function main() {
  const config = loadConfig();
  const governance = loadSkillsGovernance();
  const rules = buildRules(config, governance);
  const files = collectFiles(config);
  const findings = analyzeFiles(files, { config, governance, rules });
  const errors = findings.filter((finding) => finding.severity === 'error');
  const warnings = findings.filter((finding) => finding.severity === 'warning');

  if (errors.length > 0) {
    console.error('skill entrypoint lint failed:\n');
    console.error(formatFindings(errors));
    if (warnings.length > 0) {
      console.error('\nWarnings:\n');
      console.error(formatFindings(warnings));
    }
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.log('skill entrypoint lint warnings:\n');
    console.log(formatFindings(warnings));
  }

  console.log(`skill entrypoint lint passed (${files.length} files scanned)`);
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzeContent,
  analyzeFiles,
  buildRules,
  buildStandaloneSlashCommandPattern,
  collectFiles,
  loadConfig,
};
