/**
 * motion.js — 天狼スタジオ 決定論モーション・ライブラリ（依存なし）
 *
 * 使い方: <script src="../../tools/motion.js"></script> で読み込むと window.M に入る。
 * すべて「時刻 t の純関数」。Math.random は使わない（乱数はシード付き hash/rand）。
 *
 * ── 基本 ─────────────────────────────────────────────
 *  M.clamp(x,a=0,b=1)  M.lerp(a,b,u)  M.prog(t,start,dur)→0..1
 *  M.remap(x,a0,a1,b0,b1,clamp=true)  M.seg(t,t0,t1)→0..1  M.mix(a,b,u)
 * ── イージング（入力 u は 0..1） ─────────────────────
 *  M.ease.linear / inCubic / outCubic / inOutCubic / inQuart / outQuart / inOutQuart
 *  M.ease.inExpo / outExpo / inOutExpo / inBack / outBack / inOutBack / outElastic
 *  M.bezier(x1,y1,x2,y2) → (u)=>y   例: const E = M.bezier(.7,0,.2,1)（スイス派の1本）
 *  M.tw(t, start, dur, from, to, easing=M.ease.outCubic)   時間区間の補間（範囲外は端の値）
 * ── ばね（閉形式。状態を持たないので任意の t に飛べる） ─────
 *  M.spring(dt, {w=14})                 臨界減衰 1-(1+w·dt)e^(-w·dt)。dt<0 は 0
 *  M.springU(dt, {w=16, zeta=0.35})     不足減衰（行き過ぎて戻る）
 *  M.springSum(t, events, {w,zeta,from=0})  events=[{t,to}] 値の変化ごとにばねを重ねる
 * ── 並べる ───────────────────────────────────────────
 *  M.stagger(i, n, total, each)        i 番目の開始オフセット（total 秒に n 個を均等配置）
 *  M.chars(text)                        書記素単位に分割（日本語・絵文字対応）
 *  M.charStagger(t, start, text, {each=0.04, dur=0.3, easing})  → [{ch,u}] 各文字の進み
 *  M.typewriter(t, start, text, {cps=14})  → 表示する文字列（1秒あたり cps 文字）
 * ── 乱数・ノイズ ─────────────────────────────────────
 *  M.hash(n)→0..1   M.hash2(x,y)   M.rand(seed)→()=>0..1（mulberry32）
 *  M.noise1(x)  滑らかな 1D 値ノイズ（-1..1）   M.frameIdx(t,fps=30)  ちらつき用のフレーム番号
 * ── 拍（window.__DATA = bgm.py / analyze_audio.py の beats.json） ──
 *  M.beat  拍の秒数   M.bar  小節の秒数
 *  M.beatAt(t)  連続した拍番号（3.25 = 4拍目の 1/4 過ぎ）   M.barAt(t)
 *  M.timeOfBeat(i)  M.nearestBeat(t)  M.snapToBeat(t, div=1)  (div=2 で8分)
 *  M.hit(t, k=8, div=1)  拍で 1、そこから e^(-k·経過) で減衰するパルス
 *  M.cueHit(t, type, k=6)  cues の type（impact/stab 等）で同様のパルス
 *  M.cue(type, n=0)  n 番目の cue 時刻   M.env(t, a, d, at)  at で立ち上がる AD エンベロープ
 *  M.land(t, t1, d=M.beat/2, easing)  t1 ちょうどに着地する動き（開始は d 秒前）
 *  M.steps(t, a, b, n, easing)  a→b の間に n 段の階段で上がる
 * ── 数字 ─────────────────────────────────────────────
 *  M.countUp(t, start, dur, from, to, {fps=30, easing, decimals=0}) → 数値（フレーム量子化）
 *  M.fmtNum(n, {decimals=0, comma=true})
 *  M.drawFixedNum(ctx, str, x, y, {align='left'}) 数字を '0' の幅で等幅描画（ロール中に揺れない）
 *  M.scramble(t, target, locks, {fps=30, glyphs}) 桁ごとに locks[i] 秒で確定するスクランブル
 */
(function (root) {
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const prog = (t, start, dur) => (dur <= 0 ? (t >= start ? 1 : 0) : clamp((t - start) / dur));
  const seg = (t, t0, t1) => prog(t, t0, t1 - t0);
  const remap = (x, a0, a1, b0, b1, c = true) => { let u = (x - a0) / (a1 - a0); if (c) u = clamp(u); return b0 + (b1 - b0) * u; };

  const ease = {
    linear: u => u,
    inCubic: u => u * u * u,
    outCubic: u => 1 - Math.pow(1 - u, 3),
    inOutCubic: u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
    inQuart: u => u * u * u * u,
    outQuart: u => 1 - Math.pow(1 - u, 4),
    inOutQuart: u => (u < 0.5 ? 8 * u ** 4 : 1 - Math.pow(-2 * u + 2, 4) / 2),
    inExpo: u => (u <= 0 ? 0 : Math.pow(2, 10 * u - 10)),
    outExpo: u => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u)),
    inOutExpo: u => (u <= 0 ? 0 : u >= 1 ? 1 : u < 0.5 ? Math.pow(2, 20 * u - 10) / 2 : (2 - Math.pow(2, -20 * u + 10)) / 2),
    inBack: (u, s = 1.70158) => (s + 1) * u * u * u - s * u * u,
    outBack: (u, s = 1.70158) => 1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2),
    inOutBack: (u, s = 1.70158 * 1.525) => (u < 0.5 ? (Math.pow(2 * u, 2) * ((s + 1) * 2 * u - s)) / 2 : (Math.pow(2 * u - 2, 2) * ((s + 1) * (u * 2 - 2) + s) + 2) / 2),
    outElastic: u => (u <= 0 ? 0 : u >= 1 ? 1 : Math.pow(2, -10 * u) * Math.sin((u * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
  };

  // CSS 互換の cubic-bezier（ニュートン法＋二分法）
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = s => ((ax * s + bx) * s + cx) * s, sy = s => ((ay * s + by) * s + cy) * s;
    const dx = s => (3 * ax * s + 2 * bx) * s + cx;
    return u => {
      if (u <= 0) return 0; if (u >= 1) return 1;
      let s = u;
      for (let i = 0; i < 8; i++) { const e = sx(s) - u; const d = dx(s); if (Math.abs(e) < 1e-6) return sy(s); if (Math.abs(d) < 1e-6) break; s -= e / d; }
      let lo = 0, hi = 1; s = u;
      for (let i = 0; i < 30; i++) { const v = sx(s); if (Math.abs(v - u) < 1e-6) break; if (v < u) lo = s; else hi = s; s = (lo + hi) / 2; }
      return sy(s);
    };
  }
  const tw = (t, start, dur, from, to, e = ease.outCubic) => lerp(from, to, e(prog(t, start, dur)));

  // ばね: 閉形式なので決定論的（状態なし）
  const spring = (dt, { w = 14 } = {}) => (dt <= 0 ? 0 : 1 - (1 + w * dt) * Math.exp(-w * dt));
  function springU(dt, { w = 16, zeta = 0.35 } = {}) {
    if (dt <= 0) return 0;
    if (zeta >= 1) return spring(dt, { w });
    const wd = w * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w * dt) * (Math.cos(wd * dt) + (zeta * w / wd) * Math.sin(wd * dt));
  }
  // 値が events[i].t で events[i].to に変わる。変化量ごとにばねを足し合わせる
  function springSum(t, events, { w = 14, zeta = 1, from = 0 } = {}) {
    let v = from, prev = from;
    for (const e of events) {
      const d = e.to - prev; prev = e.to;
      v += d * (zeta >= 1 ? spring(t - e.t, { w }) : springU(t - e.t, { w, zeta }));
    }
    return v;
  }

  const stagger = (i, n, total, each) => (n <= 1 ? 0 : each != null ? i * each : (total * i) / (n - 1));
  function chars(text) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) return [...new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(text)].map(s => s.segment);
    return Array.from(text);
  }
  const charStagger = (t, start, text, { each = 0.04, dur = 0.3, easing = ease.outCubic } = {}) =>
    chars(text).map((ch, i) => ({ ch, i, u: easing(prog(t, start + i * each, dur)) }));
  const typewriter = (t, start, text, { cps = 14 } = {}) => { const c = chars(text); return c.slice(0, Math.floor(clamp((t - start) * cps, 0, c.length))).join(''); };

  // 乱数・ノイズ
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); };
  const hash2 = (x, y) => hash(x * 157.31 + y * 113.97);
  function rand(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let r = Math.imul(a ^ (a >>> 15), 1 | a); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
  function noise1(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i) * 2 - 1, hash(i + 1) * 2 - 1, u); }
  const frameIdx = (t, fps = 30) => Math.round(t * fps); // floor だとシャッター内で二重露光になる

  // 拍（__DATA は描画開始時に存在しない場合もあるので毎回参照）
  const D = () => root.__DATA || {};
  const beatSec = () => D().beat_sec || 0.5;
  const beatsArr = () => D().beats || null;
  function beatAt(t) {
    const b = beatsArr();
    if (!b || b.length < 2) return t / beatSec();
    if (t <= b[0]) return (t - b[0]) / beatSec();
    let lo = 0, hi = b.length - 1;
    if (t >= b[hi]) return hi + (t - b[hi]) / beatSec();
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (b[m] <= t) lo = m; else hi = m; }
    return lo + (t - b[lo]) / (b[lo + 1] - b[lo]);
  }
  function timeOfBeat(i) {
    const b = beatsArr();
    if (!b || b.length < 2) return i * beatSec();
    const k = Math.floor(i), f = i - k;
    if (k < 0) return b[0] + i * beatSec();
    if (k >= b.length - 1) return b[b.length - 1] + (i - (b.length - 1)) * beatSec();
    return lerp(b[k], b[k + 1], f);
  }
  const barAt = t => { const db = D().downbeats; if (db && db.length && D().beats) { const first = D().beats.indexOf(db[0]); return (beatAt(t) - Math.max(first, 0)) / 4; } return beatAt(t) / 4; };
  const nearestBeat = t => timeOfBeat(Math.round(beatAt(t)));
  const snapToBeat = (t, div = 1) => timeOfBeat(Math.round(beatAt(t) * div) / div);
  // +1ms: beats.json の丸め誤差を吸収
  function hit(t, k = 8, div = 1) { const b = beatAt(t + 1e-3) * div; if (b < 0) return 0; const dt = (b - Math.floor(b)) * beatSec() / div; return Math.exp(-dt * k); }
  const cues = () => D().cues || [];
  const cue = (type, n = 0) => { const c = cues().filter(c => c.type === type)[n]; return c ? c.t : null; };
  function cueHit(t, type, k = 6) { let v = 0; for (const c of cues()) if (c.type === type && t >= c.t) v = Math.max(v, Math.exp(-(t - c.t) * k)); return v; }
  const env = (t, a, d, at) => (t < at ? 0 : t < at + a ? (t - at) / a : Math.exp(-(t - at - a) / Math.max(d, 1e-6)));
  const land = (t, t1, d, easing = bezier(0.7, 0, 0.2, 1)) => easing(prog(t, t1 - (d ?? beatSec() / 2), d ?? beatSec() / 2));
  function steps(t, a, b, n, easing = bezier(0.7, 0, 0.2, 1)) { const p = seg(t, a, b) * n, i = Math.floor(p); if (i >= n) return 1; return (i + easing(p - i)) / n; }

  // 数字
  function countUp(t, start, dur, from, to, { fps = 30, easing = ease.outQuart, decimals = 0 } = {}) {
    const tq = Math.floor(t * fps) / fps; // フレーム量子化（プレビューと書き出しで同じ値）
    const v = lerp(from, to, easing(prog(tq, start, dur)));
    const p = Math.pow(10, decimals); return Math.round(v * p) / p;
  }
  const fmtNum = (n, { decimals = 0, comma = true } = {}) => { const s = n.toFixed(decimals); if (!comma) return s; const [i, f] = s.split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : ''); };
  function drawFixedNum(ctx, str, x, y, { align = 'left' } = {}) {
    const cw = ctx.measureText('0').width, wOf = ch => (/[0-9]/.test(ch) ? cw : ctx.measureText(ch).width);
    let total = 0; for (const ch of str) total += wOf(ch);
    let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
    const prevAlign = ctx.textAlign; ctx.textAlign = 'center';
    for (const ch of str) { const w = wOf(ch); ctx.fillText(ch, cx + w / 2, y); cx += w; }
    ctx.textAlign = prevAlign; return total;
  }
  function scramble(t, target, locks, { fps = 30, glyphs = '0123456789#%$&@' } = {}) {
    const f = frameIdx(t, fps);
    return chars(target).map((ch, i) => (t >= (locks[i] ?? 0) || ch === ' ' || ch === ',' ? ch : glyphs[Math.floor(hash(f * 13.7 + i * 91.3) * glyphs.length)])).join('');
  }

  root.M = {
    clamp, lerp, mix: lerp, prog, seg, remap, ease, bezier, tw,
    spring, springU, springSum, stagger, chars, charStagger, typewriter,
    hash, hash2, rand, noise1, frameIdx,
    get beat() { return beatSec(); }, get bar() { return D().bar_sec || beatSec() * 4; },
    beatAt, barAt, timeOfBeat, nearestBeat, snapToBeat, hit, cue, cueHit, env, land, steps,
    countUp, fmtNum, drawFixedNum, scramble,
  };
})(typeof window !== 'undefined' ? window : globalThis);
