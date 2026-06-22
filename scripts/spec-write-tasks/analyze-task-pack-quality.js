#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { validateTaskPack } = require('../../src/cli/task-pack');

const DEFAULT_OUTPUT_DIR = 'docs/validation/spec-write-tasks';

function parseArgs(argv) {
  const args = {
    repoRoot: process.cwd(),
    outputDir: DEFAULT_OUTPUT_DIR,
    taskPackPath: null,
    rawArgs: argv.slice(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repo') {
      args.repoRoot = argv[++index];
    } else if (arg === '--output-dir') {
      args.outputDir = argv[++index];
    } else if (arg === '--help') {
      args.help = true;
    } else if (!args.taskPackPath) {
      args.taskPackPath = arg;
    } else {
      throw new Error(`unexpected argument: ${arg}`);
    }
  }

  if (!args.help && !args.taskPackPath) {
    throw new Error('task pack path is required');
  }

  args.repoRoot = path.resolve(args.repoRoot);
  args.outputDir = path.resolve(args.repoRoot, args.outputDir);
  args.taskPackPath = args.taskPackPath ? path.resolve(args.repoRoot, args.taskPackPath) : null;
  return args;
}

function usage() {
  return [
    'Usage: node scripts/spec-write-tasks/analyze-task-pack-quality.js <task-pack.md> [--repo .] [--output-dir PATH]',
    '',
    'Writes advisory task-pack quality facts without changing validator truth.',
  ].join('\n');
}

function repoRelative(repoRoot, filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function isInsidePath(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function stableArg(repoRoot, arg) {
  if (typeof arg !== 'string' || arg === '') return arg;
  if (path.isAbsolute(arg)) {
    const resolved = path.resolve(arg);
    if (isInsidePath(repoRoot, resolved)) return repoRelative(repoRoot, resolved);
    return '<external-path>';
  }
  return arg.split(path.sep).join('/');
}

function commandString(repoRoot, rawArgs = []) {
  return [
    'node',
    'scripts/spec-write-tasks/analyze-task-pack-quality.js',
    ...rawArgs.map((arg) => stableArg(repoRoot, arg)),
  ].join(' ');
}

function gitRevision(repoRoot) {
  const proc = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return proc.status === 0 ? proc.stdout.trim() : 'unknown';
}

function addFinding(findings, severity, reasonCode, task, message, prompt) {
  findings.push({
    severity,
    reason_code: reasonCode,
    task_id: task && task.task_id ? task.task_id : null,
    evidence_ref: task && task.task_id ? `Task Pack Contract tasks.${task.task_id}` : 'Task Pack Contract',
    message,
    llm_review_prompt: prompt,
  });
}

function isSubjectiveDoneSignal(value) {
  return /^(works|works normally|done|complete|feature works|logic is complete|looks good|code is done)$/i.test(String(value || '').trim());
}

function isVagueStopSignal(value) {
  return /(if unsure|if there is a problem|if a problem|if scope changes|ask the user when needed)$/i.test(String(value || '').trim());
}

function isGeneratedRuntimePath(filePath) {
  return filePath.startsWith('.claude/') || filePath.startsWith('.codex/') || filePath.startsWith('.agents/skills/');
}

function analyzeTaskPackQuality(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const taskPackPath = path.resolve(repoRoot, options.taskPackPath);
  const outputDir = path.resolve(repoRoot, options.outputDir || DEFAULT_OUTPUT_DIR);
  const validation = validateTaskPack(taskPackPath, { repoRoot });
  const findings = [];
  const tasks = (validation.task_pack.contract && validation.task_pack.contract.tasks) || [];
  const sourcePlan = validation.source_plan.path;
  const inputFailure = (validation.errors || []).find((error) => [
    'task-pack-missing',
    'task-pack-unreadable',
    'task-pack-frontmatter-invalid',
  ].includes(error.code));
  const input_readiness = inputFailure
    ? {
      status: 'failed',
      reason_code: inputFailure.code,
      message: inputFailure.message,
    }
    : {
      status: 'readable',
      reason_code: 'task-pack-readable',
    };

  if (!validation.deterministic_handoff) {
    addFinding(
      findings,
      'review_required',
      inputFailure ? inputFailure.code : 'validator-not-valid',
      null,
      inputFailure ? inputFailure.message : 'Deterministic task-pack validation did not pass.',
      'Do not treat this analyzer output as executable handoff; inspect spec-first tasks validate output first.',
    );
  }

  for (const task of tasks) {
    const contextRefs = Array.isArray(task.context_refs) ? task.context_refs : [];
    if (contextRefs.length > 0 && sourcePlan && contextRefs.every((entry) => entry === sourcePlan)) {
      addFinding(
        findings,
        'warning',
        'whole-plan-only-context-refs',
        task,
        '`context_refs` only points to the whole source plan.',
        'Add section, file, test, or contract refs that reduce executor context without replacing source anchors.',
      );
    }

    if (!task.source_unit && (!Array.isArray(task.requirement_refs) || task.requirement_refs.length === 0)) {
      addFinding(
        findings,
        'review_required',
        'missing-source-anchor',
        task,
        'Task has no `source_unit` or `requirement_refs` source anchor.',
        'Return to source-plan anchors before treating this as an executable semantic task.',
      );
    }

    if (isSubjectiveDoneSignal(task.done_signal)) {
      addFinding(
        findings,
        'warning',
        'subjective-done-signal',
        task,
        '`done_signal` is subjective rather than observable.',
        'Rewrite the done signal as a test, CLI output, diff shape, document structure, or reviewable artifact.',
      );
    }

    if (isVagueStopSignal(task.stop_if)) {
      addFinding(
        findings,
        'warning',
        'vague-stop-if',
        task,
        '`stop_if` is too vague to protect scope.',
        'Name a concrete out-of-scope file, contract, API, missing evidence, or source-plan conflict.',
      );
    }

    for (const filePath of task.files || []) {
      if (isGeneratedRuntimePath(filePath)) {
        addFinding(
          findings,
          'review_required',
          'generated-runtime-file-ownership',
          task,
          `Task owns generated runtime mirror path ${filePath}.`,
          'Move ownership to source-of-truth files or return to the plan for an explicit runtime repair task.',
        );
      }
    }
  }

  if (tasks.length > 1 && tasks.every((task) => task.review_gate === 'required')) {
    addFinding(
      findings,
      'warning',
      'all-tasks-review-gate-required',
      null,
      'Every task has `review_gate: required`.',
      'Confirm each required gate has a concrete risk; otherwise reserve required review for dependency-unblocking or high-risk tasks.',
    );
  }

  const report = {
    schema_version: 'spec-first.spec-write-tasks-quality-analysis.v1',
    generated_at: new Date().toISOString(),
    command: options.command || commandString(repoRoot, options.rawArgs || []),
    rerun_command: `node scripts/spec-write-tasks/analyze-task-pack-quality.js ${repoRelative(repoRoot, taskPackPath)}`,
    source_revision: gitRevision(repoRoot),
    rollback_boundary: '重新生成 docs/validation/spec-write-tasks/task_pack_quality_analysis.{json,md}；不要 patch generated runtime mirrors。',
    score_is_signal_not_gate: true,
    advisory_only: true,
    input_readiness,
    validator_boundary: {
      deterministic_handoff: validation.deterministic_handoff,
      task_pack_validity: validation.task_pack_validity,
      validity_scope: validation.validity_scope,
      cannot_override_validator: true,
    },
    task_pack: repoRelative(repoRoot, taskPackPath),
    findings,
    disabled_checks: [
      {
        reason_code: 'large-plan-threshold-deferred',
        reason: 'large-plan 与 wide-source-unit findings 进入 analyzer behavior 前，需要先有 follow-up fixture 或 recorded output。',
      },
    ],
  };

  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'task_pack_quality_analysis.json');
  const mdPath = path.join(outputDir, 'task_pack_quality_analysis.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, renderMarkdown(report), 'utf8');

  return {
    ok: input_readiness.status === 'readable',
    report,
    jsonPath,
    mdPath,
  };
}

function renderMarkdown(report) {
  const lines = [
    '# spec-write-tasks 任务包质量分析',
    '',
    `- generated_at: ${report.generated_at}`,
    `- command: \`${report.command}\``,
    `- rerun_command: \`${report.rerun_command}\``,
    `- source_revision: \`${report.source_revision}\``,
    `- rollback_boundary: ${report.rollback_boundary}`,
    `- advisory_only: ${report.advisory_only}`,
    `- input_readiness: ${report.input_readiness.status} (${report.input_readiness.reason_code})`,
    `- deterministic_handoff: ${report.validator_boundary.deterministic_handoff}`,
    `- task_pack_validity: ${report.validator_boundary.task_pack_validity}`,
    '',
    '## 发现',
    '',
  ];

  if (report.findings.length === 0) {
    lines.push('- 无');
  } else {
    for (const finding of report.findings) {
      lines.push(`- ${finding.severity} ${finding.reason_code}${finding.task_id ? ` (${finding.task_id})` : ''}: ${finding.message}`);
    }
  }

  lines.push('', '## 已禁用检查', '');
  for (const check of report.disabled_checks) {
    lines.push(`- ${check.reason_code}: ${check.reason}`);
  }

  return `${lines.join('\n')}\n`;
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(usage());
      process.exit(0);
    }
    const result = analyzeTaskPackQuality(args);
    console.log(JSON.stringify({
      ok: result.ok,
      reason_code: result.report.input_readiness.reason_code,
      json: repoRelative(args.repoRoot, result.jsonPath),
      markdown: repoRelative(args.repoRoot, result.mdPath),
      finding_count: result.report.findings.length,
      review_required_count: result.report.findings.filter((entry) => entry.severity === 'review_required').length,
    }, null, 2));
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  analyzeTaskPackQuality,
};
