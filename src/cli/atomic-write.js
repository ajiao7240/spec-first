const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function createAtomicTempPath(filePath) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const suffix = crypto.randomBytes(6).toString('hex');
  return path.join(dir, `.${base}.${process.pid}.${Date.now()}.${suffix}.tmp`);
}

function writeFileAtomic(filePath, contents, encoding = 'utf8') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = createAtomicTempPath(filePath);
  try {
    fs.writeFileSync(tmpPath, contents, encoding);
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    fs.rmSync(tmpPath, { force: true });
    throw error;
  }
}

module.exports = {
  createAtomicTempPath,
  writeFileAtomic,
};
