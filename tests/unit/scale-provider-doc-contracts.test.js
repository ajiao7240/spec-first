'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SCALE_DOC_ROOT = path.join(REPO_ROOT, 'docs', '01-需求分析', '13.scale集成');
const CODEGRAPH_DOC = path.join(SCALE_DOC_ROOT, 'CodeGraph技术方案.md');
const PARENT_DOC = path.join(
  SCALE_DOC_ROOT,
  'spec-first内化集成scale-project-scaffold技术方案.md',
);

describe('SCALE provider documentation contracts', () => {
  test('CodeGraph provider examples keep readiness and evidence trust as separate axes', () => {
    const codegraph = fs.readFileSync(CODEGRAPH_DOC, 'utf8');
    const parent = fs.readFileSync(PARENT_DOC, 'utf8');

    expect(parent).toContain('轴 A — Provider Readiness');
    expect(parent).toContain('轴 B — Evidence Trust');
    expect(parent).toContain('readiness 字段只接受现有 5 值 enum');
    expect(parent).toContain('provider readiness=`fresh` 不得单独产生 `confirmed_context`');

    expect(codegraph).toContain('"readiness_status": "fresh|stale|degraded|not-run|unknown"');
    expect(codegraph).toContain('"candidate_trust": "advisory|evidence_candidate"');
    expect(codegraph).toContain('不得回填进 readiness 字段');
    expect(codegraph).not.toContain('"status": "unavailable|stale|advisory|evidence_candidate"');
    expect(codegraph).not.toContain('"status": "evidence_candidate"');
    expect(codegraph).not.toContain('"status": "advisory"');
  });
});
