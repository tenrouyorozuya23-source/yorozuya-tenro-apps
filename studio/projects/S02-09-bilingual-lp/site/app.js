// 月の舞：演目・日時・料金を facts から描き、ヒーローに能舞台の模型を置く
import { F } from './data.js';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const el = (tag, cls, txt, lang) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; if (lang) e.lang = lang; return e; };

const prog = document.getElementById('prog');
F.program.forEach((p, i) => {
  const li = el('li'); li.dataset.id = 'p' + i;
  li.append(el('span', 'n', String(i + 1).padStart(2, '0')));
  const t = el('span', 't'); t.append(el('span', 'ja', p.ja), el('span', 'en', p.en, 'en')); li.append(t);
  const m = el('span', 'm'); m.append(document.createTextNode(`約${p.min}分`), el('span', null, ` / ${p.min} min`, 'en')); li.append(m);
  prog.append(li);
});
const dates = document.getElementById('dates');
const MONTH = ['January','February','March','April','May','June','July','August','September','October','November','December'];
for (const p of F.performances) {
  const [y, mo, d] = p.date.split('-').map(Number);
  const tr = el('tr'); tr.dataset.id = p.date;
  const td = el('td'); const tm = el('time'); tm.dateTime = p.date; tm.textContent = `${y}年${mo}月${d}日（${p.wd_ja}）`;
  td.append(tm, el('span', null, `${p.wd_en} ${d} ${MONTH[mo - 1]} ${y}`, 'en'));
  tr.append(td, el('td', null, p.open), el('td', null, p.start)); dates.append(tr);
}
const price = document.getElementById('price');
for (const p of F.prices) {
  const li = el('li'); li.dataset.id = p.seat_en;
  const s = el('span', 's', p.seat_ja); s.append(el('span', null, p.seat_en, 'en'));
  li.append(s, el('span', 'y', '¥' + p.yen.toLocaleString('en-US'), 'en')); price.append(li);
}

// 能舞台の模型（三間四方の本舞台・四本柱・屋根・鏡板・橋掛かり）。月の高さから一灯
const cv = document.getElementById('stage');
(async () => {
  let THREE; try { THREE = await import('three'); } catch { return; }
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  r.setPixelRatio(Math.min(2, devicePixelRatio)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0e17); scene.fog = new THREE.Fog(0x0b0e17, 14, 30);
  const cam = new THREE.PerspectiveCamera(30, 1, .1, 80);
  const hinoki = new THREE.MeshStandardMaterial({ color: 0xb59a74, roughness: .6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: .7 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
  add(new THREE.BoxGeometry(5.6, .5, 5.6), hinoki, 0, .25, 0);                         // 本舞台
  for (const [x, z] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) add(new THREE.BoxGeometry(.2, 4.6, .2), hinoki, x, 2.8, z); // 四本柱
  const roof = add(new THREE.ConeGeometry(4.9, 1.6, 4, 1), dark, 0, 5.9, 0); roof.rotation.y = Math.PI / 4; roof.castShadow = false;      // 屋根
  add(new THREE.BoxGeometry(6.2, .25, 6.2), dark, 0, 5.1, 0).castShadow = false;
  // 鏡板（松）
  const pc = document.createElement('canvas'); pc.width = 1024; pc.height = 640; const g = pc.getContext('2d');
  g.fillStyle = '#b8a07c'; g.fillRect(0, 0, 1024, 640);
  g.strokeStyle = '#3d2c22'; g.lineCap = 'round';
  const br = (x, y, a, len, w, d) => { if (d > 6) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + 20, (y + y2) / 2 - 10, x2, y2); g.stroke();
    if (d >= 3) { g.fillStyle = 'rgba(46,72,52,.85)'; g.beginPath(); g.ellipse(x2, y2, 70 - d * 6, 26 - d * 2, a * .3, 0, Math.PI * 2); g.fill(); }
    br(x2, y2, a - .55, len * .72, w * .62, d + 1); br(x2, y2, a + .45, len * .66, w * .6, d + 1); };
  br(520, 640, -Math.PI / 2 - .12, 210, 34, 0);
  const pt = new THREE.CanvasTexture(pc); pt.colorSpace = THREE.SRGBColorSpace;
  add(new THREE.BoxGeometry(5.6, 3.6, .12), new THREE.MeshStandardMaterial({ map: pt, roughness: .8 }), 0, 2.3, -2.86);
  // 橋掛かり
  const bridge = add(new THREE.BoxGeometry(7.5, .4, 1.8), hinoki, -6.2, .2, -4.2); bridge.rotation.y = .32;
  // 月の一灯と、ごく弱い地明かり
  const moon = new THREE.SpotLight(0xdfe6ff, 0, 40, .42, .7, 1.1); moon.position.set(5, 4.6, 10); moon.target.position.set(-.3, 1.6, -2);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); scene.add(moon, moon.target);
  scene.add(new THREE.HemisphereLight(0x4a5c90, 0x0b0e17, 1.1));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(.9, 48), new THREE.MeshBasicMaterial({ color: 0xf2eedf, fog: false }));
  disc.position.set(9, 13, -16); scene.add(disc);
  const fit = () => { const w = cv.clientWidth, h = cv.clientHeight; r.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 44 : 30; cam.updateProjectionMatrix(); };
  fit(); addEventListener('resize', fit);
  const t0 = performance.now(); let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(cv);
  const frame = now => {
    requestAnimationFrame(frame); if (!visible) return;
    const t = (now - t0) / 1000;
    moon.intensity = 620 * Math.min(1, t / 1.6);                                     // 読み込み後 1.6 秒で月が上がる
    const sy = Math.min(1, scrollY / innerHeight);
    const a = .5 + (reduce ? 0 : Math.sin(t * .08) * .06) - sy * .25;
    const d = cam.aspect < 1 ? 22 : 17;
    cam.position.set(Math.sin(a) * d, 3.2 + sy * 1.5, Math.cos(a) * d); cam.lookAt(-1, cam.aspect < 1 ? -1.6 : 2.0, -1);
    r.render(scene, cam);
  };
  requestAnimationFrame(frame);
})();
