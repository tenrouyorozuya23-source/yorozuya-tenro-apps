// 月見坂シアター 座席ビューア：座席表で席を選ぶと、その席の目の高さから見た舞台を three.js で出す。
// 距離・角度・ひさしで隠れる高さ・前の人の頭は、facts.json の寸法（模型）から計算する
import { F } from './data.js';
const $ = id => document.getElementById(id);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const G = F.geometry;
$('th').textContent = F.theater; $('title').textContent = F.title; $('lead').textContent = F.lead; $('note').textContent = F.notes; $('discl').textContent = F.disclosure;

// 座席（x：客席から見て左が負、z：舞台の前の縁からの距離、y：床の高さ）
const seats = [];
const rowX = (blocks, aisle) => { const n = blocks.reduce((a, b) => a + b, 0), w = n * G.seat_pitch + (blocks.length - 1) * aisle, xs = []; let x = -w / 2 + G.seat_pitch / 2; blocks.forEach((b, k) => { for (let i = 0; i < b; i++) { xs.push(x); x += G.seat_pitch; } x += aisle; }); return xs; };
G.floor_rows.forEach((r, i) => { const z = G.floor_first_z + i * G.row_pitch, y = Math.max(0, i - (G.rake_from - 1)) * G.rake_step, zone = i < 8 ? 0 : 1; rowX(G.blocks, G.aisle).forEach((x, k) => seats.push({ id: `${r}-${k + 1}`, row: r, n: k + 1, x: x + (i % 2 ? G.stagger : 0), y, z, zone, fl: 1, ri: i })); });   // 列ごとに半席ずらす（前の人の頭が真正面に来ない）
G.balcony_rows.forEach((r, i) => { const z = G.balcony_front_z + .55 + i * G.balcony_pitch, y = G.balcony_floor + i * G.balcony_rake; rowX(G.balcony_blocks, 0).forEach((x, k) => seats.push({ id: `${r}-${k + 1}`, row: r, n: k + 1, x: x + (i % 2 ? G.stagger : 0), y, z, zone: 2, fl: 2, ri: i })); });
const byId = Object.fromEntries(seats.map(s => [s.id, s]));
const rows = [...G.floor_rows, ...G.balcony_rows];
const rowSeats = r => seats.filter(s => s.row === r);

// 選ぶための部品
for (const r of rows) { const o = el('option', null, r.startsWith('2') ? `2階 ${r.slice(1)}列` : `1階 ${r}列`); o.value = r; $('row').append(o); }
function fillNum(r, n) { const s = $('num'); s.textContent = ''; for (const x of rowSeats(r)) { const o = el('option', null, `${x.n}番`); o.value = x.n; s.append(o); } s.value = n; }
F.zones.forEach(([name, where, price, col]) => { const sp = el('span'); const i = el('i'); i.style.background = col; sp.append(i, `${name}（${where}）${price}`); $('legend').append(sp); });

// 座席表（上が舞台）。1階と2階を縦に並べる
const NS = 'http://www.w3.org/2000/svg', svg = $('map'); svg.setAttribute('role', 'radiogroup'); svg.setAttribute('aria-label', '座席表（上が舞台）。矢印キーで席を移れます');
const mk = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
const SC = 30, X0 = 6.2, BAL_OFF = G.floor_first_z + (G.floor_rows.length - 1) * G.row_pitch + 1.5 - G.balcony_front_z;   // 1m＝30、2階は1階の下に寄せて描く
const mapY = s => (s.fl === 1 ? s.z : s.z + BAL_OFF) * SC;
const H = (G.balcony_front_z + .55 + 3 * G.balcony_pitch + BAL_OFF + .4) * SC;
svg.setAttribute('viewBox', `0 ${-1.6 * SC} ${X0 * 2 * SC} ${H + 1.6 * SC}`);
svg.append(mk('rect', { x: (X0 - G.stage_width / 2) * SC, y: -1.4 * SC, width: G.stage_width * SC, height: 1.2 * SC, rx: 4, fill: '#3a2e24' }));
const tx = (x, y, s, a = {}) => { const t = mk('text', { x, y, fill: '#bdb6ab', 'font-size': 16, 'aria-hidden': 'true', 'text-anchor': 'middle', 'font-family': 'Noto Sans JP, sans-serif', ...a }); t.textContent = s; svg.append(t); };
tx(X0 * SC, -.6 * SC, '舞台', { fill: '#efebe4' });
tx(X0 * SC, (G.balcony_front_z + BAL_OFF + .05) * SC, '2階席', { 'font-size': 14 });
for (const r of rows) { const s = rowSeats(r)[0]; tx(.05 * SC, mapY(s) + 5, r, { 'font-size': 14, 'text-anchor': 'start' }); }
const dots = {};
for (const s of seats) {
  const g = mk('g', { class: 's', role: 'radio', tabindex: -1, 'aria-checked': 'false', 'aria-label': `${s.fl === 2 ? '2階 ' : ''}${s.row.replace(/^2/, '')}列${s.n}番 ${F.zones[s.zone][0]}` });
  const c = mk('circle', { cx: (s.x + X0) * SC, cy: mapY(s), r: 6.4, fill: F.zones[s.zone][3], 'fill-opacity': .8 });
  g.append(c, mk('circle', { cx: (s.x + X0) * SC, cy: mapY(s), r: 11, fill: 'transparent' }));   // 押せる範囲は見た目より広く
  g.addEventListener('click', () => select(s.id)); svg.append(g); dots[s.id] = c; g.dataset.id = s.id;
}

// 計算（模型の寸法から）
const fmt = v => v.toFixed(1);
// 前の人の体（座った姿勢）：頭は球、首と肩はカプセル。3D の人形と同じ寸法
const body = p => { const e = p.y + G.eye; return [{ a: [p.x, e + .03, p.z], b: [p.x, e + .03, p.z], r: .11 }, { a: [p.x, e - .18, p.z], b: [p.x, e - .02, p.z], r: .06 }, { a: [p.x - .2, e - .3, p.z + .02], b: [p.x + .2, e - .3, p.z + .02], r: .12 }]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function segDist(p1, q1, p2, q2) {   // 2本の線分の最短距離
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2), a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s, t; if (e < 1e-9) { s = Math.min(1, Math.max(0, -dot(d1, r) / a)); t = 0; } else { const c = dot(d1, r), b = dot(d1, d2), den = a * e - b * b; s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0; t = (b * s + f) / e; if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); } }
  const c1 = [p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s], c2 = [p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t], d = sub(c1, c2); return Math.sqrt(dot(d, d));
}
// 目から点 T への視線を、前の人・2階の手すり・ひさしがさえぎるか
function blocked(s, T) {
  const E = [s.x, s.y + G.eye, s.z];
  for (const p of seats) { if (p.fl !== s.fl || p.z >= s.z - .1 || s.z - p.z > 3.2) continue; for (const c of body(p)) if (segDist(E, T, c.a, c.b) < c.r) return 'head'; }
  const atZ = z => E[1] + (T[1] - E[1]) * (E[2] - z) / (E[2] - T[2]);
  if (s.fl === 2 && atZ(G.balcony_front_z) < G.balcony_floor + .8) return 'rail';
  if (s.fl === 1 && s.z > G.balcony_front_z && atZ(G.balcony_front_z) > G.balcony_soffit) return 'soffit';
  return null;
}
function facts(s) {
  const ex = s.x, ey = s.y + G.eye, ez = s.z, out = [];
  const dx = Math.max(0, Math.abs(ex) - G.stage_width / 2), hd = Math.hypot(dx, ez);
  out.push(['舞台の前の縁まで', s.fl === 2 ? ['水平に ', el('b', null, fmt(hd)), 'm（目は舞台の床より ', el('b', null, fmt(ey - G.stage_height)), 'm 上）'] : [el('b', null, fmt(hd)), 'm']]);
  const ang = Math.atan2(ex, ez + G.stage_depth / 2) * 180 / Math.PI;
  out.push(['舞台の中央は', Math.abs(ang) < 4 ? 'ほぼ正面' : [`正面から${ang < 0 ? '右' : '左'}へ `, el('b', null, String(Math.round(Math.abs(ang)))), '°']]);
  if (s.fl === 1) { const dh = +fmt(ey - G.stage_height); out.push(['目の高さ', [`舞台の床より `, el('b', null, fmt(Math.abs(dh))), `m ${dh >= 0 ? '上' : '下'}`]]); }
  // 舞台の床：中央の線で、前の縁から奥へ 10cm ずつ、どこから見えるか
  let first = null, why = null;
  for (let d = 0; d <= G.stage_depth; d += .1) { const b = blocked(s, [0, G.stage_height, -d]); if (!b) { first = d; break; } if (!why) why = b; }
  const by = { head: '前の人の頭や肩', rail: '2階の手すり' };
  out.push(['舞台の床の中央', first === null ? '見えません（前の人の頭や肩が重なります）' : first < .05 ? '前の縁から奥まで、中央の床が見えます' : [`前の方 `, el('b', null, fmt(first)), `m が、${by[why] || 'さえぎるもの'}で隠れます`]]);
  // 立っている役者の顔の高さ（床から 1.6m）を、前・中央・奥で
  const faces = [[0, -1.5], [0, -3.4], [0, -6]].map(([x, z]) => blocked(s, [x, G.stage_height + 1.6, z]));
  out.push(['役者の顔', faces.every(f => !f) ? '前・中央・奥のどこに立っても見えます' : `${['前', '中央', '奥'].filter((_, k) => faces[k]).join('・')}に立つと、${by[faces.find(f => f)] || 'さえぎるもの'}で隠れることがあります`]);
  if (s.fl === 1 && ez > G.balcony_front_z) {
    const top = G.stage_height + G.pros_height, ymax = ey + (G.balcony_soffit - ey) * ez / (ez - G.balcony_front_z), hid = top - ymax;
    out.push(['2階席のひさし', hid > .05 ? ['舞台の口の上 ', el('b', null, fmt(hid)), `m（高さ ${G.pros_height}m のうち）が隠れます`] : '下にありますが、舞台の口の上まで見えます']);
  }
  return out;
}

let cur = null, onSelect = () => {};
function select(id, quiet) {
  const s = byId[id]; if (!s) return; cur = s;
  for (const k in dots) { const d = dots[k], on = k === id; d.setAttribute('fill', on ? '#ffffff' : F.zones[byId[k].zone][3]); d.setAttribute('r', on ? 9 : 6.4); d.setAttribute('stroke', on ? '#ffcf96' : 'none'); d.setAttribute('stroke-width', on ? 3 : 0); }
  svg.querySelectorAll('.s').forEach(g => { const on = g.dataset.id === id; g.setAttribute('aria-checked', String(on)); g.tabIndex = on ? 0 : -1; }); svg.append(dots[id].parentNode);
  $('row').value = s.row; fillNum(s.row, s.n);
  const z = F.zones[s.zone]; $('zone').textContent = `${s.fl === 2 ? '2階' : '1階'}　${z[0]}`; $('zone').append(el('b', null, z[2]));
  const h = $('seatname'); h.textContent = ''; if (s.fl === 2) h.append(el('small', 'fl', '2階')); h.append(s.row.replace(/^2/, ''), el('small', null, '列'), String(s.n), el('small', null, '番'));
  const dl = $('info'); dl.textContent = '';
  for (const [k, v] of facts(s)) { const d = el('div'), dd = el('dd'); [].concat(v).forEach(x => dd.append(x)); d.append(el('dt', null, k), dd); dl.append(d); }
  if (!quiet) try { history.replaceState(null, '', `#${id}`); } catch {}
  onSelect(s, quiet);
}
svg.addEventListener('keydown', e => {
  const k = e.key; if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(k)) return; e.preventDefault();
  if (k === 'ArrowLeft' || k === 'ArrowRight') step(k === 'ArrowLeft' ? -1 : 1);
  else if (k === 'Home' || k === 'End') select(`${cur.row}-${k === 'Home' ? 1 : rowSeats(cur.row).length}`);
  else { const ri = rows.indexOf(cur.row) + (k === 'ArrowUp' ? -1 : 1); if (ri < 0 || ri >= rows.length) return; const near = rowSeats(rows[ri]).sort((a, b) => Math.abs(a.x - cur.x) - Math.abs(b.x - cur.x))[0]; select(near.id); }
  svg.querySelector(`[data-id="${cur.id}"]`).focus();
});
$('row').addEventListener('change', () => { const r = $('row').value, list = rowSeats(r), n = Math.min(cur.n, list.length); select(`${r}-${n}`); });
$('num').addEventListener('change', () => select(`${cur.row}-${$('num').value}`));
const step = d => { const list = rowSeats(cur.row), n = Math.min(list.length, Math.max(1, cur.n + d)); select(`${cur.row}-${n}`); };
$('prev').addEventListener('click', () => step(-1)); $('next').addEventListener('click', () => step(1));
let headsShow = true, onHeads = () => {};
$('heads').addEventListener('click', () => { headsShow = !headsShow; $('heads').setAttribute('aria-pressed', String(headsShow)); onHeads(); });
select(byId[location.hash.slice(1)] ? location.hash.slice(1) : F.default_seat, true);

// 劇場（three.js）
(async () => {
  let THREE; try { THREE = await import('three'); } catch { return; }
  const cv = $('gl'), box = cv.parentElement;
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  r.setPixelRatio(Math.min(1.75, devicePixelRatio)); r.setClearColor(0x050404, 1);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.25; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(55, 1, .05, 80);
  const std = (c, ro = .85, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: ro, metalness: m });
  const add = (geo, mat, x, y, z, sh = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sh; m.receiveShadow = true; scene.add(m); return m; };
  const SH = G.stage_height, SW = G.stage_width, SD = G.stage_depth, PH = G.pros_height;

  // 舞台：床・額縁・袖幕・一文字幕
  add(new THREE.BoxGeometry(SW + 4, SH, SD + 1), std(0x1a1512, .7), 0, SH / 2, -SD / 2 + .2);
  add(new THREE.BoxGeometry(SW + 4, .02, SD), std(0x3a2a1e, .55), 0, SH + .01, -SD / 2);
  const wall = std(0x15110f, .95);
  add(new THREE.BoxGeometry(4, PH + 6, .6), wall, -(SW / 2 + 2), (PH + 6) / 2, -.3); add(new THREE.BoxGeometry(4, PH + 6, .6), wall, SW / 2 + 2, (PH + 6) / 2, -.3);
  add(new THREE.BoxGeometry(SW + 8, 4, .6), wall, 0, SH + PH + 2, -.3);
  const velvet = new THREE.MeshPhysicalMaterial({ color: 0x5a0f12, roughness: .9, sheen: 1, sheenColor: new THREE.Color(0xc0392b), sheenRoughness: .5 });
  const drape = (w, h) => { const g = new THREE.PlaneGeometry(w, h, 24, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 9) * .08); g.computeVertexNormals(); return g; };
  for (const sx of [-1, 1]) for (const k of [0, 1, 2]) add(drape(1.4, PH), velvet, sx * (SW / 2 - .5 - k * .15), SH + PH / 2, -.6 - k * 2.6);
  add(drape(SW + 2, 1.2), velvet, 0, SH + PH - .5, -.55);
  // 装置：奥の壁と窓、扉、机と椅子、スタンド
  add(new THREE.BoxGeometry(SW - 1, 5, .2), std(0x2b2723, .9), 0, SH + 2.5, -SD + .4);
  add(new THREE.PlaneGeometry(1.8, 2.2), new THREE.MeshStandardMaterial({ color: 0, emissive: 0x6f8fc4, emissiveIntensity: .9 }), 1.8, SH + 2.6, -SD + .52, false);
  for (const [x, w] of [[1.8 - .95, .1], [1.8 + .95, .1]]) add(new THREE.BoxGeometry(w, 2.4, .12), std(0x3a332c), x, SH + 2.6, -SD + .56);
  add(new THREE.BoxGeometry(2.0, .1, .12), std(0x3a332c), 1.8, SH + 3.75, -SD + .56); add(new THREE.BoxGeometry(2.0, .1, .12), std(0x3a332c), 1.8, SH + 1.45, -SD + .56); add(new THREE.BoxGeometry(.06, 2.2, .1), std(0x3a332c), 1.8, SH + 2.6, -SD + .56);
  add(new THREE.BoxGeometry(1.2, 2.3, .12), std(0x4a3a2a, .6), -2.6, SH + 1.15, -SD + .55);
  add(new THREE.BoxGeometry(1.6, .06, .8), std(0x5b4330, .5), -.4, SH + .76, -3.4); for (const [x, z] of [[-1.1, -3.1], [.3, -3.1], [-1.1, -3.7], [.3, -3.7]]) add(new THREE.BoxGeometry(.06, .74, .06), std(0x3b2a1e), x, SH + .37, z);
  const chair = (x, z, ry) => { const g = new THREE.Group(); const m = std(0x3b2a1e, .6); const a = (geo, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; g.add(o); }; a(new THREE.BoxGeometry(.46, .05, .44), 0, .46, 0); a(new THREE.BoxGeometry(.46, .5, .05), 0, .72, -.2); for (const [px, pz] of [[-.2, -.18], [.2, -.18], [-.2, .18], [.2, .18]]) a(new THREE.BoxGeometry(.04, .46, .04), px, .23, pz); g.position.set(x, SH, z); g.rotation.y = ry; scene.add(g); };
  chair(-1.5, -3.4, Math.PI / 2); chair(.7, -3.4, -Math.PI / 2);
  add(new THREE.CylinderGeometry(.02, .02, 1.6, 8), std(0x222222, .4, .8), 3.6, SH + .8, -4.5); add(new THREE.SphereGeometry(.16, 16, 12), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffd8a0, emissiveIntensity: 2 }), 3.6, SH + 1.62, -4.5, false);
  // 俳優（形だけ）
  // 俳優（身長 1.65m の人の形。顔は描かず、明かりの当たり方だけ）
  const actor = (x, z, ry, c, coat) => {
    const g = new THREE.Group(), cloth = std(c, .75), skin = std(0xb8927a, .65), part = (geo, m, px, py, pz, rx = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.rotation.set(rx, 0, rz); o.castShadow = true; g.add(o); };
    for (const sx of [-1, 1]) part(new THREE.CylinderGeometry(.07, .06, .82, 10), std(0x1e1c1a, .7), sx * .1, .41, 0);
    part(new THREE.CylinderGeometry(.21, coat ? .3 : .17, .62, 14), cloth, 0, 1.12, 0);
    part(new THREE.SphereGeometry(.21, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), cloth, 0, 1.4, 0);
    for (const sx of [-1, 1]) part(new THREE.CapsuleGeometry(.05, .5, 4, 8), cloth, sx * .25, 1.12, 0, 0, sx * .12);
    part(new THREE.CylinderGeometry(.05, .055, .1, 10), skin, 0, 1.47, 0); part(new THREE.SphereGeometry(.1, 18, 14), skin, 0, 1.58, .01);
    g.position.set(x, SH, z); g.rotation.y = ry; scene.add(g);
  };
  actor(-1.5, -2.5, .5, 0x2c3e50, false); actor(1.4, -4.4, -.6, 0x6b2d2d, true);
  const rimL = new THREE.SpotLight(0xffd6a6, 60, 20, .5, .7, 1.4); rimL.position.set(0, SH + 6, -SD + .8); rimL.target.position.set(0, SH + 1, -3); scene.add(rimL, rimL.target);

  // 照明：客席の上の前明かり2台、奥からの明かり、窓の月明かり、客席は暗く
  const spot = (c, I, p, t, a) => { const s = new THREE.SpotLight(c, I, 40, a, .6, 1.2); s.position.set(...p); s.target.position.set(...t); s.castShadow = true; s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -.0005; scene.add(s, s.target); return s; };
  spot(0xffe2bf, 260, [-4, 9, 8], [-.6, SH, -3.4], .28); spot(0xffd6a6, 220, [4.5, 9, 8], [.6, SH, -3.6], .28);
  spot(0x9fb8ff, 120, [0, 8, -7], [0, SH, -2.5], .5);
  const moon = new THREE.PointLight(0x7f9fd8, 6, 6, 2); moon.position.set(1.8, SH + 2.6, -SD + 1.2); scene.add(moon);
  scene.add(new THREE.HemisphereLight(0x2a2420, 0x080605, .35));

  // 客席：段の床、背もたれ、前の人の頭（座った姿勢）
  const carpet = std(0x241a17, .95);
  G.floor_rows.forEach((_, i) => { const z = G.floor_first_z + i * G.row_pitch, y = Math.max(0, i - (G.rake_from - 1)) * G.rake_step; add(new THREE.BoxGeometry(16, Math.max(.02, y), G.row_pitch), carpet, 0, y / 2, z, false); });
  add(new THREE.BoxGeometry(16, .02, 3), carpet, 0, .0, 1.4, false);
  add(new THREE.BoxGeometry(16, .6, 4.4), std(0x1b1513, .9), 0, G.balcony_soffit + .3, G.balcony_front_z + 2.2);
  add(new THREE.BoxGeometry(16, .8, .12), std(0x2a201b, .7), 0, G.balcony_floor + .4, G.balcony_front_z + .05);
  add(new THREE.BoxGeometry(16, .03, .03), new THREE.MeshStandardMaterial({ color: 0x2a201b, emissive: 0x6a4a2e, emissiveIntensity: 1 }), 0, G.balcony_soffit, G.balcony_front_z - .02, false);   // ひさしの軒先（ここで視界が切れる）
  const bandM = new THREE.MeshBasicMaterial({ color: 0xffcf96, transparent: true, opacity: 0, depthWrite: false }); const band = new THREE.Mesh(new THREE.PlaneGeometry(SW, 1), bandM); band.position.z = -.24; scene.add(band);
  G.balcony_rows.forEach((_, i) => add(new THREE.BoxGeometry(16, .02 + i * G.balcony_rake, G.balcony_pitch), carpet, 0, G.balcony_floor + i * G.balcony_rake / 2, G.balcony_front_z + .55 + i * G.balcony_pitch, false));
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(.3, 12, 20), std(0x1e1714, .95), sx * 8, 6, 8, false);
  // 客席の壁の小さな灯り（上演中も足もとのためにごく弱く点いている）
  for (const sx of [-1, 1]) for (const z of [3, 6.5, 10]) { add(new THREE.BoxGeometry(.06, .22, .12), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffc58a, emissiveIntensity: 1.2 }), sx * 7.83, 2.6, z, false); const l = new THREE.PointLight(0xffb070, .6, 3.5, 2); l.position.set(sx * 7.6, 2.6, z); scene.add(l); }
  const backM = new THREE.MeshStandardMaterial({ color: 0x5a1a1c, roughness: .85 });
  const backs = new THREE.InstancedMesh(new THREE.BoxGeometry(.46, .8, .08), backM, seats.length);
  const headM = std(0x1a1614, .9), heads = new THREE.InstancedMesh(new THREE.SphereGeometry(.11, 14, 10), headM, seats.length), shoulders = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.12, .4, 4, 8), headM, seats.length), necks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.06, .06, .16, 10), headM, seats.length);
  shoulders.rotation.z = 0;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), SV = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3();
  seats.forEach((s, k) => { M.compose(P.set(s.x, s.y + .45, s.z + .3), Q, SV); backs.setMatrixAt(k, M); });
  scene.add(backs, heads, shoulders, necks);
  const ZERO = new THREE.Vector3(0, 0, 0);
  function placeHeads() {
    seats.forEach((s, k) => {
      // 自分の席と後ろの席は消す。2階から見るときは1階の人も見える。1階から2階の人は見えない
      const show = s !== cur && (s.fl === cur.fl ? s.z < cur.z - .01 : cur.fl === 2);
      if (!headsShow || !show) { M.compose(P.set(0, -50, 0), Q, ZERO); heads.setMatrixAt(k, M); shoulders.setMatrixAt(k, M); necks.setMatrixAt(k, M); return; }
      M.compose(P.set(s.x, s.y + G.eye + .03, s.z), Q, SV); heads.setMatrixAt(k, M); M.compose(P.set(s.x, s.y + G.eye - .1, s.z), Q, SV); necks.setMatrixAt(k, M);
      M.compose(P.set(s.x, s.y + G.eye - .3, s.z + .02), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), SV); shoulders.setMatrixAt(k, M);
    });
    heads.instanceMatrix.needsUpdate = true; shoulders.instanceMatrix.needsUpdate = true; necks.instanceMatrix.needsUpdate = true;
  }
  onHeads = placeHeads;

  // カメラ：選んだ席の目の高さ。舞台の中央を見る。ドラッグで少し見回せる
  const look = new THREE.Vector3(0, SH + 1.3, -3.4);
  const eye = new THREE.Vector3(), from = new THREE.Vector3(), to = new THREE.Vector3(); let tw = 1, t0 = 0;
  let yaw = 0, pitch = 0, tyaw = 0, tpitch = 0;
  let bandT = -1;
  onSelect = (s, quiet) => {
    // ひさしで隠れる範囲を、舞台の口の上に琥珀色の帯で一瞬だけ示す
    const ey = s.y + G.eye, top = SH + PH, ymax = s.fl === 1 && s.z > G.balcony_front_z ? ey + (G.balcony_soffit - ey) * s.z / (s.z - G.balcony_front_z) : top;
    if (top - ymax > .05) { band.scale.y = top - ymax; band.position.y = (top + ymax) / 2; bandT = performance.now() + (quiet || reduce ? 0 : 1100); } else bandT = -1;
    to.set(s.x, s.y + G.eye, s.z + .05); from.copy(eye); tw = quiet || reduce || !eye.lengthSq() ? 1 : 0; t0 = performance.now(); if (tw >= 1) eye.copy(to); tyaw = 0; tpitch = 0; placeHeads(); };
  onSelect(cur, true);
  let drag = null;
  box.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, a: tyaw, b: tpitch }; box.setPointerCapture(e.pointerId); $('drag').classList.add('gone'); });
  box.addEventListener('pointermove', e => { if (!drag) return; tyaw = Math.max(-.45, Math.min(.45, drag.a + (e.clientX - drag.x) * .004)); tpitch = Math.max(-.22, Math.min(.22, drag.b + (e.clientY - drag.y) * .003)); });
  const end = () => { drag = null; }; box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);

  function fit() { const w = box.clientWidth, h = box.clientHeight; r.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 72 : w / h < 1.4 ? 60 : 50; cam.updateProjectionMatrix(); }
  new ResizeObserver(fit).observe(box); fit();
  const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const dir = new THREE.Vector3(), tgt = new THREE.Vector3();
  let shown = false;
  function frame(now) {
    if (tw < 1) { tw = Math.min(1, (now - t0) / 1100); const e = ease(tw); eye.lerpVectors(from, to, e); eye.y += Math.sin(Math.PI * tw) * .35; }
    yaw += (tyaw - yaw) * .15; pitch += (tpitch - pitch) * .15;
    cam.position.copy(eye); dir.copy(look).sub(eye); const d = dir.length(), az = Math.atan2(dir.x, -dir.z) + yaw, el2 = Math.asin(dir.y / d) - pitch;
    tgt.set(eye.x + Math.sin(az) * Math.cos(el2) * d, eye.y + Math.sin(el2) * d, eye.z - Math.cos(az) * Math.cos(el2) * d); cam.lookAt(tgt);
    bandM.opacity = bandT < 0 ? 0 : reduce ? .18 : Math.max(0, now - bandT) < 1800 ? .18 * (.5 + .5 * Math.cos(Math.max(0, now - bandT) / 300 * Math.PI * 2)) * (now > bandT ? 1 : 0) : 0;
    r.render(scene, cam); if (!shown) { shown = true; cv.classList.add('ready'); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
