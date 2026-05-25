'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { runInternal } = require('../../src/cli/commands/internal');
const { validateAgainstSchema } = require('../../src/contracts/schema-validator');
const {
  pruneSpecWorkRunArtifacts,
  readSpecWorkRunArtifact,
  validatePayload,
  writeSpecWorkRunArtifact,
} = require('../../src/cli/helpers/spec-work-run-artifact');

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'docs', 'contracts', 'workflows', 'spec-work-run-artifact.schema.json');

function makeRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-work-run-artifact-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Spec First Test'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'spec-first-test@example.invalid'], { cwd: repo });
  execFileSync('git', ['config', 'core.hooksPath', '/dev/null'], { cwd: repo });
  return repo;
}

function validPayload(overrides = {}) {
  return {
    schema_version: 'spec-work-run-artifact-payload/v1',
    workflow: 'spec-work',
    mode: 'interactive',
    plan_path: 'docs/plans/example-plan.md',
    plan_source: 'explicit',
    task_pack_path: 'docs/tasks/example-tasks.md',
    source_refs: ['docs/plans/example-plan.md', 'docs/tasks/example-tasks.md'],
    script_confirmed: {
      validation: {
        status: 'passed',
        commands: [
          {
            command: 'npm run test:jest -- tests/unit/spec-work-run-artifact-producer.test.js --runInBand',
            exit_code: 0,
            summary: 'producer tests passed',
          },
        ],
      },
      changed_files: ['src/cli/helpers/spec-work-run-artifact.js'],
      artifact_refs: ['.spec-first/workflows/spec-work/spec-first/run-1/run.json'],
      raw_log_ref: {
        kind: 'none',
        display_ref: '',
        secret_stripped: true,
        redaction_status: 'none-required',
        retention_status: 'lifecycle-deferred',
        access_boundary: 'none',
        reason_code: 'no-raw-log',
      },
      resume_evidence: {
        status: 'not-run',
        reason_code: 'first-write',
      },
    },
    llm_asserted: {
      summary: 'Work completed.',
      read_artifacts: ['docs/plans/example-plan.md'],
      key_decisions: ['Keep workflow integration separate from producer availability.'],
      deferred_follow_up: ['Retention lifecycle remains Phase 3.'],
      next_action: 'Run review.',
    },
    provider_untrusted: {
      readiness_status: 'degraded',
      summaries: ['provider evidence was degraded and not used as confirmed truth'],
    },
    retention: {
      retention_status: 'lifecycle-deferred',
      artifact_category: 'spec-work-run-evidence',
      raw_log_retention_impact: 'none',
      redaction_status: 'none-required',
    },
    ...overrides,
  };
}

function validGraphEvidenceUsed() {
  return {
    capabilities_used: ['api_impact', 'shape_check'],
    evidence_grade: 'primary',
    evidence_posture: 'fallback',
    freshness_state: 'fresh',
    repo_scope: 'spec-first',
    graph_findings_applied: ['shape_check focused response-shape contract reads'],
    graph_findings_as_risk_only: ['consumer outside plan scope recorded as follow-up'],
    source_reads_validated: ['docs/contracts/downstream-graph-evidence-consumption.md direct read'],
    redaction_status: 'none-required',
  };
}

function writePayload(repo, payload, fileName = 'payload.json') {
  const filePath = path.join(repo, fileName);
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
  return filePath;
}

function captureStdout(fn) {
  const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  try {
    const code = fn();
    const stdout = outputSpy.mock.calls.map((call) => String(call[0])).join('');
    return { code, stdout };
  } finally {
    outputSpy.mockRestore();
  }
}

describe('spec-work run artifact producer', () => {
  test('writes a schema-aligned run artifact through the internal CLI boundary', () => {
    const repo = makeRepo();
    try {
      const inputPath = writePayload(repo, validPayload());

      const { code, stdout } = captureStdout(() => runInternal([
        'spec-work-run-artifact',
        'write',
        '--input',
        inputPath,
        '--run-id',
        'run-1',
        '--target-repo',
        repo,
      ]));
      const output = JSON.parse(stdout);

      expect(code).toBe(0);
      expect(output).toEqual(expect.objectContaining({
        status: 'written',
        reason_code: 'written',
        schema_version: 'spec-work-run-artifact/v1',
        producer_available: true,
        workflow_integrated: false,
      }));
      expect(output.artifact_path).toMatch(/^\.spec-first\/workflows\/spec-work\/spec-work-run-artifact-[a-z0-9]+\/run-1\/run\.json$/);
      const artifact = JSON.parse(fs.readFileSync(path.join(repo, output.artifact_path), 'utf8'));
      expect(artifact.producer).toEqual({
        producer_available: true,
        workflow_integrated: false,
        reason_code: 'producer-write-side-only',
      });
      expect(artifact.retention.retention_status).toBe('lifecycle-deferred');
      expect(artifact.retention.owner).toBe('spec-work');
      expect(Date.parse(artifact.retention.expires_at)).not.toBeNaN();
      const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
      expect(validateAgainstSchema(schema, artifact).errors).toEqual([]);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('writes compact graph_evidence_used when provided and remains backward compatible when omitted', () => {
    const repo = makeRepo();
    try {
      const withGraphPath = writePayload(repo, validPayload({
        graph_evidence_used: validGraphEvidenceUsed(),
      }), 'with-graph.json');
      const withoutGraphPath = writePayload(repo, validPayload(), 'without-graph.json');

      const withGraph = captureStdout(() => runInternal([
        'spec-work-run-artifact',
        'write',
        '--input',
        withGraphPath,
        '--run-id',
        'run-with-graph',
        '--target-repo',
        repo,
      ]));
      const withGraphOutput = JSON.parse(withGraph.stdout);
      expect(withGraph.code).toBe(0);
      const withGraphArtifact = JSON.parse(fs.readFileSync(path.join(repo, withGraphOutput.artifact_path), 'utf8'));
      expect(withGraphArtifact.graph_evidence_used).toEqual(validGraphEvidenceUsed());

      const withoutGraph = captureStdout(() => runInternal([
        'spec-work-run-artifact',
        'write',
        '--input',
        withoutGraphPath,
        '--run-id',
        'run-without-graph',
        '--target-repo',
        repo,
      ]));
      const withoutGraphOutput = JSON.parse(withoutGraph.stdout);
      expect(withoutGraph.code).toBe(0);
      const withoutGraphArtifact = JSON.parse(fs.readFileSync(path.join(repo, withoutGraphOutput.artifact_path), 'utf8'));
      expect(Object.prototype.hasOwnProperty.call(withoutGraphArtifact, 'graph_evidence_used')).toBe(false);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('direct writer returns not-written for missing target repo without throwing', () => {
    const repo = makeRepo();
    const missingRepo = path.join(repo, 'missing');
    try {
      const inputPath = writePayload(repo, validPayload());
      const result = writeSpecWorkRunArtifact({
        inputPath,
        runId: 'run-1',
        targetRepo: missingRepo,
      });

      expect(result.exitCode).toBe(0);
      expect(result.output.status).toBe('not-written');
      expect(result.output.reason_code).toBe('target-repo-not-found');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('direct helpers reject non-Git target directories', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-work-run-artifact-nongit-'));
    try {
      const inputPath = writePayload(repo, validPayload());
      const write = writeSpecWorkRunArtifact({
        inputPath,
        runId: 'run-1',
        targetRepo: repo,
      });
      const read = readSpecWorkRunArtifact({ targetRepo: repo });
      const prune = pruneSpecWorkRunArtifacts({ targetRepo: repo, retentionDays: 1, dryRun: true });

      for (const result of [write, read, prune]) {
        expect(result.exitCode).toBe(0);
        expect(result.output.status).toBe('not-written');
        expect(result.output.reason_code).toBe('target-repo-not-found');
        expect(result.output.errors.join('\n')).toContain('target repo must be a Git repository root');
      }
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('direct helpers reject omitted target repo instead of falling back to cwd', () => {
    const repo = makeRepo();
    const originalCwd = process.cwd();
    try {
      const inputPath = writePayload(repo, validPayload());
      process.chdir(repo);

      const write = writeSpecWorkRunArtifact({
        inputPath,
        runId: 'run-1',
      });
      const read = readSpecWorkRunArtifact({});
      const prune = pruneSpecWorkRunArtifacts({ retentionDays: 1, dryRun: true });

      for (const result of [write, read, prune]) {
        expect(result.exitCode).toBe(0);
        expect(result.output.status).toBe('not-written');
        expect(result.output.reason_code).toBe('target-repo-not-found');
        expect(result.output.errors).toContain('target repo is required');
      }
      expect(fs.existsSync(path.join(repo, '.spec-first'))).toBe(false);
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('direct read helper rejects unsafe selectors before resolving paths', () => {
    const repo = makeRepo();
    try {
      const mismatched = readSpecWorkRunArtifact({
        targetRepo: repo,
        workspaceSlug: 'workspace-a',
      });
      const unsafe = readSpecWorkRunArtifact({
        targetRepo: repo,
        workspaceSlug: '..',
        runId: 'run-a',
      });

      expect(mismatched.exitCode).toBe(1);
      expect(mismatched.output.status).toBe('rejected');
      expect(mismatched.output.reason_code).toBe('invalid-arguments');
      expect(mismatched.output.errors).toContain('workspaceSlug and runId must be provided together');
      expect(unsafe.exitCode).toBe(1);
      expect(unsafe.output.status).toBe('rejected');
      expect(unsafe.output.reason_code).toBe('invalid-arguments');
      expect(unsafe.output.errors).toContain('workspaceSlug must be a stable safe identifier');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('rejects generated runtime mirrors, provider graph artifacts, absolute paths, raw output, and secrets', () => {
    const oversizedLog = Array.from({ length: 1000 }, (_, index) => `line ${index}`).join('\n');
    const badPayloads = [
      validPayload({ plan_source: 'bogus' }),
      validPayload({ plan_path: '.spec-first/workflows/spec-work/spec-first/run-1/run.json' }),
      validPayload({ source_refs: ['.agents/skills/spec-work/SKILL.md'] }),
      validPayload({ source_refs: ['.spec-first/workflows/spec-work/spec-first/run-1/run.json'] }),
      validPayload({ source_refs: ['.env'] }),
      validPayload({ source_refs: ['.git/config'] }),
      validPayload({
        script_confirmed: {
          ...validPayload().script_confirmed,
          changed_files: ['.spec-first/workflows/spec-work/spec-first/run-1/run.json'],
        },
      }),
      validPayload({
        script_confirmed: {
          ...validPayload().script_confirmed,
          changed_files: ['secrets/serviceAccount.json'],
        },
      }),
      validPayload({
        script_confirmed: {
          ...validPayload().script_confirmed,
          artifact_refs: ['.spec-first/graph/provider-status.json'],
        },
      }),
      validPayload({ llm_asserted: { ...validPayload().llm_asserted, summary: '/var/folders/raw/path' } }),
      validPayload({ provider_untrusted: { ...validPayload().provider_untrusted, raw_output: 'provider raw text' } }),
      validPayload({ provider_untrusted: { ...validPayload().provider_untrusted, details: oversizedLog } }),
      validPayload({ provider_untrusted: { ...validPayload().provider_untrusted, nested: { transcript: oversizedLog } } }),
      validPayload({ provider_untrusted: { ...validPayload().provider_untrusted, summaries: Array.from({ length: 21 }, (_, index) => `summary ${index}`) } }),
      validPayload({ graph_evidence_used: { ...validGraphEvidenceUsed(), provider_raw_output: 'provider raw text' } }),
      validPayload({ graph_evidence_used: { ...validGraphEvidenceUsed(), redaction_status: undefined } }),
      validPayload({ graph_evidence_used: { ...validGraphEvidenceUsed(), evidence_grade: 'fallback' } }),
      validPayload({ graph_evidence_used: { ...validGraphEvidenceUsed(), capabilities_used: Array.from({ length: 21 }, (_, index) => `cap-${index}`) } }),
      validPayload({ provider_untrusted: { ...validPayload().provider_untrusted, summaries: ['Authorization: Bearer secret-token'] } }),
      validPayload({ llm_asserted: { ...validPayload().llm_asserted, summary: 'https://example.com/log?token=abc123' } }),
      validPayload({ llm_asserted: { ...validPayload().llm_asserted, summary: oversizedLog } }),
      validPayload({ llm_asserted: { ...validPayload().llm_asserted, key_decisions: [oversizedLog] } }),
      validPayload({ llm_asserted: { ...validPayload().llm_asserted, raw_log_dump: oversizedLog } }),
      validPayload({ unexpected_root_field: true }),
      validPayload({
        script_confirmed: {
          ...validPayload().script_confirmed,
          unexpected_script_field: true,
        },
      }),
      validPayload({
        script_confirmed: {
          ...validPayload().script_confirmed,
          tool_output: oversizedLog,
        },
      }),
      validPayload({
        script_confirmed: {
          ...validPayload().script_confirmed,
          validation: {
            ...validPayload().script_confirmed.validation,
            transcript: oversizedLog,
          },
        },
      }),
      validPayload({
        script_confirmed: {
          ...validPayload().script_confirmed,
          validation: {
            ...validPayload().script_confirmed.validation,
            commands: [
              {
                ...validPayload().script_confirmed.validation.commands[0],
                messages: oversizedLog,
              },
            ],
          },
        },
      }),
      validPayload({
        script_confirmed: {
          ...validPayload().script_confirmed,
          resume_evidence: {
            ...validPayload().script_confirmed.resume_evidence,
            raw_messages: oversizedLog,
          },
        },
      }),
      validPayload({
        script_confirmed: {
          ...validPayload().script_confirmed,
          raw_log_ref: {
            ...validPayload().script_confirmed.raw_log_ref,
            unexpected_raw_log_field: true,
          },
        },
      }),
      validPayload({
        retention: {
          ...validPayload().retention,
          unexpected_retention_field: true,
        },
      }),
      validPayload({
        retention: {
          ...validPayload().retention,
          expires_at: 123,
        },
      }),
    ];

    for (const payload of badPayloads) {
      const validation = validatePayload(payload);
      expect(validation.errors.length).toBeGreaterThan(0);
    }
  });

  test('allows workflow artifact refs only in artifact-reference fields', () => {
    const payload = validPayload({
      script_confirmed: {
        ...validPayload().script_confirmed,
        artifact_refs: ['.spec-first/workflows/spec-work/spec-first/run-1/run.json'],
      },
      llm_asserted: {
        ...validPayload().llm_asserted,
        read_artifacts: ['.spec-first/workflows/spec-work/spec-first/run-1/run.json'],
      },
    });

    expect(validatePayload(payload).errors).toEqual([]);
  });

  test('requires reason codes for not-run validation and resume evidence', () => {
    const payload = validPayload({
      script_confirmed: {
        ...validPayload().script_confirmed,
        validation: {
          status: 'not-run',
          commands: [],
        },
        resume_evidence: {
          status: 'not-found',
        },
      },
    });

    const validation = validatePayload(payload);

    expect(validation.errors).toEqual(expect.arrayContaining([
      'script_confirmed.validation.reason_code is required when validation is not-run',
      'resume_evidence.reason_code is required when status is not read',
    ]));
  });

  test('reads the latest artifact when run ids are omitted and specific run ids when provided', () => {
    const repo = makeRepo();
    try {
      const firstPayloadPath = writePayload(repo, validPayload({
        retention: {
          retention_status: 'lifecycle-deferred',
          artifact_category: 'spec-work-run-evidence',
          raw_log_retention_impact: 'none',
          redaction_status: 'none-required',
          owner: 'owner-a',
          expires_at: '2026-05-15T00:00:00.000Z',
        },
      }), 'payload-a.json');
      const secondPayloadPath = writePayload(repo, validPayload({
        retention: {
          retention_status: 'lifecycle-deferred',
          artifact_category: 'spec-work-run-evidence',
          raw_log_retention_impact: 'none',
          redaction_status: 'none-required',
          owner: 'owner-b',
          expires_at: '2026-05-25T00:00:00.000Z',
        },
      }), 'payload-b.json');

      captureStdout(() => runInternal([
        'spec-work-run-artifact',
        'write',
        '--input',
        firstPayloadPath,
        '--run-id',
        'run-a',
        '--target-repo',
        repo,
      ]));
      const second = captureStdout(() => runInternal([
        'spec-work-run-artifact',
        'write',
        '--input',
        secondPayloadPath,
        '--run-id',
        'run-b',
        '--target-repo',
        repo,
      ]));
      expect(second.code).toBe(0);

      const readLatest = captureStdout(() => runInternal([
        'spec-work-run-artifact',
        'read',
        '--target-repo',
        repo,
        '--json',
      ]));
      const latestPayload = JSON.parse(readLatest.stdout);
      expect(readLatest.code).toBe(0);
      expect(latestPayload.status).toBe('read');
      expect(latestPayload.artifact.producer.reason_code).toBe('producer-write-side-only');
      expect(latestPayload.artifact.retention.owner).toBe('owner-b');

      const readSpecific = captureStdout(() => runInternal([
        'spec-work-run-artifact',
        'read',
        '--target-repo',
        repo,
        '--workspace-slug',
        path.basename(repo),
        '--run-id',
        'run-a',
        '--json',
      ]));
      const specificPayload = JSON.parse(readSpecific.stdout);
      expect(readSpecific.code).toBe(0);
      expect(specificPayload.status).toBe('read');
      expect(specificPayload.artifact.retention.owner).toBe('owner-a');
      expect(specificPayload.artifact_path).toMatch(/run-a\/run\.json$/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('read and prune reject schema-invalid artifacts instead of consuming them', () => {
    const repo = makeRepo();
    try {
      const workspaceSlug = path.basename(repo);
      const runDir = path.join(repo, '.spec-first', 'workflows', 'spec-work', workspaceSlug, 'bad-run');
      fs.mkdirSync(runDir, { recursive: true });
      fs.writeFileSync(path.join(runDir, 'run.json'), `${JSON.stringify({
        schema_version: 'spec-work-run-artifact/v1',
        workflow: 'spec-work',
        retention: {
          expires_at: '2000-01-01T00:00:00.000Z',
        },
        unexpected: true,
      })}\n`);

      const read = readSpecWorkRunArtifact({
        targetRepo: repo,
        workspaceSlug,
        runId: 'bad-run',
      });
      expect(read.exitCode).toBe(1);
      expect(read.output.status).toBe('not-readable');
      expect(read.output.reason_code).toBe('artifact-schema-invalid');
      expect(read.output.artifact).toBeNull();

      const prune = pruneSpecWorkRunArtifacts({
        targetRepo: repo,
        retentionDays: 1,
        dryRun: true,
      });
      expect(prune.exitCode).toBe(0);
      expect(prune.output.retained).toEqual(expect.arrayContaining([
        expect.objectContaining({
          artifact_path: path.join('.spec-first', 'workflows', 'spec-work', workspaceSlug, 'bad-run', 'run.json'),
          reason_code: 'artifact-schema-invalid',
        }),
      ]));
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('prunes expired artifacts and preserves active artifacts in dry-run mode', () => {
    const repo = makeRepo();
    try {
      const expiredPayload = validPayload({
        retention: {
          retention_status: 'lifecycle-deferred',
          artifact_category: 'spec-work-run-evidence',
          raw_log_retention_impact: 'none',
          redaction_status: 'none-required',
          owner: 'owner-expired',
          expires_at: '2000-01-01T00:00:00.000Z',
        },
      });
      const activePayload = validPayload({
        retention: {
          retention_status: 'lifecycle-deferred',
          artifact_category: 'spec-work-run-evidence',
          raw_log_retention_impact: 'none',
          redaction_status: 'none-required',
          owner: 'owner-active',
          expires_at: '2999-01-01T00:00:00.000Z',
        },
      });

      const expiredInput = writePayload(repo, expiredPayload, 'expired-payload.json');
      const activeInput = writePayload(repo, activePayload, 'active-payload.json');

      captureStdout(() => runInternal([
        'spec-work-run-artifact',
        'write',
        '--input',
        expiredInput,
        '--run-id',
        'expired-run',
        '--target-repo',
        repo,
      ]));
      captureStdout(() => runInternal([
        'spec-work-run-artifact',
        'write',
        '--input',
        activeInput,
        '--run-id',
        'active-run',
        '--target-repo',
        repo,
      ]));

      const dryRun = captureStdout(() => runInternal([
        'spec-work-run-artifact',
        'prune',
        '--target-repo',
        repo,
        '--retention-days',
        '1',
        '--dry-run',
        '--json',
      ]));
      const dryRunPayload = JSON.parse(dryRun.stdout);
      expect(dryRun.code).toBe(0);
      expect(dryRunPayload.status).toBe('pruned');
      expect(dryRunPayload.removed.map((entry) => entry.reason_code)).toContain('expired');
      expect(dryRunPayload.retained.map((entry) => entry.reason_code)).toContain('retention-active');

      const prune = captureStdout(() => runInternal([
        'spec-work-run-artifact',
        'prune',
        '--target-repo',
        repo,
        '--retention-days',
        '1',
        '--json',
      ]));
      const prunePayload = JSON.parse(prune.stdout);
      expect(prune.code).toBe(0);
      expect(prunePayload.status).toBe('pruned');
      expect(prunePayload.removed.length).toBeGreaterThanOrEqual(1);
      expect(fs.existsSync(path.join(repo, '.spec-first', 'workflows', 'spec-work', path.basename(repo), 'expired-run', 'run.json'))).toBe(false);
      expect(fs.existsSync(path.join(repo, '.spec-first', 'workflows', 'spec-work', path.basename(repo), 'active-run', 'run.json'))).toBe(true);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('read rejects unsafe explicit workspace/run identifiers', () => {
    const repo = makeRepo();
    try {
      const result = captureStdout(() => runInternal([
        'spec-work-run-artifact',
        'read',
        '--target-repo',
        repo,
        '--workspace-slug',
        '..',
        '--run-id',
        'run-a',
        '--json',
      ]));
      const payload = JSON.parse(result.stdout);

      expect(result.code).toBe(2);
      expect(payload.status).toBe('rejected');
      expect(payload.reason_code).toBe('invalid-arguments');
      expect(payload.errors).toContain('--workspace-slug must be a stable safe identifier');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('read and prune fail closed when workflow artifact root is a symlink escape', () => {
    const repo = makeRepo();
    const outside = makeRepo();
    try {
      fs.rmSync(path.join(repo, '.spec-first'), { recursive: true, force: true });
      fs.symlinkSync(outside, path.join(repo, '.spec-first'));

      const read = captureStdout(() => runInternal([
        'spec-work-run-artifact',
        'read',
        '--target-repo',
        repo,
        '--json',
      ]));
      const readPayload = JSON.parse(read.stdout);
      expect(read.code).toBe(1);
      expect(readPayload.status).toBe('rejected');
      expect(readPayload.reason_code).toBe('artifact-path-escape');

      const prune = captureStdout(() => runInternal([
        'spec-work-run-artifact',
        'prune',
        '--target-repo',
        repo,
        '--json',
      ]));
      const prunePayload = JSON.parse(prune.stdout);
      expect(prune.code).toBe(1);
      expect(prunePayload.status).toBe('rejected');
      expect(prunePayload.reason_code).toBe('artifact-path-escape');
      expect(fs.existsSync(path.join(outside, 'workflows'))).toBe(false);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  test('read and prune do not follow run artifact leaf symlinks outside the target repo', () => {
    const repo = makeRepo();
    const outside = makeRepo();
    try {
      const runDir = path.join(repo, '.spec-first', 'workflows', 'spec-work', 'workspace-a', 'run-a');
      fs.mkdirSync(runDir, { recursive: true });
      fs.writeFileSync(path.join(outside, 'run.json'), JSON.stringify(validPayload()), 'utf8');
      fs.symlinkSync(path.join(outside, 'run.json'), path.join(runDir, 'run.json'));

      const read = captureStdout(() => runInternal([
        'spec-work-run-artifact',
        'read',
        '--target-repo',
        repo,
        '--workspace-slug',
        'workspace-a',
        '--run-id',
        'run-a',
        '--json',
      ]));
      const readPayload = JSON.parse(read.stdout);
      expect(read.code).toBe(1);
      expect(readPayload.status).toBe('rejected');
      expect(readPayload.reason_code).toBe('artifact-path-escape');

      const prune = captureStdout(() => runInternal([
        'spec-work-run-artifact',
        'prune',
        '--target-repo',
        repo,
        '--json',
      ]));
      const prunePayload = JSON.parse(prune.stdout);
      expect(prune.code).toBe(0);
      expect(prunePayload.status).toBe('pruned');
      expect(prunePayload.retained).toEqual(expect.arrayContaining([
        expect.objectContaining({
          artifact_path: path.join('.spec-first', 'workflows', 'spec-work', 'workspace-a', 'run-a', 'run.json'),
          reason_code: 'artifact-path-escape',
        }),
      ]));
      expect(fs.existsSync(path.join(outside, 'run.json'))).toBe(true);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  test('read and prune fail closed when workflow artifact root is not a directory', () => {
    const repo = makeRepo();
    try {
      fs.mkdirSync(path.join(repo, '.spec-first', 'workflows'), { recursive: true });
      fs.writeFileSync(path.join(repo, '.spec-first', 'workflows', 'spec-work'), 'not a directory', 'utf8');

      const read = readSpecWorkRunArtifact({ targetRepo: repo });
      expect(read.exitCode).toBe(1);
      expect(read.output.status).toBe('rejected');
      expect(read.output.reason_code).toBe('artifact-root-not-directory');

      const prune = pruneSpecWorkRunArtifacts({
        targetRepo: repo,
        retentionDays: 1,
        dryRun: true,
      });
      expect(prune.exitCode).toBe(1);
      expect(prune.output.status).toBe('rejected');
      expect(prune.output.reason_code).toBe('artifact-root-not-directory');
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('fails closed when the artifact output ancestor is a symlink escape', () => {
    const repo = makeRepo();
    const outside = makeRepo();
    try {
      fs.rmSync(path.join(repo, '.spec-first'), { recursive: true, force: true });
      fs.symlinkSync(outside, path.join(repo, '.spec-first'));
      const inputPath = writePayload(repo, validPayload());

      const result = writeSpecWorkRunArtifact({
        inputPath,
        runId: 'run-1',
        targetRepo: repo,
      });

      expect(result.exitCode).toBe(1);
      expect(result.output.status).toBe('rejected');
      expect(result.output.reason_code).toBe('artifact-path-escape');
      expect(fs.existsSync(path.join(outside, 'workflows'))).toBe(false);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  test('prune CLI surfaces a precise reason code for non-numeric --retention-days', () => {
    const repo = makeRepo();
    try {
      for (const value of ['abc', '1abc']) {
        const result = captureStdout(() => runInternal([
          'spec-work-run-artifact',
          'prune',
          '--target-repo',
          repo,
          '--retention-days',
          value,
          '--json',
        ]));
        const payload = JSON.parse(result.stdout);

        expect(result.code).toBe(2);
        expect(payload.status).toBe('rejected');
        expect(payload.reason_code).toBe('invalid-arguments');
        expect(payload.errors.some((entry) => entry.includes(`'${value}'`))).toBe(true);
      }
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
