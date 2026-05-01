'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { extractComponents } = require('../../skills/spec-app-consistency-audit/scripts/extract-components');

function write(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe('spec-app-consistency-audit interaction extraction', () => {
  test('extracts mobile interaction candidates from UI source', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-app-audit-interaction-'));
    try {
      write(repoRoot, 'app/src/main/kotlin/trade/TradeForm.kt', [
        '@Composable fun TradeForm() {',
        '  TextField(value = "", onValueChange = {})',
        '  Button(onClick = { submitOrder() }) { Text("提交") }',
        '  LazyColumn { }',
        '  PermissionRequiredContent()',
        '  WindowInsets.navigationBars',
        '}',
      ].join('\n'));

      const artifact = extractComponents({ repoRoot, source: repoRoot });
      const types = artifact.interaction_candidates.map((entry) => entry.type);

      expect(types).toEqual(expect.arrayContaining([
        'keyboard_sensitive_form',
        'submit_loading_or_disabled',
        'list_empty_error_retry',
        'permission_denied_state',
        'safe_area_sensitive_layout',
      ]));
      expect(artifact.interaction_candidates.every((entry) => entry.status === 'candidate')).toBe(true);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
