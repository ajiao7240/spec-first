'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_GENERATED_AT = '2026-04-18T00:00:00.000Z';

const STATIC_VERIFIERS = [
  {
    verifier_id: 'test-browser',
    supported_platforms: ['web'],
    prerequisites: ['agent-browser'],
    evidence_outputs: ['browser-snapshot', 'console-errors', 'network-observations'],
    supported_gate_kinds: ['browser-verification'],
    supported_evidence_types: ['browser-evidence', 'browser-snapshot', 'console-errors', 'network-observations'],
    availability_checks: [
      {
        type: 'command',
        command: 'agent-browser',
        prerequisite: 'agent-browser',
      },
    ],
    invocation_hints: {
      kind: 'standalone-skill',
      skill_name: 'test-browser',
      setup_hint: 'spec:setup',
      notes: 'Use for browser evidence on web surfaces; do not infer repo-specific commands here.',
    },
  },
  {
    verifier_id: 'test-xcode',
    supported_platforms: ['mobile-ios'],
    prerequisites: ['XcodeBuildMCP'],
    evidence_outputs: ['simulator-screenshot', 'simulator-logs'],
    supported_gate_kinds: ['simulator-verification', 'ios-ui-verification'],
    supported_evidence_types: ['simulator-screenshot', 'simulator-logs'],
    availability_checks: [
      {
        type: 'platform',
        platform: 'darwin',
        prerequisite: 'macOS',
      },
    ],
    invocation_hints: {
      kind: 'standalone-skill',
      skill_name: 'test-xcode',
      setup_hint: 'spec:setup',
      notes: 'Use for simulator-backed iOS verification; keep scheme/build specifics outside the registry.',
    },
  },
];

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function scopeToPlatforms(scope) {
  switch (scope) {
    case 'web-surface':
      return ['web'];
    case 'mobile-ios':
      return ['mobile-ios'];
    case 'mobile-android':
      return ['mobile-android'];
    case 'backend':
      return ['backend'];
    case 'desktop':
      return ['desktop'];
    case 'cli-surface':
      return ['cli'];
    case 'shared-contract':
      return ['shared-contract'];
    default:
      return [];
  }
}

function stringIncludesAny(value, patterns = []) {
  const text = String(value || '').toLowerCase();
  return patterns.some((pattern) => text.includes(pattern));
}

function detectCommand(command, envPath = process.env.PATH || '') {
  if (!command || !envPath) return null;
  const extensions = process.platform === 'win32'
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';')
    : [''];

  for (const entry of envPath.split(path.delimiter)) {
    if (!entry) continue;
    for (const extension of extensions) {
      const candidate = process.platform === 'win32'
        ? path.join(entry, `${command}${extension}`)
        : path.join(entry, command);
      if (!fs.existsSync(candidate)) continue;
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return true;
      } catch (_error) {
        continue;
      }
    }
  }

  return false;
}

function buildPrerequisiteRuntimeState({
  platform = process.platform,
  commandStates = {},
  allowRuntimeProbe = !process.env.JEST_WORKER_ID,
} = {}) {
  const states = {};
  const normalizedPlatform = String(platform || process.platform).toLowerCase();

  states['XcodeBuildMCP'] = normalizedPlatform !== 'darwin'
    ? {
      status: 'missing',
      available: false,
      reason: 'requires-macos-host',
    }
    : {
      status: 'unverified',
      available: null,
      reason: 'confirm-mcp-connectivity-before-dispatch',
    };

  if (Object.prototype.hasOwnProperty.call(commandStates, 'agent-browser')) {
    states['agent-browser'] = commandStates['agent-browser']
      ? { status: 'ready', available: true, reason: 'explicit-runtime-override' }
      : { status: 'missing', available: false, reason: 'explicit-runtime-override' };
  } else if (allowRuntimeProbe) {
    const available = detectCommand('agent-browser');
    states['agent-browser'] = available
      ? { status: 'ready', available: true, reason: 'command-found-in-path' }
      : { status: 'missing', available: false, reason: 'command-not-found-in-path' };
  } else {
    states['agent-browser'] = {
      status: 'unverified',
      available: null,
      reason: 'runtime-probe-disabled',
    };
  }

  return states;
}

function evaluateAvailabilityCheck(check, runtimeState, platform) {
  if (!check || typeof check !== 'object') return null;

  if (check.type === 'platform') {
    const expectedPlatform = String(check.platform || '').toLowerCase();
    const matches = String(platform || process.platform).toLowerCase() === expectedPlatform;
    return matches
      ? null
      : {
        prerequisite: check.prerequisite || expectedPlatform,
        kind: 'host-platform',
        reason: `requires-${expectedPlatform}`,
        detail: `Verifier requires ${expectedPlatform}.`,
      };
  }

  if (check.type === 'command') {
    const state = runtimeState[check.prerequisite || check.command];
    if (!state || state.status === 'ready' || state.status === 'unverified') return null;
    return {
      prerequisite: check.prerequisite || check.command,
      kind: 'missing-command',
      reason: state.reason || 'command-not-found',
      detail: `${check.command} is not available in PATH.`,
    };
  }

  return null;
}

function gateMatchesVerifier(entry, gate, verificationId, targetPlatforms = []) {
  if (!entry) return false;

  const gateId = String(verificationId || (gate && gate.id) || '').toLowerCase();
  const gateKind = String(gate && gate.kind || '').toLowerCase();
  const evidenceType = String(gate && gate.evidence_type || '').toLowerCase();
  const explicitPlatforms = unique([
    ...scopeToPlatforms(gate && gate.scope),
    ...targetPlatforms,
  ]);

  if (
    explicitPlatforms.length > 0
    && !entry.supported_platforms.some((platform) => explicitPlatforms.includes(platform))
  ) {
    return false;
  }

  if (entry.supported_gate_kinds.includes(gateKind)) return true;
  if (entry.supported_evidence_types.includes(evidenceType)) return true;

  if (scopeToPlatforms(gate && gate.scope).some((platform) => entry.supported_platforms.includes(platform))) {
    return true;
  }

  if (entry.verifier_id === 'test-browser') {
    return stringIncludesAny(gateId, ['browser', 'playwright', 'web']);
  }

  if (entry.verifier_id === 'test-xcode') {
    return stringIncludesAny(gateId, ['ios', 'xcode', 'simulator']);
  }

  return false;
}

function determineDispatchPosture(stage, availability) {
  if (stage === 'plan') return 'plan-handoff';
  if (availability.blocked) return 'blocked';
  if (availability.ready) return 'dispatch-ready';
  return 'manual-handoff';
}

function determineHandoffPosture({
  stage,
  dispatchCandidates = [],
  manualRequiredVerifications = [],
  manualOptionalVerifications = [],
  dispatchBlockers = [],
} = {}) {
  const hasReadyCandidate = dispatchCandidates.some((candidate) => candidate.posture === 'dispatch-ready');
  const hasManualCandidate = dispatchCandidates.some((candidate) => candidate.posture === 'manual-handoff');
  const hasManualWork = manualRequiredVerifications.length > 0 || manualOptionalVerifications.length > 0;
  const hasBlocker = dispatchBlockers.length > 0;

  if (stage === 'plan') {
    return dispatchCandidates.length > 0 || hasManualWork ? 'plan-matrix' : 'not-needed';
  }
  if (hasBlocker && !hasReadyCandidate && !hasManualCandidate && !hasManualWork) return 'blocked';
  if (hasReadyCandidate && hasManualWork) return 'dispatch-and-manual';
  if (hasReadyCandidate) return 'dispatch-ready';
  if (hasManualCandidate || hasManualWork) return hasBlocker ? 'blocked' : 'manual-only';
  if (hasBlocker) return 'blocked';
  return 'not-needed';
}

function buildVerifierRegistry({ generatedAt = DEFAULT_GENERATED_AT } = {}) {
  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    verifiers: STATIC_VERIFIERS.map((entry) => ({
      ...entry,
      supported_platforms: [...entry.supported_platforms],
      prerequisites: [...entry.prerequisites],
      evidence_outputs: [...entry.evidence_outputs],
      supported_gate_kinds: [...entry.supported_gate_kinds],
      supported_evidence_types: [...entry.supported_evidence_types],
      availability_checks: entry.availability_checks.map((check) => ({ ...check })),
      invocation_hints: { ...entry.invocation_hints },
    })),
  };
}

function buildVerifierHintsFromRegistry({ platforms = [] } = {}) {
  const wantedPlatforms = new Set(unique(platforms));
  if (wantedPlatforms.size === 0) return [];

  return buildVerifierRegistry().verifiers
    .filter((entry) => entry.supported_platforms.some((platform) => wantedPlatforms.has(platform)))
    .map((entry) => ({
      verifier: entry.verifier_id,
      platforms: entry.supported_platforms.filter((platform) => wantedPlatforms.has(platform)),
      available: true,
      prerequisites: [...entry.prerequisites],
      evidence_outputs: [...entry.evidence_outputs],
    }));
}

function buildVerifierDispatchPosture({
  stage,
  requiredVerifications = [],
  optionalVerifications = [],
  gateCatalog = {},
  platformFocus = [],
  impactedPlatforms = [],
  prerequisiteRuntimeState = null,
  allowRuntimeProbe = !process.env.JEST_WORKER_ID,
  platform = process.platform,
} = {}) {
  const normalizedStage = String(stage || '').toLowerCase();
  const targetPlatforms = unique((impactedPlatforms || []).length > 0
    ? impactedPlatforms
    : platformFocus);
  const registry = buildVerifierRegistry();
  const runtimeState = prerequisiteRuntimeState || buildPrerequisiteRuntimeState({
    platform,
    allowRuntimeProbe,
  });

  const coveredRequired = new Set();
  const coveredOptional = new Set();
  const dispatchCandidates = [];
  const dispatchBlockers = [];

  for (const entry of registry.verifiers) {
    if (
      targetPlatforms.length > 0
      && !entry.supported_platforms.some((platformName) => targetPlatforms.includes(platformName))
    ) {
      continue;
    }

    const targetRequiredVerifications = unique(requiredVerifications.filter((id) =>
      gateMatchesVerifier(entry, gateCatalog[id], id, targetPlatforms)
    ));
    const targetOptionalVerifications = unique(optionalVerifications.filter((id) =>
      gateMatchesVerifier(entry, gateCatalog[id], id, targetPlatforms)
    ));

    if (targetRequiredVerifications.length === 0 && targetOptionalVerifications.length === 0) {
      continue;
    }

    const blockerEntries = [];
    for (const check of entry.availability_checks) {
      const blocker = evaluateAvailabilityCheck(check, runtimeState, platform);
      if (blocker) blockerEntries.push(blocker);
    }

    for (const prerequisite of entry.prerequisites) {
      const state = runtimeState[prerequisite];
      if (!state || state.status !== 'missing') continue;
      if (blockerEntries.some((item) => item.prerequisite === prerequisite)) continue;
      blockerEntries.push({
        prerequisite,
        kind: 'missing-prerequisite',
        reason: state.reason || 'missing-prerequisite',
        detail: `${prerequisite} is required before running ${entry.verifier_id}.`,
      });
    }

    const blockers = unique(blockerEntries.map((item) => JSON.stringify(item))).map((item) => JSON.parse(item));

    const hasUnverifiedPrerequisites = entry.prerequisites.some((prerequisite) =>
      runtimeState[prerequisite] && runtimeState[prerequisite].status === 'unverified'
    );
    const availability = {
      ready: blockers.length === 0 && !hasUnverifiedPrerequisites,
      blocked: blockers.length > 0,
    };
    const posture = determineDispatchPosture(normalizedStage, availability);

    targetRequiredVerifications.forEach((id) => coveredRequired.add(id));
    targetOptionalVerifications.forEach((id) => coveredOptional.add(id));

    const candidate = {
      verifier: entry.verifier_id,
      posture,
      entrypoint_kind: entry.invocation_hints.kind,
      entrypoint: entry.invocation_hints.skill_name || null,
      setup_hint: entry.invocation_hints.setup_hint || null,
      platforms: [...entry.supported_platforms],
      target_required_verifications: targetRequiredVerifications,
      target_optional_verifications: targetOptionalVerifications,
      prerequisites: [...entry.prerequisites],
      evidence_outputs: [...entry.evidence_outputs],
      blockers,
      notes: entry.invocation_hints.notes || null,
    };
    dispatchCandidates.push(candidate);

    blockers.forEach((blocker) => {
      dispatchBlockers.push({
        verifier: entry.verifier_id,
        target_verifications: unique([
          ...targetRequiredVerifications,
          ...targetOptionalVerifications,
        ]),
        setup_hint: entry.invocation_hints.setup_hint || null,
        ...blocker,
      });
    });
  }

  const manualRequiredVerifications = requiredVerifications.filter((id) => !coveredRequired.has(id));
  const manualOptionalVerifications = optionalVerifications.filter((id) => !coveredOptional.has(id));

  return {
    stage: normalizedStage,
    handoff_posture: determineHandoffPosture({
      stage: normalizedStage,
      dispatchCandidates,
      manualRequiredVerifications,
      manualOptionalVerifications,
      dispatchBlockers,
    }),
    dispatch_candidates: dispatchCandidates,
    manual_required_verifications: manualRequiredVerifications,
    manual_optional_verifications: manualOptionalVerifications,
    dispatch_blockers: dispatchBlockers,
  };
}

module.exports = {
  DEFAULT_GENERATED_AT,
  buildPrerequisiteRuntimeState,
  buildVerifierDispatchPosture,
  buildVerifierHintsFromRegistry,
  buildVerifierRegistry,
};
