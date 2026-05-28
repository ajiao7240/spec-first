'use strict';

const fs = require('node:fs');
const path = require('node:path');

function atomicWriteNoClobber(filePath, content) {
  if (fs.existsSync(filePath)) {
    const error = new Error(`refusing to clobber existing temp artifact: ${filePath}`);
    error.reason_code = 'temp_artifact_exists';
    throw error;
  }
  atomicWrite(filePath, content, false);
}

function atomicWriteAllowReplace(filePath, content) {
  atomicWrite(filePath, content, true);
}

function atomicWrite(filePath, content, allowReplace) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, content, 'utf8');
  if (!allowReplace && fs.existsSync(filePath)) {
    fs.rmSync(tmp, { force: true });
    const error = new Error(`refusing to clobber existing temp artifact: ${filePath}`);
    error.reason_code = 'temp_artifact_exists';
    throw error;
  }
  fs.renameSync(tmp, filePath);
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function safeReadJsonFile(filePath) {
  try {
    return { ok: true, value: readJsonFile(filePath) };
  } catch (error) {
    return { ok: false, error };
  }
}

function tryReadJson(filePath) {
  return safeReadJsonFile(filePath);
}

function fileSize(filePath) {
  return fs.statSync(filePath).size;
}

function safeFileSize(filePath) {
  try {
    return { ok: true, size: fileSize(filePath) };
  } catch (error) {
    return { ok: false, error };
  }
}

function safeLstat(filePath) {
  try {
    return fs.lstatSync(filePath);
  } catch (_error) {
    return null;
  }
}

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch (_error) {
    return null;
  }
}

function safeRealpath(filePath) {
  try {
    return fs.realpathSync.native(filePath);
  } catch (_error) {
    return null;
  }
}

function pathHasSymlink(repoRoot, relPath) {
  const segments = relPath.split('/');
  let current = repoRoot;
  for (const segment of segments) {
    current = path.join(current, segment);
    const lstat = safeLstat(current);
    if (lstat && lstat.isSymbolicLink()) return true;
  }
  return false;
}

function isInsidePath(rootPath, candidatePath) {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(root, candidate);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function indent(value) {
  return String(value).split(/\r?\n/).map((line) => `  ${line}`).join('\n');
}

function errorPayload(code, message) {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}

function writeJson(stream, payload) {
  stream.write(`${JSON.stringify(payload, null, 2)}\n`);
}

module.exports = {
  atomicWriteNoClobber,
  atomicWriteAllowReplace,
  readJsonFile,
  safeReadJsonFile,
  tryReadJson,
  safeFileSize,
  safeLstat,
  safeStat,
  safeRealpath,
  pathHasSymlink,
  isInsidePath,
  xmlEscape,
  indent,
  errorPayload,
  writeJson,
};
