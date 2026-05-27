'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const TOOLS_JSON_PATH = path.join(REPO_ROOT, 'skills', 'spec-mcp-setup', 'mcp-tools.json');
const CATALOG_CONTRACT_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'gitnexus-capability-catalog.md');
const PLAN_TEMPLATE_PATH = path.join(
  REPO_ROOT,
  'skills',
  'spec-plan',
  'references',
  'plan-template.md',
);
const GRAPH_EVIDENCE_POSTURE_PATH = path.join(
  REPO_ROOT,
  'skills',
  'spec-plan',
  'references',
  'graph-evidence-posture.md',
);

const PUBLIC_SOURCE_TAGS = [
  'checked-in-baseline',
  'setup-projection',
  'provider-pin',
  'live-mcp-tool',
  'live-mcp-resource',
  'session-local-inference',
  'user-decision',
];

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('GitNexus capability catalog contract', () => {
  test('locks public source tag vocabulary and derived verification posture', () => {
    const contract = read(CATALOG_CONTRACT_PATH);
    const planTemplate = read(PLAN_TEMPLATE_PATH);
    const graphEvidencePosture = read(GRAPH_EVIDENCE_POSTURE_PATH);

    for (const tag of PUBLIC_SOURCE_TAGS) {
      expect(contract).toContain(tag);
      expect(graphEvidencePosture).toContain(tag);
    }

    expect(contract).toContain('公开 `source_tags[]` 是闭合词表');
    expect(planTemplate).toContain('- source_tags: [replace with applicable tags: checked-in-baseline, provider-pin, setup-projection, live-mcp-tool, live-mcp-resource, session-local-inference, user-decision]');
    expect(contract).toContain('verification posture 是派生判断');
    expect(contract).toContain('不是独立闭合 enum');
    expect(contract).toContain('host config、dependency readiness、workspace advisory');
    expect(contract).toContain('不得作为公共 `source_tags[]` 值出现');
    expect(contract).toContain('Setup projection 必须 fail closed');
    expect(contract).toContain('缺少 `checked-in-baseline` / `provider-pin`');
    expect(contract).toContain('Schema v6 不再接受 legacy `native_surfaces`');
    expect(contract).toContain('都是必填字段');
    expect(contract).toContain('setup 不得为缺失字段合成默认 registry facts');
    expect(contract).toContain('非空字符串元素组成的数组');
    expect(contract).toContain('至少有一个 candidate tool 或 read-only resource');
    expect(contract).toContain('`mutation_boundary` 只能是');
    expect(contract).toContain('不会伪造 `live-mcp-tool`、`live-mcp-resource`、`session-local-inference` 或 `user-decision`');
    expect(contract).toContain('`source_tag` singular 在 plan decision ledger');
    expect(contract).toContain('Harness Lane Classification');
    expect(contract).toContain('deterministic-helper');
    expect(contract).toContain('workflow-native-session');
    expect(contract).toContain('workspace-resource');
    expect(contract).toContain('mutation-gated-maintenance');
    expect(contract).toContain('Lane classification 不是 readiness truth');
  });

  test('README and README.zh-CN cross-reference Capability State Vocabulary (R14)', () => {
    const readmeEn = read(path.join(REPO_ROOT, 'README.md'));
    const readmeZh = read(path.join(REPO_ROOT, 'README.zh-CN.md'));

    for (const readme of [readmeEn, readmeZh]) {
      expect(readme).toContain('docs/contracts/gitnexus-capability-catalog.md');
      expect(readme).toContain('Capability State Vocabulary');
    }

    // Each README must surface at least the load-bearing lifecycle terms so
    // future README rewrites cannot silently drift away from the glossary.
    const requiredTerms = ['query_ready', 'definitions-only', 'dirty-advisory', 'session-local', 'setup-inferred'];
    for (const readme of [readmeEn, readmeZh]) {
      for (const term of requiredTerms) {
        expect(readme).toContain(term);
      }
    }
  });

  test('locks Capability State Vocabulary lifecycle terms (R1/R14)', () => {
    const contract = read(CATALOG_CONTRACT_PATH);

    expect(contract).toContain('## Capability State Vocabulary');
    expect(contract).toContain('区别于上文 "Source Tag Vocabulary"');
    expect(contract).toMatch(/其他 contract \/ skill prose \/ README \/[\s\n>]+startup snapshot 必须使用本节术语/);
    expect(contract).toContain('新增同义词需先扩展本表');

    const lifecycleTerms = [
      'host_config_written',
      'current_session_loaded',
      'graph_compiled',
      'query_ready',
      'definitions-only',
      'dirty-advisory',
      'graph-affecting-blocked',
      'stale',
      'session-local',
      'setup-inferred',
      'live-mcp-tool',
      'live-mcp-resource',
    ];
    for (const term of lifecycleTerms) {
      expect(contract).toContain(term);
    }

    expect(contract).toContain('`session-local` 是 raw 调用结果版本');
    expect(contract).toContain('LLM 基于这些 raw 结果做的本轮推断');
    expect(contract).toContain('`setup-projection` 是机读 source tag');
    expect(contract).toContain('`setup-inferred` 是其 prose 等价描述');

    expect(contract).toContain('词汇增删流程');
    expect(contract).toContain('Source tags `source_tags[]` 的 machine enum 仍由上文 "Source Tag Vocabulary" 章节负责');
  });

  test('keeps checked-in baseline semantic and candidate-only', () => {
    const toolsJson = JSON.parse(read(TOOLS_JSON_PATH));
    const gitnexus = toolsJson.tools.find((tool) => tool.id === 'gitnexus');
    const capabilities = gitnexus.provider_config.native_capabilities;

    expect(JSON.stringify(capabilities)).not.toContain('native_surfaces');

    expect(Object.keys(capabilities).sort()).toEqual([
      'context',
      'cypher',
      'impact',
      'query',
      'repo_registry',
      'route_api_evidence',
      'shape_check',
      'tool_map',
      'workspace_group',
    ]);

    for (const [name, capability] of Object.entries(capabilities)) {
      expect(Object.keys(capability).sort()).toEqual([
        'fallback_posture',
        'meaning',
        'mutation_boundary',
        'native_resources',
        'native_tools',
        'source_tags',
      ]);
      expect(capability.source_tags).toEqual(['checked-in-baseline', 'provider-pin']);
      expect(typeof capability.meaning).toBe('string');
      expect(capability.meaning.trim()).not.toBe('');
      expect(typeof capability.fallback_posture).toBe('string');
      expect(capability.fallback_posture.trim()).not.toBe('');
      expect(Array.isArray(capability.native_tools)).toBe(true);
      expect(Array.isArray(capability.native_resources)).toBe(true);
      expect(capability.native_tools.every((entry) => typeof entry === 'string' && entry.trim() !== '')).toBe(true);
      expect(capability.native_resources.every((entry) => typeof entry === 'string' && entry.trim() !== '')).toBe(true);
      expect(capability.native_tools.length + capability.native_resources.length).toBeGreaterThan(0);
      expect(['read-only', 'mutation-gated', 'policy-blocked', 'unknown']).toContain(capability.mutation_boundary);
      expect({ name, capability: JSON.stringify(capability) }).not.toEqual(
        expect.objectContaining({
          capability: expect.stringMatching(/query_ready|live availability|query_result|raw_log|semantic_conclusion|task_conclusion/),
        }),
      );
    }
  });

  test('models read-only MCP resources separately from tools', () => {
    const toolsJson = JSON.parse(read(TOOLS_JSON_PATH));
    const capabilities = toolsJson.tools.find((tool) => tool.id === 'gitnexus').provider_config.native_capabilities;

    expect(capabilities.repo_registry.native_tools).toEqual(['list_repos']);
    expect(capabilities.repo_registry.native_resources).toContain('gitnexus://repos');
    expect(capabilities.context.native_tools).toEqual(['context']);
    expect(capabilities.context.native_resources).toContain('gitnexus://repo/{name}/context');
    expect(capabilities.cypher.native_tools).toEqual(['cypher']);
    expect(capabilities.cypher.native_resources).toContain('gitnexus://repo/{name}/schema');
    expect(capabilities.impact.native_resources).toContain('gitnexus://repo/{name}/processes');
    expect(capabilities.impact.native_resources).toContain('gitnexus://repo/{name}/process/{processName}');
    expect(capabilities.workspace_group.native_tools).toEqual(['group_list']);
    expect(capabilities.workspace_group.native_resources).toEqual([
      'gitnexus://group/{name}/contracts',
      'gitnexus://group/{name}/status',
    ]);
    expect([...capabilities.workspace_group.native_tools, ...capabilities.workspace_group.native_resources]).not.toContain('group_sync');
  });
});
