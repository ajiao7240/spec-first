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
    timeoutMs = 350,
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

async function defaultLookupLatestVersion(packageName, options = {}) {
  const override = normalizeOverride(process.env.SPEC_FIRST_VERSION_REMINDER_LATEST);
  if (override) {
    return override;
  }

  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 350;
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
  defaultLookupLatestVersion,
  formatVersionReminder,
  maybeShowVersionReminder,
  shouldNotifyVersionReminder,
};
