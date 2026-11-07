// 冬の灯 アーカイブ：facts から期間・価格を描き、ヒーローに終演後の劇場（客電と一灯）を置く
import { F } from './data.js';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
const jd = (iso, wd) => { const [y, m, d] = iso.split('-').map(Number); return `<time datetime="${iso}">${y}年${m}月${d}日（${wd}）</time>`; };
const yen = n => `¥${n.toLocaleString('ja-JP')}<small>税込</small>`;
$('s-period').innerHTML = `${jd(F.stream.from, F.stream.from_wd)}〜<br>${jd(F.stream.to, F.stream.to_wd)} ${F.stream.until}まで`;
$('s-rec').innerHTML = `${jd('2026-12-20', '日')} 千秋楽公演<br>（${F.running_time}）`;
$('s-price').innerHTML = yen(F.stream.price_yen);
$('b-date').innerHTML = jd(F.bluray.release, F.bluray.release_wd);
for (const c of F.bluray.contents) { const li = document.createElement('li'); li.textContent = c; $('b-list').append(li); }
$('b-price').innerHTML = yen(F.bluray.price_yen);
document.querySelectorAll('.cta').forEach(b => b.addEventListener('click', () => { $('note-' + b.dataset.id).hidden = false; }));

// 終演後の劇場：客席の後ろから舞台を見る。客電（暖色）が点き、舞台の中央に一灯（ゴーストライト）
const cv = $('house');
(async () => {
  let THREE; try { THREE = await import('three'); } catch { return; }
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  r.setPixelRatio(Math.min(2, devicePixelRatio)); r.shadowMap.enabled = true;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0c0a09); scene.fog = new THREE.Fog(0x0c0a09, 18, 40);
  const cam = new THREE.PerspectiveCamera(36, 1, .1, 80);
  const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: .8 });
  const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; scene.add(o); return o; };
  add(new THREE.BoxGeometry(14, .9, 6), mat(0x2a221c), 0, .45, -6);           // 舞台
  add(new THREE.BoxGeometry(16, 9, .3), mat(0x16110e), 0, 4.5, -9.2);          // 奥の壁
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(1.4, 8, .6), mat(0x3a1414), s * 7.4, 4, -3.2); // プロセニアム
  add(new THREE.BoxGeometry(16.2, 1.4, .6), mat(0x3a1414), 0, 7.6, -3.2);
  // 客席（段ごとに上がる）
  const seatG = new THREE.BoxGeometry(.55, .9, .5), seatM = mat(0x6a2426);
  const seats = new THREE.InstancedMesh(seatG, seatM, 12 * 9); let k = 0; const o = new THREE.Object3D();
  for (let row = 0; row < 9; row++) for (let c = 0; c < 12; c++) { o.position.set((c - 5.5) * .72 + (c < 6 ? -.4 : .4), .45 + row * .32, row * 1.0); o.updateMatrix(); seats.setMatrixAt(k++, o.matrix); }
  seats.castShadow = seats.receiveShadow = true; scene.add(seats);
  for (let row = 0; row < 9; row++) add(new THREE.BoxGeometry(14, .32, 1.0), mat(0x1c1612), 0, row * .32 - .16 + .0, row * 1.0);
  // ゴーストライト：スタンドに裸電球一つ
  add(new THREE.CylinderGeometry(.03, .03, 1.6, 12), mat(0x222222), 0, 1.7, -5.6);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.09, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff2dc })); bulb.position.set(0, 2.55, -5.6); scene.add(bulb);
  const ghost = new THREE.PointLight(0xfff0d8, 0, 12, 1.6); ghost.position.copy(bulb.position); ghost.castShadow = true; scene.add(ghost);
  // 客電：天井の暖かい灯（ダウンライト）を並べる
  const house = [];
  for (let i = 0; i < 4; i++) { const s = new THREE.SpotLight(0xffc98a, 0, 18, .9, .9, 1.2); s.position.set((i % 2 ? 3.5 : -3.5), 9, i < 2 ? 1 : 6); s.target.position.set(s.position.x * .6, 0, s.position.z); scene.add(s, s.target); house.push(s); }
  scene.add(new THREE.HemisphereLight(0x4a3a2c, 0x0c0a09, .35));
  const fit = () => { const w = cv.clientWidth, h = cv.clientHeight; r.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 52 : 36; cam.updateProjectionMatrix(); };
  fit(); addEventListener('resize', fit);
  const t0 = performance.now(); let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && reduce) draw(performance.now()); }).observe(cv);
  const draw = now => {
    const t = (now - t0) / 1000;
    const up = reduce ? 1 : 1 - Math.exp(-Math.max(0, t - .2) * 2.2);       // 客電がゆっくり上がる
    house.forEach(s => s.intensity = 140 * up);
    ghost.intensity = 12 + (reduce ? 0 : .6 * Math.sin(t * 7.3) * Math.sin(t * 2.1));
    const a = reduce ? 0 : Math.sin(t * .05) * .05;
    const pz = cam.aspect < 1 ? 9.5 : 13.5; cam.position.set(Math.sin(a) * 3, cam.aspect < 1 ? 5.0 : 6.2, pz); cam.lookAt(0, cam.aspect < 1 ? .6 : 2.2, -5);
    r.render(scene, cam);
  };
  if (reduce) { draw(performance.now()); addEventListener('resize', () => draw(performance.now())); return; }
  const loop = now => { requestAnimationFrame(loop); if (visible) draw(now); };
  requestAnimationFrame(loop);
})();
