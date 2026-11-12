// 公演 LP ジェネレータ：JSON → 検証 → LP（単体の HTML）と OGP 画像（1200×630）を生成する。曜日は日付から計算し、明朝は使う字だけを読む
import { F } from './data.js';
const $ = id => document.getElementById(id);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
$('tool').textContent = F.tool; $('lead').textContent = F.lead; $('discl').textContent = F.disclosure;

const THEMES = {
  night: { name: '夜', bg: '#0a0908', ink: '#efe9e0', sub: '#bcb5aa', line: 'rgba(239,233,224,.16)', card: '#141210' },
  paper: { name: '紙', bg: '#f3eee4', ink: '#1e1a16', sub: '#5b534a', line: 'rgba(30,26,22,.16)', card: '#ebe4d6' },
  white: { name: '白', bg: '#ffffff', ink: '#141414', sub: '#555555', line: '#e2e2e2', card: '#f5f5f5' },
};
const KEYS = [
  ['title', '必須。公演名'], ['kana', '読み（題の上に小さく）'], ['genre', '種類・回数など'], ['copy', '一行のコピー'], ['story', 'あらすじ（段落は改行2つ）'],
  ['company', '必須。主催・団体'], ['venue', '必須。劇場'], ['period', '必須。{"from":"YYYY-MM-DD","to":"YYYY-MM-DD"}。曜日は自動'],
  ['times', '[["平日","19:00"], …]'], ['seats', '[["席種","料金"], …]'], ['sale', '一般発売日 YYYY-MM-DD'], ['cast', '[["名前","役"], …]'], ['credits', '[["役割","名前"], …]'],
  ['ticket_url', 'チケット購入先の URL（https://…）。ないときはページ内のチケットの節へ'], ['url', 'このページを置く URL（https://…/）。og:url と og:image を自動で入れる'], ['access', '劇場の住所・行き方'], ['contact', '問い合わせ先'],
  ['accent', '差し色 #RRGGBB（背景との明暗比 3 以上）'], ['note', '注記（架空・販売の有無など）'],
];
// 項目の一覧は開いたときだけ作る（閉じているあいだは中身を持たない）
$('keys').addEventListener('toggle', () => { const dl = $('keylist'); dl.textContent = ''; if ($('keys').open) for (const [k, v] of KEYS) dl.append(el('dt', null, k), el('dd', null, v)); });

// 部品
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WD = '日月火水木金土';
const parseDate = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return null; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCMonth() === +m[2] - 1 ? d : null; };
const md = d => `${d.getUTCMonth() + 1}.${d.getUTCDate()}`, wd = d => WD[d.getUTCDay()];
const lum = hex => { const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const pairs = (v) => Array.isArray(v) && v.every(p => Array.isArray(p) && p.length === 2 && p.every(x => typeof x === 'string' && x.trim()));

// 検証：エラー（作れない）と注意（作れるが直したい）
function check(src, theme) {
  const E = [], W = [];
  let D; try { D = JSON.parse(src); } catch (e) {
    const m = /position (\d+)/.exec(e.message), pos = m ? +m[1] : -1, line = pos >= 0 ? src.slice(0, pos).split('\n').length : null;
    return { E: [`JSON の書き方に誤りがあります${line ? `（${line}行目あたり）` : ''}。カンマや " の閉じ忘れを確かめてください`], W, D: null };
  }
  if (!D || typeof D !== 'object' || Array.isArray(D)) return { E: ['いちばん外側は { } で囲んでください'], W, D: null };
  for (const k of ['title', 'company', 'venue']) if (typeof D[k] !== 'string' || !D[k].trim()) E.push(`${k}（${KEYS.find(x => x[0] === k)[1].replace('必須。', '')}）は必須です`);
  const p = D.period || {}, a = parseDate(p.from), b = parseDate(p.to);
  if (!a || !b) E.push('period の from と to は "2027-03-05" の形の、ある日付で書いてください');
  else if (b < a) E.push('period の to が from より前になっています');
  for (const k of ['times', 'seats', 'cast', 'credits']) { if (D[k] != null && !pairs(D[k])) E.push(`${k} は [["…","…"], …] の形（2つずつの文字の組）で書いてください`); else if (Array.isArray(D[k]) && !D[k].length) W.push(`${k} が空なので、その行・節は出しません`); }
  for (const k of ['ticket_url', 'url']) if (D[k] != null && !/^https:\/\/[^\s"<>]+$/.test(D[k])) E.push(`${k} は https:// で始まる URL で書いてください`);
  if (typeof D.title === 'string' && [...D.title].length > 24) W.push('題が長いので、OGP 画像では2行に分けて組みます');
  if (D.sale != null) { const s = parseDate(D.sale); if (!s) E.push('sale は "2027-01-16" の形の、ある日付で書いてください'); else if (a && s > a) W.push('一般発売日が初日より後になっています'); }
  const known = new Set(KEYS.map(k => k[0])); for (const k of Object.keys(D)) if (!known.has(k)) W.push(`${k} という項目は使いません（つづりを確かめてください）`);
  if (D.accent != null) { if (!/^#[0-9a-fA-F]{6}$/.test(D.accent)) E.push('accent は #RRGGBB の形で書いてください'); else { const r = ratio(D.accent, THEMES[theme].bg); if (r < 3) W.push(`差し色と背景の明暗比が ${r.toFixed(1)} です。3 以上にすると、ボタンや日付が読みやすくなります`); } }
  if (!D.note) W.push('note（架空の公演か、販売があるか）を書くことをすすめます');
  if (!D.seats) W.push('seats がないので、チケットの節は出ません');
  if (!D.ticket_url) W.push('ticket_url がないので、「チケット」ボタンはページ内のチケットの節へ飛びます');
  return { E, W, D };
}

// 生成：LP（単体で開ける HTML）
const MINCHO = 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;600&display=swap&text=';
// 和文の字に加えて、英数字と記号（U+0021〜U+007E）も必ず入れる（題に英字があると、そこだけ別の書体になる）
const ASCII = Array.from({ length: 94 }, (_, i) => String.fromCharCode(33 + i)).join('');
const charsOf = s => [...new Set([...s].filter(c => /[\u3000-\u30ff\u4e00-\u9fff\uff00-\uffef]/.test(c)))].sort().join('') + ASCII;
function build(D, theme) {
  const T = THEMES[theme], acc = D.accent || '#ffcf96', a = parseDate(D.period.from), b = parseDate(D.period.to), one = +a === +b, yr = a.getUTCFullYear(), cross = b.getUTCFullYear() !== yr;
  const has = k => Array.isArray(D[k]) && D[k].length > 0;
  const endTxt = d => `${cross ? `${d.getUTCFullYear()}.` : ''}${md(d)}`;
  const when = one ? `${md(a)}<small>${wd(a)}</small>` : `${md(a)}<small>${wd(a)}</small> — ${endTxt(b)}<small>${wd(b)}</small>`;
  const whenTxt = one ? `${yr}.${md(a)}（${wd(a)}）` : `${yr}.${md(a)}（${wd(a)}）— ${endTxt(b)}（${wd(b)}）`;
  const rows = list => list.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  const sale = D.sale ? parseDate(D.sale) : null;
  const sec = [];
  if (D.story) sec.push(`<section id="story"><h2>物語</h2>${String(D.story).split(/\n\s*\n/).map(t => `<p class="story">${esc(t)}</p>`).join('')}</section>`);
  sec.push(`<section id="info"><h2>公演概要</h2><dl class="dl"><div><dt>期間</dt><dd>${whenTxt}</dd></div>${has('times') ? `<div><dt>時間</dt><dd>${D.times.map(([k, v]) => `<span class="nw">${esc(k)} ${esc(v)}</span>`).join('　')}</dd></div>` : ''}<div><dt>劇場</dt><dd>${esc(D.venue)}</dd></div>${D.access ? `<div><dt>行き方</dt><dd>${esc(D.access)}</dd></div>` : ''}<div><dt>主催</dt><dd>${esc(D.company)}</dd></div>${D.contact ? `<div><dt>問い合わせ</dt><dd>${esc(D.contact)}</dd></div>` : ''}</dl></section>`);
  if (has('seats')) sec.push(`<section id="ticket"><h2>チケット</h2>${sale ? `<p class="sale">${sale.getUTCFullYear()}.${md(sale)}<small>（${wd(sale)}）一般発売</small></p>` : ''}<ul class="price">${D.seats.map(([k, v]) => `<li><span>${esc(k)}</span><b>${esc(v)}</b></li>`).join('')}</ul>${D.ticket_url ? `<p><a class="btn" href="${esc(D.ticket_url)}" rel="noopener">チケットを申し込む</a></p>` : ''}</section>`);
  if (has('cast')) sec.push(`<section id="cast"><h2>出演</h2><ul class="cast">${D.cast.map(([n, r]) => `<li><span class="r">${esc(r)}</span><span class="n">${esc(n)}</span></li>`).join('')}</ul></section>`);
  if (has('credits')) sec.push(`<section id="staff"><h2>スタッフ</h2><dl class="dl">${rows(D.credits)}</dl></section>`);
  const all = JSON.stringify(D) + '物語公演概要期間時間劇場行き方主催問い合わせチケット申し込む一般発売出演スタッフ（）—';
  // 題の大きさ：字数（英字は 0.6 字）から、幅に収まる大きさを決める
  const n = [...D.title].reduce((t, c) => t + (/[ -~]/.test(c) ? .62 : 1) + .14, 0), vw = Math.min(15, 84 / Math.max(1, n)).toFixed(2), px = Math.min(128, Math.round(1180 / Math.max(1, n)));
  const css = `:root{color-scheme:${theme === 'night' ? 'dark' : 'light'};--bg:${T.bg};--ink:${T.ink};--sub:${T.sub};--line:${T.line};--card:${T.card};--acc:${acc}}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:400 16px/1.9 "Noto Sans JP","Hiragino Sans",sans-serif;letter-spacing:.04em;line-break:strict;word-break:auto-phrase;overflow-wrap:anywhere;-webkit-font-smoothing:antialiased}
.hero{position:relative;min-height:88svh;display:flex;flex-direction:column;justify-content:flex-end;padding:120px 24px 56px;overflow:hidden;isolation:isolate}.hero>.in{width:100%;max-width:760px;margin:0 auto;display:flex;flex-direction:column}
.hero::before,.hero::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none}
.hero::before{background:radial-gradient(60% 55% at 72% 14%,color-mix(in srgb,var(--acc) 40%,transparent),transparent 70%),linear-gradient(var(--beam,105deg),transparent 50%,color-mix(in srgb,var(--acc) 15%,transparent) 59%,transparent 68%);-webkit-mask-image:linear-gradient(to bottom,#000 62%,transparent);mask-image:linear-gradient(to bottom,#000 62%,transparent);animation:on 1.6s cubic-bezier(.2,.7,.2,1) both}
.hero::after{background:radial-gradient(120% 22% at 60% 100%,color-mix(in srgb,var(--acc) 9%,transparent),transparent 70%)}
@keyframes on{from{opacity:0}}@property --beam{syntax:"<angle>";inherits:false;initial-value:105deg}
@supports (animation-timeline:scroll()){.hero::before{animation:on 1.6s cubic-bezier(.2,.7,.2,1) both,sweep linear both;animation-timeline:auto,scroll();animation-range:normal,0 100vh}@keyframes sweep{to{--beam:96deg}}}
@media (prefers-reduced-motion:reduce){.hero::before{animation:none}}
.genre{margin:0;font-size:13px;letter-spacing:.24em;color:var(--sub)}h1{margin:10px 0 0;font:600 clamp(34px,${vw}vw,${px}px)/1.18 "Shippori Mincho",serif;letter-spacing:.12em;word-break:keep-all;overflow-wrap:break-word}.kana{display:block;margin-bottom:10px;font:400 13px/1 "Noto Sans JP",sans-serif;letter-spacing:.5em;color:var(--sub)}
.copy{margin:20px 0 0;max-width:30em;font:500 17px/1.9 "Shippori Mincho",serif;letter-spacing:.08em}.when{margin:22px 0 0;font:300 clamp(28px,7.6vw,44px)/1.25 Jost,sans-serif;font-variant-numeric:tabular-nums}.when small{font:500 14px/1 "Noto Sans JP",sans-serif;color:var(--sub);margin:0 6px 0 3px}.yr{display:block;font:300 13px/1 Jost,sans-serif;letter-spacing:.3em;color:var(--sub);margin-bottom:8px}.where{margin:4px 0 0;color:var(--sub)}
.btn{display:inline-flex;align-items:center;min-height:48px;margin-top:26px;padding:0 26px;border-radius:24px;background:var(--acc);color:${ratio(acc, '#111111') > ratio(acc, '#ffffff') ? '#111' : '#fff'};text-decoration:none;font-weight:500;letter-spacing:.12em;align-self:flex-start}
main{max-width:760px;margin:0 auto;padding:0 24px}section{padding:72px 0 0}h2{margin:0 0 24px;font:600 clamp(26px,7vw,34px)/1.3 "Shippori Mincho",serif;letter-spacing:.08em}.story{font:500 16px/2 "Shippori Mincho",serif;margin:0 0 1em}
.dl{margin:0}.dl div{display:grid;grid-template-columns:5.5em 1fr;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}.dl dt{font-size:13px;color:var(--sub);letter-spacing:.1em}.dl dd{margin:0}.nw{white-space:nowrap}
.sale{margin:0 0 16px;font:300 26px/1.3 Jost,sans-serif}.sale small{font:500 14px/1 "Noto Sans JP",sans-serif;color:var(--sub);margin-left:4px}.price{list-style:none;margin:0;padding:0}.price li{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:14px 0;border-bottom:1px solid var(--line);font:600 18px/1.4 "Shippori Mincho",serif}.price b{font:400 22px/1 Jost,sans-serif;white-space:nowrap}
.cast{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(150px,100%),1fr));gap:12px}.cast li{padding:16px;background:var(--card);border-radius:6px;border-top:2px solid var(--acc)}.cast .r{display:block;font-size:12px;color:var(--sub)}.cast .n{display:block;margin-top:4px;font:600 clamp(16px,5vw,20px)/1.4 "Shippori Mincho",serif;letter-spacing:.1em;word-break:keep-all;overflow-wrap:break-word}
footer{max-width:760px;margin:96px auto 0;padding:24px 24px 56px;border-top:1px solid var(--line);font-size:13px;color:var(--sub)}footer p{margin:0 0 4px}a:focus-visible{outline:2px solid var(--acc);outline-offset:3px}
@media(min-width:900px){.hero{padding:140px 24px 80px}}`;
  const og = D.url ? `<meta property="og:url" content="${esc(D.url)}"><meta property="og:image" content="${esc(new URL(`${slug(D)}-ogp.png`, D.url).href)}">` : '';
  const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(D.title)}｜${esc(D.genre || D.company)}</title>
<meta name="description" content="${esc(D.copy || `${D.title} ${whenTxt} ${D.venue}`)}">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(D.title)}"><meta property="og:description" content="${esc(`${whenTxt} ${D.venue}`)}">${og}<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="${MINCHO}${encodeURIComponent(charsOf(all))}"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500&family=Jost:wght@300;400&display=swap">
<style>${css}</style></head><body>
<header class="hero"><div class="in">${D.genre ? `<p class="genre">${esc(D.genre)}</p>` : ''}<h1>${D.kana ? `<span class="kana">${esc(D.kana)}</span>` : ''}${esc(D.title)}</h1>${D.copy ? `<p class="copy">${esc(D.copy)}</p>` : ''}<p class="when"><span class="yr">${yr}</span>${when}</p><p class="where">${esc(D.venue)}</p>${has('seats') || D.ticket_url ? `<a class="btn" href="${D.ticket_url ? esc(D.ticket_url) : '#ticket'}"${D.ticket_url ? ' rel="noopener"' : ''}>チケット</a>` : ''}</div></header>
<main>${sec.join('')}</main>
<footer><p>主催　${esc(D.company)}</p>${D.note ? `<p>${esc(D.note)}</p>` : ''}</footer>
</body></html>`;
  return { html, whenTxt, all };
}

// OGP 画像
const cv = $('og'), g = cv.getContext('2d');
async function drawOG(D, theme, chars) {
  const T = THEMES[theme], acc = D.accent || '#ffcf96', W = 1200, H = 630;
  try { await Promise.all([document.fonts.load(`600 120px "Shippori Mincho"`, D.title), document.fonts.load('300 54px Jost', '0123456789.'), document.fonts.load('500 28px "Noto Sans JP"', chars)]); } catch {}
  g.fillStyle = T.bg; g.fillRect(0, 0, W, H);
  const rg = g.createRadialGradient(W * .74, H * .1, 0, W * .74, H * .1, W * .62); rg.addColorStop(0, acc + '66'); rg.addColorStop(1, acc + '00'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = .12; g.fillStyle = acc; g.beginPath(); g.moveTo(W * .62, 0); g.lineTo(W * .72, 0); g.lineTo(W * .5, H); g.lineTo(W * .36, H); g.closePath(); g.fill(); g.restore();
  // 長い文字は横に潰さず、末尾を「…」で切る
  const fit = (t, w) => { if (g.measureText(t).width <= w) return t; let c = [...t]; while (c.length && g.measureText(c.join('') + '…').width > w) c.pop(); return c.join('') + '…'; };
  const X = 80; g.textBaseline = 'alphabetic'; g.fillStyle = T.sub; g.font = '500 26px "Noto Sans JP", sans-serif';
  if (D.genre) g.fillText(fit(D.genre, W - 160), X, 110);
  // 題：幅に収まる大きさに（最大 150px）
  // 題：1行で 72px 以上に収まればそのまま、収まらなければ「〜・空白・読点」か真ん中で2行に分ける
  const sp = .1, font = f => { g.font = `600 ${f}px "Shippori Mincho", serif`; }, tw = (t, f) => { font(f); return [...t].reduce((w, c) => w + g.measureText(c).width + f * sp, 0); };
  const fitSize = (lines, max, min) => { let f = max; while (f > min && Math.max(...lines.map(l => tw(l, f))) > W - 160) f -= 2; return f; };
  let lines = [D.title], fs = fitSize(lines, 150, 40);
  if (fs < 72) { const cs = [...D.title], mid = cs.length / 2; let cut = -1, best = 1e9; cs.forEach((c, i) => { if (/[〜～ 　、・:：]/.test(c) && Math.abs(i - mid) < best) { best = Math.abs(i - mid); cut = i; } }); if (cut < 0) cut = Math.round(mid); lines = [cs.slice(0, cut).join('').trim(), cs.slice(cut).join('').replace(/^[ 　、]/, '').trim()].filter(Boolean); fs = fitSize(lines, 110, 40); }
  g.fillStyle = T.ink; lines.forEach((l, k) => { font(fs); let x = X; for (const c of l) { g.fillText(c, x, 140 + fs + k * fs * 1.2); x += g.measureText(c).width + fs * sp; } });
  const a = parseDate(D.period.from), b = parseDate(D.period.to), one = +a === +b, y2 = Math.min(H - 150, 140 + fs + (lines.length - 1) * fs * 1.2 + 96);
  g.font = '300 56px Jost, sans-serif'; g.fillStyle = T.ink; let s = `${a.getUTCFullYear()}.${md(a)}`; g.fillText(s, X, y2); let px = X + g.measureText(s).width + 8;
  g.font = '500 24px "Noto Sans JP", sans-serif'; g.fillStyle = T.sub; g.fillText(wd(a), px, y2); px += g.measureText(wd(a)).width + 18;
  if (!one) { g.font = '300 56px Jost, sans-serif'; g.fillStyle = T.ink; s = `— ${b.getUTCFullYear() !== a.getUTCFullYear() ? b.getUTCFullYear() + '.' : ''}${md(b)}`; g.fillText(s, px, y2); px += g.measureText(s).width + 8; g.font = '500 24px "Noto Sans JP", sans-serif'; g.fillStyle = T.sub; g.fillText(wd(b), px, y2); }
  g.font = '500 28px "Noto Sans JP", sans-serif'; g.fillStyle = T.ink; g.fillText(fit(D.venue, W - 160), X, y2 + 52);
  g.fillStyle = acc; g.fillRect(X, H - 64, 40, 3);
  g.font = '400 20px "Noto Sans JP", sans-serif'; g.fillStyle = T.sub; g.fillText(fit(D.company, 440), X + 56, H - 56);
  if (D.note) { g.textAlign = 'right'; g.fillText(fit(D.note, 540), W - 80, H - 56); g.textAlign = 'left'; }
}

// 画面
const presets = F.presets;
presets.forEach((p, i) => { const o = el('option', null, p.label); o.value = i; $('preset').append(o); });
let theme = presets[0].theme, out = null;
const themeBtns = Object.entries(THEMES).map(([k, t]) => { const b = el('button', null, t.name); b.type = 'button'; b.dataset.k = k; b.setAttribute('aria-pressed', String(k === theme)); b.addEventListener('click', () => { theme = k; themeBtns.forEach(x => x.setAttribute('aria-pressed', String(x.dataset.k === k))); update(); }); $('themes').append(b); return b; });
const setTheme = k => { theme = k; themeBtns.forEach(x => x.setAttribute('aria-pressed', String(x.dataset.k === k))); };
let dirty = false, lastPreset = 0;
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
function load(i) { $('src').value = JSON.stringify(presets[i].data, null, 2); setTheme(presets[i].theme); dirty = false; lastPreset = i; update(); }
$('preset').addEventListener('change', () => {
  // 手で書き換えたあとは、置き換える前に確かめる
  if (dirty && !confirm('編集中の内容を、見本のデータに置き換えますか？（置き換える前の内容は「JSON を保存」で残せます）')) { $('preset').value = lastPreset; return; }
  load(+$('preset').value);
});
$('save-json').addEventListener('click', () => save(new Blob([$('src').value], { type: 'application/json' }), `${curD ? slug(curD) : 'lp'}.json`));
$('open-json').addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; $('src').value = await f.text(); dirty = true; e.target.value = ''; update(); });

// プレビューの幅（実寸で描いて縮める）
let pw = 390;
document.querySelectorAll('.pvhead .seg button').forEach(b => b.addEventListener('click', () => { pw = +b.dataset.w; document.querySelectorAll('.pvhead .seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); fitFrame(); }));
function fitFrame() {
  const f = $('frame'), ifr = $('lp'), cw = f.clientWidth, ph = pw === 390 ? 844 : 800, show = pw === 390 ? Math.min(cw, 390) : cw, k = show / pw;
  ifr.style.width = `${pw}px`; ifr.style.height = `${ph}px`; ifr.style.transform = `scale(${k})`; ifr.style.left = `${(cw - pw * k) / 2}px`; f.style.height = `${ph * k}px`;
}
new ResizeObserver(fitFrame).observe($('frame'));

let tm = 0;
$('src').addEventListener('input', () => { dirty = true; clearTimeout(tm); tm = setTimeout(() => { update(); store.set('lpgen-draft', JSON.stringify({ src: $('src').value, theme })); }, 350); });
async function update() {
  const { E, W, D } = check($('src').value, theme), box = $('msgs'); box.textContent = '';
  $('src').setAttribute('aria-invalid', String(E.length > 0));
  for (const m of E) box.append(el('p', 'e', `エラー：${m}`));
  for (const m of W) box.append(el('p', 'w', `注意：${m}`));
  $('dl-html').disabled = $('dl-png').disabled = E.length > 0;
  if (E.length) { $('hint').textContent = 'エラーを直すと、プレビューと保存ができるようになります（下のプレビューは直前の正しい内容です）'; return; }
  if (!W.length) box.append(el('p', 'ok', '問題はありません'));
  out = build(D, theme);
  $('lp').srcdoc = out.html;
  const chars = charsOf(out.all + F.tool + '天狼スタジオ社内用');
  await useMincho(chars);
  await drawOG(D, theme, chars);
  $('hint').textContent = `保存した HTML は、そのままサーバーに置けます（ファイル名 ${slug(D)}.html）。OGP 画像は og:image に設定してください。`;
  curD = D;
}
let curD = null, fmHref = '';
// 明朝の字の追加読み込み：新しい stylesheet が読み終わってから描く（読み終わる前に描くと OGP の題が代わりの書体になる）
function useMincho(chars) {
  const href = MINCHO + encodeURIComponent(chars); if (href === fmHref) return Promise.resolve(); fmHref = href;
  return new Promise(res => { const l = $('fm'); l.onload = l.onerror = () => res(); l.href = href; setTimeout(res, 4000); });   // 1本の link の href だけを差し替える
}
const slug = D => (D.period.from || 'lp').replaceAll('-', '') + '-lp';
const save = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
$('dl-html').addEventListener('click', () => out && save(new Blob([out.html], { type: 'text/html' }), `${slug(curD)}.html`));
$('dl-png').addEventListener('click', () => cv.toBlob(b => b && save(b, `${slug(curD)}-ogp.png`), 'image/png'));
// 前回の下書きがあれば戻す（この端末のブラウザの中だけに残る）
const draft = (() => { try { return JSON.parse(store.get('lpgen-draft') || 'null'); } catch { return null; } })();
if (draft && draft.src) { $('src').value = draft.src; setTheme(THEMES[draft.theme] ? draft.theme : 'night'); dirty = true; update(); $('restored').hidden = false; } else load(0);
