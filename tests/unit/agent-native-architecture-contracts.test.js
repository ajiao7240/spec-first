'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/agent-native-architecture/SKILL.md');
const AUDIT_SKILL_PATH = path.join(REPO_ROOT, 'skills/agent-native-audit/SKILL.md');
const REFERENCES_DIR = path.join(REPO_ROOT, 'skills/agent-native-architecture/references');
const CHECKLISTS_PATH = path.join(REFERENCES_DIR, 'checklists.md');
const GOVERNANCE_PATH = path.join(REPO_ROOT, 'src/cli/contracts/dual-host-governance/skills-governance.json');
const GUARDRAILS_PATH = path.join(REFERENCES_DIR, 'runtime-production-guardrails.md');
const TESTING_PATH = path.join(REFERENCES_DIR, 'agent-native-testing.md');
const MCP_TOOL_DESIGN_PATH = path.join(REFERENCES_DIR, 'mcp-tool-design.md');
const PRODUCT_IMPLICATIONS_PATH = path.join(REFERENCES_DIR, 'product-implications.md');
const SELF_MODIFICATION_PATH = path.join(REFERENCES_DIR, 'self-modification.md');
const REVIEWER_AGENT_PATH = path.join(REPO_ROOT, 'agents/spec-agent-native-reviewer.agent.md');
const BEST_PRACTICES_RESEARCHER_PATH = path.join(REPO_ROOT, 'agents/spec-best-practices-researcher.agent.md');
const PERSONA_CATALOG_PATH = path.join(REPO_ROOT, 'skills/spec-code-review/references/persona-catalog.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function sectionBetween(content, startMarker, endMarker) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker, start + startMarker.length);

  expect(start).not.toBe(-1);
  expect(end).not.toBe(-1);

  return content.slice(start, end);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function numberedBoldLabels(section) {
  return Array.from(section.matchAll(/^\d+\.\s+\*\*(.+?)\*\*/gm), (match) => match[1]);
}

function expectNoPublicAgentNativeCommandReference(content) {
  expect(content).not.toContain('`/agent-native-architecture`');
  expect(content).not.toMatch(/(^|[^A-Za-z0-9_.-])\/agent-native-architecture\b/);
}

describe('agent-native-architecture contracts', () => {
  test('source skill declares internal invocation and runtime/source boundaries', () => {
    const skill = read(SKILL_PATH);
    const governance = JSON.parse(read(GOVERNANCE_PATH));
    const targetGovernance = governance.skills.find((entry) => entry.skill_name === 'agent-native-architecture');

    expect(targetGovernance).toMatchObject({
      entry_surface: 'internal_only',
      command_name: null,
      host_delivery: {
        claude: 'internal',
        codex: 'internal',
      },
    });

    [
      '## Purpose',
      '## Invocation Boundary',
      '## When To Use',
      '## When Not To Use',
      '## Inputs',
      '## Outputs',
      '## Workflow',
      '## Failure Modes',
      '## Runtime/Source Boundary',
    ].forEach((heading) => {
      expect(skill).toContain(heading);
    });

    expect(skill).toContain('internal architecture reference/helper');
    expect(skill).toContain('not a public `$spec-*` or `/spec:*` workflow');
    expect(skill).toContain('Generated runtime mirrors are not source-of-truth');
    expectNoPublicAgentNativeCommandReference(skill);
  });

  test('source skill preserves identity and core agent-native architecture principles', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: agent-native-architecture');
    expect(skill).toContain('### 1. Parity');
    expect(skill).toContain('### 2. Granularity');
    expect(skill).toContain('### 3. Composability');
    expect(skill).toContain('### 4. Emergent Capability');
    expect(skill).toContain('### 5. Improvement Over Time');

    expect(skill).toContain('Whatever the user can do through the UI, the agent should be able to achieve through tools.');
    expect(skill).toContain('Features are outcomes achieved by an agent operating in a loop.');
    expect(skill).toContain('Can you add a new feature by writing a new prompt section, without adding new code?');
  });

  test('source skill exposes canonical taxonomy for adjacent assets', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('## Canonical Taxonomy');
    [
      'Action parity',
      'Primitive tools',
      'Shared workspace',
      'Context injection',
      'Prompt-native features',
      'Production guardrails',
      'Eval readiness',
    ].forEach((term) => {
      expect(skill).toContain(term);
    });
  });

  test('source skill preserves intake routing and architecture checklist contracts', () => {
    const skill = read(SKILL_PATH);
    const checklists = read(CHECKLISTS_PATH);

    expect(skill).toContain('## What aspect of agent-native architecture do you need help with?');
    expect(skill).toContain('1. **Design architecture**');
    expect(skill).toContain('13. **Refactoring**');
    expect(skill).toContain('**Wait for response before proceeding.**');

    const routing = sectionBetween(skill, '<routing>', '</routing>');

    expect(skill).toContain('Read `references/architecture-patterns.md`');
    expect(skill).toContain('Read `references/architecture-patterns.md` and `references/checklists.md`');
    expect(skill).toContain('Read `references/mcp-tool-design.md`');
    expect(skill).toContain('Read `references/agent-native-testing.md`');
    expect(skill).toContain('references/checklists.md');
    expect(routing).toContain('production');
    expect(routing).toContain('external api');
    expect(routing).toContain('references/runtime-production-guardrails.md');
    expect(skill).not.toContain('<architecture_checklist>');
    expect(skill).not.toContain('<anti_patterns>');
    expect(skill).not.toContain('<success_criteria>');

    expect(checklists).toContain('## Architecture Review Checklist');
    expect(checklists).toContain('## Anti-Patterns');
    expect(checklists).toContain('## Success Criteria');
    expect(checklists).toContain('**CRUD Completeness:** Every entity has create, read, update, AND delete');
    expect(checklists).toContain('**Completion Signals:** Agent has explicit `complete_task` tool');
    expect(checklists).toContain('THE CARDINAL SIN');
    expect(checklists).toContain('The Ultimate Test');
  });

  test('runtime transforms preserve host-specific naming and core contracts', () => {
    const sourceSkill = read(SKILL_PATH);
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    const claudeRuntime = claude.transformSkillContent(sourceSkill);
    const codexRuntime = codex.transformSkillContent(sourceSkill, {
      skillName: 'agent-native-architecture',
    });

    expect(claudeRuntime).toContain('name: agent-native-architecture');
    expect(codexRuntime).toContain('name: agent-native-architecture');
    expect(claudeRuntime).toContain('references/checklists.md');
    expect(codexRuntime).toContain('references/checklists.md');
    expect(claudeRuntime).not.toContain('compound-engineering');
    expect(codexRuntime).not.toContain('compound-engineering');
  });

  test('reference examples avoid dated provider model ids', () => {
    const references = fs.readdirSync(REFERENCES_DIR)
      .filter((entry) => entry.endsWith('.md'))
      .map((entry) => read(path.join(REFERENCES_DIR, entry)))
      .join('\n');

    expect(references).not.toMatch(/claude-3-/);
    expect(references).not.toMatch(/claude-sonnet-4-\d{8}/);
    expect(references).not.toMatch(/claude-opus-4-\d{8}/);
    expect(references).toContain('Config.models.fast');
    expect(references).toContain('Config.models.frontier');
  });

  test('production guardrails reference is discoverable and provider-neutral', () => {
    const skill = read(SKILL_PATH);
    const checklists = read(CHECKLISTS_PATH);
    const testing = read(TESTING_PATH);
    const mcpToolDesign = read(MCP_TOOL_DESIGN_PATH);
    const productImplications = read(PRODUCT_IMPLICATIONS_PATH);
    const selfModification = read(SELF_MODIFICATION_PATH);
    const guardrails = read(GUARDRAILS_PATH);

    expect(skill).toContain('references/runtime-production-guardrails.md');
    expect(checklists).toContain('runtime-production-guardrails.md');
    [testing, mcpToolDesign, productImplications, selfModification].forEach((reference) => {
      expect(reference).toContain('runtime-production-guardrails.md');
    });

    [
      'Workspace authority and sandbox boundaries',
      'Least privilege',
      'Secret redaction',
      'Network and firewall posture',
      'Approval by stakes and reversibility',
      'Audit logs and tracing',
      'Checkpoints and rollback',
      'Completion semantics',
      'Human-in-the-loop escalation',
      'Eval gates',
    ].forEach((category) => {
      expect(guardrails).toContain(category);
    });

    expect(guardrails).toContain('Provider notes are advisory pressure, not spec-first contract fields.');
    expect(guardrails).not.toMatch(/comprehensive security/i);
  });
});

describe('agent-native-audit deterministic prompt drift contracts', () => {
  test('agent-native-audit points to the stable action parity source and shared workspace label', () => {
    const auditSkill = read(AUDIT_SKILL_PATH);
    const governance = JSON.parse(read(GOVERNANCE_PATH));
    const auditGovernance = governance.skills.find((entry) => entry.skill_name === 'agent-native-audit');

    expect(auditGovernance).toMatchObject({
      entry_surface: 'internal_only',
      command_name: null,
      host_delivery: {
        claude: 'internal',
        codex: 'internal',
      },
    });

    expect(auditSkill).toContain('1. **Action Parity**');
    expect(auditSkill).toContain('read `skills/agent-native-architecture/SKILL.md`');
    expect(auditSkill).toContain('skills/agent-native-architecture/references/action-parity-discipline.md');
    expect(auditSkill).not.toMatch(/option \d+ \(Action parity\)/i);
    expect(auditSkill).toContain('Audit for SHARED WORKSPACE - "Agent and user work in the same data space"');
    expectNoPublicAgentNativeCommandReference(auditSkill);
    expect(auditSkill).not.toContain('Select option 1 (action parity)');
    expect(auditSkill).not.toContain('Select option 7 (action parity)');
    expect(auditSkill).not.toContain('SHARED WORKSPASpec-First');
  });

  test('adjacent assets map to agent-native-architecture canonical taxonomy', () => {
    const auditSkill = read(AUDIT_SKILL_PATH);
    const reviewerAgent = read(REVIEWER_AGENT_PATH);
    const researcherAgent = read(BEST_PRACTICES_RESEARCHER_PATH);
    const personaCatalog = read(PERSONA_CATALOG_PATH);
    const adjacentAssets = [
      auditSkill,
      reviewerAgent,
      researcherAgent,
      personaCatalog,
    ].join('\n');

    expect(auditSkill).toContain('canonical taxonomy from `skills/agent-native-architecture/SKILL.md`');
    expect(reviewerAgent).toContain('maps its review categories to the `agent-native-architecture` canonical taxonomy');
    expect(researcherAgent).toContain('AI/Agents → `skills/agent-native-architecture/SKILL.md`');
    expect(researcherAgent).toContain('current source checkout path `skills/<skill-name>/SKILL.md`');
    expect(researcherAgent).toContain('curated internal source');
    expect(personaCatalog).toContain('agent-native-architecture canonical taxonomy');
    expect(adjacentAssets).not.toContain('spec-agent-native-architecture');
  });

  test('adjacent taxonomy adapters map every local principle label', () => {
    const auditSkill = read(AUDIT_SKILL_PATH);
    const reviewerAgent = read(REVIEWER_AGENT_PATH);
    const auditSection = sectionBetween(auditSkill, '## Core Principles to Audit', '## Workflow');
    const reviewerSection = sectionBetween(reviewerAgent, '## Core Principles', '## Review Process');

    expect(numberedBoldLabels(auditSection)).toEqual([
      'Action Parity',
      'Tools as Primitives',
      'Context Injection',
      'Shared Workspace',
      'CRUD Completeness',
      'UI Integration',
      'Capability Discovery',
      'Prompt-Native Features',
    ]);

    numberedBoldLabels(auditSection).forEach((label) => {
      expect(auditSection).toMatch(new RegExp(`\\*\\*${escapeRegExp(label)}\\*\\* maps to \\*\\*`));
    });

    expect(numberedBoldLabels(reviewerSection)).toEqual([
      'Action Parity',
      'Context Parity',
      'Shared Workspace',
      'Primitives over Workflows',
      'Dynamic Context Injection',
    ]);

    numberedBoldLabels(reviewerSection).forEach((label) => {
      expect(reviewerSection).toMatch(new RegExp(`\\b${escapeRegExp(label)}\\b[^.\\n]*\\bmap`, 'i'));
    });
  });
});
