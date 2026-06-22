'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CodexAdapter = require('../../src/cli/adapters/codex');
const { syncSkills } = require('../../src/cli/plugin');

const REPO_ROOT = path.join(__dirname, '..', '..');
const QUALITY_CONTRACT_PATH = path.join(REPO_ROOT, 'docs', 'validation', 'spec-write-tasks', 'quality-score-contract.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('spec-write-tasks runtime governance evidence', () => {
  test('quality contract records target-audit governance dimensions as not scored', () => {
    const contract = read(QUALITY_CONTRACT_PATH);

    expect(contract).toContain('`runtime_governance`');
    expect(contract).toContain('`cross_host_portability`');
    expect(contract).toContain('`--target` audit 中为 `null`，因为该 audit 跳过 governance');
    expect(contract).toContain('not_checked_with_reason');
    expect(contract).toContain('repo-level scripts、validation reports、historical plans 与 `.spec-first/audits/**` 是维护者证据');
  });

  test('codex projection does not make maintainer reports or scripts runtime dependencies', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-write-tasks-runtime-governance-'));
    try {
      syncSkills(projectRoot, new CodexAdapter());

      const runtimeRoot = path.join(projectRoot, '.agents', 'skills', 'spec-write-tasks');
      const runtimeSkill = read(path.join(runtimeRoot, 'SKILL.md'));
      const runtimeHandoff = read(path.join(runtimeRoot, 'references', 'execution-handoff-contract.md'));
      const runtimeGuide = read(path.join(runtimeRoot, 'references', 'task-quality-guide.md'));

      expect(runtimeSkill).not.toContain('docs/validation/spec-write-tasks');
      expect(runtimeSkill).not.toContain('scripts/spec-write-tasks');
      expect(runtimeHandoff).not.toContain('docs/validation/spec-write-tasks');
      expect(runtimeGuide).not.toContain('scripts/spec-write-tasks');
      expect(fs.existsSync(path.join(runtimeRoot, 'docs', 'validation'))).toBe(false);
      expect(fs.existsSync(path.join(runtimeRoot, 'scripts', 'spec-write-tasks'))).toBe(false);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
