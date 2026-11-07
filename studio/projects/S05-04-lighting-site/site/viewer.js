// 舞台模型の 3D ビューア：模型をゆっくり回し、照明シーン（キュー）をボタンでクロスフェード
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
export function mountViewer(el, { set = 'glass', cues, start = 0, still = false } = {}) {
  const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: still });
  R.setPixelRatio(Math.min(devicePixelRatio, 2)); R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.toneMapping = THREE.ACESFilmicToneMapping; R.outputColorSpace = THREE.SRGBColorSpace; el.appendChild(R.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x07070a); scene.fog = new THREE.Fog(0x07070a, 9, 22);
  const cam = new THREE.PerspectiveCamera(30, 1, .1, 60); cam.position.set(5.5, 3.6, 7.5);
  const ctl = new OrbitControls(cam, R.domElement); ctl.target.set(0, .9, 0); ctl.enableDamping = true; ctl.enablePan = false;
  ctl.minDistance = 6; ctl.maxDistance = 13; ctl.maxPolarAngle = 1.45; ctl.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches; ctl.autoRotateSpeed = .45;
  // 模型の箱：黒い床と三方の壁（手前は開いた断面）
  const box = new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: .85 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(6, .12, 4.2), new THREE.MeshStandardMaterial({ color: 0x24211e, roughness: .6 })); floor.position.y = -.06; floor.receiveShadow = true; scene.add(floor);
  const back = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, .08), box); back.position.set(0, 1.6, -2.1); back.receiveShadow = true; scene.add(back);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(.08, 3.2, 4.2), box); w.position.set(s * 3, 1.6, 0); w.receiveShadow = true; scene.add(w); }
  const white = new THREE.MeshStandardMaterial({ color: 0xd9d4cc, roughness: .7 });
  const add = (g, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; scene.add(o); return o; };
  let r = 7; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  if (set === 'glass') { const gm = new THREE.MeshStandardMaterial({ color: 0xcfdbe4, roughness: .1, transparent: true, opacity: .35 });
    for (let i = 0; i < 16; i++) { const h = .8 + rnd() * 1.6; add(new THREE.BoxGeometry(.16 + rnd() * .2, h, .02), gm, (rnd() - .5) * 4.6, h / 2, -1.6 + rnd() * 2.4, (rnd() - .5) * .9); }
    add(new THREE.BoxGeometry(.4, .04, .4), white, 0, .45, .6); }
  if (set === 'stairs') { for (let i = 0; i < 7; i++) add(new THREE.BoxGeometry(2.4, .22 * (i + 1), .42), white, -.6, .11 * (i + 1), -1.7 + i * .42 - 1.0 + 1.0); add(new THREE.BoxGeometry(.06, 2.6, .06), white, 1.8, 1.3, -1.2); add(new THREE.BoxGeometry(1.2, .06, .9), white, 1.6, .9, .4); }
  if (set === 'gate') { add(new THREE.BoxGeometry(.3, 2.6, .3), white, -1.1, 1.3, -.9); add(new THREE.BoxGeometry(.3, 2.6, .3), white, 1.1, 1.3, -.9); add(new THREE.BoxGeometry(3.0, .22, .4), white, 0, 2.55, -.9); add(new THREE.BoxGeometry(2.6, .14, .3), white, 0, 2.15, -.9);
    for (let i = 0; i < 9; i++) add(new THREE.BoxGeometry(.5, .04, .5), white, (rnd() - .5) * 4, .02, (rnd() - .2) * 2.4, rnd()); }
  // 照明：キューごとに強さと色を持つ灯体
  const mk = (pos, tgt, color, angle) => { const l = new THREE.SpotLight(color, 0, 0, angle, .55, 2); l.position.set(...pos); l.target.position.set(...tgt); l.castShadow = true; l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -.0004; scene.add(l, l.target); return l; };
  const L = { top: mk([0, 5.5, 1.5], [0, 0, -.2], 0xfff1df, .42), sideW: mk([-5, 2.2, .6], [0, .8, -.6], 0xffb46e, .42), sideC: mk([5, 2.6, -.4], [0, .8, -.6], 0x9fb9e8, .42), backL: mk([0, 4.2, -5], [0, .4, .4], 0x8fb0ff, .5), pin: mk([.6, 6, 3], [0, .4, .6], 0xffe6c8, .07) };
  scene.add(new THREE.AmbientLight(0x404050, .25));
  const cur = {}, from = {}; let to = cues[start].v, t0 = 0, tween = 1;
  for (const k in L) cur[k] = to[k] || 0;
  const apply = () => { for (const k in L) L[k].intensity = cur[k]; };
  const setCue = (i) => { for (const k in L) from[k] = cur[k]; to = cues[i].v; t0 = performance.now(); tween = 0; };
  const resize = () => { const w = el.clientWidth, h = el.clientHeight; R.setSize(w, h, false); cam.aspect = w / h; cam.position.setLength(w < h ? 12 : 9.5);
    if (w > 900 && !still) cam.setViewOffset(w, h, -w * .17, 0, w, h); else if (w < h) cam.setViewOffset(w, h, 0, h * .12, w, h); else cam.clearViewOffset(); cam.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(el); resize();
  const loop = (now) => { if (tween < 1) { tween = Math.min(1, (now - t0) / 700); const e = 1 - Math.pow(1 - tween, 3); for (const k in L) cur[k] = from[k] + ((to[k] || 0) - from[k]) * e; } apply(); ctl.update(); R.render(scene, cam); if (!still) requestAnimationFrame(loop); };
  apply(); requestAnimationFrame(loop);
  return { setCue, render: () => { apply(); ctl.update(); R.render(scene, cam); } };
}
export const CUES = [
  { name: 'Q1 地明かり', v: { top: 260, sideW: 60, sideC: 60, backL: 20 } },
  { name: 'Q2 夕景', v: { top: 40, sideW: 420, sideC: 0, backL: 30 } },
  { name: 'Q3 月光', v: { top: 0, sideW: 0, sideC: 160, backL: 260 } },
  { name: 'Q4 ピン', v: { top: 0, sideW: 0, sideC: 0, backL: 10, pin: 900 } },
];
