'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validateAgainstSchema } = require('../../src/contracts/schema-validator');

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

function isExactRepoRelativePath(filePath) {
  return Boolean(filePath)
    && !filePath.startsWith('/')
    && !filePath.startsWith('~')
    && !filePath.includes('\\')
    && !filePath.includes('//')
    && !filePath.split('/').includes('.')
    && !filePath.split('/').includes('..')
    && !/[*?[\]{}]/.test(filePath);
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
    expect(schema.properties.allowlist.items.pattern).toContain('(?!/)');
    expect(schema.properties.allowlist.items.description).toContain('Exact repo-relative paths only');
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
      'id_ed25519*',
      '*.p12',
      '*.pfx',
      '*.keystore',
      '.npmrc',
      '.pypirc',
      '.netrc',
      '.git-credentials',
      '.aws/credentials',
      '.aws/config',
      'google-services.json',
      'GoogleService-Info.plist',
      '*serviceAccount*.json',
      'firebase-adminsdk-*.json',
      '**/*token*',
      '**/*secret*',
      '**/*credentials*',
      '**/*password*',
      '**/*apikey*',
      '**/*api_key*',
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
    expect(isDenied(contract, 'certs/prod.p12')).toBe(true);
    expect(isDenied(contract, 'android/release.keystore')).toBe(true);
    expect(isDenied(contract, 'config/api_token.txt')).toBe(true);
    expect(isDenied(contract, 'config/production_password.txt')).toBe(true);
    expect(isDenied(contract, 'config/mobile_api_key.txt')).toBe(true);
    expect(isDenied(contract, '.npmrc')).toBe(true);
    expect(isDenied(contract, '.netrc')).toBe(true);
    expect(isDenied(contract, '.aws/credentials')).toBe(true);
    expect(isDenied(contract, 'google-services.json')).toBe(true);
    expect(isDenied(contract, 'GoogleService-Info.plist')).toBe(true);
    expect(isDenied(contract, 'firebase-adminsdk-prod.json')).toBe(true);
    expect(isDenied(contract, 'ios/profile.mobileprovision')).toBe(true);

    expect(isDenied(contract, '.env.example')).toBe(false);
    expect(isDenied(contract, '.env.template')).toBe(false);
    expect(isDenied(contract, '.env.sample')).toBe(false);
    expect(isDenied(contract, 'src/index.js')).toBe(false);
  });

  test('allowlist entries are exact repo-relative paths', () => {
    const contract = readJson(CONTRACT_PATH);

    expect(contract.allowlist.every(isExactRepoRelativePath)).toBe(true);
    expect(isExactRepoRelativePath('tests/fixtures/public-token-example.txt')).toBe(true);
    expect(isExactRepoRelativePath('**/*.env')).toBe(false);
    expect(isExactRepoRelativePath('/tmp/.env')).toBe(false);
    expect(isExactRepoRelativePath('./fixtures/token.txt')).toBe(false);
    expect(isExactRepoRelativePath('fixtures/./token.txt')).toBe(false);
    expect(isExactRepoRelativePath('../.env')).toBe(false);
    expect(isExactRepoRelativePath('~/.npmrc')).toBe(false);
  });

  test('schema rejects unsafe allowlist entries', () => {
    const contract = readJson(CONTRACT_PATH);
    const schema = readJson(SCHEMA_PATH);

    for (const unsafePath of ['**/*.env', '/tmp/.env', './fixtures/token.txt', 'fixtures/./token.txt', '../.env', '~/.npmrc', 'fixtures\\token.txt']) {
      const result = validateAgainstSchema(schema, {
        ...contract,
        allowlist: [unsafePath],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringContaining('root.allowlist[0]: value'),
      ]));
    }
  });
});
