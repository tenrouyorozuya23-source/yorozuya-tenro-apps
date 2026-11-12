// ミュージカル『星屑通り』特設サイト：夜の商店街のセットを three.js で建て、ページ（トップ・物語・出演・チケット）を移るたびに照明とカメラが変わる。
// 物語では街灯がひとつずつ消え、出演では1人に1灯、チケットでは通りの灯りがすべて点いて時計店の電飾が走る
import { F } from './data.js';
const $ = id => document.getElementById(id);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const md = s => { const [, m, d] = s.split('-').map(Number); return `${m}.${d}`; };

// 文字（facts.json から）
$('genre').textContent = F.genre; $('kana').textContent = F.kana; $('title').textContent = F.title; $('en').textContent = F.en; $('copy').textContent = F.copy;
$('when').append(el('span', 'yr', F.period.from.slice(0, 4)), md(F.period.from), el('small', null, F.period.from_wd), '— ', md(F.period.to), el('small', null, F.period.to_wd));
$('where').textContent = `${F.venue}（全${F.seats}席）`;
for (const p of F.story) $('story').append(el('p', null, p));
for (const s of F.scenes) { const li = el('li'); li.append(el('span', 'no', s.no), el('span', 't', s.title), el('span', 'x', s.text)); $('scenes').append(li); }
for (const [k, v] of F.credits) $('credits').append(el('dt', null, k), el('dd', null, v));
const cards = F.cast.map((c, i) => {
  const li = el('li'), b = el('button', 'card'); b.type = 'button'; b.style.setProperty('--h', c.hue); b.setAttribute('aria-pressed', 'false');
  b.append(el('span', 'bulb'), el('span', 'r', c.role), el('span', 'n', c.name), el('span', 'l', c.line)); li.append(b); $('cast').append(li); return b;
});
const sale = $('sale'); sale.append(`${F.sale.date.slice(0, 4)}.${md(F.sale.date)}`, el('small', null, `（${F.sale.wd}）${F.sale.label}`));
const row = (k, v) => { const d = el('div'); d.append(el('dt', null, k), el('dd', null, v)); $('tinfo').append(d); };
row('期間', `${F.period.from.slice(0, 4)}.${md(F.period.from)}（${F.period.from_wd}）— ${md(F.period.to)}（${F.period.to_wd}）`);
F.times.forEach(([a, b], i) => row(i ? '' : '開演', `${a}　${b}`)); row('上演時間', F.running); row('劇場', `${F.venue}（全${F.seats}席）`);
for (const [k, v] of F.prices) { const li = el('li', null, k); li.append(el('b', null, v)); $('price').append(li); }
$('pnote').textContent = F.price_note;
$('buy').addEventListener('click', () => { $('msg').textContent = '見本のため、チケットの申し込みはできません。'; });
$('prod').textContent = `製作　${F.producer}`; $('discl').textContent = F.disclosure;

// ページの切り替え（#/top・#/story・#/cast・#/ticket）
const PAGES = { top: 'トップ', story: '物語', cast: '出演', ticket: 'チケット' };
let page = null, onPage = () => {}, pick = -1, onPick = () => {};
function route(first) {
  const m = location.hash.match(/^#\/(\w+)/), p = m && PAGES[m[1]] ? m[1] : 'top';
  if (p === page) return;
  page = p; document.body.dataset.page = p;
  document.querySelectorAll('.page').forEach(s => { const on = s.dataset.page === p; s.hidden = !on; s.classList.toggle('enter', on && !first); });
  document.querySelectorAll('.top nav a').forEach(a => a.dataset.p === p ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  document.title = p === 'top' ? `ミュージカル『${F.title}』公式サイト（見本）` : `${PAGES[p]}｜ミュージカル『${F.title}』（見本）`;
  if (p !== 'cast') setPick(-1);
  if (!first) { scrollTo(0, 0); document.querySelector(`.page[data-page="${p}"] [tabindex="-1"]`).focus({ preventScroll: true }); }
  onPage(p, first);
}
function setPick(i) { pick = i; cards.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i))); onPick(i); }
cards.forEach((b, i) => b.addEventListener('click', () => setPick(pick === i ? -1 : i)));
addEventListener('hashchange', () => route(false));
route(true);

// セット（three.js）
(async () => {
  let THREE, Reflector;
  try { THREE = await import('three'); ({ Reflector } = await import('three/addons/objects/Reflector.js')); } catch { return; }
  const cv = $('set'), box = cv.parentElement;
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(1.5, devicePixelRatio)); r.setClearColor(0x07080c, 1);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x07080c, .019);
  const cam = new THREE.PerspectiveCamera(42, 1, .1, 200);
  const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
  const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

  // 濡れた路面：映り込み（Reflector）の上に、水たまりの所だけ薄い暗い面を重ねる
  const ref = new Reflector(new THREE.PlaneGeometry(14, 90), { textureWidth: 512, textureHeight: 512, color: 0x8a8f99 });
  ref.rotation.x = -Math.PI / 2; ref.position.set(0, 0, -18); scene.add(ref);
  const puddle = canvasTex(256, 512, (g, w, h) => { g.fillStyle = '#e0e0e0'; g.fillRect(0, 0, w, h); for (let k = 0; k < 70; k++) { const x = rnd() * w, y = rnd() * h, rr = 8 + rnd() * 40, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, '#202020'); gr.addColorStop(1, 'rgba(32,32,32,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rr, rr * 1.8, 0, 0, 7); g.fill(); } });
  puddle.colorSpace = THREE.NoColorSpace;
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(14, 90), new THREE.MeshStandardMaterial({ color: 0x0c0d11, roughness: .5, metalness: .1, transparent: true, alphaMap: puddle, opacity: .9 }));
  wet.rotation.x = -Math.PI / 2; wet.position.set(0, .005, -18); scene.add(wet);
  const stone = new THREE.MeshStandardMaterial({ color: 0x1b1c21, roughness: .8 });
  for (const sx of [-1, 1]) { const curb = new THREE.Mesh(new THREE.BoxGeometry(1.4, .14, 90), stone); curb.position.set(sx * 3.3, .07, -18); scene.add(curb); }

  // 両側の店：1階は店の窓（開いている店は灯り、閉じた店はシャッター）、上の階は窓がまばらに灯る
  const grit = canvasTex(256, 256, (g, w, h) => { const im = g.createImageData(w, h); for (let k = 0; k < w * h; k++) { const v = 205 + rnd() * 50; im.data.set([v, v, v, 255], k * 4); } g.putImageData(im, 0, 0); });
  grit.wrapS = grit.wrapT = THREE.RepeatWrapping; grit.repeat.set(3, 3);
  const wall = new THREE.MeshStandardMaterial({ color: 0x1a1b21, roughness: 1, map: grit, roughnessMap: grit });
  const fascia = new THREE.MeshStandardMaterial({ color: 0x221c18, roughness: .7 });
  const shopTex = canvasTex(256, 160, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffdcae'); gr.addColorStop(1, '#a8673a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(40,24,12,.55)'; for (let y = 40; y < h; y += 40) g.fillRect(0, y, w, 5); g.fillStyle = 'rgba(30,18,10,.8)'; g.fillRect(0, 0, w, 10); g.fillRect(w / 2 - 3, 0, 6, h); });
  const shutTex = canvasTex(64, 128, (g, w, h) => { g.fillStyle = '#2a2b30'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a1b1f'; for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 2); });
  const winTex = canvasTex(32, 48, (g, w, h) => { g.fillStyle = '#ffd9a6'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(60,40,20,.5)'; g.fillRect(w / 2 - 1, 0, 2, h); g.fillRect(0, h / 2 - 1, w, 2); });
  const shops = [];
  for (const sx of [-1, 1]) {
    for (let z = 4, k = 0; z > -38; k++) {
      const wdt = 3.4 + rnd() * 1.6, hgt = 5 + rnd() * 5, cz = z - wdt / 2;
      const b = new THREE.Mesh(new THREE.BoxGeometry(5, hgt, wdt - .12), wall); b.position.set(sx * 6.5, hgt / 2, cz); scene.add(b);
      const open = rnd() > .45;  // 店の正面（通りに向く面）は x=±4.0
      const m = new THREE.Mesh(new THREE.PlaneGeometry(wdt - .7, 2.3), open ? new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: shopTex, emissiveIntensity: .5 }) : new THREE.MeshStandardMaterial({ map: shutTex, roughness: .6, metalness: .5 }));
      m.position.set(sx * 3.99, 1.35, cz); m.rotation.y = -sx * Math.PI / 2; scene.add(m);
      if (open) shops.push({ m: m.material, sx, z: cz, I: .5, tI: .5, at: 0 });
      const fb = new THREE.Mesh(new THREE.BoxGeometry(.1, .32, wdt - .3), fascia); fb.position.set(sx * 3.95, 2.62, cz); scene.add(fb);
      // 袖看板（店名は載せない色の面）。通りの奥へ向けて張り出す
      if (rnd() > .3) { const sg = new THREE.Mesh(new THREE.PlaneGeometry(.42, 1.3), new THREE.MeshStandardMaterial({ color: 0, emissive: new THREE.Color().setHSL([.02, .08, .55, .95][Math.floor(rnd() * 4)], .6, .42), emissiveIntensity: open ? .22 : .05, side: THREE.DoubleSide })); sg.position.set(sx * 3.62, 3.7, cz + wdt / 2 - .45); scene.add(sg); }
      const aw = new THREE.Mesh(new THREE.BoxGeometry(.7, .06, wdt - .5), new THREE.MeshStandardMaterial({ color: 0x241a16, roughness: .7 })); aw.position.set(sx * 3.65, 2.75, cz); aw.rotation.z = sx * .18; scene.add(aw);
      for (let f = 1; f < hgt / 2.6 - .4; f++) for (let c = -1; c <= 1; c += 2) {
        if (rnd() < .55) continue;
        const wm = new THREE.Mesh(new THREE.PlaneGeometry(.7, 1), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: .25 + rnd() * .5 }));
        wm.position.set(sx * 3.99, 1.6 + f * 2.6, cz + c * wdt * .22); wm.rotation.y = -sx * Math.PI / 2; scene.add(wm);
      }
      z -= wdt;
    }
  }

  // 突き当たりの時計店：大きな丸い時計と、ひさしの電飾
  const end = new THREE.Group(); end.position.set(0, 0, -40); scene.add(end);
  const eb = new THREE.Mesh(new THREE.BoxGeometry(9, 9, 2), wall); eb.position.set(0, 4.5, -1); end.add(eb);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.5), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffffff, emissiveMap: shopTex, emissiveIntensity: .7 })); door.position.set(0, 1.25, .01); end.add(door);
  const face = canvasTex(512, 512, (g, w) => { g.fillStyle = '#efe4cf'; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 6, 0, 7); g.fill(); g.strokeStyle = '#2b2118'; g.lineWidth = 10; g.stroke(); for (let k = 0; k < 60; k++) { const a = k / 60 * Math.PI * 2, r1 = w / 2 - 22, r0 = r1 - (k % 5 ? 10 : 34); g.lineWidth = k % 5 ? 3 : 9; g.beginPath(); g.moveTo(w / 2 + Math.sin(a) * r0, w / 2 - Math.cos(a) * r0); g.lineTo(w / 2 + Math.sin(a) * r1, w / 2 - Math.cos(a) * r1); g.stroke(); } });
  const clock = new THREE.Mesh(new THREE.CircleGeometry(1.25, 64), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffffff, emissiveMap: face, emissiveIntensity: .8 })); clock.position.set(0, 5.4, .05); end.add(clock);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.3, .07, 12, 64), new THREE.MeshStandardMaterial({ color: 0xb08850, metalness: 1, roughness: .35 })); rim.position.copy(clock.position); end.add(rim);
  const hand = (len, wd) => { const g = new THREE.BoxGeometry(wd, len, .02); g.translate(0, len / 2 - .08, 0); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x1d1612 })); m.position.set(0, 5.4, .09); end.add(m); return m; };
  const hH = hand(.7, .07), hM = hand(1.05, .045);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), 24);
  for (let k = 0; k < 24; k++) { const m = new THREE.Matrix4().makeTranslation(-3.45 + k * .3, 2.85, .25); bulbs.setMatrixAt(k, m); bulbs.setColorAt(k, new THREE.Color(0)); }
  end.add(bulbs);
  const endLight = new THREE.PointLight(0xffd29a, 0, 12, 2); endLight.position.set(0, 3, 2.5); end.add(endLight);

  // 街灯（左右交互に6本）
  const glowTex = canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.2, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  const iron = new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: .4, metalness: .8 });
  const WARM = new THREE.Color(0xffc68a);
  const lamps = [0, -6.5, -13, -19.5, -26, -32.5].map((z, i) => {
    const x = i % 2 ? 2.55 : -2.55, g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .08, 4.2, 10), iron); pole.position.y = 2.1; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.6, .04, .04), iron); arm.position.set(-Math.sign(x) * .28, 4.15, 0); g.add(arm);
    const headPos = new THREE.Vector3(-Math.sign(x) * .55, 4.0, 0);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(.22, .2, 16, 1, true), iron); shade.position.copy(headPos).add(new THREE.Vector3(0, .1, 0)); g.add(shade);
    const bulbMat = new THREE.MeshBasicMaterial({ color: WARM.clone() }); const bulb = new THREE.Mesh(new THREE.SphereGeometry(.09, 16, 12), bulbMat); bulb.position.copy(headPos); g.add(bulb);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: WARM.clone(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); glow.position.copy(headPos); glow.scale.setScalar(2.2); g.add(glow);
    const light = new THREE.PointLight(WARM.clone(), 0, 11, 1.6); light.position.copy(headPos).add(new THREE.Vector3(0, -.15, 0)); g.add(light);
    const world = headPos.clone().add(g.position);
    return { light, bulbMat, glow, world, x, z, I: 0, col: WARM.clone(), tI: 0, tCol: WARM.clone(), at: 0, off: false, S: 2.2, tS: 2.2 };
  });

  // 空：星と、ゆっくり降る雪
  const sg = new THREE.BufferGeometry(), sp = [];
  for (let k = 0; k < 1400; k++) { const a = rnd() * Math.PI * 2, e = .12 + rnd() * 1.3, R = 90; sp.push(Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, Math.sin(a) * Math.cos(e) * R - 20); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: .8, fog: false })); scene.add(stars);
  const N = 700, snow = new Float32Array(N * 3), sv = new Float32Array(N);
  for (let k = 0; k < N; k++) { snow[k * 3] = (rnd() - .5) * 10; snow[k * 3 + 1] = rnd() * 9; snow[k * 3 + 2] = 8 - rnd() * 46; sv[k] = .25 + rnd() * .35; }
  const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.BufferAttribute(snow, 3));
  const snowM = new THREE.PointsMaterial({ color: 0xffffff, size: .07, map: glowTex, transparent: true, opacity: .7, depthWrite: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Points(ng, snowM));

  const moon = new THREE.DirectionalLight(0x8fb0ff, 0); moon.position.set(-6, 14, -10); scene.add(moon);
  const amb = new THREE.HemisphereLight(0x1c2440, 0x060608, .5); scene.add(amb);

  // ページごとの照明とカメラ（縦長の画面ではカメラを少し引く）
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const POSE = {
    top: { p: V(.5, 1.45, 7), t: V(0, 2.4, -22) },
    story: { p: V(1.8, 2.2, 6), t: V(-.5, 2.8, -30) },
    cast: { p: V(1.3, 2.1, 4), t: V(-.4, 1.9, -14) },
    ticket: { p: V(0, 4.6, 3), t: V(0, 2.6, -40) },
  };
  const LOOK = {
    top: { lamps: () => [1, 1, 1, 1, 1, 1].map(v => [v * 16, WARM]), moon: .25, shops: .5, end: 0, marquee: 0 },
    // 物語：店が閉じるたびに街灯がひとつずつ消える。残るのは手前・中ほど・時計店の前の3本
    story: { lamps: () => [1, 0, 1, 0, 0, 1].map(v => [v * 14, WARM]), moon: .6, shops: .3, end: 9, marquee: 0 },
    cast: { lamps: () => [...F.cast.map((c, i) => [pick < 0 ? 9 : i === pick ? 40 : .6, new THREE.Color().setHSL(c.hue / 360, .85, .66)]), [0, WARM]], moon: .3, shops: .16, end: 0, marquee: 0 },
    ticket: { lamps: () => [1, 1, 1, 1, 1, 1].map(v => [v * 22, WARM]), moon: .2, shops: .7, end: 18, marquee: 1 },
  };
  let twDur = 1.8, look = LOOK.top, from = null, to = POSE.top, tw = 1, twStart = 0, moonT = .25, shopT = .5, endT = 0, mq = 0, mqT = 0;
  const curP = POSE.top.p.clone(), curT = POSE.top.t.clone();
  function apply(p, first) {
    look = LOOK[p]; moonT = look.moon; shopT = look.shops; endT = look.end; mqT = look.marquee;
    const now = performance.now() / 1000, L = look.lamps();
    lamps.forEach((l, i) => { const [I, c] = L[i]; l.off = I < l.tI - 1; l.tI = I; l.tCol.copy(c); l.tS = p === 'cast' && i === pick ? 3.6 : 2.2; l.at = now + (first || reduce ? 0 : (p === 'story' ? [0, .6, 0, 1.2, 1.8, 0][i] : i * .12)); });
    // 物語では、消えた街灯のそばの店も同じ瞬間に灯りを落とす（店が閉じる）
    for (const sh of shops) { const near = lamps.find(l => Math.sign(l.x) === sh.sx && Math.abs(l.z - sh.z) < 3.4); const dark = p === 'story' && near && near.tI < 1; sh.tI = dark ? 0 : shopT; sh.at = dark ? near.at : now; }
    from = { p: curP.clone(), t: curT.clone() }; to = POSE[p]; tw = first || reduce ? 1 : 0; twStart = now; twDur = 1.8;
    // 出演でカードを選んだら、その人の街灯の手前へ寄る
    if (p === 'cast' && pick >= 0) { const l = lamps[pick]; to = { p: V(-Math.sign(l.x) * .5, 2.1, l.z + 7.5), t: l.world.clone().add(V(Math.sign(l.x) * -.6, -1.7, 0)) }; twDur = 1.2; }
    if (first || reduce) { curP.copy(to.p); curT.copy(to.t); }
  }
  onPage = apply; onPick = () => { if (page === 'cast') apply('cast', false); };
  apply(page, true);

  function fit() { const w = box.clientWidth, h = box.clientHeight; r.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 64 : 42; cam.updateProjectionMatrix(); }
  new ResizeObserver(fit).observe(box); fit();

  const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const aim = new THREE.Vector3(), cpos = new THREE.Vector3();
  let last = performance.now() / 1000, shown = false, off = 0;
  function frame(ms) {
    const now = ms / 1000, dt = Math.min(.05, now - last); last = now;
    const k = reduce ? 1 : 1 - Math.exp(-dt * 4);
    // 街灯：消えるときは2〜3回またたいてから落ちる
    for (const l of lamps) {
      if (now < l.at) continue;
      l.I += (l.tI - l.I) * (l.off ? 1 - Math.exp(-dt * 2.5) : k); l.col.lerp(l.tCol, k);
      let I = l.I; if (l.off && now - l.at < .45 && !reduce) I *= (Math.sin((now - l.at) * 70) > 0 ? 1 : .15);
      l.light.intensity = I; l.light.color.copy(l.col);
      const s = Math.min(1, I / 14); l.bulbMat.color.copy(l.col).multiplyScalar(.08 + s * 1.2); l.glow.material.color.copy(l.col); l.glow.material.opacity = s * .9; l.S += (l.tS - l.S) * k; l.glow.scale.setScalar(l.S);
    }
    moon.intensity += (moonT - moon.intensity) * k; endLight.intensity += (endT - endLight.intensity) * k; mq += (mqT - mq) * k;
    for (const sh of shops) { if (now >= sh.at) { sh.I += (sh.tI - sh.I) * (sh.tI < sh.I ? 1 - Math.exp(-dt * 3) : k); sh.m.emissiveIntensity = sh.I; } }
    // 時計店の電飾：3つおきに光が走る
    const ph = Math.floor(now * 6); const c = new THREE.Color();
    for (let i = 0; i < 24; i++) { const on = reduce ? 1 : ((i + ph) % 3 === 0 ? 1 : .25); bulbs.setColorAt(i, c.setRGB(1, .82, .55).multiplyScalar(.04 + mq * on * 1.4)); }
    bulbs.instanceColor.needsUpdate = true;
    const d = new Date(); hM.rotation.z = -(d.getMinutes() + d.getSeconds() / 60) / 60 * Math.PI * 2; hH.rotation.z = -((d.getHours() % 12) + d.getMinutes() / 60) / 12 * Math.PI * 2;
    // 雪
    if (!reduce) { for (let i = 0; i < N; i++) { snow[i * 3 + 1] -= sv[i] * dt; snow[i * 3] += Math.sin(now * .7 + i) * .002; if (snow[i * 3 + 1] < 0) snow[i * 3 + 1] = 9; } ng.attributes.position.needsUpdate = true; }
    // カメラ：ページの移り変わりは 1.8 秒で移動、止まっている間もごくゆっくり揺れる
    if (tw < 1) { tw = Math.min(1, (now - twStart) / twDur); const e = ease(tw); curP.lerpVectors(from.p, to.p, e); curT.lerpVectors(from.t, to.t, e); }
    aim.copy(curT);
    cpos.copy(curP); if (!reduce) { cpos.x += Math.sin(now * .21) * .12; cpos.y += Math.sin(now * .17) * .05; }
    cam.position.copy(cpos); cam.userData.a = cam.userData.a || curT.clone(); cam.userData.a.lerp(aim, k * .6 + (tw < 1 ? .4 : 0)); cam.lookAt(cam.userData.a);
    // 縦長の画面では、物語・出演・チケットの板が下半分を覆うので、絵の中心を上へずらす
    const W = box.clientWidth, H = box.clientHeight, offT = W < H && page !== 'top' ? H * .2 : 0;
    off += (offT - off) * k; if (Math.abs(off) > .5) cam.setViewOffset(W, H, 0, off, W, H); else cam.clearViewOffset();
    r.render(scene, cam);
    if (!shown) { shown = true; cv.classList.add('ready'); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
