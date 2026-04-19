'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BIN_PATH = path.join(__dirname, '..', '..', 'bin', 'spec-first.js');
const { runBootstrap } = require('../../src/bootstrap-compiler/run-bootstrap');
const { buildChildSlug } = require('../../src/bootstrap-compiler/workspace-registry');

function runStage0Context(args, options = {}) {
  const output = execFileSync(process.execPath, [BIN_PATH, 'stage0-context', ...args], {
    encoding: 'utf8',
    ...options,
  });
  return JSON.parse(output);
}

function createMavenMonorepo(repoRoot, moduleNames) {
  execFileSync('git', ['init'], { cwd: repoRoot, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'spec-first'], { cwd: repoRoot, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'spec-first@example.com'], { cwd: repoRoot, stdio: 'ignore' });

  fs.writeFileSync(path.join(repoRoot, 'pom.xml'), [
    '<project>',
    '  <modelVersion>4.0.0</modelVersion>',
    '  <groupId>com.example</groupId>',
    '  <artifactId>crm-parent</artifactId>',
    '  <version>1.0.0</version>',
    '  <packaging>pom</packaging>',
    '  <modules>',
    ...moduleNames.map((moduleName) => `    <module>${moduleName}</module>`),
    '  </modules>',
    '</project>',
    '',
  ].join('\n'));

  for (const moduleName of moduleNames) {
    const javaDir = path.join(repoRoot, moduleName, 'src', 'main', 'java', 'com', 'example');
    fs.mkdirSync(javaDir, { recursive: true });
    fs.writeFileSync(path.join(repoRoot, moduleName, 'pom.xml'), [
      '<project>',
      '  <modelVersion>4.0.0</modelVersion>',
      `  <artifactId>${moduleName}</artifactId>`,
      '</project>',
      '',
    ].join('\n'));
    fs.writeFileSync(path.join(javaDir, 'Demo.java'), 'class Demo {}\n');
  }

  execFileSync('git', ['add', '.'], { cwd: repoRoot, stdio: 'ignore' });
  execFileSync('git', ['-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'baseline'], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
}

describe('workspace nested topology', () => {
  test('workspace child repo 本身是 monorepo 时，stage0-context 会输出 workspace + module 双层上下文', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-nested-topology-'));
    const workspaceRoot = path.join(tmpDir, 'crm-workspace');
    const childRepoRoot = path.join(workspaceRoot, 'services', 'crm-service');

    try {
      fs.mkdirSync(childRepoRoot, { recursive: true });
      createMavenMonorepo(childRepoRoot, ['member-center', 'trade-center']);
      runBootstrap({
        repoRoot: workspaceRoot,
        repoRoots: [childRepoRoot],
        generatedAt: '2026-04-20T00:00:00.000Z',
      });

      const childSlug = buildChildSlug(workspaceRoot, childRepoRoot);
      const result = runStage0Context([
        '--stage', 'work',
        '--workflow', 'spec-work',
        '--cwd', childRepoRoot,
        '--target', childRepoRoot,
        '--changed-file', 'member-center/src/main/java/com/example/Demo.java',
      ], { cwd: childRepoRoot });

      expect(result.mode).toBe('workspace');
      expect(result.workspace_slug).toBe('crm-workspace');
      expect(result.matched_child_slugs).toEqual([childSlug]);
      expect(result.selection_subject).toMatchObject({
        kind: 'module',
        owner_slug: childSlug,
        subject_slug: childSlug,
        unit_id: 'member-center',
        path: 'member-center',
      });
      expect(result.selected_contexts).toEqual(expect.arrayContaining([
        expect.objectContaining({
          scope: 'workspace',
          slug: 'crm-workspace',
          asset_path: 'workspace/routing-overview.md',
        }),
        expect.objectContaining({
          scope: 'module',
          slug: childSlug,
          unit_id: 'member-center',
          asset_path: 'minimal-context/work.json',
        }),
      ]));
      expect(result.verification_summary).toMatchObject({
        source: 'change-surface',
        impacted_modules: ['member-center'],
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
