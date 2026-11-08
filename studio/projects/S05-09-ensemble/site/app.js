// アンサンブル白夜：演奏会を選ぶと、出演する奏者の譜面台に灯りが入る（照明卓のキューのように 120ms ずつずらし、上げ 1.2 秒・下げ 0.8 秒）
import { F } from './data.js';
const $ = id => document.getElementById(id);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = c => { const [y, m, d] = c.date.split('-').map(Number); return `${y}年${m}月${d}日（${c.wd}）${c.start} 開演`; };
const byId = Object.fromEntries(F.members.map(m => [m.id, m]));
let target = new Set();
for (const m of F.members) { const li = el('li'); li.dataset.id = m.id; li.append(el('span', 'part', m.part), el('span', 'nm', m.name)); $('mem').append(li); }
const select = c => {
  document.querySelectorAll('.dates button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === c.id)));
  $('d-no').textContent = `${c.no}　${F.venue}`; $('d-title').textContent = c.title; $('d-when').textContent = fmt(c);
  $('d-prog').replaceChildren(...c.program.map(p => { const li = el('li'); li.append(el('span', 'c', p.composer), el('span', 'w', p.work), el('span', 'p', p.players.map(id => byId[id].part).join('・'))); return li; }));
  target = new Set(c.program.flatMap(p => p.players));
  document.querySelectorAll('#mem li').forEach(li => li.classList.toggle('on', target.has(li.dataset.id)));
  cue(performance.now());
};
for (const c of F.concerts) {
  const b = el('button'); b.type = 'button'; b.dataset.id = c.id; b.setAttribute('aria-pressed', 'false');
  const [, m, d] = c.date.split('-').map(Number);
  b.append(el('b', null, `${m}月${d}日（${c.wd}）`), document.createTextNode(`${c.no}「${c.title}」`));
  b.addEventListener('click', () => select(c)); $('dates').append(b);
}
$('disc').textContent = F.disclosure;

// 3D：半円に並ぶ5つの譜面台（ピアノは右端）。灯りの変化はキューとして時間で補間する
const ORDER = ['vn1', 'vn2', 'va', 'vc', 'pf'];
const lamps = {}; let cueAt = 0, from = {};
function cue(now) { cueAt = now; for (const id of ORDER) from[id] = lamps[id] ? lamps[id].level : 0; }
(async () => {
  let THREE; try { THREE = await import('three'); } catch { return; }
  const cv = $('stage');
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  r.setPixelRatio(Math.min(2, devicePixelRatio)); r.shadowMap.enabled = true; r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x08080a); scene.fog = new THREE.Fog(0x08080a, 10, 24);
  const cam = new THREE.PerspectiveCamera(30, 1, .1, 60);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: .5 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const metal = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: .35, metalness: .8 });
  const chairM = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: .7 });
  ORDER.forEach((id, i) => {
    const a = (-0.62 + i * 0.31) * Math.PI / 2, R = 3.2;
    const g = new THREE.Group(); g.position.set(Math.sin(a) * R, 0, -Math.cos(a) * R + 1.2); g.rotation.y = -a; scene.add(g);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1.1, 10), metal); pole.position.y = .55; pole.castShadow = true; g.add(pole);
    const desk = new THREE.Mesh(new THREE.BoxGeometry(.52, .36, .02), metal); desk.position.set(0, 1.18, 0); desk.rotation.x = -.45; desk.castShadow = true; g.add(desk);
    const paperM = new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: .9, emissive: 0x000000 }); const paper = new THREE.Mesh(new THREE.PlaneGeometry(.46, .32), paperM); paper.position.set(0, 1.185, .015); paper.rotation.x = -.45; g.add(paper);
    for (const [x, z] of [[-.2, -.2], [.2, -.2], [0, .25]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .35, 6), metal); leg.position.set(x * .5, .14, z * .5); leg.rotation.z = x; g.add(leg); }
    const chair = new THREE.Mesh(new THREE.BoxGeometry(.42, .46, .42), chairM); chair.position.set(0, .23, -.55); chair.castShadow = chair.receiveShadow = true; g.add(chair);
    const back = new THREE.Mesh(new THREE.BoxGeometry(.42, .5, .05), chairM); back.position.set(0, .7, -.75); back.castShadow = true; g.add(back);
    // 譜面灯（クリップライト）と、上からの小さなスポット
    const lampM = new THREE.MeshBasicMaterial({ color: 0x221a10 }); const bulb = new THREE.Mesh(new THREE.BoxGeometry(.3, .03, .05), lampM); bulb.position.set(0, 1.38, -.08); bulb.rotation.x = -.45; g.add(bulb);
    const sp = new THREE.SpotLight(0xffe2b4, 0, 6, .34, .6, 1.5); sp.position.set(g.position.x, 4.2, g.position.z + .4); sp.target.position.copy(g.position); sp.castShadow = true; scene.add(sp, sp.target);
    lamps[id] = { sp, lampM, paperM, level: 0 };
  });
  scene.add(new THREE.HemisphereLight(0x2a2a3a, 0x08080a, .18));
  const fit = () => { const w = cv.clientWidth, h = cv.clientHeight; r.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 40 : 28; cam.updateProjectionMatrix(); };
  fit(); addEventListener('resize', fit);
  let visible = true; new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(cv);
  const t0 = performance.now();
  const frame = now => {
    requestAnimationFrame(frame); if (!visible) return;
    ORDER.forEach((id, i) => {
      const L = lamps[id], on = target.has(id) ? 1 : 0;
      const dly = reduce ? 0 : i * 120, dur = reduce ? 1 : on ? 1200 : 800;
      const u = Math.min(1, Math.max(0, (now - cueAt - dly) / dur)), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      L.level = (from[id] ?? 0) + (on - (from[id] ?? 0)) * e;
      L.sp.intensity = 80 * L.level; L.paperM.color.setRGB(.23 + .68 * L.level, .21 + .66 * L.level, .19 + .6 * L.level); L.paperM.emissive.setRGB(.25 * L.level, .21 * L.level, .14 * L.level); L.lampM.color.setRGB(.13 + .87 * L.level, .1 + .78 * L.level, .06 + .6 * L.level);
    });
    const a = reduce ? 0 : Math.sin((now - t0) / 1000 * .07) * .06;
    const port = cam.aspect < 1;
    const D = port ? 7.4 : 6.4; cam.position.set(Math.sin(a) * D, port ? 3.6 : 3.0, Math.cos(a) * D + 1); cam.lookAt(0, port ? 1.4 : 1.0, 0);
    r.render(scene, cam);
  };
  requestAnimationFrame(frame);
})();
select(F.concerts[0]);
