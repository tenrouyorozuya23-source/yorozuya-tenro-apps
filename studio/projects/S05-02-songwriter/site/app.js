// 凪野ソラ 公式サイト：試聴・作品・ライブ・プロフィール。背景の舞台は固定し、スクロールでカメラだけが動く。
// 試聴の音の大きさで、マイクに当たる一灯とハゼの光の筋が呼吸する。
import { F } from './data.js';
const $ = id => document.getElementById(id);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const A = F.artist;
$('name').textContent = A.name; $('kana').textContent = A.en; $('tagline').textContent = A.tagline; $('discl').textContent = F.disclosure;
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// 作品
F.releases.forEach((r, i) => {
  const li = el('li'), cv = el('div', 'cover' + (i ? ' s' : '')); cv.setAttribute('aria-hidden', 'true'); cv.append(el('span', null, r.title));
  const tx = el('div'); tx.append(el('p', 'ty', r.type), el('h3', null, `『${r.title}』`), el('p', 'dt', `${r.date} 発売（架空）`));
  const ol = el('ol'); r.songs.forEach(s => ol.append(el('li', null, s))); tx.append(ol);
  li.append(cv, tx); $('releases').append(li);
});
// ライブ（日付を大きく）
for (const l of F.lives) {
  const [y, m, d] = l.date.split('-').map(Number);
  const li = el('li'), day = el('p', 'day'), tm = document.createElement('time');
  tm.dateTime = l.date; tm.append(el('span', 'yr', String(y)), `${m}.${d}`); day.append(tm, el('small', null, l.dow));
  li.append(day, el('p', 'v', l.venue), el('p', 't', `開場 ${l.open}　開演 ${l.start}`), el('p', 'm', l.memo));
  for (const p of li.querySelectorAll('p')) p.style.margin = '0';
  $('lives').append(li);
}
// プロフィール
for (const p of A.profile) $('profile').append(el('p', null, p));
$('profile').append(el('p', 'since', `${A.since}から活動（架空の経歴です）`));

// 試聴プレイヤー
const au = $('audio'), seek = $('seek');
let ctx, an, buf, cur = -1;
const btns = F.tracks.map((t, i) => {
  const li = el('li'), b = el('button'); b.type = 'button'; b.setAttribute('aria-pressed', 'false'); b.dataset.id = 'play-' + t.id;
  b.append(el('span', 'ic'), el('span', 'n', t.title), el('span', 'len', mmss(t.sec)));
  b.setAttribute('aria-label', `${t.title} を再生`);
  b.addEventListener('click', () => toggle(i)); li.append(b); $('tracks').append(li); return b;
});
function mark() { btns.forEach((b, i) => { const on = i === cur && !au.paused; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', `${F.tracks[i].title} を${on ? '一時停止' : '再生'}`); }); }
async function toggle(i) {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    an = ctx.createAnalyser(); an.fftSize = 1024; buf = new Float32Array(an.fftSize);
    ctx.createMediaElementSource(au).connect(an); an.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') await ctx.resume();
  if (i === cur) { au.paused ? au.play() : au.pause(); return; }
  cur = i; au.src = F.tracks[i].file; seek.disabled = false; au.play();
}
au.addEventListener('play', mark); au.addEventListener('pause', mark);
au.addEventListener('ended', () => { mark(); seek.value = 0; });
au.addEventListener('loadedmetadata', () => { $('dur').textContent = mmss(au.duration); });
au.addEventListener('timeupdate', () => { if (au.duration) { seek.value = Math.round(au.currentTime / au.duration * 1000); $('cur').textContent = mmss(au.currentTime); } });
seek.addEventListener('input', () => { if (au.duration) au.currentTime = seek.value / 1000 * au.duration; });
// 今の音の大きさ（0〜1）。再生していなければ 0
function level() {
  if (!an || au.paused) return 0;
  an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v;
  return Math.min(1, Math.sqrt(s / buf.length) * 4.2);
}

// 舞台：マイクスタンド・スツール・立てかけたギター。上から一灯、後ろからアンバーのリム、ハゼに浮かぶ光の筋
(async () => {
  let THREE; try { THREE = await import('three'); } catch { return; }
  const cv = $('stage');
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  r.setPixelRatio(Math.min(2, devicePixelRatio)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1; r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x060607); scene.fog = new THREE.Fog(0x060607, 6, 14);
  const cam = new THREE.PerspectiveCamera(30, 1, .05, 40);
  const std = (c, ro = .7, me = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: ro, metalness: me });
  const add = (g, m, x = 0, y = 0, z = 0, p = scene) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; p.add(o); return o; };

  // 床（少しだけ艶のある黒い板）と、奥の黒い幕（ひだ付き）
  const floor = add(new THREE.PlaneGeometry(30, 30), std(0x17130f, .42, .0)); floor.rotation.x = -Math.PI / 2;
  const cg = new THREE.PlaneGeometry(16, 7, 160, 1); const pa = cg.attributes.position;
  for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin(pa.getX(i) * 7.5) * .07 + Math.sin(pa.getX(i) * 2.3) * .05);
  cg.computeVertexNormals(); const curtain = add(cg, std(0x120c0e, .9)); curtain.position.set(0, 3.5, -3.2);

  // マイクスタンド
  const metal = std(0x2a2a2c, .32, .85), black = std(0x0d0d0e, .4, .5);
  add(new THREE.CylinderGeometry(.17, .19, .03, 48), metal, 0, .015, 0);
  add(new THREE.CylinderGeometry(.011, .011, 1.42, 12), metal, 0, .72, 0);
  add(new THREE.CylinderGeometry(.016, .016, .05, 12), metal, 0, 1.43, 0);
  const mic = new THREE.Group(); mic.position.set(0, 1.49, .02); mic.rotation.x = .28; scene.add(mic);
  add(new THREE.CylinderGeometry(.026, .018, .17, 32), new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: .3, metalness: .7 }), 0, .02, 0, mic);   // 胴（先が太い）
  add(new THREE.CylinderGeometry(.03, .027, .02, 32), new THREE.MeshStandardMaterial({ color: 0x8c8780, roughness: .35, metalness: .9 }), 0, .115, 0, mic);
  add(new THREE.SphereGeometry(.036, 40, 28), new THREE.MeshStandardMaterial({ color: 0x6d6862, roughness: .66, metalness: .7 }), 0, .14, 0, mic);   // 網の頭
  add(new THREE.BoxGeometry(.02, .05, .03), metal, 0, -.07, 0, mic);
  // スツール
  const wood = new THREE.MeshPhysicalMaterial({ color: 0x3b2416, roughness: .45, clearcoat: .6, clearcoatRoughness: .3 });
  const stool = new THREE.Group(); stool.position.set(.72, 0, -.35); scene.add(stool);
  add(new THREE.CylinderGeometry(.19, .18, .045, 40), wood, 0, .74, 0, stool);
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * Math.PI * 2 + .4, leg = add(new THREE.CylinderGeometry(.014, .016, .76, 10), metal, Math.cos(a) * .15, .37, Math.sin(a) * .15, stool);
    leg.rotation.set(Math.sin(a) * .14, 0, -Math.cos(a) * .14);
  }
  add(new THREE.TorusGeometry(.17, .008, 8, 48), metal, 0, .26, 0, stool).rotation.x = Math.PI / 2;

  // ギター（8の字の胴を押し出し、ネックと弦）。スツールに立てかける
  const s = new THREE.Shape();
  s.moveTo(0, -.26);
  s.bezierCurveTo(.27, -.26, .25, .02, .12, .06); s.bezierCurveTo(.06, .08, .07, .1, .1, .14);
  s.bezierCurveTo(.2, .26, .1, .3, 0, .3); s.bezierCurveTo(-.1, .3, -.2, .26, -.1, .14);
  s.bezierCurveTo(-.07, .1, -.06, .08, -.12, .06); s.bezierCurveTo(-.25, .02, -.27, -.26, 0, -.26);
  const hole = new THREE.Path(); hole.absarc(0, .07, .045, 0, Math.PI * 2, true); s.holes.push(hole);
  const top = new THREE.MeshPhysicalMaterial({ color: 0x6a4220, roughness: .38, clearcoat: 1, clearcoatRoughness: .12 });
  const side = new THREE.MeshPhysicalMaterial({ color: 0x24120a, roughness: .35, clearcoat: 1, clearcoatRoughness: .15 });
  const gtr = new THREE.Group(); scene.add(gtr);
  const body = add(new THREE.ExtrudeGeometry(s, { depth: .09, bevelEnabled: true, bevelThickness: .008, bevelSize: .008, bevelSegments: 3, curveSegments: 40 }), [top, side], 0, 0, -.09, gtr);
  add(new THREE.CylinderGeometry(.044, .044, .002, 32), std(0x050403, 1), 0, .07, -.05, gtr).rotation.x = Math.PI / 2; // 響孔の奥
  add(new THREE.BoxGeometry(.05, .5, .024), std(0x2a170c, .5), 0, .55, .006, gtr);
  add(new THREE.BoxGeometry(.075, .17, .02), std(0x1a0f08, .45), 0, .88, .0, gtr);
  add(new THREE.BoxGeometry(.11, .022, .012), std(0x1a0f08, .5), 0, -.17, .01, gtr);                                // ブリッジ
  const sm = new THREE.LineBasicMaterial({ color: 0xd8d0c2, transparent: true, opacity: .55 });
  for (let k = 0; k < 6; k++) { const x = (k - 2.5) * .007; gtr.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x * 1.4, -.17, .02), new THREE.Vector3(x, .8, .02)]), sm)); }
  gtr.position.set(.92, .27, .02); gtr.rotation.set(-.08, -.5, .2);

  // 照明
  const key = new THREE.SpotLight(0xfff1dc, 520, 14, .3, .55, 1.4); key.position.set(.15, 5.2, 1.4); key.target.position.set(.3, .4, -.1);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0004; scene.add(key, key.target);
  const rim = new THREE.SpotLight(0xe9a64b, 160, 10, .38, .7, 1.4); rim.position.set(-.6, 3.6, -2.6); rim.target.position.set(.2, 1.1, 0); scene.add(rim, rim.target);
  scene.add(new THREE.HemisphereLight(0x22202a, 0x050405, .25));
  // ハゼの光の筋（加算の円錐。上ほど細く、縁で消え、ゆっくり揺らぐ）
  const hz = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { t: { value: 0 }, k: { value: .1 } },
    vertexShader: 'varying vec2 vU; varying vec3 vN; varying vec3 vV; void main(){ vU=uv; vec4 w=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-w.xyz); gl_Position=projectionMatrix*w; }',
    fragmentShader: 'uniform float t,k; varying vec2 vU; varying vec3 vN; varying vec3 vV; float h(vec2 p){return fract(sin(dot(p,vec2(12.9,78.2)))*43758.5);} float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);} void main(){ float e=pow(abs(dot(vN,vV)),1.6); float y=vU.y; float z=.55+.45*n(vec2(vU.x*9.+t*.05,y*3.-t*.12)); gl_FragColor=vec4(vec3(1.,.93,.82)*e*(.25+.75*(1.-y))*z*k,1.); }'
  });
  const coneH = 5.0, cone = new THREE.Mesh(new THREE.CylinderGeometry(.02, 1.45, coneH, 64, 1, true), hz);
  cone.position.set(.22, coneH / 2 + .02, .6); cone.rotation.x = -.16; scene.add(cone);

  // カメラの位置（節ごと）。PC では文字の面が左にあるので、主役が右に来るよう横にずらす
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const SHOTS = [
    { p: V(.55, 1.35, 4.6), l: V(.3, 1.0, 0), lv: 1 },     // ヒーロー：一灯の中のマイクとギター
    { p: V(.5, 1.5, 2.7), l: V(.1, 1.3, 0), lv: 1 },   // 試聴：マイクに寄る
    { p: V(1.9, .95, 1.7), l: V(.75, .62, -.1), lv: 1 },   // 作品：ギターへ
    { p: V(-1.2, 2.9, 6.2), l: V(.3, .7, 0), lv: 1 },      // ライブ：客席の奥から全景
    { p: V(-.3, .55, 2.4), l: V(.25, 1.15, 0), lv: .9 },   // プロフィール：低い位置から見上げる
    { p: V(.3, 1.7, 6.2), l: V(.3, 1.25, 0), lv: .12 },     // 結び：灯りが落ちる
  ];
  const marks = [...document.querySelectorAll('[data-shot]')];
  let wide = innerWidth >= 900;
  const fit = () => { const w = innerWidth, h = innerHeight; r.setSize(w, h, false); cam.aspect = w / h; wide = w >= 900; cam.fov = w < h ? 46 : 30; cam.updateProjectionMatrix(); };
  addEventListener('resize', fit); fit();
  const ease = u => u * u * (3 - 2 * u);
  function shotAt() {
    const y = scrollY + innerHeight * .5;
    const tops = marks.map(m => { const q = m.getBoundingClientRect(); return q.top + scrollY + Math.min(q.height, innerHeight) * .5; });
    let i = 0; while (i < tops.length - 1 && y > tops[i + 1]) i++;
    if (i >= tops.length - 1) return [SHOTS.length - 1, SHOTS.length - 1, 0];
    let u = Math.max(0, Math.min(1, (y - tops[i]) / (tops[i + 1] - tops[i])));
    if (reduce) u = u < .5 ? 0 : 1;
    return [i, i + 1, ease(u)];
  }
  const pos = V(0, 0, 0), look = V(0, 0, 0), right = V(0, 0, 0), tmp = V(0, 0, 0);
  let lv = 0, t0 = performance.now(), first = true;
  function frame(now) {
    const t = (now - t0) / 1000;
    const [a, b, u] = shotAt(), A = SHOTS[a], B = SHOTS[b];
    pos.lerpVectors(A.p, B.p, u); look.lerpVectors(A.l, B.l, u);
    const shift = wide ? [0, .42, .42, .55, .42, 0][a] * (1 - u) + [0, .42, .42, .55, .42, 0][b] * u : 0;
    right.subVectors(look, pos).cross(V(0, 1, 0)).normalize().multiplyScalar(-shift);
    if (!reduce) { tmp.set(Math.sin(t * .21) * .04, Math.sin(t * .17) * .02, 0); pos.add(tmp); }
    if (!wide && cam.aspect < 1) look.y -= [.5, 0, 0, 0, 0, .35][a] * (1 - u) + [.5, 0, 0, 0, 0, .35][b] * u;
    cam.position.copy(pos).add(right); cam.lookAt(tmp.copy(look).add(right));
    // 一灯の呼吸：再生中は音の大きさ、止まっているときは 5 秒周期のゆっくりした呼吸
    const breath = reduce ? 0 : Math.sin(t * Math.PI * 2 / 5) * .06;
    const target = level();
    lv += (target - lv) * (reduce ? .05 : (target > lv ? .35 : .08));
    const dim = A.lv + (B.lv - A.lv) * u;
    key.intensity = 520 * dim * (.82 + breath + lv * .75);
    rim.intensity = 160 * Math.max(dim, .1) * (.85 + lv * .5);
    hz.uniforms.k.value = .24 * dim * (.85 + breath * 2 + lv * 1.6); hz.uniforms.t.value = reduce ? 0 : t;
    r.render(scene, cam);
    if (first) { first = false; cv.classList.add('ready'); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
