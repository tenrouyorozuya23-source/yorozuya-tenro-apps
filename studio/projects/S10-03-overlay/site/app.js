// 配信オーバーレイ：時計、名前、話題、見本のコメント（一定間隔で流れる）。#obs で背景を透明にする
import { F } from './data.js';
const $ = id => document.getElementById(id);
$('who').textContent = F.streamer; $('ttl').textContent = F.stream_title; $('topic').textContent = F.segment;
const obs = location.hash === '#obs';
document.body.classList.toggle('obs', obs);
// 1920×1080 の舞台を画面の幅に合わせて縮める（OBS では等倍）
const frame = $('frame'), stage = $('stage');
const fit = () => { const s = obs ? 1 : Math.min(1, frame.clientWidth / F.canvas.w); stage.style.transform = `scale(${s})`; frame.style.height = (F.canvas.h * s) + 'px'; };
addEventListener('resize', fit); fit();
// 時計
const WD = ['日', '月', '火', '水', '木', '金', '土'];
const tick = () => { const d = new Date(); $('hm').textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; $('date').textContent = `${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`; };
tick(); setInterval(tick, 1000);
// 見本のコメント：最初に4件、以後 4.5 秒ごとに1件ずつ。最大6件を表示
const list = $('chat'); let i = 0;
const push = (anim) => {
  const [u, m] = F.sample_comments[i % F.sample_comments.length]; i++;
  const li = document.createElement('li'); li.dataset.id = 'c' + i;
  const a = document.createElement('span'); a.className = 'u'; a.textContent = u;
  const b = document.createElement('span'); b.className = 'm'; b.textContent = m;
  li.append(a, b); if (anim) li.classList.add('new'); list.append(li);
  while (list.children.length > 6) list.firstElementChild.remove();
  if (anim) { const s = $('sweep'); s.classList.remove('go'); void s.offsetWidth; s.classList.add('go'); }
};
for (let k = 0; k < 4; k++) push(false);
setInterval(() => push(true), 4500);
// プレビューで背景を消して確かめる
const t = $('toggle');
t.addEventListener('click', () => { const on = !document.body.classList.contains('preview-clear'); document.body.classList.toggle('preview-clear', on); document.querySelector('.bg').style.display = on ? 'none' : ''; t.setAttribute('aria-pressed', String(on)); t.textContent = on ? '見本の背景を戻す' : '背景を消して確かめる'; });
addEventListener('hashchange', () => location.reload());
