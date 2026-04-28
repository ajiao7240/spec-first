'use strict';

const path = require('node:path');
const {
  computeSourcePlanHash,
  validateTaskPack,
} = require('../task-pack');

function runTasks(argv) {
  const args = Array.isArray(argv) ? [...argv] : [];
  const subcommand = args[0];

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    printTasksHelp();
    return 0;
  }

  if (subcommand === 'hash') {
    return runHash(args.slice(1));
  }

  if (subcommand === 'validate') {
    return runValidate(args.slice(1));
  }

  if (args.includes('--json')) {
    writeJsonError('tasks-subcommand-unknown', `Unknown tasks subcommand: ${subcommand}`);
    return 1;
  }
  console.error(`Unknown tasks subcommand: ${subcommand}`);
  printTasksHelp(true);
  return 1;
}

function runHash(args) {
  const planPath = getPositionalArgs(args)[0];
  const json = args.includes('--json');
  const unknown = getUnknownArgs(args, new Set(['--json']));

  if (unknown.length > 0) {
    return writeCliError({
      json,
      code: 'tasks-unknown-option',
      message: `unknown option: ${unknown[0]}`,
    });
  }

  if (!planPath) {
    if (json) {
      writeJsonError('tasks-plan-path-required', 'plan path is required');
      return 1;
    }
    console.error('error: plan path is required');
    return 1;
  }

  const result = computeSourcePlanHash(path.resolve(planPath));
  if (!result.ok) {
    if (json) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        error: result.error,
      }, null, 2)}\n`);
    } else {
      console.error(`error: ${result.error.message}`);
    }
    return 1;
  }

  const payload = {
    schema_version: 'task-plan-hash/v1',
    plan_path: path.resolve(planPath),
    hash: result.hash,
    canonicalization_version: result.canonicalization_version,
    removed_frontmatter: result.removed_frontmatter,
    canonical_body_bytes: result.canonical_body_bytes,
  };

  if (json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`${payload.hash}\n`);
  }

  return 0;
}

function runValidate(args) {
  const taskPackPath = getPositionalArgs(args)[0];
  const json = args.includes('--json');
  const repoArg = resolveRepoArg(args);
  const unknown = getUnknownArgs(args, new Set(['--json', '--repo']));

  if (unknown.length > 0) {
    return writeCliError({
      json,
      code: 'tasks-unknown-option',
      message: `unknown option: ${unknown[0]}`,
    });
  }

  if (repoArg.error) {
    return writeCliError({
      json,
      code: repoArg.error.code,
      message: repoArg.error.message,
    });
  }

  if (!taskPackPath) {
    if (json) {
      writeJsonError('tasks-task-pack-path-required', 'task pack path is required');
      return 1;
    }
    console.error('error: task pack path is required');
    return 1;
  }

  const result = validateTaskPack(path.resolve(taskPackPath), { repoRoot: repoArg.repoRoot });

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (result.deterministic_handoff) {
    process.stdout.write('task pack valid\n');
  } else {
    console.error(`task pack invalid: ${result.task_pack_validity}`);
    for (const error of result.errors) {
      console.error(`- ${error.code}: ${error.message}`);
    }
  }

  return result.deterministic_handoff ? 0 : 1;
}

function getPositionalArgs(args) {
  const positionals = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--repo') {
      index += 1;
      continue;
    }
    if (arg.startsWith('-')) continue;
    positionals.push(arg);
  }
  return positionals;
}

function getUnknownArgs(args, allowedFlags) {
  const unknown = [];
  for (const arg of args) {
    if (!arg.startsWith('-')) continue;
    if (allowedFlags.has(arg)) continue;
    const [flag] = arg.split('=');
    if (allowedFlags.has(flag)) continue;
    unknown.push(arg);
  }
  return unknown;
}

function resolveRepoArg(args) {
  const equalsArg = args.find((arg) => arg.startsWith('--repo='));
  if (equalsArg) {
    const value = equalsArg.slice('--repo='.length);
    return value
      ? { repoRoot: path.resolve(value), error: null }
      : { repoRoot: null, error: { code: 'tasks-repo-path-required', message: 'repo path is required after --repo' } };
  }

  const repoFlagIndex = args.indexOf('--repo');
  if (repoFlagIndex !== -1) {
    const value = args[repoFlagIndex + 1];
    return value && !value.startsWith('-')
      ? { repoRoot: path.resolve(value), error: null }
      : { repoRoot: null, error: { code: 'tasks-repo-path-required', message: 'repo path is required after --repo' } };
  }

  return { repoRoot: process.cwd(), error: null };
}

function printTasksHelp(withErrorPrefix = false) {
  const lines = [
    'Usage: spec-first tasks <subcommand> [options]',
    '',
    'Subcommands:',
    '  hash <plan-path> [--json]                 Compute canonical source plan hash',
    '  validate <task-pack-path> [--json] [--repo=<path>|--repo <path>]  Validate a derived task pack',
    '',
    'Notes:',
    '  validate only checks identity, freshness, and structure.',
    '  It does not judge task splitting quality or business scope.',
  ];

  if (withErrorPrefix) {
    console.error(lines.join('\n'));
    return;
  }

  process.stdout.write(`${lines.join('\n')}\n`);
}

function writeJsonError(code, message) {
  process.stdout.write(`${JSON.stringify({
    ok: false,
    error: {
      code,
      message,
    },
  }, null, 2)}\n`);
}

function writeCliError({ json, code, message }) {
  if (json) {
    writeJsonError(code, message);
  } else {
    console.error(`error: ${message}`);
  }
  return 1;
}

module.exports = {
  runTasks,
};
