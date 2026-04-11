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
const { detectChanges } = require('../changes');
const { isSensitiveFile } = require('../input-convergence');

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
      "SELECT id, name, file_path, kind FROM nodes WHERE file_path = ? AND kind != 'module'"
    ).all(change.file);

    for (const node of nodes) {
      affectedNodes.push({
        id: node.id,
        name: node.name,
        file_path: node.file_path,
        kind: node.kind,
        confidence: 'Observed',
        source_tier: 'crg_ast',
        evidence: [`changed file: ${change.file}`],
        risk_level: change.risk_level,
      });
    }
  }

  // 候选测试关联（启发式：文件名匹配，不依赖 tested_by 边）
  const candidateTests = [];
  const seenTestFiles = new Set();

  const changedFiles = changeSummary.map(c => c.file);
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
        candidateTests.push({ file: relTestPath, inferred: true });
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
        candidateTests.push({ file: tn.file_path, inferred: true });
      }
    }
  }

  const data = {
    diff_summary: `${changeSummary.length} file(s) changed since ${since}`,
    affected_nodes: affectedNodes,
    candidate_tests: candidateTests,
  };

  process.stdout.write(JSON.stringify(makeEnvelope(repoRoot, data)) + '\n');
}

module.exports = { run };
