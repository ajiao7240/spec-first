'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BIN_PATH = path.join(__dirname, '..', '..', 'bin', 'spec-first.js');
const { runBootstrap } = require('../../src/bootstrap-compiler/run-bootstrap');

function runStage0Context(args, options = {}) {
  const output = execFileSync(process.execPath, [BIN_PATH, 'stage0-context', ...args], {
    encoding: 'utf8',
    ...options,
  });
  return JSON.parse(output);
}

describe('stage0-context monorepo selection', () => {
  test('changed file 命中 Maven module 时输出 module selection_subject 与 module selected_contexts', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-context-monorepo-'));

    try {
      execFileSync('git', ['init'], { cwd: repoRoot, stdio: 'ignore' });
      execFileSync('git', ['config', 'user.name', 'spec-first'], { cwd: repoRoot, stdio: 'ignore' });
      execFileSync('git', ['config', 'user.email', 'spec-first@example.com'], { cwd: repoRoot, stdio: 'ignore' });

      fs.writeFileSync(path.join(repoRoot, 'pom.xml'), [
        '<project>',
        '  <modelVersion>4.0.0</modelVersion>',
        '  <groupId>com.example</groupId>',
        '  <artifactId>demo-parent</artifactId>',
        '  <version>1.0.0</version>',
        '  <packaging>pom</packaging>',
        '  <modules>',
        '    <module>member-center</module>',
        '    <module>trade-center</module>',
        '  </modules>',
        '</project>',
        '',
      ].join('\n'));

      for (const moduleName of ['member-center', 'trade-center']) {
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

      runBootstrap({
        repoRoot,
        generatedAt: '2026-04-20T00:00:00.000Z',
      });

      const result = runStage0Context([
        '--stage', 'work',
        '--workflow', 'spec-work',
        '--cwd', repoRoot,
        '--target', repoRoot,
        '--changed-file', 'member-center/src/main/java/com/example/Demo.java',
      ], { cwd: repoRoot });

      expect(result.mode).toBe('single-repo');
      expect(result.selection_subject).toMatchObject({
        kind: 'module',
        subject_slug: path.basename(repoRoot),
        unit_id: 'member-center',
        path: 'member-center',
      });
      expect(result.selected_contexts).toEqual(expect.arrayContaining([
        expect.objectContaining({
          scope: 'module',
          slug: path.basename(repoRoot),
          unit_id: 'member-center',
          asset_path: 'minimal-context/work.json',
        }),
      ]));
      expect(result.verification_summary).toMatchObject({
        source: 'change-surface',
        impacted_modules: ['member-center'],
      });
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
