'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { runReviewPreFacts } = require('../../src/cli/helpers/review-pre-facts');

const FIXTURE_ROOT = path.join(__dirname, '..', 'fixtures', 'review-pre-facts');

function tempRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-r15f-'));
  spawnSync('git', ['init', '-q'], { cwd: repo, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.email', 'tests@example.invalid'], { cwd: repo, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.name', 'Tests'], { cwd: repo, encoding: 'utf8' });
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: repo, encoding: 'utf8' });
  spawnSync('git', ['config', 'core.hooksPath', '/dev/null'], { cwd: repo, encoding: 'utf8' });
  return repo;
}

function writeFile(repo, relPath, contents) {
  const full = path.join(repo, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents, 'utf8');
}

function copyFixture(repo, fixtureRel, targetRel) {
  const fixture = fs.readFileSync(path.join(FIXTURE_ROOT, fixtureRel), 'utf8');
  writeFile(repo, targetRel, fixture);
}

function setupCanonicalArtifacts(repo) {
  // Mirror the definitions-only fixture into the tmp repo's canonical paths.
  copyFixture(repo, 'provider-status.definitions-only.json', '.spec-first/graph/provider-status.json');
  copyFixture(repo, 'graph-facts.definitions-only.json', '.spec-first/graph/graph-facts.json');
  copyFixture(
    repo,
    'providers/gitnexus/normalized/architecture-facts.definitions-only.json',
    '.spec-first/providers/gitnexus/normalized/architecture-facts.json',
  );
  copyFixture(
    repo,
    'providers/gitnexus/normalized/impact-capabilities.definitions-only.json',
    '.spec-first/providers/gitnexus/normalized/impact-capabilities.json',
  );
  // bootstrap-impact-capabilities lives under .spec-first/impact (canonical path
  // mirrored by spec-graph-bootstrap). Provide a minimal copy so isolation is
  // tested across all three canonical roots.
  writeFile(repo, '.spec-first/impact/bootstrap-impact-capabilities.json', JSON.stringify({
    schema_version: 'bootstrap-impact-capabilities.v1',
    capabilities: {
      context_selection: { support_level: 'full' },
      impact_radius: { support_level: 'none' },
      review_support: { support_level: 'none' },
    },
  }, null, 2) + '\n');
}

function hashFile(filePath) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function snapshotCanonicalHashes(repo) {
  const paths = [
    '.spec-first/graph/provider-status.json',
    '.spec-first/graph/graph-facts.json',
    '.spec-first/providers/gitnexus/normalized/architecture-facts.json',
    '.spec-first/providers/gitnexus/normalized/impact-capabilities.json',
    '.spec-first/impact/bootstrap-impact-capabilities.json',
  ];
  const snapshot = {};
  for (const rel of paths) {
    snapshot[rel] = hashFile(path.join(repo, rel));
  }
  return snapshot;
}

function captureRun(repo, args) {
  let stdout = '';
  let stderr = '';
  const code = runReviewPreFacts(args, {
    cwd: repo,
    stdout: { write: (chunk) => { stdout += String(chunk); } },
    stderr: { write: (chunk) => { stderr += String(chunk); } },
  });
  return { code, stdout, stderr };
}

describe('Live MCP / read-only mode canonical artifact isolation (R15f)', () => {
  test('review-pre-facts prepare mode does not modify any canonical readiness artifact', () => {
    const repo = tempRepo();
    try {
      // Seed an initial commit so review-pre-facts can compute snapshots.
      writeFile(repo, '.gitignore', '.spec-first/\n');
      writeFile(repo, 'src/cli/sample.js', 'module.exports = {};\n');
      writeFile(repo, 'docs/plans/plan.md', [
        '---',
        'title: r15f-fixture',
        '---',
        '',
        '## Sources & References',
        '- `src/cli/sample.js`',
        '',
        '## Implementation Units',
        '**文件：** `src/cli/sample.js`',
        '',
      ].join('\n'));
      spawnSync('git', ['add', '.'], { cwd: repo, encoding: 'utf8' });
      spawnSync('git', ['commit', '--no-verify', '-m', 'init'], { cwd: repo, encoding: 'utf8' });

      setupCanonicalArtifacts(repo);

      const beforeHashes = snapshotCanonicalHashes(repo);

      const runId = `r15f-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const tempDir = path.join(os.tmpdir(), 'spec-first', 'review-pre-facts', runId);
      fs.rmSync(tempDir, { recursive: true, force: true });
      fs.mkdirSync(tempDir, { recursive: true });
      const output = path.join(tempDir, 'query-plan.json');
      const result = captureRun(repo, [
        '--mode', 'prepare',
        '--workflow', 'doc-review',
        '--document', 'docs/plans/plan.md',
        '--repo', repo,
        '--run-id', runId,
        '--summary-dir', tempDir,
        '--output', output,
      ]);

      // The mode is read-only; even on degraded readiness it should exit 0.
      expect(result.code).toBe(0);

      const afterHashes = snapshotCanonicalHashes(repo);

      for (const rel of Object.keys(beforeHashes)) {
        expect(afterHashes[rel]).toBe(beforeHashes[rel]);
      }

      // Read-only mode must not have created or removed canonical paths either.
      expect(Object.keys(afterHashes).sort()).toEqual(Object.keys(beforeHashes).sort());

      fs.rmSync(tempDir, { recursive: true, force: true });
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('startup graph readiness snapshot read does not modify canonical artifacts', () => {
    const repo = tempRepo();
    try {
      writeFile(repo, '.gitignore', '.spec-first/\n.codex/\n');
      writeFile(repo, 'src.js', 'module.exports = 1;\n');
      spawnSync('git', ['add', '.gitignore', 'src.js'], { cwd: repo, encoding: 'utf8' });
      spawnSync('git', ['commit', '--no-verify', '-m', 'init'], { cwd: repo, encoding: 'utf8' });

      setupCanonicalArtifacts(repo);
      writeFile(repo, '.codex/spec-first/state.json', JSON.stringify({ manifestVersion: '1.6.1' }) + '\n');

      const beforeHashes = snapshotCanonicalHashes(repo);

      const { buildStartupGraphReadinessSnapshot } = require('../../src/cli/version-reminder');
      const snapshot = buildStartupGraphReadinessSnapshot({ host: 'codex', projectRoot: repo });

      expect(snapshot).not.toBeNull();
      expect(snapshot.message).toMatch(/GitNexus graph:/);

      const afterHashes = snapshotCanonicalHashes(repo);

      for (const rel of Object.keys(beforeHashes)) {
        expect(afterHashes[rel]).toBe(beforeHashes[rel]);
      }
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
