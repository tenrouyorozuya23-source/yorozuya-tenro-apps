#!/usr/bin/env node
/**
 * Studio renderer — HTML/CSS/Canvas アニメーションをフレーム単位で
 * 決定論的に書き出し、H.264 動画にする。
 *
 * usage:
 *   node render.mjs <page.html> <out.mp4> [--w 1080] [--h 1920] [--fps 30]
 *        [--dur 15] [--data beats.json] [--from 0] [--still 3.5:out.png,...]
 *
 * ページ側の約束:
 *   - CSS animation / Web Animations はそのまま書けばよい。各フレームで
 *     全アニメーションを pause して currentTime を合わせる。
 *   - Canvas 等は window.renderAt = (t) => {...} を定義すれば毎フレーム呼ばれる。
 *   - window.__DATA に --data の JSON（拍・キュー情報）が入る。
 *   - 準備に時間がかかるなら window.__ready = Promise を定義する。
 *   - --still を付けると動画を作らずに指定秒の静止画だけ書き出す（確認用）。
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
// グローバル導入の playwright を使う（ESM import では解決できないため require 経由）
const { chromium } = createRequire(import.meta.url)('playwright');

const args = process.argv.slice(2);
const pos = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const [page_, out] = pos;
if (!page_ || (!out && !opt('still'))) { console.error('usage: node render.mjs page.html out.mp4 [--w --h --fps --dur --data]'); process.exit(1); }
const W = +opt('w', 1080), H = +opt('h', 1920), FPS = +opt('fps', 30), DUR = +opt('dur', 15), FROM = +opt('from', 0);
const data = opt('data') ? JSON.parse(readFileSync(opt('data'), 'utf8')) : null;

const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
page.on('pageerror', e => console.error('[pageerror]', e.message));
await page.addInitScript(d => { window.__DATA = d; window.__RENDER = true; }, data);
await page.goto(pathToFileURL(resolve(page_)).href, { waitUntil: 'networkidle' });
await page.evaluate(async () => { await document.fonts.ready; if (window.__ready) await window.__ready; });

async function seek(t) {
  await page.evaluate(async t => {
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = t * 1000; }
    if (window.renderAt) await window.renderAt(t);
  }, t);
}

const still = opt('still');
if (still) {
  for (const spec of still.split(',')) {
    const [t, file] = spec.split(':');
    await seek(+t);
    await page.screenshot({ path: file, type: 'png' });
    console.log('still', t, '->', file);
  }
  await browser.close();
  process.exit(0);
}

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });

const total = Math.round(DUR * FPS);
const t0 = Date.now();
for (let f = 0; f < total; f++) {
  const t = FROM + f / FPS;
  await seek(t);
  const buf = await page.screenshot({ type: 'png' });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (f % FPS === 0) process.stdout.write(`\rframe ${f}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log(`\nrendered ${out} (${total} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
