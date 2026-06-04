'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { runInternal } = require('../../src/cli/commands/internal');
const { validateAgainstSchema } = require('../../src/contracts/schema-validator');
const {
  loadVerificationProfile,
  parseLocalYamlProfileAlias,
  resolveProfileChecks,
  validateProfileObject,
} = require('../../src/verification/profile-loader');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'verification', 'verification-profile.schema.json');
const SCAN_CONFIGURED_DEPS = path.join(REPO_ROOT, 'skills', 'spec-mcp-setup', 'scripts', 'scan-configured-deps.cjs');

function makeRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'verification-profile-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Spec First Test'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'spec-first-test@example.invalid'], { cwd: repo });
  return repo;
}

function validProfile() {
  return {
    schema_version: 'verification-profile.v1',
    default_profile: 'default',
    profiles: {
      default: {
        services: ['app'],
        checks: ['typecheck', 'unit'],
      },
    },
    services: {
      app: {
        path: '.',
        stack: 'node',
        required: true,
      },
    },
    stacks: {
      node: {
        detect: ['package.json'],
        commands: {
          typecheck: 'npm run typecheck',
          unit: 'npm run test:unit',
        },
        runner_kind: {
          typecheck: 'npm-script',
          unit: 'npm-script',
        },
        required_tools: {
          typecheck: ['node', 'npm'],
          unit: ['node', 'npm'],
        },
      },
    },
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function captureStdout(fn) {
  const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  try {
    const code = fn();
    const stdout = outputSpy.mock.calls.map((call) => String(call[0])).join('');
    return { code, stdout };
  } finally {
    outputSpy.mockRestore();
  }
}

describe('verification profile contract and loader', () => {
  test('schema validates a canonical explicit profile and rejects unsupported fields', () => {
    const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    const profile = validProfile();
    const invalid = validProfile();
    invalid.productSmoke = {};

    expect(validateAgainstSchema(schema, profile).errors).toEqual([]);
    expect(validateProfileObject(profile).errors).toEqual([]);
    expect(validateAgainstSchema(schema, invalid).errors).toContain('root.productSmoke: unexpected additional key');
  });

  test('loads explicit profile and resolves check commands without executing them', () => {
    const repo = makeRepo();
    try {
      writeJson(path.join(repo, 'spec-first.verification.json'), validProfile());

      const result = loadVerificationProfile({ targetRepo: repo });

      expect(result).toEqual(expect.objectContaining({
        status: 'configured',
        reason_code: 'profile-loaded',
        profile_source: 'explicit',
        profile_path: 'spec-first.verification.json',
      }));
      expect(result.checks).toEqual([
        expect.objectContaining({ id: 'typecheck', command: 'npm run typecheck', service: 'app', runner_kind: 'npm-script', required_tools: ['node', 'npm'] }),
        expect.objectContaining({ id: 'unit', command: 'npm run test:unit', service: 'app', runner_kind: 'npm-script', required_tools: ['node', 'npm'] }),
      ]);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('prefers local JSON override and accepts config.local.yaml alias to that path', () => {
    const repo = makeRepo();
    const teamProfile = validProfile();
    const localProfile = validProfile();
    localProfile.profiles.default.checks = ['unit'];
    try {
      writeJson(path.join(repo, 'spec-first.verification.json'), teamProfile);
      writeJson(path.join(repo, '.spec-first', 'verification-profile.local.json'), localProfile);
      fs.writeFileSync(
        path.join(repo, '.spec-first', 'config.local.yaml'),
        'verification_profile_path: .spec-first/verification-profile.local.json\n',
      );

      expect(parseLocalYamlProfileAlias('verification_profile_path: .spec-first/verification-profile.local.json\n')).toBe(
        '.spec-first/verification-profile.local.json'
      );
      const result = loadVerificationProfile({ targetRepo: repo });

      expect(result.profile_source).toBe('local');
      expect(result.checks.map((check) => check.id)).toEqual(['unit']);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('infers package verification scripts when no profile exists', () => {
    const repo = makeRepo();
    try {
      writeJson(path.join(repo, 'package.json'), {
        name: 'fixture',
        scripts: {
          typecheck: 'tsc --noEmit',
          'test:unit': 'jest',
          setup: 'node setup.js',
        },
      });

      const result = loadVerificationProfile({ targetRepo: repo });

      expect(result).toEqual(expect.objectContaining({
        status: 'configured',
        reason_code: 'profile-inferred',
        profile_source: 'inferred',
        profile_path: 'package.json',
      }));
      expect(result.checks.map((check) => [check.id, check.command])).toEqual([
        ['typecheck', 'npm run typecheck'],
        ['test:unit', 'npm run test:unit'],
      ]);
      expect(result.checks.some((check) => check.id === 'setup')).toBe(false);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('reports not-configured or invalid profiles without crashing', () => {
    const emptyRepo = makeRepo();
    const invalidRepo = makeRepo();
    try {
      writeJson(path.join(emptyRepo, 'package.json'), { name: 'empty', scripts: { setup: 'node setup.js' } });
      writeJson(path.join(invalidRepo, 'spec-first.verification.json'), {
        ...validProfile(),
        schema_version: 'wrong',
      });

      expect(loadVerificationProfile({ targetRepo: emptyRepo })).toEqual(expect.objectContaining({
        status: 'not-configured',
        reason_code: 'verification-scripts-missing',
      }));
      expect(loadVerificationProfile({ targetRepo: invalidRepo })).toEqual(expect.objectContaining({
        status: 'invalid',
        reason_code: 'profile-schema-invalid',
      }));
    } finally {
      fs.rmSync(emptyRepo, { recursive: true, force: true });
      fs.rmSync(invalidRepo, { recursive: true, force: true });
    }
  });

  test('internal CLI exposes the profile loader boundary', () => {
    const repo = makeRepo();
    try {
      writeJson(path.join(repo, 'spec-first.verification.json'), validProfile());

      const { code, stdout } = captureStdout(() => runInternal([
        'verification-profile',
        'load',
        '--target-repo',
        repo,
        '--json',
      ]));
      const output = JSON.parse(stdout);

      expect(code).toBe(0);
      expect(output.status).toBe('configured');
      expect(output.checks.map((check) => check.id)).toEqual(['typecheck', 'unit']);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('scan-configured-deps reads canonical profile commands instead of legacy flat checks', () => {
    const repo = makeRepo();
    try {
      writeJson(path.join(repo, 'spec-first.verification.json'), validProfile());

      const raw = execFileSync('node', [SCAN_CONFIGURED_DEPS, '--repo-root', repo], { encoding: 'utf8' });
      const output = JSON.parse(raw);
      const verificationEntries = output.configured_dependencies.filter((entry) => entry.kind === 'verification-command');

      expect(verificationEntries.map((entry) => entry.id)).toEqual([
        'verification-command:typecheck',
        'verification-command:unit',
      ]);
      expect(verificationEntries.map((entry) => entry.command)).toEqual(['npm', 'npm']);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('resolveProfileChecks rejects dangling canonical references', () => {
    const profile = validProfile();
    profile.profiles.default.checks = ['missing'];

    expect(resolveProfileChecks(profile).errors).toContain('stack node does not define command for check missing');
  });
});
