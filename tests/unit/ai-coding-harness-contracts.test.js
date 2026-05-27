'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

describe('AI Coding Harness contract', () => {
  test('defines spec-first as a bounded AI Coding Harness, not a state machine', () => {
    const contract = read('docs/contracts/ai-coding-harness.md');

    expect(contract).toContain('AI Coding Harness for spec-driven software engineering');
    expect(contract).toContain('Codebase -> Graph -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge');
    expect(contract).toContain('不是新的 workflow、command、state machine、universal schema');
    expect(contract).toContain('Scripts prepare deterministic facts');
    expect(contract).toContain('LLM workflows decide semantic meaning');
    expect(contract).toContain('GitNexus 和其他 providers 不拥有 scope authority');
  });

  test('maps Harness layers to existing light contracts', () => {
    const contract = read('docs/contracts/ai-coding-harness.md');

    for (const layer of [
      'Context Harness',
      'Execution Harness',
      'Evidence Harness',
      'Evaluation Harness',
      'Governance Harness',
      'Knowledge Harness',
    ]) {
      expect(contract).toContain(layer);
    }

    for (const referenced of [
      'context-governance.md',
      'context-bundle.md',
      'artifact-summary.md',
      'workflows/review-pre-facts-extraction.md',
      'workflows/spec-id-traceability.md',
      'workflows/spec-work-run-artifact.schema.json',
      'graph-evidence-policy.md',
      'graph-provider-consumption.md',
      'gitnexus-capability-catalog.md',
      'workspace-gitnexus-consumption.md',
    ]) {
      expect(contract).toContain(referenced);
    }
  });

  test('defines GitNexus lanes without promoting every capability into helper scope', () => {
    const contract = read('docs/contracts/ai-coding-harness.md');
    const preFacts = read('docs/contracts/workflows/review-pre-facts-extraction.md');
    const policy = read('docs/contracts/graph-evidence-policy.md');
    const catalog = read('docs/contracts/gitnexus-capability-catalog.md');
    const helper = read('src/cli/helpers/review-pre-facts.js');

    expect(contract).toContain('deterministic-helper');
    expect(contract).toContain('`query`, `context`, `impact`, `detect_changes`');
    expect(contract).toContain('workflow-native-session');
    expect(contract).toContain('`route_map`, `api_impact`, `shape_check`, `tool_map`, `cypher`');
    expect(contract).toContain('workspace-resource');
    expect(contract).toContain('mutation-gated-maintenance');
    expect(preFacts).toContain('The GitNexus executable operation candidate allowlist is intentionally small');
    expect(preFacts).toContain('Current Implementation Boundary');
    expect(preFacts).toContain('currently supports only');
    expect(helper).toContain("const WORKFLOWS = new Set(['doc-review', 'code-review', 'plan', 'debug']);");
    expect(helper).toContain("query: 'gitnexus.query'");
    expect(helper).toContain("context: 'gitnexus.context'");
    expect(helper).toContain("impact: 'gitnexus.impact'");
    expect(helper).toContain("detect_changes: 'gitnexus.detect_changes'");
    expect(helper).toContain('tool_name: OPERATION_TOOL_NAMES[operation]');
    expect(helper).toContain("operation: 'query'");
    expect(preFacts).toContain('must not appear in `queries[]`');
    expect(preFacts).toContain('provider summary-only arguments may be emitted only after the current executable tool schema proves support');
    expect(policy).toContain('`gitnexus-session-evidence.v1`');
    expect(catalog).toContain('Harness Lane Classification');
  });
});
