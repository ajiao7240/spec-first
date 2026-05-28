#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(SCRIPT_DIR, '..');
const THEME_SOURCE = path.join(SKILL_DIR, 'assets', 'tech-blog.css');

function usage() {
  console.error([
    'Usage:',
    '  node scripts/install-tech-blog-theme.mjs [--skill-dir <baoyu-post-to-wechat-dir>]',
    '',
    'Default skill dir:',
    '  ~/.claude/skills/baoyu-post-to-wechat',
  ].join('\n'));
}

function parseArgs(argv) {
  let skillDir = path.join(os.homedir(), '.claude', 'skills', 'baoyu-post-to-wechat');
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--skill-dir' && argv[i + 1]) {
      skillDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    console.error(`Unknown argument: ${arg}`);
    usage();
    process.exit(1);
  }
  return { skillDir: path.resolve(skillDir) };
}

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) {
    throw new Error(`Cannot patch baoyu runtime: missing ${label}`);
  }
  return source.replace(from, to);
}

const INLINE_STYLE_HELPERS = `
function addInlineStyle(html: string, tagName: string, style: string): string {
  return html.replace(new RegExp(\`<\${tagName}([^>]*)>\`, 'g'), (match, attrs: string) => {
    if (/\\sstyle=/.test(attrs)) {
      return match.replace(/style="([^"]*)"/, (_styleMatch, existing: string) => {
        const separator = existing.trim().endsWith(';') ? ' ' : '; ';
        return \`style="\${existing}\${separator}\${style}"\`;
      });
    }
    return \`<\${tagName}\${attrs} style="\${style}">\`;
  });
}

function inlineTechBlogStyles(html: string): string {
  const styles: Record<string, string> = {
    p: 'margin:0 0 24px;font-size:16px;line-height:1.85;color:#1f2937;',
    h2: 'margin:44px 0 22px;padding:14px 16px 14px 18px;font-size:21px;line-height:1.45;font-weight:700;color:#0f172a;background:#f4f8ff;border-left:5px solid #2563eb;border-radius:4px;',
    h3: 'margin:32px 0 16px;padding:0 0 0 12px;font-size:17px;line-height:1.55;font-weight:700;color:#0f172a;background:transparent;border-left:3px solid #06b6d4;',
    blockquote: 'margin:0 0 28px;padding:16px 18px;color:#172033;background:#f5f9ff;border-left:4px solid #2563eb;border-top:1px solid #dbeafe;border-right:1px solid #dbeafe;border-bottom:1px solid #dbeafe;border-radius:4px;',
    ul: 'margin:0 0 24px;padding-left:1.35em;color:#1f2937;list-style:disc outside;',
    ol: 'margin:0 0 24px;padding-left:1.35em;color:#1f2937;list-style:decimal outside;',
    li: 'margin:0 0 8px;padding-left:0.1em;line-height:1.8;color:#1f2937;',
    figure: 'margin:10px 0 32px;padding:0;',
    img: 'display:block;width:100%;max-width:100%;height:auto;border-radius:4px;border:1px solid #e5e7eb;',
    code: 'padding:0.12em 0.34em;color:#1e3a5f;background:#eff6ff;border-radius:3px;font-family:Menlo, Monaco, Consolas, monospace;font-size:0.92em;',
  };

  return Object.entries(styles).reduce(
    (current, [tagName, style]) => addInlineStyle(current, tagName, style),
    html
  );
}
`.trim();

function installInlineStylePatch(skillDir) {
  const mdToWechatPath = path.join(skillDir, 'scripts', 'md-to-wechat.ts');
  if (!fs.existsSync(mdToWechatPath)) {
    throw new Error(`Missing baoyu md-to-wechat script: ${mdToWechatPath}`);
  }

  let source = fs.readFileSync(mdToWechatPath, 'utf8');
  source = replaceOnce(
    source,
    '\nexport async function convertMarkdown',
    `\n${INLINE_STYLE_HELPERS}\n\nexport async function convertMarkdown`,
    'tech-blog inline style helpers'
  );
  source = replaceOnce(
    source,
    '  const contentImages: ImageInfo[] = [];',
    `  if (theme === 'tech-blog') {
    const renderedHtml = fs.readFileSync(htmlPath, 'utf-8');
    fs.writeFileSync(htmlPath, inlineTechBlogStyles(renderedHtml), 'utf-8');
  }

  const contentImages: ImageInfo[] = [];`,
    'tech-blog inline style application'
  );
  fs.writeFileSync(mdToWechatPath, source, 'utf8');
}

function installTheme(skillDir) {
  const renderPath = path.join(skillDir, 'scripts', 'md', 'render.ts');
  const themeDir = path.join(skillDir, 'scripts', 'md', 'themes');
  const themeTarget = path.join(themeDir, 'tech-blog.css');

  if (!fs.existsSync(renderPath)) {
    throw new Error(`Missing baoyu renderer: ${renderPath}`);
  }
  if (!fs.existsSync(THEME_SOURCE)) {
    throw new Error(`Missing project theme source: ${THEME_SOURCE}`);
  }

  fs.mkdirSync(themeDir, { recursive: true });
  fs.copyFileSync(THEME_SOURCE, themeTarget);

  let render = fs.readFileSync(renderPath, 'utf8');
  render = replaceOnce(
    render,
    'type ThemeName = "default" | "grace" | "simple";',
    'type ThemeName = "default" | "grace" | "simple" | "tech-blog";',
    'ThemeName union'
  );
  render = replaceOnce(
    render,
    'const THEME_NAMES: ThemeName[] = ["default", "grace", "simple"];',
    'const THEME_NAMES: ThemeName[] = ["default", "grace", "simple", "tech-blog"];',
    'THEME_NAMES list'
  );
  fs.writeFileSync(renderPath, render, 'utf8');
  installInlineStylePatch(skillDir);

  const verified = fs.readFileSync(renderPath, 'utf8').includes('"tech-blog"')
    && fs.existsSync(themeTarget)
    && fs.readFileSync(path.join(skillDir, 'scripts', 'md-to-wechat.ts'), 'utf8').includes('inlineTechBlogStyles');
  if (!verified) {
    throw new Error('tech-blog theme installation verification failed');
  }

  console.log(JSON.stringify({
    ok: true,
    skillDir,
    renderPath,
    themeTarget,
  }, null, 2));
}

const { skillDir } = parseArgs(process.argv.slice(2));
installTheme(skillDir);
