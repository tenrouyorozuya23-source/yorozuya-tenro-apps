// 九条 舞 公式サイト：手首と足首の灯りの長時間露光。4本の光の線が描かれ、それぞれの終わりにページの入口が立つ。
import { F } from './data.js';
const $ = id => document.getElementById(id);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
$('name').textContent = F.name; $('en').textContent = F.en; $('tagline').textContent = F.tagline; $('discl').textContent = F.disclosure;
for (const p of F.about) $('about-body').append(el('p', null, p));
$('about-body').append(el('p', 'since', `${F.role}。${F.since}から活動（架空の経歴です）`));
for (const w of F.works) { const li = el('li'); li.id = `w-${w.id}`; li.append(el('span', 'y', String(w.year)), el('h3', null, w.title), el('p', 'meta', `${w.form}　${w.length}　${w.venue}`), el('p', 'line', w.line)); $('work-list').append(li); }
for (const s of F.stages) { const li = el('li'); li.append(el('span', 'y', String(s.year)), el('span', null, s.text)); $('stage-list').append(li); }
for (const w of F.workshops) {
  const [y, m, d] = w.date.split('-').map(Number), li = el('li'), t = el('time', 'd'); t.dateTime = w.date;
  t.append(`${m}.${d}`, el('small', null, `${w.dow}　${y}年`)); li.append(t, el('p', 't', w.title), el('p', 'p', `${w.place}　${w.time}`)); $('ws-list').append(li);
}
for (const r of F.requests) $('req-list').append(el('li', null, r));

// 踊りの4本の線（右手首・左手首・右足首・左足首）。s は 0〜1 の時間。体の中心は舞台を左から右へ渡る
const TAU = Math.PI * 2;
const LIMBS = [
  { key: 'rw', label: '作品', href: '#works', color: [1.0, .93, .82], f: (s, c) => [c[0] + .55 * Math.cos(TAU * 1.25 * s + .3), 1.35 + .55 * Math.sin(TAU * 1.25 * s + .3), c[2] + .35 * Math.sin(TAU * 2 * s)] },
  { key: 'lw', label: '出演歴', href: '#stage', color: [1.0, .81, .59], f: (s, c) => [c[0] - .5 * Math.cos(TAU * s + 1.2), 1.25 + .6 * Math.sin(TAU * s + 2.4), c[2] + .3 * Math.cos(TAU * 1.5 * s)] },
  { key: 'ra', label: 'ワークショップ', href: '#ws', color: [.96, .9, .82], f: (s, c) => [c[0] + .2 + .25 * Math.sin(2 * TAU * s), .08 + .2 * Math.max(0, Math.sin(3 * TAU * s)), c[2] + .2 * Math.cos(2 * TAU * s)] },
  { key: 'la', label: 'ご依頼', href: '#ask', color: [1.0, .87, .69], f: (s, c) => [c[0] - .2 + .25 * Math.sin(2 * TAU * s + Math.PI), .08 + .2 * Math.max(0, Math.sin(3 * TAU * s + Math.PI)), c[2] - .2 * Math.cos(2 * TAU * s)] },
];
const center = s => [-1.4 + 2.7 * s, 0, Math.sin(TAU * s) * .3];
// 線の終わりを置く画面の位置（NDC）。縦長と横長で変える（キャプションの文字がある左下を避ける）
const ANCH = { wide: [[.52, .56], [-.18, .66], [.64, -.18], [.2, -.02]], tall: [[.42, .6], [-.42, .44], [.46, .08], [-.3, .22]] };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 入口の言葉（線の終わりに立つ）
const links = LIMBS.map((L, i) => { const a = el('a', null, L.label); a.href = L.href; a.dataset.i = i; a.style.setProperty('--c', `rgb(${L.color.map(v => Math.round(v * 255)).join(',')})`); $('ends').append(a); return a; });

// 結び：右手首の線を、そのまま署名のように小さく描く
(() => {
  const pts = []; for (let k = 0; k <= 160; k++) { const s = k / 160, p = LIMBS[0].f(s, center(s)); pts.push([p[0], p[1]]); }
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${(20 + (p[0] - x0) / (x1 - x0) * 560).toFixed(1)},${(180 - (p[1] - y0) / (y1 - y0) * 160).toFixed(1)}`).join('');
  $('sig').innerHTML = `<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#ffcf96" stop-opacity="0"/><stop offset=".7" stop-color="#fff1dc" stop-opacity=".8"/><stop offset="1" stop-color="#fff"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="3"/></filter></defs><path d="${d}" fill="none" stroke="url(#g)" stroke-width="6" filter="url(#b)" opacity=".5"/><path d="${d}" fill="none" stroke="url(#g)" stroke-width="1.6"/>`;
})();

(async () => {
  let THREE; try { THREE = await import('three'); } catch { $('ends').hidden = true; return; }
  const cv = $('trace'), hero = cv.parentElement;
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true });   // 加算の光は不透明の地に描く（透明の canvas だと線のまわりが黒く縁取られる）
  r.setPixelRatio(Math.min(2, devicePixelRatio)); r.setClearColor(0x09080a, 1);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(36, 1, .05, 50);
  const mat = col => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { prog: { value: 0 }, k: { value: 1 }, col: { value: new THREE.Vector3(...col) }, halo: { value: 0 } },
    vertexShader: 'varying vec2 vU; varying vec3 vN; varying vec3 vV; void main(){ vU=uv; vec4 w=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-w.xyz); gl_Position=projectionMatrix*w; }',
    // uv.x は線に沿った位置。描かれた所だけ出し、古い所ほど暗く、先端は明るい
    fragmentShader: 'uniform float prog,k,halo; uniform vec3 col; varying vec2 vU; varying vec3 vN; varying vec3 vV; void main(){ if(vU.x>prog) discard; float age=prog-vU.x; float a=.25+.75*exp(-age*2.2); float head=exp(-age*60.)*1.6; float rim=pow(abs(dot(vN,vV)),halo>0.5?3.:.6); gl_FragColor=vec4(col*(a+head)*rim*k*(halo>0.5?.22:1.),1.); }'
  });
  const trails = LIMBS.map(L => { const core = mat(L.color), soft = mat(L.color); soft.uniforms.halo.value = 1; return { L, core, soft, meshes: [] }; });
  let anchors = [];
  function build() {
    const tall = cam.aspect < 1, A = ANCH[tall ? 'tall' : 'wide'];
    // NDC の位置を z=0 の面に戻して、線の終わりの点にする
    anchors = A.map(([x, y]) => { const v = new THREE.Vector3(x, y, .5).unproject(cam), dir = v.sub(cam.position).normalize(), t = -cam.position.z / dir.z; return cam.position.clone().add(dir.multiplyScalar(t)); });
    for (const T of trails) for (const m of T.meshes) { scene.remove(m); m.geometry.dispose(); }
    trails.forEach((T, i) => {
      const pts = []; for (let k = 0; k <= 260; k++) { const s = k / 260, c = center(s), p = T.L.f(s, c), w = smooth(.72, 1, s); pts.push(new THREE.Vector3(p[0] + (anchors[i].x - p[0]) * w, p[1] + (anchors[i].y - p[1]) * w, p[2] + (anchors[i].z - p[2]) * w)); }
      const curve = new THREE.CatmullRomCurve3(pts);
      const core = new THREE.Mesh(new THREE.TubeGeometry(curve, 520, .0075, 8, false), T.core), soft = new THREE.Mesh(new THREE.TubeGeometry(curve, 260, .045, 12, false), T.soft);
      // 床（y=0）への薄い映り込み
      const refl = new THREE.Mesh(core.geometry, T.core.clone()); refl.scale.y = -1; refl.material.uniforms.k.value = .12;
      T.refl = refl; T.meshes = [core, soft, refl]; T.meshes.forEach(m => scene.add(m));
    });
  }
  const look = new THREE.Vector3(0, .95, 0);
  function fit() {
    const w = hero.clientWidth, h = hero.clientHeight; r.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 58 : 36; cam.updateProjectionMatrix();
    cam.position.set(0, 1.1, w < h ? 4.6 : 5.2); cam.lookAt(look); cam.updateMatrixWorld(); build();
  }
  new ResizeObserver(fit).observe(hero); fit();
  let focus = -1;
  links.forEach((a, i) => { a.addEventListener('pointerenter', () => focus = i); a.addEventListener('focus', () => focus = i); a.addEventListener('pointerleave', () => focus = -1); a.addEventListener('blur', () => focus = -1); });
  const t0 = performance.now(), DRAW = 4.6, tmp = new THREE.Vector3();
  function frame(now) {
    const t = (now - t0) / 1000;
    // 4本は少しずつずれて描かれ始める（手→足）
    trails.forEach((T, i) => {
      const p = reduce ? 1.001 : Math.min(1.001, Math.max(0, (t - i * .25) / DRAW));
      const e = p >= 1 ? 1.001 : 1 - Math.pow(1 - p, 2.2);
      const kk = focus < 0 ? 1 : focus === i ? 1.35 : .3;
      for (const m of [T.core, T.soft, T.refl.material]) m.uniforms.prog.value = e;
      T.core.uniforms.k.value += (kk - T.core.uniforms.k.value) * .15; T.soft.uniforms.k.value = T.core.uniforms.k.value; T.refl.material.uniforms.k.value = .12 * T.core.uniforms.k.value;
      links[i].classList.toggle('on', e >= .995);
    });
    // カメラはごくゆっくり左右に回る（入口の言葉はいつも線の終わりについていく）
    const a = reduce ? 0 : Math.sin(t * .12) * .06;
    const d = cam.position.length(); cam.position.x = Math.sin(a) * cam.position.z; cam.lookAt(look);
    cam.updateMatrixWorld();
    const W = hero.clientWidth, H = hero.clientHeight;
    anchors.forEach((v, i) => { tmp.copy(v).project(cam); const x = (tmp.x + 1) / 2 * W, y = (1 - tmp.y) / 2 * H; links[i].style.left = `${Math.min(W - 70, Math.max(70, x))}px`; links[i].style.top = `${Math.min(H - 40, Math.max(40, y - 30))}px`; links[i].style.setProperty('--dy', '30px'); });
    r.render(scene, cam); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
