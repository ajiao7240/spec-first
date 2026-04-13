'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const GITIGNORE_PATH = path.join(REPO_ROOT, '.gitignore');
const GRAPH_BOOTSTRAP_SKILL_PATH = path.join(
  REPO_ROOT,
  'skills/spec-graph-bootstrap/SKILL.md'
);
const SAMPLE_INJECTION_INDEX_PATH = path.join(
  REPO_ROOT,
  'docs/contexts/spec-first/injection-index.yaml'
);

describe('spec-graph-bootstrap contracts', () => {
  test('.gitignore keeps .spec-first runtime ignored while allowing docs/contexts samples', () => {
    const gitignore = fs.readFileSync(GITIGNORE_PATH, 'utf8');

    expect(gitignore).toContain('.spec-first/');
    expect(gitignore).not.toContain('\ndocs/contexts/\n');
  });

  test('source skill schema requires updated_at for layer facts and risk signal facts', () => {
    const skill = fs.readFileSync(GRAPH_BOOTSTRAP_SKILL_PATH, 'utf8');

    expect(skill).toContain(
      'layers: { frontend: { present, confidence, inference_reason, evidence, updated_at }, ... }'
    );
    expect(skill).toContain(
      'signals: [{ path, symbol, kind, summary, severity, confidence, inference_reason, evidence, updated_at }]'
    );
    expect(skill).toContain(
      'top_hubs: [{ id, name, file_path, kind, in_degree, confidence, inference_reason, evidence, updated_at }]'
    );
  });

  test('checked-in sample injection index avoids duplicate public-entrypoints injection in plan/work', () => {
    const yaml = fs.readFileSync(SAMPLE_INJECTION_INDEX_PATH, 'utf8');
    const planBlock = yaml.match(/plan:\n([\s\S]*?)\n  work:/);
    const workBlock = yaml.match(/work:\n([\s\S]*?)\n  review:/);

    expect(planBlock && planBlock[1]).not.toContain('code-facts/public-entrypoints.md');
    expect(workBlock && workBlock[1]).not.toContain('code-facts/public-entrypoints.md');
    expect(yaml).toMatch(/condition: "output_exists\.code_facts_public_entrypoints"/);
  });
});
