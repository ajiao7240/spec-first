'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');

const CONSUMER_SURFACES = [
  'skills/spec-plan/references/governance-boundaries.md',
  'skills/spec-code-review/SKILL.md',
  'skills/spec-debug/SKILL.md',
  'skills/spec-work/SKILL.md',
  'skills/spec-prd/SKILL.md',
  'skills/spec-brainstorm/SKILL.md',
  'skills/spec-ideate/SKILL.md',
];

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

describe('project graph consumption contract', () => {
  test('pins the candidate-only and trust-elevation rules', () => {
    const contract = read('docs/contracts/project-graph-consumption.md');
    const appendixStart = contract.indexOf('## Appendix: Provider-Specific Examples');
    const body = appendixStart >= 0 ? contract.slice(0, appendixStart) : contract;

    expect(contract).toContain('`project-graph-consumption.v1` defines how workflows consume project-graph and code-graph capability-class providers as candidate evidence');
    expect(contract).toContain('The output stays candidate-only');
    expect(contract).toContain('Trigger Shape');
    expect(contract).toContain('Default project-graph use is appropriate for architecture relationships, cross-file relationships, impact analysis, broad codebase navigation');
    expect(contract).toContain('Default project-graph use is not appropriate for simple factual Q&A, current conversation or current-context summaries');
    expect(contract).toContain('user-provided single-document summarization/editing');
    expect(contract).toContain('never cat graph.json');
    expect(contract).toContain('setup-facts artifact that carries `provider_readiness[]`');
    expect(contract).toContain('If setup facts are missing, stale, missing `generated_at`, or otherwise freshness-untrusted');
    expect(contract).toContain('`stale`: exploration-tier orientation may use the provider when you annotate that the graph lags HEAD');
    expect(contract).toContain('Fallback triggers are: provider missing, setup-facts freshness untrusted, readiness facts missing');
    expect(contract).toContain('Fallback is never-blocking for ordinary workflows');
    expect(contract).toContain('This relay is a trust-elevation direction, not a call-priority order');
    expect(contract).toContain('no skip-layer elevation');
    expect(contract).toContain('a project-graph candidate must not enter a conclusion-tier claim without lower-layer confirmation');
    expect(contract).toContain('does not unlock deterministic TIA, coverage, dependency graph, ownership, affected-test, or review-impact claims as confirmed facts');
    expect(contract).toContain('provider_untrusted.summaries[]');
    expect(contract).toContain('direct_evidence_used.source_refs');
    expect(contract).toContain('evidence_summaries[]');
    expect(body.toLowerCase()).not.toContain('graphify');
  });

  test('registered consumers cite the single source of truth', () => {
    for (const relativePath of CONSUMER_SURFACES) {
      expect(read(relativePath)).toContain('docs/contracts/project-graph-consumption.md');
    }
  });

  test('checked-in host graphify instructions narrow triggers and mark provider evidence advisory', () => {
    const requiredTokens = [
      'Use Graphify first only',
      'architecture relationships',
      'cross-file relationships',
      'impact analysis',
      'broad codebase navigation',
      'Do not use Graphify by default',
      'simple factual Q&A',
      'current conversation or context summaries',
      'single-document summarization/editing',
      'already-scoped file reads',
      'provider_untrusted',
      'confirm important conclusions from source/test/log/doc evidence',
    ];

    for (const relativePath of ['CLAUDE.md', 'AGENTS.md']) {
      const content = read(relativePath);

      for (const token of requiredTokens) {
        expect(content).toContain(token);
      }
      expect(content).not.toContain('For codebase questions, first use Graphify');
    }
  });

  test('parent SCALE plan registers brainstorm and ideate consumers with 80/20 boundary', () => {
    const plan = read('docs/01-需求分析/13.scale-integration/spec-first内化集成scale-project-scaffold技术方案.md');

    expect(plan).toContain('spec-brainstorm');
    expect(plan).toContain('spec-ideate');
    expect(plan).toContain('context orientation only');
    expect(plan).toContain('conversation-first');
    expect(plan).toContain('project-graph use is optional orientation');
  });
});
