// 上演中の演目：works/pass から生成した data.js を、種類で絞り込める演目表として並べる
import { WORKS } from './data.js';
const GROUP = w => w.id.startsWith('S10') ? '配信' : ({ video: '映像', ad: '映像', sns: 'SNS', web: 'Web', music: '音', system: '配信' })[w.kind] || '映像';
const LABEL = { 映像: '映像', SNS: 'SNS ショート', Web: 'Web サイト', 音: '音楽・音', 配信: '配信素材' };
// 題名の末尾の「（架空…）」は、ページ全体の注記に任せて表示では外す
const short = t => t.replace(/[（(][^（）()]*架空[^（）()]*[）)]$/, '').trim();
const board = document.getElementById('board');
document.getElementById('count').textContent = WORKS.length;
for (const w of WORKS) {
  const li = document.createElement('li'); li.dataset.id = w.id; li.dataset.group = GROUP(w);
  const a = document.createElement('a'); a.href = w.link; a.target = '_blank'; a.rel = 'noopener';
  a.innerHTML = `<div class="frame"><img loading="lazy" alt="" width="${w.w}" height="${w.h}"></div><p class="meta"><span class="no"></span><span class="kind"></span></p><h2 class="ttl"></h2><p class="form"></p><span class="go"></span>`;
  a.querySelector('img').src = w.img;
  a.querySelector('.no').textContent = w.id;
  a.querySelector('.kind').textContent = LABEL[GROUP(w)];
  a.querySelector('.ttl').textContent = short(w.title);
  a.querySelector('.form').textContent = w.form;
  const go = w.site ? 'サイトを開く' : GROUP(w) === '音' ? '音源の入ったフォルダを開く' : '映像の入ったフォルダを開く';
  a.querySelector('.go').textContent = go;
  a.setAttribute('aria-label', `${short(w.title)}（${LABEL[GROUP(w)]}）${go}`);
  li.append(a); board.append(li);
}
const btns = [...document.querySelectorAll('.filter button')];
btns.forEach(b => b.addEventListener('click', () => {
  btns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  const g = b.dataset.id; let n = 0;
  for (const li of board.children) { const on = g === 'all' || li.dataset.group === g; li.hidden = !on; if (on) n++; }
  document.getElementById('count').textContent = n;
}));
