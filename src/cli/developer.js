const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROJECT_DEVELOPER_RELATIVE_PATH = path.join('.claude', 'spec-first', '.developer');
const GLOBAL_DEVELOPER_RELATIVE_PATH = path.join('.spec-first', '.developer');
const PROJECT_VERSION = require('../../package.json').version;
const SUPPORTED_LANGS = new Set(['zh', 'en']);

function getProjectDeveloperPath(projectRoot) {
  return path.join(projectRoot, PROJECT_DEVELOPER_RELATIVE_PATH);
}

function getGlobalDeveloperPath() {
  return path.join(os.homedir(), GLOBAL_DEVELOPER_RELATIVE_PATH);
}

function readDeveloperFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const contents = fs.readFileSync(filePath, 'utf8');
  return parseDeveloperContents(contents);
}

function parseDeveloperContents(contents) {
  if (typeof contents !== 'string') {
    return null;
  }

  const developer = {};
  for (const line of contents.split(/\r?\n/)) {
    if (!line || line.trim().length === 0) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key || !value) {
      continue;
    }

    developer[key] = value;
  }

  return normalizeDeveloper(developer);
}

function resolveDeveloperIdentity(projectRoot, options = {}) {
  const explicitName = normalizeName(options.user);
  const explicitLang = normalizeLang(options.lang);
  const globalDeveloper = readDeveloperFile(getGlobalDeveloperPath());
  const gitUserName = readGitUserName(projectRoot);

  const name = explicitName || (globalDeveloper && globalDeveloper.name) || gitUserName;
  const lang = explicitLang || (globalDeveloper && globalDeveloper.lang) || 'zh';

  if (!name) {
    throw new Error(
      'Unable to determine developer name. Pass `-u/--user <name>` or initialize ~/.spec-first/.developer with `spec-first init --global -u <name> --lang <zh|en>`.',
    );
  }

  if (!SUPPORTED_LANGS.has(lang)) {
    throw new Error(`Unsupported developer language: ${lang}. Expected zh or en.`);
  }

  return {
    name,
    lang,
    initializedAt: new Date().toISOString(),
    version: PROJECT_VERSION,
  };
}

function writeDeveloperFile(projectRoot, developer) {
  const filePath = getProjectDeveloperPath(projectRoot);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, formatDeveloperContents(developer), 'utf8');
}

function removeDeveloperFile(projectRoot) {
  fs.rmSync(getProjectDeveloperPath(projectRoot), { force: true });
}

function formatDeveloperContents(developer) {
  const normalized = normalizeDeveloper(developer);
  if (!normalized) {
    throw new Error('Developer record must be a non-empty object.');
  }

  const lines = [
    `name=${normalized.name}`,
    `lang=${normalized.lang}`,
    `initialized_at=${normalized.initializedAt}`,
    `version=${normalized.version}`,
  ];
  return `${lines.join('\n')}\n`;
}

function normalizeDeveloper(raw) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const name = normalizeName(safe.name);
  const lang = normalizeLang(safe.lang);
  const initializedAt = normalizeText(safe.initializedAt || safe.initialized_at);
  const version = normalizeText(safe.version);

  if (!name && !lang && !initializedAt && !version) {
    return null;
  }

  return {
    name: name || '',
    lang: lang || '',
    initializedAt: initializedAt || '',
    version: version || '',
  };
}

function normalizeName(value) {
  const text = normalizeText(value);
  return text || '';
}

function normalizeLang(value) {
  const text = normalizeText(value);
  return text || '';
}

function normalizeText(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';
}

function readGitUserName(projectRoot) {
  const result = spawnSync('git', ['config', 'user.name'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    return '';
  }

  return normalizeText(result.stdout);
}

module.exports = {
  formatDeveloperContents,
  getGlobalDeveloperPath,
  getProjectDeveloperPath,
  readDeveloperFile,
  readGitUserName,
  removeDeveloperFile,
  resolveDeveloperIdentity,
  writeDeveloperFile,
};
