'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { validateArtifacts } = require('../../skills/spec-standards/scripts/validate-artifacts');

const REPO_ROOT = path.join(__dirname, '..', '..');
const VALIDATOR_PATH = path.join(REPO_ROOT, 'skills/spec-standards/scripts/validate-artifacts.js');
const FIXTURE_ROOT = path.join(REPO_ROOT, 'tests/fixtures/spec-standards/valid-baseline');

function runValidator(args, cwd = REPO_ROOT) {
  const result = spawnSync(process.execPath, [VALIDATOR_PATH, ...args], {
    cwd,
    encoding: 'utf8',
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    json: result.stdout.trim() ? JSON.parse(result.stdout) : null,
  };
}

function copyFixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-validation-'));
  fs.cpSync(FIXTURE_ROOT, tmp, { recursive: true });
  return tmp;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function mutateCandidates(dir, mutate) {
  const filePath = path.join(dir, 'standards-candidates.json');
  const doc = readJson(filePath);
  mutate(doc);
  writeJson(filePath, doc);
}

function mutatePlan(dir, mutate) {
  const filePath = path.join(dir, 'standards-plan.json');
  const doc = readJson(filePath);
  mutate(doc);
  writeJson(filePath, doc);
}

function mutatePreview(dir, mutate) {
  const filePath = path.join(dir, 'standards-preview.md');
  const preview = fs.readFileSync(filePath, 'utf8');
  fs.writeFileSync(filePath, mutate(preview), 'utf8');
}

function reasonCodes(result) {
  return [
    ...((result.json && result.json.errors) || []),
    ...((result.json && result.json.warnings) || []),
  ].map((issue) => issue.reason_code);
}

function expectReason(result, reasonCode) {
  expect(reasonCodes(result)).toContain(reasonCode);
}

describe('spec-standards artifact validator', () => {
  test('valid baseline fixture returns trusted pass envelope', () => {
    const result = runValidator([
      '--standards-dir',
      'tests/fixtures/spec-standards/valid-baseline',
      '--json',
    ]);

    expect(result.status).toBe(0);
    expect(result.json).toEqual(expect.objectContaining({
      schema_version: 'spec-first.standards-validation-result.v1',
      status: 'pass',
      trust_level: 'trusted',
      checked: expect.objectContaining({
        candidates: 'tests/fixtures/spec-standards/valid-baseline/standards-candidates.json',
        preview: 'tests/fixtures/spec-standards/valid-baseline/standards-preview.md',
        plan: 'tests/fixtures/spec-standards/valid-baseline/standards-plan.json',
      }),
      errors: [],
      warnings: [],
    }));
  });

  test('explicit candidates preview and plan paths validate without a standards dir', () => {
    const dir = copyFixture();
    try {
      const result = runValidator([
        '--candidates',
        path.join(dir, 'standards-candidates.json'),
        '--preview',
        path.join(dir, 'standards-preview.md'),
        '--plan',
        path.join(dir, 'standards-plan.json'),
        '--project-shape',
        path.join(dir, 'project-shape.json'),
        '--glue-map',
        path.join(dir, 'glue-map.json'),
        '--json',
      ]);

      expect(result.status).toBe(0);
      expect(result.json.status).toBe('pass');
      expect(result.json.trust_level).toBe('trusted');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('direct validateArtifacts API returns the same envelope shape', () => {
    const result = validateArtifacts({
      standardsDir: 'tests/fixtures/spec-standards/valid-baseline',
      json: true,
      allowFallbackVocabulary: false,
    }, REPO_ROOT);

    expect(result.status).toBe('pass');
    expect(result.trust_level).toBe('trusted');
    expect(result.checked.candidates).toBe('tests/fixtures/spec-standards/valid-baseline/standards-candidates.json');
  });

  test('missing standards plan fails unless fallback vocabulary is explicitly allowed', () => {
    const dir = copyFixture();
    try {
      fs.rmSync(path.join(dir, 'standards-plan.json'));

      const strict = runValidator(['--standards-dir', dir, '--json']);
      expect(strict.status).toBe(1);
      expect(strict.json.status).toBe('fail');
      expectReason(strict, 'missing-standards-plan');

      const degraded = runValidator([
        '--standards-dir',
        dir,
        '--allow-fallback-vocabulary',
        '--json',
      ]);
      expect(degraded.status).toBe(4);
      expect(degraded.json.status).toBe('pass');
      expect(degraded.json.trust_level).toBe('degraded');
      expectReason(degraded, 'missing-standards-plan');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('workspace advisory baselines validate as degraded advisory-only context', () => {
    const dir = copyFixture();
    try {
      mutatePlan(dir, (plan) => {
        plan.scope = {
          type: 'workspace',
          root: '.',
          domains: [],
          modules: [],
          workspace: {
            child_repo_count: 1,
            child_repos: ['services/api'],
            artifacts_advisory_only: true,
          },
        };
        plan.synthesis_contract.workspace_policy = {
          active: true,
          artifacts_are_advisory: true,
        };
      });
      mutateCandidates(dir, (doc) => {
        doc.scope = { type: 'workspace' };
      });

      const result = runValidator(['--standards-dir', dir, '--json']);
      expect(result.status).toBe(4);
      expect(result.json.status).toBe('pass');
      expect(result.json.trust_level).toBe('degraded');
      expect(result.json.consumption_boundary).toBe('advisory_only');
      expect(result.json.scope.type).toBe('workspace');
      expectReason(result, 'workspace-advisory-only');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('scope.type=workspace alone triggers advisory even with inactive workspace_policy', () => {
    const dir = copyFixture();
    try {
      mutatePlan(dir, (plan) => {
        plan.scope = { type: 'workspace', root: '.' };
        plan.synthesis_contract.workspace_policy = { active: false, artifacts_are_advisory: false };
      });
      mutateCandidates(dir, (doc) => {
        doc.scope = { type: 'workspace' };
      });

      const result = runValidator(['--standards-dir', dir, '--json']);
      expect(result.json.consumption_boundary).toBe('advisory_only');
      expectReason(result, 'workspace-advisory-only');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('candidate scope must match the standards plan scope', () => {
    const dir = copyFixture();
    try {
      mutatePlan(dir, (plan) => {
        plan.scope = { type: 'repo', root: '.' };
      });
      mutateCandidates(dir, (doc) => {
        doc.scope = { type: 'workspace' };
      });

      const result = runValidator(['--standards-dir', dir, '--json']);
      expect(result.status).toBe(1);
      expectReason(result, 'scope-mismatch');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('usage errors return exit code 2 without a validation envelope', () => {
    const result = runValidator(['--candidates', 'standards-candidates.json', '--json']);

    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Either --standards-dir or both --candidates and --preview are required.');
  });

  test('unmapped allowed statuses cannot silently become hard context', () => {
    const dir = copyFixture();
    try {
      mutatePlan(dir, (plan) => {
        plan.synthesis_contract.allowed_statuses.push('advisory');
      });

      const result = runValidator(['--standards-dir', dir, '--json']);
      expect(result.status).toBe(1);
      expectReason(result, 'invalid-candidate-status');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('candidate structure validates required fields status source type and status counts', () => {
    const dir = copyFixture();
    try {
      mutateCandidates(dir, (doc) => {
        delete doc.candidates[0].source_type;
        doc.candidates[1].status = 'advisory';
        doc.candidates[2].source_type = 'remote_import';
        doc.status_counts.observed = 2;
      });

      const result = runValidator(['--standards-dir', dir, '--json']);
      expect(result.status).toBe(1);
      expectReason(result, 'missing-required-field');
      expectReason(result, 'invalid-candidate-status');
      expectReason(result, 'invalid-source-type');
      expectReason(result, 'status-count-mismatch');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('candidate ids must be unique because references use ids as stable keys', () => {
    const dir = copyFixture();
    try {
      mutateCandidates(dir, (doc) => {
        doc.candidates[1].id = doc.candidates[0].id;
      });

      const result = runValidator(['--standards-dir', dir, '--json']);
      expect(result.status).toBe(1);
      expectReason(result, 'duplicate-candidate-id');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('confirmed candidates require safe source or external confirmation attestation', () => {
    const importedWithoutConfirmation = copyFixture();
    const importedWithoutAttestation = copyFixture();
    const importedWithAttestation = copyFixture();
    const observedConfirmed = copyFixture();
    try {
      mutateCandidates(importedWithoutConfirmation, (doc) => {
        doc.candidates[2].status = 'confirmed';
        doc.status_counts.confirmed = 2;
        doc.status_counts.imported = 0;
      });
      const unsafeImported = runValidator(['--standards-dir', importedWithoutConfirmation, '--json']);
      expect(unsafeImported.status).toBe(1);
      expectReason(unsafeImported, 'unsafe-confirmed-without-confirmation');

      mutateCandidates(importedWithoutAttestation, (doc) => {
        doc.candidates[2].status = 'confirmed';
        doc.candidates[2].confirmation = { type: 'human_confirmed' };
        doc.status_counts.confirmed = 2;
        doc.status_counts.imported = 0;
      });
      const selfAttested = runValidator(['--standards-dir', importedWithoutAttestation, '--json']);
      expect(selfAttested.status).toBe(1);
      expectReason(selfAttested, 'confirmation-not-externally-attested');

      mutateCandidates(importedWithAttestation, (doc) => {
        doc.candidates[2].status = 'confirmed';
        doc.candidates[2].confirmation = { type: 'human_confirmed' };
        doc.status_counts.confirmed = 2;
        doc.status_counts.imported = 0;
      });
      writeJson(path.join(importedWithAttestation, 'confirmations.json'), {
        confirmed_candidate_ids: ['standards.imported.service-boundary'],
      });
      const attested = runValidator(['--standards-dir', importedWithAttestation, '--json']);
      expect(attested.status).toBe(0);

      mutateCandidates(observedConfirmed, (doc) => {
        doc.candidates[1].status = 'confirmed';
        doc.status_counts.confirmed = 2;
        doc.status_counts.observed = 0;
      });
      const unsafeObserved = runValidator(['--standards-dir', observedConfirmed, '--json']);
      expect(unsafeObserved.status).toBe(1);
      expectReason(unsafeObserved, 'unsafe-confirmed-source');
    } finally {
      fs.rmSync(importedWithoutConfirmation, { recursive: true, force: true });
      fs.rmSync(importedWithoutAttestation, { recursive: true, force: true });
      fs.rmSync(importedWithAttestation, { recursive: true, force: true });
      fs.rmSync(observedConfirmed, { recursive: true, force: true });
    }
  });

  test('standards-dir mode honors explicit external confirmation and patch paths', () => {
    const confirmedWithExternalFile = copyFixture();
    const patchSafety = copyFixture();
    const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-external-attestation-'));
    try {
      const confirmationsPath = path.join(externalRoot, 'confirmations.json');
      const patchPath = path.join(externalRoot, 'repo-profile.patch.yaml');

      mutateCandidates(confirmedWithExternalFile, (doc) => {
        doc.candidates[2].status = 'confirmed';
        doc.candidates[2].confirmation = { type: 'human_confirmed' };
        doc.status_counts.confirmed = 2;
        doc.status_counts.imported = 0;
      });
      writeJson(confirmationsPath, {
        confirmed_candidate_ids: ['standards.imported.service-boundary'],
      });
      const confirmed = runValidator([
        '--standards-dir',
        confirmedWithExternalFile,
        '--confirmations',
        confirmationsPath,
        '--json',
      ]);
      expect(confirmed.status).toBe(0);

      fs.writeFileSync(
        patchPath,
        'confirmed_candidate_ids:\n  - standards.observed.artifacts\n',
        'utf8',
      );
      const unsafePatch = runValidator([
        '--standards-dir',
        patchSafety,
        '--patch',
        patchPath,
        '--json',
      ]);
      expect(unsafePatch.status).toBe(1);
      expectReason(unsafePatch, 'patch-references-non-confirmed-candidate');
    } finally {
      fs.rmSync(confirmedWithExternalFile, { recursive: true, force: true });
      fs.rmSync(patchSafety, { recursive: true, force: true });
      fs.rmSync(externalRoot, { recursive: true, force: true });
    }
  });

  test.each([
    { evidence: [], reason: 'empty-evidence' },
    { evidence: [''], reason: 'invalid-evidence-shape' },
    { evidence: ['see'], reason: 'invalid-evidence-shape' },
    { evidence: [{}], reason: 'invalid-evidence-shape' },
  ])('observed evidence shape rejects $reason', ({ evidence, reason }) => {
    const dir = copyFixture();
    try {
      mutateCandidates(dir, (doc) => {
        doc.candidates[1].evidence = evidence;
      });

      const result = runValidator(['--standards-dir', dir, '--json']);
      expect(result.status).toBe(1);
      expectReason(result, reason);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('unknown candidates can pass with a question and no code evidence', () => {
    const dir = copyFixture();
    try {
      mutateCandidates(dir, (doc) => {
        doc.candidates[5].evidence = [];
        doc.candidates[5].question = 'Who owns final confirmation?';
      });

      const result = runValidator(['--standards-dir', dir, '--json']);
      expect(result.status).toBe(0);
      expect(result.json.status).toBe('pass');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('conflict and unknown reference lists must point at matching candidate statuses', () => {
    const dir = copyFixture();
    try {
      mutateCandidates(dir, (doc) => {
        doc.conflicts = [{ candidate_id: 'standards.observed.artifacts' }];
        doc.unknowns = [{ candidate_id: 'standards.confirmed.preview-first' }];
      });

      const result = runValidator(['--standards-dir', dir, '--json']);
      expect(result.status).toBe(1);
      expectReason(result, 'conflict-reference-mismatch');
      expectReason(result, 'unknown-reference-mismatch');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('repo profile patch cannot reference non-confirmed candidates', () => {
    const dir = copyFixture();
    try {
      fs.writeFileSync(
        path.join(dir, 'repo-profile.patch.yaml'),
        'confirmed_candidate_ids:\n  - standards.observed.artifacts\n',
        'utf8',
      );

      const result = runValidator(['--standards-dir', dir, '--json']);
      expect(result.status).toBe(1);
      expectReason(result, 'patch-references-non-confirmed-candidate');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('repo profile patch must include non-empty confirmed candidate ids', () => {
    const missingIds = copyFixture();
    const emptyIds = copyFixture();
    try {
      fs.writeFileSync(
        path.join(missingIds, 'repo-profile.patch.yaml'),
        [
          'schema_version: spec-first.repo-profile-patch.v1',
          'patch:',
          '  confirmed_standards:',
          '    unsafe: "writes without stable candidate ids"',
          '',
        ].join('\n'),
        'utf8',
      );
      const missing = runValidator(['--standards-dir', missingIds, '--json']);
      expect(missing.status).toBe(1);
      expectReason(missing, 'patch-missing-confirmed-candidate-ids');

      fs.writeFileSync(
        path.join(emptyIds, 'repo-profile.patch.yaml'),
        'confirmed_candidate_ids: []\n',
        'utf8',
      );
      const empty = runValidator(['--standards-dir', emptyIds, '--json']);
      expect(empty.status).toBe(1);
      expectReason(empty, 'patch-missing-confirmed-candidate-ids');
    } finally {
      fs.rmSync(missingIds, { recursive: true, force: true });
      fs.rmSync(emptyIds, { recursive: true, force: true });
    }
  });

  test('preview checker reports missing writeback section separately from missing unchanged statement', () => {
    const missingSection = copyFixture();
    const missingStatement = copyFixture();
    try {
      mutatePreview(missingSection, (preview) => preview.replace(/\n## 11\. Writeback Status[\s\S]*$/u, '\n'));
      const sectionResult = runValidator(['--standards-dir', missingSection, '--json']);
      expect(sectionResult.status).toBe(1);
      expectReason(sectionResult, 'preview-missing-writeback-status');

      mutatePreview(missingStatement, (preview) => (
        preview.replace('`repo-profile.yaml` was not modified.', 'Patch generation is deferred for review.')
      ));
      const statementResult = runValidator(['--standards-dir', missingStatement, '--json']);
      expect(statementResult.status).toBe(1);
      expectReason(statementResult, 'preview-missing-repo-profile-unchanged-statement');
    } finally {
      fs.rmSync(missingSection, { recursive: true, force: true });
      fs.rmSync(missingStatement, { recursive: true, force: true });
    }
  });

  test('preview checker accepts localized required section headings', () => {
    const dir = copyFixture();
    try {
      mutatePreview(dir, (preview) => preview
        .replace('## 1. Summary', '## 摘要')
        .replace('## 2. Detected Project Mode', '## 项目模式')
        .replace('## 3. Detected Project Shape', '## 项目形态')
        .replace('## 4. Artifact Plan', '## 产物计划')
        .replace('## 5. Evidence Quality', '## 证据质量')
        .replace('## 6. Glue Capability Map Summary', '## 胶水能力摘要')
        .replace('## 7. Candidates By Status', '## 候选规范状态')
        .replace('## 8. Conflicts', '## 冲突')
        .replace('## 9. Unknowns / Requires User Decision', '## 需要用户决策')
        .replace('## 10. Downstream Consumption', '## 下游消费摘要')
        .replace('## 11. Writeback Status', '## 写回状态'));

      const result = runValidator(['--standards-dir', dir, '--json']);
      expect(result.status).toBe(0);
      expect(result.json.status).toBe('pass');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('preview must expose conflict and unknown risks', () => {
    const dir = copyFixture();
    try {
      mutatePreview(dir, (preview) => preview
        .replace('- conflict: 1', '- conflict: pending review')
        .replace('- unknown: 1', '- unknown: pending decision')
        .replace(/## 8\. Conflicts[\s\S]*?## 9\. Unknowns/u, '## 8. Conflicts\n\nRisks require review.\n\n## 9. Unknowns')
        .replace(/## 9\. Unknowns \/ Requires User Decision[\s\S]*?## 10\. Downstream Consumption/u, '## 9. Unknowns / Requires User Decision\n\nQuestions require user input.\n\n## 10. Downstream Consumption'));

      const result = runValidator(['--standards-dir', dir, '--json']);
      expect(result.status).toBe(1);
      expectReason(result, 'preview-hides-conflict');
      expectReason(result, 'preview-hides-unknown');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('preview count mismatch is reported when visible counts disagree with candidates', () => {
    const dir = copyFixture();
    try {
      mutatePreview(dir, (preview) => preview.replace('Conflicts: 1', 'Conflicts: 0'));

      const result = runValidator(['--standards-dir', dir, '--json']);
      expect(result.status).toBe(1);
      expectReason(result, 'preview-count-mismatch');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
