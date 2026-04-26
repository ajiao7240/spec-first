'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { makeEnvelope } = require('../cli/envelope');
const { discoverWorkspace } = require('../workspace/discovery');
const { buildWorkspaceContext } = require('../workspace/context');
const { buildWorkspaceStatus } = require('../workspace/status');

function printHelp() {
  process.stdout.write([
    'Usage: spec-first crg workspace <action> [options]',
    '',
    'Actions:',
    '  scan',
    '  status',
    '  context',
    '  build',
    '',
    'Options:',
    '  --root=<path>        Parent workspace root (default: cwd)',
    '  --repo=<slug|path>   Child repo slug or path for build',
    '  --task=<text>        Task text for context scoring',
    '  --changed-file=<p>   Changed file signal for context scoring (repeatable)',
    '  --force             Pass --force to child crg build',
    '',
  ].join('\n'));
}

function parseWorkspaceArgs(argv) {
  const result = {
    action: argv[0] || null,
    root: process.cwd(),
    repo: null,
    task: null,
    changedFiles: [],
    force: false,
  };

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--root=')) result.root = arg.slice('--root='.length);
    else if (arg === '--root' && i + 1 < argv.length) result.root = argv[++i];
    else if (arg.startsWith('--repo=')) result.repo = arg.slice('--repo='.length);
    else if (arg === '--repo' && i + 1 < argv.length) result.repo = argv[++i];
    else if (arg.startsWith('--task=')) result.task = arg.slice('--task='.length);
    else if (arg === '--task' && i + 1 < argv.length) result.task = argv[++i];
    else if (arg.startsWith('--changed-file=')) result.changedFiles.push(arg.slice('--changed-file='.length));
    else if (arg === '--changed-file' && i + 1 < argv.length) result.changedFiles.push(argv[++i]);
    else if (arg.startsWith('--changed-files=')) {
      result.changedFiles.push(...arg.slice('--changed-files='.length).split(',').filter(Boolean));
    } else if (arg === '--force') {
      result.force = true;
    }
  }

  result.root = path.resolve(result.root);
  return result;
}

function assertDirectory(root) {
  try {
    const stat = fs.statSync(root);
    if (!stat.isDirectory()) {
      const error = new Error(`--root path is not a directory: ${root}`);
      error.isUserError = true;
      throw error;
    }
  } catch (error) {
    if (error.isUserError) throw error;
    const userError = new Error(`--root path does not exist: ${root}`);
    userError.isUserError = true;
    throw userError;
  }
}

function toPosixPath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function resolveChild(status, repoArg) {
  if (!repoArg) {
    const error = new Error('workspace build requires --repo=<child-slug-or-path>; --all is not supported in Phase 1');
    error.isUserError = true;
    throw error;
  }

  if (repoArg === '--all' || repoArg === 'all') {
    const error = new Error('workspace build --all is not supported in Phase 1; build one explicit child repo');
    error.isUserError = true;
    throw error;
  }

  const root = status.workspace_root;
  const pathCandidate = path.resolve(root, repoArg);
  const normalizedArg = toPosixPath(repoArg);
  const matches = status.children.filter((child) => (
    child.slug === repoArg ||
    path.resolve(child.repo_root) === pathCandidate ||
    path.resolve(child.repo_root) === path.resolve(repoArg) ||
    child.relative_path === normalizedArg ||
    path.basename(child.repo_root) === repoArg
  ));

  if (matches.length === 0) {
    const error = new Error(`no discovered child repo matches --repo=${repoArg}`);
    error.isUserError = true;
    throw error;
  }
  if (matches.length > 1) {
    const error = new Error(`ambiguous child repo selector --repo=${repoArg}; use a slug or absolute path`);
    error.isUserError = true;
    throw error;
  }
  return matches[0];
}

function runChildBuild(child, options) {
  const binPath = path.join(__dirname, '..', '..', '..', 'bin', 'spec-first.js');
  const args = [binPath, 'crg', 'build', `--repo=${child.repo_root}`];
  if (options.force) args.push('--force');

  const result = spawnSync(process.execPath, args, {
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const error = new Error(`child crg build failed with exit ${result.status}`);
    error.isChildBuildError = true;
    error.exitCode = result.status || 2;
    error.stderr = result.stderr || '';
    throw error;
  }

  let parsed = null;
  const stdout = String(result.stdout || '').trim();
  if (stdout) {
    try {
      parsed = JSON.parse(stdout);
    } catch (_) {
      parsed = null;
    }
  }

  return {
    exit_code: result.status,
    envelope: parsed,
  };
}

function run(argv) {
  const options = parseWorkspaceArgs(Array.isArray(argv) ? argv : []);
  if (!options.action || options.action === '--help' || options.action === '-h') {
    printHelp();
    return;
  }

  try {
    assertDirectory(options.root);
    let data;
    let envelopeOptions = {};
    if (options.action === 'scan') {
      const index = discoverWorkspace(options.root, { write: true });
      data = { action: 'scan', ...index };
    } else if (options.action === 'status') {
      data = { action: 'status', ...buildWorkspaceStatus(options.root, { write: true }) };
    } else if (options.action === 'context') {
      data = {
        action: 'context',
        ...buildWorkspaceContext(options.root, {
          task: options.task,
          changedFiles: options.changedFiles,
          write: true,
        }),
      };
    } else if (options.action === 'build') {
      const status = buildWorkspaceStatus(options.root, { write: true });
      const child = resolveChild(status, options.repo);
      const childBuild = runChildBuild(child, options);
      envelopeOptions = childBuild.envelope
        ? {
            degraded: Boolean(childBuild.envelope.degraded),
            warnings: Array.isArray(childBuild.envelope.warnings)
              ? childBuild.envelope.warnings.map((warning) => ({
                  type: 'child_build_warning',
                  child_slug: child.slug,
                  warning,
                }))
              : [],
          }
        : {};
      data = {
        action: 'build',
        workspace_root: options.root,
        built_child: {
          slug: child.slug,
          repo_root: child.repo_root,
          relationship: child.relationship,
          readiness_before_build: child.readiness,
        },
        child_build_exit_code: childBuild.exit_code,
        child_build: childBuild.envelope,
      };
    } else {
      const error = new Error(`unknown workspace action '${options.action}'`);
      error.isUserError = true;
      throw error;
    }

    process.stdout.write(JSON.stringify(makeEnvelope(options.root, data, envelopeOptions)) + '\n');
  } catch (error) {
    if (error.isChildBuildError) {
      if (error.stderr) process.stderr.write(error.stderr);
      process.stderr.write(`error: ${error.message}\n`);
      process.exit(error.exitCode);
    }
    if (error.isUserError) {
      process.stderr.write(`error: ${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}

module.exports = {
  parseWorkspaceArgs,
  resolveChild,
  run,
};
