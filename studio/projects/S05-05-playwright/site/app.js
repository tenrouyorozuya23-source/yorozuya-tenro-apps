// 篠宮 遥 戯曲集：facts から表紙・戯曲の一頁・上演の記録・略歴を組む
import { F } from './data.js';
const $ = id => document.getElementById(id);
const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
const plays = [...F.plays].sort((a, b) => b.year - a.year);
const latestDone = plays.find(p => p.id === 'fuyu');
for (const [i, t] of latestDone.hero_lines.entries()) { if (i) $('first-line').append(document.createElement('br')); $('first-line').append(t); }
$('name').textContent = F.name; $('kana').textContent = F.kana; $('role').textContent = F.role;
for (const p of plays) {
  const s = el('article', 'page'); s.id = 'play-' + p.id; s.dataset.id = p.id;
  const h = el('h3', null, `『${p.title}』`); h.append(el('small', null, `${p.year}年　${p.company}　${p.venue}　上演時間 約${p.minutes}分　登場人物 ${p.cast}人`)); s.append(h);
  const sc = el('div', 'script'); sc.append(el('p', 'pillar', p.pillar), el('p', 'dir', p.direction));
  for (const [who, say] of p.lines) { const l = el('p', 'line'); l.append(el('span', 'who2', who), el('span', 'say', say)); sc.append(l); }
  s.append(sc, el('p', 'note', p.note)); $('play-list').append(s);
}
for (const p of plays) {
  const tr = el('tr'); tr.dataset.id = p.id;
  for (const v of [`${p.year}`, `『${p.title}』`, p.company, p.venue, `約${p.minutes}分`]) tr.append(el('td', null, v));
  $('hist').append(tr);
}
for (const b of F.bio) $('bio').append(el('p', null, b));
$('disc').textContent = F.disclosure;
