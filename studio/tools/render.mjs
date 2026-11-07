#!/usr/bin/env node
/**
 * Studio renderer — HTML/CSS/Canvas アニメーションをフレーム単位で
 * 決定論的に書き出し、H.264（BT.709 タグ付き）動画にする。
 *
 * usage:
 *   node render.mjs <page.html> <out.mp4> [--w 1080] [--h 1920] [--fps 30]
 *        [--dur 15] [--from 0] [--data beats.json] [--workers 4] [--png]
 *        [--blur 4] [--shutter 180] [--crf 17] [--preset slow]
 *   node render.mjs <page.html> --still 3.5:out.png,6:b.png [--data ...]   # 静止画だけ
 *
 * オプション:
 *   --workers N   Chromium を N 個起動し、フレーム範囲を連続チャンクに分けて並列に描く。
 *                 各チャンクを x264 で区間ファイルにし、最後に concat（-c copy）で結合する。
 *                 既定は min(4, CPU数)。
 *   --png         撮影を PNG にする（既定は JPEG q95。PNG は劣化ゼロだが遅い）
 *   --blur N      サブフレーム・モーションブラー。1フレームを N 枚のサブフレームの平均にする。
 *                 サブフレーム時刻 t = from + (f + shutter*((s+0.5)/N - 0.5)) / fps（中心シャッター）
 *                 平均は ffmpeg の tmix（N 枚）→ N 枚ごとに1枚を select。描画コストは N 倍。
 *   --shutter D   シャッター角（度）。既定 180（= 1/2 フレーム）。
 *   --crf / --preset  x264 の品質（既定 17 / slow）
 *
 * ページ側の約束:
 *   - CSS animation / Web Animations はそのまま書けばよい。各フレームで
 *     全アニメーションを pause して currentTime を合わせる。
 *   - Canvas 等は window.renderAt = (t) => {...} を定義すれば毎フレーム呼ばれる。
 *   - window.__DATA に --data の JSON（拍・キュー情報）が入る。window.__RENDER = true。
 *   - 準備に時間がかかるなら window.__ready = Promise を定義する。
 *   - 描画は t の純関数にする（ワーカーごとに別ブラウザで途中の t から描き始めるため、
 *     前フレームの状態に依存するとチャンク境界で絵が飛ぶ）。
 *
 * 出力: yuv420p / BT.709（matrix・primaries・transfer・limited range のタグ付き）/ +faststart。
 * 終了時に ms/frame（1フレームの seek+撮影時間）の p50/p95 と総時間を表示する。
 *
 * 今後の高速化候補（未実装）: ページが全画面 canvas だけで描く場合、page.screenshot を使わず
 * canvas.getImageData → Worker の WebSocket で生 RGBA を Node へ送り ffmpeg -f rawvideo に
 * 流すとエンコード/デコードがなくなる（mexicat/pdoom-video 方式、MIT）。DOM を使う当社ページ
 * では使えないため、まずはプロセス並列で稼ぐ。
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, renameSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
// グローバル導入の playwright を使う（ESM import では解決できないため require 経由）
const { chromium } = createRequire(import.meta.url)('playwright');

const BOOL = new Set(['png']);
const args = process.argv.slice(2);
const pos = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) { if (!BOOL.has(args[i].slice(2))) i++; continue; }
  pos.push(args[i]);
}
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const flag = k => args.includes('--' + k);
const [page_, out] = pos;
if (!page_ || (!out && !opt('still') && !opt('textcheck'))) { console.error('usage: node render.mjs page.html out.mp4 [--w --h --fps --dur --from --data --workers --png --blur --shutter]'); process.exit(1); }
const W = +opt('w', 1080), H = +opt('h', 1920), FPS = +opt('fps', 30), DUR = +opt('dur', 15), FROM = +opt('from', 0);
const WORKERS = Math.max(1, +opt('workers', Math.min(4, cpus().length)));
const BLUR = Math.max(1, Math.round(+opt('blur', 1)));
const SHUTTER = +opt('shutter', 180) / 360;
const CRF = opt('crf', '17'), PRESET = opt('preset', 'slow');
const PNG = flag('png');
const data = opt('data') ? JSON.parse(readFileSync(opt('data'), 'utf8')) : null;
// ES モジュール（three.js など）は file:// から読めないため、studio/ をローカル HTTP で配信して開く
import { createServer } from 'node:http';
import { relative, extname, sep } from 'node:path';
const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.hdr': 'application/octet-stream',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.ktx2': 'image/ktx2' };
let url = pathToFileURL(resolve(page_)).href;
const relPage = relative(ROOT, resolve(page_));
if (!relPage.startsWith('..')) {
  const server = createServer((req, res) => {
    const f = resolve(ROOT, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    try { const b = readFileSync(f); res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); res.end(b); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  server.unref();
  url = `http://127.0.0.1:${server.address().port}/${relPage.split(sep).join('/')}`;
}

const LAUNCH_ARGS = ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--hide-scrollbars', '--mute-audio'];

async function openPage() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.addInitScript(d => { window.__DATA = d; window.__RENDER = true; }, data);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { await document.fonts.ready; if (window.__ready) await window.__ready; });
  return { browser, page };
}

async function seek(page, t) {
  await page.evaluate(async t => {
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = t * 1000; }
    if (window.renderAt) await window.renderAt(t);
  }, t);
}

// ---- 文字の安全域・可読時間チェック（--textcheck 0.1）
// 見えている文字（祖先を含めた不透明度 > 0.05）の実際の字形の範囲を Range で測り、安全域と表示時間を確かめる。
// 安全域: 縦長 y260〜(H-420)・左右90px／横長と正方形は各辺5%。違反があれば終了コード 2。
const tcStep = opt('textcheck');
if (tcStep) {
  const { browser, page } = await openPage();
  const portrait = H > W;
  const SA = portrait ? { x0: 90, x1: W - 90, y0: 260, y1: H - 420 } : { x0: Math.round(W * .05), x1: Math.round(W * .95), y0: Math.round(H * .05), y1: Math.round(H * .95) };
  const step = +tcStep, seen = {}, bad = [];
  for (let t = FROM; t < FROM + DUR - 1e-6; t += step) {
    await seek(page, +t.toFixed(3));
    const items = await page.evaluate(() => {
      const out = [];
      const op = el => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; o *= +cs.opacity; } return o; };
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = walk.nextNode());) {
        const txt = n.textContent.trim(); if (!txt || n.parentElement.closest('script,style')) continue;
        const o = op(n.parentElement); if (o <= .05) continue;
        const r = document.createRange(); r.selectNodeContents(n); const b = r.getBoundingClientRect();
        if (b.width < 1 || b.height < 1) continue;
        out.push({ txt: txt.slice(0, 24), x0: Math.round(b.left), x1: Math.round(b.right), y0: Math.round(b.top), y1: Math.round(b.bottom), o: +o.toFixed(2) });
      }
      return out;
    });
    for (const it of items) {
      const k = it.txt; (seen[k] ||= { first: t, last: t, box: it }).last = t;
      if (it.x0 < SA.x0 || it.x1 > SA.x1 || it.y0 < SA.y0 || it.y1 > SA.y1) bad.push({ t: +t.toFixed(2), ...it });
    }
  }
  await browser.close();
  const read = Object.entries(seen).map(([k, v]) => ({ txt: k, from: +v.first.toFixed(2), to: +(v.last + step).toFixed(2), sec: +(v.last + step - v.first).toFixed(2), box: v.box }));
  const short = read.filter(r => r.sec < 1.8);
  const firstBad = Object.values(bad.reduce((m, b) => (m[b.txt] ||= b, m), {}));
  console.log(JSON.stringify({ safe_area: SA, violations: firstBad, short_read: short, texts: read }, null, 1));
  process.exit(firstBad.length || short.length ? 2 : 0);
}

// ---- 静止画モード
const still = opt('still');
if (still) {
  const { browser, page } = await openPage();
  for (const spec of still.split(',')) {
    const [t, file] = spec.split(':');
    await seek(page, +t);
    await page.screenshot({ path: file, type: 'png' });
    console.log('still', t, '->', file);
  }
  await browser.close();
  process.exit(0);
}

// ---- 動画モード
const total = Math.round(DUR * FPS);
const workers = Math.min(WORKERS, total);
const tmp = mkdtempSync(join(tmpdir(), 'studio-render-'));
const vf = [];
if (BLUR > 1) vf.push(`tmix=frames=${BLUR}`, `select='not(mod(n+1\\,${BLUR}))'`, `setpts=N/(${FPS}*TB)`);
vf.push('scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int', 'format=yuv420p');
const encArgs = seg => ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS * BLUR),
  '-c:v', PNG ? 'png' : 'mjpeg', '-i', '-', '-vf', vf.join(','), '-r', String(FPS),
  '-c:v', 'libx264', '-preset', PRESET, '-crf', CRF, '-profile:v', 'high', '-pix_fmt', 'yuv420p',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', seg];

const timings = [];
let done = 0;
const t0 = Date.now();
const chunk = Math.ceil(total / workers);
const ranges = Array.from({ length: workers }, (_, w) => [w * chunk, Math.min(total, (w + 1) * chunk)]).filter(([a, b]) => b > a);

async function runWorker([a, b], w) {
  const segFile = join(tmp, `seg${String(w).padStart(3, '0')}.mp4`);
  const { browser, page } = await openPage();
  const ff = spawn('ffmpeg', encArgs(segFile), { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c} (worker ${w})`)))));
  try {
    for (let f = a; f < b; f++) {
      for (let s = 0; s < BLUR; s++) {
        const off = BLUR > 1 ? SHUTTER * ((s + 0.5) / BLUR - 0.5) : 0;
        const t = Math.max(0, FROM + (f + off) / FPS);
        const ts = performance.now();
        await seek(page, t);
        const buf = await page.screenshot(PNG ? { type: 'png' } : { type: 'jpeg', quality: 95 });
        timings.push(performance.now() - ts);
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      }
      done++;
      if (done % FPS === 0) process.stdout.write(`\rframe ${done}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await ffDone;
  } finally {
    await browser.close();
  }
  return segFile;
}

try {
  const segs = await Promise.all(ranges.map((r, w) => runWorker(r, w)));
  const list = join(tmp, 'list.txt');
  writeFileSync(list, segs.map(s => `file '${s}'`).join('\n'));
  const partial = join(dirname(resolve(out)), `.${Date.now()}.partial.mp4`);
  await new Promise((res, rej) => {
    const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', partial], { stdio: 'inherit' });
    p.on('close', c => (c === 0 ? res() : rej(new Error('concat failed'))));
  });
  renameSync(partial, out);
} catch (e) {
  console.error('\nrender failed:', e.message);
  rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
}
rmSync(tmp, { recursive: true, force: true });
const sorted = timings.slice().sort((x, y) => x - y);
const pct = p => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))].toFixed(0);
const wall = (Date.now() - t0) / 1000;
console.log(`\nrendered ${out} (${total} frames${BLUR > 1 ? ` × blur ${BLUR}` : ''}, ${workers} workers, ${PNG ? 'png' : 'jpeg'})`);
console.log(`wall ${wall.toFixed(1)}s = ${(wall * 1000 / total).toFixed(0)} ms/frame effective | capture per subframe p50 ${pct(0.5)}ms p95 ${pct(0.95)}ms`);
