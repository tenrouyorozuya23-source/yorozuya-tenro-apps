// 汐見 蓮司 ポートフォリオ：写真の代わりに、横顔のシルエットを three.js で組み、照明だけで「役の幅」を見せる。冒頭は映画のタイトルバック
import { F } from './data.js';
const $ = id => document.getElementById(id);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
$('logo').textContent = F.name; $('t-role').textContent = F.role; $('h-name').textContent = F.name; $('t-en').textContent = F.en; $('t-tag').textContent = F.tagline;
$('fic').textContent = '※架空の俳優です'; $('about').textContent = F.about; $('rnote').textContent = F.rates_note; $('agency').textContent = `所属　${F.agency}`; $('discl').textContent = F.disclosure;
for (const w of F.works) { const li = el('li'), l = el('p', 'l'), r = el('p', 'r'); l.style.margin = r.style.margin = '0'; l.append(String(w.year), el('span', null, w.kind)); r.append(el('span', 't', `『${w.title}』`), el('span', 'ro', `${w.role}　${w.note}`)); li.append(l, r); $('roll').append(li); }
for (const [k, v] of F.profile) { const d = el('div'); d.append(el('dt', null, k), el('dd', null, v)); $('prof').append(d); }
for (const [k, v] of F.rates) { const d = el('div'); d.append(el('dt', null, k), el('dd', null, v)); $('rates').append(d); }
for (const k of F.kinds) { const o = el('option', null, k); $('f-kind').append(o); }

// 問い合わせ（見本：送信しない。入力の確かめだけ）
$('form').addEventListener('submit', e => {
  e.preventDefault(); const bad = [];
  const need = [['f-name', 'お名前'], ['f-mail', 'メールアドレス'], ['f-body', '内容']];
  for (const [id, label] of need) { const x = $(id), ng = !x.value.trim() || (id === 'f-mail' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.value)); x.setAttribute('aria-invalid', String(ng)); if (ng) bad.push(label); }
  $('f-err').textContent = bad.length ? `${bad.join('・')}を確かめてください` : ''; $('f-msg').textContent = '';
  if (bad.length) { $(need.find(([, l]) => l === bad[0])[0]).focus(); return; }
  $('f-msg').textContent = '見本のため送信していません。実際のサイトでは、この内容が事務所に届きます。';
});

// 照明の選択（ラジオの並び）
let look = 0, onLook = () => {};
const lbtn = F.looks.map((L, i) => { const b = el('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(i === 0)); b.tabIndex = i ? -1 : 0; b.append(L.name, el('small', null, L.note)); b.addEventListener('click', () => setLook(i, true)); $('looks').append(b); return b; });
function setLook(i, user) { look = i; lbtn.forEach((b, k) => { b.setAttribute('aria-checked', String(k === i)); b.tabIndex = k === i ? 0 : -1; }); const s = $('slate'); s.textContent = ''; s.append(`SCENE ${String(i + 1).padStart(2, '0')}`, el('b', null, F.looks[i].name)); if (user && playing) togglePlay(); onLook(i); }
$('looks').addEventListener('keydown', e => { const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!d) return; e.preventDefault(); const n = (look + d + lbtn.length) % lbtn.length; setLook(n, true); lbtn[n].focus(); });
let playing = false, playT = 0;
function togglePlay() { playing = !playing; $('play').setAttribute('aria-pressed', String(playing)); $('play').textContent = playing ? '止める' : '続けて見る'; playT = performance.now(); }
$('play').addEventListener('click', togglePlay);
setLook(0);

(async () => {
  let THREE; try { THREE = await import('three'); } catch { return; }
  const scene = new THREE.Scene();
  // 横顔（右向き）。前の輪郭・後ろの輪郭・左右の幅を高さごとに決め、各高さの断面を楕円にして頭の立体を組む
  const FRONT = [[.52, .04], [.42, .24], [.24, .33], [.1, .35], [.04, .33], [-.02, .37], [-.13, .46], [-.17, .44], [-.19, .37], [-.24, .385], [-.27, .36], [-.31, .38], [-.35, .35], [-.38, .31], [-.44, .33], [-.5, .3], [-.56, .2], [-.6, .12], [-.74, .11], [-.86, .2], [-1.0, .5], [-1.25, .62], [-1.7, .66]];
  // 鼻・唇・顎の凹凸は顔の中央だけに付ける（横まで伸ばすと帯に見える）。その外側は、凹凸のない滑らかな顔の線
  const BASE = [[.52, .04], [.42, .24], [.24, .33], [.1, .35], [-.1, .36], [-.3, .35], [-.44, .33], [-.5, .3], [-.56, .2], [-.6, .12], [-.74, .11], [-.86, .2], [-1.0, .5], [-1.25, .62], [-1.7, .66]];
  const BACK = [[.52, .04], [.48, -.2], [.3, -.42], [-.02, -.5], [-.36, -.46], [-.6, -.34], [-.8, -.33], [-.98, -.5], [-1.25, -.66], [-1.7, -.7]];
  const WIDE = [[.52, 0], [.47, .2], [.3, .33], [0, .37], [-.3, .34], [-.5, .26], [-.62, .19], [-.85, .21], [-1.0, .62], [-1.15, .86], [-1.7, .92]];
  const dense = pts => new THREE.SplineCurve(pts.map(([y, x]) => new THREE.Vector2(y, x))).getSpacedPoints(600);
  const DF = dense(FRONT), DS = dense(BASE), DB = dense(BACK), DW = dense(WIDE);
  const at = (D, y) => { for (let i = 1; i < D.length; i++) if (D[i].x <= y) { const p = D[i - 1], q = D[i], t = (y - p.x) / ((q.x - p.x) || 1e-6); return p.y + (q.y - p.y) * t; } return D[D.length - 1].y; };
  const NY = 260, NT = 128, pos = [], idx = [];
  for (let j = 0; j <= NY; j++) {
    const y = .52 - (j / NY) * 2.22, xs = at(DS, y), det = at(DF, y) - xs, xb = at(DB, y), c = (xs + xb) / 2, ax = Math.max(0, (xs - xb) / 2), w = at(DW, y);
    for (let i = 0; i <= NT; i++) { const th = i / NT * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th), face = cs > 0 ? det * Math.exp(-sn * sn / .035) : 0; pos.push(c + ax * Math.sign(cs) * Math.pow(Math.abs(cs), .9) + face, y, w * Math.sign(sn) * Math.pow(Math.abs(sn), .9)); }
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NT; i++) { const a0 = j * (NT + 1) + i, a1 = a0 + 1, b0 = a0 + NT + 1, b1 = b0 + 1; idx.push(a0, b0, a1, a1, b0, b1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const skin = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, color: 0x6e5a4e, roughness: .55, sheen: .6, sheenColor: new THREE.Color(0xffd9c0), sheenRoughness: .6 });
  const head = new THREE.Mesh(geo, skin); head.castShadow = head.receiveShadow = true; scene.add(head);
  // 奥の壁（光が当たると舞台の黒幕のように浮く）
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshStandardMaterial({ color: 0x141312, roughness: .95 })); wall.position.set(0, 0, -2.4); wall.receiveShadow = true; scene.add(wall);
  const amb = new THREE.HemisphereLight(0x1a1d24, 0x050505, .25); scene.add(amb);
  const key = new THREE.SpotLight(0xffffff, 0, 20, .5, .7, 1.2), fill = new THREE.SpotLight(0xffffff, 0, 20, .7, .9, 1.2), rim = new THREE.SpotLight(0xffffff, 0, 20, .5, .6, 1.2);
  for (const l of [key, fill, rim]) { l.castShadow = true; l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -.0004; l.target = head; scene.add(l); }
  // 6つの照明：key・fill・rim の位置・色・強さ、壁の光、カメラの角度（横顔からの回り込み）
  const V = (x, y, z) => new THREE.Vector3(x, y, z), C = h => new THREE.Color(h);
  const LOOK = {
    rim: { key: [V(-3, 1.5, -2.5), C(0xffcf9a), 26], fill: [V(2, 0, 3), C(0x9fb4d8), .6], rim: [V(-2.2, .6, -2.8), C(0xfff0dc), 30], wall: .0, yaw: .0 },
    rembrandt: { key: [V(2.6, 2.4, 2.2), C(0xffe2c4), 30], fill: [V(-2, .2, 3), C(0x8fa2c4), 2], rim: [V(-2.4, 1, -2.4), C(0xfff0dc), 8], wall: .2, yaw: -.55 },
    split: { key: [V(0, .3, 3.6), C(0xfff2e6), 26], fill: [V(0, 0, -3), C(0x000000), 0], rim: [V(-3, .5, 0), C(0x6f86b8), 4], wall: .05, yaw: -1.2 },
    under: { key: [V(1.6, -2.6, 1.6), C(0xb8c8ff), 28], fill: [V(-2, -1, 2), C(0x31406b), 2], rim: [V(-2, 1, -2.5), C(0x7d5cff), 8], wall: .15, yaw: -.35 },
    window: { key: [V(3.2, 1.6, .6), C(0xc9dbff), 22], fill: [V(-2, 1, 3), C(0x8c9bb6), 4], rim: [V(-2, 1.2, -2.6), C(0xe8eeff), 6], wall: .35, yaw: -.2 },
    pin: { key: [V(.3, 4.2, .3), C(0xffe1b0), 40], fill: [V(0, 0, 3), C(0x000000), 0], rim: [V(-2, 2, -2.5), C(0xffd3a0), 4], wall: .0, yaw: -.4 },
  };
  const ids = F.looks.map(l => l.id);
  const cur = { key: [V(0, 0, 0), C(0), 0], fill: [V(0, 0, 0), C(0), 0], rim: [V(0, 0, 0), C(0), 0], wall: 0, yaw: 0 };
  const copy = (d, s) => { for (const n of ['key', 'fill', 'rim']) { d[n][0].copy(s[n][0]); d[n][1].copy(s[n][1]); d[n][2] = s[n][2]; } d.wall = s.wall; d.yaw = s.yaw; };
  const reelState = JSON.parse(JSON.stringify({ wall: 0, yaw: 0 })); Object.assign(reelState, { key: [V(0, 0, 0), C(0), 0], fill: [V(0, 0, 0), C(0), 0], rim: [V(0, 0, 0), C(0), 0] }); copy(reelState, LOOK.rim);
  const lerpState = (d, s, k) => { for (const n of ['key', 'fill', 'rim']) { d[n][0].lerp(s[n][0], k); d[n][1].lerp(s[n][1], k); d[n][2] += (s[n][2] - d[n][2]) * k; } d.wall += (s.wall - d.wall) * k; d.yaw += (s.yaw - d.yaw) * k; };
  const applyState = st => { [['key', key], ['fill', fill], ['rim', rim]].forEach(([n, l]) => { l.position.copy(st[n][0]); l.color.copy(st[n][1]); l.intensity = st[n][2]; }); wall.material.color.setRGB(.08 + st.wall * .25, .075 + st.wall * .24, .07 + st.wall * .26); };

  const views = [];
  const mkView = (id, fov) => { const cv = $(id), r = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); r.setPixelRatio(Math.min(2, devicePixelRatio)); r.setClearColor(0x000000, 1); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace; const cam = new THREE.PerspectiveCamera(fov, 1, .1, 50); const v = { cv, r, cam, on: true, shown: false }; new ResizeObserver(() => { const w = cv.clientWidth, h = cv.clientHeight; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }).observe(cv); new IntersectionObserver(es => { v.on = es[0].isIntersecting; }).observe(cv); views.push(v); return v; };
  const hero = mkView('gl-hero', 30), reel = mkView('gl-reel', 26);
  onLook = () => {};
  const t0 = performance.now(), heroState = { key: [V(0, 0, 0), C(0), 0], fill: [V(0, 0, 0), C(0), 0], rim: [V(0, 0, 0), C(0), 0], wall: 0, yaw: 0 };
  copy(heroState, LOOK.rim);
  const tcode = s => { const f = Math.floor(s * 24) % 24, ss = Math.floor(s) % 60, mm = Math.floor(s / 60) % 60; return `00:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(f).padStart(2, '0')}`; };
  function frame(now) {
    const t = (now - t0) / 1000;
    if (playing && now - playT > 3200) { playT = now; setLook((look + 1) % ids.length); }
    if (hero.on) {
      // タイトルバック：暗闇から逆光の輪郭が立ち上がり、カメラはゆっくり横へ回り込む
      const up = reduce ? 1 : Math.min(1, t / 3.5), e = 1 - Math.pow(1 - up, 3);
      applyState(heroState); rim.intensity = heroState.rim[2] * e; key.intensity = heroState.key[2] * e; wall.material.color.setRGB(.03, .03, .035);
      const a = reduce ? -.3 : -.15 - Math.sin(t * .05) * .2 - (1 - e) * .3, tall = hero.cam.aspect < 1;
      const dd = tall ? 8.8 : 6.2; hero.cam.position.set(Math.sin(a) * dd, tall ? .2 : .05, Math.cos(a) * dd); hero.cam.lookAt(tall ? .05 : -.55, tall ? -.95 : -.35, 0);
      hero.r.render(scene, hero.cam); if (!hero.shown) { hero.shown = true; hero.cv.classList.add('ready'); }
    }
    if (reel.on) {
      lerpState(reelState, LOOK[ids[look]], reduce ? 1 : .08); applyState(reelState);
      const a = reelState.yaw + (reduce ? 0 : Math.sin(t * .3) * .04);
      reel.cam.position.set(Math.sin(a) * 6, -.1, Math.cos(a) * 6); reel.cam.lookAt(0, -.35, 0);
      reel.r.render(scene, reel.cam); if (!reel.shown) { reel.shown = true; reel.cv.classList.add('ready'); }
      $('tc').textContent = tcode(t);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
