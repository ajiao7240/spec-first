# 知识库管理全流程 ASCII 图

> 源文档：`2026-04-07-spec-docs-independent-knowledge-repo-technical-spec.md`
> 生成日期：2026-04-07

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        知识库管理全流程                                       ║
╚══════════════════════════════════════════════════════════════════════════════╝

 ┌─────────────────────────────────────────────────────────────────────────┐
 │  一、配置绑定（spec-first init）                                          │
 └─────────────────────────────────────────────────────────────────────────┘

  $ spec-first init --docs-repo <url> --docs-local-path <path> [--global]
         │
         ├─ detectWorkspace(cwd)
         │       │
         │  ┌────▼──────────┐       ┌────────────────────┐
         │  │ workspace模式  │       │   single模式        │
         │  │ (pnpm/npm/…)  │       │   (单项目)          │
         │  └────┬──────────┘       └────────┬───────────┘
         │       │                           │
         │  discoverProjects                 │
         │  resolveSlugs (冲突检测)           │
         │       │                           │
         └───────┴───────────────────────────┘
                 │
         resolveDocsConfig()  ── 优先级链 ──────────────────────────────────┐
                 │                                                           │
         ┌───── ▼ ──────────────────────────────────────────────────┐       │
         │  CLI参数  >  project state.json  >  workspace state.json  │       │
         │             >  global config.json  >  in-repo fallback    │       │
         └───── ┬ ──────────────────────────────────────────────────┘       │
                │                                                            │
         validateLocalPath(localPath)  ←── git rev-parse --git-dir          │
         git pull --ff-only（init专用）                                      │
                │                                                            │
         ┌──────▼──────────────────────────────────────┐                    │
         │         写入各配置文件                        │                    │
         │  ┌─────────────────────────────────────┐    │                    │
         │  │  ~/.spec-first/config.json           │ ← --global             │
         │  │    defaultDocsRepo: <url>            │    │                    │
         │  │    docsRepos: { url → localPath }    │    │                    │
         │  └─────────────────────────────────────┘    │                    │
         │  ┌─────────────────────────────────────┐    │                    │
         │  │  <project>/.claude/spec-first/       │    │                    │
         │  │    state.json (docsRepo + slug)      │    │                    │
         │  │    docs-local.json (localPath+slug)  │ ← 运行时快照(不commit)  │
         │  └─────────────────────────────────────┘    │                    │
         │  ┌─────────────────────────────────────┐    │                    │
         │  │  <workspace>/.spec-first/state.json  │    │                    │
         │  │    docsRepo / projects[]             │    │                    │
         │  └─────────────────────────────────────┘    │                    │
         └──────┬──────────────────────────────────────┘                    │
                │                                                            │
         创建 spec-docs 目录骨架 + git commit + push                         │
                │                                                            │
         spec-docs/                                                          │
           └── <slug>/                                                       │
               ├── README.md (slug/project-path/created-at…)                │
               ├── contexts/     ← Phase 2 spec-bootstrap 写入               │
               └── solutions/    ← Phase 2 spec-compound 写入                │


 ┌─────────────────────────────────────────────────────────────────────────┐
 │  二、知识写入（产出层）                                                    │
 └─────────────────────────────────────────────────────────────────────────┘

                     项目代码库
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
   [spec-bootstrap]              [spec-compound]
    项目结构大改后触发            每次解决问题后触发
          │                             │
          ▼                             ▼
  contexts/ 全量刷新              solutions/ 新增条目
  ┌───────────────────┐         ┌───────────────────────┐
  │ 00-summary.md     │         │ build-errors/         │
  │ architecture/     │         │ test-failures/        │
  │  system-overview  │         │ runtime-errors/       │
  │  module-map       │         │ architecture-decisions│
  │  integration-bdry │         │ …(按问题类型分类)      │
  │ pitfalls/index.md │         └───────────┬───────────┘
  │ layers/<layer>/   │                     │
  │ database/er.md    │         frontmatter: slug / problem_type /
  └────────┬──────────┘           severity / confidence /
           │                       affected_modules /
  frontmatter:                     source_commit /
    slug / source_commit /         created_at / updated_at
    updated_at /
    generated_by: spec-bootstrap
           │                             │
           └──────────────┬──────────────┘
                          ▼
               spec-docs/<slug>/
               git add + commit + push
               (写入即生效，Phase 1 无发布门禁)


 ┌─────────────────────────────────────────────────────────────────────────┐
 │  三、知识消费（Agent 读取层）                                              │
 └─────────────────────────────────────────────────────────────────────────┘

  spec-plan / spec-work / spec-review 启动
          │
          ▼
  读 docs-local.json ──存在──► 得到 localPath + slug
          │                            │
         不存在                  localPath校验
          │                      ┌────┴────────────┐
          │                    有效              无效(目录不存在/非git)
          │                      │                  │
          │               读取顺序:          重走 resolveDocsConfig
          │           ┌──────────┴──────────┐       │
          │           │ 1. contexts/00-summary.md    │
          │           │    (快速定位项目)              │
          │           │ 2. contexts/architecture/    │
          │           │    module-map.md             │
          │           │    (模块边界)                 │
          │           │ 3. contexts/pitfalls/        │
          │           │    index.md (已知陷阱)         │
          │           │ 4. solutions/ 相关条目         │
          │           │    (复用历史经验)               │
          │           │ 5. 以上不足 → 回退代码分析       │
          │           └──────────┬──────────┘
          │                      │
          ▼              ┌───────▼────────────────┐
  WARNING: 知识库未配置  │  知识不足时的回退策略   │
  使用 in-repo docs/    ├────────────────────────┤
  (当前行为保持不变)     │ contexts/缺失 → 提示运行  │
                        │   spec-bootstrap        │
                        │ solutions/缺失 → 静默跳过 │
                        │ docs-local.json失效 →   │
                        │   WARNING+降级in-repo   │
                        └────────────────────────┘

  各 Skill 读取触发点:
  ┌───────────────┬───────────────────────────────────────────────┐
  │ Skill         │ 优先读取内容                                   │
  ├───────────────┼───────────────────────────────────────────────┤
  │ spec-plan     │ contexts/(项目理解) + solutions/(相似问题经验)  │
  │ spec-work     │ contexts/pitfalls/ + solutions/(相关经验)      │
  │ spec-review   │ contexts/architecture/ + solutions/(已知模式)  │
  │ spec-bootstrap│ 写入 contexts/ (生产方，不读)                  │
  │ spec-compound │ 写入 solutions/ (生产方，不读)                 │
  └───────────────┴───────────────────────────────────────────────┘


 ┌─────────────────────────────────────────────────────────────────────────┐
 │  四、知识维护（健康检查与陈旧检测）                                         │
 └─────────────────────────────────────────────────────────────────────────┘

  $ spec-first doctor
          │
          ├─ [现有检查，不变]
          │
          └─ checkDocsRepoHealth()
                  │
          ┌───────▼──────────────────────────────────────────┐
          │  1. docs-local.json存在?                          │
          │     否 → INFO: 未配置知识库                        │
          │                                                   │
          │  2. localPath有效?                                 │
          │     否 → ERROR                                    │
          │                                                   │
          │  3. 本地vs远端同步状态                              │
          │     git rev-list HEAD..@{u} --count               │
          │     落后N提交 → WARNING                            │
          │                                                   │
          │  4. <localPath>/<slug>/ 目录存在?                  │
          │     否 → WARNING: 建议重跑 init                    │
          │                                                   │
          │  5. contexts/00-summary.md 存在?                  │
          │     否 → INFO: 建议运行 spec-bootstrap             │
          │                                                   │
          │  6. 陈旧检测 (Phase 1 轻量)                        │
          │     source_commit = 00-summary.md frontmatter     │
          │     diff_count = git rev-list                     │
          │       <source_commit>..HEAD --count               │
          │                                                   │
          │     diff_count ≤ 50  → OK                         │
          │     diff_count > 50  → WARNING: 建议重跑bootstrap  │
          │     diff_count > 200 → ERROR: 严重陈旧             │
          │     source_commit不在历史中 → WARNING: 跳过计数     │
          └──────────────────────────────────────────────────┘


 ┌─────────────────────────────────────────────────────────────────────────┐
 │  五、知识生命周期（全貌）                                                  │
 └─────────────────────────────────────────────────────────────────────────┘

   spec-bootstrap/compound
    写入 contexts/solutions/
          │
          ▼
   commit + push
   到 spec-docs 仓库
          │
          ▼
  ┌───────────────┐
  │  知识库存储    │  ← 多项目共享，独立git仓库，支持非开发角色访问
  │  spec-docs/   │
  │  <slug>/      │
  └───────┬───────┘
          │
          ▼
  plan/work/review
  优先读取知识库
          │
          ▼
  doctor 巡检
  (source_commit + diff_count)
          │
     ┌────┴────────────────────┐
     │                         │
    新鲜                     陈旧
     │                         │
    继续使用              提示重跑 spec-bootstrap
                          或更新 solution
                               │
                    ┌──────────┴──────────────┐
                    │  Phase 2+: compound-refresh  │
                    │  标记 confidence: stale       │
                    │  合并重复条目                  │
                    │  _shared/ 跨项目共享           │
                    └──────────────────────────────┘
                               │
                    极端情况: 人工归档/删除
                    (spec-first 不自动删除)


 ┌─────────────────────────────────────────────────────────────────────────┐
 │  六、分阶段实施路线                                                        │
 └─────────────────────────────────────────────────────────────────────────┘

  Phase 1 (当前)          Phase 2              Phase 3           Phase 4
  ┌─────────────┐        ┌─────────────┐      ┌─────────────┐  ┌─────────────┐
  │ CLI基座      │───────►│ 产出接入     │─────►│ 消费接入    │─►│ 维护增强    │
  ├─────────────┤        ├─────────────┤      ├─────────────┤  ├─────────────┤
  │docs-config.js│       │spec-bootstrap│      │spec-plan    │  │ stale标记   │
  │workspace.js  │       │  写contexts/ │      │spec-work    │  │ compound-   │
  │state.js扩展  │       │spec-compound │      │spec-review  │  │  refresh    │
  │init.js扩展   │       │  写solutions/│      │  读知识库   │  │ _shared/    │
  │doctor.js扩展 │       │migrate-sol.  │      └─────────────┘  │ 跨项目共享  │
  │             │        │--docs-branch │                        └─────────────┘
  │skill不动     │        └─────────────┘
  │in-repo零变化 │
  └─────────────┘
```
