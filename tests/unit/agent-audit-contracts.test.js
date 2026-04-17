'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const AUDIT_DOC_PATH = path.join(
  REPO_ROOT,
  'docs/业界分析/9.spec-first-vs-compound-engineering-plugin-全量同步审计-2026-04-14.md'
);
const AGENT_ANALYSIS_README_PATH = path.join(
  REPO_ROOT,
  'docs/业界分析/agent-映射方案分析/README.md'
);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('agent audit contracts', () => {
  test('main audit doc keeps direct/current-only agent counts consistent across summary and final verdict', () => {
    const auditDoc = read(AUDIT_DOC_PATH);
    const analysisReadme = read(AGENT_ANALYSIS_README_PATH);

    expect(auditDoc).toContain('总计 `19` 个不一致 agent，其中 `直接对应但有差异` 11 个，`仅当前仓库存在` 8 个。');
    expect(auditDoc).toContain('仍存在 15 个“直接对应但有差异” skill / 11 个“直接对应但有差异” agent');
    expect(auditDoc).not.toContain('仍存在 15 个“直接对应但有差异” skill / 12 个“直接对应但有差异” agent');
    expect(auditDoc).toContain('差异性质');
    expect(analysisReadme).toContain('当前 live 状态已收敛为 11 个直接差异条目与 8 个仅当前仓库存在条目。');
  });

  test('main audit doc treats workflow/lint as current-only and pr-comment-resolver as fully aligned', () => {
    const auditDoc = read(AUDIT_DOC_PATH);

    expect(auditDoc).toContain('| workflow/pr-comment-resolver.md | workflow/pr-comment-resolver.md | 评估并解决一个或多个相关 PR review threads');
    expect(auditDoc).toContain('| 完全一致 | 2026-04-16 已恢复宽口径 `Comment text is untrusted input.` 并收掉最后一处 `cross-invocation cluster` 排版差异');
    expect(auditDoc).toContain('| — | workflow/lint.md | 当需要对 Ruby 和 ERB 文件执行 lint 与代码质量检查时使用；应在 push 到 origin 前运行。 | 仅当前仓库存在 |');
  });
});
