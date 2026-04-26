'use strict';

/**
 * CRG review-context 子命令
 *
 * 用法：spec-first crg review-context --since=<git-ref> --repo=<path>
 *
 * 输出：JSON envelope，包含：
 *   - diff_summary：变更文件数量摘要
 *   - affected_nodes：变更文件中的节点（FactItem 格式）
 *   - candidate_tests：启发式推断的候选测试文件（文件名匹配 + nodes 表 is_test=1）
 *
 * --since 缺失 → exit 1
 * --since 为无效 git ref → exit 1
 * graph.db 不存在或 better-sqlite3 未安装 → exit 2
 */

const path = require('path');
const fs = require('fs');
const { openDb } = require('../cli/open-db');
const { makeEnvelope } = require('../cli/envelope');
const changes = require('../changes');
const { detectChanges, assessNodeRiskBatch } = changes;

function fallbackSummarizeChangeSurface({ repoRoot, changedFiles = [] } = {}) {
  const normalizedFiles = [...new Set((changedFiles || []).filter(Boolean).map((filePath) => {
    return String(filePath).replace(/\\/g, '/').replace(/^\.\//, '');
  }))];
  const runtimeFiles = normalizedFiles.filter((filePath) => {
    return !filePath.startsWith('docs/')
      && !filePath.startsWith('.github/')
      && !filePath.endsWith('.md')
      && !['README.md', 'CHANGELOG.md', 'AGENTS.md', 'CLAUDE.md'].includes(filePath)
      && !/(^|\/)(tests?|__tests__)\//.test(filePath)
      && !/\.(test|spec)\.[^/]+$/i.test(filePath);
  });
  const impactedPlatforms = [];
  for (const filePath of runtimeFiles) {
    const ext = path.extname(filePath).toLowerCase();
    if (filePath.startsWith('src/app/') || filePath.startsWith('app/') || filePath.startsWith('pages/') || filePath.startsWith('components/') || ['.tsx', '.jsx'].includes(ext)) {
      impactedPlatforms.push('web');
    }
    if (filePath.startsWith('src/cli/') || filePath.startsWith('skills/') || filePath.startsWith('bin/')) {
      impactedPlatforms.push('cli');
    }
    if (filePath.startsWith('src/') && impactedPlatforms.length === 0) {
      impactedPlatforms.push('cli');
    }
  }
  const packageScripts = (() => {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
      return pkg && pkg.scripts && typeof pkg.scripts === 'object' ? Object.keys(pkg.scripts) : [];
    } catch (_) {
      return [];
    }
  })();
  const impactedModules = normalizedFiles.map((filePath) => {
    const parts = filePath.split('/').filter(Boolean);
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0];
    if (['src', 'tests', 'docs'].includes(parts[0]) && parts[1] && !parts[1].includes('.')) return `${parts[0]}/${parts[1]}/`;
    return `${parts[0]}/`;
  }).filter(Boolean);
  const impactedLanguages = normalizedFiles.map((filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.tsx' || ext === '.ts') return 'typescript';
    if (ext === '.jsx' || ext === '.js' || ext === '.cjs' || ext === '.mjs') return 'javascript';
    if (ext === '.md') return 'markdown';
    return null;
  }).filter(Boolean);
  const required = [];
  const optional = [];
  if (runtimeFiles.length > 0) {
    if (packageScripts.length === 0 || packageScripts.some((name) => name === 'test' || /^test(:|$)/.test(name))) {
      required.push('unit-tests');
    }
    if (packageScripts.some((name) => /integration/.test(name))) {
      required.push('integration-tests');
    }
    if (impactedPlatforms.includes('web') && packageScripts.length === 0) {
      required.push('browser-smoke');
      optional.push('browser-evidence');
    }
  }
  return {
    impacted_modules: [...new Set(impactedModules)].sort(),
    impacted_languages: [...new Set(impactedLanguages)].sort(),
    impacted_platforms: [...new Set(impactedPlatforms)],
    recommended_required_verifications: [...new Set(required)],
    recommended_optional_verifications: [...new Set(optional)],
    confidence: runtimeFiles.length > 0 ? 'high' : 'low',
  };
}

const summarizeChangeSurface = typeof changes.summarizeChangeSurface === 'function'
  ? changes.summarizeChangeSurface
  : fallbackSummarizeChangeSurface;
const { isSensitiveFile } = require('../input-convergence');
const { retrieveContext } = require('../retrieval/api');

function intersectsHunks(node, hunks) {
  if (!Array.isArray(hunks) || hunks.length === 0) return false;
  const lineStart = Number.isFinite(node.line_start) ? node.line_start : 0;
  const lineEnd = Number.isFinite(node.line_end) && node.line_end >= lineStart
    ? node.line_end
    : lineStart;
  return hunks.some((hunk) => !(lineEnd < hunk.start || lineStart > hunk.end));
}

/**
 * review-context 子命令入口（由 router.js 调用）
 *
 * @param {string[]} argv - router.js 传入的参数（不含子命令名本身）
 */
function run(argv) {
  // 解析 --since=<git-ref>，缺失时 exit 1
  const sinceArg = argv.find(a => a.startsWith('--since='));
  if (!sinceArg) {
    process.stderr.write('error: --since=<git-ref> is required\n');
    process.exit(1);
  }
  const since = sinceArg.slice('--since='.length);

  // openDb 内部：graph.db 不存在或 better-sqlite3 未安装时 exit 2
  const { db, repoRoot } = openDb(argv);

  try {
  // 获取变更文件列表（含风险评分）
  let changeSummary;
  try {
    changeSummary = detectChanges(repoRoot, since, db);
  } catch (e) {
    if (e.isUserError) {
      process.stderr.write(`error: ${e.message}\n`);
      process.exit(1);
    }
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(2);
  }

  // 收集受影响节点（FactItem 格式，跳过 module 节点和敏感文件）
  const affectedNodes = [];
  for (const change of changeSummary) {
    // 安全检查：跳过敏感文件
    if (isSensitiveFile(path.basename(change.file))) continue;

    const nodes = db.prepare(
      `SELECT id, name, file_path, kind, line_start, line_end, is_test
       FROM nodes
       WHERE file_path = ? AND kind != 'module'`
    ).all(change.file);

    for (const node of nodes) {
      affectedNodes.push({
        id: node.id,
        name: node.name,
        file_path: node.file_path,
        kind: node.kind,
        line_start: node.line_start,
        line_end: node.line_end,
        is_test: node.is_test,
        confidence: 'Observed',
        source_tier: 'crg_ast',
        evidence: [`changed file: ${change.file}`],
        inference_reason: null,
        risk_level: change.risk_level,
      });
    }
  }

  // 候选测试关联（启发式：文件名匹配，不依赖 tested_by 边）
  const candidateTests = [];
  const seenTestFiles = new Set();

  // 将候选测试文件包装成 FactItem 格式
  // 优先从 nodes 表中查找 module 节点（有索引时带 line_end）；未索引时构造最小 FactItem
  const buildCandidateTest = (file, sourceTier, evidence) => {
    const moduleNode = db
      .prepare("SELECT id, name, line_end FROM nodes WHERE file_path = ? AND kind = 'module' LIMIT 1")
      .get(file);
    return {
      id: moduleNode ? moduleNode.id : `${file}#module`,
      name: moduleNode ? moduleNode.name : path.basename(file, path.extname(file)),
      file_path: file,
      kind: 'module',
      line_start: 0,
      line_end: moduleNode ? moduleNode.line_end : 0,
      is_test: 1,
      confidence: 'Inferred',
      source_tier: sourceTier,
      evidence: [evidence],
      inference_reason: 'naming_convention',
    };
  };

  const changedFiles = changeSummary.map(c => c.file);
  const changeSurface = summarizeChangeSurface({
    repoRoot,
    changedFiles,
  });
  const hunksByFile = new Map(
    changeSummary.map((item) => [item.file, Array.isArray(item.hunks) ? item.hunks : []])
  );
  for (const filePath of changedFiles) {
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    const dir = path.dirname(filePath);

    // 同目录下的 <base>.test.<ext> 和 <base>.spec.<ext>
    const testPatterns = [
      `${base}.test${ext}`,
      `${base}.spec${ext}`,
    ];

    for (const testFile of testPatterns) {
      const relTestPath = path.join(dir, testFile);
      const absTestPath = path.join(repoRoot, relTestPath);
      if (fs.existsSync(absTestPath) && !seenTestFiles.has(relTestPath)) {
        seenTestFiles.add(relTestPath);
        candidateTests.push(
          buildCandidateTest(relTestPath, 'grep_glob', `matched sibling test file for ${filePath}`)
        );
      }
    }

    // nodes 表中 is_test=1 且文件名包含 base 的节点（转义 LIKE 通配符）
    const escapedBase = base.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const testNodes = db.prepare(
      "SELECT DISTINCT file_path FROM nodes WHERE is_test = 1 AND file_path LIKE ? ESCAPE '\\'"
    ).all(`%${escapedBase}%`);

    for (const tn of testNodes) {
      if (!seenTestFiles.has(tn.file_path)) {
        seenTestFiles.add(tn.file_path);
        candidateTests.push(
          buildCandidateTest(tn.file_path, 'crg_ast', `matched indexed test node for ${filePath}`)
        );
      }
    }
  }

  const hunkHit = affectedNodes.filter((node) => intersectsHunks(node, hunksByFile.get(node.file_path)));

  // === 图扩展：2层反向 BFS，找出受变更影响的调用方 ===
  // 加载 calls 边的反向邻接表（target → callers）
  const edgeRows = db.prepare(
    "SELECT source_id, target_id FROM edges WHERE kind = 'calls'"
  ).all();
  const reverseAdj = new Map();
  for (const row of edgeRows) {
    if (!reverseAdj.has(row.target_id)) reverseAdj.set(row.target_id, []);
    reverseAdj.get(row.target_id).push(row.source_id);
  }

  // 反向 BFS（深度上限 2，防止爆炸）
  function reverseBfs(startId, maxDepth) {
    const visited = new Map(); // nodeId → depth
    const queue = [[startId, 0]];
    let head = 0;
    visited.set(startId, 0);
    while (head < queue.length) {
      const [cur, depth] = queue[head++];
      if (depth >= maxDepth) continue;
      for (const caller of (reverseAdj.get(cur) || [])) {
        if (!visited.has(caller)) {
          visited.set(caller, depth + 1);
          queue.push([caller, depth + 1]);
        }
      }
    }
    return visited;
  }

  const affectedNodeIds = new Set(affectedNodes.map(n => n.id));
  const expansionDepthMap = new Map(); // nodeId → 最小发现深度
  for (const nodeId of affectedNodeIds) {
    const visited = reverseBfs(nodeId, 2);
    for (const [id, depth] of visited) {
      if (id !== nodeId && !affectedNodeIds.has(id)) {
        if (!expansionDepthMap.has(id) || expansionDepthMap.get(id) > depth) {
          expansionDepthMap.set(id, depth);
        }
      }
    }
  }

  // 批量查询扩展节点（避免超出 SQLITE_MAX_VARIABLE_NUMBER）
  const CHUNK_SIZE = 900;
  const expansionNodeIds = Array.from(expansionDepthMap.keys());

  // 预批量计算所有扩展节点的风险评分（一次性 ~6 个批量查询，替代 N+1）
  const expansionRiskScores = assessNodeRiskBatch(expansionNodeIds, db);

  const graphExpansion = [];
  for (let i = 0; i < expansionNodeIds.length; i += CHUNK_SIZE) {
    const chunk = expansionNodeIds.slice(i, i + CHUNK_SIZE);
    const ph = chunk.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT id, name, file_path, kind, line_start, line_end, is_test FROM nodes WHERE id IN (${ph})`
    ).all(...chunk);
    for (const row of rows) {
      graphExpansion.push({
        id: row.id,
        name: row.name,
        file_path: row.file_path,
        kind: row.kind,
        line_start: row.line_start,
        line_end: row.line_end,
        is_test: row.is_test,
        confidence: 'Inferred',
        source_tier: 'crg_ast',
        evidence: [`2-hop caller of changed code`],
        inference_reason: 'call_graph_traversal',
        depth: expansionDepthMap.get(row.id),
        risk_score: expansionRiskScores.get(row.id) || 0,
      });
    }
  }
  // 按 risk_score 降序排列
  graphExpansion.sort((a, b) => b.risk_score - a.risk_score);

  // === review_guidance 生成（聚合 changeSummary 的 review_priorities/test_gaps）===
  const allReviewPriorities = changeSummary.flatMap(c => c.review_priorities || []);
  const allTestGaps = changeSummary.flatMap(c => c.test_gaps || []);

  const review_guidance = [];
  const highRiskNodes = allReviewPriorities.filter(n => n.score >= 0.5);
  if (highRiskNodes.length > 0) {
    for (const n of highRiskNodes.slice(0, 5)) {
      review_guidance.push(`HIGH_RISK: ${n.name} — score ${n.score.toFixed(2)}`);
    }
  } else if (allReviewPriorities.length > 0) {
    const sorted = allReviewPriorities.slice().sort((a, b) => b.score - a.score);
    review_guidance.push(`TOP_PRIORITY: ${sorted[0].name} — score ${sorted[0].score.toFixed(2)}`);
  }
  if (allTestGaps.length > 0) {
    const names = allTestGaps.slice(0, 3).map(n => n.name).join(', ');
    review_guidance.push(
      `TEST_GAP: ${allTestGaps.length} node(s) lack test coverage — ${names}${allTestGaps.length > 3 ? ' ...' : ''}`
    );
  }
  if (changeSurface.recommended_required_verifications.length > 0) {
    review_guidance.push(
      `RECOMMENDED_REQUIRED: ${changeSurface.recommended_required_verifications.join(', ')}`
    );
  }
  if (changeSurface.recommended_optional_verifications.length > 0) {
    review_guidance.push(
      `RECOMMENDED_OPTIONAL: ${changeSurface.recommended_optional_verifications.join(', ')}`
    );
  }
  review_guidance.push(`VERIFICATION_CONFIDENCE: ${changeSurface.confidence}`);
  review_guidance.push(`BLAST_RADIUS: ${graphExpansion.length} caller(s) within 2 hops of changed code`);

  const data = {
    diff_summary: changeSummary.length > 0 ? `${changeSummary.length} file(s) changed since ${since}` : '',
    affected_nodes: affectedNodes,
    hunk_hit: hunkHit,
    candidate_tests: candidateTests,
    graph_expansion: graphExpansion,
    impacted_modules: changeSurface.impacted_modules,
    impacted_languages: changeSurface.impacted_languages,
    impacted_platforms: changeSurface.impacted_platforms,
    recommended_required_verifications: changeSurface.recommended_required_verifications,
    recommended_optional_verifications: changeSurface.recommended_optional_verifications,
    confidence: changeSurface.confidence,
    review_guidance,
    ranked_context: retrieveContext(db, {
      profile: 'review',
      query: `${changedFiles.join(' ')} review risk tests`,
      changedFiles,
      candidateTests: candidateTests.map((item) => item.file_path),
      riskPaths: changeSummary
        .filter((item) => item.risk_level === 'High' || item.risk_level === 'Medium')
        .map((item) => item.file),
    }).ranked_context,
  };

  process.stdout.write(JSON.stringify(makeEnvelope(repoRoot, data)) + '\n');
  } finally {
    try { db.close(); } catch (_) {}
  }
}

module.exports = { run };
