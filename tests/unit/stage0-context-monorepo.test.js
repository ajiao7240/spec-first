'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BIN_PATH = path.join(__dirname, '..', '..', 'bin', 'spec-first.js');

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [BIN_PATH, ...args], {
    encoding: 'utf8',
    ...options,
  });
}

function createMavenMonorepo(repoRoot) {
  fs.writeFileSync(path.join(repoRoot, 'pom.xml'), [
    '<project>',
    '  <modelVersion>4.0.0</modelVersion>',
    '  <packaging>pom</packaging>',
    '  <modules>',
    '    <module>member-center</module>',
    '  </modules>',
    '</project>',
    '',
  ].join('\n'));
  fs.mkdirSync(path.join(repoRoot, 'member-center', 'src', 'main', 'java', 'com', 'example'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(repoRoot, 'member-center', 'src', 'main', 'java', 'com', 'example', 'Demo.java'),
    'class Demo {}\n'
  );
}

describe('stage0-context monorepo selection retirement', () => {
  test('monorepo work no longer has a Stage-0 selection command', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-context-monorepo-retired-'));

    try {
      createMavenMonorepo(repoRoot);
      const result = runCli([
        'stage0-context',
        '--stage',
        'work',
        '--changed-file',
        'member-center/src/main/java/com/example/Demo.java',
      ], { cwd: repoRoot });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Unknown command: stage0-context');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('work execution uses CRG before-work hook instead of Stage-0 selected assets', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-before-work-monorepo-'));

    try {
      createMavenMonorepo(repoRoot);
      const result = runCli([
        'crg',
        'hook',
        'before-work',
        `--repo=${repoRoot}`,
      ], { cwd: repoRoot });

      expect(result.status).toBe(0);
      const payload = JSON.parse(result.stdout);
      expect(payload.data.hook_id).toBe('before_work');
      expect(payload.data.workflow_context.fallback.mode).toBe('direct_repo_reads');
      expect(payload.data.planned_surface.source).toBe('none');
      expect(JSON.stringify(payload)).not.toContain('selected_assets');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
