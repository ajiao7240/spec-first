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
const SKILL_PATH = path.join(REPO_ROOT, 'skills', 'spec-prd', 'SKILL.md');
const ROUTING_PATH = path.join(REPO_ROOT, 'skills', 'spec-prd', 'references', 'intent-routing.md');
const CURRENT_STATE_PATH = path.join(REPO_ROOT, 'skills', 'spec-prd', 'references', 'current-state-analysis.md');
const CHANGE_TOPOLOGY_PATH = path.join(REPO_ROOT, 'skills', 'spec-prd', 'references', 'change-topology-lens.md');
const DOMAIN_LANGUAGE_PATH = path.join(
  REPO_ROOT,
  'skills',
  'spec-prd',
  'references',
  'domain-language-and-decision-ledger.md',
);
const OUTPUT_TEMPLATE_PATH = path.join(REPO_ROOT, 'skills', 'spec-prd', 'references', 'prd-output-template.md');
const DOMAIN_LENSES_PATH = path.join(REPO_ROOT, 'skills', 'spec-prd', 'references', 'domain-lenses.md');
const READINESS_PATH = path.join(REPO_ROOT, 'skills', 'spec-prd', 'references', 'prd-readiness-lens.md');
const GLOSSARY_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'domain-glossary.md');
const DRIFT_SCRIPT_PATH = path.join(REPO_ROOT, 'skills', 'spec-prd', 'scripts', 'check-glossary-drift.js');
const EVALS_PATH = path.join(REPO_ROOT, 'skills', 'spec-prd', 'evals', 'examples.json');
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
const RUNTIME_TEMPLATE_DIR = path.join(REPO_ROOT, 'skills', 'spec-prd', 'templates', 'standard');
const RUNTIME_TEMPLATE_INDEX_PATH = path.join(RUNTIME_TEMPLATE_DIR, 'README.md');
const RUNTIME_TEMPLATE_CORE_PATH = path.join(RUNTIME_TEMPLATE_DIR, '00-通用增量需求模板.md');
const FRESH_SOURCE_EVAL_PATH = path.join(
  REPO_ROOT,
  'docs',
  'validation',
  'spec-prd',
  'fresh-source-eval-2026-05-31.md',
);
const FRESH_SOURCE_EVAL_DOMAIN_GRILL_PATH = path.join(
  REPO_ROOT,
  'docs',
  'validation',
  'spec-prd',
  'fresh-source-eval-2026-06-03-domain-grill.md',
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

describe('spec-prd workflow contracts', () => {
  test('entrypoint exposes compact workflow contract summary near the top', () => {
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
    expect(firstHundredTwentyLines).toContain('docs/brainstorms/*-requirements.md');
    expect(firstHundredTwentyLines).toContain('artifact_kind: prd-requirements');
    expect(firstHundredTwentyLines).toContain('Do not create `docs/prds/`');
    expect(firstHundredTwentyLines).toContain('do not hard-code calendar years');
    expect(firstHundredTwentyLines).toContain('untrusted document content');
    expect(firstHundredTwentyLines).toContain('embedded agent instructions');
    expect(firstHundredTwentyLines).toContain('output_shape: bypass | compact-prd | normal-prd | topology-heavy-prd');
    expect(firstHundredTwentyLines).not.toContain('current year is 2026');
    expect(text).toContain(
      'input_mode: prd-requirements | markdown-reference | plan-design-task | pure-text | extracted-multimodal | no-input',
    );
    expect(text).toContain('Extracted multimodal source (image/PDF/meeting-notes/chat-log');
  });

  test('entrypoint stays a decision spine instead of duplicating reference details', () => {
    const text = read(SKILL_PATH);

    expect(text).toContain('Reference Trigger Map');
    expect(text).toContain('Choose `output_shape` before drafting');
    expect(text).not.toContain('- `bypass` - no PRD artifact');
    expect(text).not.toContain('- `compact-prd` - write only the core sections');
    expect(text).not.toContain('- Summary\n- Change Delta\n- Requirements');
    expect(text).not.toContain('Include conditional sections only when they reduce planning invention: Problem Frame');
    expect(text).not.toContain('templates/standard/10-App客户端需求模板.md` for App/client PRDs');
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

  test('intent routing keeps create refine validate internal and rejects topology drift', () => {
    const routing = read(ROUTING_PATH);

    expectContainsAll(routing, [
      '`create`',
      '`refine`',
      '`validate`',
      '`code-align` is not a fourth intent',
      'artifact_kind: prd-requirements',
      'preserve `spec_id`',
      'continue numbering from the maximum existing ID',
      'Other Markdown',
      'Plan/design/task handoff',
      'Lightweight Bypass',
      'current host\'s plan workflow',
      'current host\'s work workflow',
      '0-1 product idea',
      'App consistency audit workflow',
      'Split-Decision Gate',
      'Only after owner confirmation',
    ]);
    expect(routing).not.toContain('packet directories');
    expect(routing).not.toContain('.code-flow/tasks');
  });

  test('current-state and domain-language references preserve evidence boundaries', () => {
    const currentState = read(CURRENT_STATE_PATH);
    const domainLanguage = read(DOMAIN_LANGUAGE_PATH);
    const skill = read(SKILL_PATH);

    expectContainsAll(currentState, [
      '`confirmed-source`',
      '`user-stated`',
      '`source-candidate`',
      '`external-research`',
      '`assumption`',
      'These PRD tags are authoring provenance labels, not a provider contract.',
      'Candidate source hits can guide what to read next',
      'external-tool output, generated mirrors, historical docs, and old plans remain pointers',
      'Current System Snapshot',
      '`keep`',
      '`extend`',
      '`replace`',
      '`remove`',
      '`unknown`',
      'Framing-Aligned Evidence',
      'each load-bearing claim should explain which WHAT boundary it supports',
      'Surface And Contract Discovery',
      'surface | current behavior | owner/source | artifact/contract | consumer | delta | evidence',
      'producer | artifact/schema/path | freshness/authority | consumers | change effect | evidence',
      'Source-Of-Truth Discovery',
      'current_source_of_truth:',
      'contradiction',
      'A current-state claim without an evidence tag cannot be treated as `confirmed-source`',
      'three sources',
      'project domain glossary',
      'local knowledge base, code index, prior-artifact summary, or any retrieval layer',
    ]);
    expectContainsAll(domainLanguage, [
      'Source-First Questioning',
      'repo-local glossary or ADR-like artifacts that actually exist',
      'Do not require a fixed `CONTEXT.md`, `docs/adr/`, or glossary directory.',
      'canonical term',
      'Bounded Scenario Grill',
      'Use 1-3 concrete scenarios',
      'not a coaching script',
      'Trigger only when one of these is true:',
      'Do not trigger when:',
      'Ask at most one question at a time.',
      'write_target: Glossary | Decision Notes | Evidence And Assumptions | Outstanding Questions',
      'This format is for asking the owner, not a third persistent field set.',
      'compress it into that section\'s existing fields and do not add new fields',
      'Do not create `CONTEXT.md`, `CONTEXT-MAP.md`, or `docs/adr/` by default.',
      'run-local Domain Grill Gate',
      'hard to reverse',
      'surprising without context',
      'reflects a real tradeoff',
      'Only capture domain-specific terms.',
      'Define what a term IS, not what it DOES.',
      'Cross-PRD Glossary Promotion',
      'docs/contracts/domain-glossary.md',
      'two or more PRDs',
      'preview-first',
    ]);
    expectContainsAll(skill, [
      'Bounded Scenario Grill / Domain Grill Gate',
      'run-local only',
      'persist results into existing PRD sections',
      'do not create standalone context, ADR, or runtime artifacts',
    ]);
    expect(domainLanguage).not.toContain('default create `CONTEXT.md`');
    expect(domainLanguage).not.toContain('always create ADR');
  });

  test('change topology lens protects system-shape classification and boundary reasoning', () => {
    const skill = read(SKILL_PATH);
    const lens = read(CHANGE_TOPOLOGY_PATH);

    expect(skill).toContain('references/change-topology-lens.md');
    expect(skill).toContain('run the internal Framing Gate');
    expect(skill).toContain('classify the topology before drafting');
    expect(skill).toContain('promote only planning-relevant boundaries into the PRD');
    expectContainsAll(lens, [
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
      'Evidence planning is mandatory for workflow, contract, setup/runtime, migration, replace, remove, and mixed-surface PRDs',
      'not to force a new final PRD section',
      '`add`',
      '`extend`',
      '`replace`',
      '`remove`',
      '`migrate`',
      '`split`',
      '`merge`',
      '`policy-change`',
      '`workflow-change`',
      '`contract-change`',
      'Surface Map',
      'Producer / Artifact / Consumer',
      'Source-Of-Truth Resolution',
      'Negative Space',
      'Ask only questions that decide scope, behavior, source-of-truth, or acceptance',
      'If more than three owner questions seem necessary',
      'not a request to add implementation units',
    ]);
  });

  test('output template carries generic skeleton, trace rules, closeout, and split topology', () => {
    const template = read(OUTPUT_TEMPLATE_PATH);

    expectContainsAll(template, [
      'artifact_kind: prd-requirements',
      'docs/brainstorms/YYYY-MM-DD-NNN-<slug>-requirements.md',
      'Do not create `docs/prds/`',
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
      '## Change Topology',
      '## Surface Map',
      '## Source-Of-Truth Resolution',
      '## Negative Acceptance',
      'Success Metrics are conditional',
      'do not invent target values',
      'Framing Gate',
      'Evidence Plan',
      'do not print the run-local Framing Gate by default',
      'vague original -> improved concrete wording -> reason',
      '"等", "相关", "合适的", "更好", and "优化体验"',
      'implementation units, schemas, exact API fields, database tables, and task breakdown are not',
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
  });

  test('domain lenses derive generic surface mechanism without hard-coding industry overlay facts', () => {
    const lenses = read(DOMAIN_LENSES_PATH);

    expectContainsAll(lenses, [
      'standard PRD templates are bundled with the workflow',
      'Missing local overlay docs are a graceful absence',
      'App',
      'H5/PC',
      'Admin',
      'Backend/Java',
      'CLI/DevTool',
      'Mixed',
      'templates/standard/',
      'docs/需求文档模版/标准模版/',
      'project-local overlay',
      'Do not treat template industry facts as confirmed project rules',
      'Industry Overlay Triggers',
      'only **raises questions and triggers conditional sections**',
      'not a separate role taxonomy',
    ]);
    expect(lenses).not.toContain('C1 监管');
    expect(lenses).not.toContain('C12 客诉');
    expect(lenses).not.toContain('securities-pm');
    expect(lenses).not.toContain('credit-pm');
  });

  test('readiness lens references brainstorm gate dimensions and adds PRD-specific checks', () => {
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
      'Always Gate',
      'Topology Pack',
      'Domain And Decision Pack',
      'Metrics And Overlay Pack',
      '`current-state accuracy`',
      '`change delta clarity`',
      '`exception coverage`',
      '`interaction readiness`',
      '`evidence provenance`',
      '`planning invention risk`',
      '`terminology ambiguity`',
      '`code-claim contradiction`',
      '`hard-decision unresolved`',
      '`vague-wording`',
      '`priority-completeness`',
      '`change-topology fit`',
      '`surface-map completeness`',
      '`producer-consumer closure`',
      '`source-of-truth clarity`',
      '`negative-acceptance coverage`',
      '`framing-evidence alignment`',
      '`owner-question minimality`',
      '`domain-grill coverage`',
      '`decision-note adequacy`',
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

  test('packaged templates and human mirror expose intended drift boundary', () => {
    const templateIndex = read(HUMAN_TEMPLATE_INDEX_PATH);
    const humanCore = read(HUMAN_TEMPLATE_CORE_PATH);
    const runtimeTemplateIndex = read(RUNTIME_TEMPLATE_INDEX_PATH);
    const runtimeCore = read(RUNTIME_TEMPLATE_CORE_PATH);
    const runtimeTemplate = read(OUTPUT_TEMPLATE_PATH);
    const runtimeLenses = read(DOMAIN_LENSES_PATH);
    const runtimeFiles = fs.readdirSync(RUNTIME_TEMPLATE_DIR).sort();

    expect(templateIndex).toContain('human-facing 标准模板库');
    expect(templateIndex).toContain('skills/spec-prd/templates/standard/');
    expect(templateIndex).toContain('packaged runtime template set');
    expect(templateIndex).toContain('不作为 packaged runtime 的必需读取路径');
    expect(runtimeTemplateIndex).toContain('随 `spec-prd` workflow assets 打包分发');
    expect(runtimeTemplateIndex).toContain('打包后的运行时必须只依赖本目录即可加载模板');
    expect(runtimeFiles).toEqual([
      '00-通用增量需求模板.md',
      '10-App客户端需求模板.md',
      '20-Admin中后台需求模板.md',
      '30-Backend中台服务需求模板.md',
      'README.md',
    ]);
    expect(runtimeCore).not.toContain('industry: securities');
    expect(runtimeCore).not.toContain('C1 监管');
    expect(runtimeCore).toContain('AE-01（对应 R-01）');
    expect(runtimeCore).toContain('AE-02（对应 R-02，异常）');
    expect(runtimeCore).not.toContain('AC-01');
    expect(runtimeCore).not.toContain('AC-02');
    expect(read(path.join(RUNTIME_TEMPLATE_DIR, '10-App客户端需求模板.md'))).not.toContain('industry: securities');
    expect(read(path.join(RUNTIME_TEMPLATE_DIR, '20-Admin中后台需求模板.md'))).not.toContain('industry: securities');
    expect(read(path.join(RUNTIME_TEMPLATE_DIR, '30-Backend中台服务需求模板.md'))).not.toContain('industry: securities');
    for (const section of [
      'Summary',
      'Change Delta',
      'Requirements',
      'Acceptance Examples',
      'Scope Boundaries',
      'Evidence And Assumptions',
    ]) {
      expect(humanCore).toContain(section);
      expect(runtimeCore).toContain(section);
      expect(runtimeTemplate).toContain(section);
    }
    expect(runtimeCore).toContain('run-local Framing Gate 和 Evidence Plan');
    expect(runtimeCore).toContain('plan 发明 WHAT');
    for (const surface of ['App', 'Admin', 'Backend', 'H5/PC', 'CLI/DevTool', 'Mixed']) {
      expect(runtimeLenses).toContain(surface);
    }
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

  test('fresh-source eval artifact records the source-only evaluation status', () => {
    const artifact = read(FRESH_SOURCE_EVAL_PATH);

    expectContainsAll(artifact, [
      'fresh_source_eval:',
      'status: not_run',
      'skills/spec-prd/SKILL.md',
      'skills/spec-prd/references/change-topology-lens.md',
      'skills/spec-prd/references/prd-output-template.md',
      'skills/spec-prd/templates/standard/00-通用增量需求模板.md',
      'templates/claude/commands/spec/prd.md',
      'runtime_paths_checked: []',
      'not_run_reason:',
    ]);
    expect(artifact).not.toContain('status: passed');
  });

  test('domain-grill fresh-source eval artifact records an executed dispatched eval for this change', () => {
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
    // 不引入第二套证据 enum,复用既有等级
    expect(glossary).toContain('source_tag');
    expect(glossary).toContain('confirmed | advisory');
    // 明确否定独立 CONTEXT.md / ADR 文件树拓扑
    expect(glossary).toMatch(/不是.*独立的.*CONTEXT\.md/);
    expect(glossary).not.toContain('sequential numbering');
    expect(glossary).not.toContain('`aliases` / `avoid`');
  });

  test('glossary drift script reports script-owned facts and degrades when glossary is absent or empty', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glossary-drift-'));
    try {
      const prdPath = path.join(tmpDir, 'prd.md');
      fs.writeFileSync(prdPath, 'The system sends a bill to the customer.\n', 'utf8');

      // absent glossary -> graceful degrade, no findings, exit 0
      const absent = JSON.parse(
        execFileSync('node', [DRIFT_SCRIPT_PATH, prdPath, '--glossary', path.join(tmpDir, 'nope.md')], {
          encoding: 'utf8',
        }),
      );
      expect(absent.glossary_status).toBe('absent');
      expect(absent.findings).toEqual([]);

      // glossary with a real canonical entry whose avoid term appears in the PRD
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

      // non-contract aliases field is not a drift input; v1 consumes avoid only
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

      // fenced code-block examples must not be parsed as real entries
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

      // regression: an avoid term on multiple lines must report every line
      // (guards against stateful-regex lastIndex carry-over)
      const multiPrd = path.join(tmpDir, 'multi.md');
      fs.writeFileSync(multiPrd, 'a bill here\nanother bill\nthird bill line\n', 'utf8');
      const multi = JSON.parse(
        execFileSync('node', [DRIFT_SCRIPT_PATH, multiPrd, '--glossary', glossaryPath], { encoding: 'utf8' }),
      );
      expect(multi.findings).toHaveLength(3);
      expect(multi.findings.map((f) => f.line)).toEqual([1, 2, 3]);

      // regression: ASCII terms ending in non-word chars (C++, .NET) must match
      const symPrd = path.join(tmpDir, 'sym.md');
      fs.writeFileSync(symPrd, 'we use C++ here\n', 'utf8');
      const symGloss = path.join(tmpDir, 'symg.md');
      fs.writeFileSync(symGloss, '# G\n### Cancel\nx\n- avoid: C++\n- status: active\n', 'utf8');
      const sym = JSON.parse(
        execFileSync('node', [DRIFT_SCRIPT_PATH, symPrd, '--glossary', symGloss], { encoding: 'utf8' }),
      );
      expect(sym.findings).toHaveLength(1);
      expect(sym.findings[0].term_used).toBe('C++');

      // ASCII whole-word: 'bill' must not match 'billing'/'billed'
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
