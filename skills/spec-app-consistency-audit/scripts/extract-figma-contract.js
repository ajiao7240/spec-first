#!/usr/bin/env node
'use strict';

const path = require('node:path');

const {
  classifyEventKind,
  classifyStates,
  evidence,
  hashText,
  makeArtifact,
  parseCommonArgs,
  publicPath,
  readJson,
  resolveBoundedInputPath,
  slugify,
  sourceInputFromFile,
  unavailableSourceInput,
  unique,
  writeJsonOutput,
} = require('./lib/audit-utils');

function extractFigmaContract(options = {}) {
  const contextPath = options.figmaContext;
  if (!contextPath) {
    return makeArtifact({
      schemaVersion: 'figma-design-contract.v1',
      artifactId: 'figma-design-contract',
      sourceInputs: [unavailableSourceInput('figma', 'figma-context', 'figma_context_missing')],
      body: {
        screens: [],
        components: [],
        degraded_modes: [{
          code: 'figma_context_missing',
          severity: 'warning',
          summary: 'Figma context file was not provided; design conclusions stay out of scope.',
          path: null,
        }],
      },
    });
  }

  const repoRoot = path.resolve(options.repoRoot || options.source || process.cwd());
  const resolution = resolveBoundedInputPath({
    repoRoot,
    inputPath: contextPath,
    kind: 'figma',
    expected: 'file',
    allowOutside: options.allowOutside || options.allowOutsidePaths || [],
  });
  if (!resolution.ok) {
    throw new Error(`figma context rejected: ${resolution.reason}`);
  }
  const absolutePath = resolution.realpath;
  const context = readJson(absolutePath);
  const nodes = normalizeFigmaNodes(context);
  const screens = nodes
    .filter((node) => isScreenNode(node))
    .map((node) => normalizeScreen(node, absolutePath, repoRoot));
  const components = nodes
    .filter((node) => isComponentNode(node))
    .map((node) => normalizeComponent(node, absolutePath, repoRoot));

  return makeArtifact({
    schemaVersion: 'figma-design-contract.v1',
    artifactId: 'figma-design-contract',
    sourceInputs: [sourceInputFromFile('figma', absolutePath, repoRoot)],
    body: {
      screen_count: screens.length,
      component_count: components.length,
      screens,
      components,
      extraction_notes: [
        'Figma context is treated as host-provided untrusted input and normalized without live MCP traversal.',
      ],
      degraded_modes: [],
    },
  });
}

function normalizeFigmaNodes(context) {
  if (Array.isArray(context)) return context;
  if (Array.isArray(context.nodes)) return context.nodes;
  if (Array.isArray(context.frames)) return context.frames;
  if (context.document) return flattenNode(context.document);
  return [];
}

function flattenNode(node) {
  const result = [];
  if (!node || typeof node !== 'object') return result;
  result.push(node);
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) result.push(...flattenNode(child));
  return result;
}

function isScreenNode(node) {
  const type = String(node.type || '').toUpperCase();
  const name = String(node.name || '');
  return type === 'FRAME' || /(Screen|Page|Route|页面|首页|详情|确认|结果)/.test(name);
}

function isComponentNode(node) {
  const type = String(node.type || '').toUpperCase();
  const name = String(node.name || '');
  return type.includes('COMPONENT') || /(Button|Input|Card|Dialog|Sheet|Toast|组件)/.test(name);
}

function normalizeScreen(node, filePath, repoRoot) {
  const textEntries = collectTextEntries(node);
  const text = `${node.name || ''}\n${textEntries.map((entry) => entry.value).join('\n')}`;
  const interactionNodes = collectInteractionNodes(node).map((entry) => ({
    type: entry.type,
    node_id: entry.node_id,
    label_hash: hashText(entry.name),
    raw_label_omitted: true,
    suggested_analytics_event: `figma_${slugify(entry.node_id || hashText(entry.name).slice(7, 15))}_${entry.type === 'button' ? 'click' : 'view'}`,
    event_kind: classifyEventKind(`${entry.type}_${hashText(entry.name).slice(7, 15)}`),
  }));
  const components = collectComponentRefs(node);

  return {
    id: slugify(node.id || 'figma-screen'),
    node_id: node.id || null,
    label_hash: hashText(node.name || node.id || 'UnnamedFrame'),
    raw_label_omitted: true,
    status: 'candidate',
    states: classifyStates(text),
    components,
    texts: textEntries.map((entry) => ({
      node_id: entry.node_id,
      kind: 'text_node',
      character_count: entry.value.length,
      text_hash: hashText(entry.value),
      suggested_i18n_key: suggestTextKey(entry),
      evidence_summary: 'Figma text node candidate; raw text is omitted by default.',
    })),
    interaction_nodes: interactionNodes,
    evidence: [evidence('figma', publicPath(repoRoot, filePath, 'figma-outside-repo'), 'Figma frame candidate; raw node label omitted by default.', {
      node: node.id || null,
    })],
  };
}

function normalizeComponent(node, filePath, repoRoot) {
  const text = `${node.name || ''}\n${collectTextEntries(node).map((entry) => entry.value).join('\n')}`;
  return {
    id: slugify(node.id || 'figma-component'),
    node_id: node.id || null,
    label_hash: hashText(node.name || node.id || 'UnnamedComponent'),
    raw_label_omitted: true,
    status: 'candidate',
    variants: classifyStates(text),
    evidence: [evidence('figma', publicPath(repoRoot, filePath, 'figma-outside-repo'), 'Figma component candidate; raw node label omitted by default.', {
      node: node.id || null,
    })],
  };
}

function collectTextEntries(node) {
  const entries = [];
  visit(node, (entry) => {
    if (typeof entry.characters === 'string' && entry.characters.trim()) {
      entries.push({
        node_id: entry.id || null,
        value: entry.characters.trim(),
      });
    } else if (String(entry.type || '').toUpperCase() === 'TEXT' && entry.name) {
      entries.push({
        node_id: entry.id || null,
        value: String(entry.name).trim(),
      });
    }
  });
  return uniqueTextEntries(entries).slice(0, 100);
}

function uniqueTextEntries(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.node_id || ''}:${hashText(entry.value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function suggestTextKey(entry) {
  if (entry.node_id) return `figma_text_${slugify(entry.node_id)}`;
  return `figma_text_${hashText(entry.value).slice(7, 15)}`;
}

function collectInteractionNodes(node) {
  const nodes = [];
  visit(node, (entry) => {
    const name = String(entry.name || '');
    if (/(button|btn|submit|confirm|cancel|按钮|提交|确认|取消)/i.test(name)) {
      nodes.push({ type: 'button', name, node_id: entry.id || null });
    } else if (/(input|field|textfield|输入)/i.test(name)) {
      nodes.push({ type: 'input', name, node_id: entry.id || null });
    }
  });
  return nodes;
}

function collectComponentRefs(node) {
  const refs = [];
  visit(node, (entry) => {
    const name = String(entry.name || '');
    if (/(Button|Input|Card|Dialog|Sheet|Toast|组件)/.test(name)) {
      refs.push({
        node_id: entry.id || null,
        label_hash: hashText(name),
        raw_label_omitted: true,
      });
    }
  });
  const seen = new Set();
  return refs.filter((entry) => {
    const key = `${entry.node_id || ''}:${entry.label_hash}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function visit(node, callback) {
  if (!node || typeof node !== 'object') return;
  callback(node);
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) visit(child, callback);
}

if (require.main === module) {
  try {
    const options = parseCommonArgs(process.argv.slice(2));
    writeJsonOutput(extractFigmaContract(options), options.output);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  extractFigmaContract,
  normalizeFigmaNodes,
};
