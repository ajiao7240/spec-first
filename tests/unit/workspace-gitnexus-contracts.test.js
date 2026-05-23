'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const CONTRACT_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'workspace-gitnexus-consumption.md');
const PROVIDER_CONTRACT_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'graph-provider-consumption.md');
const EVIDENCE_POLICY_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'graph-evidence-policy.md');
const WORKFLOW_CONSUMER_PATHS = [
  'skills/spec-plan/SKILL.md',
  'skills/spec-work/SKILL.md',
  'skills/spec-work-beta/SKILL.md',
  'skills/spec-debug/SKILL.md',
  'skills/spec-code-review/SKILL.md',
];
const NO_GROUP_SYNC_AUTOMATION_PATHS = [
  'skills/spec-work/SKILL.md',
  'skills/spec-work-beta/SKILL.md',
  'skills/spec-debug/SKILL.md',
  'skills/spec-code-review/SKILL.md',
];

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

describe('workspace GitNexus consumption contract', () => {
  test('defines topology gate without persisting semantic development mode', () => {
    const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');

    expect(contract).toContain('`git_root_topology` 是 artifact 层唯一 topology 字段');
    expect(contract).toContain('`single-repo`');
    expect(contract).toContain('`multi-repo-workspace`');
    expect(contract).toContain('Blocked target-resolution 状态必须输出 `git_root_topology: null`');
    expect(contract).toContain('`workspace-no-git-candidates`');
    expect(contract).toContain('`workspace-single-candidate`');
    expect(contract).toContain('三种开发模式');
    expect(contract).toContain('不是 artifact 字段，不是 classifier 输入，也不是 classifier 输出');
    expect(contract).toContain('monorepo packages/modules 不是 GitNexus group members');
    expect(contract).toContain('只有 `git_root_topology="multi-repo-workspace"` 允许 workspace group / registry fan-out');
  });

  test('pins group shape and the three readiness axes', () => {
    const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');

    expect(contract).toContain('`group` 是嵌套对象，不是顶层 snake_case 字段');
    expect(contract).toContain('group: { name: string|null, status: "group-ready"|"group-missing"|"group-sync-required"|"unavailable"|"not-evaluated-no-mcp-input", query_selector: string|null }');
    expect(contract).toContain('`group` 对象不得携带 `reason_code` 等额外字段');
    expect(contract).toContain('`group_reason_code: string|null`');
    expect(contract).toContain('禁止写顶层 `group_status`');
    expect(contract).toContain('durable script-mode artifact 的 `query_usability_counts` 只能包含四个 key');
    expect(contract).toContain('不得写入 durable artifact counts');
    expect(contract).toContain('JSON 字段名使用 snake_case，枚举值使用 kebab-case，嵌套路径使用点号');
    expect(contract).toContain('`refresh_eligibility`');
    expect(contract).toContain('`index_snapshot`');
    expect(contract).toContain('`query_usability`');
  });

  test('separates dirty refresh blocking from stale advisory query use', () => {
    const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');

    expect(contract).toContain('`dirty-source-blocked` 是 legacy refresh result，不是 query result');
    expect(contract).toContain('当前 graph-affecting dirty refresh 以 `dirty-advisory` / warn-and-continue 写入降级证据');
    expect(contract).toContain('read-only `stale-advisory` evidence');
    expect(contract).toContain('`provider-status.v1.last_indexed_commit != null`');
    expect(contract).toContain('prior query-ready proof 的唯一可观测代理');
    expect(contract).toContain('`repo_snapshot.source_revision` 与 `bootstrap_fingerprint.repo_snapshot.source_revision`');
    expect(contract).toContain('`last_indexed_commit=null` 且本轮 `query_ready=false`');
    expect(contract).toContain('不得归为 `stale-advisory` 或 `fresh-primary`');
    expect(contract).toContain('`group.status="group-missing"`：不是 provider failure');
    expect(contract).toContain('`group.status="group-sync-required"`');
    expect(contract).toContain('`group.status="unavailable"`');
    expect(contract).toContain('plan/work/debug/review 不得静默运行 `group_sync`');
    expect(contract).toContain('Read-only group resources are first-class evidence surfaces');
    expect(contract).toContain('`gitnexus://group/{name}/contracts`');
    expect(contract).toContain('`gitnexus://group/{name}/status`');
    expect(contract).toContain('`live-mcp-resource` / `session-local-inference` provenance');
  });

  test('links provider and evidence policy contracts to workspace GitNexus rules', () => {
    const provider = fs.readFileSync(PROVIDER_CONTRACT_PATH, 'utf8');
    const policy = fs.readFileSync(EVIDENCE_POLICY_PATH, 'utf8');

    expect(provider).toContain('docs/contracts/workspace-gitnexus-consumption.md');
    expect(provider).toContain('`workspace-gitnexus-readiness.v1`');
    expect(provider).toContain('`provider-status.v1.last_indexed_commit != null`');
    expect(provider).toContain('不得维护额外历史断言持久层');
    expect(provider).toContain('`refresh_eligibility`、`index_snapshot` 和 `query_usability`');
    expect(policy).toContain('docs/contracts/workspace-gitnexus-consumption.md');
    expect(policy).toContain('`group_missing` 不是 provider failure');
    expect(policy).toContain('dirty-advisory 或 legacy dirty refresh blocked 也不等于 query unusable');
  });

  test('downstream consumers do not collapse dirty refresh blocked into query unavailable', () => {
    for (const filePath of WORKFLOW_CONSUMER_PATHS) {
      const text = read(filePath);

      expect(text).not.toContain('dirty refresh blocked = query unavailable');
      expect(text).not.toContain('dirty-source-blocked means query unavailable');
      expect(text).not.toContain('dirty-source-blocked means GitNexus unavailable');
      expect(text).toContain('bounded direct');
    }
  });

  test('group_sync stays out of downstream consumer workflows', () => {
    for (const filePath of NO_GROUP_SYNC_AUTOMATION_PATHS) {
      expect(read(filePath)).not.toContain('group_sync');
    }

    const planSkill = read('skills/spec-plan/SKILL.md');
    const planGraphEvidencePosture = read('skills/spec-plan/references/graph-evidence-posture.md');
    expect(planSkill).toContain('workspace_group_sync');
    expect(planSkill).toContain('mutation-gated');
    expect(planGraphEvidencePosture).toContain('requires explicit user action');
    expect(planGraphEvidencePosture).toContain('must not become automatic implementation units');

    expect(read('skills/spec-graph-bootstrap/SKILL.md')).toContain('Do not run `group_sync` automatically');
  });

  test('spec-plan carries multi-repo evidence posture without changing write scope', () => {
    const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');

    expect(contract).toContain('`$spec-plan` Evidence Posture Requirements');
    expect(contract).toContain('registry evidence、group evidence、per-repo `query_usability`');
    expect(contract).toContain('dirty/stale limitations');
    expect(contract).toContain('写入前 `target_repo` / per-child scope 要求');
    expect(contract).toContain('bounded registry/per-repo fallback');
    expect(contract).toContain('GitNexus 发现的额外 repo、symbol、route 或 flow 只能作为 risk / follow-up / test-candidate evidence');
    expect(contract).toContain('implementation scope 仍由用户请求、origin requirements、plan/task pack、当前 git diff 和显式 `target_repo` / per-unit repo scope 决定');
    expect(contract).toContain('`workspace_group_sync`');
    expect(contract).toContain('`symbol_rename`');
    expect(contract).toContain('`mutation-gated` / `requires explicit user action`');
    expect(contract).toContain('不得在 plan/work/debug/review 中成为自动 implementation unit');
  });

  test('graph bootstrap handoff separates child refresh and query usability summaries', () => {
    const skill = read('skills/spec-graph-bootstrap/SKILL.md');

    expect(skill).toContain('top-level `group_reason_code`');
    expect(skill).toContain('overlay-only query usability count keys');
    expect(skill).toContain('`group.status="group-missing"` / `group-sync-required`');
    expect(skill).toContain('`group.status="unavailable"`');
    expect(skill).toContain('Use two separate tables');
    expect(skill).toContain('`Child refresh status`');
    expect(skill).toContain('`GitNexus query usability`');
  });

  test('workspace artifacts and fixtures do not carry retired development_mode field', () => {
    const artifactTexts = [
      read('docs/contracts/workspace-gitnexus-consumption.md'),
      ...fs.readdirSync(path.join(REPO_ROOT, 'tests', 'fixtures', 'gitnexus-workspace'))
        .filter((fileName) => fileName.endsWith('.json'))
        .map((fileName) => fs.readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', 'gitnexus-workspace', fileName), 'utf8')),
    ];

    for (const text of artifactTexts) {
      expect(text).not.toContain('"development_mode"');
    }
  });
});
