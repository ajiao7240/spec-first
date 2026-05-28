#!/usr/bin/env bun
/**
 * svg-to-png.ts — Convert SVG files to PNG preserving original viewBox aspect ratio.
 *
 * Background:
 *   Some SVG → PNG converters (e.g., default rsvg or naive sharp configs) force
 *   the output to a square (e.g. 2000×2000), which crops or stretches diagrams.
 *   For spec-first 文章系列, we always want PNG output to match the SVG viewBox
 *   ratio exactly, scaled by a configurable factor (default 2x for retina).
 *
 * Approach:
 *   Reuse the running Chrome (CDP) used by baoyu-post-to-wechat. For each SVG:
 *     1. Parse viewBox / width / height to compute target W×H
 *     2. Wrap the SVG in a minimal HTML page with body sized to W×H
 *     3. Open as a new Chrome tab via Target.createTarget
 *     4. Override viewport via Emulation.setDeviceMetricsOverride
 *     5. Page.captureScreenshot with explicit clip {0,0,W,H}
 *     6. Save PNG, close tab
 *
 * Usage:
 *   # Convert one SVG (auto-detects size from viewBox, scale=2)
 *   npx -y bun svg-to-png.ts path/to/file.svg
 *
 *   # Convert with explicit output and scale
 *   npx -y bun svg-to-png.ts path/to/file.svg --out path/to/file.png --scale 3
 *
 *   # Batch convert all SVGs in a directory
 *   npx -y bun svg-to-png.ts --batch path/to/pic-dir/
 *
 * Prerequisites:
 *   - Chrome must be running with --remote-debugging-port (the same one baoyu
 *     skills use; auto-discovered via findExistingChromeDebugPort)
 *
 * Limitations:
 *   - SVG <foreignObject> with embedded HTML must be rendered by the system
 *     browser engine; Chrome handles this correctly
 *   - Background defaults to #FAF8F5 (Blueprint Off-White, matches blueprint
 *     style guide). Override via --bg <css-color>
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Resolve baoyu-post-to-wechat CDP module via $HOME (or override via env).
// This avoids hardcoding /Users/<name>/... paths that break on other machines.
const BAOYU_WECHAT_DIR = process.env.BAOYU_WECHAT_SKILL_DIR
  || path.join(os.homedir(), '.claude/skills/baoyu-post-to-wechat');
const CDP_MODULE = path.join(BAOYU_WECHAT_DIR, 'scripts/cdp.ts');

if (!fs.existsSync(CDP_MODULE)) {
  console.error(`[svg2png] Error: cdp.ts not found at ${CDP_MODULE}`);
  console.error(`[svg2png] Set BAOYU_WECHAT_SKILL_DIR env var to override the lookup path,`);
  console.error(`[svg2png] or install baoyu-post-to-wechat to ~/.claude/skills/baoyu-post-to-wechat/`);
  process.exit(1);
}

const { tryConnectExisting, findExistingChromeDebugPort } = await import(CDP_MODULE);

interface ConvertOptions {
  input: string;
  output: string;
  scale: number;
  background: string;
}

function parseSvgDimensions(svgPath: string): { width: number; height: number } {
  const content = fs.readFileSync(svgPath, 'utf-8');
  // Try viewBox first (most reliable)
  const viewBoxMatch = content.match(/viewBox\s*=\s*["']([\d.\s,-]+)["']/i);
  if (viewBoxMatch && viewBoxMatch[1]) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }
  // Fall back to width/height attributes
  const wMatch = content.match(/<svg[^>]*\bwidth\s*=\s*["']?([\d.]+)["']?/i);
  const hMatch = content.match(/<svg[^>]*\bheight\s*=\s*["']?([\d.]+)["']?/i);
  if (wMatch && hMatch) {
    return { width: parseFloat(wMatch[1]!), height: parseFloat(hMatch[1]!) };
  }
  throw new Error(`Cannot determine SVG dimensions: ${svgPath}`);
}

async function convertOne(opts: ConvertOptions): Promise<void> {
  const port = await findExistingChromeDebugPort();
  if (!port) throw new Error('Chrome with --remote-debugging-port not found');
  const cdp = await tryConnectExisting(port);
  if (!cdp) throw new Error('Failed to connect to Chrome CDP');

  try {
    const { width: svgW, height: svgH } = parseSvgDimensions(opts.input);
    const outW = Math.round(svgW * opts.scale);
    const outH = Math.round(svgH * opts.scale);

    console.log(`[svg2png] ${path.basename(opts.input)} (${svgW}×${svgH}) → ${path.basename(opts.output)} (${outW}×${outH}) scale=${opts.scale}x`);

    const wrapperHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
      *{margin:0;padding:0;box-sizing:border-box;}
      html,body{margin:0;padding:0;background:${opts.background};width:${outW}px;height:${outH}px;overflow:hidden;}
      img{display:block;width:${outW}px;height:${outH}px;}
    </style></head><body><img src="file://${path.resolve(opts.input)}"/></body></html>`;
    const tmpHtml = path.join('/tmp', `svg2png-${Date.now()}-${path.basename(opts.input, '.svg')}.html`);
    fs.writeFileSync(tmpHtml, wrapperHtml);

    try {
      const { targetId } = await cdp.send<{ targetId: string }>('Target.createTarget', {
        url: 'file://' + tmpHtml,
      });
      const { sessionId } = await cdp.send<{ sessionId: string }>('Target.attachToTarget', { targetId, flatten: true });

      await cdp.send('Page.enable', {}, { sessionId });
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: outW,
        height: outH,
        deviceScaleFactor: 1,
        mobile: false,
      }, { sessionId });

      // Wait for SVG rendering (foreignObject HTML elements need a tick)
      await new Promise(r => setTimeout(r, 1500));

      const screenshot = await cdp.send<{ data: string }>('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
        clip: { x: 0, y: 0, width: outW, height: outH, scale: 1 },
      }, { sessionId });

      fs.mkdirSync(path.dirname(opts.output), { recursive: true });
      fs.writeFileSync(opts.output, Buffer.from(screenshot.data, 'base64'));

      await cdp.send('Target.closeTarget', { targetId });
    } finally {
      try { fs.unlinkSync(tmpHtml); } catch (_) { /* ignore */ }
    }
  } finally {
    cdp.close();
  }
}

async function batch(dir: string, scale: number, background: string): Promise<void> {
  const entries = fs.readdirSync(dir);
  const svgs = entries.filter(f => f.toLowerCase().endsWith('.svg'));
  if (svgs.length === 0) {
    console.log(`[svg2png] No SVG files found in ${dir}`);
    return;
  }
  console.log(`[svg2png] Batch converting ${svgs.length} SVG file(s) in ${dir}`);
  for (const svg of svgs) {
    const input = path.join(dir, svg);
    const output = path.join(dir, svg.replace(/\.svg$/i, '.png'));
    await convertOne({ input, output, scale, background });
  }
}

function printUsage(): never {
  console.log(`Convert SVG files to PNG preserving original viewBox aspect ratio.

Usage:
  npx -y bun svg-to-png.ts <input.svg>                 Convert single SVG (output: <input>.png, scale 2x)
  npx -y bun svg-to-png.ts <input.svg> --out <out.png> Specify output path
  npx -y bun svg-to-png.ts <input.svg> --scale <N>     Output scale factor (default 2)
  npx -y bun svg-to-png.ts --batch <dir>               Convert all .svg files in dir
  npx -y bun svg-to-png.ts <input.svg> --bg <color>    Background CSS color (default #FAF8F5)

Examples:
  # Convert one file (scale 2x is the default for retina)
  npx -y bun svg-to-png.ts docs/11-文章系列/pic/02-ai-coding-harness-evolution.svg

  # Batch convert
  npx -y bun svg-to-png.ts --batch docs/11-文章系列/pic/

Prerequisites:
  Chrome must be running with --remote-debugging-port. The script auto-discovers
  the port via the same mechanism baoyu-post-to-wechat uses.
`);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) printUsage();

  let input: string | undefined;
  let output: string | undefined;
  let scale = 2;
  let background = '#FAF8F5';
  let batchDir: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--out' && args[i + 1]) output = args[++i];
    else if (arg === '--scale' && args[i + 1]) scale = parseFloat(args[++i]!) || 2;
    else if (arg === '--bg' && args[i + 1]) background = args[++i]!;
    else if (arg === '--batch' && args[i + 1]) batchDir = args[++i];
    else if (!arg.startsWith('-') && !input) input = arg;
  }

  if (batchDir) {
    await batch(batchDir, scale, background);
    return;
  }
  if (!input) {
    console.error('Error: missing input SVG path');
    printUsage();
  }
  if (!fs.existsSync(input)) {
    console.error(`Error: input file not found: ${input}`);
    process.exit(1);
  }
  if (!output) {
    output = input.replace(/\.svg$/i, '.png');
  }
  await convertOne({ input, output, scale, background });
}

await main().catch(err => {
  console.error(`[svg2png] Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
