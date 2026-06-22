'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const {
  buildFilteredAssetSet,
  loadPluginManifest,
} = require('../../src/cli/plugin');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_DIR = path.join(REPO_ROOT, 'skills', 'spec-prd');
const SKILL_PATH = path.join(SKILL_DIR, 'SKILL.md');
const EVIDENCE_TOPOLOGY_PATH = path.join(SKILL_DIR, 'references', 'evidence-and-topology.md');
const DOMAIN_LANGUAGE_PATH = path.join(SKILL_DIR, 'references', 'domain-language-and-decision-ledger.md');
const GRILL_WITH_DOCS_INTEGRATION_PATH = path.join(SKILL_DIR, 'references', 'grill-with-docs-integration.md');
const OUTPUT_TEMPLATE_PATH = path.join(SKILL_DIR, 'references', 'prd-output-template.md');
const READINESS_PATH = path.join(SKILL_DIR, 'references', 'prd-readiness-lens.md');
const GLOSSARY_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'domain-glossary.md');
const DRIFT_SCRIPT_PATH = path.join(SKILL_DIR, 'scripts', 'check-glossary-drift.js');
const PRD_ARTIFACT_SCRIPT_PATH = path.join(SKILL_DIR, 'scripts', 'check-prd-artifact.js');
const EVAL_RUNNER_PATH = path.join(SKILL_DIR, 'scripts', 'run-evals.js');
const EVALS_PATH = path.join(SKILL_DIR, 'evals', 'examples.json');
const GOVERNANCE_PATH = path.join(
  REPO_ROOT,
  'src',
  'cli',
  'contracts',
  'dual-host-governance',
  'skills-governance.json',
);
const COMMAND_PATH = path.join(REPO_ROOT, 'templates', 'claude', 'commands', 'spec', 'prd.md');
const USING_SPEC_FIRST_PATH = path.join(REPO_ROOT, 'skills', 'using-spec-first', 'SKILL.md');
const SPEC_PLAN_PATH = path.join(REPO_ROOT, 'skills', 'spec-plan', 'SKILL.md');
const SPEC_PLAN_PLANNING_FLOW_PATH = path.join(REPO_ROOT, 'skills', 'spec-plan', 'references', 'planning-flow.md');
const HUMAN_TEMPLATE_INDEX_PATH = path.join(REPO_ROOT, 'docs', '需求文档模版', '标准模版', 'README.md');
const HUMAN_TEMPLATE_CORE_PATH = path.join(REPO_ROOT, 'docs', '需求文档模版', '标准模版', '00-通用增量需求模板.md');
const FRESH_SOURCE_EVAL_DOMAIN_GRILL_PATH = path.join(
  REPO_ROOT,
  'docs',
  'validation',
  'spec-prd',
  'fresh-source-eval-2026-06-03-domain-grill.md',
);
const FRESH_SOURCE_EVAL_SIMPLICITY_PATH = path.join(
  REPO_ROOT,
  'docs',
  'validation',
  'spec-prd',
  'fresh-source-eval-2026-06-04-simplicity-refactor.md',
);
const FRESH_SOURCE_EVAL_SANITIZATION_FEATURE_SLICES_PATH = path.join(
  REPO_ROOT,
  'docs',
  'validation',
  'spec-prd',
  'fresh-source-eval-2026-06-05-sanitization-feature-slices.md',
);
const FRESH_SOURCE_EVAL_SANITIZATION_FEATURE_SLICES_SUCCESSOR_PATH = path.join(
  REPO_ROOT,
  'docs',
  'validation',
  'spec-prd',
  'fresh-source-eval-2026-06-21-sanitization-feature-slices-topology.md',
);
const FRESH_SOURCE_EVAL_REQUIREMENTS_GRILL_PATH = path.join(
  REPO_ROOT,
  'docs',
  'validation',
  'spec-prd',
  'fresh-source-eval-2026-06-22-requirements-grill.md',
);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

function expectContainsAll(content, snippets) {
  for (const snippet of snippets) {
    expect(content).toContain(snippet);
  }
}

function extractMarkdownSection(content, heading) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  expect(start).toBeGreaterThanOrEqual(0);

  const level = heading.match(/^#+/)[0].length;
  const nextHeading = new RegExp(`^#{1,${level}}\\s+`);
  const end = lines.findIndex((line, index) => index > start && nextHeading.test(line));
  return lines.slice(start, end === -1 ? lines.length : end).join('\n');
}

function findEvalCase(examples, id) {
  const entry = examples.cases.find((candidate) => candidate.id === id);
  expect(entry).toBeTruthy();
  return entry;
}

function expectEvalCase(examples, id, contract) {
  const entry = findEvalCase(examples, id);
  const expectedText = entry.expected.join('\n');

  expect(entry.coverage_tags).toEqual(expect.arrayContaining(contract.tags));
  for (const snippet of contract.expected) {
    expect(expectedText).toContain(snippet);
  }
}

function expectCoverageTags(examples, tags) {
  const availableTags = new Set(examples.cases.flatMap((entry) => entry.coverage_tags || []));
  for (const tag of tags) {
    expect(availableTags.has(tag)).toBe(true);
  }
}

function expectQualityBuckets(examples, buckets) {
  const availableBuckets = new Set(examples.cases.flatMap((entry) => entry.quality_buckets || []));
  for (const bucket of buckets) {
    expect(availableBuckets.has(bucket)).toBe(true);
  }
}

function expectEvalCaseStructure(examples) {
  const ids = new Set();
  const caseTypes = new Set(examples.case_contract.case_types);
  const mustNotRequiredBuckets = new Set(examples.case_contract.must_not_required_quality_buckets);
  for (const entry of examples.cases) {
    expect(typeof entry.id).toBe('string');
    expect(entry.id.length).toBeGreaterThan(0);
    expect(ids.has(entry.id)).toBe(false);
    ids.add(entry.id);
    expect(['create', 'refine', 'validate', 'route-out', 'bypass']).toContain(entry.intent);
    expect(caseTypes.has(entry.case_type)).toBe(true);
    expect(Array.isArray(entry.quality_buckets)).toBe(true);
    expect(entry.quality_buckets.length).toBeGreaterThan(0);
    const requiresMustNot = entry.quality_buckets.some((bucket) => mustNotRequiredBuckets.has(bucket));
    if (requiresMustNot) {
      expect(Array.isArray(entry.must_not)).toBe(true);
      expect(entry.must_not.length).toBeGreaterThan(0);
    }
    expect(typeof entry.input_shape).toBe('string');
    expect(entry.input_shape.length).toBeGreaterThan(0);
    expect(Array.isArray(entry.expected)).toBe(true);
    expect(entry.expected.length).toBeGreaterThan(0);
    expect(Array.isArray(entry.coverage_tags)).toBe(true);
    expect(entry.coverage_tags.length).toBeGreaterThan(0);
  }
}

function listCurrentFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listCurrentFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(path.relative(REPO_ROOT, entryPath).split(path.sep).join('/'));
    }
  }

  return files.sort();
}

describe('spec-prd workflow contracts', () => {
  test('source topology stays compressed to the durable steel frame', () => {
    const files = listCurrentFiles(SKILL_DIR);
    const sourceFiles = files.filter((file) => !file.includes('/evals/'));
    const references = files.filter((file) => file.includes('/references/'));

    expect(sourceFiles).toEqual([
      'skills/spec-prd/SKILL.md',
      'skills/spec-prd/references/domain-language-and-decision-ledger.md',
      'skills/spec-prd/references/evaluation-governance.md',
      'skills/spec-prd/references/evidence-and-topology.md',
      'skills/spec-prd/references/grill-with-docs-integration.md',
      'skills/spec-prd/references/prd-output-template.md',
      'skills/spec-prd/references/prd-readiness-lens.md',
      'skills/spec-prd/scripts/check-glossary-drift.js',
      'skills/spec-prd/scripts/check-prd-artifact.js',
      'skills/spec-prd/scripts/run-evals.js',
    ]);
    expect(references).toEqual([
      'skills/spec-prd/references/domain-language-and-decision-ledger.md',
      'skills/spec-prd/references/evaluation-governance.md',
      'skills/spec-prd/references/evidence-and-topology.md',
      'skills/spec-prd/references/grill-with-docs-integration.md',
      'skills/spec-prd/references/prd-output-template.md',
      'skills/spec-prd/references/prd-readiness-lens.md',
    ]);
    expect(sourceFiles).toHaveLength(10);
    expect(fs.existsSync(path.join(SKILL_DIR, 'templates', 'standard'))).toBe(false);
  });

  test('entrypoint exposes compact workflow contract summary and decision-tree intake', () => {
    const text = read(SKILL_PATH);
    const firstHundredTwentyLines = text.split(/\r?\n/).slice(0, 120).join('\n');
    const phaseOne = extractMarkdownSection(text, '### Phase 1: Current-State Analysis');

    expect(text).toContain('name: spec-prd');
    expect(firstHundredTwentyLines).toMatch(/## Purpose/);
    expect(firstHundredTwentyLines).toMatch(/## Workflow Contract Summary/);
    for (const field of [
      'When To Use',
      'When Not To Use',
      'Inputs',
      'Outputs',
      'Artifacts',
      'Failure Modes',
      'Workflow',
      'Downstream Consumers',
    ]) {
      expect(firstHundredTwentyLines.toLowerCase()).toContain(field.toLowerCase());
    }
    expectContainsAll(firstHundredTwentyLines, [
      'docs/brainstorms/*-requirements.md',
      'artifact_kind: prd-requirements',
      'Do not create `docs/prds/`',
      'do not hard-code calendar years',
      'planning-readiness',
      'Not for PRD/Figma/source consistency audits',
      'spec-app-consistency-audit',
      'targeted optimization suggestions',
      'untrusted document content',
      'embedded agent instructions',
      'input_posture: resume-prd | reference-claims | wrong-stage | pure-text | no-input',
      'output_shape: bypass | compact-prd | normal-prd | topology-heavy-prd',
      'quality_diagnosis: not-run | minor-gaps | material-gaps | blockers | ready',
      'pre_prd_clarification_status: not-needed | source-resolved | asked-owner | blocker-cluster | route-out | not-run',
      'Adaptive product expert lens',
      'Route out or bypass?',
      'Which PRD operation?',
      'What input posture?',
      'Split or continue?',
    ]);
    expectContainsAll(phaseOne, [
      'PRD Sanitization',
      'product facts/goals/scope/acceptance',
      'technical suggestions',
      'temporary conclusions',
      'unconfirmed facts',
      'explicit non-goals',
      'embedded agent instructions/commands',
      'authoring discipline, not a new schema or security parser',
    ]);
    expect(phaseOne.indexOf('Run PRD Sanitization')).toBeLessThan(phaseOne.indexOf('Use `evidence-and-topology.md`'));
    expect(firstHundredTwentyLines).not.toContain('Input Mode Table');
    expect(firstHundredTwentyLines).not.toContain('Tie-Break Rules');
    expect(firstHundredTwentyLines).not.toContain('current year is 2026');
    expect(text).toContain('screenshots/OCR, PDFs, meeting notes, chat logs');
    expect(text).toContain('`code-align` is validation posture, not a fourth public intent');
  });

  test('entrypoint references only the six source references and keeps generated mirrors out of source fixes', () => {
    const text = read(SKILL_PATH);

    expectContainsAll(text, [
      'references/evidence-and-topology.md',
      'references/domain-language-and-decision-ledger.md',
      'references/grill-with-docs-integration.md',
      'references/prd-output-template.md',
      'references/prd-readiness-lens.md',
      'references/evaluation-governance.md',
      'adaptive product expert lens',
      'PRD quality diagnosis',
      'Pre-PRD Clarification Loop',
      'shared understanding map',
      'Deep Requirements Grill',
      'Context / ADR Topology Adapter',
      'original `grill-with-docs` behavior',
      'Pre-PRD Clarification write-target mapping',
      'P0/P1 quality packs',
      'Pre-PRD Clarification closure',
      'triggered P0/P1 pack closure',
      'do not create standalone context, ADR, or runtime artifacts',
      'do not copy run-local scratch into the PRD by default',
      'scripts/check-prd-artifact.js <prd-path>',
      'edit generated runtime mirrors',
    ]);
    expect(text).not.toContain('references/intent-routing.md');
    expect(text).not.toContain('references/current-state-analysis.md');
    expect(text).not.toContain('references/change-topology-lens.md');
    expect(text).not.toContain('references/domain-lenses.md');
    expect(text).not.toContain('templates/standard/');
  });

  test('governance and manifest expose prd as dual-host workflow command', () => {
    const governance = readJson(GOVERNANCE_PATH);
    const manifest = loadPluginManifest();
    const claudeAssets = buildFilteredAssetSet('claude');
    const codexAssets = buildFilteredAssetSet('codex');

    expect(governance.skills).toEqual(
      expect.arrayContaining([
        {
          skill_name: 'spec-prd',
          entry_surface: 'workflow_command',
          command_name: 'prd',
          host_scope: 'dual_host',
          owner_host: null,
          host_delivery: {
            claude: 'command',
            codex: 'skill',
          },
        },
      ]),
    );
    expect(read(COMMAND_PATH)).toContain('description: "Run the Spec-First PRD requirements workflow"');
    expect(read(COMMAND_PATH)).toContain('argument-hint: "[increment request, existing PRD path, or validation target]"');
    expect(read(SKILL_PATH).match(/^---\n([\s\S]*?)\n---/)[1]).not.toContain('argument-hint');
    expect(manifest.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'prd',
          filename: 'prd.md',
          skill: 'spec-prd',
        }),
      ]),
    );
    expect(claudeAssets.commands.map((command) => command.name)).toContain('prd');
    expect(claudeAssets.workflowSkills).toContain('spec-prd');
    expect(codexAssets.workflowSkills).toContain('spec-prd');
    expect(codexAssets.commands.map((command) => command.name)).not.toContain('prd');
  });

  test('evidence and topology reference preserves source truth and system-shape boundaries', () => {
    const reference = read(EVIDENCE_TOPOLOGY_PATH);

    expectContainsAll(reference, [
      'Evidence Tags',
      '`confirmed-source`',
      '`user-stated`',
      '`source-candidate`',
      '`external-research`',
      '`assumption`',
      'not a provider contract',
      'local knowledge base, code index, prior-artifact summary, or any retrieval layer',
      'Candidate source hits can guide what to read next',
      'Calibration Source Boundary',
      'PRD/user decisions as the authority for product WHAT, acceptance, scope, and non-goals',
      'project docs, SPECs, glossaries, and standards calibrate',
      'source, code, tests, and code indexes confirm current behavior',
      'prior plans, learnings, and archive cases warn about historical risks',
      'candidate modules and source refs are evidence pointers only',
      'must not infer a user goal, add a new acceptance criterion, or override an explicit PRD non-goal',
      'Current-state discovery constrains the PRD',
      '`keep`',
      '`extend`',
      '`replace`',
      '`remove`',
      '`unknown`',
      'Topology Framing Gate',
      'Framing Gate',
      'Evidence Plan',
      'Owner Question Ladder',
      'shape of the system change',
      'candidate_topologies:',
      'load_bearing_surfaces:',
      'source_of_truth_risk:',
      'producer_consumer_risk:',
      'negative_space_risk:',
      'owner_question_needed:',
      'evidence_plan:',
      'claim_or_question | surface | source_to_read_or_command | required_evidence_tag | why_load_bearing | fallback_if_unconfirmed',
      'Evidence planning is mandatory for workflow, contract, setup/runtime, migration, replace, remove, source-of-truth, generated/runtime, and mixed-surface PRDs',
      '`add`',
      '`merge`',
      '`workflow-change`',
      '`contract-change`',
      'Surface Map',
      'Producer / Artifact / Consumer',
      'Source-Of-Truth Resolution',
      'Negative Space',
      'Ask only questions that decide scope, behavior, source-of-truth, or acceptance',
      'If more than three owner questions seem necessary',
      'A current-state claim without an evidence tag cannot be treated as `confirmed-source`',
    ]);
    expect(reference).not.toContain('implementation units');
  });

  test('domain-language reference keeps normal grill bounded and deep grill integrated', () => {
    const domainLanguage = read(DOMAIN_LANGUAGE_PATH);
    const grillIntegration = read(GRILL_WITH_DOCS_INTEGRATION_PATH);
    const skill = read(SKILL_PATH);

    expectContainsAll(domainLanguage, [
      'Source-First Questioning',
      'repo-local glossary or ADR-like artifacts that actually exist',
      'Do not require a fixed `CONTEXT.md`, `docs/adr/`, or glossary directory for ordinary PRD authoring.',
      'canonical term',
      'Only capture domain-specific terms.',
      'Define what a term IS, not what it DOES.',
      'Cross-PRD Glossary Promotion',
      'docs/contracts/domain-glossary.md',
      'two or more PRDs',
      'preview-first',
      'Bounded Scenario Grill',
      'Use 1-3 concrete scenarios',
      'not a coaching script or a long interview',
      'Ask at most one question at a time.',
      'write_target: Summary | Problem Frame | Current System Snapshot | Change Delta | Requirements | Acceptance Examples',
      'This format is for asking the owner, not a third persistent field set.',
      'compress it into that section\'s existing fields and do not add new fields',
      'Do not create `CONTEXT.md`, `CONTEXT-MAP.md`, or `docs/adr/` by default in normal PRD mode',
      'Pre-PRD Clarification Loop',
      'claim -> evidence/source -> gap -> question_or_assumption -> PRD write target',
      'Progressive Detail Ladder',
      'L0 compact PRD',
      'L2 large-input Map-Reduce',
      'Large-Input Map-Reduce Discipline',
      'Map row = source_ref / claim / actor / flow / state / gap / confidence / write_target_candidate',
      'Reduce output = canonical_requirement / supporting_refs / conflicts / assumptions / load_bearing_gap / owner_question_candidate / affected_write_targets',
      'not schemas, artifacts, JSON contracts, durable PRD fields, or script output requirements',
      'Load-Bearing Gap Triage',
      'acceptance impact, behavior/scope irreversibility, number of affected PRD sections, source contradiction, and release/planning consequence',
      'Deep Requirements Grill',
      'one-question-at-a-time progression',
      'recommended answer',
      'source/code/docs/tests/contracts lookup',
      'glossary conflict challenge',
      'fuzzy term sharpening',
      'concrete scenario stress',
      'code contradiction surfacing',
      'Every load-bearing grill question must close before planning',
      'Grill-With-Docs Integration Trigger',
      'Load `grill-with-docs-integration.md`',
      'update the relevant `CONTEXT.md` inline when a project-specific term is resolved',
      'create ADRs only when the decision is hard to reverse, surprising without context, and a real tradeoff',
      'Context / ADR Topology Adapter',
      'existing `CONTEXT.md`, `CONTEXT-MAP.md`, context-specific `CONTEXT.md`, and `docs/adr/**`',
      'PRD-local persistence remains required',
      'preview-first candidate',
      'hard to reverse',
      'surprising without context',
      'reflects a real tradeoff',
    ]);
    expectContainsAll(grillIntegration, [
      'Original Behavior Contract',
      'ask exactly one question at a time',
      'wait for feedback before continuing to the next question',
      'If a question can be answered by exploring the codebase, explore the codebase instead of asking the owner.',
      'Challenge against the glossary',
      'Sharpen fuzzy language',
      'Discuss concrete scenarios',
      'Cross-reference with code',
      'create a root `CONTEXT.md` lazily when the first project-specific term is resolved',
      '`CONTEXT.md` is a glossary and nothing else',
      'update the relevant `CONTEXT.md` inline before continuing the interview',
      'Create or update an ADR only when all three conditions are true',
      'Hard to reverse',
      'Surprising without context',
      'Real tradeoff',
      'Record updated `CONTEXT.md`, `CONTEXT-MAP.md`, or ADR paths in the PRD closeout summary.',
    ]);
    expectContainsAll(skill, [
      'Bounded Scenario Grill / Domain Grill Gate',
      'PRD-local in normal mode',
      'persist results into existing PRD sections',
      'switch to `grill-with-docs-integration.md`',
    ]);
    expect(domainLanguage).not.toContain('default create `CONTEXT.md`');
    expect(domainLanguage).not.toContain('always create ADR');
  });

  test('output template owns section skeleton, surface lenses, overlays, and split topology', () => {
    const template = read(OUTPUT_TEMPLATE_PATH);
    const featureSlices = extractMarkdownSection(template, '## Feature Slices');
    const closeout = extractMarkdownSection(template, '## Closeout Summary');

    expectContainsAll(template, [
      'artifact_kind: prd-requirements',
      'docs/brainstorms/YYYY-MM-DD-NNN-<slug>-requirements.md',
      'Do not create `docs/prds/`',
      'Do not create a second packaged template tree',
      '## Output Shape',
      '`bypass`',
      '`compact-prd`',
      '`normal-prd`',
      '`topology-heavy-prd`',
      'not frontmatter, schema, or a second artifact taxonomy',
      '## Summary',
      '## Change Delta',
      '## Requirements',
      '## Acceptance Examples',
      '## Scope Boundaries',
      '## Evidence And Assumptions',
      '## Planning Recheck',
      '## Surface Lenses',
      'App',
      'H5/PC',
      'Admin',
      'Backend/Java',
      'CLI/DevTool',
      'Mixed',
      'These are surface lenses, not role taxonomies.',
      'Workflow / Skill / Runtime Quality Signals',
      'generated runtime mirror status',
      'Project-Local Overlays',
      'Missing local overlay docs are a graceful absence',
      'Do not treat template industry facts as confirmed project rules',
      'Industry Overlay Triggers',
      'only raises questions and triggers conditional sections',
      'Adaptive Product Expert Lens',
      'not an agent type',
      'current-state and code alignment',
      'this confirms current WHAT and evidence pointers, not HOW to change implementation',
      'use INVEST as an explanatory anchor',
      'use EARS or Gherkin-style wording only when it reduces ambiguity',
      'scope and handoff entropy',
      'canonical PRD quality-dimension list',
      'Embedded Standard Skeleton',
      'AE-01（对应 R-01）',
      'AE-02（对应 R-01，异常）',
      'Success Metrics are conditional',
      'reduce drift',
      'fresh-source eval status',
      'do not invent target values',
      'Use `## Planning Recheck` only when it prevents advisory evidence from being consumed as confirmed truth',
      'source-candidate, local pattern, code-index pointer',
      'required before',
      'Framing Gate',
      'Evidence Plan',
      'evidence-and-topology.md',
      'do not print the run-local Framing Gate by default',
      'PRD Quality Diagnosis And Optimization',
      'quality_diagnosis: ready | minor-gaps | material-gaps | blockers',
      'Preliminary Diagnosis',
      'Final Readiness Diagnosis',
      'Pre-PRD Clarification',
      'Rough PRD gap-to-target mapping',
      'Large-input Map-Reduce results must enter final PRD rewrite through the same section-level reducers',
      'Never treat lossy chunk summaries as source-of-truth',
      'P0 PRD Quality Packs',
      'Problem / Outcome Framing Gate',
      'Success Metrics / Measurement Readiness',
      'NFR / Constraint Pack',
      'Traceability Matrix',
      'Review / Approval Closure',
      'R -> AE -> evidence/source -> open question',
      'workflow, skill, prompt, CLI, eval, or runtime projection PRDs',
      'generated runtime mirrors untouched',
      'Never fabricate target values',
      'API/database/architecture HOW excluded from PRD requirements',
      'P1 Conditional Enrichment Packs',
      'Stakeholder / Actor Alignment',
      'Design / UX Evidence Hook',
      'Prioritization / Release Slice',
      'Change Management',
      'routes consistency audit to `spec-app-consistency-audit`',
      'Context / ADR Notes',
      'When `grill-with-docs-integration.md` is triggered',
      'preview-first promotion candidates only',
      '`not-run` is a run-local decision-card state only',
      'Do not create numeric PRD scorecards, 0-100 quality ratings, or industry hard-threshold rubrics',
      'original -> recommendation -> reason -> write target',
      'optimization suggestions',
      'final rewritten PRD',
      'no standalone quality report artifact',
      '## Feature Slices',
      '"等", "相关", "合适的", "更好", and "优化体验"',
      'implementation units, schemas, exact API fields, database tables, and task breakdown are not',
      'Producer / Artifact / Consumer',
      'New IDs continue from the maximum current number',
      'Project-local IDs such as `US-*`, `FEAT-*`, or `NFR-*`',
      'planning recheck item count',
      'uncovered requirements',
      'feature items without acceptance examples',
      'document_role: split-summary',
      'document_role: child-prd',
      'child_id:',
      'parent_spec_id:',
      'source_prd:',
      'split_summary:',
    ]);
    expectContainsAll(featureSlices, [
      'Feature Slices are context and handoff units',
      'not execution units, task packs, program slices, or sub-agent dispatch units',
      'business capability/outcome boundaries rather than code-layer partitions such as Controller/Service/DAO files',
      'feature_id:',
      'title:',
      'summary:',
      'requirement_refs:',
      'acceptance_refs:',
      'source_excerpt_or_claim:',
      'evidence:',
      'candidate_modules_or_source_refs:',
      'risk_signals:',
      'no slice without acceptance refs or an explicit trace gap',
      'candidate modules/source refs are evidence pointers, not scope authority',
      'cross-cutting concerns belong in risk signals',
      '3-7 slices is a common healthy range',
      'more than 10 slices should trigger split recommendation or owner confirmation',
    ]);
    expectContainsAll(closeout, [
      'Every PRD handoff should report',
      'seed deterministic counts and trace facts from `scripts/check-prd-artifact.js <prd-path>`',
      'planning recheck item count',
      'current-state claims without confirmed evidence',
      'When `## Feature Slices` is present',
      'PRD complexity was explicitly evaluated for slice need',
      'feature slice count and feature IDs',
      'feature-to-R/AE trace gaps',
      'cross-cutting risk count',
      'split recommendation / owner confirmation status',
      'program or execution slicing',
    ]);
    expect(template).not.toContain('templates/standard/');
    expect(template).not.toContain(`quality_${'posture'}`);
    expect(template).not.toContain('program_slice_required');
    expect(template).not.toContain('C1 监管');
    expect(template).not.toContain('securities-pm');
    expect(template).not.toContain('credit-pm');
  });

  test('readiness lens uses compound packs instead of long enumerated gate drift', () => {
    const readiness = read(READINESS_PATH);

    expectContainsAll(readiness, [
      'Reuse the existing Requirements Readiness Gate by reference',
      'Clarity & Non-ambiguity',
      'Evidence & Inference provenance',
      'Traceability & Coverage',
      'Testability',
      'Boundary integrity',
      'Planning-invention & Handoff readiness',
      'Run checks by pack',
      'Core Pack',
      'Quality Diagnosis Pack',
      'Feature Slice Pack',
      'Topology Pack',
      'Domain And Decision Pack',
      'Metrics And Overlay Pack',
      '`current-state provenance`',
      '`planning recheck visibility`',
      'source-candidate, local pattern, code-index pointer',
      '`change delta and boundary clarity`',
      '`planning-invention and trace risk`',
      '`pre-prd clarification closure`',
      '`wording and testability`',
      'INVEST, EARS, and Gherkin-style wording are optional clarity anchors, not scoring rubrics',
      '`interaction and exception readiness`',
      '`adaptive product lens fit`',
      '`canonical lens reuse`',
      '`preliminary-vs-final diagnosis`',
      "uses `prd-output-template.md`'s Adaptive Product Expert Lens as the quality-dimension source",
      '`optimization suggestion closure`',
      '`rewrite integrity`',
      'P0 Quality Floor Pack',
      '`problem-outcome closure`',
      '`metrics readiness`',
      '`nfr-constraint closure`',
      '`workflow-skill-runtime quality closure`',
      'Workflow / Skill / Runtime Quality Signals',
      'generated runtime mirrors untouched',
      '`traceability closure`',
      '`owner approval closure`',
      '`readiness_outcome`',
      '`slice identity and trace`',
      'visible mapping to Change Delta or core requirements',
      '`business capability boundary`',
      'Controller/Service/DAO files',
      '`source excerpt preservation`',
      '`cross-cutting risk visibility`',
      '`program-slice boundary`',
      'program/execution slices',
      '`topology and surface fit`',
      '`producer-consumer and source-of-truth closure`',
      '`negative-space coverage`',
      '`framing-evidence alignment`',
      '`terminology and contradiction handling`',
      '`owner-question minimality`',
      '`domain-grill and decision-note adequacy`',
      '`deep requirements grill closure`',
      '`context/adr topology adapter boundary`',
      '`context/adr artifact mode boundary`',
      'P1 Conditional Pack',
      '`stakeholder-actor closure`',
      '`design-evidence closure`',
      '`release-slice closure`',
      '`change-management closure`',
      '`goal-measurability`',
      '`internal-tool quality signals`',
      'internal workflow/skill/runtime quality signals',
      '`project-local overlay check`',
      'Frontmatter `status` is document lifecycle posture',
      '`question`, `recommended_answer`, `source_tag`, `chosen_answer`, `consequence`, and `deferred_reason`',
      'readiness must not require `CONTEXT.md`, `CONTEXT-MAP.md`, or `docs/adr/` in normal PRD mode',
      'check-prd-artifact.js',
      'spec-prd-artifact-check.v1',
      'script-owned facts',
      'handoff entropy check',
      'unresolved framing risks',
      'do not introduce a second evidence enum',
      'ready-for-planning',
      'doc-review',
      'check-glossary-drift.js',
      'avoid_term_used',
    ]);
    expect(readiness).not.toContain('Always Gate');
    expect(readiness).not.toContain('`current-state accuracy`');
  });

  test('human template mirror points to the embedded runtime skeleton instead of a second template tree', () => {
    const templateIndex = read(HUMAN_TEMPLATE_INDEX_PATH);
    const humanCore = read(HUMAN_TEMPLATE_CORE_PATH);
    const runtimeTemplate = read(OUTPUT_TEMPLATE_PATH);

    expect(templateIndex).toContain('human-facing 标准模板库');
    expect(templateIndex).toContain('skills/spec-prd/references/prd-output-template.md');
    expect(templateIndex).toContain('embedded runtime skeleton');
    expect(templateIndex).toContain('不作为 packaged runtime 的必需读取路径');
    expect(templateIndex).not.toContain('skills/spec-prd/templates/standard/');
    for (const section of [
      'Summary',
      'Change Delta',
      'Requirements',
      'Acceptance Examples',
      'Scope Boundaries',
      'Evidence And Assumptions',
    ]) {
      expect(humanCore).toContain(section);
      expect(runtimeTemplate).toContain(section);
    }
    for (const surface of ['App', 'Admin', 'Backend', 'H5/PC', 'CLI/DevTool', 'Mixed']) {
      expect(runtimeTemplate).toContain(surface);
    }
    // 人类镜像的证据 tag 词表必须与 runtime 脚本枚举(check-prd-artifact.js EVIDENCE_TAGS)一致,
    // 且不得保留已废弃的 stale 词 gitnexus-pointer。仅守 evidence-tag 词表,
    // 不约束 README 声明的证券行业列/C1-C12 清单等项目本地 overlay。
    for (const tag of ['confirmed-source', 'user-stated', 'source-candidate', 'external-research', 'assumption']) {
      expect(humanCore).toContain(tag);
    }
    expect(humanCore).not.toContain('gitnexus-pointer');
  });

  test('routing and downstream plan intake know prd-requirements boundaries', () => {
    const usingSpecFirst = read(USING_SPEC_FIRST_PATH);
    const specPlan = `${read(SPEC_PLAN_PATH)}\n${read(SPEC_PLAN_PLANNING_FLOW_PATH)}`;

    expectContainsAll(usingSpecFirst, [
      'brownfield PRD authoring, existing PRD refinement, or code-aware PRD validation',
      'PRD/readiness tie-break',
      'can this PRD go to planning without inventing WHAT?',
      '/spec:prd',
      '$spec-prd',
      '0-1 product idea',
      'spec-app-consistency-audit',
    ]);
    expectContainsAll(specPlan, [
      '`artifact_kind: prd-requirements`',
      'PRD-grade requirements origin',
      'inherit the existing `spec_id`',
      'R/F/AE',
      'Scope Boundaries',
      'Evidence And Assumptions',
      'trace self-check summary',
      '`US-*` / `FEAT-*` / `NFR-*`',
      '`## Feature Slices`',
      'preserve feature IDs',
      'requirement refs',
      'acceptance refs',
      'source/evidence pointers',
      'PRD-origin trace, not a new planning-owned artifact class',
      'missing slice acceptance',
      'missing slice source',
      'missing slice scope',
      'do not copy the full `spec-prd` readiness lens or Feature Slice Pack',
      'do not generate program slices or task packs during planning',
      '`document_role: split-summary`',
      '`document_role: child-prd`',
      'child_id',
      'parent_spec_id',
    ]);
  });

  test('eval fixtures cover routing, evidence, readiness, and helper boundary cases', () => {
    const examples = readJson(EVALS_PATH);
    const serialized = JSON.stringify(examples);

    expect(examples.schema_version).toBe('spec-prd-evals.v1');
    expect(examples.case_contract).toMatchObject({
      schema_version: 'spec-prd-eval-case-contract.v1',
      boundary: expect.stringContaining('deterministic coverage evidence only'),
    });
    expect(examples.case_contract.case_types).toEqual(expect.arrayContaining([
      'positive',
      'boundary',
      'route-out',
      'failure',
      'adversarial',
      'source-candidate',
    ]));
    expect(examples.cases.length).toBeGreaterThanOrEqual(70);
    expectEvalCaseStructure(examples);
    expectCoverageTags(examples, [
      'trigger',
      'boundary',
      'expected',
      'failure',
      'pre-prd-clarification',
      'source-first',
      'large-input',
      'map-reduce',
      'deep-requirements-grill',
      'grill-with-docs',
      'p0-pack',
      'p1-pack',
      'topology-adapter',
      'readiness',
      'progressive-detail',
      'workflow-runtime-quality',
      'source-candidate-recheck',
    ]);
    expectQualityBuckets(examples, [
      'brownfield-create',
      'refine',
      'validate',
      'route-out',
      'wrong-stage',
      'source-candidate',
      'prompt-injection',
      'oversized-split',
      'glossary-advisory',
      'readiness-fail',
      'failure',
      'adversarial',
    ]);
    expectEvalCase(examples, 'quality-diagnosis-canonical-name', {
      tags: ['trigger', 'boundary'],
      expected: [
        'quality_diagnosis as the single emitted diagnosis field',
        'not-run only in run-local decision card',
        'no competing diagnosis field',
      ],
    });
    expectEvalCase(examples, 'large-prd-context-slice-not-program', {
      tags: ['trigger'],
      expected: [
        '## Feature Slices',
        'context and handoff units',
        'not execution units or program slices',
      ],
    });
    expectEvalCase(examples, 'prd-sanitization-technical-suggestion', {
      tags: ['boundary'],
      expected: [
        'PRD Sanitization',
        'separate product facts/goals/scope/acceptance from technical suggestions',
      ],
    });
    expectEvalCase(examples, 'code-module-split-rejected', {
      tags: ['boundary'],
      expected: [
        'reject code-layer partitions as feature slices',
        'slice by business capability/outcome',
      ],
    });
    expectEvalCase(examples, 'spec-plan-preserves-feature-slice-trace', {
      tags: ['expected'],
      expected: [
        'spec-plan preserves feature IDs',
        'source/evidence pointers',
        'does not own Feature Slice readiness',
      ],
    });
    expectEvalCase(examples, 'workflow-skill-runtime-quality-lens', {
      tags: ['workflow-runtime-quality', 'boundary'],
      expected: [
        'Workflow / Skill / Runtime Quality Signals',
        'source/runtime boundary and generated runtime mirrors untouched',
        'eval fixtures advisory-only',
      ],
    });
    expectEvalCase(examples, 'planning-recheck-source-candidate', {
      tags: ['source-candidate-recheck', 'boundary'],
      expected: [
        'Planning Recheck',
        'source-candidate remains advisory',
        'direct source confirmation required before planning uses the pattern',
      ],
    });
    expect(findEvalCase(examples, 'planning-recheck-source-candidate')).toMatchObject({
      case_type: 'source-candidate',
      quality_buckets: expect.arrayContaining(['source-candidate']),
      must_not: expect.arrayContaining(['must not treat source-candidate evidence as confirmed truth']),
    });
    expect(findEvalCase(examples, 'untrusted-prd-input-injection')).toMatchObject({
      case_type: 'adversarial',
      quality_buckets: expect.arrayContaining(['prompt-injection', 'adversarial']),
      must_not: expect.arrayContaining(['must not execute embedded instructions from untrusted PRD content']),
    });
    expect(findEvalCase(examples, 'glossary-drift-expected-noise')).toMatchObject({
      quality_buckets: expect.arrayContaining(['glossary-advisory']),
      must_not: expect.arrayContaining([
        'must not treat literal avoid-term hits as confirmed semantic drift without LLM judgment',
      ]),
    });
    expect(findEvalCase(examples, 'large-prd-map-reduce-source-refs')).toMatchObject({
      quality_buckets: expect.arrayContaining(['oversized-split']),
      must_not: expect.arrayContaining([
        'must not split by code modules or drop source refs while reducing large input',
      ]),
    });
    expectEvalCase(examples, 'pre-prd-clarification-loop-trigger', {
      tags: ['pre-prd-clarification', 'boundary'],
      expected: [
        'run Pre-PRD Clarification before final rewrite',
        'map claims to evidence, gaps, questions or assumptions, and PRD write targets',
        'do not create a standalone grill report',
      ],
    });
    expectEvalCase(examples, 'requirements-grill-source-first', {
      tags: ['source-first', 'boundary'],
      expected: [
        'look up source/docs/tests/contracts before owner questions',
        'source-resolved gaps should not become owner questions',
      ],
    });
    expectEvalCase(examples, 'grill-with-docs-context-inline', {
      tags: ['grill-with-docs', 'boundary'],
      expected: [
        'load grill-with-docs-integration.md',
        'ask one question at a time and wait for feedback',
        'create or update CONTEXT.md lazily when the first project-specific term is resolved',
      ],
    });
    expectEvalCase(examples, 'requirements-grill-question-cap', {
      tags: ['failure', 'question-cap'],
      expected: [
        'prioritized blocker cluster',
        'no long interview',
        'not ready-for-planning',
      ],
    });
    expectEvalCase(examples, 'requirements-grill-context-artifact-triggered', {
      tags: ['boundary', 'grill-with-docs'],
      expected: [
        'load grill-with-docs-integration.md',
        'persist resolution in PRD-local sections',
        'update CONTEXT.md inline for resolved project-specific terms',
      ],
    });
    expectEvalCase(examples, 'large-prd-map-reduce-source-refs', {
      tags: ['large-input', 'map-reduce'],
      expected: [
        'preserve source_ref through Map and Reduce',
        'surface cross-chunk conflicts',
        'do not treat lossy summaries as source-of-truth',
      ],
    });
    expectEvalCase(examples, 'huge-prd-cross-chunk-conflict', {
      tags: ['failure', 'map-reduce'],
      expected: [
        'group conflicting chunks by exception, release, and PRD section',
        'preserve conflicting supporting_refs',
        'route unresolved conflict to owner question or blocker',
      ],
    });
    expectEvalCase(examples, 'deep-grill-seven-actions', {
      tags: ['deep-requirements-grill'],
      expected: [
        'ask one question at a time',
        'perform source-first lookup',
        'surface code contradictions with consequences',
      ],
    });
    expectEvalCase(examples, 'deep-grill-closure-blocks-readiness', {
      tags: ['failure', 'readiness'],
      expected: [
        'load-bearing grill questions must close before planning',
        'unresolved questions block ready-for-planning',
      ],
    });
    expectEvalCase(examples, 'success-metrics-no-invention', {
      tags: ['p0-pack', 'boundary'],
      expected: [
        'write observable signals, assumptions, or Outstanding Questions',
        'do not invent target values',
      ],
    });
    expectEvalCase(examples, 'internal-tool-success-metrics-signals', {
      tags: ['p0-pack', 'workflow-runtime-quality'],
      expected: [
        'Goals / Success Metrics',
        'observable signals for hot-path load, output-drift cases, contract anchors, runtime projection checks, advisory fixture coverage, and fresh-source eval status',
        'no invented target values',
      ],
    });
    expectEvalCase(examples, 'readiness-outcome-draft-status', {
      tags: ['readiness', 'boundary'],
      expected: [
        'frontmatter status is document lifecycle posture',
        'readiness_outcome: ready-for-planning',
        'draft does not by itself block planning',
      ],
    });
    expectEvalCase(examples, 'nfr-constraint-product-not-how', {
      tags: ['p0-pack', 'boundary'],
      expected: [
        'keep constraints product-level',
        'exclude API/database/architecture HOW from PRD requirements',
      ],
    });
    expectEvalCase(examples, 'owner-closure-summary', {
      tags: ['p0-pack', 'closure'],
      expected: [
        'summarize owner answers, accepted assumptions, and blockers',
        'do not create a separate approval artifact',
      ],
    });
    expectEvalCase(examples, 'actor-alignment-conditional', {
      tags: ['p1-pack'],
      expected: [
        'separate beneficiary, operator, admin, downstream consumer, and owner',
        'run only when actor distinctions affect WHAT or acceptance',
      ],
    });
    expectEvalCase(examples, 'context-map-routing', {
      tags: ['topology-adapter'],
      expected: [
        'read existing CONTEXT-MAP.md as advisory routing evidence',
        'ask at most one context routing question when ownership is ambiguous',
        'do not require topology creation',
      ],
    });
    expectEvalCase(examples, 'context-glossary-conflict', {
      tags: ['topology-adapter'],
      expected: [
        'surface glossary conflict',
        'resolve in PRD-local Glossary or Decision Notes first',
      ],
    });
    expectEvalCase(examples, 'adr-promotion-three-conditions', {
      tags: ['topology-adapter'],
      expected: [
        'suggest ADR promotion only for hard-to-reverse, surprising tradeoffs',
        'routine decisions stay in Decision Notes',
      ],
    });
    expect(serialized).not.toContain(`quality_${'posture'}`);
    expect(serialized).not.toContain('executed eval runner');
    expect(examples.source_refs).toEqual([
      'skills/spec-prd/SKILL.md',
      'skills/spec-prd/references/evidence-and-topology.md',
      'skills/spec-prd/references/domain-language-and-decision-ledger.md',
      'skills/spec-prd/references/grill-with-docs-integration.md',
      'skills/spec-prd/references/prd-output-template.md',
      'skills/spec-prd/references/prd-readiness-lens.md',
    ]);
  });

  test('eval runner reports deterministic fixture contract facts', () => {
    const passed = JSON.parse(execFileSync('node', [EVAL_RUNNER_PATH, '--json'], { encoding: 'utf8' }));

    expect(passed).toMatchObject({
      schema_version: 'spec-prd-eval-run.v1',
      status: 'passed',
      reason_code: 'eval_fixture_passed',
      case_count: expect.any(Number),
      missing_required_buckets: [],
    });
    expect(passed.coverage).toMatchObject({
      'brownfield-create': expect.any(Number),
      refine: expect.any(Number),
      validate: expect.any(Number),
      'prompt-injection': expect.any(Number),
      'glossary-advisory': expect.any(Number),
    });
    expect(passed.case_types).toMatchObject({
      positive: expect.any(Number),
      boundary: expect.any(Number),
      failure: expect.any(Number),
      adversarial: expect.any(Number),
    });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-prd-eval-runner-'));
    try {
      const fixture = readJson(EVALS_PATH);
      const missingPromptInjection = {
        ...fixture,
        cases: fixture.cases.filter((entry) => (
          !(entry.quality_buckets || []).includes('prompt-injection')
        )),
      };
      const missingBucketPath = path.join(tmpDir, 'missing-bucket.json');
      fs.writeFileSync(missingBucketPath, `${JSON.stringify(missingPromptInjection, null, 2)}\n`, 'utf8');

      let missingBucketError = null;
      try {
        execFileSync('node', [EVAL_RUNNER_PATH, '--fixture', missingBucketPath, '--json'], {
          encoding: 'utf8',
          stdio: 'pipe',
        });
      } catch (err) {
        missingBucketError = err;
      }
      expect(missingBucketError).not.toBeNull();
      expect(missingBucketError.status).toBe(1);
      const failed = JSON.parse(String(missingBucketError.stdout));
      expect(failed).toMatchObject({
        status: 'failed',
        reason_code: 'fixture_contract_failed',
        missing_required_buckets: expect.arrayContaining(['prompt-injection']),
      });
      expect(failed.invalid_cases).toEqual(expect.arrayContaining([
        expect.objectContaining({ reason_code: 'required_quality_bucket_missing' }),
      ]));

      const badJsonPath = path.join(tmpDir, 'bad.json');
      fs.writeFileSync(badJsonPath, '{ bad json', 'utf8');
      let badJsonError = null;
      try {
        execFileSync('node', [EVAL_RUNNER_PATH, '--fixture', badJsonPath, '--json'], {
          encoding: 'utf8',
          stdio: 'pipe',
        });
      } catch (err) {
        badJsonError = err;
      }
      expect(badJsonError).not.toBeNull();
      expect(badJsonError.status).toBe(2);
      expect(JSON.parse(String(badJsonError.stdout))).toMatchObject({
        status: 'error',
        reason_code: 'fixture_json_invalid',
      });

      let unknownArgError = null;
      try {
        execFileSync('node', [EVAL_RUNNER_PATH, '--unknown'], { encoding: 'utf8', stdio: 'pipe' });
      } catch (err) {
        unknownArgError = err;
      }
      expect(unknownArgError).not.toBeNull();
      expect(unknownArgError.status).toBe(2);
      expect(String(unknownArgError.stderr)).toContain('reason_code=bad_arguments');
      expect(String(unknownArgError.stderr)).toContain('unknown argument: --unknown');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('domain-grill fresh-source eval artifact records an executed dispatched eval for cached-skill risk', () => {
    const artifact = read(FRESH_SOURCE_EVAL_DOMAIN_GRILL_PATH);

    expectContainsAll(artifact, [
      'fresh_source_eval:',
      'status: passed',
      'skills/spec-prd/SKILL.md',
      'skills/spec-prd/references/domain-language-and-decision-ledger.md',
      'skills/spec-prd/references/prd-readiness-lens.md',
      'skills/spec-plan/SKILL.md',
      'runtime_paths_checked: []',
      'dispatched read-only',
      'Run Provenance',
    ]);
    expect(artifact).not.toContain('status: not_run');
  });

  test('simplicity refactor eval artifact records not-run dispatch boundary without claiming pass', () => {
    const artifact = read(FRESH_SOURCE_EVAL_SIMPLICITY_PATH);

    expectContainsAll(artifact, [
      'fresh_source_eval:',
      'status: not_run',
      'skills/spec-prd/SKILL.md',
      'skills/spec-prd/references/evidence-and-topology.md',
      'skills/spec-prd/references/prd-output-template.md',
      'skills/spec-prd/references/prd-readiness-lens.md',
      'runtime_paths_checked: []',
      'The current Codex host exposes a multi-agent dispatch tool',
      'does not claim semantic eval passed',
      'generated runtime mirrors',
    ]);
    expect(artifact).not.toContain('status: passed');
  });

  test('sanitization and feature slices eval artifact records not-run dispatch boundary honestly', () => {
    const artifact = read(FRESH_SOURCE_EVAL_SANITIZATION_FEATURE_SLICES_PATH);

    expectContainsAll(artifact, [
      'fresh_source_eval:',
      'schema_version: fresh-source-eval-record.v1',
      'producer: spec-work',
      'freshness: current-worktree',
      'authority_level: advisory',
      'reason_code: fresh-source-eval-not-run',
      'consumer: spec-prd contract tests and code-review closeout',
      'status: not_run',
      'skills/spec-prd/SKILL.md',
      'skills/spec-prd/references/evidence-and-topology.md',
      'skills/spec-prd/references/prd-output-template.md',
      'skills/spec-prd/references/prd-readiness-lens.md',
      'skills/spec-prd/evals/examples.json',
      'skills/spec-plan/SKILL.md',
      'tests/unit/spec-prd-contracts.test.js',
      'tests/unit/spec-plan-contracts.test.js',
      'runtime_paths_checked: []',
      'PRD Sanitization',
      'Feature Slices',
      'quality_diagnosis',
      'does not claim semantic eval passed',
      'generated runtime mirrors',
    ]);
    expect(artifact).not.toContain('status: passed');
  });

  test('sanitization and topology successor eval artifact records dispatched pass with concern boundary', () => {
    const artifact = read(FRESH_SOURCE_EVAL_SANITIZATION_FEATURE_SLICES_SUCCESSOR_PATH);

    expectContainsAll(artifact, [
      'fresh_source_eval:',
      'schema_version: fresh-source-eval-record.v1',
      'producer: spec-work',
      'freshness: current-worktree',
      'authority_level: advisory',
      'reason_code: fresh-source-eval-dispatched',
      'consumer: spec-prd contract tests and code-review closeout',
      'status: passed-with-concerns',
      'supersedes: docs/validation/spec-prd/fresh-source-eval-2026-06-05-sanitization-feature-slices.md',
      'skills/spec-prd/SKILL.md',
      'skills/spec-prd/references/evidence-and-topology.md',
      'skills/spec-prd/references/prd-output-template.md',
      'skills/spec-prd/references/prd-readiness-lens.md',
      'skills/spec-prd/evals/examples.json',
      'runtime_paths_checked: []',
      'PRD Sanitization calibration-source separation',
      'Feature Slices',
      'Topology-heavy',
      'one minor non-blocking concern',
      'generated runtime mirrors',
    ]);
    expect(artifact).not.toContain('reason_code: fresh-source-eval-not-run');
  });

  test('requirements grill eval artifact records validation and runtime boundary honestly', () => {
    const artifact = read(FRESH_SOURCE_EVAL_REQUIREMENTS_GRILL_PATH);

    expectContainsAll(artifact, [
      'fresh_source_eval:',
      'schema_version: fresh-source-eval-record.v1',
      'producer: spec-work',
      'freshness: current-worktree',
      'authority_level: advisory',
      'reason_code: fresh-source-eval-not-run',
      'consumer: spec-prd contract tests and code-review closeout',
      'status: not_run',
      'skills/spec-prd/SKILL.md',
      'skills/spec-prd/references/domain-language-and-decision-ledger.md',
      'skills/spec-prd/references/prd-output-template.md',
      'skills/spec-prd/references/prd-readiness-lens.md',
      'skills/spec-prd/evals/examples.json',
      'tests/unit/spec-prd-contracts.test.js',
      'runtime_paths_checked: []',
      'Pre-PRD Clarification Loop',
      'large-input Map-Reduce',
      'P0/P1 PRD quality packs',
      'Context / ADR Topology Adapter',
      'does not claim semantic eval passed',
      'generated runtime mirrors',
      'sample_validation:',
      'status: not_measured',
    ]);
    expect(artifact).not.toContain('status: passed');
  });

  test('project domain glossary artifact defines the cross-PRD canonical layer with light contract', () => {
    const glossary = read(GLOSSARY_PATH);

    expectContainsAll(glossary, [
      'Project Domain Glossary',
      'canonical_name',
      'first_seen_prd',
      'referenced_by',
      'status',
      'preview-first',
      '只收领域专属术语',
      'IS not DOES',
      'docs/contracts/',
      '`avoid` 是 `spec-prd` v1 术语 drift 检测的唯一输入字段',
    ]);
    expect(glossary).toContain('source_tag');
    expect(glossary).toContain('confirmed | advisory');
    expect(glossary).toMatch(/不是.*独立的.*CONTEXT\.md/);
    expect(glossary).not.toContain('sequential numbering');
    expect(glossary).not.toContain('`aliases` / `avoid`');
  });

  test('glossary drift script reports script-owned facts and degrades when glossary is absent or empty', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glossary-drift-'));
    try {
      const prdPath = path.join(tmpDir, 'prd.md');
      fs.writeFileSync(prdPath, 'The system sends a bill to the customer.\n', 'utf8');

      const absent = JSON.parse(
        execFileSync('node', [DRIFT_SCRIPT_PATH, prdPath, '--glossary', path.join(tmpDir, 'nope.md')], {
          encoding: 'utf8',
        }),
      );
      expect(absent.glossary_status).toBe('absent');
      expect(absent.findings).toEqual([]);

      const glossaryPath = path.join(tmpDir, 'g.md');
      fs.writeFileSync(
        glossaryPath,
        '# Glossary\n### Invoice\nA request for payment.\n- avoid: bill\n- status: active\n',
        'utf8',
      );
      const hit = JSON.parse(
        execFileSync('node', [DRIFT_SCRIPT_PATH, prdPath, '--glossary', glossaryPath], { encoding: 'utf8' }),
      );
      expect(hit.glossary_status).toBe('present');
      expect(hit.findings).toHaveLength(1);
      expect(hit.findings[0]).toMatchObject({
        reason_code: 'avoid_term_used',
        term_used: 'bill',
        canonical_name: 'Invoice',
      });

      const aliasOnlyGlossaryPath = path.join(tmpDir, 'aliases-only.md');
      fs.writeFileSync(
        aliasOnlyGlossaryPath,
        '# Glossary\n### Invoice\nA request for payment.\n- aliases: bill\n- status: active\n',
        'utf8',
      );
      const aliasesOnly = JSON.parse(
        execFileSync('node', [DRIFT_SCRIPT_PATH, prdPath, '--glossary', aliasOnlyGlossaryPath], {
          encoding: 'utf8',
        }),
      );
      expect(aliasesOnly.findings).toEqual([]);

      const exampleOnly = path.join(tmpDir, 'example.md');
      fs.writeFileSync(
        exampleOnly,
        '# Glossary\n## format\n```md\n### {canonical_name}\n- avoid: bill\n```\n',
        'utf8',
      );
      const empty = JSON.parse(
        execFileSync('node', [DRIFT_SCRIPT_PATH, prdPath, '--glossary', exampleOnly], { encoding: 'utf8' }),
      );
      expect(empty.glossary_status).toBe('empty');
      expect(empty.findings).toEqual([]);

      const multiPrd = path.join(tmpDir, 'multi.md');
      fs.writeFileSync(multiPrd, 'a bill here\nanother bill\nthird bill line\n', 'utf8');
      const multi = JSON.parse(
        execFileSync('node', [DRIFT_SCRIPT_PATH, multiPrd, '--glossary', glossaryPath], { encoding: 'utf8' }),
      );
      expect(multi.findings).toHaveLength(3);
      expect(multi.findings.map((finding) => finding.line)).toEqual([1, 2, 3]);

      const symPrd = path.join(tmpDir, 'sym.md');
      fs.writeFileSync(symPrd, 'we use C++ here\n', 'utf8');
      const symGloss = path.join(tmpDir, 'symg.md');
      fs.writeFileSync(symGloss, '# G\n### Cancel\nx\n- avoid: C++\n- status: active\n', 'utf8');
      const sym = JSON.parse(
        execFileSync('node', [DRIFT_SCRIPT_PATH, symPrd, '--glossary', symGloss], { encoding: 'utf8' }),
      );
      expect(sym.findings).toHaveLength(1);
      expect(sym.findings[0].term_used).toBe('C++');

      const wordPrd = path.join(tmpDir, 'word.md');
      fs.writeFileSync(wordPrd, 'the billing system was billed\n', 'utf8');
      const word = JSON.parse(
        execFileSync('node', [DRIFT_SCRIPT_PATH, wordPrd, '--glossary', glossaryPath], { encoding: 'utf8' }),
      );
      expect(word.findings).toEqual([]);

      try {
        execFileSync('node', [DRIFT_SCRIPT_PATH, prdPath, '--glossary'], { encoding: 'utf8', stdio: 'pipe' });
        throw new Error('expected --glossary without value to fail');
      } catch (err) {
        expect(err.status).toBe(2);
        expect(String(err.stderr)).toContain('missing value for --glossary');
      }

      let extraArgError = null;
      try {
        execFileSync('node', [DRIFT_SCRIPT_PATH, prdPath, 'unexpected-extra'], { encoding: 'utf8', stdio: 'pipe' });
      } catch (err) {
        extraArgError = err;
      }
      expect(extraArgError).not.toBeNull();
      expect(extraArgError.status).toBe(2);
      expect(String(extraArgError.stderr)).toContain('unexpected extra argument');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('PRD artifact checker reports deterministic structure and trace facts', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prd-artifact-check-'));
    try {
      const goodPrd = path.join(tmpDir, 'good-requirements.md');
      fs.writeFileSync(
        goodPrd,
        [
          '---',
          'spec_id: 2026-06-20-001-good',
          'artifact_kind: prd-requirements',
          'status: draft',
          '---',
          '',
          '## Summary',
          'A brownfield increment anchored to the current system.',
          '',
          '## Change Delta',
          '| item | current | target | delta | evidence |',
          '| --- | --- | --- | --- | --- |',
          '| Import | absent | available | extend | user-stated |',
          '',
          '## Requirements',
          '| id | priority | requirement | rationale/source |',
          '| --- | --- | --- | --- |',
          '| R-01 | P0 | Users can import a CSV file. | user-stated |',
          '| R-02 | P1 | Users can see failed-row feedback after import. | assumption |',
          '',
          '## Acceptance Examples',
          'AE-01（对应 R-01）',
          'Given a valid CSV file',
          'When the user imports it',
          'Then the import result is visible',
          '',
          'AE-02（对应 R-02）',
          'Given a CSV file with invalid rows',
          'When the user imports it',
          'Then failed-row feedback is visible',
          '',
          '## Scope Boundaries',
          'No background scheduling.',
          '',
          '## Release / Operation Readiness',
          'NFR-01: Import result visibility has no new background scheduling dependency.',
          '',
          '## Evidence And Assumptions',
          '| claim | tag | source / owner | note |',
          '| --- | --- | --- | --- |',
          '| CSV import is requested. | user-stated | owner | direct request |',
          '| Failed-row feedback is desired. | assumption | owner | needs confirmation |',
          '',
          '## Outstanding Questions',
          '| question | blocks planning? | recommended default | owner |',
          '| --- | --- | --- | --- |',
          '| Should failed-row feedback show row numbers? | no | show row count only | owner |',
          '',
        ].join('\n'),
        'utf8',
      );
      const good = JSON.parse(execFileSync('node', [PRD_ARTIFACT_SCRIPT_PATH, goodPrd], { encoding: 'utf8' }));
      expect(good.schema_version).toBe('spec-prd-artifact-check.v1');
      expect(good.status).toBe('checked');
      expect(good.facts.artifact_kind).toBe('prd-requirements');
      expect(good.facts.core_sections_missing).toEqual([]);
      expect(good.facts.uncovered_requirements).toEqual([]);
      expect(good.facts.priority_distribution).toEqual({ P0: 1, P1: 1 });
      expect(good.facts.nfr_ids).toEqual(['NFR-01']);
      expect(good.facts.nfr_count).toBe(1);
      expect(good.facts.assumption_row_count).toBe(1);
      expect(good.facts.outstanding_question_count).toBe(1);
      expect(good.findings).toEqual([]);

      const badPrd = path.join(tmpDir, 'bad-requirements.md');
      fs.writeFileSync(
        badPrd,
        [
          '---',
          'spec_id: 2026-06-20-002-bad',
          'status: draft',
          '---',
          '',
          '## Summary',
          '<TODO>',
          '',
          '## Requirements',
          '| id | priority | requirement | rationale/source |',
          '| --- | --- | --- | --- |',
          '| R-01 | P0 | Users can import data. | source-candidate |',
          '',
          '## Feature Slices',
          'feature_id: F-01',
          'title: Import data',
          'requirement_refs: R-01',
          'acceptance_refs:',
          '',
        ].join('\n'),
        'utf8',
      );
      const bad = JSON.parse(execFileSync('node', [PRD_ARTIFACT_SCRIPT_PATH, badPrd], { encoding: 'utf8' }));
      expect(bad.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({ reason_code: 'artifact_kind_missing_or_wrong' }),
        expect.objectContaining({ reason_code: 'core_section_missing', section: 'Change Delta' }),
        expect.objectContaining({ reason_code: 'requirement_without_acceptance_ref', requirement_id: 'R-01' }),
        expect.objectContaining({ reason_code: 'placeholder_or_todo_present' }),
        expect.objectContaining({ reason_code: 'feature_slice_missing_acceptance_trace' }),
      ]));

      // 多余位置参数必须 exit 2 而不是静默丢弃,与 check-glossary-drift.js 的坏调用语义对齐
      let extraArgError = null;
      try {
        execFileSync('node', [PRD_ARTIFACT_SCRIPT_PATH, goodPrd, badPrd], { encoding: 'utf8', stdio: 'pipe' });
      } catch (err) {
        extraArgError = err;
      }
      expect(extraArgError).not.toBeNull();
      expect(extraArgError.status).toBe(2);
      expect(String(extraArgError.stderr)).toContain('unexpected extra argument');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
