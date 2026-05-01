'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { extractKmpArchitecture } = require('../../skills/spec-app-consistency-audit/scripts/extract-kmp-architecture');

function write(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe('spec-app-consistency-audit architecture extraction', () => {
  test('extracts KMP source sets, layers, expect/actual, and boundary candidates', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-arch-'));
    try {
      write(repoRoot, 'shared/src/commonMain/kotlin/trade/domain/SubmitTradeOrderUseCase.kt', [
        'import android.content.Context',
        'expect class Platform',
        'class SubmitTradeOrderUseCase',
      ].join('\n'));
      write(repoRoot, 'shared/src/androidMain/kotlin/trade/Platform.kt', 'actual class Platform');
      write(repoRoot, 'shared/src/iosMain/kotlin/trade/Platform.kt', 'actual class Platform');
      write(repoRoot, 'shared/src/commonMain/kotlin/trade/ui/TradeViewModel.kt', 'class TradeViewModel { val repo = TradeRepositoryImpl() }');

      const artifact = extractKmpArchitecture({ repoRoot, source: repoRoot });

      expect(artifact.schema_version).toBe('kmp-architecture-contract.v1');
      expect(artifact.source_sets.find((entry) => entry.name === 'commonMain').present).toBe(true);
      expect(artifact.source_sets.find((entry) => entry.name === 'androidMain').present).toBe(true);
      expect(artifact.source_sets.find((entry) => entry.name === 'iosMain').present).toBe(true);
      expect(artifact.expect_actual).toEqual(expect.objectContaining({
        expect_count: 1,
        actual_count: 2,
      }));
      expect(artifact.source_imports[0]).toEqual(expect.objectContaining({
        source_set: 'commonMain',
        layer: 'domain',
        imports: ['android.content.Context'],
      }));
      expect(artifact.architecture_candidates).toEqual(expect.arrayContaining(['kmp', 'clean-architecture']));
      expect(artifact.boundary_candidates.map((entry) => entry.type)).toEqual(expect.arrayContaining([
        'platform_import_in_common_main',
        'ui_touches_data_implementation',
      ]));
      expect(artifact.boundary_candidates.every((entry) => entry.status === 'candidate')).toBe(true);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
