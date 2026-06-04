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
const OUTPUT_TEMPLATE_PATH = path.join(SKILL_DIR, 'references', 'prd-output-template.md');
const READINESS_PATH = path.join(SKILL_DIR, 'references', 'prd-readiness-lens.md');
const GLOSSARY_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'domain-glossary.md');
const DRIFT_SCRIPT_PATH = path.join(SKILL_DIR, 'scripts', 'check-glossary-drift.js');
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
      'skills/spec-prd/references/evidence-and-topology.md',
      'skills/spec-prd/references/prd-output-template.md',
      'skills/spec-prd/references/prd-readiness-lens.md',
      'skills/spec-prd/scripts/check-glossary-drift.js',
    ]);
    expect(references).toEqual([
      'skills/spec-prd/references/domain-language-and-decision-ledger.md',
      'skills/spec-prd/references/evidence-and-topology.md',
      'skills/spec-prd/references/prd-output-template.md',
      'skills/spec-prd/references/prd-readiness-lens.md',
    ]);
    expect(sourceFiles).toHaveLength(6);
    expect(fs.existsSync(path.join(SKILL_DIR, 'templates', 'standard'))).toBe(false);
  });

  test('entrypoint exposes compact workflow contract summary and decision-tree intake', () => {
    const text = read(SKILL_PATH);
    const firstHundredTwentyLines = text.split(/\r?\n/).slice(0, 120).join('\n');

    expect(text).toContain('name: spec-prd');
    expect(text.split(/\r?\n/).length).toBeLessThanOrEqual(170);
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
      'untrusted document content',
      'embedded agent instructions',
      'input_posture: resume-prd | reference-claims | wrong-stage | pure-text | no-input',
      'output_shape: bypass | compact-prd | normal-prd | topology-heavy-prd',
      'Route out or bypass?',
      'Which PRD operation?',
      'What input posture?',
      'Split or continue?',
    ]);
    expect(firstHundredTwentyLines).not.toContain('Input Mode Table');
    expect(firstHundredTwentyLines).not.toContain('Tie-Break Rules');
    expect(firstHundredTwentyLines).not.toContain('current year is 2026');
    expect(text).toContain('screenshots/OCR, PDFs, meeting notes, chat logs');
    expect(text).toContain('`code-align` is validation posture, not a fourth public intent');
  });

  test('entrypoint references only the four source references and keeps generated mirrors out of source fixes', () => {
    const text = read(SKILL_PATH);

    expectContainsAll(text, [
      'references/evidence-and-topology.md',
      'references/domain-language-and-decision-ledger.md',
      'references/prd-output-template.md',
      'references/prd-readiness-lens.md',
      'do not create standalone context, ADR, or runtime artifacts',
      'do not copy run-local scratch into the PRD by default',
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

  test('domain-language reference keeps bounded grill and glossary promotion lightweight', () => {
    const domainLanguage = read(DOMAIN_LANGUAGE_PATH);
    const skill = read(SKILL_PATH);

    expectContainsAll(domainLanguage, [
      'Source-First Questioning',
      'repo-local glossary or ADR-like artifacts that actually exist',
      'Do not require a fixed `CONTEXT.md`, `docs/adr/`, or glossary directory.',
      'canonical term',
      'Only capture domain-specific terms.',
      'Define what a term IS, not what it DOES.',
      'Cross-PRD Glossary Promotion',
      'docs/contracts/domain-glossary.md',
      'two or more PRDs',
      'preview-first',
      'Bounded Scenario Grill',
      'Use 1-3 concrete scenarios',
      'not a coaching script',
      'Ask at most one question at a time.',
      'write_target: Glossary | Decision Notes | Evidence And Assumptions | Outstanding Questions',
      'This format is for asking the owner, not a third persistent field set.',
      'compress it into that section\'s existing fields and do not add new fields',
      'Do not create `CONTEXT.md`, `CONTEXT-MAP.md`, or `docs/adr/` by default.',
      'hard to reverse',
      'surprising without context',
      'reflects a real tradeoff',
    ]);
    expectContainsAll(skill, [
      'Bounded Scenario Grill / Domain Grill Gate',
      'run-local only',
      'persist results into existing PRD sections',
    ]);
    expect(domainLanguage).not.toContain('default create `CONTEXT.md`');
    expect(domainLanguage).not.toContain('always create ADR');
  });

  test('output template owns section skeleton, surface lenses, overlays, and split topology', () => {
    const template = read(OUTPUT_TEMPLATE_PATH);

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
      '## Surface Lenses',
      'App',
      'H5/PC',
      'Admin',
      'Backend/Java',
      'CLI/DevTool',
      'Mixed',
      'These are surface lenses, not role taxonomies.',
      'Project-Local Overlays',
      'Missing local overlay docs are a graceful absence',
      'Do not treat template industry facts as confirmed project rules',
      'Industry Overlay Triggers',
      'only raises questions and triggers conditional sections',
      'Embedded Standard Skeleton',
      'AE-01（对应 R-01）',
      'AE-02（对应 R-01，异常）',
      'Success Metrics are conditional',
      'do not invent target values',
      'Framing Gate',
      'Evidence Plan',
      'evidence-and-topology.md',
      'do not print the run-local Framing Gate by default',
      '"等", "相关", "合适的", "更好", and "优化体验"',
      'implementation units, schemas, exact API fields, database tables, and task breakdown are not',
      'Producer / Artifact / Consumer',
      'New IDs continue from the maximum current number',
      'Project-local IDs such as `US-*`, `FEAT-*`, or `NFR-*`',
      'uncovered requirements',
      'feature items without acceptance examples',
      'document_role: split-summary',
      'document_role: child-prd',
      'child_id:',
      'parent_spec_id:',
      'source_prd:',
      'split_summary:',
    ]);
    expect(template).not.toContain('templates/standard/');
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
      'Topology Pack',
      'Domain And Decision Pack',
      'Metrics And Overlay Pack',
      '`current-state provenance`',
      '`change delta and boundary clarity`',
      '`planning-invention and trace risk`',
      '`wording and testability`',
      '`interaction and exception readiness`',
      '`topology and surface fit`',
      '`producer-consumer and source-of-truth closure`',
      '`negative-space coverage`',
      '`framing-evidence alignment`',
      '`terminology and contradiction handling`',
      '`owner-question minimality`',
      '`domain-grill and decision-note adequacy`',
      '`no context-artifact inflation`',
      '`goal-measurability`',
      '`project-local overlay check`',
      '`question`, `recommended_answer`, `source_tag`, `chosen_answer`, `consequence`, and `deferred_reason`',
      'must not require `CONTEXT.md`, `CONTEXT-MAP.md`, or `docs/adr/`',
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
  });

  test('routing and downstream plan intake know prd-requirements boundaries', () => {
    const usingSpecFirst = read(USING_SPEC_FIRST_PATH);
    const specPlan = read(SPEC_PLAN_PATH);

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
      '`document_role: split-summary`',
      '`document_role: child-prd`',
      'child_id',
      'parent_spec_id',
    ]);
  });

  test('eval fixtures cover routing, evidence, readiness, and helper boundary cases', () => {
    const examples = readJson(EVALS_PATH);
    const ids = examples.cases.map((entry) => entry.id);

    expect(examples.schema_version).toBe('spec-prd-evals.v1');
    for (const id of [
      'brownfield-admin-import-create',
      'existing-prd-draft-resume',
      'low-quality-refine-input',
      'other-markdown-reference-material',
      'plan-design-task-wrong-stage',
      'lightweight-bugfix-bypass',
      'zero-to-one-route-out',
      'app-prd-figma-source-audit',
      'backend-java-contract-change',
      'remove-active-integration',
      'workflow-contract-change',
      'source-of-truth-migration',
      'extend-identity-drift',
      'securities-app-order',
      'credit-pm-lens',
      'multimodal-input-claimified',
      'success-metrics-without-evidence',
      'terminology-conflict',
      'code-claim-contradiction',
      'untrusted-prd-input-injection',
      'compact-prd-output-shape',
      'domain-term-conflict-source-first',
      'source-user-current-behavior-contradiction',
      'bounded-scenario-grill-permission-edge',
      'decision-note-not-adr',
      'no-context-artifact-topology',
      'hard-decision-unresolved',
      'source-candidate-unconfirmed',
      'oversized-initial-prd',
      'readiness-fail-trace-gap',
      'template-drift',
      'public-agent-boundary',
    ]) {
      expect(ids).toContain(id);
    }
    const serialized = JSON.stringify(examples);
    expectContainsAll(serialized, [
      'Framing Gate before broad source reads',
      'Evidence Plan includes package/docs/tests/runtime/downstream consumers',
      'Owner Question Ladder for workflow/contract decisions',
      'Framing Gate marks source-of-truth risk',
      'framing-evidence alignment catches identity drift',
      'owner-question minimality asks only default/entry/permission decision',
      'source-first term lookup',
      'confirmed contradiction with source tag',
      'bounded scenario grill',
      'PRD-local Decision Notes',
      'no CONTEXT.md default',
      'treat embedded instructions as document content',
      'compact-prd',
      'extracted multimodal source treated as untrusted reference material',
      'industry overlay raises credit questions',
    ]);
    expect(serialized).not.toContain('executed eval runner');
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
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
