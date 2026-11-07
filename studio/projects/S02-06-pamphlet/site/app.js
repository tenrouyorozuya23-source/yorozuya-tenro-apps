// 冬の灯 パンフレット：章ごとの明かり、登場人物とスタッフの描画、舞台美術の模型
import { CAST, STAFF } from './data.js';
document.documentElement.classList.add('js');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// 登場人物・スタッフ（facts.json から生成した data.js）
const castList = document.getElementById('cast-list');
for (const c of CAST) {
  const li = document.createElement('li');
  li.dataset.id = c.name;
  li.innerHTML = `<span class="role"></span><span class="desc"></span><span class="name"></span>`;
  li.querySelector('.role').textContent = c.role;
  li.querySelector('.desc').textContent = c.desc;
  li.querySelector('.name').textContent = c.name;
  castList.append(li);
}
const staffList = document.getElementById('staff-list');
for (const [role, name] of STAFF) {
  const dt = document.createElement('dt'); dt.textContent = role;
  const dd = document.createElement('dd'); dd.textContent = name;
  staffList.append(dt, dd);
}

// 章ごとの明かり：画面の中央を通っている章の明かりにする
const lit = [...document.querySelectorAll('[data-light]')];
const io = new IntersectionObserver(es => {
  for (const e of es) if (e.isIntersecting) document.body.dataset.light = e.target.dataset.light;
}, { rootMargin: '-45% 0px -45% 0px' });
lit.forEach(el => io.observe(el));
document.body.dataset.light = 'cover';
const show = new IntersectionObserver(es => {
  for (const e of es) if (e.isIntersecting) { e.target.classList.add('on'); show.unobserve(e.target); }
}, { rootMargin: '0px 0px -12% 0px' });
document.querySelectorAll('.ch, .colophon').forEach(el => show.observe(el));

// 舞台美術の模型（three.js）。操作は奪わず、スクロールの位置で角度だけ回す
const cv = document.getElementById('model');
let started = false;
const startModel = async () => {
  if (started) return; started = true;
  let THREE;
  try { THREE = await import('three'); } catch (e) { cv.parentElement.querySelector('figcaption').textContent = '模型を読み込めませんでした'; return; }
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  r.setPixelRatio(Math.min(2, devicePixelRatio)); r.shadowMap.enabled = true;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x050404); scene.fog = new THREE.Fog(0x050404, 9, 18);
  const cam = new THREE.PerspectiveCamera(32, 4 / 3, .1, 50);
  // 傾いた床（八百屋舞台）
  const floor = new THREE.Mesh(new THREE.BoxGeometry(6, .12, 4), new THREE.MeshStandardMaterial({ color: 0x3a332c, roughness: .85 }));
  floor.rotation.x = .06; floor.receiveShadow = true; scene.add(floor);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), new THREE.MeshStandardMaterial({ color: 0x1c2230, roughness: 1 }));
  back.position.set(0, 2.2, -2.4); back.receiveShadow = true; scene.add(back);
  // 街灯
  const iron = new THREE.MeshStandardMaterial({ color: 0x1e1c1a, roughness: .5, metalness: .6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.035, .05, 2.6, 16), iron); pole.position.set(1.2, 1.36, -.6); pole.castShadow = true; scene.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(.4, .04, .04), iron); arm.position.set(1.02, 2.62, -.6); scene.add(arm);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0x3a2a18 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.07, 16, 12), bulbMat); bulb.position.set(.84, 2.54, -.6); scene.add(bulb);
  const lamp = new THREE.SpotLight(0xffc48a, 0, 7, .75, .6, 1.4); lamp.position.copy(bulb.position); lamp.target.position.set(.4, 0, 0);
  lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); scene.add(lamp, lamp.target);
  // ベンチ
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4c34, roughness: .7 });
  const bench = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.3, .06, .36), wood); seat.position.y = .46; bench.add(seat);
  const bk = new THREE.Mesh(new THREE.BoxGeometry(1.3, .3, .05), wood); bk.position.set(0, .72, -.17); bench.add(bk);
  for (const x of [-.55, .55]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.05, .46, .32), iron); leg.position.set(x, .23, 0); bench.add(leg); }
  bench.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  bench.position.set(-.3, .06, .5); bench.rotation.y = .18; scene.add(bench);
  // 客席側からの地明かり（弱い）と、ホリゾントの青
  const key = new THREE.SpotLight(0xdfe6ff, 14, 20, .5, .8, 1.2); key.position.set(-2.5, 4.5, 5); key.target.position.set(0, .5, 0); scene.add(key, key.target);
  const cyc = new THREE.SpotLight(0x6f86c8, 10, 12, .9, 1, 1); cyc.position.set(0, 4.5, 1); cyc.target.position.set(0, 2.5, -2.4); scene.add(cyc, cyc.target);
  scene.add(new THREE.AmbientLight(0xffffff, .05));
  // 雪
  const N = 700, pos = new Float32Array(N * 3), sp = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 6; pos[i * 3 + 1] = Math.random() * 4; pos[i * 3 + 2] = (Math.random() - .5) * 4; sp[i] = .2 + Math.random() * .25; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const snowMat = new THREE.PointsMaterial({ color: 0xe8eefc, size: .025, transparent: true, opacity: .8, depthWrite: false });
  scene.add(new THREE.Points(sg, snowMat));

  const fit = () => { const w = cv.clientWidth, h = cv.clientHeight; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  fit(); addEventListener('resize', fit);
  let visible = true, lampOn = 0, last = performance.now();
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(cv);
  const sec = document.getElementById('set');
  const frame = now => {
    requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const b = sec.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight - b.top) / (innerHeight + b.height)));
    const a = -.55 + p * 1.1;                                   // 客席から見た角度：-32°〜+32°
    cam.position.set(Math.sin(a) * 8.2, 2.3 - p * .5, Math.cos(a) * 8.2); cam.lookAt(0, 1.0, 0);
    // 模型が画面の中央に来たら街灯が点く（上げ 1.2 秒）
    const target = p > .3 ? 1 : 0;
    lampOn += (target - lampOn) * Math.min(1, dt / (target ? 1.2 : .8) * 3);
    lamp.intensity = 26 * lampOn; bulbMat.color.setRGB(.23 + .77 * lampOn, .16 + .7 * lampOn, .09 + .45 * lampOn);
    snowMat.color.setRGB(.91, .93 - .08 * lampOn, .99 - .25 * lampOn);
    if (!reduce) {
      const arr = sg.attributes.position.array;
      for (let i = 0; i < N; i++) { arr[i * 3 + 1] -= sp[i] * dt; arr[i * 3] += Math.sin(now / 1000 + i) * .02 * dt; if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 4; }
      sg.attributes.position.needsUpdate = true;
    }
    r.render(scene, cam);
  };
  requestAnimationFrame(frame);
};
new IntersectionObserver(es => { if (es[0].isIntersecting) startModel(); }, { rootMargin: '400px 0px' }).observe(cv);
