#!/usr/bin/env bun
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const WECHAT_SKILL_DIR = path.join(os.homedir(), '.claude/skills/baoyu-post-to-wechat');
const CDP = path.join(WECHAT_SKILL_DIR, 'scripts/cdp.ts');
const {
  tryConnectExisting,
  findExistingChromeDebugPort,
  sleep,
} = await import(CDP);

function usage(): never {
  console.error(`Upload and select a WeChat article cover in the currently open editor.

Usage:
  npx -y bun upload-wechat-cover.ts --cover <cover.png> [--force] [--no-save]

The script uses the WeChat editor's image-library flow:
cover area -> 从图片库选择 -> upload file -> select image -> 下一步 -> save draft.`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const opts = {
    cover: '',
    force: false,
    save: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--cover') {
      opts.cover = argv[++i] || '';
    } else if (arg === '--force') {
      opts.force = true;
    } else if (arg === '--no-save') {
      opts.save = false;
    } else if (arg === '--help' || arg === '-h') {
      usage();
    }
  }

  if (!opts.cover) usage();
  opts.cover = path.resolve(opts.cover);
  if (!fs.existsSync(opts.cover)) {
    throw new Error(`Cover image not found: ${opts.cover}`);
  }
  return opts;
}

async function evaluate(session: any, expression: string) {
  return session.cdp.send<{ result: { value: any } }>('Runtime.evaluate', {
    expression,
    returnByValue: true,
  }, { sessionId: session.sessionId });
}

async function waitFor(session: any, expression: string, timeoutMs: number, label: string) {
  const start = Date.now();
  let lastValue: any = null;

  while (Date.now() - start < timeoutMs) {
    const result = await evaluate(session, expression);
    lastValue = result.result.value;
    if (lastValue) return lastValue;
    await sleep(500);
  }

  throw new Error(`Timed out waiting for ${label}. Last value: ${JSON.stringify(lastValue)}`);
}

async function clickVisibleByText(session: any, text: string): Promise<boolean> {
  const result = await evaluate(session, `
    (function() {
      const candidates = Array.from(document.querySelectorAll('button,a,span,div'))
        .filter((el) => (el.innerText || el.textContent || '').trim() === ${JSON.stringify(text)})
        .filter((el) => !el.disabled)
        .filter((el) => {
          const style = getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden'
            && (el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        });
      const el = candidates[0];
      if (!el) return false;
      el.scrollIntoView({ block: 'center' });
      el.click();
      return true;
    })()
  `);
  return Boolean(result.result.value);
}

async function getCoverState(session: any) {
  const result = await evaluate(session, `
    JSON.stringify((function() {
      const coverPreview = document.querySelector('.js_cover_preview_new');
      const cardThumb = document.querySelector('.js_appmsg_thumb_new');
      const coverError = document.querySelector('.js_cover_error');
      return {
        cover_preview_bg: getComputedStyle(coverPreview || document.body).backgroundImage,
        card_thumb_bg: getComputedStyle(cardThumb || document.body).backgroundImage,
        visible_cover_error: coverError && getComputedStyle(coverError).display !== 'none'
          ? coverError.innerText
          : ''
      };
    })())
  `);
  return JSON.parse(result.result.value);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const port = await findExistingChromeDebugPort();
  if (!port) throw new Error('Chrome debug port not found. Run wechat-article.ts first.');

  const cdp = await tryConnectExisting(port);
  if (!cdp) throw new Error(`Failed to connect Chrome debug port: ${port}`);

  try {
    const { targetInfos } = await cdp.send<{ targetInfos: Array<{ targetId: string; url: string; type: string }> }>('Target.getTargets', {});
    const editorTab = targetInfos.find((target) => target.type === 'page' && target.url.includes('appmsg_edit'));
    if (!editorTab) throw new Error('No WeChat article editor tab found.');

    const { sessionId } = await cdp.send<{ sessionId: string }>('Target.attachToTarget', {
      targetId: editorTab.targetId,
      flatten: true,
    });

    const session = { cdp, sessionId, targetId: editorTab.targetId };
    await cdp.send('Page.enable', {}, { sessionId });
    await cdp.send('DOM.enable', {}, { sessionId });
    await cdp.send('Runtime.enable', {}, { sessionId });

    const existing = await getCoverState(session);
    const hasCover = existing.cover_preview_bg !== 'url("")' && existing.card_thumb_bg !== 'url("")';
    if (hasCover && !opts.force) {
      console.log(JSON.stringify({ ok: true, skipped: true, reason: 'cover-already-set', ...existing }, null, 2));
      return;
    }

    const opened = await evaluate(session, `
      (function() {
        const button = document.querySelector('#js_cover_null .js_imagedialog')
          || Array.from(document.querySelectorAll('.js_imagedialog')).find((el) => {
            const style = getComputedStyle(el);
            return style.display !== 'none' || el.closest('#js_cover_area');
          });
        if (!button) return false;
        button.scrollIntoView({ block: 'center' });
        button.click();
        return true;
      })()
    `);
    if (!opened.result.value) throw new Error('Cover image-library button not found.');

    await waitFor(session, `!!document.querySelector('.weui-desktop-dialog_img-picker input[type=file]')`, 15_000, 'image picker file input');

    const doc = await cdp.send<any>('DOM.getDocument', { depth: -1, pierce: true }, { sessionId });
    const input = await cdp.send<any>('DOM.querySelector', {
      nodeId: doc.root.nodeId,
      selector: '.weui-desktop-dialog_img-picker input[type=file]',
    }, { sessionId });

    if (!input.nodeId) throw new Error('Image picker file input node not found.');

    await cdp.send('DOM.setFileInputFiles', {
      nodeId: input.nodeId,
      files: [opts.cover],
    }, { sessionId });

    const basename = path.basename(opts.cover);
    await waitFor(session, `
      Array.from(document.querySelectorAll('.weui-desktop-dialog_img-picker .weui-desktop-img-picker__item'))
        .some((item) => (item.innerText || item.textContent || '').includes(${JSON.stringify(basename)}))
    `, 30_000, `uploaded cover item ${basename}`);

    await evaluate(session, `
      (function() {
        const basename = ${JSON.stringify(basename)};
        const item = Array.from(document.querySelectorAll('.weui-desktop-dialog_img-picker .weui-desktop-img-picker__item'))
          .find((el) => (el.innerText || el.textContent || '').includes(basename));
        if (item) {
          item.scrollIntoView({ block: 'center' });
          item.click();
        }
        return !!item;
      })()
    `);

    const clickedNext = await clickVisibleByText(session, '下一步');
    if (!clickedNext) throw new Error('Image picker 下一步 button not found.');

    await sleep(3000);
    await clickVisibleByText(session, '完成');

    await waitFor(session, `
      (function() {
        const coverPreview = document.querySelector('.js_cover_preview_new');
        const cardThumb = document.querySelector('.js_appmsg_thumb_new');
        return getComputedStyle(coverPreview || document.body).backgroundImage !== 'url("")'
          && getComputedStyle(cardThumb || document.body).backgroundImage !== 'url("")';
      })()
    `, 20_000, 'non-empty cover preview and card thumbnail');

    if (opts.save) {
      await evaluate(session, `document.querySelector('#js_submit button')?.click()`);
      await sleep(3000);
    }

    const finalState = await getCoverState(session);
    console.log(JSON.stringify({ ok: true, skipped: false, saved: opts.save, ...finalState }, null, 2));
  } finally {
    cdp.close();
  }
}

main().catch((error) => {
  console.error(`[upload-cover] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
