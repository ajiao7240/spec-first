'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CodexAdapter = require('../../src/cli/adapters/codex');
const { syncSkills } = require('../../src/cli/plugin');
const { ALLOWED_TASK_FIELDS, REQUIRED_TASK_FIELDS } = require('../../src/cli/task-pack');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills', 'spec-write-tasks', 'SKILL.md');
const SCHEMA_PATH = path.join(REPO_ROOT, 'skills', 'spec-write-tasks', 'references', 'task-pack-schema.md');
const GUIDE_PATH = path.join(REPO_ROOT, 'skills', 'spec-write-tasks', 'references', 'task-quality-guide.md');
const HANDOFF_CONTRACT_PATH = path.join(REPO_ROOT, 'skills', 'spec-write-tasks', 'references', 'execution-handoff-contract.md');
const EVALS_DIR = path.join(REPO_ROOT, 'skills', 'spec-write-tasks', 'evals');
const EVALS_README_PATH = path.join(EVALS_DIR, 'README.md');
const OUTPUT_QUALITY_CASES_PATH = path.join(EVALS_DIR, 'output-quality-cases.json');
const OPENAI_PATH = path.join(REPO_ROOT, 'skills', 'spec-write-tasks', 'agents', 'openai.yaml');
const SPEC_WORK_PATH = path.join(REPO_ROOT, 'skills', 'spec-work', 'SKILL.md');
const PLAN_HANDOFF_PATH = path.join(REPO_ROOT, 'skills', 'spec-plan', 'references', 'plan-handoff.md');
const OFFICIAL_SKILL_CREATOR_DIR = path.join(
  os.homedir(),
  '.codex',
  'plugins',
  'cache',
  'claude-plugins-official',
  'skill-creator',
  'local',
  'skills',
  'skill-creator',
);
const OFFICIAL_PACKAGE_SCRIPT = path.join(OFFICIAL_SKILL_CREATOR_DIR, 'scripts', 'package_skill.py');
const TASK_SIGNALS_CONTRACT_PATH = path.join(
  REPO_ROOT,
  'docs',
  'contracts',
  'governance',
  'task-governance-signals.md',
);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('spec-write-tasks contracts', () => {
  const officialPackageTest = fs.existsSync(OFFICIAL_PACKAGE_SCRIPT) ? test : test.skip;

  test('source skill preserves derived-task-pack boundaries and task-ready flow', () => {
    const skill = read(SKILL_PATH);
    const handoff = read(HANDOFF_CONTRACT_PATH);
    const guide = read(GUIDE_PATH);
    const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/)[1];
    const frontmatterKeys = frontmatter
      .split('\n')
      .filter((line) => /^[a-zA-Z0-9_-]+:/.test(line))
      .map((line) => line.split(':', 1)[0]);

    expect(skill).toContain('name: spec-write-tasks');
    expect(frontmatterKeys).toEqual(['name', 'description']);
    expect(frontmatter).not.toContain('argument-hint:');
    expect(frontmatter).toContain('do not use for implementation execution, unresolved scope, small low-risk plans, or remote/generic task lists');
    expect(skill).toContain('## Purpose');
    expect(skill).toContain('## Inputs');
    expect(skill).toContain('## Outputs');
    expect(skill).toContain('## Workflow');
    expect(skill).toContain('## When Not To Use');
    expect(skill).toContain('## Failure Modes');
    expect(skill).toContain('optional derived layer between `spec-plan` and `spec-work`');
    expect(skill).toContain('`spec-plan` is always the single source of truth');
    expect(skill).toContain('A task pack is a derived artifact; it must not become a second plan.');
    expect(skill).toContain('`context_refs` must point to the smallest useful section, file, test, contract, or pattern reference.');
    expect(skill).toContain('whole-plan or whole-directory refs are low-quality handoff unless paired with narrower anchors');
    expect(skill).toContain('It does not accept remote repositories, package names, marketplace identifiers');
    expect(skill).toContain('End every run with the final decision envelope');
    expect(skill).toContain('Only an executable task pack with matching `spec_id`');
    expect(skill).toContain('`wrong_chain`: source plan and task pack `spec_id` values mismatch');
    expect(skill).toContain('Task-Ready Check');
    expect(skill).toContain('`compile`: the plan is clear enough');
    expect(skill).toContain('`skip`: the plan is small');
    expect(skill).toContain('`return-to-plan`: key scope');
    expect(skill).toContain('`draft-only`: a non-executable draft');
    expect(skill).toContain('Compilation Algorithm');
    expect(skill).toContain('not a script state machine');
    expect(skill).toContain('Quality Pass Before Output');
    expect(skill).toContain('Final Decision Envelope');
    expect(skill).toContain('Execution Handoff Contract');
    expect(handoff).toContain('decision: compile | skip | return-to-plan | draft-only | validate-only');
    expect(handoff).toContain('reason_code: source_plan_missing | ambiguous_plan | missing_spec_id');
    expect(handoff).toContain('semantic_posture');
    expect(handoff).toContain('dispatch_authorization: authorized | missing | not_required | not_applicable');
    expect(skill).toContain('next_action');
    expect(handoff).toContain('orientation:');
    expect(handoff).toContain('evidence_refs');
    expect(skill).toContain('Source Summary');
    expect(skill).toContain('Traceability Matrix');
    expect(skill).toContain('Orientation Evidence');
    expect(skill).toContain('Task Quality Guide');
    expect(skill).toContain('If deterministic hash tooling is unavailable, report the task pack as unverifiable handoff');
    expect(skill).toContain('A task pack that can be handed to `spec-work` must include `spec_id`');
    expect(skill).toContain('If the source plan is a legacy plan without `spec_id`, do not write an executable task pack');
    expect(skill).toContain('copying `spec_id` from the source plan');
    expect(skill).toContain('`Requirements` (or legacy `Requirements Trace`)');
    expect(skill).toContain('A mismatch is a wrong-chain handoff');
    expect(skill).toContain('bounded source orientation');
    expect(skill).toContain('Use [Task Quality Guide](references/task-quality-guide.md) for the intake order, Direct Evidence handling, LSP provider rule, and orientation-evidence quality checks.');
    expect(guide).toContain('## Source Orientation Rules');
    expect(guide).toContain('If the source plan contains a `## Direct Evidence` block');
    expect(guide).toContain('`impact_on_plan` may influence task ordering');
    expect(guide).toContain('`source_reads_required` may become granular `context_refs`, `stop_if`, or `test_focus`');
    expect(guide).toContain('must not create new tasks, expand source-plan scope');
    expect(guide).toContain('Use this intake order for context economy');
    expect(guide).toContain('first read the plan/task summary and contract metadata');
    expect(guide).toContain('then deterministic inventory or validation facts');
    expect(guide).toContain('then current task/phase refs');
    expect(guide).toContain('then focused source-of-truth sections');
    expect(guide).toContain('only then deeper references');
    expect(guide).toContain('do not create an external-tool facts pipeline');
    expect(guide).toContain('Start with targeted direct repo reads');
    expect(guide).toContain('LSP provider rule');
    expect(guide).toContain('Do not let LSP references automatically expand task scope');
    expect(skill).toContain('top-level `target_repo` for single-repo work or per-unit `target_repo` for cross-repo work');
    expect(skill).toContain('do not invent child repo targets while deriving tasks');
    expect(skill).toContain('inspect `target_repo` inheritance or per-task `target_repo` values');
    expect(skill).toContain('current deterministic validation does not prove workspace repo scope');
    expect(handoff).toContain('Deterministic contract fields validated by `spec-first tasks validate`');
    expect(handoff).toContain('LLM/human quality fields that should be present when they reduce execution context');
    expect(skill).toContain('`review_gate`, `review_focus`');
    expect(guide).toContain('Uses `required` only for high-risk shared contracts');
    expect(guide).toContain('uses `optional` for medium-risk behavior changes');
    expect(guide).toContain('omits the field for low-risk docs/config/trivial work');
    expect(skill).toContain('`review_gate` is review intent, not lifecycle state, approval state, or validator-owned semantic risk');
    expect(skill).toContain('Prefer independently verifiable vertical slices over horizontal layers');
    expect(skill).toContain('A good slice closes one behavior with implementation, verification, and any necessary docs/config evidence');
    expect(skill).toContain('Docs-only and config-only tasks should use docs contract checks, schema/help/render checks, or diff-shape checks');
    expect(skill).toContain('do not force TDD where no behavior-bearing code changes');
    expect(skill).toContain('split into vertical story tasks');
    expect(skill).toContain('split into multiple feedback-loop tasks');
    expect(skill).toContain('A single source implementation unit may produce more than one task');
    expect(skill).toContain('repeat the same `source_unit` on those tasks');
    expect(skill).toContain('no task keeps a large source implementation unit intact when it actually contains multiple independent feedback loops');
    expect(skill).toContain('large source units can fan out into multiple executable tasks');
    expect(skill).toContain('Avoid horizontal "all tests first, then all implementation" waves when independent vertical tracer bullets can be verified');
    expect(handoff).toContain('The deterministic validator checks `review_gate` structure only');
    expect(handoff).toContain('does not decide which tasks semantically require review');
    expect(guide).toContain('Start from the source plan, plan-indicated source files, and nearby tests');
    expect(guide).toContain('Reuse already-loaded host/project instructions');
    expect(guide).toContain('Read `AGENTS.md` / `CLAUDE.md` source only when the active host/project instruction reuse policy allows it');
    expect(guide).toContain('Read local contract docs only by precise path or section when they exist');
    expect(guide).toContain('Written project standards may become hard task constraints only when they apply to the changed files');
    expect(skill).not.toContain('read `AGENTS.md`, `CLAUDE.md`, directory-scoped standards files, `docs/contracts/`');
    expect(skill).not.toContain('docs/examples/standards-glue-consumption-examples.md');
    expect(skill).not.toContain('.spec-first/standards/');
    expect(skill).not.toContain('glue-map.json');
    expect(skill).toContain('The deterministic validator only proves frontmatter identity/freshness plus the `Task Pack Contract` machine-readable structure');
    expect(guide).toContain('direct source reads, changed files, tests/logs, and limitations');
    expect(guide).toContain('external-tool facts are advisory context refs');
    expect(skill).toContain('Use the source plan\'s own structure as the primary complexity evidence');
    expect(skill).toContain('degraded helper-signal handling');
    expect(guide).toContain('implementation units, declared files, dependency graph, verification spread, and `plan_depth`');
    expect(guide).toContain('`task-governance-signals.v1` is advisory cross-check input only');
    expect(guide).toContain('when no `--input` planning context is supplied');
    expect(guide).toContain('It may also return `collection_status: degraded`');
    expect(guide).toContain('even when an `--input` path was provided');
    expect(guide).toContain('ignore its `candidate_level` for compile/skip decisions');
    expect(guide).toContain('record the helper output in Orientation Evidence or the final envelope limitations');
    expect(guide).toContain('Do not treat that output as confirmed low risk');
    expect(skill).not.toContain('Use `task-governance-signals.v1` as the primary complexity evidence');

    expect(handoff).toContain('Before filling `deterministic_handoff` and the `validation:` block, you must actually run the deterministic CLI and transcribe its result');
    expect(handoff).toContain('spec-first tasks validate <task-pack-path> --json');
    expect(handoff).toContain('never self-report `deterministic_handoff: true`');
    expect(handoff).toContain('Use a `Failure Modes` code as `reason_code` whenever the run stops, downgrades, or rejects a handoff.');
    expect(skill).toContain('## Portability Boundary');
    expect(skill).toContain('Runtime references must be packaged skill files');
    expect(skill).toContain('Standalone `.skill` packages must remain usable when those sibling workflow files are absent');
    expect(skill).toContain('treat `spec-plan`, `spec-work`, and `spec-doc-review` as named integration points');
    expect(skill).toContain('`evals/` files are maintainer-only validation fixtures');
    expect(skill).toContain('the official `.skill` packager excludes root `evals/`');
    expect(skill).not.toContain('../../docs/');
    expect(skill).not.toContain('](../spec-plan/');
    expect(skill).not.toContain('](../spec-work/');
    expect(skill).not.toContain('Technical Plan');
    expect(skill).not.toContain('Project Role');
    expect(skill).not.toContain('历史快照');
  });

  test('task pack schema requires executable handoff metadata and quality structures', () => {
    const schema = read(SCHEMA_PATH);

    expect(schema).toContain('spec_id: "YYYY-MM-DD-NNN-<slug>"');
    expect(schema).toContain('source_plan_hash: "sha256:<64-hex>"');
    expect(schema).toContain('- "Requirements"');
    expect(schema).not.toContain('- "Requirements Trace"');
    expect(schema).toContain('Concrete repo-relative POSIX file path to the single source plan');
    expect(schema).toContain('`spec_id` and `source_plan_hash` have separate jobs');
    expect(schema).toContain('canonical source plan body hashing');
    expect(schema).toContain('Task Pack Contract');
    expect(schema).toContain('only machine-readable task-card source for validators');
    expect(schema).not.toContain('"done_signal": "Validator tests pass.",\n      "done_signal": "Validator tests pass.",');
    expect(schema).toContain('Orientation Evidence');
    expect(schema).toContain('source');
    expect(schema).toContain('`direct-repo-reads`, `lsp`, `mixed`, or `skipped`');
    expect(schema).toContain('evidence_refs');
    expect(schema).toContain('limitations');
    expect(schema).toContain('A task pack whose `spec_id` does not match the source plan is a wrong-chain handoff');
    expect(schema).toContain('If the source plan lacks `spec_id`, do not write an executable task pack');
    expect(schema).toContain('Executable handoff must be `derived`');
    expect(schema).toContain('transient slices are not stable `spec-work` input');
    expect(schema).toContain('do not write an executable handoff');
    expect(schema).toContain('Traceability Matrix');
    expect(schema).toContain('Current deterministic validation only checks frontmatter identity/freshness and the `Task Pack Contract` JSON structure');
    expect(schema).toContain('Executable task cards must include these deterministic fields');
    expect(schema).toContain('Related Requirements / legacy Requirements Trace / acceptance refs');
    expect(schema).toContain("entry_hint: Start with the plan's Requirements and Scope Boundaries");
    expect(schema).not.toContain("entry_hint: Start with the plan's Requirements Trace");
    expect(schema).toContain('Quality Task Fields');
    expect(schema).toContain('| `expected_side_effects` | Explicit side-effect allowlist for delegation staging');
    expect(schema).toContain('must not use `**` whole-repo globs');
    expect(schema).toContain('| `review_gate` | Optional task-level review intent, either `optional` or `required`; not an approval state |');
    expect(schema).toContain('| `review_focus` | Specific review concern for mini review or final shipping review |');
    expect(schema).toContain('Task `files` and `expected_side_effects` must point at source-of-truth or allowed generated artifacts');
    expect(schema).toContain('must reject `.claude/**`, `.codex/**`, and `.agents/skills/**` task file ownership');
    expect(schema).toContain('task files do not point at generated runtime mirrors');
    expect(schema).toContain('When present, `review_gate` must be exactly `optional` or `required`; absence means no task-level review gate.');
    expect(schema).toContain('The validator checks only the enum structure, not whether the task semantically deserves a gate.');
    expect(schema).toContain('MVP required task fields');
    expect(schema).toContain('Wave ids must be strings or numbers.');
    expect(schema).toContain('Non-empty concrete repo-relative POSIX file paths; no globs, directories, `.`, `..`, `...`, or backslash separators');
    expect(schema).toContain('Boolean hint for whether the task can run in parallel');
    expect(schema).toContain('`stop_if`');
    expect(schema).toContain('`target_repo`');
    expect(schema).toContain('| `test_focus` | Primary verification focus |');
    expect(schema).toContain('Granularity Guide');
    expect(schema).toContain('Scripts must not judge task splitting quality');
    expect(schema).toContain('If `spec_id` does not match the current source plan, execution must be rejected');
    expect(schema).toContain('expected_side_effects, when present, use repo-relative exact paths or bounded globs and never `**` whole-repo globs');
    expect(schema).toContain('`direct-repo-reads`, `lsp`, `mixed`, or `skipped`');

    expect(schema).toContain('the deterministic task-field set is owned jointly by this schema and `src/cli/task-pack.js`');
    expect(schema).toContain('a parity test enforces bidirectional sync');
    expect(schema).toContain('`Task Cards` is the human-readable mirror of the `Task Pack Contract` JSON');
    expect(schema).toContain('the JSON block is the machine-readable canonical source, and the JSON wins on any conflict');
  });

  test('schema task-field tables stay in parity with the validator field sets', () => {
    const schema = read(SCHEMA_PATH);

    // Scope the field-table scan to the Task Cards section (deterministic + quality
    // task-field tables) so frontmatter field rows (type/status/spec_id/...) are not
    // mistaken for task fields. This keeps the parity check bidirectional and honest.
    const taskCardsStart = schema.indexOf('## Task Cards');
    const taskCardsEnd = schema.indexOf('## Orientation Evidence');
    expect(taskCardsStart).toBeGreaterThan(-1);
    expect(taskCardsEnd).toBeGreaterThan(taskCardsStart);
    const taskCardsSection = schema.slice(taskCardsStart, taskCardsEnd);

    const documentedTaskFields = new Set(
      [...taskCardsSection.matchAll(/^\| `([a-z_]+)` \| /gm)].map((match) => match[1]),
    );

    // REQUIRED is a subset of ALLOWED by construction in the validator.
    for (const field of REQUIRED_TASK_FIELDS) {
      expect(ALLOWED_TASK_FIELDS.has(field)).toBe(true);
    }

    // Bidirectional parity: every validator-recognized task field is documented, and
    // every documented task-card field is validator-recognized. Either direction
    // failing means src/cli/task-pack.js and the schema drifted apart.
    for (const field of ALLOWED_TASK_FIELDS) {
      expect(documentedTaskFields.has(field)).toBe(true);
    }
    for (const field of documentedTaskFields) {
      expect(ALLOWED_TASK_FIELDS.has(field)).toBe(true);
    }
  });

  test('execution handoff contract owns envelope, validation, and review continuation details', () => {
    const handoff = read(HANDOFF_CONTRACT_PATH);

    expect(handoff).toContain('## Final Decision Envelope');
    expect(handoff).toContain('decision: compile | skip | return-to-plan | draft-only | validate-only');
    expect(handoff).toContain('reason_code: source_plan_missing | ambiguous_plan | missing_spec_id');
    expect(handoff).toContain('validity_scope: identity-freshness-structure-only');
    expect(handoff).toContain('dispatch_authorization: authorized | missing | not_required | not_applicable');
    expect(handoff).toContain('## Deterministic Validation Rule');
    expect(handoff).toContain('spec-first tasks validate <task-pack-path> --json');
    expect(handoff).toContain('spec-first tasks hash <plan-path>');
    expect(handoff).toContain('never self-report `deterministic_handoff: true`');
    expect(handoff).toContain('## High-Risk Review Handoff');
    expect(handoff).toContain('a standalone skill trigger alone is not dispatch authorization');
    expect(handoff).toContain('This is bounded auto-continuation, not general workflow chaining');
    expect(handoff).toContain('## Drift And Hash');
    expect(handoff).toContain('`source_plan_hash` must be the canonical source plan body hash produced by `spec-first tasks hash <plan-path>`');
    expect(handoff).toContain('## Lint Boundary');
    expect(handoff).toContain('Do not let scripts judge whether task splitting is semantically good.');
  });

  test('quality guide owns quality examples without redefining schema fields', () => {
    const guide = read(GUIDE_PATH);

    expect(guide).toContain('Task Quality Guide');
    expect(guide).toContain('`task-pack-schema.md` remains the source of truth for required fields');
    expect(guide).toContain('The quality bar is not whether every field is filled');
    expect(guide).toContain('Bad Smells');
    expect(guide).toContain('### Good');
    expect(guide).toContain('### Bad');
    expect(guide).toContain('Field Writing Guide');
    expect(guide).toContain('| `expected_side_effects` | Names narrow repo-relative side effects');
    expect(guide).toContain('it never uses `**` whole-repo globs');
    expect(guide).toContain('| `review_gate` | Uses `required` only for high-risk shared contracts');
    expect(guide).toContain('| `review_focus` | Names the concrete concern a mini review or final shipping review should inspect |');
    expect(guide).toContain('`review_gate` and `review_focus` are review intent');
    expect(guide).toContain('They do not record whether review passed, who approved the task, or whether execution state advanced.');
    expect(guide).toContain('It repeats `test_focus`, substitutes for `done_signal` or `stop_if`');
    expect(guide).toContain('`review_gate` is required by default');
    expect(guide).toContain('Task Pack Review Checklist');
    expect(guide).toContain('Current deterministic validation treats `context_refs` as auxiliary context, not as a replacement for `source_unit` or `requirement_refs`.');
    expect(guide).toContain('section/file/test/contract granularity');
    expect(guide).toContain('whole-plan ref is low quality unless paired with narrower anchors');
    expect(guide).toContain('task `files` avoid generated runtime mirrors');
    expect(guide).toContain('`.claude/**`, `.codex/**`, and `.agents/skills/**`');
    expect(guide).toContain('Use non-empty concrete repo-relative POSIX file paths');
    expect(guide).toContain('orientation_evidence');
    expect(guide).toContain('provider, posture, evidence_refs, and limitations');
    expect(guide).toContain('without turning LSP/current code state into source-plan scope');
    expect(guide).toContain('Vertical Slice And Feedback Loop Rules');
    expect(guide).toContain('Prefer tasks that form independently verifiable vertical slices');
    expect(guide).toContain('A vertical tracer bullet includes the smallest implementation path, verification loop, and necessary docs/config evidence');
    expect(guide).toContain('Acceptable feedback loops include failing or characterization tests, CLI invocations, HTTP/browser scripts, trace replay, throwaway harnesses, property/fuzz loops');
    expect(guide).toContain('docs contract checks, schema/help/render checks');
    expect(guide).toContain('Docs-only and config-only tasks are not forced into TDD');
    expect(guide).toContain('Horizontal slicing smell: a task pack that writes all tests for every unit first, then all implementation, then all docs makes feedback late');
    expect(guide).toContain('Horizontal all-tests-then-all-implementation slicing');
    expect(guide).toContain('Prefer vertical tracer bullets with one behavior, verification loop, and docs/config evidence closed together');
    expect(guide).toContain('Large Implementation Unit Fan-Out');
    expect(guide).toContain('A source implementation unit is not automatically an executable task');
    expect(guide).toContain('repeat the same `source_unit` on each task');
    expect(guide).toContain('Large source unit kept as one task');
    expect(guide).toContain('orientation_evidence');
    expect(guide).toContain('prefer the source plan\'s own structure over helper-derived size hints');
    expect(guide).toContain('`task-governance-signals.v1` is advisory cross-check input only');
    expect(guide).toContain('may emit an empty-signal `lightweight` candidate when no `--input` planning context is supplied');
    expect(guide).toContain('It may also return `collection_status: degraded`');
    expect(guide).toContain('ignore its `candidate_level` for compile/skip decisions');
    expect(guide).toContain('Do not treat that output as confirmed low risk');
  });

  test('decisive recommendations keep task signals advisory and bound the doc-review auto-continuation', () => {
    const skill = read(SKILL_PATH);
    const handoff = read(HANDOFF_CONTRACT_PATH);
    const guide = read(GUIDE_PATH);
    const contract = read(TASK_SIGNALS_CONTRACT_PATH);
    const boundaryCases = JSON.parse(read(path.join(EVALS_DIR, 'boundary-cases.json')));

    expect(`${skill}\n${guide}`).toContain('source plan\'s own structure');
    expect(guide).toContain('For split recommendations, prefer the source plan\'s own structure over helper-derived size hints');
    expect(guide).toContain('A written plan\'s implementation units, declared files, dependency graph, verification spread, and `plan_depth` are task-time evidence');
    expect(handoff).toContain('Use `next_action: review-task-pack` as the decisive handoff recommendation for high-risk task packs.');
    expect(handoff).toContain('The output must include one concrete reason and a copy-ready current-host document-review invocation');
    expect(handoff).toContain('/spec:doc-review <task-pack-path>');
    expect(handoff).toContain('$spec-doc-review <task-pack-path>');
    expect(handoff).toContain('do not dispatch by default');
    expect(handoff).toContain('the invoking parent workflow or user explicitly authorized this single bounded continuation for the current run');
    expect(handoff).toContain('a standalone skill trigger alone is not dispatch authorization');
    expect(handoff).toContain('the continuation targets exactly the doc-review of the just-written task pack; do not chain any further workflow');
    expect(handoff).toContain('This is bounded auto-continuation, not general workflow chaining');
    expect(handoff).toContain('Set `dispatch_authorization: authorized` only when the explicit authorization condition is met.');
    expect(handoff).toContain('surface the `review-task-pack` recommendation in the returned envelope, and let the caller decide');
    expect(contract).toContain('`spec-write-tasks` may use `plan-declared` output only as optional cross-check evidence');
    expect(contract).toContain('written source-plan structure is the primary evidence');
    expect(contract).toContain('must not treat `plan-declared` as a hard gate or a second source of truth');

    const highRiskCase = boundaryCases.cases.find((entry) => entry.id === 'high-risk-review-gate');
    expect(highRiskCase).toEqual(expect.objectContaining({
      expected_decision: 'compile',
    }));
    expect(highRiskCase.expected_next_action).toContain('next_action: review-task-pack');
    expect(highRiskCase.expected_next_action).toContain('dispatch_authorization: missing');
  });

  test('output-quality fixtures expose objective assertions and evidence gaps', () => {
    const readme = read(EVALS_README_PATH);
    const payload = JSON.parse(read(OUTPUT_QUALITY_CASES_PATH));

    expect(readme).toContain('`output-quality-cases.json` 记录 file-backed output-quality review cases');
    expect(readme).toContain('不是 provider-backed model eval');
    expect(readme).toContain('必须声明 `input_files`、`baseline_risks`、`with_skill_expectations` 和 `objective_assertions`');
    expect(readme).toContain('`missing evidence`');
    expect(payload.schema_version).toContain('spec-write-tasks-output-quality-cases');
    expect(payload.coverage_tags).toEqual(expect.arrayContaining(['expected', 'output-quality']));
    expect(payload.source_refs).toEqual(expect.arrayContaining([
      'skills/spec-write-tasks/SKILL.md',
      'tests/fixtures/spec-write-tasks/valid/source-plan.md',
      'tests/fixtures/spec-write-tasks/small-plan/source-plan.md',
      'tests/fixtures/spec-write-tasks/high-risk-review/source-plan.md',
      'tests/fixtures/spec-write-tasks/high-risk-review/task-pack.md',
    ]));
    expect(payload.source_refs).not.toEqual(expect.arrayContaining([
      'docs/plans/2026-06-22-001-feat-user-language-sync-plan.md',
      'docs/tasks/2026-06-22-001-feat-user-language-sync-tasks.md',
    ]));
    expect(payload.source_refs.join('\n')).not.toContain('../../docs/');
    expect(payload.cases.length).toBeGreaterThanOrEqual(3);

    for (const evalCase of payload.cases) {
      expect(evalCase.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(Array.isArray(evalCase.input_files)).toBe(true);
      expect(evalCase.baseline_risks.length).toBeGreaterThan(0);
      expect(evalCase.with_skill_expectations.length).toBeGreaterThan(0);
      expect(evalCase.objective_assertions.length).toBeGreaterThan(0);
      expect(typeof evalCase.expected_outcome).toBe('string');
      for (const inputFile of evalCase.input_files) {
        expect(inputFile.evidence).toBe('file-backed fixture');
        expect(fs.existsSync(path.join(REPO_ROOT, inputFile.path))).toBe(true);
      }
    }

    const casesById = new Map(payload.cases.map((entry) => [entry.id, entry]));
    const smallPlanCase = casesById.get('small-plan-skip-preserves-context-budget');
    const highRiskCase = casesById.get('high-risk-pack-review-handoff-needs-authorization');
    const fanoutCase = casesById.get('deep-plan-large-unit-fanout');
    const degradedHelperCase = casesById.get('degraded-helper-signal-does-not-downgrade-deep-plan');
    expect(smallPlanCase.evidence_status).toBe('file-backed fixture');
    expect(smallPlanCase.input_files.map((entry) => entry.path)).toEqual([
      'tests/fixtures/spec-write-tasks/small-plan/source-plan.md',
    ]);
    expect(smallPlanCase.missing_evidence).not.toContain('file-backed fixture');
    expect(smallPlanCase.missing_evidence).toEqual(expect.arrayContaining([
      'model execution evidence',
      'human adjudication',
    ]));
    expect(highRiskCase.evidence_status).toBe('file-backed fixture');
    expect(highRiskCase.input_files.map((entry) => entry.path)).toEqual([
      'tests/fixtures/spec-write-tasks/high-risk-review/source-plan.md',
      'tests/fixtures/spec-write-tasks/high-risk-review/task-pack.md',
    ]);
    expect(highRiskCase.missing_evidence).not.toContain('file-backed fixture');
    expect(highRiskCase.missing_evidence).toEqual(expect.arrayContaining([
      'provider telemetry',
      'human adjudication',
    ]));
    expect(fanoutCase.evidence_status).toBe('file-backed fixture');
    expect(fanoutCase.source_ref_authority).toBe('historical');
    expect(fanoutCase.source_refs).toEqual([
      'docs/plans/2026-06-22-001-feat-user-language-sync-plan.md',
      'docs/tasks/2026-06-22-001-feat-user-language-sync-tasks.md',
    ]);
    expect(fanoutCase.input_files.map((entry) => entry.path)).toEqual([
      'docs/plans/2026-06-22-001-feat-user-language-sync-plan.md',
      'docs/tasks/2026-06-22-001-feat-user-language-sync-tasks.md',
    ]);
    expect(fanoutCase.objective_assertions.join('\n')).toContain('source_unit appears in more than one task');
    expect(fanoutCase.with_skill_expectations.join('\n')).toContain('repeat the same source_unit');
    expect(fanoutCase.missing_evidence).toEqual(expect.arrayContaining([
      'provider telemetry',
      'human adjudication',
    ]));
    expect(degradedHelperCase.evidence_status).toBe('file-backed fixture');
    expect(degradedHelperCase.source_ref_authority).toBe('historical');
    expect(degradedHelperCase.input_files.map((entry) => entry.path)).toEqual([
      'docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md',
      'docs/tasks/2026-06-21-004-feat-team-standards-governance-layer-tasks.md',
    ]);
    expect(degradedHelperCase.baseline_risks.join('\n')).toContain('degraded helper output');
    expect(degradedHelperCase.with_skill_expectations.join('\n')).toContain('records degraded helper output');
    expect(degradedHelperCase.objective_assertions.join('\n')).toContain('candidate_level: lightweight');
    expect(degradedHelperCase.objective_assertions.join('\n')).toContain('deterministic_handoff: true');
    expect(degradedHelperCase.missing_evidence).toEqual(expect.arrayContaining([
      'provider telemetry',
      'human adjudication',
    ]));
  });

  test('eval cases cover trigger, boundary, failure, and expected behavior posture', () => {
    const skill = read(SKILL_PATH);
    const handoff = read(HANDOFF_CONTRACT_PATH);
    const readme = read(EVALS_README_PATH);
    const decisionLine = handoff.match(/^decision: (.+)$/m);
    const evalFiles = [
      'trigger-cases.json',
      'boundary-cases.json',
      'failure-cases.json',
      'expected-behavior-cases.json',
    ];
    const failureModesSection = skill.split(/^## Failure Modes$/m)[1].split('## Scope Backoff')[0];
    const allowedDecisions = new Set(decisionLine[1].split('|').map((decision) => decision.trim()));
    const allowedFailures = new Set([...failureModesSection.matchAll(/^- `([a-z_]+)`: /gm)].map((match) => match[1]));
    const seenIds = new Set();
    const coveredDecisions = new Set();
    const coveredFailures = new Set();

    expect(allowedDecisions.size).toBeGreaterThanOrEqual(5);
    expect(allowedFailures.size).toBeGreaterThanOrEqual(9);
    expect(readme).toContain('LLM review fixtures，不是 executable eval runner');
    expect(readme).toContain('`expected_decision` 必须来自 `SKILL.md` 的 Final Decision Envelope');
    expect(readme).toContain('`expected_failure` 必须来自 `SKILL.md` 的 Failure Modes 枚举');
    expect(readme).toContain('每个 decision 至少要有一个 eval case 覆盖');
    expect(readme).toContain('每个 failure 至少要有一个 eval case 覆盖');
    expect(readme).toContain('确定性测试只校验 JSON shape');
    expect(readme).toContain('LLM 负责判断样例是否代表真实触发、边界、失败或期望行为');

    for (const fileName of evalFiles) {
      const payload = JSON.parse(read(path.join(EVALS_DIR, fileName)));

      expect(payload.schema_version).toContain('spec-write-tasks');
      expect(Array.isArray(payload.cases)).toBe(true);
      expect(payload.cases.length).toBeGreaterThanOrEqual(3);

      for (const evalCase of payload.cases) {
        expect(typeof evalCase.id).toBe('string');
        expect(evalCase.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(seenIds.has(evalCase.id)).toBe(false);
        seenIds.add(evalCase.id);
        expect(typeof evalCase.input).toBe('string');
        expect(evalCase.input.length).toBeGreaterThan(0);

        if (evalCase.expected_decision) {
          expect(allowedDecisions.has(evalCase.expected_decision)).toBe(true);
          coveredDecisions.add(evalCase.expected_decision);
        }
        if (evalCase.expected_failure) {
          expect(allowedFailures.has(evalCase.expected_failure)).toBe(true);
          coveredFailures.add(evalCase.expected_failure);
        }
      }
    }

    for (const decision of allowedDecisions) {
      expect(coveredDecisions.has(decision)).toBe(true);
    }
    for (const failure of allowedFailures) {
      expect(coveredFailures.has(failure)).toBe(true);
    }

    const failureCases = read(path.join(EVALS_DIR, 'failure-cases.json'));
    expect(failureCases).toContain('missing_spec_id');
    expect(failureCases).toContain('stale_hash');
    expect(failureCases).toContain('repo_scope_missing');

    const boundaryCases = JSON.parse(read(path.join(EVALS_DIR, 'boundary-cases.json')));
    const implementationCase = boundaryCases.cases.find((entry) => entry.id === 'implementation-request');
    const highRiskReviewCase = boundaryCases.cases.find((entry) => entry.id === 'high-risk-review-gate');
    expect(implementationCase.boundary_note).toContain('must not be rerouted');
    expect(implementationCase.forbidden_signals).toEqual(expect.arrayContaining([
      'generated-task-pack',
      'compile-by-default',
    ]));
    expect(highRiskReviewCase.boundary_note).toContain('must not silently chain');
    expect(highRiskReviewCase.forbidden_signals).toEqual(expect.arrayContaining([
      'auto-dispatch-without-authorization',
      'general-workflow-chaining',
    ]));
  });

  test('spec-work validates task packs before creating execution tasks', () => {
    for (const filePath of [SPEC_WORK_PATH]) {
      const skill = read(filePath);

      expect(skill).toContain('If the work document is a task pack, validate it before creating execution tasks');
      expect(skill).toContain('read its frontmatter and confirm `type: task-pack`, `generated_by: spec-write-tasks`, `status: derived`, and `mode: derived`');
      expect(skill).toContain('treat that plan as the single source of truth');
      expect(skill).toContain('read `spec_id` from the task pack and source plan');
      expect(skill).toContain('If the task pack lacks `spec_id`, stop as missing identity');
      expect(skill).toContain('reject the task pack as wrong-chain handoff before implementation');
      expect(skill).toContain('missing-spec-id, spec-id-mismatch');
      expect(skill).toContain('`sha256:<64-hex>`');
      expect(skill).toContain('spec-first tasks validate <task-pack-path> --json');
      expect(skill).toContain('Task Pack Contract');
      expect(skill).toContain('if that tooling is unavailable, treat the task pack as unverifiable and stop');
      expect(skill).toContain('non-POSIX repo-relative paths, invalid wave ids, and non-boolean `parallelizable`');
      expect(skill).toContain('do not repair task-pack JSON in the executor');
      expect(skill).toContain('reject draft, transient, missing-source, missing-spec-id, spec-id-mismatch, missing-hash, unavailable-hash-tooling, unverifiable-hash, or hash-mismatch task packs before implementation');
      expect(skill).toContain('do not silently fall back to executing stale task cards');
      expect(skill).toContain("honor each task's `stop_if`");
      expect(skill).toContain('do not create execution tasks until the task-pack validation checks above have passed');
      expect(skill).toContain('optional task-pack suitability check before `before-work --plan`');
      expect(skill).toContain('recommend the diversion once only when source plan structure shows high execution complexity');
      expect(skill).toContain('many implementation units, declared `Files`, dependency chains, cross-module surfaces, broad verification spread, or `plan_depth: deep`');
      expect(skill).toContain('the reason is to reduce single-run context load, broad review scope, and coupled rollback cost');
      expect(skill).toContain('load the standalone `spec-write-tasks` skill with the plan path');
      expect(skill).toContain('do not prompt again in this work run');
      expect(skill).not.toContain('run `spec-write-tasks <plan-path>`');
    }
  });

  test('openai metadata keeps task compilation optional and host-neutral', () => {
    const metadata = read(OPENAI_PATH);

    expect(metadata).toContain('Compile or validate derived task packs');
    expect(metadata).toContain('local plan path, existing task-pack path, or clear task-splitting request');
    expect(metadata).toContain('First decide whether task compilation or validation is warranted');
    expect(metadata).toContain('the appropriate spec-work workflow');
    expect(metadata).toContain('allow_implicit_invocation: false');
    expect(metadata).not.toContain('$spec-work');
    expect(metadata).not.toContain('/spec:work');
  });

  officialPackageTest('official skill package contains only portable runtime assets', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-write-tasks-official-package-'));
    try {
      const packageProc = spawnSync('python3', [
        '-m',
        'scripts.package_skill',
        path.dirname(SKILL_PATH),
        tmpRoot,
      ], {
        cwd: OFFICIAL_SKILL_CREATOR_DIR,
        encoding: 'utf8',
      });
      expect(packageProc.status).toBe(0);

      const packagePath = path.join(tmpRoot, 'spec-write-tasks.skill');
      expect(fs.existsSync(packagePath)).toBe(true);
      const listProc = spawnSync('python3', ['-c', `
from zipfile import ZipFile
with ZipFile(${JSON.stringify(packagePath)}) as package:
    print("\\n".join(sorted(package.namelist())))
`], { encoding: 'utf8' });
      expect(listProc.status).toBe(0);
      const entries = listProc.stdout.trim().split('\n').filter(Boolean);

      expect(entries).toEqual([
        'spec-write-tasks/SKILL.md',
        'spec-write-tasks/agents/openai.yaml',
        'spec-write-tasks/references/execution-handoff-contract.md',
        'spec-write-tasks/references/task-pack-schema.md',
        'spec-write-tasks/references/task-quality-guide.md',
      ]);
      expect(entries.some((entry) => entry.includes('/evals/'))).toBe(false);

      const readSkillProc = spawnSync('python3', ['-c', `
from zipfile import ZipFile
with ZipFile(${JSON.stringify(packagePath)}) as package:
    print(package.read("spec-write-tasks/SKILL.md").decode())
`], { encoding: 'utf8' });
      expect(readSkillProc.status).toBe(0);
      expect(readSkillProc.stdout).toContain('## References');
      expect(readSkillProc.stdout).toContain('[Execution Handoff Contract](references/execution-handoff-contract.md)');
      expect(readSkillProc.stdout).toContain('[Task Pack Schema](references/task-pack-schema.md)');
      expect(readSkillProc.stdout).toContain('[Task Quality Guide](references/task-quality-guide.md)');
      expect(readSkillProc.stdout).toContain('`evals/` files are maintainer-only validation fixtures');
      expect(readSkillProc.stdout).not.toContain('](../');
      expect(readSkillProc.stdout).not.toContain('](evals/');
      expect(readSkillProc.stdout).not.toContain('argument-hint:');
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test('codex runtime sync preserves task-quality guardrails without stale wording', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-write-tasks-codex-runtime-'));
    const codex = new CodexAdapter();

    try {
      syncSkills(projectRoot, codex);

      const runtimeSkill = read(path.join(projectRoot, '.agents', 'skills', 'spec-write-tasks', 'SKILL.md'));
      const runtimeMetadata = read(path.join(projectRoot, '.agents', 'skills', 'spec-write-tasks', 'agents', 'openai.yaml'));
      const runtimeTriggerCases = path.join(projectRoot, '.agents', 'skills', 'spec-write-tasks', 'evals', 'trigger-cases.json');
      const runtimeOutputQualityCases = path.join(projectRoot, '.agents', 'skills', 'spec-write-tasks', 'evals', 'output-quality-cases.json');
      const runtimeEvalsReadme = path.join(projectRoot, '.agents', 'skills', 'spec-write-tasks', 'evals', 'README.md');

      expect(runtimeSkill).toContain('name: write-tasks');
      expect(runtimeSkill).toContain('Task-Ready Check');
      expect(runtimeSkill).toContain('Quality Pass Before Output');
      expect(runtimeSkill).toContain('reason_code');
      expect(runtimeSkill).toContain('Execution Handoff Contract');
      expect(runtimeSkill).toContain('If deterministic hash tooling is unavailable, report the task pack as unverifiable handoff');
      expect(runtimeSkill).toContain('A mismatch is a wrong-chain handoff');
      expect(runtimeSkill).not.toContain('../../docs/');
      expect(runtimeSkill).not.toContain('source_plan_hash: pending-tooling');
      expect(runtimeMetadata).toContain('First decide whether task compilation or validation is warranted');
      expect(runtimeMetadata).toContain('the appropriate spec-work workflow');
      expect(runtimeMetadata).toContain('allow_implicit_invocation: false');
      expect(runtimeMetadata).not.toContain('$spec-work');
      expect(fs.existsSync(runtimeTriggerCases)).toBe(true);
      expect(fs.existsSync(runtimeOutputQualityCases)).toBe(true);
      expect(fs.existsSync(runtimeEvalsReadme)).toBe(true);
      expect(read(runtimeTriggerCases)).toContain('explicit-split-plan');
      expect(read(runtimeOutputQualityCases)).toContain('output-quality');
      expect(read(runtimeEvalsReadme)).toContain('LLM review fixtures，不是 executable eval runner');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('spec-plan handoff only offers task-pack execution for executable task packs', () => {
    const handoff = read(PLAN_HANDOFF_PATH);

    expect(handoff).toContain('Load the standalone `spec-write-tasks` skill with the plan path');
    expect(handoff).toContain('If it writes an executable task pack with matching `spec_id` and verifiable `source_plan_hash`');
    expect(handoff).toContain('surface the copy-ready current-host doc-review invocation');
    expect(handoff).toContain('otherwise offer the current host\'s work entrypoint using the task-pack path directly');
    expect(handoff).toContain('using the task-pack path');
    expect(handoff).toContain('If it returns `skip`, `return-to-plan`, `draft-only`, unverifiable identity/hash, or a non-executable task pack');
    expect(handoff).toContain('do not offer task-pack execution');
    expect(handoff).not.toContain('/spec:work <task-pack-path>` on Claude Code');
    expect(handoff).not.toContain('$spec-work <task-pack-path>` on Codex');
  });
});
