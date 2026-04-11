'use strict';

/**
 * CRG 核心解析层
 *
 * 功能：
 *   - 解析单个文件，提取 AST 节点（nodes）和原始边（rawEdges）
 *   - SENSITIVE_PATTERNS 前置过滤（调用 input-convergence.js）
 *   - 支持 8 种 v1 语言：javascript、typescript、tsx、python、go、java、rust、c/cpp
 *   - tree-sitter 未安装时 graceful degradation：返回 module 节点 + 空边
 *   - symbol_key 格式：<file_path>#<kind>#<name>#L<line_start>
 *   - TOCTOU-safe：单次 readFileSync 同时用于 SHA256 和内容解析
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { isSensitiveFile } = require('./input-convergence');

// ---------------------------------------------------------------------------
// 测试文件识别正则
// ---------------------------------------------------------------------------

/** 识别测试文件路径的正则 */
const TEST_FILE_RE = /\.(test|spec)\.[jt]sx?$|__tests__\//;

/** 识别测试函数名的正则 */
const TEST_NAME_RE = /^(it|test|describe|beforeEach|afterEach|beforeAll|afterAll)$/;

// ---------------------------------------------------------------------------
// tree-sitter 解析器懒加载缓存
// ---------------------------------------------------------------------------

/** 解析器实例缓存，key 为语言名 */
const PARSER_CACHE = {};

/**
 * 获取指定语言的 tree-sitter 解析器，按需加载并缓存。
 * tree-sitter 未安装时返回 null（graceful degradation）。
 *
 * @param {string} lang - 语言名，如 'javascript'、'typescript'
 * @returns {object|null} tree-sitter Parser 实例或 null
 */
function getParser(lang) {
  if (PARSER_CACHE[lang]) return PARSER_CACHE[lang];

  try {
    // eslint-disable-next-line import/no-extraneous-dependencies
    const Parser = require('tree-sitter');

    let LangModule;
    if (lang === 'typescript') {
      // tree-sitter-typescript 导出 { typescript, tsx } 两个语言对象
      const tsLangs = require('tree-sitter-typescript');
      LangModule = tsLangs.typescript;
    } else if (lang === 'tsx') {
      const tsLangs = require('tree-sitter-typescript');
      LangModule = tsLangs.tsx;
    } else {
      // 其他语言直接 require('tree-sitter-<lang>')
      LangModule = require(`tree-sitter-${lang}`);
    }

    const parser = new Parser();
    parser.setLanguage(LangModule);
    PARSER_CACHE[lang] = parser;
    return parser;
  } catch {
    // 语言包或 tree-sitter 未安装，返回 null
    return null;
  }
}

// ---------------------------------------------------------------------------
// 语言推导
// ---------------------------------------------------------------------------

/**
 * 根据文件扩展名推导语言。
 * v1 仅支持：javascript / typescript / tsx / python / go / java / rust / c / cpp
 * 不支持的语言（objc/swift/kotlin 等）返回 null。
 *
 * @param {string} filePath - 文件路径（相对或绝对均可，取扩展名）
 * @returns {string|null} 语言名或 null
 */
function inferLanguage(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const extMap = {
    // JavaScript 系
    'js': 'javascript',
    'jsx': 'javascript',
    'mjs': 'javascript',
    'cjs': 'javascript',
    // TypeScript 系
    'ts': 'typescript',
    'tsx': 'tsx',
    // Python
    'py': 'python',
    'pyw': 'python',
    // Go
    'go': 'go',
    // Java
    'java': 'java',
    // Rust
    'rs': 'rust',
    // C / C++
    'c': 'c',
    'h': 'c',    // .h 默认 c；解析层做 objc 启发式路由，v1 不支持 objc 则降级 skip
    'cc': 'cpp',
    'cpp': 'cpp',
    'cxx': 'cpp',
    'hpp': 'cpp',
    // v1 不支持，显式返回 null
    'mm': null,   // ObjC++
    'm': null,    // ObjC
    'swift': null,
    'kt': null,
    'kts': null,
  };

  // 有明确映射（包括 null）则返回映射值
  if (Object.prototype.hasOwnProperty.call(extMap, ext)) {
    return extMap[ext];
  }
  // 未知扩展名
  return null;
}

// ---------------------------------------------------------------------------
// 构建基础 Node 对象
// ---------------------------------------------------------------------------

/**
 * 构建 symbol_key：<file_path>#<kind>#<name>#L<line_start>
 *
 * @param {string} filePath
 * @param {string} kind
 * @param {string} name
 * @param {number} lineStart
 * @returns {string}
 */
function buildSymbolKey(filePath, kind, name, lineStart) {
  return `${filePath}#${kind}#${name}#L${lineStart}`;
}

/**
 * 构建 Node 对象（填充所有 v1 必需字段）
 *
 * @param {string} filePath - 相对路径
 * @param {string} kind
 * @param {string} name
 * @param {number} lineStart
 * @param {number} lineEnd
 * @param {boolean} isTestFile - 所在文件是否为测试文件
 * @returns {object}
 */
function buildNode(filePath, kind, name, lineStart, lineEnd, isTestFile) {
  // 测试文件中的函数，或名称命中测试框架 API，标记为测试节点
  const isTestNode =
    isTestFile || (kind === 'function' && TEST_NAME_RE.test(name)) ? 1 : 0;

  return {
    id: buildSymbolKey(filePath, kind, name, lineStart),
    file_path: filePath,
    name,
    kind,
    line_start: lineStart,
    line_end: lineEnd,
    is_test: isTestNode,
    community_id: null,
    confidence: 'Observed',
    source_tier: 'crg_ast',
    evidence: [],
    inference_reason: null,
  };
}

/**
 * 构建文件级 module 节点（每个文件必有一个）
 *
 * @param {string} filePath
 * @returns {object}
 */
function buildModuleNode(filePath, isTestFile = false) {
  return buildNode(
    filePath,
    'module',
    path.basename(filePath),
    0,
    0,
    isTestFile
  );
}

// ---------------------------------------------------------------------------
// tree-sitter AST 节点遍历辅助
// ---------------------------------------------------------------------------

/**
 * 获取 tree-sitter 节点的起始行（1-indexed → 直接使用 startPosition.row + 1）
 *
 * @param {object} tsNode
 * @returns {number}
 */
function getLineStart(tsNode) {
  return tsNode.startPosition.row + 1;
}

/**
 * 获取 tree-sitter 节点的结束行
 *
 * @param {object} tsNode
 * @returns {number}
 */
function getLineEnd(tsNode) {
  return tsNode.endPosition.row + 1;
}

/**
 * 从 tree-sitter 子节点中提取命名字段的文本
 *
 * @param {object} tsNode
 * @param {string} fieldName - 子字段名（如 'name'）
 * @returns {string|null}
 */
function getFieldText(tsNode, fieldName) {
  const child = tsNode.childForFieldName(fieldName);
  return child ? child.text : null;
}

// ---------------------------------------------------------------------------
// JavaScript / TypeScript AST 提取
// ---------------------------------------------------------------------------

/**
 * 递归提取 JS/TS AST 节点
 *
 * @param {object} tsNode - tree-sitter 节点
 * @param {string} filePath
 * @param {boolean} isTestFile
 * @param {object[]} nodes - 输出数组
 * @param {object[]} rawEdges - 输出数组
 * @param {string} [parentId] - 父节点 symbol_key（用于 contains 边）
 */
function extractJsNodes(tsNode, filePath, isTestFile, nodes, rawEdges, parentId, currentSymbolId = null) {
  if (!tsNode) return;
  const type = tsNode.type;

  // import 语句 → imports_from 边
  if (type === 'import_statement') {
    // 提取 from 子句的路径
    const sourceNode = tsNode.childForFieldName('source');
    if (sourceNode) {
      // 去掉引号
      const rawPath = sourceNode.text.replace(/^['"`]|['"`]$/g, '');
      rawEdges.push({
        source_id: parentId || filePath + '#module#' + path.basename(filePath) + '#L0',
        target_name: rawPath,
        target_path_raw: rawPath,
        kind: 'imports_from',
      });
    }
  }

  // 函数声明
  if (type === 'function_declaration') {
    const name = getFieldText(tsNode, 'name') || '<anonymous>';
    const node = buildNode(filePath, 'function', name, getLineStart(tsNode), getLineEnd(tsNode), isTestFile);
    nodes.push(node);
    if (parentId) {
      rawEdges.push({
        source_id: parentId,
        target_id: node.id,
        target_name: name,
        target_path_raw: null,
        kind: 'contains',
      });
    }
    // 递归内部（可能有嵌套函数）
    for (let i = 0; i < tsNode.childCount; i++) {
      extractJsNodes(tsNode.child(i), filePath, isTestFile, nodes, rawEdges, node.id, node.id);
    }
    return;
  }

  // 类声明
  if (type === 'class_declaration' || type === 'class_expression') {
    const name = getFieldText(tsNode, 'name') || '<anonymous>';
    const node = buildNode(filePath, 'class', name, getLineStart(tsNode), getLineEnd(tsNode), isTestFile);
    nodes.push(node);
    if (parentId) {
      rawEdges.push({
        source_id: parentId,
        target_id: node.id,
        target_name: name,
        target_path_raw: null,
        kind: 'contains',
      });
    }
    for (let i = 0; i < tsNode.childCount; i++) {
      extractJsNodes(tsNode.child(i), filePath, isTestFile, nodes, rawEdges, node.id, currentSymbolId);
    }
    return;
  }

  // 方法定义
  if (type === 'method_definition') {
    const nameNode = tsNode.childForFieldName('name');
    const name = nameNode ? nameNode.text : '<anonymous>';
    const node = buildNode(filePath, 'method', name, getLineStart(tsNode), getLineEnd(tsNode), isTestFile);
    nodes.push(node);
    if (parentId) {
      rawEdges.push({
        source_id: parentId,
        target_id: node.id,
        target_name: name,
        target_path_raw: null,
        kind: 'contains',
      });
    }
    for (let i = 0; i < tsNode.childCount; i++) {
      extractJsNodes(tsNode.child(i), filePath, isTestFile, nodes, rawEdges, node.id, node.id);
    }
    return;
  }

  // 箭头函数 / 函数表达式 —— 只在 variable_declarator 中关联
  // 跳过独立的 function_expression 和 arrow_function，由 variable_declarator 处理

  // variable_declarator：检查 RHS 是否为函数/类
  if (type === 'variable_declarator') {
    const nameNode = tsNode.childForFieldName('name');
    const valueNode = tsNode.childForFieldName('value');
    if (nameNode && valueNode) {
      const vType = valueNode.type;
      if (vType === 'function_expression' || vType === 'arrow_function') {
        const name = nameNode.text;
        const node = buildNode(filePath, 'function', name, getLineStart(tsNode), getLineEnd(tsNode), isTestFile);
        nodes.push(node);
        if (parentId) {
          rawEdges.push({
            source_id: parentId,
            target_id: node.id,
            target_name: name,
            target_path_raw: null,
            kind: 'contains',
          });
        }
        // 递归函数体（内部可能有嵌套）
        for (let i = 0; i < valueNode.childCount; i++) {
          extractJsNodes(valueNode.child(i), filePath, isTestFile, nodes, rawEdges, node.id, node.id);
        }
        return;
      }
      if (vType === 'class_expression') {
        const name = nameNode.text;
        const node = buildNode(filePath, 'class', name, getLineStart(tsNode), getLineEnd(tsNode), isTestFile);
        nodes.push(node);
        if (parentId) {
          rawEdges.push({
            source_id: parentId,
            target_id: node.id,
            target_name: name,
            target_path_raw: null,
            kind: 'contains',
          });
        }
        for (let i = 0; i < valueNode.childCount; i++) {
          extractJsNodes(valueNode.child(i), filePath, isTestFile, nodes, rawEdges, node.id, currentSymbolId);
        }
        return;
      }
    }
  }

  // CommonJS require() → imports_from 边（顶层与函数内均处理）
  // require() 本身不产生 calls 边：它是模块依赖声明，不是运行时调用
  if (type === 'call_expression') {
    const functionNode = tsNode.childForFieldName('function');
    if (functionNode && functionNode.text === 'require') {
      const argsNode = tsNode.childForFieldName('arguments');
      if (argsNode) {
        for (let i = 0; i < argsNode.childCount; i++) {
          const arg = argsNode.child(i);
          if (arg.type === 'string') {
            const rawPath = arg.text.replace(/^['"`]|['"`]$/g, '');
            rawEdges.push({
              source_id: parentId,
              target_name: rawPath,
              target_path_raw: rawPath,
              kind: 'imports_from',
            });
            break;
          }
        }
      }
      // require() 已处理完毕，递归子节点后提前返回（不走通用 calls 分支）
      for (let i = 0; i < tsNode.childCount; i++) {
        extractJsNodes(tsNode.child(i), filePath, isTestFile, nodes, rawEdges, parentId, currentSymbolId);
      }
      return;
    }
  }

  if (type === 'call_expression' && currentSymbolId) {
    const functionNode = tsNode.childForFieldName('function');
    const targetName = extractJsCallTargetName(functionNode);
    if (targetName) {
      rawEdges.push({
        source_id: currentSymbolId,
        target_name: targetName,
        target_path_raw: null,
        kind: 'calls',
      });
    }
  }

  // TypeScript 接口
  if (type === 'interface_declaration') {
    const name = getFieldText(tsNode, 'name') || '<anonymous>';
    const node = buildNode(filePath, 'interface', name, getLineStart(tsNode), getLineEnd(tsNode), isTestFile);
    nodes.push(node);
    if (parentId) {
      rawEdges.push({ source_id: parentId, target_name: name, target_path_raw: null, kind: 'contains' });
    }
    return;
  }

  // 其余节点递归子节点
  for (let i = 0; i < tsNode.childCount; i++) {
    extractJsNodes(tsNode.child(i), filePath, isTestFile, nodes, rawEdges, parentId, currentSymbolId);
  }
}

function extractJsCallTargetName(functionNode) {
  if (!functionNode) return null;

  if (functionNode.type === 'identifier' || functionNode.type === 'property_identifier') {
    return functionNode.text;
  }

  if (functionNode.type === 'member_expression') {
    const propertyNode = functionNode.childForFieldName('property');
    if (propertyNode) return propertyNode.text;
  }

  return null;
}

function attachLocalTargetIds(nodes, rawEdges) {
  const byFileAndName = new Map();

  for (const node of nodes) {
    if (node.kind === 'module') continue;
    const key = `${node.file_path}\u0000${node.name}`;
    if (!byFileAndName.has(key)) byFileAndName.set(key, []);
    byFileAndName.get(key).push(node.id);
  }

  for (const edge of rawEdges) {
    if (edge.target_id || edge.target_path_raw || !edge.target_name) continue;
    const sourceFile = edge.source_id.split('#', 1)[0];
    const key = `${sourceFile}\u0000${edge.target_name}`;
    const matches = byFileAndName.get(key) || [];
    if (matches.length === 1) {
      edge.target_id = matches[0];
    }
  }
}

// ---------------------------------------------------------------------------
// Python AST 提取
// ---------------------------------------------------------------------------

/**
 * 递归提取 Python AST 节点
 */
function extractPyNodes(tsNode, filePath, isTestFile, nodes, rawEdges, parentId) {
  if (!tsNode) return;
  const type = tsNode.type;

  // import 语句
  if (type === 'import_statement' || type === 'import_from_statement') {
    let targetPath = null;
    if (type === 'import_from_statement') {
      const moduleNode = tsNode.childForFieldName('module_name');
      if (moduleNode) targetPath = moduleNode.text;
    } else {
      // import xxx → 取第一个 name
      for (let i = 0; i < tsNode.childCount; i++) {
        const c = tsNode.child(i);
        if (c.type === 'dotted_name' || c.type === 'aliased_import') {
          targetPath = c.text;
          break;
        }
      }
    }
    rawEdges.push({
      source_id: parentId || filePath + '#module#' + path.basename(filePath) + '#L0',
      target_name: targetPath || '',
      target_path_raw: targetPath,
      kind: 'imports_from',
    });
    return;
  }

  // 函数定义
  if (type === 'function_definition') {
    const name = getFieldText(tsNode, 'name') || '<anonymous>';
    const node = buildNode(filePath, 'function', name, getLineStart(tsNode), getLineEnd(tsNode), isTestFile);
    nodes.push(node);
    if (parentId) {
      rawEdges.push({ source_id: parentId, target_name: name, target_path_raw: null, kind: 'contains' });
    }
    for (let i = 0; i < tsNode.childCount; i++) {
      extractPyNodes(tsNode.child(i), filePath, isTestFile, nodes, rawEdges, node.id);
    }
    return;
  }

  // 类定义
  if (type === 'class_definition') {
    const name = getFieldText(tsNode, 'name') || '<anonymous>';
    const node = buildNode(filePath, 'class', name, getLineStart(tsNode), getLineEnd(tsNode), isTestFile);
    nodes.push(node);
    if (parentId) {
      rawEdges.push({ source_id: parentId, target_name: name, target_path_raw: null, kind: 'contains' });
    }
    for (let i = 0; i < tsNode.childCount; i++) {
      extractPyNodes(tsNode.child(i), filePath, isTestFile, nodes, rawEdges, node.id);
    }
    return;
  }

  for (let i = 0; i < tsNode.childCount; i++) {
    extractPyNodes(tsNode.child(i), filePath, isTestFile, nodes, rawEdges, parentId);
  }
}

// ---------------------------------------------------------------------------
// Go AST 提取
// ---------------------------------------------------------------------------

/**
 * 递归提取 Go AST 节点
 */
function extractGoNodes(tsNode, filePath, isTestFile, nodes, rawEdges, parentId) {
  if (!tsNode) return;
  const type = tsNode.type;

  // import 声明
  if (type === 'import_declaration') {
    // import_spec 中的 path_literal
    for (let i = 0; i < tsNode.childCount; i++) {
      const c = tsNode.child(i);
      if (c.type === 'import_spec' || c.type === 'import_spec_list') {
        extractGoImportSpecs(c, filePath, rawEdges, parentId);
      }
    }
    return;
  }

  // 函数声明
  if (type === 'function_declaration') {
    const name = getFieldText(tsNode, 'name') || '<anonymous>';
    const node = buildNode(filePath, 'function', name, getLineStart(tsNode), getLineEnd(tsNode), isTestFile);
    nodes.push(node);
    if (parentId) {
      rawEdges.push({ source_id: parentId, target_name: name, target_path_raw: null, kind: 'contains' });
    }
    return;
  }

  // 方法声明
  if (type === 'method_declaration') {
    const name = getFieldText(tsNode, 'name') || '<anonymous>';
    const node = buildNode(filePath, 'method', name, getLineStart(tsNode), getLineEnd(tsNode), isTestFile);
    nodes.push(node);
    if (parentId) {
      rawEdges.push({ source_id: parentId, target_name: name, target_path_raw: null, kind: 'contains' });
    }
    return;
  }

  // 类型声明
  if (type === 'type_declaration') {
    for (let i = 0; i < tsNode.childCount; i++) {
      const c = tsNode.child(i);
      if (c.type === 'type_spec') {
        const nameNode = c.childForFieldName('name');
        const typeNode = c.childForFieldName('type');
        const name = nameNode ? nameNode.text : '<anonymous>';
        let kind = 'struct';
        if (typeNode) {
          if (typeNode.type === 'interface_type') kind = 'interface';
          else if (typeNode.type === 'struct_type') kind = 'struct';
        }
        const node = buildNode(filePath, kind, name, getLineStart(tsNode), getLineEnd(tsNode), isTestFile);
        nodes.push(node);
        if (parentId) {
          rawEdges.push({ source_id: parentId, target_name: name, target_path_raw: null, kind: 'contains' });
        }
      }
    }
    return;
  }

  for (let i = 0; i < tsNode.childCount; i++) {
    extractGoNodes(tsNode.child(i), filePath, isTestFile, nodes, rawEdges, parentId);
  }
}

/**
 * 递归提取 Go import_spec / import_spec_list 中的路径
 */
function extractGoImportSpecs(tsNode, filePath, rawEdges, parentId) {
  if (tsNode.type === 'import_spec') {
    const pathNode = tsNode.childForFieldName('path');
    if (pathNode) {
      const rawPath = pathNode.text.replace(/^['"`]|['"`]$/g, '');
      rawEdges.push({
        source_id: parentId || filePath + '#module#' + path.basename(filePath) + '#L0',
        target_name: rawPath,
        target_path_raw: rawPath,
        kind: 'imports_from',
      });
    }
  } else {
    for (let i = 0; i < tsNode.childCount; i++) {
      extractGoImportSpecs(tsNode.child(i), filePath, rawEdges, parentId);
    }
  }
}

// ---------------------------------------------------------------------------
// Java AST 提取
// ---------------------------------------------------------------------------

/**
 * 递归提取 Java AST 节点
 */
function extractJavaNodes(tsNode, filePath, isTestFile, nodes, rawEdges, parentId) {
  if (!tsNode) return;
  const type = tsNode.type;

  // import 声明
  if (type === 'import_declaration') {
    // 取 scoped_identifier 或 identifier
    for (let i = 0; i < tsNode.childCount; i++) {
      const c = tsNode.child(i);
      if (c.type === 'scoped_identifier' || c.type === 'identifier') {
        const rawPath = c.text;
        rawEdges.push({
          source_id: parentId || filePath + '#module#' + path.basename(filePath) + '#L0',
          target_name: rawPath,
          target_path_raw: rawPath,
          kind: 'imports_from',
        });
        break;
      }
    }
    return;
  }

  // 类声明
  if (type === 'class_declaration') {
    const name = getFieldText(tsNode, 'name') || '<anonymous>';
    const node = buildNode(filePath, 'class', name, getLineStart(tsNode), getLineEnd(tsNode), isTestFile);
    nodes.push(node);
    if (parentId) {
      rawEdges.push({ source_id: parentId, target_name: name, target_path_raw: null, kind: 'contains' });
    }
    for (let i = 0; i < tsNode.childCount; i++) {
      extractJavaNodes(tsNode.child(i), filePath, isTestFile, nodes, rawEdges, node.id);
    }
    return;
  }

  // 接口声明
  if (type === 'interface_declaration') {
    const name = getFieldText(tsNode, 'name') || '<anonymous>';
    const node = buildNode(filePath, 'interface', name, getLineStart(tsNode), getLineEnd(tsNode), isTestFile);
    nodes.push(node);
    if (parentId) {
      rawEdges.push({ source_id: parentId, target_name: name, target_path_raw: null, kind: 'contains' });
    }
    return;
  }

  // 方法声明
  if (type === 'method_declaration') {
    const name = getFieldText(tsNode, 'name') || '<anonymous>';
    const node = buildNode(filePath, 'method', name, getLineStart(tsNode), getLineEnd(tsNode), isTestFile);
    nodes.push(node);
    if (parentId) {
      rawEdges.push({ source_id: parentId, target_name: name, target_path_raw: null, kind: 'contains' });
    }
    return;
  }

  for (let i = 0; i < tsNode.childCount; i++) {
    extractJavaNodes(tsNode.child(i), filePath, isTestFile, nodes, rawEdges, parentId);
  }
}

// ---------------------------------------------------------------------------
// Rust AST 提取
// ---------------------------------------------------------------------------

/**
 * 递归提取 Rust AST 节点
 */
function extractRustNodes(tsNode, filePath, isTestFile, nodes, rawEdges, parentId) {
  if (!tsNode) return;
  const type = tsNode.type;

  // use 声明 → imports_from
  if (type === 'use_declaration') {
    const argNode = tsNode.childForFieldName('argument');
    const rawPath = argNode ? argNode.text : '';
    rawEdges.push({
      source_id: parentId || filePath + '#module#' + path.basename(filePath) + '#L0',
      target_name: rawPath,
      target_path_raw: rawPath,
      kind: 'imports_from',
    });
    return;
  }

  // 函数
  if (type === 'function_item') {
    const name = getFieldText(tsNode, 'name') || '<anonymous>';
    const node = buildNode(filePath, 'function', name, getLineStart(tsNode), getLineEnd(tsNode), isTestFile);
    nodes.push(node);
    if (parentId) {
      rawEdges.push({ source_id: parentId, target_name: name, target_path_raw: null, kind: 'contains' });
    }
    for (let i = 0; i < tsNode.childCount; i++) {
      extractRustNodes(tsNode.child(i), filePath, isTestFile, nodes, rawEdges, node.id);
    }
    return;
  }

  // struct
  if (type === 'struct_item') {
    const name = getFieldText(tsNode, 'name') || '<anonymous>';
    const node = buildNode(filePath, 'struct', name, getLineStart(tsNode), getLineEnd(tsNode), isTestFile);
    nodes.push(node);
    if (parentId) {
      rawEdges.push({ source_id: parentId, target_name: name, target_path_raw: null, kind: 'contains' });
    }
    return;
  }

  // trait → interface
  if (type === 'trait_item') {
    const name = getFieldText(tsNode, 'name') || '<anonymous>';
    const node = buildNode(filePath, 'interface', name, getLineStart(tsNode), getLineEnd(tsNode), isTestFile);
    nodes.push(node);
    if (parentId) {
      rawEdges.push({ source_id: parentId, target_name: name, target_path_raw: null, kind: 'contains' });
    }
    return;
  }

  // impl 块：递归提取内部 function_item
  if (type === 'impl_item') {
    for (let i = 0; i < tsNode.childCount; i++) {
      extractRustNodes(tsNode.child(i), filePath, isTestFile, nodes, rawEdges, parentId);
    }
    return;
  }

  for (let i = 0; i < tsNode.childCount; i++) {
    extractRustNodes(tsNode.child(i), filePath, isTestFile, nodes, rawEdges, parentId);
  }
}

// ---------------------------------------------------------------------------
// C / C++ AST 提取
// ---------------------------------------------------------------------------

/**
 * 递归提取 C/C++ AST 节点
 */
function extractCNodes(tsNode, filePath, isTestFile, nodes, rawEdges, parentId) {
  if (!tsNode) return;
  const type = tsNode.type;

  // #include → imports_from
  if (type === 'preproc_include') {
    // path 可能是 string_literal 或 system_lib_string
    let rawPath = null;
    for (let i = 0; i < tsNode.childCount; i++) {
      const c = tsNode.child(i);
      if (c.type === 'string_literal' || c.type === 'system_lib_string') {
        rawPath = c.text.replace(/^["<]|[">]$/g, '');
        break;
      }
    }
    rawEdges.push({
      source_id: parentId || filePath + '#module#' + path.basename(filePath) + '#L0',
      target_name: rawPath || '',
      target_path_raw: rawPath,
      kind: 'imports_from',
    });
    return;
  }

  // 函数定义
  if (type === 'function_definition') {
    // 从 declarator 提取函数名
    const name = extractCFunctionName(tsNode) || '<anonymous>';
    const node = buildNode(filePath, 'function', name, getLineStart(tsNode), getLineEnd(tsNode), isTestFile);
    nodes.push(node);
    if (parentId) {
      rawEdges.push({ source_id: parentId, target_name: name, target_path_raw: null, kind: 'contains' });
    }
    return;
  }

  // struct
  if (type === 'struct_specifier') {
    const name = getFieldText(tsNode, 'name') || '<anonymous>';
    const node = buildNode(filePath, 'struct', name, getLineStart(tsNode), getLineEnd(tsNode), isTestFile);
    nodes.push(node);
    if (parentId) {
      rawEdges.push({ source_id: parentId, target_name: name, target_path_raw: null, kind: 'contains' });
    }
    return;
  }

  // C++ class
  if (type === 'class_specifier') {
    const name = getFieldText(tsNode, 'name') || '<anonymous>';
    const node = buildNode(filePath, 'class', name, getLineStart(tsNode), getLineEnd(tsNode), isTestFile);
    nodes.push(node);
    if (parentId) {
      rawEdges.push({ source_id: parentId, target_name: name, target_path_raw: null, kind: 'contains' });
    }
    return;
  }

  for (let i = 0; i < tsNode.childCount; i++) {
    extractCNodes(tsNode.child(i), filePath, isTestFile, nodes, rawEdges, parentId);
  }
}

/**
 * 从 function_definition 节点递归提取函数名
 * C/C++ 的函数名藏在 declarator 链中：function_declarator → declarator → identifier
 *
 * @param {object} tsNode
 * @returns {string|null}
 */
function extractCFunctionName(tsNode) {
  // 直接查 declarator 字段
  const declarator = tsNode.childForFieldName('declarator');
  if (!declarator) return null;
  return extractCDeclaratorName(declarator);
}

/**
 * 递归从 declarator 节点中提取最终的 identifier
 */
function extractCDeclaratorName(tsNode) {
  if (tsNode.type === 'identifier') return tsNode.text;
  if (tsNode.type === 'function_declarator') {
    const inner = tsNode.childForFieldName('declarator');
    if (inner) return extractCDeclaratorName(inner);
  }
  if (tsNode.type === 'pointer_declarator') {
    const inner = tsNode.childForFieldName('declarator');
    if (inner) return extractCDeclaratorName(inner);
  }
  // 其他情况逐个子节点找 identifier
  for (let i = 0; i < tsNode.childCount; i++) {
    const result = extractCDeclaratorName(tsNode.child(i));
    if (result) return result;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 按语言分发 AST 提取
// ---------------------------------------------------------------------------

/**
 * 根据语言选择对应的 AST 提取函数
 *
 * @param {string} lang
 * @returns {Function|null}
 */
function getExtractFn(lang) {
  switch (lang) {
    case 'javascript':
    case 'typescript':
    case 'tsx':
      return extractJsNodes;
    case 'python':
      return extractPyNodes;
    case 'go':
      return extractGoNodes;
    case 'java':
      return extractJavaNodes;
    case 'rust':
      return extractRustNodes;
    case 'c':
    case 'cpp':
      return extractCNodes;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// 主函数：parseFile
// ---------------------------------------------------------------------------

/**
 * 解析单个文件，返回 nodes 和 rawEdges。
 *
 * @param {string} filePath - 相对于 repoRoot 的文件路径
 * @param {string} repoRoot - 仓库根目录绝对路径
 * @param {object} [options]
 * @param {string|null} [options.lang=null] - 强制指定语言（null 时自动推导）
 * @returns {{ nodes: object[], rawEdges: object[], skipped: boolean, reason?: string, sha256?: string }}
 */
function parseFile(filePath, repoRoot, options = {}) {
  const { lang: forceLang = null } = options;

  // ----- 步骤 1：敏感文件前置过滤 -----
  const basename = path.basename(filePath);
  if (isSensitiveFile(basename)) {
    return { nodes: [], rawEdges: [], skipped: true, reason: 'sensitive' };
  }

  // ----- 步骤 2：推导语言 -----
  const lang = forceLang !== null ? forceLang : inferLanguage(filePath);

  // v1 显式不支持的语言（mm/m/swift/kt/kts 等，inferLanguage 返回 null）
  if (lang === null) {
    return { nodes: [], rawEdges: [], skipped: true, reason: 'unsupported_lang' };
  }

  // ----- 步骤 3：TOCTOU-safe 单次文件读取 -----
  const absolutePath = path.resolve(repoRoot, filePath);
  let bytes;
  try {
    bytes = fs.readFileSync(absolutePath);
  } catch (err) {
    return { nodes: [], rawEdges: [], skipped: true, reason: `read_error: ${err.message}` };
  }

  // SHA256（同 bytes，TOCTOU-safe）
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  // UTF-8 内容（同 bytes）
  const content = bytes.toString('utf8');

  // ----- 步骤 4：.h 文件 ObjC 启发式路由 -----
  // 如果语言为 c，但内容含 @interface / @implementation → objc
  // v1 不支持 objc，降级为 skip
  if (lang === 'c' && /^\s*@(interface|implementation)\b/m.test(content)) {
    return { nodes: [], rawEdges: [], skipped: true, reason: 'unsupported_lang' };
  }

  // ----- 步骤 5：构建 module 节点（每个文件必有） -----
  const isTestFile = TEST_FILE_RE.test(filePath);
  const moduleNode = buildModuleNode(filePath, isTestFile);
  const nodes = [moduleNode];
  const rawEdges = [];

  // ----- 步骤 6：尝试 tree-sitter 解析 -----
  const parser = getParser(lang);
  if (!parser) {
    // tree-sitter 未安装：graceful degradation，保留 module 节点
    return { nodes, rawEdges, skipped: false, reason: 'no_parser', sha256 };
  }

  // ----- 步骤 7：AST 解析 -----
  let tree;
  try {
    tree = parser.parse(content);
  } catch (err) {
    // 解析失败（如语法错误过多），保留 module 节点
    return { nodes, rawEdges, skipped: false, reason: `parse_error: ${err.message}`, sha256 };
  }

  const extractFn = getExtractFn(lang);
  if (extractFn) {
    extractFn(tree.rootNode, filePath, isTestFile, nodes, rawEdges, moduleNode.id);
  }

  attachLocalTargetIds(nodes, rawEdges);

  // 为所有顶层非 module 节点添加 defined_in 边（指向 module 节点）
  // （已通过 contains 边在递归中添加；此处补充直接子节点的 defined_in 边）
  for (const node of nodes) {
    if (node.kind !== 'module') {
      rawEdges.push({
        source_id: node.id,
        target_name: path.basename(filePath),
        target_path_raw: filePath,
        kind: 'defined_in',
      });
    }
  }

  return { nodes, rawEdges, skipped: false, sha256 };
}

// ---------------------------------------------------------------------------
// 导出
// ---------------------------------------------------------------------------
module.exports = {
  parseFile,
  inferLanguage,
  buildSymbolKey,
  TEST_FILE_RE,
  TEST_NAME_RE,
  getParser,
};
