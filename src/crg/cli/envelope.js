'use strict';

/**
 * CRG CLI 统一输出 envelope 工厂
 *
 * 所有 CRG 子命令输出 JSON 时，统一通过此函数包装，保证字段一致性。
 * 格式约束由 docs/contracts/crg-cli-v1.schema.json 冻结。
 */

/**
 * 构造标准输出 envelope
 *
 * @param {string} repoRoot - 仓库根目录绝对路径
 * @param {object} data     - 子命令的具体数据内容
 * @param {object} [opts]
 * @param {string[]} [opts.warnings=[]]   - 告警列表（每项至少含 type 字段）
 * @param {boolean} [opts.degraded=false] - 是否处于降级模式（如 native 包未安装）
 * @returns {object}
 */
function makeEnvelope(repoRoot, data, { warnings = [], degraded = false } = {}) {
  return {
    schema_version: 'crg-cli/v1',
    generated_at: new Date().toISOString(),
    repo_root: repoRoot,
    degraded,
    warnings,
    data,
  };
}

module.exports = { makeEnvelope };
