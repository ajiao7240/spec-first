'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../..');
const verifyToolsSh = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/verify-tools.sh');
const verifyToolsPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/verify-tools.ps1');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('spec-mcp-setup verify host propagation contract', () => {
  test('bash verify passes detected host and repo into helper provider readiness', () => {
    const source = read(verifyToolsSh);

    expect(source.indexOf('RECONCILIATION_HOST="$(jq -r')).toBeGreaterThan(
      source.indexOf('FACTS_JSON="$(bash "$SCRIPT_DIR/detect-tools.sh"'),
    );
    expect(source.indexOf('HELPER_JSON="$(')).toBeGreaterThan(
      source.indexOf('RECONCILIATION_REPO_ROOT="$(jq -r'),
    );
    expect(source).toContain('SPEC_FIRST_PROVIDER_HOST="$RECONCILIATION_HOST" \\');
    expect(source).toContain('SPEC_FIRST_PROVIDER_REPO_ROOT="$RECONCILIATION_REPO_ROOT" \\');
    expect(source).toContain('SPEC_FIRST_PROVIDER_HOST="$RECONCILIATION_HOST" node "$SCRIPT_DIR/provider-readiness-renderer.cjs"');
  });

  test('powershell verify passes detected host and repo into helper provider readiness', () => {
    const source = read(verifyToolsPs1);

    expect(source.indexOf('$reconciliationHost = $Facts.host')).toBeGreaterThan(
      source.indexOf("$Facts = & (Join-Path $ScriptDir 'detect-tools.ps1')"),
    );
    expect(source.indexOf("$HelperFacts = & (Join-Path $ScriptDir 'install-helpers.ps1')")).toBeGreaterThan(
      source.indexOf('$reconciliationRepoRoot = if'),
    );
    expect(source).toContain("$env:SPEC_FIRST_PROVIDER_HOST = $reconciliationHost");
    expect(source).toContain("$env:SPEC_FIRST_PROVIDER_REPO_ROOT = $reconciliationRepoRoot");
    expect(source).toContain("$env:SPEC_FIRST_PROVIDER_HOST = $reconciliationHost");
    expect(source).toContain("$mcpProviderRaw = & node (Join-Path $ScriptDir 'provider-readiness-renderer.cjs')");
  });

  test('verify outputs generated runtime manifest freshness separately from dependency readiness', () => {
    const bashSource = read(verifyToolsSh);
    const powerShellSource = read(verifyToolsPs1);

    for (const source of [bashSource, powerShellSource]) {
      expect(source).toContain('generated_runtime_manifest');
      expect(source).toContain('state.manifestVersion vs bundled manifest.version');
      expect(source).toContain('Required MCP/helper dependencies');
      expect(source).toContain('Generated runtime manifest');
      expect(source).not.toContain('"Harness runtime"');
      expect(source).not.toContain("'Harness runtime'");
    }
  });

  test('all-repos verify propagates generated runtime manifest counts and stale refresh action', () => {
    const bashSource = read(verifyToolsSh);
    const powerShellSource = read(verifyToolsPs1);

    for (const source of [bashSource, powerShellSource]) {
      expect(source).toContain('spec-first init --all-repos -y');
      expect(source).toContain('Generated runtime manifest stale or missing in one or more child repos');
      expect(source).toContain('current');
      expect(source).toContain('stale');
      expect(source).toContain('missing');
      expect(source).toContain('unknown');
    }
  });
});
