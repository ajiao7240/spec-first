'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runBootstrap } = require('../../src/bootstrap-compiler/run-bootstrap');
const { buildRuntimeVerificationSummaryForRepo } = require('../../src/context-routing/verification-summary');

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

describe('verification summary topology integration', () => {
  test('monorepo 改动单个 module 文件时，verification summary 优先输出 topology module 命中', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'verification-summary-topology-'));

    try {
      createMavenMonorepo(repoRoot, ['member-center', 'trade-center']);
      const result = runBootstrap({
        repoRoot,
        generatedAt: '2026-04-20T00:00:00.000Z',
      });
      const summary = buildRuntimeVerificationSummaryForRepo({
        repoRoot,
        slug: result.slug,
        stage: 'work',
        changedFiles: ['member-center/src/main/java/com/example/Demo.java'],
      });

      expect(summary).toMatchObject({
        source: 'change-surface',
        impacted_modules: ['member-center'],
      });
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
