#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function uniqueExistingPaths(paths) {
  return [...new Set(paths.filter(Boolean))];
}

function selectPathApi(filePath) {
  return /^[a-zA-Z]:[\\/]/.test(String(filePath)) || String(filePath).includes('\\')
    ? path.win32
    : path;
}

function getEnvValue(env, name) {
  if (!env || typeof env !== 'object') return '';
  if (Object.prototype.hasOwnProperty.call(env, name)) return env[name] || '';
  const lowerName = name.toLowerCase();
  const matchedKey = Object.keys(env).find((key) => key.toLowerCase() === lowerName);
  return matchedKey ? env[matchedKey] || '' : '';
}

function resolveNpmCliPath(options = {}) {
  const env = options.env || process.env;
  const execPath = options.execPath || process.execPath;
  const existsSync = options.existsSync || fs.existsSync;
  const pathApi = selectPathApi(execPath);
  const nodeDir = pathApi.dirname(execPath);
  const candidates = uniqueExistingPaths([
    getEnvValue(env, 'npm_execpath'),
    pathApi.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    pathApi.join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    pathApi.join(nodeDir, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ]);

  return candidates.find((candidate) => existsSync(candidate)) || '';
}

function runChild(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: options.encoding || 'utf8',
    env: options.env || process.env,
    shell: false,
    stdio: options.stdio || 'pipe',
    windowsHide: true,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    const error = new Error(`${command} ${args.join(' ')} failed with status ${result.status}`);
    error.status = result.status || 1;
    throw error;
  }
  return result.stdout || '';
}

function runNpm(args, options = {}) {
  const npmCliPath = resolveNpmCliPath(options);
  if (!npmCliPath) {
    throw new Error('Unable to locate npm CLI JavaScript entrypoint for non-shell execution.');
  }
  return runChild(process.execPath, [npmCliPath, ...args], options);
}

function runGit(args, options = {}) {
  return runChild('git', args, {
    ...options,
    stdio: options.stdio || 'inherit',
  });
}

function quoteCmdArg(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function buildCmdCommandLine(command, args) {
  return [command, ...args].map(quoteCmdArg).join(' ');
}

function runWindowsCmdShim(shim, args, options = {}) {
  const comspec = getEnvValue(options.env || process.env, 'ComSpec') || 'cmd.exe';
  return runChild(comspec, ['/d', '/s', '/c', buildCmdCommandLine(shim, args)], {
    ...options,
    stdio: options.stdio || 'inherit',
  });
}

function runInstalledShim(shim, args, options = {}) {
  if (process.platform === 'win32') {
    return runWindowsCmdShim(shim, args, options);
  }
  return runChild(shim, args, {
    ...options,
    stdio: options.stdio || 'inherit',
  });
}

function runInstalledBin(packageRoot, args, options = {}) {
  const binPath = path.join(packageRoot, 'bin', 'spec-first.js');
  return runChild(process.execPath, [binPath, ...args], {
    ...options,
    stdio: options.stdio || 'inherit',
  });
}

function createArtifactWriter() {
  const configuredDir = process.env.SPEC_FIRST_SMOKE_ARTIFACT_DIR;
  if (!configuredDir) {
    return {
      dir: '',
      write() {},
    };
  }

  const dir = path.resolve(configuredDir);
  fs.mkdirSync(dir, { recursive: true });

  return {
    dir,
    write(name, content) {
      const filePath = path.join(dir, normalizeArtifactFileName(name));
      const body = typeof content === 'string'
        ? content
        : `${JSON.stringify(content, null, 2)}\n`;
      fs.writeFileSync(filePath, body, 'utf8');
    },
  };
}

function normalizeArtifactFileName(name) {
  const value = String(name || '');
  if (
    !value ||
    value === '.' ||
    value === '..' ||
    value !== path.basename(value) ||
    value !== path.win32.basename(value) ||
    /[<>:"|?*\0]/.test(value)
  ) {
    throw new Error(`Unsafe smoke artifact file name: ${value || '<empty>'}`);
  }
  return value;
}

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec first install-'));
  const artifacts = createArtifactWriter();
  const startedAt = new Date().toISOString();
  const summaryBase = {
    schema_version: 'npm-install-matrix-smoke.v1',
    started_at: startedAt,
    platform: process.platform,
    node: process.version,
    cwd: process.cwd(),
    temp_dir: tmp,
    artifact_dir: artifacts.dir || null,
  };
  console.log(`npm install matrix smoke temp: ${tmp}`);
  artifacts.write('summary.json', {
    ...summaryBase,
    status: 'started',
  });

  try {
    const tarballDir = path.join(tmp, 'tarball');
    const prefix = path.join(tmp, 'prefix with spaces');
    const cache = path.join(tmp, 'cache with spaces');
    fs.mkdirSync(tarballDir);
    fs.mkdirSync(prefix);
    fs.mkdirSync(cache);

    const packOutput = runNpm([
      'pack',
      '--pack-destination',
      tarballDir,
      '--silent',
    ]);
    artifacts.write('pack-output.log', packOutput);

    const tarballName = packOutput.trim().split(/\r?\n/).pop();
    const tarballPath = path.join(tarballDir, tarballName);

    runNpm([
      'install',
      '-g',
      tarballPath,
      '--prefix',
      prefix,
      '--cache',
      cache,
      '--loglevel=error',
    ], { stdio: 'inherit' });

    const shim = process.platform === 'win32'
      ? path.join(prefix, 'spec-first.cmd')
      : path.join(prefix, 'bin', 'spec-first');
    const packageRoot = process.platform === 'win32'
      ? path.join(prefix, 'node_modules', 'spec-first')
      : path.join(prefix, 'lib', 'node_modules', 'spec-first');

    for (const requiredPath of [shim, packageRoot, path.join(packageRoot, 'bin', 'spec-first.js')]) {
      if (!fs.existsSync(requiredPath)) {
        throw new Error(`Expected installed path missing: ${requiredPath}`);
      }
    }

    runInstalledBin(packageRoot, ['--help']);
    runInstalledBin(packageRoot, ['-v']);
    runInstalledShim(shim, ['--help']);
    runInstalledShim(shim, ['-v']);

    const fixtureProject = path.join(tmp, 'workspace [win64] 中文 (paren)');
    fs.mkdirSync(fixtureProject);
    runInstalledBin(packageRoot, ['doctor'], { cwd: fixtureProject });
    runInstalledBin(packageRoot, ['init', '--claude', '-u', 'matrix', '--lang', 'en'], { cwd: fixtureProject });
    runInstalledBin(packageRoot, ['init', '--codex', '-u', 'matrix', '--lang', 'en'], { cwd: fixtureProject });
    runInstalledShim(shim, ['doctor', '--json'], { cwd: fixtureProject });

    for (const requiredPath of [
      path.join(fixtureProject, 'CLAUDE.md'),
      path.join(fixtureProject, 'AGENTS.md'),
      path.join(fixtureProject, '.claude', 'spec-first', 'state.json'),
      path.join(fixtureProject, '.codex', 'spec-first', 'state.json'),
    ]) {
      if (!fs.existsSync(requiredPath)) {
        throw new Error(`Expected initialized fixture path missing: ${requiredPath}`);
      }
    }

    const gitProject = path.join(tmp, 'minimal git repo [win64] 中文');
    fs.mkdirSync(gitProject);
    runGit(['init'], { cwd: gitProject });
    runInstalledBin(packageRoot, ['doctor'], { cwd: gitProject });
    runInstalledShim(shim, ['doctor', '--json'], { cwd: gitProject });

    artifacts.write('summary.json', {
      ...summaryBase,
      status: 'passed',
      finished_at: new Date().toISOString(),
      tarball_path: tarballPath,
      prefix,
      package_root: packageRoot,
      shim,
      fixture_project: fixtureProject,
      minimal_git_project: gitProject,
    });

    fs.rmSync(tmp, { recursive: true, force: true });
    return 0;
  } catch (error) {
    artifacts.write('summary.json', {
      ...summaryBase,
      status: 'failed',
      finished_at: new Date().toISOString(),
      error: error && error.stack ? error.stack : String(error),
    });
    console.error(error && error.stack ? error.stack : String(error));
    console.error(`npm install matrix smoke temp preserved for debugging: ${tmp}`);
    return error && Number.isInteger(error.status) ? error.status : 1;
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  buildCmdCommandLine,
  createArtifactWriter,
  getEnvValue,
  normalizeArtifactFileName,
  quoteCmdArg,
  resolveNpmCliPath,
  runChild,
  runGit,
  runInstalledBin,
  runInstalledShim,
  runNpm,
  runWindowsCmdShim,
};
