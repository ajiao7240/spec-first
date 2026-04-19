'use strict';

const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

describe('workflow Stage-0 consumption contract', () => {
  for (const relativePath of [
    'skills/spec-plan/SKILL.md',
    'skills/spec-work/SKILL.md',
    'skills/spec-work-beta/SKILL.md',
    'skills/spec-review/SKILL.md',
  ]) {
    test(`${relativePath} uses evaluator output contract as the Stage-0 source of truth`, () => {
      const content = read(relativePath);

      expect(content).toContain('selected_assets / fallback_reason / level / skipped_rules');
      expect(content).toContain('telemetry');
      expect(content).toContain('context-routing.json');
      expect(content).toContain('verification summary');
      expect(content).toContain('platform_focus');
      expect(content).toContain('stage0-context --stage');
      expect(content).toContain('__SPEC_FIRST_STAGE0_CONTEXT_UNAVAILABLE__');
      expect(content).not.toContain('按 yaml 路由加载文件');

      expect(content).toContain('verifier_dispatch');
      expect(content).toContain('ai_dev_quality_gate_result');
      expect(content).toContain('verification_evidence');
      expect(content).toContain('verification_gate_state');
    });
  }

  for (const relativePath of [
    'skills/spec-plan/SKILL.md',
    'skills/spec-work/SKILL.md',
    'skills/spec-work-beta/SKILL.md',
    'skills/spec-review/SKILL.md',
  ]) {
    test(`${relativePath} reloads facts before acting when Stage-0 is stale or degraded`, () => {
      const content = read(relativePath);

      expect(content).toContain('### Reload Before Act');
      expect(content).toContain('freshness_stale');
      expect(content).toContain('selected_assets');
      expect(content).toContain('Do not present `freshness_stale` as `L0`');
    });
  }
});
