#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { createFinding } = require('./lib/finding');
const { classifyPatternContext, DANGEROUS_PATTERNS } = require('./lib/security-patterns');
const { repoRelative } = require('./lib/path-rules');

const SCANNED_EXTENSIONS = new Set(['.md', '.js', '.cjs', '.mjs', '.sh', '.ps1', '.py', '.json', '.yaml', '.yml']);

function scanInstructionSecurity(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const inventory = options.inventory || {};
  const findings = [];

  for (const skill of inventory.skills || []) {
    const sourcePath = resolveInventorySkillPath(repoRoot, skill.source_path);
    const files = listScannableFiles(sourcePath);
    for (const filePath of files) {
      findings.push(...scanFile(repoRoot, skill.skill_id, filePath));
    }
  }

  return findings;
}

function scanFile(repoRoot, skillId, filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const findings = [];
  let currentHeading = '';

  lines.forEach((line, index) => {
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      currentHeading = heading[2].trim().toLowerCase();
    }

    for (const pattern of DANGEROUS_PATTERNS) {
      if (!pattern.regex.test(line)) continue;

      const context = classifyScanContext(filePath, currentHeading, line);
      findings.push(createFinding({
        severity: context.severityOverride || pattern.severity,
        category: pattern.category,
        skill_id: skillId,
        title: pattern.title,
        evidence: [{
          file: repoRelative(repoRoot, filePath),
          line: index + 1,
          excerpt: line.trim().slice(0, 240),
        }],
        reason: context.context === 'actionable_pattern'
          ? `Matched ${pattern.code} in executable or instructional content.`
          : `Matched ${pattern.code} as a documented or prohibited risk pattern.`,
        recommendation: pattern.recommendation,
        confidence: context.confidence,
        source: 'security-pattern-scan',
        fix_mode: pattern.code === 'GENERATED_RUNTIME_WRITE' ? 'human-decision' : 'human-decision',
      }));
    }
  });

  return findings;
}

function classifyFileContext(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (
    normalized.includes('/references/')
    || normalized.includes('/evals/')
    || normalized.includes('/examples/')
  ) {
    return {
      context: 'documented_pattern',
      severityOverride: 'P3',
      confidence: 'medium',
    };
  }
  return null;
}

function classifySectionContext(currentHeading, line) {
  const heading = String(currentHeading || '');
  if (
    heading.includes('when not')
    || heading.includes('do not')
    || heading.includes('not to use')
  ) {
    if (hasExecutableExceptionCue(line)) return null;
    return {
      context: 'prohibited_pattern',
      severityOverride: 'P3',
      confidence: 'medium',
    };
  }
  return null;
}

function classifyScanContext(filePath, currentHeading, line) {
  const lineContext = classifyPatternContext(line);
  if (lineContext.context !== 'actionable_pattern') {
    return lineContext;
  }

  const fileContext = classifyFileContext(filePath);
  if (fileContext) return fileContext;

  const sectionContext = classifySectionContext(currentHeading, line);
  if (sectionContext) return sectionContext;

  return lineContext;
}

function hasExecutableExceptionCue(line) {
  return /(?:\b(?:exception|except|unless|if\s+(?:the\s+)?user\s+(?:asks|insists|confirms|requests)|if\s+forced|if\s+needed)\b|例外|除非)/i.test(String(line || ''));
}

function resolveInventorySkillPath(repoRoot, sourcePath) {
  if (typeof sourcePath !== 'string' || sourcePath.length === 0) {
    throw new Error('Invalid skill inventory: source_path is required.');
  }
  if (path.isAbsolute(sourcePath)) {
    throw new Error(`Invalid skill inventory source_path "${sourcePath}": absolute paths are not allowed.`);
  }

  const skillsRoot = path.resolve(repoRoot, 'skills');
  const resolvedPath = path.resolve(repoRoot, sourcePath);
  if (!isPathInside(skillsRoot, resolvedPath)) {
    throw new Error(`Invalid skill inventory source_path "${sourcePath}": path must stay under skills/.`);
  }
  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
    throw new Error(`Invalid skill inventory source_path "${sourcePath}": directory does not exist.`);
  }

  const realSkillsRoot = fs.existsSync(skillsRoot) ? fs.realpathSync(skillsRoot) : skillsRoot;
  const realSourcePath = fs.realpathSync(resolvedPath);
  if (!isPathInside(realSkillsRoot, realSourcePath)) {
    throw new Error(`Invalid skill inventory source_path "${sourcePath}": resolved path must stay under skills/.`);
  }

  return resolvedPath;
}

function isPathInside(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function listScannableFiles(rootPath) {
  const files = [];
  if (!fs.existsSync(rootPath)) return files;

  function walk(currentPath) {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }
      if (isDetectorOwnSource(entryPath)) continue;
      if (entry.isFile() && SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(entryPath);
      }
    }
  }

  walk(rootPath);
  return files.sort((left, right) => left.localeCompare(right));
}

// 只排除审计器自己的 regex catalog；其他 skill 中同名文件仍按源文件扫描。
function isDetectorOwnSource(filePath) {
  return filePath.replace(/\\/g, '/').endsWith('skills/spec-skill-audit/scripts/lib/security-patterns.js');
}

function buildSecurityReport(findings) {
  return {
    schema_version: 'spec-first.security-risk-report.v1',
    generated_at: new Date().toISOString(),
    summary: {
      p0_count: findings.filter((finding) => finding.severity === 'P0').length,
      p1_count: findings.filter((finding) => finding.severity === 'P1').length,
      p2_count: findings.filter((finding) => finding.severity === 'P2').length,
      p3_count: findings.filter((finding) => finding.severity === 'P3').length,
    },
    findings,
  };
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const inventory = JSON.parse(fs.readFileSync(args.inventory, 'utf8'));
  const findings = scanInstructionSecurity({ repoRoot: args.repoRoot, inventory });
  process.stdout.write(`${JSON.stringify(buildSecurityReport(findings), null, 2)}\n`);
}

function parseArgs(argv) {
  const args = { repoRoot: process.cwd(), inventory: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--repo') {
      args.repoRoot = argv[index + 1];
      index += 1;
    } else if (token === '--inventory') {
      args.inventory = argv[index + 1];
      index += 1;
    } else if (!token.startsWith('--')) {
      args.inventory = token;
    }
  }
  if (!args.inventory) throw new Error('Usage: node scan-instruction-security.js --inventory <inventory.json> [--repo <repo-root>]');
  return args;
}

if (require.main === module) {
  main();
}

module.exports = {
  buildSecurityReport,
  classifyFileContext,
  classifyScanContext,
  classifySectionContext,
  hasExecutableExceptionCue,
  listScannableFiles,
  resolveInventorySkillPath,
  scanFile,
  scanInstructionSecurity,
};
