'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');
const USER_MANUAL_README_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/README.md');
const QUICKSTART_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/01-快速开始.md');
const CORE_CONCEPTS_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/02-核心概念.md');
const ARTIFACT_MAP_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/04-workflows-artifacts-map.md');
const FAQ_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/04-常见问题.md');
const BEST_PRACTICES_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/05-最佳实践.md');
const LOCAL_INSTALL_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/06-本地源码安装.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('user manual contracts', () => {
  test('manual version line follows package version', () => {
    const pkg = JSON.parse(read(PACKAGE_JSON_PATH));
    const manual = read(USER_MANUAL_README_PATH);

    expect(manual).toContain(`当前版本线：\`v${pkg.version}\``);
  });

  test('user manual documents spec-skill-audit entrypoints and audit artifacts', () => {
    const manual = read(USER_MANUAL_README_PATH);
    const quickstart = read(QUICKSTART_PATH);
    const concepts = read(CORE_CONCEPTS_PATH);
    const artifactMap = read(ARTIFACT_MAP_PATH);
    const faq = read(FAQ_PATH);
    const bestPractices = read(BEST_PRACTICES_PATH);
    const localInstall = read(LOCAL_INSTALL_PATH);

    for (const content of [manual, quickstart, concepts, faq, localInstall]) {
      expect(content).toContain('spec-skill-audit');
    }
    expect(quickstart).toContain('/spec:skill-audit');
    expect(quickstart).toContain('$spec-skill-audit');
    expect(quickstart).toContain('node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo .');
    expect(concepts).toContain('scorecard 是 review signal，不是 release gate');
    expect(concepts).toContain('promise-implementation-report.json');
    expect(concepts).toContain('counter-evidence');
    expect(artifactMap).toContain('.spec-first/audits/skill-audit/');
    expect(artifactMap).toContain('skill-audit-summary.md');
    expect(artifactMap).toContain('promise-implementation-report.json');
    expect(faq).toContain('.spec-first/audits/` 是 gitignored 执行产物');
    expect(faq).toContain('signal、evidence、counter-evidence、decision');
    expect(bestPractices).toContain('把 `.spec-first/graph/` 和 `.spec-first/audits/`');
    expect(localInstall).toContain('.agents/skills/spec-skill-audit/');
  });
});
