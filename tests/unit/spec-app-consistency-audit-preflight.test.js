'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
  runPreflight,
} = require('../../skills/spec-app-consistency-audit/scripts/preflight');
const {
  validateArtifact,
} = require('../../skills/spec-app-consistency-audit/scripts/validate-artifacts');

function makeRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-repo-'));
  write(repoRoot, 'prd.md', '# Trade Flow\n\nSubmit order and show failure states.\n');
  write(repoRoot, 'shared/src/commonMain/kotlin/trade/domain/SubmitOrderUseCase.kt', 'class SubmitOrderUseCase');
  write(repoRoot, 'shared/src/commonMain/kotlin/trade/ui/TradeViewModel.kt', 'class TradeViewModel { fun track() {} }');
  write(repoRoot, 'shared/src/androidMain/kotlin/Platform.kt', 'actual class Platform');
  write(repoRoot, 'shared/src/iosMain/kotlin/Platform.kt', 'actual class Platform');
  write(repoRoot, 'app/build.gradle.kts', 'plugins { id("com.android.application") }');
  write(repoRoot, 'settings.gradle.kts', 'include(":app", ":shared")');
  write(repoRoot, 'design-system/src/commonMain/kotlin/components/PrimaryButton.kt', 'class PrimaryButton');
  write(repoRoot, 'analytics/src/commonMain/kotlin/AnalyticsTracker.kt', 'fun trackEvent() {}');
  write(repoRoot, 'app/src/main/res/values/strings.xml', '<resources><string name="app_name">Demo</string></resources>');
  write(repoRoot, 'app/src/main/kotlin/navigation/AppRoutes.kt', 'navController.navigate("trade")');
  write(repoRoot, 'app/src/main/kotlin/security/WebViewScreen.kt', 'WebView(context)');
  write(repoRoot, 'app/src/test/kotlin/FakeRepositoryTest.kt', 'class FakeRepositoryTest');
  write(repoRoot, 'shared/src/commonMain/kotlin/cache/LocalCache.kt', 'class LocalCache');
  return repoRoot;
}

function write(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe('spec-app-consistency-audit preflight', () => {
  test('emits candidate preflight artifact with project signals and metadata', () => {
    const repoRoot = makeRepo();
    try {
      const artifact = runPreflight({
        repoRoot,
        source: repoRoot,
        prd: path.join(repoRoot, 'prd.md'),
        figmaNode: '12:34',
        platform: 'both',
      });

      expect(artifact.schema_version).toBe('spec-app-consistency-audit-preflight.v1');
      expect(artifact.artifact_id).toBe('preflight');
      expect(artifact.contract_status).toBe('candidate');
      expect(artifact.project_type).toBe('kmp_mobile_app');
      expect(artifact.platforms).toEqual(['android', 'ios']);
      expect(artifact.architecture_candidates).toEqual(expect.arrayContaining(['kmp', 'clean-architecture', 'mvvm']));
      expect(artifact.has_prd).toBe(true);
      expect(artifact.has_figma_context).toBe(false);
      expect(artifact.has_figma_reference).toBe(true);
      expect(artifact.has_figma_materialized_context).toBe(false);
      expect(artifact.figma_context_mode).toBe('mcp_reference_only');
      expect(artifact.has_analytics).toBe(true);
      expect(artifact.has_i18n).toBe(true);
      expect(artifact.has_component_system).toBe(true);
      expect(artifact.has_modular_structure).toBe(true);
      expect(artifact.has_testability_signals).toBe(true);
      expect(artifact.has_local_cache_or_storage).toBe(true);
      expect(artifact.has_security_sensitive_surfaces).toBe(true);
      expect(artifact.has_navigation_or_routes).toBe(true);
      expect(artifact.default_runtime_mode).toBe('static_only');
      expect(artifact.requires_device_by_default).toBe(false);
      expect(artifact.source_inputs[0].source_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(validateArtifact(artifact).valid).toBe(true);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('missing PRD and Figma become degraded facts rather than hard failure', () => {
    const repoRoot = makeRepo();
    try {
      const artifact = runPreflight({ repoRoot, source: repoRoot });
      const codes = artifact.degraded_modes.map((mode) => mode.code);

      expect(artifact.has_prd).toBe(false);
      expect(artifact.has_figma_context).toBe(false);
      expect(artifact.has_figma_reference).toBe(false);
      expect(artifact.has_figma_materialized_context).toBe(false);
      expect(artifact.figma_context_mode).toBe('none');
      expect(codes).toContain('prd_missing');
      expect(codes).toContain('figma_missing');
      expect(codes).toContain('prd_and_figma_missing');
      expect(validateArtifact(artifact).valid).toBe(true);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('Figma node reference does not count as materialized extractable context', () => {
    const repoRoot = makeRepo();
    try {
      const artifact = runPreflight({ repoRoot, source: repoRoot, figmaNode: '12:34' });
      const codes = artifact.degraded_modes.map((mode) => mode.code);

      expect(artifact.has_figma_reference).toBe(true);
      expect(artifact.has_figma_materialized_context).toBe(false);
      expect(artifact.has_figma_context).toBe(false);
      expect(artifact.figma_context_mode).toBe('mcp_reference_only');
      expect(codes).toContain('figma_materialized_context_missing');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('rejects symlink escape by default', () => {
    const repoRoot = makeRepo();
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-outside-'));
    try {
      const outsidePrd = path.join(outside, 'outside.md');
      fs.writeFileSync(outsidePrd, '# Outside PRD\n');
      const symlinkPath = path.join(repoRoot, 'linked-prd.md');
      fs.symlinkSync(outsidePrd, symlinkPath);

      const artifact = runPreflight({ repoRoot, source: repoRoot, prd: symlinkPath });

      expect(artifact.has_prd).toBe(false);
      expect(artifact.degraded_modes.map((mode) => mode.code)).toContain('symlink_escape');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  test('allows explicitly allowlisted outside input', () => {
    const repoRoot = makeRepo();
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-outside-'));
    try {
      const outsidePrd = path.join(outside, 'outside.md');
      fs.writeFileSync(outsidePrd, '# Outside PRD\n');

      const artifact = runPreflight({
        repoRoot,
        source: repoRoot,
        prd: outsidePrd,
        allowOutside: [outside],
      });

      expect(artifact.has_prd).toBe(true);
      expect(artifact.degraded_modes.map((mode) => mode.code)).not.toContain('path_outside_repo');
      expect(artifact.source_inputs.find((input) => input.type === 'prd').path).toMatch(/^<prd-outside-repo:/);
      expect(JSON.stringify(artifact)).not.toContain(outside);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  test('records file size degraded fact for oversized PRD', () => {
    const repoRoot = makeRepo();
    try {
      const artifact = runPreflight({
        repoRoot,
        source: repoRoot,
        prd: path.join(repoRoot, 'prd.md'),
        prdMaxBytes: 4,
      });

      expect(artifact.has_prd).toBe(false);
      expect(artifact.degraded_modes.map((mode) => mode.code)).toContain('file_too_large');
      expect(artifact.source_inputs.find((input) => input.type === 'prd').source_hash_unavailable_reason).toBe('file_too_large');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('source hash changes when scanned file contents change', () => {
    const repoRoot = makeRepo();
    const sourceFile = path.join(repoRoot, 'shared/src/commonMain/kotlin/trade/ui/TradeViewModel.kt');
    try {
      const before = runPreflight({ repoRoot, source: repoRoot });
      fs.writeFileSync(sourceFile, 'class TradeViewModel { fun trackChanged() {} }');
      const after = runPreflight({ repoRoot, source: repoRoot });

      expect(after.source_inputs[0].source_hash).not.toBe(before.source_inputs[0].source_hash);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test('CLI accepts --figma-context as Figma evidence instead of reporting it missing', () => {
    const repoRoot = makeRepo();
    const figmaContext = path.join(repoRoot, 'figma-context.json');
    fs.writeFileSync(figmaContext, JSON.stringify({ nodes: [] }));
    try {
      const output = execFileSync(process.execPath, [
        path.join(__dirname, '../../skills/spec-app-consistency-audit/scripts/preflight.js'),
        '--source',
        repoRoot,
        '--figma-context',
        figmaContext,
      ], { encoding: 'utf8' });
      const artifact = JSON.parse(output);
      const degradedCodes = artifact.degraded_modes.map((mode) => mode.code);

      expect(artifact.has_figma_context).toBe(true);
      expect(artifact.has_figma_materialized_context).toBe(true);
      expect(artifact.figma_context_mode).toBe('materialized_json');
      expect(degradedCodes).not.toContain('figma_missing');
      expect(degradedCodes).not.toContain('prd_and_figma_missing');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
