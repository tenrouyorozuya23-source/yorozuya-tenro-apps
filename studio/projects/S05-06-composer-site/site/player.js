// 試聴プレイヤーと、音に反応する「照明バー」（舞台のボーダーライト）。曲ごとに光の色温度が変わる
const tracks = [...document.querySelectorAll('.track')];
let ctx, an, data, cur = null, col = '255,214,170';
const audio = new Audio(); audio.preload = 'none'; audio.crossOrigin = 'anonymous';// githack は音源を raw.githubusercontent.com へ転送する。CORS 付きで読まないと解析器を通した音が無音になる
const status = document.getElementById('now'); const heroBtn = document.getElementById('heroPlay');
function ensure() { if (ctx) return; ctx = new (window.AudioContext || window.webkitAudioContext)(); const src = ctx.createMediaElementSource(audio); an = ctx.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = .8; src.connect(an); an.connect(ctx.destination); data = new Uint8Array(an.frequencyBinCount); }
const fmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const label = (li, on) => { const b = li.querySelector('button'); b.textContent = on ? '❚❚' : '▶'; b.setAttribute('aria-label', li.dataset.title + (on ? 'を一時停止' : 'を再生')); b.setAttribute('aria-pressed', on); };
function sync() {
  const on = !audio.paused; document.body.classList.toggle('playing', on);
  tracks.forEach(t => { const me = t === cur && on; me ? t.setAttribute('data-on', '') : t.removeAttribute('data-on'); label(t, me); });
  if (heroBtn) { const me = on && cur === tracks[0]; heroBtn.textContent = me ? '❚❚ 一時停止' : '▶ 代表曲を聴く'; heroBtn.setAttribute('aria-pressed', me); }
  if (status && cur) status.textContent = (on ? '再生中：' : (audio.ended ? '再生終了：' : '一時停止：')) + cur.dataset.title;
  start();
}
function play(li) {
  ensure(); ctx.resume();
  if (cur === li && !audio.paused) { audio.pause(); return; }
  if (cur !== li) { if (cur) { cur.querySelector('.bar i').style.width = '0'; cur.querySelector('.d').textContent = '0:00 / 0:30'; } audio.src = li.dataset.src; cur = li; col = li.dataset.col || col; document.documentElement.style.setProperty('--tc', col); }
  audio.play();
}
['play', 'pause', 'ended'].forEach(e => audio.addEventListener(e, sync));
audio.addEventListener('timeupdate', () => { if (!cur) return; cur.querySelector('.bar i').style.width = (100 * audio.currentTime / (audio.duration || 30)) + '%'; cur.querySelector('.d').textContent = fmt(audio.currentTime) + ' / ' + fmt(audio.duration || 30); });
tracks.forEach(t => { label(t, false); t.querySelector('button').addEventListener('click', () => play(t)); });
if (heroBtn) heroBtn.addEventListener('click', () => play(tracks[0]));
// 灯ごとの帯域：40Hz〜12kHz を対数で等分（低い灯から高い灯へ）
const bandOf = (i, N) => { if (!ctx) return 0; const f = 40 * Math.pow(12000 / 40, (i + .5) / N); return Math.min(data.length - 1, Math.round(f / (ctx.sampleRate / an.fftSize))); };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvases = ['lights', 'mini'].map(id => document.getElementById(id)).filter(Boolean);
let running = false;
function drawOn(cv, now, live) {
  const w = cv.width = cv.clientWidth * devicePixelRatio, h = cv.height = cv.clientHeight * devicePixelRatio; const g = cv.getContext('2d'); g.clearRect(0, 0, w, h);
  const N = cv.clientWidth < 700 ? 16 : 32, mini = cv.id === 'mini', y = mini ? h * .3 : h * .16, gap = w / N;
  for (let i = 0; i < N; i++) {
    const idle = .2 + .08 * Math.sin(now / 1600 + i * .45) + .04 * Math.sin(now / 900 - i * .2);
    const v = live ? Math.min(1, Math.pow(data[bandOf(i, N)] / 235, 1.3) * 1.15) : (reduce ? .2 : idle);
    const x = gap * (i + .5), c = live ? col : (i % 2 ? '233,185,124' : '255,226,190');
    if (!mini) { const cone = g.createLinearGradient(0, y, 0, h); cone.addColorStop(0, `rgba(${c},${.18 * v})`); cone.addColorStop(.6, `rgba(${c},${.05 * v})`); cone.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = cone; g.beginPath(); g.moveTo(x - gap * .1, y); g.lineTo(x + gap * .1, y); g.lineTo(x + gap * .95, h); g.lineTo(x - gap * .95, h); g.closePath(); g.fill(); }
    const r = gap * (mini ? .32 : .5); const lamp = g.createRadialGradient(x, y, 0, x, y, r); lamp.addColorStop(0, `rgba(${c},${.25 + .75 * v})`); lamp.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = lamp; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
function frame(now) { const live = an && !audio.paused; if (live) an.getByteFrequencyData(data); canvases.forEach(cv => drawOn(cv, now, live)); if (live || !reduce) requestAnimationFrame(frame); else running = false; }
function start() { if (!running && canvases.length) { running = true; requestAnimationFrame(frame); } }
start(); addEventListener('resize', start);
// 上端の帯：ヘッダーの直下に置き、ヒーローの照明が見えている間は出さない（2段表示を避ける）
const mini = document.getElementById('mini'), hd = document.querySelector('header'), hero = document.querySelector('.hero');
if (mini) { const fit = () => mini.style.top = hd.offsetHeight + 'px'; fit(); addEventListener('resize', fit);
  if (hero) new IntersectionObserver(([e]) => document.body.classList.toggle('hero-in', e.isIntersecting), { threshold: .25 }).observe(hero); }
