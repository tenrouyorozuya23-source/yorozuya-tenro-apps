#!/usr/bin/env node
/**
 * Web の数値ゲートを機械的に確かめる（2026-11-07、S02-06 で作成）。
 *   node tools/webcheck.mjs <studio からの相対パス/index.html> [--out dir]
 * スマホ（390×844）と PC（1440×900）で開き、次を JSON で出す。違反があれば終了コード 2。
 *   errors     … pageerror とコンソールの error
 *   hscroll    … 横スクロール（scrollWidth > innerWidth）
 *   tap        … 44px 未満のリンク・ボタン・入力（見えているものだけ）
 *   contrast   … 文字の色と、祖先をたどった背景色のコントラスト（4.5:1 未満。24px 以上か 18.66px 太字は 3:1）
 *   overlap    … 文字の箱どうしの重なり（同じ要素の親子は除く）
 * --out を付けると、全部の章を表示した状態のスクショ（sp.png / pc.png、上から）を保存する。
 * 背景が画像・グラデーションのときは、いちばん近い単色の背景で測る（目視も併用すること）。
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const args = process.argv.slice(2);
const page_ = args[0]; const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.mp4': 'video/mp4' };
const srv = http.createServer(async (q, s) => {
  try { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); s.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); s.end(await readFile(p)); }
  catch { s.writeHead(404); s.end(); }
}).listen(0);
const url = `http://127.0.0.1:${srv.address().port}/${page_}`;
const browser = await chromium.launch();
const result = {};
for (const [name, vp] of [['sp', { width: 390, height: 844 }], ['pc', { width: 1440, height: 900 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const pg = await ctx.newPage(); const errors = [];
  pg.on('pageerror', e => errors.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await pg.goto(url, { waitUntil: 'networkidle' });
  // ゆっくり最後までスクロールして、遅れて出るもの・模型の読み込みも動かす
  const H = await pg.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += vp.height / 2) { await pg.evaluate(y => scrollTo(0, y), y); await pg.waitForTimeout(120); }
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => document.querySelectorAll('.ch, .colophon, [class*="reveal"]').forEach(e => e.classList.add('on', 'in', 'shown')));
  await pg.waitForTimeout(1000);
  const r = await pg.evaluate(() => {
    const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
    const lum = ({ r, g, b }) => { const f = x => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const bgOf = el => { let stack = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; } } let base = { r: 0, g: 0, b: 0 }; const bodyC = parse(getComputedStyle(document.body).backgroundColor); if (bodyC && bodyC.a) base = bodyC; for (const c of stack.reverse()) base = { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a) }; return base; };
    const visible = el => { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none') return false; let o = 1; for (let e = el; e; e = e.parentElement) o *= +getComputedStyle(e).opacity; const b = el.getBoundingClientRect(); return o > .05 && b.width > 0 && b.height > 0; };
    const hscroll = document.documentElement.scrollWidth > innerWidth + 1;
    const tap = []; document.querySelectorAll('a[href], button, input, select, textarea, [role=button]').forEach(el => { if (!visible(el)) return; if (el.closest('.skip')) return; const b = el.getBoundingClientRect(); if (b.width < 44 || b.height < 44) { const inline = getComputedStyle(el).display === 'inline' && el.closest('p'); if (!inline) tap.push({ txt: (el.textContent || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 20), w: Math.round(b.width), h: Math.round(b.height) }); } });
    const texts = []; const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode());) { const t = n.textContent.trim(); if (!t) continue; const el = n.parentElement; if (el.closest('script,style,noscript,.skip')) continue; if (!visible(el)) continue; texts.push(el); }
    const contrast = []; const seen = new Set();
    for (const el of texts) { if (seen.has(el)) continue; seen.add(el); const s = getComputedStyle(el); const fg = parse(s.color); if (!fg) continue; let o = fg.a; for (let e = el; e; e = e.parentElement) o *= +getComputedStyle(e).opacity; const bg = bgOf(el); const f = { r: fg.r * o + bg.r * (1 - o), g: fg.g * o + bg.g * (1 - o), b: fg.b * o + bg.b * (1 - o) }; const L1 = lum(f), L2 = lum(bg); const cr = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); const px = parseFloat(s.fontSize), bold = +s.fontWeight >= 700; const need = px >= 24 || (bold && px >= 18.66) ? 3 : 4.5; if (cr < need) contrast.push({ txt: el.textContent.trim().slice(0, 20), ratio: +cr.toFixed(2), need, fg: s.color }); }
    const boxes = []; for (const el of seen) { const rg = document.createRange(); rg.selectNodeContents(el); for (const b of rg.getClientRects()) if (b.width > 2 && b.height > 2) boxes.push({ el, b }); }
    const overlap = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const A = boxes[i], B = boxes[j]; if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el)) continue; const ix = Math.min(A.b.right, B.b.right) - Math.max(A.b.left, B.b.left), iy = Math.min(A.b.bottom, B.b.bottom) - Math.max(A.b.top, B.b.top); if (ix > 3 && iy > 3) overlap.push([A.el.textContent.trim().slice(0, 16), B.el.textContent.trim().slice(0, 16)]); }
    return { hscroll, tap, contrast, overlap: overlap.slice(0, 20) };
  });
  result[name] = { errors, ...r };
  if (out) { await pg.evaluate(() => scrollTo(0, 0)); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(out, `${name}.png`), fullPage: true }); }
  await ctx.close();
}
await browser.close(); srv.close();
const bad = Object.values(result).some(r => r.errors.length || r.hscroll || r.tap.length || r.contrast.length || r.overlap.length);
console.log(JSON.stringify(result, null, 1));
process.exit(bad ? 2 : 0);
