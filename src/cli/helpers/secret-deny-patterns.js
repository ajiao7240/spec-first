'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_CONTRACT_PATH = path.join(__dirname, '..', 'contracts', 'security', 'secret-deny-patterns.json');

function readContract(contractPath = DEFAULT_CONTRACT_PATH) {
  return JSON.parse(fs.readFileSync(contractPath, 'utf8'));
}

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegex(glob, options = {}) {
  let source = '';
  for (let index = 0; index < glob.length; index += 1) {
    if (glob.startsWith('**/', index)) {
      source += '(?:.*/)?';
      index += 2;
      continue;
    }
    if (glob.startsWith('**', index)) {
      source += '.*';
      index += 1;
      continue;
    }
    if (glob[index] === '*') {
      source += '[^/]*';
      continue;
    }
    source += escapeRegex(glob[index]);
  }
  if (!glob.includes('/')) {
    source = `(?:^|.*/)${source}`;
  }
  return new RegExp(`^${source}$`, options.caseInsensitive ? 'i' : '');
}

function normalizeRepoPath(filePath) {
  return String(filePath || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function isExactRepoRelativePath(filePath) {
  const raw = String(filePath || '');
  const normalized = normalizeRepoPath(filePath);
  return Boolean(normalized)
    && normalized !== '.'
    && !normalized.startsWith('/')
    && !raw.startsWith('./')
    && !normalized.startsWith('~')
    && !normalized.includes(':')
    && !raw.includes('\\')
    && !normalized.includes('//')
    && !normalized.split('/').includes('.')
    && !normalized.split('/').includes('..')
    && !/[*?[\]{}]/.test(normalized);
}

function isSecretDeniedPath(filePath, contract = readContract()) {
  const normalized = normalizeRepoPath(filePath);
  if (!normalized) return false;
  if (contract.exclusions.some((pattern) => globToRegex(pattern, { caseInsensitive: true }).test(normalized))) {
    return false;
  }
  if ((contract.allowlist || []).includes(normalized)) {
    return false;
  }
  return (contract.patterns || []).some((entry) =>
    (entry.match || []).some((pattern) =>
      globToRegex(pattern, { caseInsensitive: entry.case_insensitive === true }).test(normalized),
    ),
  );
}

function runCli(argv) {
  const [command, value] = argv;
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write('Usage: secret-deny-patterns.js <is-denied|is-exact-repo-relative> <path>\n');
    return 0;
  }
  if (!value) {
    process.stderr.write('secret-deny-patterns: missing path\n');
    return 2;
  }
  if (command === 'is-denied') {
    return isSecretDeniedPath(value) ? 0 : 1;
  }
  if (command === 'is-exact-repo-relative') {
    return isExactRepoRelativePath(value) ? 0 : 1;
  }
  process.stderr.write(`secret-deny-patterns: unknown command ${command}\n`);
  return 2;
}

if (require.main === module) {
  process.exitCode = runCli(process.argv.slice(2));
}

module.exports = {
  DEFAULT_CONTRACT_PATH,
  globToRegex,
  isExactRepoRelativePath,
  isSecretDeniedPath,
  normalizeRepoPath,
  readContract,
  runCli,
};
