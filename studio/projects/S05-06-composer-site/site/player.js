// 試聴プレイヤーと、音に反応する「照明バー」の可視化（舞台のボーダーライトのような横一列の光）
const tracks = [...document.querySelectorAll('.track')];
let ctx, an, data, cur = null;
const audio = new Audio(); audio.preload = 'none'; audio.crossOrigin = 'anonymous';// githack は音源を raw.githubusercontent.com へ転送する。CORS 付きで読まないと解析器を通した音が無音になる
function ensure() { if (ctx) return; ctx = new (window.AudioContext || window.webkitAudioContext)(); const src = ctx.createMediaElementSource(audio); an = ctx.createAnalyser(); an.fftSize = 256; an.smoothingTimeConstant = .82; src.connect(an); an.connect(ctx.destination); data = new Uint8Array(an.frequencyBinCount); }
function fmt(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
export function play(li) {
  ensure(); ctx.resume();
  if (cur === li && !audio.paused) { audio.pause(); return; }
  tracks.forEach(t => { t.removeAttribute('data-on'); t.querySelector('button').setAttribute('aria-label', t.dataset.title + 'を再生'); t.querySelector('button').textContent = '▶'; });
  if (cur !== li) { audio.src = li.dataset.src; cur = li; }
  audio.play(); li.setAttribute('data-on', ''); const b = li.querySelector('button'); b.textContent = '❚❚'; b.setAttribute('aria-label', li.dataset.title + 'を一時停止');
  const np = document.getElementById('now'); if (np) np.textContent = '再生中：' + li.dataset.title;
}
audio.addEventListener('pause', () => { if (cur) { cur.removeAttribute('data-on'); const b = cur.querySelector('button'); b.textContent = '▶'; b.setAttribute('aria-label', cur.dataset.title + 'を再生'); } });
audio.addEventListener('timeupdate', () => { if (!cur) return; cur.querySelector('.bar i').style.width = (100 * audio.currentTime / (audio.duration || 30)) + '%'; cur.querySelector('.d').textContent = fmt(audio.currentTime) + ' / ' + fmt(audio.duration || 30); });
tracks.forEach(t => { const b = t.querySelector('button'); b.setAttribute('aria-label', t.dataset.title + 'を再生'); b.addEventListener('click', () => play(t)); });
const heroBtn = document.getElementById('heroPlay'); if (heroBtn) heroBtn.addEventListener('click', () => play(tracks[0]));
// 照明バー：32灯が横に並び、音の帯域ごとに明るさが変わる。止まっているときはゆっくり呼吸する
const cv = document.getElementById('lights');
if (cv) {
  const g = cv.getContext('2d'); const N = innerWidth < 700 ? 16 : 32; const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const draw = (now) => {
    const w = cv.width = cv.clientWidth * devicePixelRatio, h = cv.height = cv.clientHeight * devicePixelRatio; g.clearRect(0, 0, w, h);
    if (an && !audio.paused) an.getByteFrequencyData(data);
    const y = h * .16, gap = w / N;
    for (let i = 0; i < N; i++) {
      const idle = .18 + .1 * Math.sin(now / 1400 + i * .45);
      const v = (an && !audio.paused) ? Math.min(1, data[Math.floor(2 + i * 1.6)] / 230) : (reduce ? .2 : idle);
      const x = gap * (i + .5);
      const col = i % 2 ? '233,185,124' : '255,226,190';
      const cone = g.createLinearGradient(0, y, 0, h); cone.addColorStop(0, `rgba(${col},${.16 * v})`); cone.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = cone; g.beginPath(); g.moveTo(x - gap * .12, y); g.lineTo(x + gap * .12, y); g.lineTo(x + gap * .9, h); g.lineTo(x - gap * .9, h); g.closePath(); g.fill();
      const lamp = g.createRadialGradient(x, y, 0, x, y, gap * .5); lamp.addColorStop(0, `rgba(${col},${.25 + .75 * v})`); lamp.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = lamp; g.fillRect(x - gap * .5, y - gap * .5, gap, gap);
    }
    if (!reduce || (an && !audio.paused)) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}
