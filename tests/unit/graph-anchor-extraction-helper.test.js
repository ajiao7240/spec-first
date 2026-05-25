'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const REPO_ROOT = path.join(__dirname, '..', '..');
const HELPER = path.join(REPO_ROOT, 'tests', 'benchmark', 'extract-graph-anchors.sh');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-anchors-test-'));
}

function makeGitRepo(repo) {
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  execFileSync('git', ['init', '-q', repo]);
  execFileSync('git', ['-C', repo, 'config', 'user.name', 'Spec First Test']);
  execFileSync('git', ['-C', repo, 'config', 'user.email', 'spec-first@example.invalid']);
  execFileSync('git', ['-C', repo, 'config', 'core.hooksPath', '/dev/null']);
  fs.writeFileSync(path.join(repo, 'src', 'alpha.js'), 'export function alpha() { return 1; }\n');
  execFileSync('git', ['-C', repo, 'add', '.']);
  execFileSync('git', ['-C', repo, 'commit', '-q', '-m', 'fixture']);
}

function writeFakeNpx(binDir) {
  const npxPath = path.join(binDir, 'npx');
  fs.writeFileSync(npxPath, `#!/bin/bash
set -euo pipefail
if [ -n "\${EXPECTED_GITNEXUS_REPO:-}" ]; then
  repo_arg=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --repo)
        repo_arg="\${2:-}"
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done
  if [ "$repo_arg" != "$EXPECTED_GITNEXUS_REPO" ]; then
    echo "unexpected repo selector: $repo_arg" >&2
    exit 17
  fi
fi
query=""
for arg in "$@"; do
  case "$arg" in
    MATCH*) query="$arg" ;;
  esac
done
if [[ "$query" == *"n:Function"* ]]; then
  printf '| kind | name | filePath | startLine | endLine |\\n'
  printf '| --- | --- | --- | --- | --- |\\n'
  printf '| Function | alpha | src/alpha.js | 1 | 1 |\\n'
else
  printf '| type | fromFile | fromName | toFile | toName |\\n'
  printf '| --- | --- | --- | --- | --- |\\n'
  printf '| CALLS | src/alpha.js | alpha | src/beta.js | beta |\\n'
fi
`);
  fs.chmodSync(npxPath, 0o755);
}

describe('graph anchor extraction helper', () => {
  test('parses GitNexus raw markdown cypher output into node and edge anchors', () => {
    const tmp = makeTempDir();
    const repo = path.join(tmp, 'repo');
    const binDir = path.join(tmp, 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    makeGitRepo(repo);
    writeFakeNpx(binDir);

    const output = execFileSync(
      'bash',
      [HELPER, '--repo', repo, '--provider', 'gitnexus', '--gitnexus-repo', '.'],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
          GITNEXUS_PACKAGE: 'gitnexus@fake',
        },
        encoding: 'utf8',
      }
    );
    const json = JSON.parse(output);
    const gitnexus = json.providers.find((provider) => provider.provider === 'gitnexus');

    expect(gitnexus.status).toBe('ok');
    expect(gitnexus.nodes).toEqual([
      {
        kind: 'Function',
        name: 'alpha',
        path: 'src/alpha.js',
        start_line: 1,
        end_line: 1,
      },
    ]);
    expect(gitnexus.edges).toEqual([
      {
        type: 'CALLS',
        from_path: 'src/alpha.js',
        from_name: 'alpha',
        to_path: 'src/beta.js',
        to_name: 'beta',
      },
    ]);
  });

  test('defaults GitNexus repo selector to the physical repo path', () => {
    const tmp = makeTempDir();
    const repo = path.join(tmp, 'repo');
    const binDir = path.join(tmp, 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    makeGitRepo(repo);
    writeFakeNpx(binDir);

    const output = execFileSync(
      'bash',
      [HELPER, '--repo', repo, '--provider', 'gitnexus'],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
          GITNEXUS_PACKAGE: 'gitnexus@fake',
          EXPECTED_GITNEXUS_REPO: fs.realpathSync(repo),
        },
        encoding: 'utf8',
      }
    );
    const json = JSON.parse(output);

    expect(json.providers[0].metadata.repo_selector).toBe(fs.realpathSync(repo));
  });

  test('rejects retired graph provider extraction', () => {
    const tmp = makeTempDir();
    const repo = path.join(tmp, 'repo');
    makeGitRepo(repo);

    const retiredProvider = ['code', 'review', 'graph'].join('-');
    const result = spawnSync(
      'bash',
      [HELPER, '--repo', repo, '--provider', retiredProvider],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      }
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`unsupported provider: ${retiredProvider}`);
  });
});
