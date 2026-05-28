#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_BG = '#FAF8F5';

function usage() {
  console.log(`Convert SVG files to PNG with local Chrome headless.

Usage:
  node svg-to-png.mjs <input.svg>
  node svg-to-png.mjs <input.svg> --out <output.png>
  node svg-to-png.mjs <input.svg> --scale 2
  node svg-to-png.mjs --batch <dir>
  node svg-to-png.mjs <input.svg> --bg "#ffffff"

The output size is derived from SVG viewBox or width/height and multiplied by
--scale (default: 2). No npm download or Bun runtime is required.`);
}

function parseArgs(argv) {
  const opts = {
    input: '',
    output: '',
    batchDir: '',
    scale: 2,
    background: DEFAULT_BG,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (arg === '--out') {
      opts.output = argv[++i] || '';
    } else if (arg === '--scale') {
      opts.scale = Number(argv[++i] || '2') || 2;
    } else if (arg === '--bg') {
      opts.background = argv[++i] || DEFAULT_BG;
    } else if (arg === '--batch') {
      opts.batchDir = argv[++i] || '';
    } else if (!arg.startsWith('-') && !opts.input) {
      opts.input = arg;
    }
  }

  return opts;
}

function chromePath() {
  const candidates = [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error('Chrome executable not found. Set CHROME_BIN to a Chrome/Chromium executable.');
  }
  return found;
}

function parseSvgDimensions(svgPath) {
  const content = fs.readFileSync(svgPath, 'utf8');
  const viewBox = content.match(/viewBox\s*=\s*["']([\d.\s,-]+)["']/i);
  if (viewBox && viewBox[1]) {
    const parts = viewBox[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }

  const width = content.match(/<svg[^>]*\bwidth\s*=\s*["']?([\d.]+)["']?/i);
  const height = content.match(/<svg[^>]*\bheight\s*=\s*["']?([\d.]+)["']?/i);
  if (width && height) {
    return { width: Number(width[1]), height: Number(height[1]) };
  }

  throw new Error(`Cannot determine SVG dimensions: ${svgPath}`);
}

function fileUrl(filePath) {
  return `file://${path.resolve(filePath).replace(/#/g, '%23').replace(/\?/g, '%3F')}`;
}

function convertOne({ input, output, scale, background }) {
  if (!fs.existsSync(input)) {
    throw new Error(`Input SVG not found: ${input}`);
  }

  const dims = parseSvgDimensions(input);
  const width = Math.round(dims.width * scale);
  const height = Math.round(dims.height * scale);
  const out = output || input.replace(/\.svg$/i, '.png');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-wechat-svg-'));
  const tmpHtml = path.join(tmpDir, 'render.html');

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: ${background};
    }
    img {
      display: block;
      width: ${width}px;
      height: ${height}px;
    }
  </style>
</head>
<body><img src="${fileUrl(input)}" alt=""></body>
</html>`;

  fs.writeFileSync(tmpHtml, html);
  fs.mkdirSync(path.dirname(out), { recursive: true });

  console.log(`[svg2png] ${input} (${dims.width}x${dims.height}) -> ${out} (${width}x${height})`);
  try {
    execFileSync(chromePath(), [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--window-size=${width},${height}`,
      `--screenshot=${path.resolve(out)}`,
      fileUrl(tmpHtml),
    ], { stdio: 'ignore' });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function convertBatch({ batchDir, scale, background }) {
  if (!batchDir || !fs.existsSync(batchDir)) {
    throw new Error(`Batch directory not found: ${batchDir}`);
  }

  const svgs = fs.readdirSync(batchDir)
    .filter((entry) => entry.toLowerCase().endsWith('.svg'))
    .sort((a, b) => a.localeCompare(b));

  if (svgs.length === 0) {
    console.log(`[svg2png] No SVG files found in ${batchDir}`);
    return;
  }

  for (const svg of svgs) {
    convertOne({
      input: path.join(batchDir, svg),
      output: path.join(batchDir, svg.replace(/\.svg$/i, '.png')),
      scale,
      background,
    });
  }
}

const opts = parseArgs(process.argv.slice(2));

try {
  if (opts.batchDir) {
    convertBatch(opts);
  } else if (opts.input) {
    convertOne(opts);
  } else {
    usage();
    process.exit(1);
  }
} catch (error) {
  console.error(`[svg2png] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
