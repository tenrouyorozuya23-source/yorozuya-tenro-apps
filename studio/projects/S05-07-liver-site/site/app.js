// 宵待ルカ 公式サイト：週の予定、これまで、相談フォーム（見本のため送信しない）。ヒーローは配信部屋の 3D
import { F } from './data.js';
const $ = id => document.getElementById(id);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
$('name').textContent = F.name; $('kana').textContent = F.kana; $('tagline').textContent = F.tagline; $('disc').textContent = F.disclosure;
$('since').textContent = `${F.since}から配信しています`;
const DAYS = ['月', '火', '水', '木', '金', '土', '日'];
const today = (new Date().getDay() + 6) % 7;   // 月曜を0にする
const plan = Object.fromEntries(F.weekly.map(w => [w.d, w]));
DAYS.forEach((d, i) => {
  const li = el('li'); li.dataset.id = 'd' + i; li.append(el('span', 'd', d));
  if (plan[i]) { li.classList.add('on'); li.append(el('span', 't', plan[i].time), el('span', 'n', plan[i].title)); } else li.append(el('span', 'off', 'お休み'));
  if (i === today) { li.classList.add('today'); li.setAttribute('aria-current', 'date'); }
  $('days').append(li);
});
for (const [k, v] of F.stats) { const d = el('div'); d.append(el('dt', null, k), el('dd', null, v)); $('stat-list').append(d); }
for (const t of F.work_types) { $('types').append(el('li', null, t)); const o = el('option', null, t); o.value = t; $('f-kind').append(o); }
$('form').addEventListener('submit', e => {
  e.preventDefault();
  const miss = ['f-name', 'f-body'].filter(id => !$(id).value.trim());
  ['f-name', 'f-body'].forEach(id => $(id).setAttribute('aria-invalid', String(miss.includes(id))));
  $('msg').textContent = miss.length ? 'お名前と内容を入力してください。' : 'これは見本のため、送信はされません。入力は消さずに残しています。';
  if (miss.length) $(miss[0]).focus();
});

// 配信部屋：机・モニター・マイク・スタンドライト。奥の壁に7本の灯り（配信のある曜日だけ点く。今日はいちばん明るい）
(async () => {
  let THREE; try { THREE = await import('three'); } catch { return; }
  const cv = $('room');
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  r.setPixelRatio(Math.min(2, devicePixelRatio)); r.shadowMap.enabled = true; r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x09090b);
  const cam = new THREE.PerspectiveCamera(32, 1, .1, 50);
  const M = (c, r = .8, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; scene.add(o); return o; };
  add(new THREE.BoxGeometry(12, .1, 8), M(0x1a1716), 0, -.05, 0);
  add(new THREE.BoxGeometry(14, 10, .1), M(0x17151a, .95), 0, 5, -2.5);
  add(new THREE.BoxGeometry(2.2, .06, .9), M(0x2b211b, .55), 0, .95, -.6);                 // 机
  for (const x of [-1, 1]) add(new THREE.BoxGeometry(.06, .95, .8), M(0x1c1c1e, .4, .6), x, .47, -.6);
  const screenM = new THREE.MeshBasicMaterial({ color: 0x8fb0ff });
  add(new THREE.BoxGeometry(1.0, .6, .04), M(0x111111, .4), -.25, 1.42, -.92); const scr = new THREE.Mesh(new THREE.PlaneGeometry(.94, .54), screenM); scr.position.set(-.25, 1.42, -.895); scene.add(scr);
  const monLight = new THREE.PointLight(0x8fb0ff, 3, 4, 2); monLight.position.set(-.25, 1.4, -.6); scene.add(monLight);
  add(new THREE.CylinderGeometry(.05, .05, .14, 16), M(0x2a2a2a, .3, .7), .55, 1.05, -.5);    // マイクの台
  add(new THREE.CylinderGeometry(.012, .012, .5, 8), M(0x2a2a2a, .3, .7), .55, 1.35, -.5);
  add(new THREE.CapsuleGeometry(.06, .12, 6, 16), M(0x0f0f0f, .35, .5), .55, 1.66, -.42);
  add(new THREE.CylinderGeometry(.015, .015, 1.6, 8), M(0x2a2a2a, .3, .7), 1.6, .8, -1.4);   // スタンドライト
  const shade = add(new THREE.ConeGeometry(.22, .25, 24, 1, true), M(0x3a2c22, .6), 1.6, 1.68, -1.4); shade.material.side = THREE.DoubleSide;
  const lamp = new THREE.PointLight(0xffc98a, 6, 6, 2); lamp.position.set(1.6, 1.6, -1.4); lamp.castShadow = true; scene.add(lamp);
  // 曜日の灯り
  const bars = [];
  for (let i = 0; i < 7; i++) {
    const on = !!plan[i], isToday = i === today;
    const m = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false });
    const b = new THREE.Mesh(new THREE.BoxGeometry(.08, 1.4, .02), m); b.position.set(-1.8 + i * .6, 3.0, -2.44); scene.add(b);
    const l = new THREE.PointLight(0xffc98a, 0, 2.2, 2); l.position.set(b.position.x, 3.0, -2.2); scene.add(l);
    bars.push({ m, l, on, isToday, i });
  }
  scene.add(new THREE.HemisphereLight(0x30304a, 0x09090b, .3));
  const fit = () => { const w = cv.clientWidth, h = cv.clientHeight; r.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 54 : 32; cam.updateProjectionMatrix(); };
  fit(); addEventListener('resize', fit);
  let visible = true; new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(cv);
  const t0 = performance.now();
  const frame = now => {
    requestAnimationFrame(frame); if (!visible) return;
    const t = (now - t0) / 1000;
    for (const b of bars) {
      const u = reduce ? 1 : Math.min(1, Math.max(0, (t - .3 - b.i * .12) / 1.2)), e = 1 - Math.pow(1 - u, 3);
      const lv = (b.isToday ? 1 : b.on ? .45 : .04) * e;
      b.m.color.setRGB(lv * 1.0 + .02, lv * .79 + .02, lv * .54 + .02); b.l.intensity = 3.2 * lv;
    }
    screenM.color.setRGB(.2, .26 + (reduce ? 0 : .01 * Math.sin(t * 1.3)), .42);
    const a = reduce ? 0 : Math.sin(t * .08) * .05;
    const port = cam.aspect < 1;
    cam.position.set(Math.sin(a) * 5 + .2, port ? 2.4 : 2.0, Math.cos(a) * 5 + 1.6); cam.lookAt(0, port ? 2.2 : 1.8, -1.4);
    r.render(scene, cam);
  };
  requestAnimationFrame(frame);
})();
