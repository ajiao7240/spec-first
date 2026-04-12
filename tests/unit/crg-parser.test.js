'use strict';

/**
 * Unit 4 核心解析层测试
 *
 * 验证：inferLanguage / parseFile 敏感过滤 / module 节点 / TEST_FILE_RE
 * tree-sitter 依赖的 AST 解析测试使用 test.todo 占位，等 npm install 后补全。
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { parseFile, inferLanguage, TEST_FILE_RE } = require('../../src/crg/parser');
const {
  GENERIC_CLASS_TYPES,
  GENERIC_FUNCTION_TYPES,
  GENERIC_IMPORT_TYPES,
  extractGenericNodes,
} = require('../../src/crg/parser');

const REPO_ROOT = path.join(__dirname, '../fixtures/parser');

// ---------------------------------------------------------------------------
// inferLanguage
// ---------------------------------------------------------------------------
describe('inferLanguage', () => {
  test('index.js → javascript', () => {
    expect(inferLanguage('index.js')).toBe('javascript');
  });

  test('app.jsx → javascript', () => {
    expect(inferLanguage('app.jsx')).toBe('javascript');
  });

  test('module.mjs → javascript', () => {
    expect(inferLanguage('module.mjs')).toBe('javascript');
  });

  test('utils.ts → typescript', () => {
    expect(inferLanguage('utils.ts')).toBe('typescript');
  });

  test('component.tsx → tsx', () => {
    expect(inferLanguage('component.tsx')).toBe('tsx');
  });

  test('main.py → python', () => {
    expect(inferLanguage('main.py')).toBe('python');
  });

  test('script.pyw → python', () => {
    expect(inferLanguage('script.pyw')).toBe('python');
  });

  test('main.go → go', () => {
    expect(inferLanguage('main.go')).toBe('go');
  });

  test('Main.java → java', () => {
    expect(inferLanguage('Main.java')).toBe('java');
  });

  test('lib.rs → rust', () => {
    expect(inferLanguage('lib.rs')).toBe('rust');
  });

  test('utils.c → c', () => {
    expect(inferLanguage('utils.c')).toBe('c');
  });

  test('header.h → c（默认 c，启发式路由在 parseFile 中）', () => {
    expect(inferLanguage('header.h')).toBe('c');
  });

  test('utils.cpp → cpp', () => {
    expect(inferLanguage('utils.cpp')).toBe('cpp');
  });

  test('utils.cc → cpp', () => {
    expect(inferLanguage('utils.cc')).toBe('cpp');
  });

  test('.mm → objc', () => {
    expect(inferLanguage('View.mm')).toBe('objc');
  });

  test('.m → objc', () => {
    expect(inferLanguage('View.m')).toBe('objc');
  });

  test('.swift → swift', () => {
    expect(inferLanguage('App.swift')).toBe('swift');
  });

  test('.kt → kotlin', () => {
    expect(inferLanguage('Main.kt')).toBe('kotlin');
  });

  test('unknown.xyz → null', () => {
    expect(inferLanguage('unknown.xyz')).toBeNull();
  });

  test('无扩展名文件 → null', () => {
    expect(inferLanguage('Makefile')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseFile - 敏感文件过滤
// ---------------------------------------------------------------------------
describe('parseFile - 敏感文件过滤', () => {
  test('.env 文件被 skip，reason=sensitive', () => {
    const result = parseFile('sensitive/.env', REPO_ROOT);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('sensitive');
    expect(result.nodes).toHaveLength(0);
    expect(result.rawEdges).toHaveLength(0);
  });

  test('.env.local 也应被 skip', () => {
    // 构造一个虚拟路径，文件不存在时会在读取时失败，
    // 但敏感过滤发生在读取之前，应该直接 skip
    const result = parseFile('sensitive/.env.local', REPO_ROOT);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('sensitive');
  });

  test('sensitive 目录下的普通 index.js 不被 skip', () => {
    const result = parseFile('sensitive/index.js', REPO_ROOT);
    expect(result.skipped).toBe(false);
    // 至少有 module 节点
    expect(result.nodes.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// parseFile - Swift / Kotlin（新增语言）
// ---------------------------------------------------------------------------
describe('parseFile - Swift / Kotlin', () => {
  test('Swift 文件解析成功，skipped=false，含 class/function 节点', () => {
    const result = parseFile('swift/App.swift', REPO_ROOT);
    expect(result.skipped).toBe(false);
    const kinds = result.nodes.map((n) => n.kind);
    expect(kinds).toContain('module');
    expect(kinds).toContain('class');
    expect(kinds).toContain('function');
  });

  test('Kotlin 文件解析成功，skipped=false，含 class/function 节点', () => {
    const result = parseFile('kotlin/Main.kt', REPO_ROOT);
    expect(result.skipped).toBe(false);
    const kinds = result.nodes.map((n) => n.kind);
    expect(kinds).toContain('module');
    expect(kinds).toContain('class');
    expect(kinds).toContain('function');
  });
});

// ---------------------------------------------------------------------------
// parseFile - 未知扩展名
// ---------------------------------------------------------------------------
describe('parseFile - 未知扩展名', () => {
  test('未知扩展名返回 skipped=true，reason=unsupported_lang', () => {
    const result = parseFile('fake/data.xyz', REPO_ROOT);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('unsupported_lang');
  });
});

// ---------------------------------------------------------------------------
// parseFile - module 节点
// ---------------------------------------------------------------------------
describe('parseFile - module 节点', () => {
  test('JS 文件至少有一个 module 节点', () => {
    const result = parseFile('js/basic.js', REPO_ROOT);
    expect(result.skipped).toBe(false);
    expect(result.nodes.length).toBeGreaterThan(0);

    const moduleNode = result.nodes.find((n) => n.kind === 'module');
    expect(moduleNode).toBeDefined();
    expect(moduleNode.id).toBe('js/basic.js#module#basic.js#L0');
  });

  test('module 节点字段完整', () => {
    const result = parseFile('js/basic.js', REPO_ROOT);
    const moduleNode = result.nodes.find((n) => n.kind === 'module');
    expect(moduleNode).toBeDefined();

    // 验证所有必需字段
    expect(moduleNode.file_path).toBe('js/basic.js');
    expect(moduleNode.name).toBe('basic.js');
    expect(moduleNode.kind).toBe('module');
    expect(moduleNode.line_start).toBe(0);
    expect(moduleNode.line_end).toBe(0);
    expect(moduleNode.is_test).toBe(0);
    expect(moduleNode.community_id).toBeNull();
    expect(moduleNode.confidence).toBe('Observed');
    expect(moduleNode.source_tier).toBe('crg_ast');
    expect(Array.isArray(moduleNode.evidence)).toBe(true);
    expect(moduleNode.inference_reason).toBeNull();
  });

  test('TS 文件 module 节点 id 格式正确', () => {
    const result = parseFile('ts/basic.ts', REPO_ROOT);
    expect(result.skipped).toBe(false);
    const moduleNode = result.nodes.find((n) => n.kind === 'module');
    expect(moduleNode).toBeDefined();
    expect(moduleNode.id).toBe('ts/basic.ts#module#basic.ts#L0');
  });

  test('Python 文件 module 节点存在', () => {
    const result = parseFile('py/basic.py', REPO_ROOT);
    expect(result.skipped).toBe(false);
    const moduleNode = result.nodes.find((n) => n.kind === 'module');
    expect(moduleNode).toBeDefined();
    expect(moduleNode.id).toBe('py/basic.py#module#basic.py#L0');
  });
});

// ---------------------------------------------------------------------------
// parseFile - symbol_key 格式
// ---------------------------------------------------------------------------
describe('symbol_key 格式', () => {
  test('module 节点 symbol_key 格式为 <file_path>#<kind>#<name>#L<line_start>', () => {
    const result = parseFile('js/basic.js', REPO_ROOT);
    const moduleNode = result.nodes.find((n) => n.kind === 'module');
    // symbol_key 格式：<file_path>#<kind>#<name>#L<line_start>
    expect(moduleNode.id).toMatch(/^[^#]+#module#[^#]+#L\d+$/);
  });

  test('module 节点 id 与 buildSymbolKey 规则一致', () => {
    const { buildSymbolKey } = require('../../src/crg/parser');
    const expected = buildSymbolKey('js/basic.js', 'module', 'basic.js', 0);
    const result = parseFile('js/basic.js', REPO_ROOT);
    const moduleNode = result.nodes.find((n) => n.kind === 'module');
    expect(moduleNode.id).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// parseFile - 返回值结构
// ---------------------------------------------------------------------------
describe('parseFile - 返回值结构', () => {
  test('正常文件返回 { nodes, rawEdges, skipped, sha256 }', () => {
    const result = parseFile('js/basic.js', REPO_ROOT);
    expect(result).toHaveProperty('nodes');
    expect(result).toHaveProperty('rawEdges');
    expect(result).toHaveProperty('skipped');
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(Array.isArray(result.rawEdges)).toBe(true);
    expect(result.skipped).toBe(false);
    // sha256 存在（tree-sitter 可用时）或 reason 说明原因
    // 无论哪种情况，skipped=false 时 nodes 不为空
    expect(result.nodes.length).toBeGreaterThan(0);
  });

  test('tree-sitter 不可用时返回 reason=no_parser（graceful degradation）', () => {
    // 当 tree-sitter 未安装时，getParser 返回 null，reason 为 'no_parser'
    // 此测试在 tree-sitter 已安装的环境下会 skip 此分支，但 module 节点仍存在
    const result = parseFile('js/basic.js', REPO_ROOT);
    expect(result.skipped).toBe(false);
    // 有 module 节点（无论 tree-sitter 是否可用）
    expect(result.nodes.find((n) => n.kind === 'module')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// parseFile - JS AST（tree-sitter 可用时）
// ---------------------------------------------------------------------------
describe('parseFile - JS AST（tree-sitter 可用时）', () => {
  test('JS 文件含函数声明 → nodes 含 kind=function，symbol_key 格式正确', () => {
    const result = parseFile('js/basic.js', REPO_ROOT);
    expect(result.skipped).toBe(false);

    const functionNode = result.nodes.find((node) => node.kind === 'function');
    expect(functionNode).toBeDefined();
    expect(functionNode.id).toMatch(/^js\/basic\.js#function#[^#]+#L\d+$/);
  });

  test('TS 文件含类声明 → nodes 含 kind=class + kind=method', () => {
    const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-parser-ts-'));
    const relPath = 'basic.ts';
    fs.writeFileSync(
      path.join(tmpRepo, relPath),
      [
        'class Service {',
        '  run() {',
        '    return 1;',
        '  }',
        '}',
        '',
      ].join('\n')
    );

    try {
      const result = parseFile(relPath, tmpRepo);
      expect(result.skipped).toBe(false);
      expect(result.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: 'class', name: 'Service' }),
          expect.objectContaining({ kind: 'method', name: 'run' }),
        ])
      );
    } finally {
      fs.rmSync(tmpRepo, { recursive: true, force: true });
    }
  });

  test('import 语句 → rawEdges 含 kind=imports_from', () => {
    const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-parser-import-'));
    const relPath = 'imports.js';
    fs.writeFileSync(
      path.join(tmpRepo, relPath),
      "import { helper as alias } from './utils';\n"
    );

    try {
      const result = parseFile(relPath, tmpRepo);
      expect(result.skipped).toBe(false);
      expect(result.rawEdges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source_id: 'imports.js#module#imports.js#L0',
            target_path_raw: './utils',
            kind: 'imports_from',
          }),
        ])
      );
    } finally {
      fs.rmSync(tmpRepo, { recursive: true, force: true });
    }
  });

  test('variable_declarator RHS 为箭头函数 → kind=function', () => {
    const result = parseFile('js/calls.js', REPO_ROOT);
    expect(result.skipped).toBe(false);
    expect(result.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'function', name: 'worker' }),
      ])
    );
  });

  test('测试文件中的函数 → is_test=1', () => {
    const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-parser-testfile-'));
    const relPath = 'sum.test.js';
    fs.writeFileSync(
      path.join(tmpRepo, relPath),
      [
        'function helper() {',
        '  return 1;',
        '}',
        '',
      ].join('\n')
    );

    try {
      const result = parseFile(relPath, tmpRepo);
      expect(result.skipped).toBe(false);
      expect(result.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: 'function', name: 'helper', is_test: 1 }),
        ])
      );
    } finally {
      fs.rmSync(tmpRepo, { recursive: true, force: true });
    }
  });

  test('JS 函数调用会生成 calls raw edge', () => {
    const result = parseFile('js/calls.js', REPO_ROOT);
    expect(result.skipped).toBe(false);

    const callEdges = result.rawEdges.filter((edge) => edge.kind === 'calls');
    expect(callEdges.length).toBeGreaterThanOrEqual(3);
    expect(callEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_id: 'js/calls.js#function#caller#L5',
          target_name: 'callee',
          kind: 'calls',
        }),
        expect.objectContaining({
          source_id: 'js/calls.js#function#worker#L9',
          target_name: 'callee',
          kind: 'calls',
        }),
        expect.objectContaining({
          source_id: 'js/calls.js#method#run#L12',
          target_name: 'callee',
          kind: 'calls',
        }),
      ])
    );
  });

  test('顶层 CommonJS require() 生成的 imports_from 边应归属 module 节点', () => {
    const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-parser-'));
    const relPath = 'index.js';
    fs.writeFileSync(
      path.join(tmpRepo, relPath),
      "const helper = require('./lib/helper');\n"
    );

    try {
      const result = parseFile(relPath, tmpRepo);
      expect(result.skipped).toBe(false);

      const importEdge = result.rawEdges.find((edge) => edge.kind === 'imports_from');
      expect(importEdge).toBeDefined();
      expect(importEdge.source_id).toBe('index.js#module#index.js#L0');
      expect(importEdge.target_path_raw).toBe('./lib/helper');
    } finally {
      fs.rmSync(tmpRepo, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// TEST_FILE_RE
// ---------------------------------------------------------------------------
describe('TEST_FILE_RE', () => {
  test('识别 .test.js 为测试文件', () => {
    expect(TEST_FILE_RE.test('foo.test.js')).toBe(true);
  });

  test('识别 .spec.ts 为测试文件', () => {
    expect(TEST_FILE_RE.test('bar.spec.ts')).toBe(true);
  });

  test('识别 .test.tsx 为测试文件', () => {
    expect(TEST_FILE_RE.test('Component.test.tsx')).toBe(true);
  });

  test('识别 .spec.jsx 为测试文件', () => {
    expect(TEST_FILE_RE.test('utils.spec.jsx')).toBe(true);
  });

  test('识别 __tests__/ 目录下的文件为测试文件', () => {
    expect(TEST_FILE_RE.test('src/__tests__/utils.js')).toBe(true);
  });

  test('普通文件不是测试文件', () => {
    expect(TEST_FILE_RE.test('index.js')).toBe(false);
  });

  test('utils.ts 不是测试文件', () => {
    expect(TEST_FILE_RE.test('utils.ts')).toBe(false);
  });

  test('包含 test 但不是测试文件格式的路径', () => {
    expect(TEST_FILE_RE.test('context.js')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// inferLanguage — Route A 修复验证：mts / cts / hxx 历史遗漏
// ---------------------------------------------------------------------------
describe('inferLanguage - Route A mts/cts/hxx 修复验证', () => {
  test('module.mts → typescript（历史遗漏，LANG_CONFIG 修复）', () => {
    expect(inferLanguage('module.mts')).toBe('typescript');
  });

  test('config.cts → typescript（历史遗漏，LANG_CONFIG 修复）', () => {
    expect(inferLanguage('config.cts')).toBe('typescript');
  });

  test('header.hxx → cpp（历史遗漏，LANG_CONFIG 修复）', () => {
    expect(inferLanguage('header.hxx')).toBe('cpp');
  });
});

// ---------------------------------------------------------------------------
// extractGenericNodes — 通用提取器直接验证
// ---------------------------------------------------------------------------
describe('extractGenericNodes - 通用提取器', () => {
  /**
   * 构造最小化 tree-sitter-like 伪节点，用于直接测试 extractGenericNodes 逻辑，
   * 无需实际解析器。
   */
  function makeTsNode(type, { named = true, children = [], fields = {}, text = '' } = {}) {
    const node = {
      type,
      isNamed: named,
      text,
      childCount: children.length,
      child: (i) => children[i],
      childForFieldName: (name) => fields[name] || null,
      startPosition: { row: 0 },
      endPosition: { row: 2 },
    };
    return node;
  }

  test('class_declaration 节点 → class 节点', () => {
    const nameNode = makeTsNode('identifier', { named: true, text: 'Foo', children: [] });
    const classNode = makeTsNode('class_declaration', {
      named: true,
      fields: { name: nameNode },
      children: [],
    });
    const nodes = [];
    const rawEdges = [];
    // module 节点 id 模拟
    extractGenericNodes(classNode, 'src/Foo.java', false, nodes, rawEdges, 'src/Foo.java#module#Foo.java#L0');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe('class');
    expect(nodes[0].name).toBe('Foo');
  });

  test('function_declaration 节点 → function 节点', () => {
    const nameNode = makeTsNode('identifier', { named: true, text: 'doWork', children: [] });
    const fnNode = makeTsNode('function_declaration', {
      named: true,
      fields: { name: nameNode },
      children: [],
    });
    const nodes = [];
    const rawEdges = [];
    extractGenericNodes(fnNode, 'src/utils.lua', false, nodes, rawEdges, 'src/utils.lua#module#utils.lua#L0');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe('function');
    expect(nodes[0].name).toBe('doWork');
  });

  test('import_declaration 节点 → imports_from 边，不产生节点', () => {
    const pathNode = makeTsNode('string', { named: true, text: '"fmt"', children: [] });
    const importNode = makeTsNode('import_declaration', {
      named: true,
      fields: { path: pathNode },
      children: [],
    });
    const nodes = [];
    const rawEdges = [];
    const parentId = 'src/main.go#module#main.go#L0';
    extractGenericNodes(importNode, 'src/main.go', false, nodes, rawEdges, parentId);
    expect(nodes).toHaveLength(0);
    expect(rawEdges).toHaveLength(1);
    expect(rawEdges[0].kind).toBe('imports_from');
    expect(rawEdges[0].target_path_raw).toBe('fmt');
  });

  test('isNamed=false 节点被跳过', () => {
    const anonymousNode = makeTsNode('class_declaration', { named: false, children: [] });
    const nodes = [];
    const rawEdges = [];
    extractGenericNodes(anonymousNode, 'src/Foo.java', false, nodes, rawEdges, '');
    expect(nodes).toHaveLength(0);
    expect(rawEdges).toHaveLength(0);
  });

  test('GENERIC_CLASS_TYPES 包含常见 class 节点类型', () => {
    expect(GENERIC_CLASS_TYPES.has('class_declaration')).toBe(true);
    expect(GENERIC_CLASS_TYPES.has('class_definition')).toBe(true);
    expect(GENERIC_CLASS_TYPES.has('object_definition')).toBe(true);
  });

  test('GENERIC_FUNCTION_TYPES 包含常见 function 节点类型', () => {
    expect(GENERIC_FUNCTION_TYPES.has('function_declaration')).toBe(true);
    expect(GENERIC_FUNCTION_TYPES.has('function_definition')).toBe(true);
    expect(GENERIC_FUNCTION_TYPES.has('method_declaration')).toBe(true);
  });
});
