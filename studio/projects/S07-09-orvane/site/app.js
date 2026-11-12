// ORVANE ONE 製品ページ：スクロールに合わせて、ガラスの筒のスピーカーが回り、分解し、また組み上がる。1段に1つの特長だけを大きな文字で出す
import { F } from './data.js';
const $ = id => document.getElementById(id);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
$('brand').textContent = F.brand; $('kind').textContent = F.kind; $('product').textContent = F.product; $('tag').textContent = F.tagline;
F.stages.forEach((s, i) => {
  const sec = el('section', `sec s-${s.id}`); sec.id = s.id; sec.dataset.k = i + 1; sec.setAttribute('aria-labelledby', `h-${s.id}`);
  const c = el('div', 'copy'), big = el('p', /^[\d°]+$/.test(s.big) ? 'big' : 'big ja', s.big), h = el('h2', null, s.head); h.id = `h-${s.id}`;
  c.append(big, h, el('p', 'body', s.body)); sec.append(c); $('stages').append(sec);
});
for (const [k, v] of F.specs) { const d = el('div'); d.append(el('dt', null, k), el('dd', null, v)); $('spec').append(d); }
$('price').textContent = F.price; $('discl').textContent = F.disclosure;
let color = 0, onColor = () => {};
const sws = F.colors.map(([name, hex], i) => {
  const b = el('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(i === 0)); const dot = el('i'); dot.style.background = hex; b.append(dot, name);
  b.addEventListener('click', () => { color = i; sws.forEach((x, k) => { x.setAttribute('aria-checked', String(k === i)); x.tabIndex = k === i ? 0 : -1; }); onColor(i); });
  b.tabIndex = i === 0 ? 0 : -1; $('sw').append(b); return b;
});
$('sw').addEventListener('keydown', e => { if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return; e.preventDefault(); const n = (color + 1) % sws.length; sws[n].click(); sws[n].focus(); });

// 段の文字は、段が画面に入ったら出す
const secs = [...document.querySelectorAll('.sec')];
const io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('in', e.isIntersecting)), { rootMargin: '-35% 0px -35% 0px' });
secs.forEach(s => io.observe(s));

(async () => {
  let THREE, RoomEnvironment;
  try { THREE = await import('three'); ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js')); } catch { return; }
  const cv = $('gl'), box = cv.parentElement;
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  r.setPixelRatio(Math.min(2, devicePixelRatio)); r.setClearColor(0x050506, 1);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 100);
  // 映り込み用の環境：暗い部屋の左右に縦長の白いストリップライト（ガラスと金属の縁に縦のハイライトが立つ）
  const envS = new THREE.Scene(); envS.background = new THREE.Color(0x060606);
  const stripM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(6) });
  for (const x of [-5, 5]) { const m = new THREE.Mesh(new THREE.BoxGeometry(.6, 9, .6), stripM); m.position.set(x, 1, 1.5); envS.add(m); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(4, .3, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .95, .9).multiplyScalar(1.5) })); top.position.y = 7; envS.add(top);
  const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(envS, 0).texture;

  // 光：左上のキー、背後の冷たいリム、真上の細いスポット
  const key = new THREE.SpotLight(0xfff1de, 60, 20, .5, .8, 1.6); key.position.set(-3.5, 5, 3); key.target.position.set(0, 1, 0); scene.add(key, key.target);
  const rim = new THREE.SpotLight(0xbcd2ff, 50, 20, .45, .9, 1.6); rim.position.set(2.5, 3.5, -4); rim.target.position.set(0, 1, 0); scene.add(rim, rim.target);
  scene.add(new THREE.AmbientLight(0xffffff, .05));

  // 床：製品の下だけ柔らかく明るい円と、接地の影
  const tex = (draw, n = 256) => { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n); return new THREE.CanvasTexture(c); };
  const pool = tex((g, n) => { const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); gr.addColorStop(0, 'rgba(60,58,56,1)'); gr.addColorStop(1, 'rgba(60,58,56,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: pool, transparent: true, depthWrite: false })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const shTex = tex((g, n) => { const gr = g.createRadialGradient(n / 2, n / 2, n * .2, n / 2, n / 2, n / 2); gr.addColorStop(0, 'rgba(0,0,0,.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .002; scene.add(shadow);

  // 製品（高さ約 2.0）
  const prod = new THREE.Group(); scene.add(prod);
  const body = new THREE.MeshPhysicalMaterial({ color: 0x2a2b2e, metalness: .7, roughness: .38, clearcoat: .4, clearcoatRoughness: .3 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dade, metalness: 1, roughness: .14 });
  const paper = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: .85 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: .6 });
  const parts = [];
  const part = (obj, y, ex) => { obj.position.y = y; obj.userData = { y, ex }; prod.add(obj); parts.push(obj); return obj; };
  const driver = (rad, dome) => {
    const g = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.LatheGeometry([...Array(9)].map((_, k) => { const t = k / 8; return new THREE.Vector2(rad * (.22 + .7 * t), rad * .32 * t * t); }), 72), dome ? chrome : paper); g.add(cone);
    const sur = new THREE.Mesh(new THREE.TorusGeometry(rad * .94, rad * .05, 12, 72), rubber); sur.rotation.x = Math.PI / 2; sur.position.y = rad * .32; g.add(sur);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rad * 1.02, rad * .025, 10, 72), chrome); ring.rotation.x = Math.PI / 2; ring.position.y = rad * .33; g.add(ring);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(rad * .24, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), dome ? new THREE.MeshPhysicalMaterial({ color: 0xe9e4da, roughness: .5, sheen: 1 }) : rubber); cap.scale.y = .6; g.add(cap);
    const mag = new THREE.Mesh(new THREE.CylinderGeometry(rad * .5, rad * .5, rad * .3, 48), chrome); mag.position.y = -rad * .18; g.add(mag);
    return g;
  };
  const lensM = new THREE.MeshStandardMaterial({ color: 0xd8dade, metalness: 1, roughness: .25, side: THREE.DoubleSide });
  const lens = (rad, h) => { const m = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 72, 1, true), lensM); m.rotation.x = Math.PI; return m; };
  const base = part(new THREE.Mesh(new THREE.CylinderGeometry(.6, .63, .1, 96), body), .05, 0);
  const drv = [];
  const woofer = part(driver(.46), .22, 0); drv.push(woofer);
  part(lens(.42, .2), .56, .3);
  const batt = new THREE.Group();
  batt.add(new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .3, 48), new THREE.MeshStandardMaterial({ color: 0x1c1d20, metalness: .4, roughness: .5 })));
  // 電池のゲージ：20時間＝20本の細い光の帯。下の段のスクロールで1本ずつ灯る
  const bars = [...Array(20)].map((_, k) => { const a = k / 20 * Math.PI * 2, m = new THREE.Mesh(new THREE.BoxGeometry(.02, .24, .01), new THREE.MeshBasicMaterial({ color: 0xffd9a8, transparent: true, opacity: 0 })); m.position.set(Math.sin(a) * .305, 0, Math.cos(a) * .305); m.rotation.y = a; batt.add(m); return m; });
  part(batt, .82, .62);
  drv.push(part(driver(.27), 1.1, .98));
  part(lens(.25, .13), 1.32, 1.22);
  drv.push(part(driver(.11, true), 1.5, 1.45));
  const v3 = new THREE.Vector3();
  const tags = F.specs[0][1].split('／').map(t => { const d = el('div', 'tag3d'); d.append(el('i'), el('span', null, t)); box.append(d); return d; });
  part(lens(.12, .08), 1.66, 1.62);
  const cap = new THREE.Group();
  cap.add(new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, .08, 96), body));
  const ledM = new THREE.MeshBasicMaterial({ color: 0xffd9a8 });
  const led = new THREE.Mesh(new THREE.TorusGeometry(.44, .011, 10, 128), ledM); led.rotation.x = Math.PI / 2; led.position.y = .042; cap.add(led);
  part(cap, 1.84, 2.0);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: .02, transmission: 1, thickness: .35, ior: 1.5, attenuationColor: new THREE.Color(0xd8dde3), attenuationDistance: 2, iridescence: .15, specularIntensity: 1, transparent: true, side: THREE.DoubleSide, envMapIntensity: 1.6 });
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, 1.7, 96, 1, true), glass); shell.position.y = .95; prod.add(shell);
  const frost = new THREE.Mesh(new THREE.CylinderGeometry(.604, .604, .22, 96, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .4, transmission: .85, thickness: .05, transparent: true, opacity: .45 })); frost.position.y = .21; prod.add(frost);
  const halo = new THREE.PointLight(0xffd9a8, 0, 3, 2); halo.position.y = 1.7; prod.add(halo);

  // 360° の音：製品を中心に広がる薄い輪
  const waves = [...Array(4)].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(.98, 1, 128), new THREE.MeshBasicMaterial({ color: 0xffd9a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = 1.0; scene.add(m); return m; });

  // 段ごとの姿：0 トップ、1 360°、2 ドライバー、3 ガラス、4 電池、5 色と価格
  const K = [
    { elev: 10, dist: 7.2, ex: 0, lift: 0, ring: .55, wave: 0, gauge: 0, yaw: 0 },
    { elev: 58, dist: 7.6, ex: 0, lift: 0, ring: .7, wave: 1, gauge: 0, yaw: .6 },
    { elev: 12, dist: 10.2, ex: 1, lift: 1, ring: .3, wave: 0, gauge: 0, yaw: 1.4 },
    { elev: 6, dist: 4.4, ex: 0, lift: 0, ring: 1, wave: 0, gauge: 0, yaw: 2.2 },
    { elev: 16, dist: 8.6, ex: .55, lift: 1, ring: .5, wave: 0, gauge: 1, yaw: 3.0 },
    { elev: 10, dist: 6.6, ex: 0, lift: 0, ring: .7, wave: 0, gauge: 1, yaw: 3.6 },
    { elev: 12, dist: 7.0, ex: 0, lift: 0, ring: .7, wave: 0, gauge: 0, yaw: 4.2 },
  ];
  const lerp = (a, b, t) => a + (b - a) * t, sm = t => t * t * (3 - 2 * t), io3 = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const back = t => { const c = 1.2, x = t - 1; return 1 + (c + 1) * x * x * x + c * x * x; };
  let sp = 0;   // 段の位置（小数）
  function stagePos() {
    const mid = scrollY + innerHeight / 2, cs = secs.map(s => { const b = s.getBoundingClientRect(); return b.top + scrollY + Math.min(b.height, innerHeight * 1.2) / 2; });
    if (mid <= cs[0]) return 0; for (let i = 0; i < cs.length - 1; i++) if (mid < cs[i + 1]) return i + (mid - cs[i]) / (cs[i + 1] - cs[i]); return cs.length - 1;
  }
  const COL = [new THREE.Color(0x2a2b2e), new THREE.Color(0xc9ccd0)];
  onColor = i => { tCol = COL[i]; };
  let tCol = COL[0];

  function fit() { const w = box.clientWidth, h = box.clientHeight; r.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < 900 && w < h ? 50 : 30; cam.updateProjectionMatrix(); }
  new ResizeObserver(fit).observe(box); fit();

  let shown = false, last = performance.now(), off = null;
  function frame(ms) {
    const dt = Math.min(.05, (ms - last) / 1000); last = ms; const t = ms / 1000;
    const target = stagePos(); sp = reduce ? Math.round(target) : sp + (target - sp) * (1 - Math.exp(-dt * 6));
    const i = Math.min(K.length - 2, Math.floor(sp)), raw = Math.min(1, sp - i), f = io3(raw), A = K[i], B = K[i + 1], S = {};
    for (const k in A) S[k] = lerp(A[k], B[k], f);
    // 分解：部品ごとに少しずつずらして開く（下の部品から）
    // 組み上げ（段4→段5）：上の部品から順に落ちて、着地で少し沈んで戻る。最後に筒が被さり、光の輪が1回脈打つ
    const build = i === 4 ? raw : -1, N = parts.length;
    parts.forEach((p, n) => {
      let e;
      if (build >= 0) { const d = (N - 1 - n) * .07, u = Math.min(1, Math.max(0, (build - d) / .45)); e = K[4].ex * (1 - back(u)); }
      else e = sm(Math.min(1, Math.max(0, S.ex * 1.25 - n * .03)));
      p.position.y = p.userData.y + p.userData.ex * .9 * e;
    });
    let lift = S.lift, pulse = 0;
    if (build >= 0) { const u = Math.min(1, Math.max(0, (build - .62) / .25)); lift = 1 - sm(u); pulse = build > .87 ? Math.exp(-Math.pow((build - .93) / .04, 2)) : 0; }
    shell.position.y = .95 + lift * 4.6; glass.opacity = 1 - lift * .6; frost.position.y = .21 + lift * 4.6;
    ledM.color.setRGB(1, .85, .66).multiplyScalar(.25 + (S.ring + pulse * .9) * 1.4); halo.intensity = (S.ring + pulse) * 1.2;
    bars.forEach((b, k) => { b.material.opacity = S.gauge * .75 * Math.min(1, Math.max(0, (i === 3 ? raw : i === 4 ? 1 : S.gauge) * 22 - k)); });
    // ドライバーの名前（分解の段だけ、引き出し線つき）
    tags.forEach((g, k) => { const p = drv[k]; const L = box.clientWidth < 900; v3.set(0, 0, 0); p.localToWorld(v3); v3.x += L ? -.55 : .5; v3.project(cam); g.classList.toggle('l', L); const show = Math.max(0, (S.ex - .75) * 4) * (i <= 2 ? 1 : 0); g.style.opacity = Math.min(1, show * (1.3 - k * .15)).toFixed(3); const px = (v3.x + 1) / 2 * box.clientWidth, X = L ? Math.max(g.offsetWidth + 8, px) : Math.min(box.clientWidth - g.offsetWidth - 8, px); g.style.transform = `translate(${X.toFixed(1)}px, ${((1 - v3.y) / 2 * box.clientHeight).toFixed(1)}px)${L ? ' translateX(-100%)' : ''}`; });
    waves.forEach((w, k) => { const ph = ((reduce ? .5 : t * .35) + k / waves.length) % 1; w.scale.setScalar(.7 + ph * 2.6); w.material.opacity = S.wave * (1 - ph) * .5; });
    body.color.lerp(tCol, .08);
    prod.rotation.y = S.yaw + (reduce ? 0 : t * .08);
    const el = S.elev * Math.PI / 180, ty = 1.0 + S.ex * .85;
    cam.position.set(0, ty + Math.sin(el) * S.dist, Math.cos(el) * S.dist); cam.lookAt(0, ty, 0);
    // 製品は文字を避けて置く（PC は右、スマホは下）
    const W = box.clientWidth, H = box.clientHeight, o = W >= 900 ? [-W * .25, 0] : [0, -H * .24];
    if (!off || off[0] !== o[0] || off[1] !== o[1]) { cam.setViewOffset(W, H, o[0], o[1], W, H); off = o; }
    r.render(scene, cam);
    if (!shown) { shown = true; cv.classList.add('ready'); }
    requestAnimationFrame(frame);
  }
  addEventListener('resize', () => { off = null; });
  requestAnimationFrame(frame);
})();
