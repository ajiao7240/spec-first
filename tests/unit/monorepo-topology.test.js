'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { compileMachineArtifacts } = require('../../src/bootstrap-compiler/compile-machine-artifacts');
const { compileHumanAssets } = require('../../src/bootstrap-compiler/compile-human-assets');

describe('monorepo topology', () => {
  test('Maven parent repo 会产出 monorepo_multi_module topology 与 module map', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'monorepo-topology-'));

    try {
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
        fs.mkdirSync(path.join(repoRoot, moduleName, 'src', 'main', 'java', 'com', 'example'), { recursive: true });
        fs.writeFileSync(path.join(repoRoot, moduleName, 'pom.xml'), [
          '<project>',
          '  <modelVersion>4.0.0</modelVersion>',
          `  <artifactId>${moduleName}</artifactId>`,
          '</project>',
          '',
        ].join('\n'));
        fs.writeFileSync(
          path.join(repoRoot, moduleName, 'src', 'main', 'java', 'com', 'example', `${moduleName.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}.java`),
          'class Demo {}\n',
        );
      }

      const machineArtifacts = compileMachineArtifacts({
        repoRoot,
        actualAssets: [
          'fact-inventory.json',
          'risk-signals.json',
          'test-surface.json',
          'database-routing.json',
          'context-routing.json',
          'artifact-manifest.json',
          'freshness.json',
          'minimal-context/plan.json',
          'minimal-context/work.json',
          'minimal-context/review.json',
          'verification-profile.json',
        ],
      });
      const humanAssets = compileHumanAssets({
        factInventory: machineArtifacts.fact_inventory,
        riskSignals: machineArtifacts.risk_signals,
        testSurface: machineArtifacts.test_surface,
        verificationProfile: machineArtifacts.verification_profile,
      });

      expect(machineArtifacts.fact_inventory.topology).toMatchObject({
        kind: 'monorepo_multi_module',
        container_kind: 'git_repo',
        selection_granularity: 'module',
      });
      expect(machineArtifacts.fact_inventory.topology.units).toEqual([
        expect.objectContaining({
          id: 'member-center',
          kind: 'module',
          path: 'member-center',
          build_system: 'maven',
        }),
        expect.objectContaining({
          id: 'trade-center',
          kind: 'module',
          path: 'trade-center',
          build_system: 'maven',
        }),
      ]);
      expect(humanAssets.context_docs['architecture/module-map.md']).toContain('- [module] member-center');
      expect(humanAssets.context_docs['architecture/module-map.md']).toContain('- [module] trade-center');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
