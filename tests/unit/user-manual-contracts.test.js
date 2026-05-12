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
    expect(standardsGuide).toContain('$spec-standards --repo <child>');
    expect(standardsGuide).toContain('父 workspace 无参数默认运行会写每个 discovered child repo 的 `<child>/.spec-first/standards/` baseline facts');
    expect(standardsGuide).toContain('只有显式 `$spec-standards --workspace` 才会写父级 `.spec-first/standards/` advisory artifacts');
    expect(standardsGuide).toContain('不是任何 child repo 的 confirmed standards baseline');
    expect(standardsGuide).toContain('node skills/spec-standards/scripts/prepare-baseline.js --quick');
    expect(standardsGuide).toContain('node skills/spec-standards/scripts/prepare-baseline.js --workspace');
    expect(standardsGuide).toContain('node skills/spec-standards/scripts/validate-artifacts.js --standards-dir .spec-first/standards --json');
    expect(standardsGuide).toContain('trust_level=degraded');
    expect(standardsGuide).toContain('consumption_boundary=advisory_only');
    expect(standardsGuide).toContain('workspace-advisory-only');
    expect(standardsGuide).toContain('validator 只检查 artifact handoff contract');
    expect(standardsGuide).toContain('validator pass 是 trusted baseline 的完成标准');
    expect(standardsGuide).toContain('不要为了消除诊断而改写 contract heading、candidate id、命令名、路径、工具名或作者名');
    expect(standardsGuide).toContain('`advisory` 不是 candidate status，只是消费模式');
    expect(standardsGuide).toContain('standards-update-decision.json');
    expect(standardsGuide).toContain('graph-query-index.json');
    expect(standardsGuide).toContain('import-lock.json');
    expect(standardsGuide).toContain('下游 workflow 只能把 `confirmed` standards 当作硬约束');
    expect(standardsGuide).toContain('`glue-map.json` 只用于 reuse-first 判断');
    expect(standardsGuide).toContain('docs/examples/standards-glue-consumption-examples.md');
    expect(standardsGuide).toContain('不是新的 schema、生成产物或规则引擎');
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
    expect(gitignoreGuide).toContain('在父 workspace 且检测到多个 child Git repos 时，`init` 默认进入 all-child maintenance');
    expect(gitignoreGuide).toContain('父目录不写 `.gitignore`、`AGENTS.md`、`CLAUDE.md`');
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
    expect(guide).toContain('`spec-graph-impact-reviewer` 是建议新增的条件触发 reviewer');
    expect(guide).toContain('计划落地后的默认行为');
    expect(guide).toContain('将默认评估是否需要 `spec-graph-impact-reviewer`');
    expect(guide).toContain('不是 always-on reviewer');
    expect(guide).toContain('默认评估、条件派发');
    expect(guide).toContain('Scripts prepare, LLM decides');
    expect(guide).toContain('`.spec-first/impact/bootstrap-impact-capabilities.json`');
  });

  test('user manual documents explicit graph refresh trigger boundaries', () => {
    const manual = read(USER_MANUAL_README_PATH);
    const quickstart = read(QUICKSTART_PATH);
    const concepts = read(CORE_CONCEPTS_PATH);
    const artifactMap = read(ARTIFACT_MAP_PATH);
    const bestPractices = read(BEST_PRACTICES_PATH);

    expect(manual).toContain('自动 freshness check，显式 graph-bootstrap refresh');
    expect(manual).toContain('`spec-mcp-setup` 只刷新 setup-owned provider projection');
    expect(manual).toContain('`spec-graph-bootstrap` 才写 canonical `.spec-first/graph/*`');
    expect(manual).toContain('切换分支、pull、rebase、merge、dirty worktree 变化或 provider fingerprint mismatch');
    expect(manual).toContain('不会自动运行 GitNexus analyze、provider repair、默认 hooks、watchers 或 daemons');
    expect(manual).toContain('graph-heavy 任务再显式运行 `spec-graph-bootstrap`');

    expect(quickstart).toContain('Graph refresh 触发节点可以按这张表理解');
    expect(quickstart).toContain('需要当前 GitNexus / code-review-graph readiness');
    expect(quickstart).toContain('不会自动 rebuild index');
    expect(quickstart).toContain('shared API/route/provider contract、core workflow、跨模块变更或高风险 review');

    expect(concepts).toContain('`spec-graph-bootstrap` 才是显式 graph readiness refresh 入口');
    expect(concepts).toContain('不是自动 rebuild index trigger');
    expect(concepts).toContain('graph-backed impact / execution-flow evidence');
    expect(artifactMap).toContain('只有 `spec-graph-bootstrap` 显式刷新 canonical graph readiness artifacts');
    expect(bestPractices).toContain('旧 graph facts 当 stale / bootstrap-required signal');
    expect(bestPractices).toContain('隐藏运行 GitNexus analyze、provider repair、默认 hooks、watchers 或 daemons');
  });

  test('FAQ covers Win64-native and cross-platform troubleshooting', () => {
    const faq = read(FAQ_PATH);

    expect(faq).toContain('Win64 原生环境');
    expect(faq).toContain('Get-Command spec-first');
    expect(faq).toContain('where spec-first');
    expect(faq).toContain('npm prefix -g');
    expect(faq).toContain('%APPDATA%\\npm');
    expect(faq).toContain('-ExecutionPolicy Bypass');
    expect(faq).toContain('Windows PowerShell 5.1');
    expect(faq).toContain('chcp 65001');
    expect(faq).toContain('npm cache clean --force');
    expect(faq).toContain('better-sqlite3');
    expect(faq).toContain('MAX_PATH');
    expect(faq).toContain('git config --global core.longpaths true');
    expect(faq).toContain('Git Bash、MSYS2 和 WSL');
    expect(faq).toContain('CI=true NO_COLOR=1 spec-first doctor');
    expect(faq).toContain('.spec-first/providers/');
    expect(faq).toContain('provider raw log');
  });

  test('user manual distinguishes temporary code-review handoff from durable summaries', () => {
    const artifactMap = read(ARTIFACT_MAP_PATH);
    const artifactCatalog = read(ARTIFACT_CATALOG_PATH);

    for (const content of [artifactMap, artifactCatalog]) {
      expect(content).toContain('<os-temp>/spec-first/spec-code-review/<run-id>/');
      expect(content).toContain('Windows `%TEMP%`');
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
