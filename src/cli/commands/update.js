const pkg = require('../../../package.json');
const { getAdapter } = require('../adapters');
const { inspectInstalledAssets } = require('../plugin');
const {
  compareVersions,
  defaultLookupLatestVersion,
  resolveVersionReminderTimeoutMs,
} = require('../version-reminder');
const { detectPlatforms } = require('./doctor');

const PACKAGE_NAME = pkg.name;

/**
 * `spec-first update` — check-only 版本与 runtime 新鲜度检查。
 *
 * 设计边界(见 docs/plans/2026-06-06-002-refactor-update-skill-to-cli-plan.md):
 * - check-only:只报告版本差、runtime drift 与建议命令,绝不自动执行 npm/claude plugin 升级。
 * - 版本真相源是 npm 包:`spec-first` 通过 npm 安装,当前版本=pkg.version,最新版本=npm registry latest。
 *   这对所有宿主一致,因为运行 `spec-first update` 的就是同一个 npm CLI 包。
 * - Claude marketplace plugin 是独立一层:CLI 无法探测其 cache 路径/版本,仅对 Claude runtime
 *   附加一条说明,不伪造也不误判 plugin 版本。
 * - 退出码:0=最新且无 drift;1=有可行动项(有新版本或 runtime drift);2=用法错误。
 */
async function runUpdate(argv) {
  const args = [...argv];
  const parsed = parseUpdateArgs(args);

  if (parsed.help) {
    printHelp();
    return 0;
  }

  if (parsed.unknown.length > 0) {
    console.error('Usage: spec-first update [--claude|--codex] [--json]');
    return 2;
  }

  const projectRoot = process.cwd();

  let platforms = [];
  if (parsed.claude) platforms.push('claude');
  if (parsed.codex) platforms.push('codex');
  if (platforms.length === 0) {
    platforms = detectPlatforms(projectRoot);
  }

  const report = await buildUpdateReport({ projectRoot, platforms });

  if (parsed.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printUpdateReport(report);
  }

  return reportExitCode(report);
}

function parseUpdateArgs(argv) {
  const parsed = {
    help: false,
    claude: false,
    codex: false,
    json: false,
    unknown: [],
  };

  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') {
      parsed.help = true;
    } else if (arg === '--claude') {
      parsed.claude = true;
    } else if (arg === '--codex') {
      parsed.codex = true;
    } else if (arg === '--json') {
      parsed.json = true;
    } else {
      parsed.unknown.push(arg);
    }
  }

  return parsed;
}

async function buildUpdateReport({ projectRoot, platforms }) {
  const cliVersion = pkg.version;
  const timeoutMs = resolveVersionReminderTimeoutMs();

  // 版本检查是 npm 包级(对所有宿主一致):当前 CLI 包 vs npm registry latest。
  const { latestVersion, lookupStatus } = await lookupLatest({ timeoutMs });
  const versionStatus = classifyVersion(cliVersion, latestVersion);

  const base = {
    schema_version: 'spec-first-update-report.v1',
    mode: 'check-only',
    cli_version: cliVersion,
    latest_version: latestVersion || null,
    version_status: versionStatus,
    lookup_status: lookupStatus,
    package_recommendation: versionStatus === 'stale' ? `npm install -g ${PACKAGE_NAME}@latest` : null,
  };

  if (platforms.length === 0) {
    return { ...base, no_runtime_detected: true, platforms: [] };
  }

  return {
    ...base,
    platforms: platforms.map((platform) => buildPlatformRuntimeReport({ projectRoot, platform })),
  };
}

function buildPlatformRuntimeReport({ projectRoot, platform }) {
  const runtimeDrift = inspectRuntimeDrift({ projectRoot, platform });
  const hasDrift = Boolean(runtimeDrift.available && runtimeDrift.has_drift);

  const entry = {
    platform,
    runtime_drift: runtimeDrift,
    runtime_recommendation: hasDrift
      ? 'spec-first init  (regenerate drifted or missing runtime assets; choose this host when prompted)'
      : null,
  };

  if (platform === 'claude') {
    entry.plugin_note =
      'If spec-first is installed as a Claude Code plugin, its plugin version is managed by the '
      + 'marketplace and is not visible to this CLI. Check it with `claude plugin update` inside a '
      + 'Claude Code session. This command reports the npm-installed spec-first CLI package version above.';
    entry.plugin_note_reason_code = 'claude_marketplace_cache_unavailable';
  }

  return entry;
}

async function lookupLatest({ timeoutMs }) {
  // defaultLookupLatestVersion 查询 npm registry,失败时返回 ''(不抛)。
  // 同时尊重 SPEC_FIRST_VERSION_REMINDER_LATEST override(测试/离线用)。
  try {
    const version = await defaultLookupLatestVersion(PACKAGE_NAME, { timeoutMs });
    return version
      ? { latestVersion: version, lookupStatus: 'ok' }
      : { latestVersion: '', lookupStatus: 'failed' };
  } catch {
    return { latestVersion: '', lookupStatus: 'failed' };
  }
}

function classifyVersion(current, latest) {
  if (!current || !latest) {
    return 'unknown';
  }
  const cmp = compareVersions(current, latest);
  if (cmp === null) {
    return 'unknown';
  }
  return cmp < 0 ? 'stale' : 'current';
}

function inspectRuntimeDrift({ projectRoot, platform }) {
  let adapter;
  try {
    adapter = getAdapter(platform);
  } catch {
    return { available: false, reason_code: 'adapter_unavailable' };
  }

  let assets;
  try {
    assets = inspectInstalledAssets(projectRoot, adapter);
  } catch {
    return { available: false, reason_code: 'inspect_failed' };
  }

  const summarize = (status) => ({
    missing: (status.missing || []).length,
    drifted: (status.drifted || []).length,
  });

  const commands = summarize(assets.commands || {});
  const skills = summarize(assets.skills || {});
  const agents = summarize(assets.agents || {});
  const agentSupportFiles = summarize(assets.agentSupportFiles || {});
  const hasDrift =
    commands.missing + commands.drifted +
    skills.missing + skills.drifted +
    agents.missing + agents.drifted +
    agentSupportFiles.missing + agentSupportFiles.drifted > 0;

  return {
    available: true,
    has_drift: hasDrift,
    commands,
    skills,
    agents,
    agent_support_files: agentSupportFiles,
  };
}

function reportExitCode(report) {
  if (report.version_status === 'stale') {
    return 1;
  }
  const driftActionable = (report.platforms || []).some(
    (entry) => entry.runtime_drift && entry.runtime_drift.available && entry.runtime_drift.has_drift,
  );
  return driftActionable ? 1 : 0;
}

function printUpdateReport(report) {
  console.log(`spec-first update (check-only) — CLI v${report.cli_version}`);
  console.log('');

  const latest = report.latest_version
    || (report.lookup_status === 'failed' ? 'unknown (lookup failed)' : 'unknown');
  if (report.version_status === 'stale') {
    console.log(`CLI package: v${report.cli_version} -> v${latest} (update available)`);
    console.log('  Suggested next step (this command does not apply it):');
    console.log(`    - ${report.package_recommendation}`);
  } else if (report.version_status === 'current') {
    console.log(`CLI package: v${report.cli_version} (up to date)`);
  } else {
    console.log(`CLI package: v${report.cli_version}; latest=${latest} (could not compare)`);
  }

  if (report.no_runtime_detected) {
    console.log('');
    console.log('No spec-first runtime detected in this project.');
    console.log('Run `spec-first init` and select Claude Code and/or Codex to initialize.');
    return;
  }

  for (const entry of report.platforms) {
    const label = entry.platform === 'claude' ? 'Claude Code' : 'Codex';
    console.log('');
    console.log(`[${label}]`);

    if (entry.runtime_drift && entry.runtime_drift.available) {
      console.log(`  Runtime assets: ${entry.runtime_drift.has_drift ? 'drift detected' : 'in sync'}`);
    } else if (entry.runtime_drift && entry.runtime_drift.reason_code === 'inspect_failed') {
      console.log('  Runtime assets: could not inspect (asset inspection failed)');
    } else {
      console.log('  Runtime assets: not initialized in this project');
    }

    if (entry.runtime_recommendation) {
      console.log('  Suggested next step (this command does not apply it):');
      console.log(`    - ${entry.runtime_recommendation}`);
    }

    if (entry.plugin_note) {
      console.log(`  Note: ${entry.plugin_note}`);
    }
  }
}

function printHelp() {
  console.log([
    '🔄 spec-first update — check-only version and runtime freshness check',
    '',
    'Reports whether the npm-installed spec-first CLI package and this project\'s',
    'generated runtime assets are up to date, and suggests next commands. It NEVER',
    'installs or upgrades anything itself (check-only, like `npm outdated`).',
    '',
    '📘 Usage:',
    '  spec-first update [--claude|--codex] [--json]',
    '',
    '⚙️  Options:',
    '  --claude        Check the Claude Code runtime assets only',
    '  --codex         Check the Codex runtime assets only',
    '  --json          Machine-readable report',
    '  -h, --help      Show help',
    '',
    'With no host flag, update checks whichever runtimes are detected in this project.',
    '',
    '🔢 Exit codes:',
    '  0  up to date and no runtime drift',
    '  1  actionable: a newer CLI version is available, or runtime assets drifted',
    '  2  usage error (unknown flag)',
    '',
    '📦 Examples:',
    '  spec-first update                 # check CLI package version + all detected runtimes',
    '  spec-first update --codex --json  # machine-readable report, Codex runtime only',
    '',
    'Note: this checks the npm spec-first package version. If you use spec-first as a',
    'Claude Code plugin, its plugin version is managed by the marketplace and is not',
    'visible here — check it with `claude plugin update` inside Claude Code.',
    '',
    '🔗 Repository:',
    '  https://github.com/sunrain520/spec-first',
  ].join('\n'));
}

module.exports = {
  runUpdate,
};
