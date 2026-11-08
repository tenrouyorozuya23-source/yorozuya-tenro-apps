// 冬の灯 チケット LP の A/B 見本。A＝売れた席から灯りが消えていく客席の動画、B＝その最後の静止画。
// 指標は「購入ボタン到達率」。イベントは window.dataLayer に積み、見本としてページの一覧にも出す（外部には送らない）
import { F } from './data.js';
const $ = id => document.getElementById(id);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const md = s => { const [, m, d] = s.split('-').map(Number); return `${m}.${d}`; };
$('title').textContent = F.title; $('discl').textContent = F.disclosure;
$('when').append(md(F.period.from), el('small', null, F.period.from_wd), ' — ', md(F.period.to), el('small', null, F.period.to_wd), el('small', null, `　${F.period.from.slice(0, 4)}年`));
$('where').textContent = `${F.venue}（客席${F.seats}席）`;
$('logline').textContent = F.logline; $('by').textContent = `作・演出　${F.writer_director}`;
const row = (dl, k, v) => { const d = el('div'); d.append(el('dt', null, k), el('dd', null, v)); dl.append(d); };
row($('info'), '期間', `${F.period.from.replaceAll('-', '.')}（${F.period.from_wd}）〜${F.period.to.slice(5).replace('-', '.')}（${F.period.to_wd}）`);
row($('info'), '開演', F.times.map(([a, b]) => `${a} ${b}`).join('／'));
row($('info'), '上演時間', F.running); row($('info'), '劇場', F.venue);
for (const [k, v] of F.prices) { const li = el('li', null, k); li.append(el('b', null, v)); $('price').append(li); }
const A = F.ab;
row($('spec'), '比べるもの', 'ヒーローの絵だけ（A 動画／B 静止画）。文字・ボタン・順番は同じ');
row($('spec'), '割り当て', `${A.split}。はじめて開いたときに決め、端末に覚えて以後は同じ案を出す`);
row($('spec'), '主な指標', `${A.metric}（${A.metric_def}）`);
row($('spec'), '副の指標', 'ヒーローのボタンを押した割合（cta_click の cta=hero）、予約ボタンが見えるまでの秒数、A 案の動画の再生開始率');
row($('spec'), '判定', `有意水準 ${A.alpha}・検出力 ${A.power * 100}%（両側）。期間の途中で結果を見て止めない`);

// イベント
window.dataLayer = window.dataLayer || [];
const t0 = performance.now();
function send(name, p = {}) {
  const ev = { event: name, variant, ...p }; window.dataLayer.push(ev);
  const sec = ((performance.now() - t0) / 1000).toFixed(1);
  $('evlog').append(el('li', null, `${sec}s  ${name}  ${JSON.stringify({ variant, ...p })}`));
}

// 割り当て：URL の ?v= ＞ 端末に覚えた案 ＞ 50/50 の抽選
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
let variant = new URLSearchParams(location.search).get('v');
if (!/^[ab]$/.test(variant || '')) variant = store.get('ab_variant');
const fresh = !/^[ab]$/.test(variant || '');
if (fresh) variant = Math.random() < .5 ? 'a' : 'b';
store.set('ab_variant', variant);

function hero() {
  const m = $('media'); m.textContent = '';
  if (variant === 'a') {
    const v = document.createElement('video');
    v.src = 'hero.mp4'; v.poster = 'hero_first.jpg'; v.muted = true; v.playsInline = true; v.preload = 'auto'; v.autoplay = !reduce; v.controls = reduce;   // 動きを減らす設定のときは自動で再生せず、自分で再生できるようにする
    v.setAttribute('aria-label', '客席の灯りが、売れた席から順に消えていき、残りの席だけが灯る動画（音なし）');
    v.addEventListener('play', () => send('hero_video_play'), { once: true });
    m.append(v); if (!reduce) v.play().catch(() => {});
  } else {
    const i = new Image(); i.src = 'hero.jpg'; i.alt = '売れた席の灯りが消え、残りの席だけが灯る客席'; i.width = 720; i.height = 1280; m.append(i);
  }
  document.querySelectorAll('.abbar button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === variant)));
  send('hero_view');
}
document.querySelectorAll('.abbar button').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.v === variant) return; const from = variant; variant = b.dataset.v; store.set('ab_variant', variant);
  send('ab_preview_switch', { from, to: variant });
  try { const u = new URL(location.href); u.searchParams.set('v', variant); history.replaceState(null, '', u); } catch {}   // 埋め込み先によっては URL を書き換えられない
  io.disconnect(); for (const id of timers.values()) clearTimeout(id); timers.clear(); seen.clear(); hero(); watch();   // 見本の切り替えは、はじめて開いたときと同じ状態から数え直す
}));
if (fresh) send('ab_assign');
hero();

// ボタンが半分以上・0.5 秒以上見えたら cta_visible（ボタンごとに1回。0.5 秒未満で通り過ぎたら数えない）
const seen = new Set(), timers = new Map();
const io = new IntersectionObserver(es => es.forEach(e => {
  const k = e.target.dataset.cta;
  if (e.intersectionRatio >= .5) { if (!seen.has(k) && !timers.has(k)) timers.set(k, setTimeout(() => { timers.delete(k); seen.add(k); send('cta_visible', { cta: k, sec: +((performance.now() - t0) / 1000).toFixed(1) }); }, 500)); }
  else { clearTimeout(timers.get(k)); timers.delete(k); }
}), { threshold: [.5] });
const watch = () => document.querySelectorAll('[data-cta]').forEach(b => io.observe(b));
watch(); document.querySelectorAll('[data-cta]').forEach(b => b.addEventListener('click', () => send('cta_click', { cta: b.dataset.cta })));
$('buy').addEventListener('click', () => { $('msg').textContent = '見本のため、予約はできません。押されたことだけを記録しました。'; });

// 必要な人数（2つの割合の差の検定、両側）
const Z = { a: 1.959964, b: .841621 };
function calc() {
  const a = +$('p0').value, d = +$('mde').value, ok = $('p0').value !== '' && $('mde').value !== '' && a >= 1 && a <= 95 && d >= 1 && a + d <= 99;
  $('p0').setAttribute('aria-invalid', String(!ok)); $('mde').setAttribute('aria-invalid', String(!ok)); $('nres').textContent = '';
  if (!ok) { $('nnote').textContent = '今の到達率は 1〜95%、差は 1 ポイント以上で、合計は 99% 以下で入れてください。'; $('nnote').classList.add('warn'); return; }
  $('nnote').classList.remove('warn');
  const p1 = a / 100, p2 = (a + d) / 100, pb = (p1 + p2) / 2;
  const n = Math.ceil((Z.a * Math.sqrt(2 * pb * (1 - pb)) + Z.b * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2 / (p2 - p1) ** 2);
  $('nres').append(n.toLocaleString('ja-JP'), el('small', null, '人（1案あたり）'));
  $('nnote').textContent = `到達率 ${a}% が ${a + d}% になったときに、有意水準 5%・検出力 80% で見つけられる人数です。2案で合計 ${(n * 2).toLocaleString('ja-JP')} 人が要ります（数値は例）。`;
}
$('p0').value = A.baseline_example; $('mde').value = A.mde_example;
$('p0').addEventListener('input', calc); $('mde').addEventListener('input', calc); calc();
