'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const CONTRACT_PATH = path.join(REPO_ROOT, 'src', 'cli', 'contracts', 'security', 'secret-deny-patterns.json');
const SCHEMA_PATH = path.join(REPO_ROOT, 'src', 'cli', 'contracts', 'security', 'secret-deny-patterns.schema.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegex(glob) {
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
  return new RegExp(`^${source}$`, 'i');
}

function isDenied(contract, filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (contract.exclusions.some((pattern) => globToRegex(pattern).test(normalized))) return false;
  if (contract.allowlist.includes(normalized)) return false;
  return contract.patterns.some((entry) => entry.match.some((pattern) => globToRegex(pattern).test(normalized)));
}

describe('secret deny patterns contract', () => {
  test('schema and contract expose the required root fields', () => {
    const contract = readJson(CONTRACT_PATH);
    const schema = readJson(SCHEMA_PATH);

    expect(contract.version).toBe('secret-deny-patterns.v1');
    expect(Array.isArray(contract.patterns)).toBe(true);
    expect(Array.isArray(contract.allowlist)).toBe(true);
    expect(Array.isArray(contract.exclusions)).toBe(true);

    expect(schema.required).toEqual(['version', 'patterns', 'allowlist', 'exclusions']);
    expect(schema.properties.patterns.items.required).toEqual(['id', 'reason_code', 'match']);
  });

  test('covers env, key, token, cloud credential, and mobile signing surfaces', () => {
    const contract = readJson(CONTRACT_PATH);
    const allPatterns = contract.patterns.flatMap((entry) => entry.match);

    expect(allPatterns).toEqual(expect.arrayContaining([
      '.env',
      '.env.*',
      '*.pem',
      '*.key',
      'id_rsa*',
      '.aws/credentials',
      '.aws/config',
      '**/*token*',
      '**/*secret*',
      '*.mobileprovision',
      '*.cer',
    ]));
    expect(contract.exclusions).toEqual(expect.arrayContaining([
      '.env.example',
      '.env.template',
      '.env.sample',
    ]));
  });

  test('denies representative secret paths while preserving documented exclusions', () => {
    const contract = readJson(CONTRACT_PATH);

    expect(isDenied(contract, '.env')).toBe(true);
    expect(isDenied(contract, '.env.local')).toBe(true);
    expect(isDenied(contract, 'certs/prod.pem')).toBe(true);
    expect(isDenied(contract, 'config/api_token.txt')).toBe(true);
    expect(isDenied(contract, '.aws/credentials')).toBe(true);
    expect(isDenied(contract, 'ios/profile.mobileprovision')).toBe(true);

    expect(isDenied(contract, '.env.example')).toBe(false);
    expect(isDenied(contract, '.env.template')).toBe(false);
    expect(isDenied(contract, 'src/index.js')).toBe(false);
  });
});
