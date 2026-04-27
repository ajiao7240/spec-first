'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SESSIONS_SKILL = path.join(__dirname, '..', '..', 'skills', 'spec-sessions', 'SKILL.md');
const INVENTORY_SKILL = path.join(__dirname, '..', '..', 'skills', 'spec-session-inventory', 'SKILL.md');
const HISTORIAN_AGENT = path.join(__dirname, '..', '..', 'agents', 'spec-session-historian.agent.md');
const { buildFilteredAssetSet } = require('../../src/cli/plugin');

describe('spec session history contracts', () => {
  test('pre-resolved repo name avoids shell case statements blocked by skill-load permissions', () => {
    const text = fs.readFileSync(SESSIONS_SKILL, 'utf8');
    const historian = fs.readFileSync(HISTORIAN_AGENT, 'utf8');

    expect(text).toContain('git rev-parse --path-format=absolute --git-common-dir');
    expect(text).toContain('[ -n "$common" ]');
    expect(text).toContain('basename "$(dirname "$common")"');
    expect(text).not.toContain('case "$common" in /*)');
    expect(text).not.toContain('if [ "$common" = ".git" ]');

    expect(historian).toContain('git rev-parse --path-format=absolute --git-common-dir');
    expect(historian).toContain('Guard against empty output');
    expect(historian).not.toContain('case "$common" in /*)');
  });

  test('session inventory exposes keyword ranking output shape', () => {
    const text = fs.readFileSync(INVENTORY_SKILL, 'utf8');

    expect(text).toContain('--keyword K1[,K2,...]');
    expect(text).toContain('match_count');
    expect(text).toContain('keyword_matches');
    expect(text).toContain('files_matched');
    expect(text).toContain('Sessions with `match_count: 0` are excluded from output.');
  });

  test('historian must use keyword filtering before extracting relevance candidates', () => {
    const text = fs.readFileSync(HISTORIAN_AGENT, 'utf8');

    expect(text).toContain('Never extract a session to verify whether it is relevant');
    expect(text).toContain('session-inventory --keyword K1,K2,...');
    expect(text).toContain('If `files_matched: 0`, return "no relevant prior sessions" immediately');
    expect(text).toContain('at most **5 sessions total across all platforms**');
    expect(text).toContain('Tail extraction is conditional, not default');
    expect(text).toContain('Do **not** roll your own per-file `grep -l` calls');
  });

  test('agent-facing session primitives are delivered as internal runtime skills', () => {
    for (const platform of ['claude', 'codex']) {
      const assets = buildFilteredAssetSet(platform);

      expect(assets.internalSkills).toEqual(expect.arrayContaining([
        'spec-session-extract',
        'spec-session-inventory',
      ]));
      expect(assets.skills).not.toContain('spec-session-extract');
      expect(assets.skills).not.toContain('spec-session-inventory');
    }
  });
});
