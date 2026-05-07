'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { getSpecFirstGitignorePatterns } = require('../../src/cli/gitignore-policy');

const REPO_ROOT = path.join(__dirname, '..', '..');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');
const README_EN_PATH = path.join(REPO_ROOT, 'README.md');
const README_ZH_PATH = path.join(REPO_ROOT, 'README.zh-CN.md');
const USER_MANUAL_README_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/README.md');
const QUICKSTART_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/01-快速开始.md');
const CORE_CONCEPTS_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/02-核心概念.md');
const ARTIFACT_MAP_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/04-workflows-artifacts-map.md');
const FAQ_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/04-常见问题.md');
const BEST_PRACTICES_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/05-最佳实践.md');
const LOCAL_INSTALL_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/06-本地源码安装.md');
const ARTIFACT_CATALOG_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/10-产物目录.md');
const STANDARDS_GUIDE_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/11-项目规范与胶水基线.md');
const GITIGNORE_GUIDE_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/12-gitignore参考.md');
const GRAPH_PROVIDER_SCOPE_GUIDE_PATH = path.join(REPO_ROOT, 'docs/05-用户手册/13-代码图谱Provider作用域与差异化.md');
const SPEC_IDEATE_SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-ideate/SKILL.md');

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

  test('user manual documents spec-app-consistency-audit entrypoints and artifact boundaries', () => {
    const manual = read(USER_MANUAL_README_PATH);
    const quickstart = read(QUICKSTART_PATH);
    const concepts = read(CORE_CONCEPTS_PATH);
    const artifactMap = read(ARTIFACT_MAP_PATH);
    const artifactCatalog = read(ARTIFACT_CATALOG_PATH);

    for (const content of [manual, quickstart, concepts]) {
      expect(content).toContain('spec-app-consistency-audit');
      expect(content).toContain('/spec:app-consistency-audit');
      expect(content).toContain('$spec-app-consistency-audit');
    }
    expect(manual).toContain('figma-context:<path>');
    expect(concepts).toContain('figma-ref:<id-or-url>');
    expect(concepts).toContain('Figma MCP 属于宿主可选能力');
    expect(artifactMap).toContain('.spec-first/app-audit/runs/<run-id>/');
    expect(artifactMap).toContain('app-consistency-audit.md');
    expect(artifactCatalog).toContain('.spec-first/app-audit/');
    expect(artifactCatalog).toContain('Figma ref 不等于 materialized evidence');
  });

  test('user manual includes a standalone spec-standards guide', () => {
    const manual = read(USER_MANUAL_README_PATH);
    const quickstart = read(QUICKSTART_PATH);
    const artifactMap = read(ARTIFACT_MAP_PATH);
    const standardsGuide = read(STANDARDS_GUIDE_PATH);

    expect(manual).toContain('[项目规范与胶水基线](./11-项目规范与胶水基线.md)');
    expect(quickstart).toContain('[`spec-standards`](./11-项目规范与胶水基线.md)');
    expect(artifactMap).toContain('[项目规范与胶水基线](./11-项目规范与胶水基线.md)');
    expect(standardsGuide).toContain('$spec-standards --quick');
    expect(standardsGuide).toContain('$spec-standards --refresh --domain cli');
    expect(standardsGuide).toContain('$spec-standards --deep');
    expect(standardsGuide).toContain('$spec-standards --baseline --import-source ../shared-standards');
    expect(standardsGuide).toContain('node skills/spec-standards/scripts/prepare-baseline.js --quick');
    expect(standardsGuide).toContain('node skills/spec-standards/scripts/validate-artifacts.js --standards-dir .spec-first/standards --json');
    expect(standardsGuide).toContain('trust_level=degraded');
    expect(standardsGuide).toContain('validator 只检查 artifact handoff contract');
    expect(standardsGuide).toContain('validator pass 是 trusted baseline 的完成标准');
    expect(standardsGuide).toContain('不要为了消除诊断而改写 contract heading、candidate id、命令名、路径、工具名或作者名');
    expect(standardsGuide).toContain('`advisory` 不是 candidate status，只是消费模式');
    expect(standardsGuide).toContain('standards-update-decision.json');
    expect(standardsGuide).toContain('graph-query-index.json');
    expect(standardsGuide).toContain('import-lock.json');
    expect(standardsGuide).toContain('下游 workflow 只能把 `confirmed` standards 当作硬约束');
    expect(standardsGuide).toContain('`glue-map.json` 只用于 reuse-first 判断');
    expect(standardsGuide).toContain('不要手改 `.claude/`、`.codex/` 或 `.agents/skills/` runtime mirror');
  });

  test('user manual documents init-managed gitignore policy boundaries', () => {
    const manual = read(USER_MANUAL_README_PATH);
    const gitignoreGuide = read(GITIGNORE_GUIDE_PATH);

    expect(manual).toContain('[Gitignore 参考](./12-gitignore参考.md)');
    expect(manual).toContain('`init` 自动维护的 `.gitignore` spec-first managed block');
    expect(gitignoreGuide).toContain('`spec-first init --claude|--codex` 会在当前目标项目的 `.gitignore` 中自动写入或更新');
    expect(gitignoreGuide).toContain('`init --dry-run` 会预览这次写入');
    expect(gitignoreGuide).toContain('# spec-first:start');
    expect(gitignoreGuide).toContain('.claude/commands/spec/');
    expect(gitignoreGuide).toContain('.agents/skills/');
    expect(gitignoreGuide).toContain('.spec-first/standards/');
    expect(gitignoreGuide).toContain('`init` 不会递归修改多仓 workspace 里的所有 child repo');
    expect(gitignoreGuide).toContain('不要默认加入');
    expect(gitignoreGuide).toContain('`*.tgz` 是本地打包产物');
    for (const pattern of getSpecFirstGitignorePatterns()) {
      expect(gitignoreGuide).toContain(pattern);
    }
  });

  test('user manual explains graph provider scope and differentiation', () => {
    const manual = read(USER_MANUAL_README_PATH);
    const guide = read(GRAPH_PROVIDER_SCOPE_GUIDE_PATH);

    expect(manual).toContain('[代码图谱 Provider 作用域与差异化](./13-代码图谱Provider作用域与差异化.md)');
    expect(guide).toContain('GitNexus = 全局代码知识');
    expect(guide).toContain('code-review-graph = 当前变更的 review evidence');
    expect(guide).toContain('核心竞争力不是“接入了两个代码图谱工具”');
    expect(guide).toContain('GitNexus 在 spec-first 中的角色是 `global_knowledge`');
    expect(guide).toContain('`code-review-graph` 在 spec-first 中的角色是 `impact_context`');
    expect(guide).toContain('这个设计故意不把 `code-review-graph` 包装成 agent');
    expect(guide).toContain('Scripts prepare, LLM decides');
    expect(guide).toContain('`.spec-first/impact/bootstrap-impact-capabilities.json`');
  });

  test('user manual distinguishes temporary code-review handoff from durable summaries', () => {
    const artifactMap = read(ARTIFACT_MAP_PATH);
    const artifactCatalog = read(ARTIFACT_CATALOG_PATH);

    for (const content of [artifactMap, artifactCatalog]) {
      expect(content).toContain('/tmp/spec-first/spec-code-review/<run-id>/');
      expect(content).toContain('session/orchestrator handoff');
      expect(content).toContain('docs/residual-review-findings/<branch-or-head-sha>.md');
      expect(content).toContain('Known Residuals');
    }
    expect(artifactMap).toContain('不默认把 full-detail per-reviewer JSON bundle 复制进 `docs/` 或 `.spec-first/`');
  });

  test('user manual catalogs ideation artifacts as durable docs before brainstorm', () => {
    const englishReadme = read(README_EN_PATH);
    const chineseReadme = read(README_ZH_PATH);
    const artifactMap = read(ARTIFACT_MAP_PATH);
    const artifactCatalog = read(ARTIFACT_CATALOG_PATH);
    const ideateSkill = read(SPEC_IDEATE_SKILL_PATH);

    expect(ideateSkill).toContain('This workflow produces a ranked ideation artifact in `docs/ideation/`.');
    expect(ideateSkill).toContain('It does **not** produce requirements, plans, or code.');

    for (const content of [englishReadme, chineseReadme, artifactMap, artifactCatalog]) {
      expect(content).toContain('docs/ideation/');
      expect(content).toContain('/spec:ideate');
      expect(content).toContain('$spec-ideate');
    }

    expect(artifactMap).toContain('docs/ideation/*-ideation.md');
    expect(artifactMap).toContain('不是 requirements、plan 或代码');
    expect(artifactCatalog).toContain('候选想法、批判、排序和拒绝理由');
    expect(englishReadme).toContain('| Generate and rank ideas | `/spec:ideate` | `$spec-ideate` | Ideation artifact under `docs/ideation/` |');
    expect(chineseReadme).toContain('| 生成并排序想法 | `/spec:ideate` | `$spec-ideate` | `docs/ideation/` 下的 ideation artifact |');
  });
});
