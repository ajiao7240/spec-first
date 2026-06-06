'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const { planBundledAssetSync } = require('../../src/cli/plugin');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-compound', 'SKILL.md');
const COMPOUND_REFRESH_SKILL_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-compound-refresh',
  'SKILL.md',
);
const COMPOUND_REFRESH_PER_ACTION_FLOWS_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-compound-refresh',
  'references',
  'per-action-flows.md',
);
const COMPOUND_CONCEPTS_REFERENCE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-compound',
  'references',
  'concepts-vocabulary.md',
);
const COMPOUND_REFRESH_CONCEPTS_REFERENCE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-compound-refresh',
  'references',
  'concepts-vocabulary.md',
);
const COMPOUND_RESOLUTION_TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-compound',
  'assets',
  'resolution-template.md',
);
const COMPOUND_REFRESH_RESOLUTION_TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-compound-refresh',
  'assets',
  'resolution-template.md',
);
const COMPOUND_SCHEMA_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-compound',
  'references',
  'schema.yaml',
);
const COMPOUND_REFRESH_SCHEMA_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-compound-refresh',
  'references',
  'schema.yaml',
);
const COMPOUND_YAML_SCHEMA_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-compound',
  'references',
  'yaml-schema.md',
);
const COMPOUND_REFRESH_YAML_SCHEMA_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-compound-refresh',
  'references',
  'yaml-schema.md',
);

function plannedRuntimeContent(adapter, targetPath) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-compound-runtime-'));

  try {
    const { plan } = planBundledAssetSync(projectRoot, adapter);
    const operation = plan.operations.find((entry) => entry.path === targetPath);
    if (!operation) {
      throw new Error(`Missing planned runtime operation for ${targetPath}`);
    }
    return operation.contents;
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
}

describe('spec-compound host entrypoint contract', () => {
  test('usage and follow-up guidance use current-host entrypoint wording', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('current host\'s compound entrypoint');
    expect(text).toContain('current host\'s compound entrypoint with brief context');
    expect(text).toContain('current host\'s compound entrypoint');
    expect(text).not.toContain('Use /spec:compound [context]');
    expect(text).not.toContain('re-run /spec:compound in a fresh session');
    expect(text).not.toContain('- `/spec:plan` - Planning workflow');
    expect(text).not.toContain('/spec:compound` on Claude Code');
    expect(text).not.toContain('$spec-compound` on Codex');
    expect(text).not.toContain('/spec:plan` on Claude Code');
    expect(text).not.toContain('$spec-plan` on Codex');
  });

  test('compound and refresh use distilled replay refs without creating a replay index', () => {
    const compound = fs.readFileSync(SKILL_PATH, 'utf8');
    const refresh = fs.readFileSync(COMPOUND_REFRESH_SKILL_PATH, 'utf8');

    for (const text of [compound, refresh]) {
      expect(text).toContain('Distilled Replay References');
      expect(text).toContain('prefer distilled replay refs over');
      expect(text).toContain('the accepted or rejected');
      expect(text).toContain('evidence path');
      expect(text).toContain('must not become workflow status');
      expect(text).toContain('Do not build a durable replay index');
      expect(text).toContain('full transcripts, raw tool output');
    }

    expect(compound).toContain('the reusable lesson delta and evidence paths');
    expect(compound).toContain('external-tool or broad impact evidence');
    expect(compound).toContain('source-confirmed by changed source, tests, logs, contracts, or review findings');
    expect(refresh).toContain('External-tool/session evidence can focus which files or relationships to inspect');
    expect(refresh).toContain('raw external-tool output and raw diff hunks');
    expect(refresh).toContain('the specific refresh implication');
  });

  test('compound maintains CONCEPTS.md only as existing advisory vocabulary', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    const reference = fs.readFileSync(COMPOUND_CONCEPTS_REFERENCE_PATH, 'utf8');

    expect(skill).toContain('references/concepts-vocabulary.md');
    expect(skill).toContain('### Phase 2.4: Vocabulary Capture');
    expect(skill).toContain('If `CONCEPTS.md` exists, read `references/concepts-vocabulary.md`');
    expect(skill).toContain('If `CONCEPTS.md` does not exist, do not create or bootstrap it from `spec-compound`');
    expect(skill).toContain('CONCEPTS.md: not present; no vocabulary maintenance applied');
    expect(skill).toContain('the primary output remains one `docs/solutions/` learning document');
    expect(skill).toContain('Vocabulary capture is advisory maintenance');
    expect(skill).toContain('Do not run a repo-wide concept sweep');
    expect(skill).toContain('CONCEPTS.md: <updated');
    expect(skill).toContain('One primary solution doc is written; optional maintenance writes');
    expect(skill).not.toContain('One file written.');
    expect(skill).not.toContain('mode:headless');
    expect(skill).not.toContain('ce-compound');

    expect(reference).toContain('repo-local advisory vocabulary');
    expect(reference).toContain('not a PRD, ADR, workflow contract, product roadmap, setup requirement, or source-of-truth override');
    expect(reference).toContain('vocabulary maintenance is update-only');
    expect(reference).toContain('do not create or bootstrap it during learning capture');
    expect(reference).toContain('A downstream project does not need this file for `spec-first` to work');
    expect(reference).toContain('Do not run a repo-wide concept sweep from compound');
    expect(reference).not.toContain('ce-compound');
    expect(reference).not.toContain('Compound Engineering');
  });

  test('compound-refresh keeps autofix mode and scopes advisory vocabulary maintenance', () => {
    const skill = fs.readFileSync(COMPOUND_REFRESH_SKILL_PATH, 'utf8');
    const reference = fs.readFileSync(COMPOUND_REFRESH_CONCEPTS_REFERENCE_PATH, 'utf8');

    expect(skill).toContain('mode:autofix');
    expect(skill).not.toContain('mode:headless');
    expect(skill).toContain('references/concepts-vocabulary.md');
    expect(skill).toContain('**Vocabulary**');
    expect(skill).toContain('## Phase 4.5: Vocabulary Capture');
    expect(skill).toContain('First, read `references/concepts-vocabulary.md`');
    expect(skill).toContain('If `CONCEPTS.md` does not exist, do not create or bootstrap it from an ordinary refresh');
    expect(skill).toContain('CONCEPTS.md: not present; no vocabulary maintenance applied');
    expect(skill).toContain('must not turn `CONCEPTS.md` into a PRD, ADR, workflow contract, source-of-truth override, setup requirement, or mandatory downstream project file');
    expect(skill).toContain('CONCEPTS.md: <not present; no vocabulary maintenance applied | scanned, no qualifying terms | updated');
    expect(skill).toContain('In `mode:autofix`, include a discoverability recommendation in the report rather than editing instruction files');
    expect(skill).not.toContain('ce-compound-refresh');

    expect(reference).toContain('vocabulary maintenance is scoped and advisory');
    expect(reference).toContain('do not create or bootstrap it as part of an ordinary refresh');
    expect(reference).toContain('recommend an explicit separately scoped vocabulary bootstrap');
    expect(reference).toContain('Do not turn a focused refresh into a repo-wide vocabulary sweep');
    expect(reference).toContain('In `mode:autofix`, report a discoverability recommendation only');
    expect(reference).not.toContain('ce-compound-refresh');
    expect(reference).not.toContain('mode:headless');
  });

  test('compound-refresh checks inbound links before deleting solution docs', () => {
    const text = [
      fs.readFileSync(COMPOUND_REFRESH_SKILL_PATH, 'utf8'),
      fs.readFileSync(COMPOUND_REFRESH_PER_ACTION_FLOWS_PATH, 'utf8'),
    ].join('\n');

    expect(text).toContain('Delete when the code is gone, and only after checking for inbound links');
    expect(text).toContain('Inbound links inform classification, not cleanup');
    expect(text).toContain('decorative');
    expect(text).toContain('substantive');
    expect(text).toContain('Search the filename slug (without `.md`)');
    expect(text).toContain('Auto-delete only when all three hold');
    expect(text).toContain('Inbound links are absent or unambiguously decorative');
    expect(text).toContain('Before unlinking the file, run a final inbound-link check');
    expect(text).not.toContain('Auto-delete only when both the implementation AND the problem domain are gone');
  });

  test('compound-refresh routes action execution to per-action reference without inline flow bloat', () => {
    const skill = fs.readFileSync(COMPOUND_REFRESH_SKILL_PATH, 'utf8');
    const reference = fs.readFileSync(COMPOUND_REFRESH_PER_ACTION_FLOWS_PATH, 'utf8');

    expect(skill).toContain('Load `skills/spec-compound-refresh/references/per-action-flows.md`');
    expect(skill).toContain('Replace still runs `python3 scripts/validate-frontmatter.py <new-learning-path>`');
    expect(skill).toContain('Delete still performs the final inbound-link check');
    expect(skill).not.toContain('### Keep Flow');
    expect(skill).not.toContain('### Update Flow');
    expect(skill).not.toContain('### Consolidate Flow');
    expect(skill).not.toContain('### Replace Flow');
    expect(skill).not.toContain('### Delete Flow');

    expect(reference).toContain('## Keep Flow');
    expect(reference).toContain('## Update Flow');
    expect(reference).toContain('## Consolidate Flow');
    expect(reference).toContain('## Replace Flow');
    expect(reference).toContain('## Delete Flow');
    expect(reference).toContain('python3 scripts/validate-frontmatter.py <new-learning-path>');
    expect(reference).toContain('Before unlinking the file, run a final inbound-link check');
  });

  test('Claude command projection points compound-refresh action flow reference at the workflow runtime copy', () => {
    const command = plannedRuntimeContent(new ClaudeAdapter(), '.claude/commands/spec/compound-refresh.md');

    expect(command).toContain('Load `.claude/spec-first/workflows/spec-compound-refresh/references/per-action-flows.md`');
    expect(command).not.toContain('Load `references/per-action-flows.md`');
    expect(command).not.toContain('Load `skills/spec-compound-refresh/references/per-action-flows.md`');
  });

  test('compound and refresh templates include structured recall promotion fields', () => {
    const templates = [
      fs.readFileSync(COMPOUND_RESOLUTION_TEMPLATE_PATH, 'utf8'),
      fs.readFileSync(COMPOUND_REFRESH_RESOLUTION_TEMPLATE_PATH, 'utf8'),
    ];
    const sectionBetween = (text, start, end) => {
      const startIndex = text.indexOf(start);
      expect(startIndex).toBeGreaterThanOrEqual(0);
      const endIndex = end ? text.indexOf(end, startIndex + start.length) : -1;
      return endIndex === -1 ? text.slice(startIndex) : text.slice(startIndex, endIndex);
    };

    for (const text of templates) {
      const bugTemplate = sectionBetween(text, '## Bug Track Template', '## Knowledge Track Template');
      const knowledgeTemplate = sectionBetween(text, '## Knowledge Track Template');

      for (const block of [bugTemplate, knowledgeTemplate]) {
        for (const field of [
          'domain:',
          'pattern:',
          'rejected_alternatives:',
          'applicable_versions:',
          'invalidation_condition:',
          'source_refs:',
        ]) {
          expect(block).toContain(field);
        }
        expect(block).toContain('rejected_alternatives, applicable_versions, source_refs');
        expect(block).toContain('- [repo-relative source, test, doc, or review path]');
      }
    }
  });

  test('compound-refresh support files stay aligned with structured promotion schema', () => {
    const schemaTexts = [
      fs.readFileSync(COMPOUND_SCHEMA_PATH, 'utf8'),
      fs.readFileSync(COMPOUND_REFRESH_SCHEMA_PATH, 'utf8'),
    ];
    const yamlSchemaTexts = [
      fs.readFileSync(COMPOUND_YAML_SCHEMA_PATH, 'utf8'),
      fs.readFileSync(COMPOUND_REFRESH_YAML_SCHEMA_PATH, 'utf8'),
    ];

    for (const text of schemaTexts) {
      expect(text).toContain('new_promote_required_fields');
      expect(text).toContain('legacy_unstructured_advisory');
      expect(text).toContain('New promoted solution docs must include invalidation_condition and source_refs');
      expect(text).toContain('Existing docs missing the structured recall fields remain legacy_unstructured_advisory');
      expect(text).toContain('rejected_alternatives, applicable_versions, source_refs');
    }

    for (const text of yamlSchemaTexts) {
      expect(text).toContain('New Promote Required Fields');
      expect(text).toContain('legacy_unstructured_advisory');
      expect(text).toContain('rejected_alternatives`, `applicable_versions`');
      expect(text).toContain('source_refs`, or any future array field');
    }
  });

  test('compound and compound-refresh keep byte-identical schema copies (no silent drift)', () => {
    // 两个 skill 各自持有一份 schema.yaml / yaml-schema.md 副本,靠手工同步。
    // 字节相等断言守住单边改动导致的跨 skill 合同漂移。
    expect(fs.readFileSync(COMPOUND_REFRESH_SCHEMA_PATH, 'utf8'))
      .toEqual(fs.readFileSync(COMPOUND_SCHEMA_PATH, 'utf8'));
    expect(fs.readFileSync(COMPOUND_REFRESH_YAML_SCHEMA_PATH, 'utf8'))
      .toEqual(fs.readFileSync(COMPOUND_YAML_SCHEMA_PATH, 'utf8'));
  });
});
