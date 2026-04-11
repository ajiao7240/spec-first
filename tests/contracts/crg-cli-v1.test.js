/**
 * CRG CLI v1 契约测试
 *
 * Unit 1：契约冻结阶段 — 全部使用 test.todo() 形式存在，不含任何实现代码。
 * Unit 6：envelope 部分已实现，解除 pending 状态，补充可执行断言。
 * 实现在后续 Unit 中逐步填充，本文件作为契约门控存在。
 *
 * 覆盖范围：
 *   - envelope 结构约束（R3）
 *   - FactItem 字段约束（R4）
 *   - crg query 参数矩阵（8 种 pattern）
 *   - 17 个子命令各自的 data 结构
 */

const { makeEnvelope } = require('../../src/crg/cli/envelope');

describe('crg-cli-v1 contract', () => {
  // ─── Envelope ──────────────────────────────────────────────────────────────
  describe('envelope', () => {
    test('包含所有必填字段：schema_version, generated_at, repo_root, degraded, warnings, data', () => {
      const env = makeEnvelope('/repo', {});
      expect(env).toHaveProperty('schema_version');
      expect(env).toHaveProperty('generated_at');
      expect(env).toHaveProperty('repo_root');
      expect(env).toHaveProperty('degraded');
      expect(env).toHaveProperty('warnings');
      expect(env).toHaveProperty('data');
    });

    test('schema_version 值为 "crg-cli/v1"', () => {
      const env = makeEnvelope('/repo', {});
      expect(env.schema_version).toBe('crg-cli/v1');
    });

    test('warnings 是数组，不是 null 或 undefined', () => {
      const env = makeEnvelope('/repo', {});
      expect(Array.isArray(env.warnings)).toBe(true);
    });

    test('degraded 是 boolean', () => {
      const env = makeEnvelope('/repo', {});
      expect(typeof env.degraded).toBe('boolean');
    });

    test('generated_at 是合法 ISO 8601 格式字符串', () => {
      const env = makeEnvelope('/repo', {});
      expect(typeof env.generated_at).toBe('string');
      // ISO 8601 格式：能被 Date 解析且还原后相等
      expect(new Date(env.generated_at).toISOString()).toBe(env.generated_at);
    });

    test('repo_root 是非空字符串', () => {
      const env = makeEnvelope('/my/repo', {});
      expect(typeof env.repo_root).toBe('string');
      expect(env.repo_root.length).toBeGreaterThan(0);
      expect(env.repo_root).toBe('/my/repo');
    });

    test('warning 对象至少含 type 字段', () => {
      const env = makeEnvelope('/repo', {}, {
        warnings: [{ type: 'degraded_parser', message: 'tree-sitter missing' }],
      });
      expect(env.warnings[0]).toHaveProperty('type');
    });
  });

  // ─── FactItem ──────────────────────────────────────────────────────────────
  describe('fact item', () => {
    test.todo('confidence=Inferred 时必须有 inference_reason');
    test.todo('confidence=Observed 时 inference_reason 可缺省');
    test.todo('confidence=Unknown 时 inference_reason 可缺省');
    test.todo('confidence 只能是 Observed/Inferred/Unknown 之一');
    test.todo('source_tier 只能是 crg_ast/serena_semantic/grep_glob 之一');
    test.todo('inference_reason 只能是规定的 5 种枚举值之一');
    test.todo('evidence 若存在则为 string 数组');
    test.todo('name / file_path / kind 均为必填字符串');
  });

  // ─── crg query 参数矩阵 ────────────────────────────────────────────────────
  describe('crg query 参数矩阵', () => {
    test.todo('callers_of + --symbol → 合法');
    test.todo('callers_of + --module → exit 1（参数不合法）');
    test.todo('callees_of + --symbol → 合法');
    test.todo('callees_of + --module → exit 1（参数不合法）');
    test.todo('importers_of + --module → 合法');
    test.todo('importers_of + --symbol → exit 1（参数不合法）');
    test.todo('importees_of + --module → 合法');
    test.todo('importees_of + --symbol → exit 1（参数不合法）');
    test.todo('tests_for + --subject → 合法');
    test.todo('tests_for + --symbol → exit 1（参数不合法）');
    test.todo('tests_for + --module → exit 1（参数不合法）');
    test.todo('similar_to + --symbol → 合法');
    test.todo('similar_to + --module → exit 1（参数不合法）');
    test.todo('dependents_of + --module → 合法');
    test.todo('dependents_of + --symbol → exit 1（参数不合法）');
    test.todo('dependencies_of + --module → 合法');
    test.todo('dependencies_of + --symbol → exit 1（参数不合法）');
  });

  // ─── crg build ─────────────────────────────────────────────────────────────
  describe('crg build', () => {
    test.todo('返回合法 JSON envelope');
    test.todo('data 含 node_count, edge_count, changed_files, duration_ms');
    test.todo('node_count 和 edge_count 为非负整数');
    test.todo('duration_ms 为非负数值');
  });

  // ─── crg stats ─────────────────────────────────────────────────────────────
  describe('crg stats', () => {
    test.todo('含 corpus_health.status（small/optimal/large 之一）');
    test.todo('含 corpus_health.total_loc（非负整数）');
    test.todo('含 last_built（ISO 8601 格式）');
    test.todo('含 unresolved_edge_count（非负整数）');
    test.todo('图未构建时 exit 2');
  });

  // ─── crg context ───────────────────────────────────────────────────────────
  describe('crg context', () => {
    test.todo('data 含 top_flows、top_communities、top_hubs、summary');
    test.todo('top_flows 是数组');
    test.todo('top_hubs 中每项满足 FactItem 约束');
    test.todo('summary 是字符串');
  });

  // ─── crg query ─────────────────────────────────────────────────────────────
  describe('crg query', () => {
    test.todo('data.items 是数组');
    test.todo('items 中每项满足 FactItem 约束');
    test.todo('缺少 --pattern 时 exit 1');
  });

  // ─── crg impact ────────────────────────────────────────────────────────────
  describe('crg impact', () => {
    test.todo('data 含 impacted_nodes（FactItem 数组）和 blast_radius（整数）');
    test.todo('blast_radius 等于 impacted_nodes.length');
  });

  // ─── crg large-functions ───────────────────────────────────────────────────
  describe('crg large-functions', () => {
    test.todo('data.items 每项含 name, file_path, loc, kind');
    test.todo('kind 只能是 function 或 method');
    test.todo('loc 为正整数');
  });

  // ─── crg search ────────────────────────────────────────────────────────────
  describe('crg search', () => {
    test.todo('data.results 每项含 node_id, name, file_path, kind, snippet');
    test.todo('snippet 为字符串，可以为空字符串');
  });

  // ─── crg flows ─────────────────────────────────────────────────────────────
  describe('crg flows', () => {
    test.todo('data.items 每项含 flow_id, entry_node, criticality, node_count');
    test.todo('criticality 为 0~1 之间的浮点数');
  });

  // ─── crg flow ──────────────────────────────────────────────────────────────
  describe('crg flow', () => {
    test.todo('data 含 flow_id, entry_node, criticality, nodes');
    test.todo('nodes 中每项满足 FactItem 约束');
    test.todo('指定不存在的 flow_id 时 exit 1');
  });

  // ─── crg affected-flows ────────────────────────────────────────────────────
  describe('crg affected-flows', () => {
    test.todo('data.items 每项含 flow_id, entry_node, affected_nodes');
    test.todo('affected_nodes 中每项满足 FactItem 约束');
  });

  // ─── crg communities ───────────────────────────────────────────────────────
  describe('crg communities', () => {
    test.todo('data 含 items 数组和 stats 对象');
    test.todo('每项含 health.status（healthy/fragile/isolated/overloaded 之一）');
    test.todo('每项含 health.density（浮点数）');
    test.todo('每项含 health.independence（浮点数）');
    test.todo('stats.total 等于 items.length');
    test.todo('stats.by_status 各键之和等于 stats.total');
  });

  // ─── crg community ─────────────────────────────────────────────────────────
  describe('crg community', () => {
    test.todo('data 含 community_id, label, file_count, health, members');
    test.todo('members 中每项满足 FactItem 约束');
    test.todo('指定不存在的 community_id 时 exit 1');
  });

  // ─── crg architecture ──────────────────────────────────────────────────────
  describe('crg architecture', () => {
    test.todo('data 含 hub_nodes（FactItem 数组）和 cross_community_edges 数组');
    test.todo('cross_community_edges 每项含 source, target, kind');
  });

  // ─── crg surprising-connections ────────────────────────────────────────────
  describe('crg surprising-connections', () => {
    test.todo('每项含 score（整数）和 reasons（string[]）');
    test.todo('每项含 source 和 target（均为字符串）');
    test.todo('score 为非负整数');
    test.todo('reasons 不为空数组');
  });

  // ─── crg god-nodes ─────────────────────────────────────────────────────────
  describe('crg god-nodes', () => {
    test.todo('data.items 是数组，每项满足 FactItem 约束');
  });

  // ─── crg detect-changes ────────────────────────────────────────────────────
  describe('crg detect-changes', () => {
    test.todo('data.items 每项含 file, risk_level, functions');
    test.todo('risk_level 只能是 High/Medium/Low 之一');
    test.todo('functions 每项含 name 和 risk_level');
  });

  // ─── crg review-context ────────────────────────────────────────────────────
  describe('crg review-context', () => {
    test.todo('data 含 diff_summary, affected_nodes, candidate_tests');
    test.todo('affected_nodes 中每项满足 FactItem 约束');
    test.todo('candidate_tests 每项含 file（字符串）和 inferred（boolean）');
    test.todo('无 diff 时 diff_summary 为空字符串而非 null');
  });
});
