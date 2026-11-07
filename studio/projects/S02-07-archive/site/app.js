// 冬の灯 アーカイブ：facts から期間・価格を描き、ヒーローに終演後の劇場（客電と一灯）を置く
import { F } from './data.js';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
const jd = (iso, wd) => { const [y, m, d] = iso.split('-').map(Number); return `<time datetime="${iso}">${y}年${m}月${d}日（${wd}）</time>`; };
const yen = (n, tax) => `¥${n.toLocaleString('ja-JP')}<small>${tax}</small>`;
const nw = t => t.replace(/（[^）]+）/g, m => `<span class="nw">${m}</span>`);
$('s-period').innerHTML = `${jd(F.stream.from, F.stream.from_wd)}〜<br>${jd(F.stream.to, F.stream.to_wd)} ${F.stream.until}まで`;
$('s-rec').innerHTML = `${jd(F.closing_iso, F.closing_wd)} 千秋楽公演・${F.running_time}`;
$('s-price').innerHTML = yen(F.stream.price_yen, F.stream.tax);
$('b-date').innerHTML = jd(F.bluray.release, F.bluray.release_wd);
for (const c of F.bluray.contents) { const li = document.createElement('li'); li.innerHTML = nw(c.replace(/</g, '&lt;')); $('b-list').append(li); }
$('b-price').innerHTML = yen(F.bluray.price_yen, F.bluray.tax);
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
  add(new THREE.BoxGeometry(14, .9, 6), new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: .45 }), 0, .45, -6);           // 舞台
  add(new THREE.BoxGeometry(16, 9, .3), mat(0x16110e), 0, 4.5, -9.2);          // 奥の壁
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(1.4, 8, .6), mat(0x3a1414), s * 7.4, 4, -3.2); // プロセニアム
  add(new THREE.BoxGeometry(16.2, 1.4, .6), mat(0x3a1414), 0, 7.6, -3.2);
  // 客席（段ごとに上がる）
  const seatM = new THREE.MeshStandardMaterial({ color: 0x5a1e20, roughness: .95 });
  const cush = new THREE.InstancedMesh(new THREE.BoxGeometry(.55, .12, .46), seatM, 108), back = new THREE.InstancedMesh(new THREE.BoxGeometry(.55, .58, .09), seatM, 108);
  let k = 0; const o = new THREE.Object3D();
  for (let row = 0; row < 9; row++) for (let c = 0; c < 12; c++) { const x = (c - 5.5) * .72 + (c < 6 ? -.4 : .4), y = row * .32, z = row * 1.0;
    o.rotation.set(0, 0, 0); o.position.set(x, y + .44, z); o.updateMatrix(); cush.setMatrixAt(k, o.matrix);
    o.position.set(x, y + .76, z + .26); o.rotation.set(-.2, 0, 0); o.updateMatrix(); back.setMatrixAt(k, o.matrix); k++; }
  for (const m of [cush, back]) { m.castShadow = m.receiveShadow = true; scene.add(m); }
  for (let row = 0; row < 9; row++) add(new THREE.BoxGeometry(14, .32, 1.0), mat(0x1c1612), 0, row * .32 - .16 + .0, row * 1.0);
  // ゴーストライト：スタンドに裸電球一つ
  add(new THREE.CylinderGeometry(.03, .03, 1.6, 12), mat(0x222222), 0, 1.7, -5.6);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.09, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff2dc })); bulb.scale.setScalar(1.5); bulb.position.set(0, 2.55, -5.6); scene.add(bulb);
  const hc = document.createElement('canvas'); hc.width = hc.height = 128; const hg = hc.getContext('2d'); const gr = hg.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,242,220,.9)'); gr.addColorStop(.25, 'rgba(255,230,200,.35)'); gr.addColorStop(1, 'rgba(255,230,200,0)'); hg.fillStyle = gr; hg.fillRect(0, 0, 128, 128);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(hc), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  halo.scale.set(2.4, 2.4, 1); halo.position.set(0, 2.55, -5.6); scene.add(halo);
  const shaft = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.4, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0d8, transparent: true, opacity: .05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  shaft.position.set(0, 1.35, -5.6); scene.add(shaft);
  const ceil = add(new THREE.BoxGeometry(16, .2, 14), mat(0x14100d), 0, 7.4, 2.5); ceil.castShadow = false;
  const fixM = new THREE.MeshBasicMaterial({ color: 0x2a1c10 }); const fixtures = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const d = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .05, 24), fixM); d.position.set(-4.5 + i * 3, 7.28, j * 2.6 - 1.6); scene.add(d); fixtures.push(d); }
  const ghost = new THREE.PointLight(0xfff0d8, 0, 12, 1.6); ghost.position.copy(bulb.position); ghost.castShadow = true; scene.add(ghost);
  // 客電：天井の暖かい灯（ダウンライト）を並べる
  const house = [];
  for (let i = 0; i < 4; i++) { const s = new THREE.SpotLight(0xffc98a, 0, 18, .9, .9, 1.2); s.position.set((i % 2 ? 3.5 : -3.5), 7.1, i < 2 ? 0 : 5); s.target.position.set(s.position.x * .6, 0, s.position.z); scene.add(s, s.target); house.push(s); }
  scene.add(new THREE.HemisphereLight(0x4a3a2c, 0x0c0a09, .35));
  const fit = () => { const w = cv.clientWidth, h = cv.clientHeight; r.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 52 : 36; cam.updateProjectionMatrix(); };
  fit(); addEventListener('resize', fit);
  const t0 = performance.now(); let visible = true, sp = 0;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && reduce) draw(performance.now()); }).observe(cv);
  const draw = now => {
    const t = (now - t0) / 1000;
    const e = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    const cl = v => Math.min(1, Math.max(0, v));
    // 客電が上がり（0.2〜2.0秒）、3.0秒から1.6秒かけて35%へ落ちて一灯が残る（終演後の一拍）
    const up = reduce ? .35 : e(cl((t - .2) / 1.8)) * (1 - .65 * e(cl((t - 3) / 1.6)));
    house.forEach(s => s.intensity = 160 * up);
    const fu = Math.max(up, reduce ? 1 : .7 * Math.min(1, t / 2)); fixM.color.setRGB(.16 + .84 * fu, .11 + .66 * fu, .06 + .42 * fu);
    ghost.intensity = 12 + (reduce ? 0 : .6 * Math.sin(t * 7.3) * Math.sin(t * 2.1));
    const p = reduce ? 0 : cl(scrollY / Math.max(1, cv.clientHeight));
    sp += (p - sp) * .08;
    const sx = reduce ? 0 : .6 * Math.sin(t * Math.PI * 2 / 14);
    const port = cam.aspect < 1;
    cam.position.set(sx, (port ? 4.6 : 4.4) - 1.2 * sp, (port ? 9.5 : 13.5) - 3 * sp);
    cam.lookAt(0, (port ? 1.6 : 3.0) - .4 * sp, -5 - .6 * sp);
    r.render(scene, cam);
  };
  if (reduce) { draw(performance.now()); addEventListener('resize', () => draw(performance.now())); return; }
  const loop = now => { requestAnimationFrame(loop); if (visible) draw(now); };
  requestAnimationFrame(loop);
})();
