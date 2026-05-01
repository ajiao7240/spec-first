'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { extractComponents } = require('../../skills/spec-app-consistency-audit/scripts/extract-components');
const { extractModules } = require('../../skills/spec-app-consistency-audit/scripts/extract-modules');
const { mergeContracts } = require('../../skills/spec-app-consistency-audit/scripts/merge-contracts');

function write(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

describe('spec-app-consistency-audit component and module extraction', () => {
  test('extracts component candidates, module graph, and preserves merged artifact trace', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-component-'));
    try {
      write(repoRoot, 'settings.gradle.kts', 'include(":app", ":feature:trade", ":core", ":design-system")');
      write(repoRoot, 'core/build.gradle.kts', 'dependencies { implementation(project(":feature:trade")) }');
      write(repoRoot, 'feature/trade/build.gradle.kts', 'dependencies { implementation(project(":design-system")) }');
      write(repoRoot, 'design-system/build.gradle.kts', 'dependencies { implementation(project(":core")) }');
      write(repoRoot, 'design-system/src/commonMain/kotlin/PrimaryButton.kt', [
        '@Composable fun PrimaryButton(loading: Boolean, disabled: Boolean, accessibilityLabel: String) {',
        '  TextField(value = "", onValueChange = {})',
        '}',
      ].join('\n'));

      const components = extractComponents({ repoRoot, source: repoRoot });
      const modules = extractModules({ repoRoot, source: repoRoot });
      const componentPath = write(repoRoot, 'component.json', JSON.stringify(components));
      const modulePath = write(repoRoot, 'module.json', JSON.stringify(modules));
      const merged = mergeContracts({ artifacts: [componentPath, modulePath] });

      expect(components.code_components.map((entry) => entry.name)).toContain('PrimaryButton');
      expect(components.code_components[0].props).toEqual(expect.arrayContaining(['loading', 'disabled', 'accessibilityLabel']));
      expect(modules.modules.map((entry) => entry.name)).toEqual(expect.arrayContaining([':feature:trade', ':core', ':design-system']));
      expect(modules.boundary_candidates.map((entry) => entry.type)).toContain('core_depends_on_feature');
      expect(modules.dependency_metrics.find((entry) => entry.module === ':core')).toEqual(expect.objectContaining({
        fan_out: 1,
        status: 'candidate',
      }));
      expect(modules.dependency_cycles[0].modules).toEqual(expect.arrayContaining([':core', ':feature:trade', ':design-system']));
      expect(merged.schema_version).toBe('merged-app-audit-context.v1');
      expect(merged.coverage.components).toBe(true);
      expect(merged.coverage.modules).toBe(true);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
