const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { getAdapter } = require('./adapters');

const STARTUP_REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const UNKNOWN_RUNTIME_VERSION = 'unknown-runtime-version';
const DEFAULT_VERSION_REMINDER_TIMEOUT_MS = 2000;

// 默认网络超时；可经 SPEC_FIRST_VERSION_REMINDER_TIMEOUT_MS 覆盖(慢网调大、CI 调小)。
// 350ms 曾导致在常见网络下查询 registry.npmjs.org(实测约 630ms)每次静默超时,提醒形同虚设。
function resolveVersionReminderTimeoutMs() {
  const raw = process.env.SPEC_FIRST_VERSION_REMINDER_TIMEOUT_MS;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_VERSION_REMINDER_TIMEOUT_MS;
}

function shouldNotifyVersionReminder(currentVersion, latestVersion) {
  const comparison = compareVersions(currentVersion, latestVersion);
  return comparison !== null && comparison < 0;
}

function formatVersionReminder({ packageName, currentVersion, latestVersion }) {
  const upgradeCommand = `npm install -g ${packageName}@latest`;
  return [
    `Update available for ${packageName}: ${currentVersion} -> ${latestVersion}`,
    `Upgrade with: ${upgradeCommand}`,
  ].join('\n');
}

async function maybeShowVersionReminder(options = {}) {
  const {
    packageName = '',
    currentVersion = '',
    output = process.stderr,
    timeoutMs = resolveVersionReminderTimeoutMs(),
    lookupLatestVersion = defaultLookupLatestVersion,
  } = options;

  if (!packageName || !currentVersion) {
    return false;
  }

  let latestVersion;
  try {
    latestVersion = await lookupLatestVersion(packageName, { timeoutMs });
  } catch {
    return false;
  }

  if (!latestVersion || !shouldNotifyVersionReminder(currentVersion, latestVersion)) {
    return false;
  }

  const message = formatVersionReminder({
    packageName,
    currentVersion,
    latestVersion,
  });

  try {
    output.write(`${message}\n`);
  } catch {
    return false;
  }

  return true;
}

async function maybeShowStartupVersionReminder(options = {}) {
  const output = options.output || process.stdout;
  const reminder = await buildStartupVersionReminder(options);
  const graphSnapshot = options.includeGraphSnapshot
    ? buildStartupGraphReadinessSnapshot(options)
    : null;
  const messages = [];
  if (reminder && reminder.message) {
    messages.push(reminder.message);
  }
  if (graphSnapshot && graphSnapshot.message) {
    messages.push(graphSnapshot.message);
  }

  if (messages.length === 0) {
    return false;
  }

  try {
    output.write(`${messages.join('\n')}\n`);
  } catch {
    return false;
  }

  if (reminder && reminder.message) {
    recordStartupReminderCooldown(reminder, options);
  }
  return true;
}

async function buildStartupVersionReminder(options = {}) {
  const host = normalizeHost(options.host);
  if (!host) {
    return null;
  }

  const projectRoot = options.projectRoot || process.cwd();
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : resolveVersionReminderTimeoutMs();
  const packageName = options.packageName || 'spec-first';
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const cooldownMs = Number.isFinite(options.cooldownMs)
    ? options.cooldownMs
    : STARTUP_REMINDER_COOLDOWN_MS;
  const lookupLatestVersion = options.lookupLatestVersion || defaultLookupStartupLatestVersion;
  const runtime = resolveCurrentRuntimeVersion({ host, projectRoot });

  if (!runtime.runtimeExists) {
    return null;
  }

  let latestVersion = '';
  try {
    latestVersion = await lookupLatestVersion({ host, packageName, timeoutMs });
  } catch {
    return null;
  }

  latestVersion = normalizeOverride(latestVersion);
  if (!latestVersion || !parseVersion(latestVersion)) {
    return null;
  }

  const currentVersion = runtime.currentVersion;
  const currentKeyVersion = currentVersion || UNKNOWN_RUNTIME_VERSION;
  const reminderKey = buildStartupReminderKey({ host, currentVersion: currentKeyVersion, latestVersion });

  if (isStartupReminderCooldownActive({ host, key: reminderKey, nowMs, cooldownMs }, options)) {
    return null;
  }

  if (currentVersion && !shouldNotifyVersionReminder(currentVersion, latestVersion)) {
    return null;
  }

  return {
    host,
    projectRoot,
    key: reminderKey,
    currentVersion: currentKeyVersion,
    latestVersion,
    nowMs,
    message: formatStartupVersionReminder({
      host,
      currentVersion,
      latestVersion,
    }),
  };
}

function formatStartupVersionReminder({ host, currentVersion, latestVersion }) {
  const hostLabel = host === 'claude' ? 'Claude Code' : 'Codex';
  const updateEntry = host === 'claude' ? '/spec:update' : '$spec-update';
  const statusLine = currentVersion
    ? `[spec-first] Update available for ${hostLabel} runtime: ${currentVersion} -> ${latestVersion}`
    : `[spec-first] ${hostLabel} runtime version is unknown; latest available spec-first is ${latestVersion}.`;

  return [
    statusLine,
    `Run ${updateEntry} when you choose to upgrade. This startup reminder is read-only and will not install, refresh runtime assets, or restart the host.`,
  ].join('\n');
}

function buildStartupGraphReadinessSnapshot(options = {}) {
  const host = normalizeHost(options.host);
  if (!host) {
    return null;
  }

  const projectRoot = options.projectRoot || process.cwd();
  const runtime = resolveCurrentRuntimeVersion({ host, projectRoot });
  if (!runtime.runtimeExists) {
    return null;
  }

  try {
    return buildStartupGraphReadinessSnapshotUnchecked({ host, projectRoot });
  } catch {
    return null;
  }
}

function buildStartupGraphReadinessSnapshotUnchecked({ host, projectRoot }) {
  const providerStatus = readJsonArtifact(path.join(projectRoot, '.spec-first/graph/provider-status.json'));
  const graphFacts = readJsonArtifact(path.join(projectRoot, '.spec-first/graph/graph-facts.json'));
  const impactCapabilities = readJsonArtifact(path.join(projectRoot, '.spec-first/impact/bootstrap-impact-capabilities.json'));
  const provider = findGitNexusProvider(providerStatus.value);
  const repoSnapshot = currentStartupRepoSnapshot(projectRoot);
  const queryReady = gitNexusQueryReady(providerStatus.value, graphFacts.value, provider);
  const freshness = classifyStartupGraphFreshness(graphFacts, repoSnapshot);
  const dirty = repoSnapshot.ok
    ? (repoSnapshot.worktree_dirty ? 'dirty' : 'clean')
    : 'unknown';
  const capabilities = formatStartupGraphCapabilities(queryReady, impactCapabilities.value);
  const limitations = startupGraphLimitations({
    providerStatus,
    graphFacts,
    impactCapabilities,
    provider,
    queryReady,
    freshness,
    repoSnapshot,
  });
  const graphEntry = host === 'claude' ? '/spec:graph-bootstrap' : '$spec-graph-bootstrap';
  const action = freshness === 'fresh' && queryReady
    ? 'no refresh needed for compiled graph readiness'
    : `run ${graphEntry} when current graph evidence is needed`;

  return {
    message: [
      `[spec-first] GitNexus graph: query_ready=${queryReady ? 'true' : 'false'}; freshness=${freshness}; dirty=${dirty}; capabilities=${capabilities}; limitations=${limitations.join(', ')}.`,
      `Graph snapshot is read-only; ${action}.`,
    ].join('\n'),
    query_ready: queryReady,
    freshness,
    dirty,
    capabilities,
    limitations,
  };
}

function readJsonArtifact(artifactPath) {
  try {
    if (!fs.existsSync(artifactPath)) {
      return { ok: false, reason_code: 'canonical_artifact_missing', value: null };
    }
    const parsed = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, reason_code: 'invalid_json_object', value: null };
    }
    return { ok: true, reason_code: null, value: parsed };
  } catch {
    return { ok: false, reason_code: 'artifact_unreadable', value: null };
  }
}

function findGitNexusProvider(providerStatus) {
  const providers = Array.isArray(providerStatus && providerStatus.providers)
    ? providerStatus.providers
    : [];
  return providers.find((provider) => provider && provider.provider === 'gitnexus') || null;
}

function gitNexusQueryReady(providerStatus, graphFacts, provider) {
  const readyProviders = Array.isArray(providerStatus && providerStatus.ready_primary_providers)
    ? providerStatus.ready_primary_providers
    : [];
  const graphReadyProviders = Array.isArray(graphFacts && graphFacts.provider_summary && graphFacts.provider_summary.ready_primary_providers)
    ? graphFacts.provider_summary.ready_primary_providers
    : [];
  return Boolean(
    provider
    && provider.query_ready === true
    && readyProviders.includes('gitnexus')
    && graphFacts
    && graphFacts.capabilities
    && graphFacts.capabilities.query_global_graph === true
    && graphReadyProviders.includes('gitnexus'),
  );
}

function classifyStartupGraphFreshness(graphFacts, repoSnapshot) {
  if (!graphFacts.ok) {
    return 'unavailable';
  }
  if (!repoSnapshot.ok) {
    return 'unknown';
  }

  const recordedRevision = graphFacts.value.source_revision || graphFacts.value.staleness_hints?.source_revision || '';
  const recordedDirty = graphFacts.value.worktree_dirty;
  const recordedStatusHash = graphFacts.value.worktree_status_hash
    || graphFacts.value.staleness_hints?.worktree_status_hash
    || '';

  return recordedRevision === repoSnapshot.source_revision
    && recordedDirty === repoSnapshot.worktree_dirty
    && recordedStatusHash === repoSnapshot.worktree_status_hash
    ? 'fresh'
    : 'stale';
}

function currentStartupRepoSnapshot(projectRoot) {
  const sourceRevision = execStartupGit(projectRoot, ['rev-parse', '--verify', 'HEAD^{commit}']).trim();
  const status = execStartupGit(projectRoot, ['status', '--porcelain']).replace(/\n+$/g, '');
  if (!sourceRevision) {
    return {
      ok: false,
      source_revision: '',
      worktree_dirty: null,
      worktree_status_hash: '',
    };
  }

  return {
    ok: true,
    source_revision: sourceRevision,
    worktree_dirty: status.length > 0,
    worktree_status_hash: `sha256:${crypto.createHash('sha256').update(status).digest('hex')}`,
  };
}

function execStartupGit(projectRoot, args) {
  try {
    return execFileSync('git', ['-C', projectRoot, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 500,
    });
  } catch {
    return '';
  }
}

function formatStartupGraphCapabilities(queryReady, impactCapabilities) {
  if (!impactCapabilities || typeof impactCapabilities !== 'object') {
    return queryReady
      ? 'query/context=available, impact=unknown, review=unknown'
      : 'unavailable';
  }

  const capabilities = impactCapabilities.capabilities && typeof impactCapabilities.capabilities === 'object'
    ? impactCapabilities.capabilities
    : {};
  const contextSupport = supportLevel(capabilities.context_selection, queryReady ? 'available' : 'unknown');
  const impactSupport = supportLevel(capabilities.impact_radius, 'unknown');
  const reviewSupport = supportLevel(capabilities.review_support, 'unknown');
  return `query/context=${contextSupport}, impact=${impactSupport}, review=${reviewSupport}`;
}

function supportLevel(capability, fallback) {
  return capability && typeof capability.support_level === 'string' && capability.support_level.trim()
    ? capability.support_level.trim()
    : fallback;
}

function startupGraphLimitations({
  providerStatus,
  graphFacts,
  impactCapabilities,
  provider,
  queryReady,
  freshness,
  repoSnapshot,
}) {
  const limitations = [];
  if (!providerStatus.ok || !graphFacts.ok || !impactCapabilities.ok) {
    limitations.push('canonical_artifact_missing');
  }
  if (!provider) {
    limitations.push('gitnexus_provider_unavailable');
  }
  if (!queryReady) {
    limitations.push('query_not_ready');
  }
  if (freshness === 'stale') {
    limitations.push('snapshot_mismatch');
  }
  if (!repoSnapshot.ok) {
    limitations.push('git_snapshot_unavailable');
  }

  addLimitations(limitations, graphFacts.value?.capabilities?.impact_context_limitations);
  addLimitations(limitations, provider?.limitations);
  addLimitations(limitations, provider?.review_support?.limitations);
  addLimitations(limitations, impactCapabilities.value?.capabilities?.impact_radius?.limitations);
  addLimitations(limitations, impactCapabilities.value?.capabilities?.review_support?.limitations);

  return [...new Set(limitations)].slice(0, 5).length > 0
    ? [...new Set(limitations)].slice(0, 5)
    : ['none'];
}

function addLimitations(target, values) {
  if (Array.isArray(values)) {
    for (const value of values) {
      const limitation = normalizeStartupLimitation(value);
      if (limitation) {
        target.push(limitation);
      }
    }
  } else if (typeof values === 'string' && values.trim()) {
    const limitation = normalizeStartupLimitation(values);
    if (limitation) {
      target.push(limitation);
    }
  }
}

function normalizeStartupLimitation(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) {
    return '';
  }
  return trimmed.replace(/[.;]+$/g, '');
}

async function defaultLookupStartupLatestVersion({ host, packageName, timeoutMs }) {
  const override = normalizeOverride(process.env.SPEC_FIRST_VERSION_REMINDER_LATEST);
  if (override) {
    return override;
  }

  if (host === 'claude') {
    return lookupLatestGitHubPackageVersion({ timeoutMs });
  }

  return defaultLookupLatestVersion(packageName, { timeoutMs });
}

async function lookupLatestGitHubPackageVersion(options = {}) {
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : resolveVersionReminderTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://raw.githubusercontent.com/sunrain520/spec-first/main/package.json', {
      headers: {
        accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return '';
    }

    const payload = await response.json().catch(() => null);
    return payload && typeof payload.version === 'string'
      ? payload.version.trim()
      : '';
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

function resolveCurrentRuntimeVersion({ host, projectRoot }) {
  let adapter;
  try {
    adapter = getAdapter(host);
  } catch {
    return {
      runtimeExists: false,
      currentVersion: '',
    };
  }

  const statePath = path.join(projectRoot, adapter.stateFile);
  const runtimeExists = managedRuntimeExists(projectRoot, adapter);

  if (!fs.existsSync(statePath)) {
    return {
      runtimeExists,
      currentVersion: '',
    };
  }

  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const manifestVersion = typeof state.manifestVersion === 'string'
      ? state.manifestVersion.trim()
      : '';
    return {
      runtimeExists: true,
      currentVersion: parseVersion(manifestVersion) ? manifestVersion : '',
    };
  } catch {
    return {
      runtimeExists: true,
      currentVersion: '',
    };
  }
}

function managedRuntimeExists(projectRoot, adapter) {
  const candidates = [
    adapter.stateFile,
    adapter.managedRoot,
  ];

  if (adapter.hasCommands) {
    candidates.push(
      path.join(adapter.commandRoot, 'update.md'),
      path.join(adapter.skillsRoot, 'using-spec-first', 'SKILL.md'),
    );
  } else {
    candidates.push(
      path.join(adapter.workflowsRoot, 'spec-update', 'SKILL.md'),
      path.join(adapter.skillsRoot, 'using-spec-first', 'SKILL.md'),
    );
  }

  return candidates.some((relativePath) => {
    if (typeof relativePath !== 'string' || relativePath.length === 0) {
      return false;
    }
    return fs.existsSync(path.join(projectRoot, relativePath));
  });
}

function isStartupReminderCooldownActive({ host, key, nowMs, cooldownMs }, options = {}) {
  const state = readStartupReminderState(host, options);
  const record = state.reminders[key];
  if (!record || typeof record.shownAt !== 'string') {
    return false;
  }

  const shownAtMs = Date.parse(record.shownAt);
  if (!Number.isFinite(shownAtMs)) {
    return false;
  }
  if (shownAtMs > nowMs) {
    return false;
  }

  return nowMs - shownAtMs < cooldownMs;
}

function recordStartupReminderCooldown(reminder, options = {}) {
  try {
    const state = readStartupReminderState(reminder.host, options);
    state.reminders[reminder.key] = {
      host: reminder.host,
      currentVersion: reminder.currentVersion,
      latestVersion: reminder.latestVersion,
      shownAt: new Date(reminder.nowMs).toISOString(),
    };
    writeStartupReminderState(reminder.host, state, options);
  } catch {
    // Reminder output is more important than cache persistence.
  }
}

function clearStartupVersionReminderCooldown(options = {}) {
  const host = normalizeHost(options.host);
  if (!host) {
    return false;
  }

  try {
    fs.rmSync(getStartupReminderStatePath(host, options), { force: true });
    return true;
  } catch {
    return false;
  }
}

function readStartupReminderState(host, options = {}) {
  const statePath = getStartupReminderStatePath(host, options);
  try {
    if (!fs.existsSync(statePath)) {
      return { reminders: {} };
    }
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { reminders: {} };
    }
    const reminders = parsed.reminders && typeof parsed.reminders === 'object' && !Array.isArray(parsed.reminders)
      ? parsed.reminders
      : {};
    return { reminders };
  } catch {
    return { reminders: {} };
  }
}

function writeStartupReminderState(host, state, options = {}) {
  const statePath = getStartupReminderStatePath(host, options);
  const tmpPath = `${statePath}.${process.pid}.${Date.now()}.tmp`;
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  try {
    fs.writeFileSync(tmpPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    fs.renameSync(tmpPath, statePath);
  } catch (error) {
    try {
      fs.rmSync(tmpPath, { force: true });
    } catch {
      // Best-effort cleanup only.
    }
    throw error;
  }
}

function getStartupReminderStatePath(host, options = {}) {
  const homeRoot = options.homeRoot
    || getDefaultHomeRoot();
  return path.join(homeRoot, `.${host}`, 'spec-first', 'startup-version-reminder.json');
}

function getDefaultHomeRoot() {
  try {
    const userInfo = os.userInfo();
    if (userInfo && typeof userInfo.homedir === 'string' && userInfo.homedir.length > 0) {
      return userInfo.homedir;
    }
  } catch {
    // Fall back to Node's standard home resolution when userInfo is unavailable.
  }

  return os.homedir();
}

function buildStartupReminderKey({ host, currentVersion, latestVersion }) {
  return [host, currentVersion, latestVersion].join('|');
}

function normalizeHost(host) {
  return host === 'claude' || host === 'codex' ? host : '';
}

async function defaultLookupLatestVersion(packageName, options = {}) {
  const override = normalizeOverride(process.env.SPEC_FIRST_VERSION_REMINDER_LATEST);
  if (override) {
    return override;
  }

  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : resolveVersionReminderTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`,
      {
        headers: {
          accept: 'application/json',
        },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return '';
    }

    const payload = await response.json().catch(() => null);
    return payload && typeof payload.version === 'string'
      ? payload.version.trim()
      : '';
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeOverride(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
}

function compareVersions(left, right) {
  const parsedLeft = parseVersion(left);
  const parsedRight = parseVersion(right);

  if (!parsedLeft || !parsedRight) {
    return null;
  }

  const core = compareCore(parsedLeft, parsedRight);
  if (core !== 0) {
    return core;
  }

  return comparePrerelease(parsedLeft.prerelease, parsedRight.prerelease);
}

function compareCore(left, right) {
  if (left.major !== right.major) {
    return left.major < right.major ? -1 : 1;
  }

  if (left.minor !== right.minor) {
    return left.minor < right.minor ? -1 : 1;
  }

  if (left.patch !== right.patch) {
    return left.patch < right.patch ? -1 : 1;
  }

  return 0;
}

function comparePrerelease(left, right) {
  if (left.length === 0 && right.length === 0) {
    return 0;
  }

  if (left.length === 0) {
    return 1;
  }

  if (right.length === 0) {
    return -1;
  }

  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];

    if (leftPart === undefined) {
      return -1;
    }

    if (rightPart === undefined) {
      return 1;
    }

    const leftNumeric = isNumericIdentifier(leftPart);
    const rightNumeric = isNumericIdentifier(rightPart);

    if (leftNumeric && rightNumeric) {
      const leftValue = Number(leftPart);
      const rightValue = Number(rightPart);
      if (leftValue !== rightValue) {
        return leftValue < rightValue ? -1 : 1;
      }
      continue;
    }

    if (leftNumeric && !rightNumeric) {
      return -1;
    }

    if (!leftNumeric && rightNumeric) {
      return 1;
    }

    if (leftPart !== rightPart) {
      return leftPart < rightPart ? -1 : 1;
    }
  }

  return 0;
}

function parseVersion(input) {
  if (typeof input !== 'string') {
    return null;
  }

  const normalized = input.trim().replace(/^v/, '');
  if (!normalized) {
    return null;
  }

  const [coreWithBuild] = normalized.split('+');
  const [core, prerelease = ''] = coreWithBuild.split('-', 2);
  const parts = core.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const numericParts = parts.map((part) => {
    if (!/^(0|[1-9]\d*)$/.test(part)) {
      return null;
    }
    return Number(part);
  });

  if (numericParts.some((part) => part === null)) {
    return null;
  }

  const prereleaseParts = prerelease
    ? prerelease.split('.').filter((part) => part.length > 0)
    : [];

  return {
    major: numericParts[0],
    minor: numericParts[1],
    patch: numericParts[2],
    prerelease: prereleaseParts,
  };
}

function isNumericIdentifier(value) {
  return /^(0|[1-9]\d*)$/.test(value);
}

module.exports = {
  DEFAULT_VERSION_REMINDER_TIMEOUT_MS,
  buildStartupGraphReadinessSnapshot,
  buildStartupVersionReminder,
  clearStartupVersionReminderCooldown,
  defaultLookupLatestVersion,
  formatVersionReminder,
  formatStartupVersionReminder,
  maybeShowVersionReminder,
  maybeShowStartupVersionReminder,
  resolveCurrentRuntimeVersion,
  resolveVersionReminderTimeoutMs,
  shouldNotifyVersionReminder,
};
