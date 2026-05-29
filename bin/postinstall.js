#!/usr/bin/env node

const { ensureSupportedNodeVersion } = require('../src/cli/node-version');
const pkg = require('../package.json');

if (!ensureSupportedNodeVersion()) {
  process.exitCode = 1;
} else {
  const { detectColorSupport, renderFullArt } = require('../src/cli/brand');

  process.stdout.write(`${renderFullArt(pkg.version, { useColor: detectColorSupport() })}
  安装完成

  下一步：spec-first doctor
        spec-first init
  详情：  spec-first -v
  说明：  managed assets 由 init/clean 管理，按 Claude/Codex host 生成

`);
}
