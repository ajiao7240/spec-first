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
    'skills/spec-review/SKILL.md',
  ]) {
    test(`${relativePath} uses evaluator output contract as the Stage-0 source of truth`, () => {
      const content = read(relativePath);

      expect(content).toContain('selected_assets / fallback_reason / level / skipped_rules');
      expect(content).toContain('telemetry');
      expect(content).toContain('context-routing.json');
      expect(content).not.toContain('按 yaml 路由加载文件');
    });
  }
});
