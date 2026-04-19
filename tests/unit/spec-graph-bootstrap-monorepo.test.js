'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runBootstrap } = require('../../src/bootstrap-compiler/run-bootstrap');

function createMavenMonorepo(repoRoot, moduleNames) {
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

describe('spec-graph-bootstrap monorepo bootstrap', () => {
  test('Maven parent repo bootstrap 会把 module topology、module-map 与 minimal-context 一起收口', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-monorepo-'));

    try {
      createMavenMonorepo(repoRoot, ['member-center', 'trade-center']);
      const result = runBootstrap({
        repoRoot,
        generatedAt: '2026-04-20T00:00:00.000Z',
      });

      const factInventory = JSON.parse(fs.readFileSync(path.join(result.controlPlaneDir, 'fact-inventory.json'), 'utf8'));
      const planContext = JSON.parse(fs.readFileSync(path.join(result.controlPlaneDir, 'minimal-context', 'plan.json'), 'utf8'));
      const moduleMap = fs.readFileSync(path.join(result.contextDir, 'architecture', 'module-map.md'), 'utf8');

      expect(result.status).toBe('complete');
      expect(factInventory.topology).toMatchObject({
        kind: 'monorepo_multi_module',
        selection_granularity: 'module',
      });
      expect(factInventory.topology.units).toEqual([
        expect.objectContaining({ id: 'member-center', kind: 'module', path: 'member-center' }),
        expect.objectContaining({ id: 'trade-center', kind: 'module', path: 'trade-center' }),
      ]);
      expect(planContext.module_focus).toEqual(['member-center', 'trade-center']);
      expect(moduleMap).toContain('- [module] member-center');
      expect(moduleMap).toContain('- [module] trade-center');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
