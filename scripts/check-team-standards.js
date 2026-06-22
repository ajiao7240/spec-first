#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');
const DEFAULT_TARGETS = [
  'docs/standards/candidates',
  'skills/spec-team-standards-governance/evals',
  'docs/validation/standards-governance',
];
const ALL_TARGETS = [
  'docs/standards',
  'skills/spec-team-standards-governance',
  'docs/validation/standards-governance',
];
const TEXT_EXTENSIONS = new Set(['.md', '.json', '.yaml', '.yml', '.txt']);
const EXCLUDED_BASENAMES = new Set(['README.md']);

const CHECKS = [
  {
    id: 'secret-pattern',
    regex: /\b(api[_-]?key|secret|password|token|credential)\b\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{16,}/i,
  },
  {
    id: 'pii-email',
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  },
  {
    id: 'local-absolute-path',
    regex: /(^|[\s"'([])(\/(?:Users|home|tmp|var\/folders|var\/tmp|Volumes)\/|\/private\/(?:tmp|var\/folders|var\/tmp)\/|[A-Za-z]:\\)/,
  },
  {
    id: 'prompt-injection-text',
    regex: /(ignore (all )?(previous|higher|system) instructions|skip validation|modify generated runtime mirrors|忽略(上层|系统|之前)指令|跳过验证|修改 generated runtime mirror)/i,
  },
];

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/');
}

function repoRelative(filePath) {
  return toPosix(path.relative(REPO_ROOT, filePath));
}

function collectFiles(targets, options = {}) {
  const files = [];
  for (const target of targets) {
    const absoluteTarget = path.resolve(REPO_ROOT, target);
    if (!absoluteTarget.startsWith(REPO_ROOT + path.sep) && absoluteTarget !== REPO_ROOT) {
      throw new Error(`target outside repo: ${target}`);
    }
    if (!fs.existsSync(absoluteTarget)) continue;
    const stat = fs.statSync(absoluteTarget);
    if (stat.isDirectory()) {
      walk(absoluteTarget, files, options);
    } else if (isTextFile(absoluteTarget, options)) {
      files.push(absoluteTarget);
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function walk(dirPath, files, options) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files, options);
      continue;
    }
    if (entry.isFile() && isTextFile(fullPath, options)) {
      files.push(fullPath);
    }
  }
}

function isTextFile(filePath, options = {}) {
  if (!TEXT_EXTENSIONS.has(path.extname(filePath))) return false;
  if (options.includeReadme !== true && EXCLUDED_BASENAMES.has(path.basename(filePath))) {
    return false;
  }
  return true;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return scanText(content, repoRelative(filePath));
}

function scanText(content, file = 'input') {
  const findings = [];
  const lines = String(content || '').split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const check of CHECKS) {
      if (check.regex.test(line)) {
        findings.push({
          file,
          line: index + 1,
          code: check.id,
        });
      }
    }
  }
  return findings;
}

function runTeamStandardsHygiene(options = {}) {
  const targets = options.targets && options.targets.length > 0
    ? options.targets
    : options.all
      ? ALL_TARGETS
      : DEFAULT_TARGETS;
  const files = collectFiles(targets, { includeReadme: options.includeReadme });
  const findings = files.flatMap(scanFile);
  return {
    ok: findings.length === 0,
    scanned_files: files.map(repoRelative),
    findings,
  };
}

function parseArgs(argv) {
  const options = { targets: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--all') {
      options.all = true;
    } else if (arg === '--include-readme') {
      options.includeReadme = true;
    } else if (arg === '--target') {
      options.targets.push(argv[++index]);
    } else {
      options.targets.push(arg);
    }
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = runTeamStandardsHygiene(options);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (result.ok) {
    process.stdout.write(`team standards hygiene passed (${result.scanned_files.length} files scanned)\n`);
  } else {
    process.stderr.write(`team standards hygiene failed:\n${JSON.stringify(result.findings, null, 2)}\n`);
  }
  if (!result.ok) process.exitCode = 1;
}

if (require.main === module) {
  main();
}

module.exports = {
  CHECKS,
  collectFiles,
  runTeamStandardsHygiene,
  scanText,
};
