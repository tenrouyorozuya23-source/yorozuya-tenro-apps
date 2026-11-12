// 灯景設計（架空の照明設計事務所）：ページを移るたびに、上の映像の部屋が一日の別の時刻になる。トップでは朝から夜までをゆっくり流す
import { F } from './data.js';
const $ = id => document.getElementById(id);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
$('logo').textContent = F.name; $('kind').textContent = `${F.kind}　${F.en}`; $('h-top').textContent = F.tagline; $('lead').textContent = F.lead;
$('fname').textContent = `${F.name}　${F.kind}`; $('discl').textContent = F.disclosure;
for (const s of F.services) {
  const li = el('li'), a = el('a'); a.href = `#/services`; a.dataset.s = s.id; a.append(el('b', null, s.name), el('span', null, '詳しく')); li.append(a); $('svc-mini').append(li);
  const d = el('article', 'svc'); d.id = `svc-${s.id}`; const ol = el('ol', 'steps'); for (const t of s.steps) ol.append(el('li', null, t)); d.append(el('h2', null, s.name), el('p', null, s.text), ol); $('svc').append(d);
}
for (const p of F.prices) { const li = el('li'), row = el('div', 'row'), pr = el('span', 'p', p.price); pr.append(el('small', null, p.unit)); row.append(el('b', null, p.name), pr); li.append(row, el('p', null, p.note)); $('price').append(li); }
$('pnote').textContent = F.price_note;
for (const w of F.works) { const li = el('li'), h = el('h2', null, w.title); h.append(el('small', null, w.kind)); li.append(el('span', 'y', String(w.year)), h, el('p', null, w.text)); $('works').append(li); }
for (const w of F.works.slice(0, 2)) { const li = el('li'), a = el('a'); a.href = '#/works'; a.append(el('b', null, w.title), el('span', null, `${w.year}　${w.kind}`)); li.append(a); $('works-mini').append(li); }
$('msg').textContent = F.message;
for (const [k, v] of F.profile) { const d = el('div'); d.append(el('dt', null, k), el('dd', null, v)); $('prof').append(d); }
for (const k of F.contact_kinds) $('f-kind').append(el('option', null, k));
$('form').addEventListener('submit', e => {
  e.preventDefault(); const bad = [];
  for (const [id, label] of [['f-name', 'お名前'], ['f-mail', 'メールアドレス'], ['f-body', '内容']]) { const x = $(id), ng = !x.value.trim() || (id === 'f-mail' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.value)); x.setAttribute('aria-invalid', String(ng)); if (ng) bad.push([id, label]); }
  $('f-err').textContent = bad.length ? `${bad.map(b => b[1]).join('・')}を確かめてください` : ''; $('f-msg').textContent = '';
  if (bad.length) { $(bad[0][0]).focus(); return; }
  $('f-msg').textContent = '見本のため送信していません。実際のサイトでは、この内容が事務所に届きます。';
});

// ページ（#/top・#/services・#/price・#/works・#/about・#/contact）。各ページの部屋の時刻
const PAGES = { top: ['トップ', null], services: ['サービス', 9.5], price: ['料金', 12.5], works: ['実績', 17.6], about: ['事務所', 20.5], contact: ['お問い合わせ', 7.2] };
let page = null, onPage = () => {};
function route(first) {
  const m = location.hash.match(/^#\/(\w+)/), p = m && PAGES[m[1]] ? m[1] : 'top';
  if (p === page) return; page = p; document.body.dataset.page = p;
  document.querySelectorAll('.page').forEach(s => { const on = s.dataset.page === p; s.hidden = !on; s.classList.toggle('enter', on && !first); });
  document.querySelectorAll('[data-p]').forEach(a => a.dataset.p === p ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  document.title = p === 'top' ? `${F.name}｜${F.kind}（架空の見本）` : `${PAGES[p][0]}｜${F.name}（架空の見本）`;
  if (!first) { scrollTo(0, 0); document.querySelector(`.page[data-page="${p}"] h1`).focus({ preventScroll: true }); }
  onPage(p);
}
addEventListener('hashchange', () => route(false)); route(true);

(async () => {
  let THREE; try { THREE = await import('three'); } catch { return; }
  const cv = $('gl'), box = cv.parentElement;
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); r.setPixelRatio(Math.min(innerWidth < 700 ? 1.5 : 2, devicePixelRatio));
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.2;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, 1, .1, 60);
  const mat = (c, ro) => new THREE.MeshStandardMaterial({ color: c, roughness: ro });
  const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; scene.add(o); return o; };
  // 部屋：奥の壁と床、左の壁に縦長の窓
  const plaster = mat(0xd9d2c7, .95), wood = mat(0x6b5442, .6);
  add(new THREE.BoxGeometry(12, 5.2, .2), plaster, 1, 2.5, -3);
  add(new THREE.BoxGeometry(.2, 5.2, 12), plaster, 5.6, 2.5, 2.5);   // 右の壁（カメラの背後まで部屋を閉じる）
  add(new THREE.BoxGeometry(12, 5.2, .2), plaster, 1, 2.5, 8.4);
  add(new THREE.BoxGeometry(12, .1, 12), wood, 1, -.05, 2.5);
  // 左の壁（窓の穴を残して4枚で）
  const wx = -3.5, wz0 = -3, wz1 = 4;
  add(new THREE.BoxGeometry(.2, 5, 2.2), plaster, wx, 2.5, -1.9);   // 窓の奥側
  add(new THREE.BoxGeometry(.2, 5.2, 8.0), plaster, wx, 2.5, 4.4);    // 窓の手前側
  add(new THREE.BoxGeometry(.2, .6, 1.2), plaster, wx, .3, -.2);     // 窓の下
  add(new THREE.BoxGeometry(.2, 1.4, 1.2), plaster, wx, 4.3, -.2);   // 窓の上
  add(new THREE.BoxGeometry(.24, 3.0, .05), mat(0x3a332c, .5), wx, 2.1, -.2);   // 窓の縦の桟
  add(new THREE.BoxGeometry(12, .2, 12), plaster, 1, 5.1, 2.5);        // 天井
  // 机・椅子・ペンダント
  add(new THREE.BoxGeometry(1.8, .06, .9), mat(0x8a6a4e, .5), .9, .74, -1.6); for (const [x, z] of [[.1, -1.9], [1.7, -1.9], [.1, -1.3], [1.7, -1.3]]) add(new THREE.BoxGeometry(.05, .72, .05), mat(0x3b2e24, .6), x, .36, z);
  const chair = add(new THREE.BoxGeometry(.45, .05, .45), mat(0x4a3a2c, .6), 1.6, .46, -.8); add(new THREE.BoxGeometry(.45, .5, .05), mat(0x4a3a2c, .6), 1.6, .72, -.58);
  add(new THREE.CylinderGeometry(.01, .01, 1.7, 6), mat(0x222222, .5), .9, 4.2, -1.6);
  const shade = add(new THREE.ConeGeometry(.32, .28, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0xe9e1d4, roughness: .7, side: THREE.DoubleSide }), .9, 3.2, -1.6);
  const bulbM = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffc98a, emissiveIntensity: 0 }); add(new THREE.SphereGeometry(.07, 16, 12), bulbM, .9, 3.08, -1.6).castShadow = false;
  const pend = new THREE.SpotLight(0xffc98a, 0, 8, .95, .8, 1.6); pend.position.set(.9, 3.05, -1.6); pend.target.position.set(.9, 0, -1.6); pend.castShadow = true; pend.shadow.mapSize.set(1024, 1024); scene.add(pend, pend.target);
  const wallWash = new THREE.SpotLight(0xffb978, 0, 8, .6, 1, 1.5); wallWash.position.set(3.2, .1, -2.2); wallWash.target.position.set(3.2, 3, -2.9); scene.add(wallWash.target);   // 夜、奥の壁の右を下から柔らかく scene.add(wallWash);
  // 太陽（窓の外の左から）と空の明かり
  const sun = new THREE.DirectionalLight(0xffffff, 0); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: .5, far: 30 }); sun.target.position.set(.5, 1.2, -1.5); scene.add(sun, sun.target);
  const sky = new THREE.HemisphereLight(0xdfe4ea, 0x5a4636, 0); scene.add(sky);
  const C = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function setTime(h) {
    // 6時に日の出、18時に日の入り。太陽は窓の外を低い角度から高い角度へ回る
    const day = sm(5.6, 7.2, h) * (1 - sm(17.2, 18.8, h)), u = (h - 6) / 12, alt = Math.sin(Math.PI * Math.min(1, Math.max(0, u))) * 1.0 + .12;
    const az = -1.15 + u * 1.4;
    sun.position.set(-10, 1.2 + 7 * Math.sin(alt), 5.5 - u * 9);   // 朝は左手前から奥の壁へ、夕方は左奥から手前の床へ
    const warm = 1 - Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
    sun.color.copy(C(0xfff4e6, 0xffa25a, warm * .9)); sun.intensity = day * 5.2;
    sky.intensity = .35 + day * 1.3; sky.color.copy(C(0xdfe4ea, 0xffd2b0, warm * .5)); if (h > 18.5 || h < 5.5) { sky.color.set(0x2a3550); sky.intensity = .18; }
    const night = sm(16.8, 18.6, h) + (h < 6 ? 1 : 0);
    pend.intensity = Math.min(1, night) * 28; bulbM.emissiveIntensity = Math.min(1, night) * 3; wallWash.intensity = Math.min(1, sm(18.5, 20, h)) * 6;
    r.setClearColor(day > .05 ? C(0x9fb8d8, 0xe8a070, warm).getHex() : 0x0b0d14, 1);
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60), c = $('clock'); c.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; c.append(el('small', null, h < 10 ? '朝' : h < 15 ? '昼' : h < 18.5 ? '夕方' : '夜'));
  }
  // 窓の外の空（明るさで時刻が伝わる）
  const skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), new THREE.MeshBasicMaterial({ color: 0xbfd2ff })); skyPlane.position.set(-5, 2.5, -.2); skyPlane.rotation.y = Math.PI / 2; scene.add(skyPlane);
  let target = 9, cur = 9, t0 = performance.now();
  onPage = p => { if (PAGES[p][1] != null) target = PAGES[p][1]; t0 = performance.now(); };
  onPage(page);
  function fit() { const w = box.clientWidth, h = box.clientHeight; r.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 58 : 38; cam.updateProjectionMatrix(); }
  new ResizeObserver(fit).observe(box); fit();
  let shown = false, last = performance.now();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (page === 'top') { cur = reduce ? 9 : 6.2 + (((now - t0) / 1000 / 30) % 1) * 16; }   // トップ：30秒で朝6時から夜10時まで
    else cur += (target - cur) * (reduce ? 1 : 1 - Math.exp(-dt * 2.2));
    setTime(cur);
    skyPlane.material.color.copy(r.getClearColor(new THREE.Color()));
    const tall = cam.aspect < 1, sway = reduce ? 0 : Math.sin(now / 1000 * .08) * .25;
    cam.position.set(4.2 + sway, 1.55, 4.6); if (tall) cam.position.set(4.6 + sway, 1.45, 7.6); cam.lookAt(-.4, 1.5, -1.6);
    r.render(scene, cam); if (!shown) { shown = true; cv.classList.add('ready'); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
