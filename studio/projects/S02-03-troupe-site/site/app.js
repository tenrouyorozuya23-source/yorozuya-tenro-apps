// 灯守座 公式サイト：上演記録は劇場の棚の台本。背表紙を選ぶと台本が棚から抜け出て表紙を向け、その公演の記録が開く。
// 公演の追加は facts.json の works に1件足して build.py を走らせるだけ（棚・一覧・記録が同じデータから作られる）
import { F } from './data.js';
const $ = id => document.getElementById(id);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const md = s => { const [, m, d] = s.split('-').map(Number); return `${m}月${d}日`; };
const when = w => `${w.year}年${md(w.from)}（${w.from_wd}）〜${md(w.to)}（${w.to_wd}）`;
$('discl').textContent = F.disclosure;

// 上演記録の一覧（棚と同じ並び：古い順）
const links = {};
for (const w of F.works) {
  const li = el('li'), a = el('a'); a.href = `#/w/${w.id}`;
  a.append(el('span', 'y', String(w.year)), el('span', 't', w.title), el('span', 's', w.status === 'planned' ? '上演予定' : w.venue.replace('灯守座', '').replace('港町文化ホール ', '') || 'アトリエ'));
  li.append(a); $('work-list').append(li); links[w.id] = a;
}
for (const n of F.news) { const li = el('li'), t = el('time', null, n.date.replaceAll('-', '.')); t.dateTime = n.date; li.append(t, el('span', null, n.text)); $('news-list').append(li); }
for (const p of F.about) $('about').append(el('p', null, p));
$('about').append(el('p', 'r', `${F.founded}旗揚げ。本拠地は${F.home}。`));
for (const m of F.members) { const li = el('li'); li.append(el('span', 'n', m.name), el('span', 'r', m.role)); $('member-list').append(li); }
const nx = F.works.find(w => w.status === 'planned');
if (nx) {
  const b = $('next-box'), [, m1, d1] = nx.from.split('-').map(Number), [, m2, d2] = nx.to.split('-').map(Number);
  const nd = el('p', 'nd'); nd.append(`${m1}.${d1}`, el('small', null, nx.from_wd), ' — ', `${m2}.${d2}`, el('small', null, nx.to_wd));
  const nl = el('p', 'nl'), a1 = el('a', null, '台本を棚から開く'); a1.href = `#/w/${nx.id}`;
  const a2 = el('a', null, '公演パンフレット（見本）'); a2.href = F.links.pamphlet; a2.target = '_blank'; a2.rel = 'noopener';
  nl.append(a1, a2);
  b.append(el('p', 'nt', nx.title), nd, el('p', 'nv', `${nx.year}年　${nx.venue}`), nl, el('p', 'note', '※架空の公演です。チケットの販売・予約はありません。'));
}

// 記録を開く・閉じる（#/w/<id> で開き、#/ で棚に戻す）
let onSelect = () => {}, lastLink = null;
document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="#/w/"]'); if (a) lastLink = a; });
function route() {
  const m = location.hash.match(/^#\/w\/([\w-]+)/), w = m && F.works.find(x => x.id === m[1]);
  for (const a of Object.values(links)) a.removeAttribute('aria-current');
  if (w) {
    $('d-year').textContent = String(w.year); $('d-title').textContent = w.title;
    $('d-status').textContent = w.status === 'planned' ? '上演予定（この台本はまだ稽古中です）' : `${w.year}年 上演`;
    $('d-when').textContent = ''; $('d-when').append(el('span', 'nw', `${w.year}年`), el('span', 'nw', `${md(w.from)}（${w.from_wd}）〜`), el('span', 'nw', `${md(w.to)}（${w.to_wd}）`)); $('d-venue').textContent = w.venue; $('d-cast').textContent = ''; w.cast.forEach((c, i) => { if (i) $('d-cast').append('　'); $('d-cast').append(el('span', 'nw', c)); });
    $('d-log').textContent = w.logline; $('d-syn').textContent = w.synopsis;
    const dl = $('d-link'); dl.textContent = '';
    if (w.status === 'planned') { const a = el('a', null, '公演パンフレット（見本）'); a.href = F.links.pamphlet; a.target = '_blank'; a.rel = 'noopener'; dl.append(a); }
    $('detail').hidden = false; document.querySelector('.shelf').classList.add('open'); links[w.id].setAttribute('aria-current', 'page');
    document.querySelector('.shelf').scrollIntoView({ block: 'start', behavior: reduce ? 'instant' : 'smooth' });
    $('detail').focus({ preventScroll: true }); onSelect(w.id);
  } else if (m || location.hash === '#/' || location.hash === '') {
    if (m) history.replaceState(null, '', '#/');
    const was = !$('detail').hidden; $('detail').hidden = true; document.querySelector('.shelf').classList.remove('open'); onSelect(null);
    if (was) (lastLink || $('shelf')).focus({ preventScroll: true });
  }
}
$('h-shelf').tabIndex = -1;
addEventListener('hashchange', route);
addEventListener('keydown', e => { if (e.key === 'Escape' && !$('detail').hidden) location.hash = '#/'; });

// 棚（three.js）
(async () => {
  let THREE; try { THREE = await import('three'); } catch { route(); return; }
  try { await Promise.all([document.fonts.load('600 64px "Shippori Mincho"', F.works.map(w => w.title).join('') + F.troupe + '上演台本'), document.fonts.load('300 32px Jost', '2019')]); } catch {}
  const cv = $('shelf'), box = cv.parentElement;
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  r.setPixelRatio(Math.min(2, devicePixelRatio)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = .8; r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a0908);
  const cam = new THREE.PerspectiveCamera(34, 1, .01, 20);
  const std = (c, ro = .7, me = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: ro, metalness: me });
  const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; scene.add(o); return o; };

  // 壁と棚（下の段の天板の上に台本が立つ。上の段の板が画面の上を締める）
  add(new THREE.PlaneGeometry(6, 3), std(0x14100d, .95), 0, .3, -.14);
  const wood = new THREE.MeshPhysicalMaterial({ color: 0x3a2716, roughness: .55, clearcoat: .3, clearcoatRoughness: .5 });
  add(new THREE.BoxGeometry(1.1, .028, .27), wood, 0, -.014, 0);
  add(new THREE.BoxGeometry(1.1, .028, .27), wood, 0, .33, 0);
  add(new THREE.BoxGeometry(1.1, .028, .27), wood, 0, -.36, 0);
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(.028, .9, .27), wood, sx * .564, -.02, 0);
  add(new THREE.BoxGeometry(1.1, .9, .01), std(0x1c140e, .8), 0, -.02, -.13);

  // 布張りの台本（背表紙に縦書きの題、表紙に横書きの題）
  const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const cloth = (g, w, h, col) => { g.fillStyle = col; g.fillRect(0, 0, w, h); let s = 11; for (let i = 0; i < w * h / 40; i++) { s = (s * 16807) % 2147483647; const x = s % w, y = (s >> 8) % h; g.fillStyle = `rgba(255,240,220,${(s % 7) / 260})`; g.fillRect(x, y, 2, 1); } };
  const gold = '#d8bb86';
  const TH = [.024, .018, .022, .03, .034, .02, .028, .026], HT = [.212, .206, .21, .214, .21, .208, .212, .21], DP = .148;
  const paper = tex(256, 256, (g, w, h) => { g.fillStyle = '#d9cfbd'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(90,70,50,${.05 + (y % 7) / 120})`; g.fillRect(0, y, w, 1); } });
  const books = []; let x = -.2;
  F.works.forEach((w, i) => {
    const t = TH[i % TH.length], h = HT[i % HT.length];
    const light = new THREE.Color(w.color).getHSL({}).l > .38;
    const spine = tex(128, 1024, (g, W, H) => {
      cloth(g, W, H, w.color); g.strokeStyle = gold; g.lineWidth = 3;
      for (const y of [46, 58, H - 58, H - 46]) { g.beginPath(); g.moveTo(10, y); g.lineTo(W - 10, y); g.stroke(); }
      g.fillStyle = '#f2e6cf'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const cs = [...w.title], fs = Math.min(76, 640 / cs.length); g.font = `600 ${fs}px "Shippori Mincho", serif`;
      cs.forEach((c, k) => g.fillText(c, W / 2, 130 + fs * .55 + k * fs * 1.08));
      g.fillStyle = gold; g.font = '600 30px "Shippori Mincho", serif'; [...F.troupe].forEach((c, k) => g.fillText(c, W / 2, H - 250 + k * 34));
      g.font = '400 30px Jost, sans-serif'; g.fillStyle = light ? '#2a2622' : gold; g.fillText(String(w.year), W / 2, H - 100);
    });
    const cover = tex(720, 1024, (g, W, H) => {
      cloth(g, W, H, w.color); g.strokeStyle = gold; g.lineWidth = 3; g.strokeRect(46, 46, W - 92, H - 92);
      g.fillStyle = '#f2e6cf'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const fs = Math.min(92, 560 / [...w.title].length); g.font = `600 ${fs}px "Shippori Mincho", serif`; g.fillText(w.title, W / 2, H * .38);
      g.fillStyle = gold; g.font = '500 30px "Shippori Mincho", serif'; g.fillText(`${F.troupe}　上演台本`, W / 2, H * .38 + fs + 20);
      g.fillStyle = '#efe3cc'; g.font = '500 26px "Shippori Mincho", serif'; g.fillText('配役', W / 2, H * .62);
      w.cast.forEach((c, k) => g.fillText(c, W / 2, H * .62 + 44 + k * 38));
      g.fillStyle = gold; g.font = '300 34px Jost, sans-serif'; g.fillText(String(w.year), W / 2, H - 110);
    });
    const cm = new THREE.MeshStandardMaterial({ map: cover, roughness: .72 }), sm = new THREE.MeshStandardMaterial({ map: spine, roughness: .7 }), pm = new THREE.MeshStandardMaterial({ map: paper, roughness: .9 }), bm = std(new THREE.Color(w.color), .75);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(t, h, DP), [cm, bm, pm, pm, sm, pm]);
    mesh.castShadow = mesh.receiveShadow = true; mesh.userData.id = w.id;
    const g = new THREE.Group(); g.position.set(x + t / 2, h / 2, .118 - DP / 2); g.add(mesh); scene.add(g);
    books.push({ w, g, mesh, x: x + t / 2, h, cur: { pull: 0, rot: 0, lift: 0, glow: 0, rv: 0 }, sm });
    x += t + .004;
  });
  // ブックエンド（右）
  const be = std(0x2a2a2c, .35, .9); add(new THREE.BoxGeometry(.004, .14, .12), be, x + .004, .07, .05); add(new THREE.BoxGeometry(.07, .004, .12), be, x + .04, .002, .05);
  // 右の空いた所に、小さなゴーストライト（真鍮の台と裸電球）
  add(new THREE.CylinderGeometry(.03, .034, .01, 24), std(0x6b5233, .35, .8), .2, .005, .02);
  add(new THREE.CylinderGeometry(.003, .003, .16, 8), std(0x6b5233, .35, .8), .2, .085, .02);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.016, 20, 16), new THREE.MeshBasicMaterial({ color: 0xffe0b0 })); bulb.position.set(.2, .18, .02); scene.add(bulb);
  const ghost = new THREE.PointLight(0xffc98a, .5, 1.2, 2); ghost.position.copy(bulb.position); scene.add(ghost);

  // 照明：上の段から台本を照らすクリップライト、奥からかすかなリム
  const key = new THREE.SpotLight(0xffe3c0, 1.9, 3, .6, .45, 1.6); key.position.set(-.05, .3, .5); key.target.position.set(-.05, .08, .05);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0003; key.shadow.camera.near = .05; scene.add(key, key.target);
  const hemi = new THREE.HemisphereLight(0x2a2a36, 0x0a0806, .35); scene.add(hemi);
  const keyHome = key.target.position.clone();

  // 視点
  const V = (a, b, c) => new THREE.Vector3(a, b, c);
  let selected = null, hovered = null;
  const camCur = { p: V(0, .12, 1.4), l: V(0, .08, 0) }, camTo = { p: V(), l: V() };
  function home() {
    const a = cam.aspect, half = a < 1 ? .21 : .38, d = half / (Math.tan(cam.fov * Math.PI / 360) * a);
    camTo.p.set(.015, a < 1 ? .1 : .1, Math.max(.5, d)); camTo.l.set(a < 1 ? -.03 : .015, a < 1 ? -.04 : .06, 0); if (a < 1) camTo.p.x = -.03;
  }
  function focusBook(b) {
    const wide = innerWidth >= 900, sh = wide ? .085 : 0;
    camTo.p.set(b.x + sh, .15, wide ? .72 : .72); camTo.l.set(b.x + sh, .13, .24);
  }
  const fit = () => { const w = box.clientWidth, h = box.clientHeight; r.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 44 : 34; cam.updateProjectionMatrix(); selected ? focusBook(selected) : home(); };
  addEventListener('resize', fit); new ResizeObserver(fit).observe(box); fit();   // 記録を開くと棚の高さが変わるので、箱の大きさも見張る
  camCur.p.copy(camTo.p); camCur.l.copy(camTo.l);
  onSelect = id => { selected = id ? books.find(b => b.w.id === id) : null; selected ? focusBook(selected) : home(); };

  // 指で選ぶ
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  const pick = e => { const q = cv.getBoundingClientRect(); ptr.set((e.clientX - q.left) / q.width * 2 - 1, -(e.clientY - q.top) / q.height * 2 + 1); ray.setFromCamera(ptr, cam); const hit = ray.intersectObjects(books.map(b => b.mesh))[0]; return hit ? books.find(b => b.mesh === hit.object) : null; };
  cv.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; hovered = pick(e); cv.style.cursor = hovered ? 'pointer' : 'default'; });
  cv.addEventListener('pointerleave', () => { hovered = null; });
  // キーボード：←→で背表紙を選び、Enter で開く
  let kbd = null; cv.tabIndex = 0; cv.setAttribute('role', 'group'); cv.setAttribute('aria-label', '台本の棚。左右の矢印で背表紙を選び、Enter で開きます'); cv.removeAttribute('aria-hidden');
  const say = el('p', 'sr'); say.setAttribute('aria-live', 'polite'); box.append(say);
  cv.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const i = kbd ? books.indexOf(kbd) : -1; kbd = books[(i + (e.key === 'ArrowRight' ? 1 : books.length - 1 + (i < 0 ? 1 : 0))) % books.length]; say.textContent = `${kbd.w.year}年『${kbd.w.title}』`; }
    if (e.key === 'Enter' && kbd) location.hash = `#/w/${kbd.w.id}`;
  });
  cv.addEventListener('blur', () => { kbd = null; });
  cv.addEventListener('click', e => { const b = pick(e); if (b) location.hash = `#/w/${b.w.id}`; });

  let last = performance.now(); const tmpV = new THREE.Vector3();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const k = reduce ? 1 : 1 - Math.exp(-dt * 7), kc = reduce ? 1 : 1 - Math.exp(-dt * 3.2);
    for (const b of books) {
      const sel = b === selected, hov = (b === hovered || b === kbd) && !selected, c = b.cur;
      if (sel && !c.was) { c.was = true; c.t0 = now; } if (!sel) c.was = false;
      const age = sel ? (now - c.t0) / 1000 : 9;
      // 選んだら 80ms だけ奥へ押し込んでから引き出す（手で本を抜く予備動作）
      const to = { pull: sel ? (age < .08 && !reduce ? -.006 : .2) : hov ? .012 : 0, rot: sel ? -Math.PI / 2 : 0, lift: sel ? .025 : hov ? .004 : 0, glow: sel || hov ? 1 : 0 };
      if (reduce) { c.pull = to.pull; c.lift = to.lift; c.glow = to.glow; c.rot = to.rot; c.rv = 0; }
      else {
        c.pull += (to.pull - c.pull) * k; c.lift += (to.lift - c.lift) * k; c.glow += (to.glow - c.glow) * k;
        // 回転は引き出しが 0.14 を超えてから。ばね（少しだけ行き過ぎて戻る）
        const rt = sel ? (c.pull > .14 ? to.rot : 0) : (c.pull < .1 || c.rot === 0 ? 0 : 0);
        const w0 = 10, z = .78; c.rv += (-(w0 * w0) * (c.rot - rt) - 2 * z * w0 * c.rv) * dt; c.rot += c.rv * dt;
      }
      b.g.position.z = .118 - DP / 2 + c.pull; b.g.position.y = b.h / 2 + c.lift; b.g.rotation.y = c.rot;
      b.sm.emissive.setRGB(.06 * c.glow, .045 * c.glow, .02 * c.glow);
    }
    // 選んだ本に一灯を寄せ、ほかの本も少しだけ見えるように
    const kt = selected ? tmpV.set(selected.x, .12, .25) : keyHome; key.target.position.lerp(kt, reduce ? 1 : 1 - Math.exp(-dt * 6));
    hemi.intensity += ((selected ? .6 : .35) - hemi.intensity) * (reduce ? 1 : 1 - Math.exp(-dt * 4));
    camCur.p.lerp(camTo.p, kc); camCur.l.lerp(camTo.l, kc);
    cam.position.copy(camCur.p); if (!reduce) cam.position.x += Math.sin(now / 4000) * .004; cam.lookAt(camCur.l);
    ghost.intensity = .5 + (reduce ? 0 : Math.sin(now / 1300) * .03);
    r.render(scene, cam); if (!cv.classList.contains('ready')) cv.classList.add('ready'); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  route();
})();
