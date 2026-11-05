/**
 * cine.js — 天狼シネマ（3D）の共通部品。three.js を renderAt(t) の決定論レンダーで使う。
 *
 * ページ側:
 *   <script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js",
 *     "three/addons/":"/node_modules/three/examples/jsm/"}}</script>
 *   <script type="module"> import * as C from '/tools/cine/cine.js'; ... </script>
 *   （render.mjs が studio/ をローカル HTTP で配信するので / 始まりのパスで読める）
 *
 * 提供するもの:
 *   createStage({width,height,exposure})   renderer（ACES・sRGB・ソフトシャドウ・preserveDrawingBuffer）、scene、camera、
 *                                          環境反射（RoomEnvironment を暗く）、後処理（DOF・光源だけのブルーム・Output）
 *   stageFloor(scene,{size,color,roughness})  艶のある黒い床（clearcoat）
 *   spot(scene,{pos,target,color,intensity,angle,penumbra,shadow})  舞台スポット（影付き）
 *   beam(scene,{from,to,radius,color,density})  ハゼに浮かぶ光の筋（加算のボリューム風シェーダー。uniforms.time/strength で制御）
 *   dust(scene,{center,radius,height,count,seed})  光の中だけで見える浮遊塵（決定論の位置。update(t) を毎フレーム呼ぶ）
 *   brushedMetal / chrome / blackGlossy     PBR 材質のプリセット
 *   ease / clamp / prog / lerp               小さな数学
 * 決定論: Math.random を使わない。時間は renderAt(t) の t だけ。
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, u) => a + (b - a) * u;
export const prog = (t, s, d) => clamp((t - s) / d);
export const ease = {
  outCubic: u => 1 - Math.pow(1 - u, 3),
  inOutCubic: u => (u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  outQuint: u => 1 - Math.pow(1 - u, 5),
  inOutSine: u => -(Math.cos(Math.PI * u) - 1) / 2,
};
export function rand(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function createStage({ width = 1080, height = 1920, exposure = 1.0, fov = 30, envIntensity = 0.12, dof = true, bloom = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020203);
  scene.fog = new THREE.FogExp2(0x020203, 0.16);   // 床の奥と地平線を黒に溶かす
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = envIntensity;   // 黒い空間でも金属に映り込みが出る程度
  const camera = new THREE.PerspectiveCamera(fov, width / height, 0.05, 100);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  let bokeh = null, bloomPass = null;
  if (dof) { bokeh = new BokehPass(scene, camera, { focus: 3.0, aperture: 0.0025, maxblur: 0.008 }); composer.addPass(bokeh); }
  if (bloom) { bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.32, 0.5, 0.96); composer.addPass(bloomPass); } // 閾値高め＝光源だけ
  composer.addPass(new OutputPass());
  return { THREE, renderer, scene, camera, composer, bokeh, bloom: bloomPass, render: () => composer.render() };
}

export const blackGlossy = () => new THREE.MeshPhysicalMaterial({ color: 0x17171a, roughness: 0.48, metalness: 0.0, clearcoat: 0.55, clearcoatRoughness: 0.22, envMapIntensity: 0.25 });
export const chrome = (rough = 0.18) => new THREE.MeshPhysicalMaterial({ color: 0xd8d8dc, roughness: rough, metalness: 1.0 });
export const brushedMetal = (color = 0x2a2b2e, rough = 0.38) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 1.0, anisotropy: 0.6 });

export function stageFloor(scene, { size = 40, material = blackGlossy() } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true; scene.add(m); return m;
}

export function spot(scene, { pos = [0, 6, 1], target = [0, 0, 0], color = 0xffe2b8, intensity = 220, angle = 0.22, penumbra = 0.55, decay = 2, shadow = true, distance = 0 } = {}) {
  const l = new THREE.SpotLight(color, intensity, distance, angle, penumbra, decay);
  l.position.set(...pos); l.target.position.set(...target);
  if (shadow) { l.castShadow = true; l.shadow.mapSize.set(2048, 2048); l.shadow.bias = -0.0002; l.shadow.radius = 6; l.shadow.camera.near = 0.5; l.shadow.camera.far = 30; }
  scene.add(l); scene.add(l.target); return l;
}

// 光の筋：円錐の内側を加算で塗る。軸からの距離・高さ・ノイズで濃淡を作る（ハゼの中のビーム）
export function beam(scene, { from = [0, 6, 1], to = [0, 0, 0], radius = 1.35, color = 0xffe2b8, density = 0.22 } = {}) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const h = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(0.03, radius, h, 96, 48, true);
  geo.translate(0, -h / 2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color(color) }, time: { value: 0 }, strength: { value: 1 }, density: { value: density }, h: { value: h } },
    vertexShader: `varying vec3 vPos; varying vec3 vN; varying vec3 vView;
      void main(){ vPos=position; vec4 w=modelViewMatrix*vec4(position,1.); vView=normalize(-w.xyz); vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*w; }`,
    fragmentShader: `uniform vec3 color; uniform float time, strength, density, h; varying vec3 vPos; varying vec3 vN; varying vec3 vView;
      float hash(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){
        float y = clamp(-vPos.y / h, 0., 1.);               // 0=光源側 1=床側
        float edge = pow(abs(dot(vN, vView)), 2.2);   // 輪郭は薄く、正面の厚み方向だけ濃い（体積があるように見せる）          // 円錐の縁は薄く、中心方向は濃く
        float fall = (1.-y*0.55) * smoothstep(0.0, 0.08, y); // 光源の根元を少し抜き、床に向けて減衰
        // ハゼの筋：軸方向に引き伸ばした fbm（4オクターブ）で、縦に流れる筋と粒立ちを作る
        vec3 q = vec3(vPos.x*5.5, vPos.y*0.9 - time*0.05, vPos.z*5.5);
        float n = 0.5*noise(q) + 0.25*noise(q*2.03 + 7.1) + 0.15*noise(q*4.01 - vec3(0.,time*0.08,0.)) + 0.1*noise(q*8.1 + 3.3);
        n = 0.35 + 0.65*n + 0.35*noise(vPos*1.3 + vec3(0., time*0.12, time*0.05));
        float a = density * strength * edge * fall * (0.15 + 1.35*n*n);
        gl_FragColor = vec4(color * a, a);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(a);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), b.clone().sub(a).normalize());
  m.renderOrder = 10;
  scene.add(m);
  return { mesh: m, set(t, strength = 1) { mat.uniforms.time.value = t; mat.uniforms.strength.value = strength; } };
}

// 浮遊塵：光の中だけで見える小さな点。決定論で漂う
export function dust(scene, { center = [0, 1.5, 0], radius = 1.2, height = 3, count = 220, seed = 7, size = 0.012, color = 0xfff1d8 } = {}) {
  const R = rand(seed);
  const base = []; const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { const yy = (R() - 0.5) * height, k = 0.35 + 0.65 * (0.5 - yy / height); const r = Math.sqrt(R()) * radius * k, th = R() * 6.283; base.push([Math.cos(th) * r, yy, Math.sin(th) * r, R() * 6.283, 0.3 + R() * 0.7]); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat); pts.position.set(...center); scene.add(pts);
  return { points: pts, update(t, op = 0.55) {
    for (let i = 0; i < count; i++) { const [x, y, z, ph, sp] = base[i];
      pos[i * 3] = x + Math.sin(t * 0.21 * sp + ph) * 0.06; pos[i * 3 + 1] = y + Math.sin(t * 0.13 * sp + ph * 2) * 0.08 + t * 0.012 * sp; pos[i * 3 + 2] = z + Math.cos(t * 0.17 * sp + ph) * 0.06; }
    geo.attributes.position.needsUpdate = true; mat.opacity = op; } };
}
