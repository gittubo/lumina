// The Hall — a nocturnal marble colonnade with Lady Justice appearing at the end of the nave.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* ---------- procedural marble ---------- */
function makeNoise(seed = 7) {
  const p = new Uint8Array(512);
  const perm = [...Array(256).keys()];
  let s = seed;
  for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y) => ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
  return (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const a = p[X] + Y, b = p[X + 1] + Y;
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(grad(p[a], x, y), grad(p[b], x - 1, y), u),
      THREE.MathUtils.lerp(grad(p[a + 1], x, y - 1), grad(p[b + 1], x - 1, y - 1), u), v);
  };
}

function marbleTexture({ size = 512, base = [222, 214, 200], vein = [92, 78, 62], scale = 3, seed = 7, dark = false } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size);
  const n = makeNoise(seed);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * scale, v = y / size * scale;
    let f = 0, amp = 1, fr = 1;
    for (let o = 0; o < 6; o++) { f += n(u * fr, v * fr) * amp; amp *= .5; fr *= 2.03; }
    const m = Math.abs(Math.sin((u * .9 + v * 1.7 + f * 2.2) * Math.PI));
    const veinAmt = Math.pow(1 - m, 22) * .5 + Math.pow(1 - m, 4) * .12;
    const cloud = n(u * .7 + 9, v * .7) * .5 + .5;
    const i = (y * size + x) * 4;
    for (let k = 0; k < 3; k++) {
      let col = base[k] * (.9 + cloud * .12);
      col = col * (1 - veinAmt * .85) + vein[k] * veinAmt * .85;
      img.data[i + k] = dark ? col * .22 : col;
    }
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

/* ---------- a fluted Doric-ish column ---------- */
function columnGeometry(h = 7) {
  const shaftH = h - 1.0;
  const shaft = new THREE.CylinderGeometry(.42, .48, shaftH, 120, 24, true);
  const pos = shaft.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x);
    const flute = Math.pow(Math.abs(Math.cos(a * 10)), .55);  // 20 flutes
    const r = Math.hypot(v.x, v.z) * (1 - .045 * flute);
    pos.setXYZ(i, Math.cos(a) * r, v.y, Math.sin(a) * r);
  }
  shaft.computeVertexNormals();
  shaft.translate(0, .55 + shaftH / 2, 0);

  const basePts = [[0, 0], [.72, 0], [.72, .14], [.6, .16], [.62, .26], [.66, .32], [.58, .42], [.52, .5], [.49, .55], [0, .55]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const base = new THREE.LatheGeometry(basePts, 64);
  const plinth = new THREE.BoxGeometry(1.5, .16, 1.5); plinth.translate(0, .08, 0);

  const capPts = [[0, 0], [.43, 0], [.46, .06], [.44, .1], [.5, .14], [.66, .3], [.72, .38], [0, .38]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const cap = new THREE.LatheGeometry(capPts, 64); cap.translate(0, h - .45, 0);
  const abacus = new THREE.BoxGeometry(1.6, .2, 1.6); abacus.translate(0, h - .45 + .38 + .1, 0);

  const parts = [shaft, base, plinth, cap, abacus].map(g => g.toNonIndexed());
  parts.forEach(g => { if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); });
  return mergeGeometries(parts);
}

/* ---------- light shaft ---------- */
function lightShaft(color = 0xffd9a0) {
  const geo = new THREE.CylinderGeometry(.6, 3.4, 16, 64, 1, true);
  geo.translate(0, -8, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uIntensity: { value: .55 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uTime; uniform float uIntensity; varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      float h(float n){return fract(sin(n)*43758.5453);}
      void main(){
        float edge = pow(abs(dot(normalize(vN), normalize(vView))), 2.2);
        float fall = smoothstep(0., .25, vUv.y) * smoothstep(1., .55, vUv.y) ;
        float streak = .65 + .35*sin(vUv.x*60. + uTime*.4) * sin(vUv.x*23. - uTime*.25);
        gl_FragColor = vec4(uColor * edge * fall * streak * uIntensity, 1.);
      }`
  });
  return new THREE.Mesh(geo, mat);
}

/* ---------- drifting dust ---------- */
function dust(count, bounds) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3), s = new Float32Array(count), o = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    p[i * 3] = (Math.random() - .5) * bounds.x;
    p[i * 3 + 1] = Math.random() * bounds.y;
    p[i * 3 + 2] = bounds.z0 + Math.random() * (bounds.z1 - bounds.z0);
    s[i] = Math.random() * .9 + .2; o[i] = Math.random() * 100;
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(s, 1));
  g.setAttribute('aOff', new THREE.BufferAttribute(o, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uH: { value: bounds.y } },
    vertexShader: `attribute float aSize; attribute float aOff; uniform float uTime; uniform float uPx; uniform float uH; varying float vA;
      void main(){ vec3 p=position; p.y=mod(p.y+uTime*.08*aSize+aOff, uH); p.x+=sin(uTime*.3+aOff)*.25; p.z+=cos(uTime*.2+aOff)*.25;
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize = clamp(aSize*uPx*26./-mv.z, 1., 9.); vA = smoothstep(40.,4.,-mv.z) * (0.4+0.6*sin(uTime*.8+aOff)*.5+.5); }`,
    fragmentShader: `varying float vA; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d); gl_FragColor=vec4(vec3(1.,.86,.62)*a*vA*.8,1.); }`
  });
  return new THREE.Points(g, m);
}

export function createHall(canvas, { video, onReady } = {}) {
  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isSmall, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const bg = new THREE.Color(0x0c0a08);
  scene.background = bg;
  scene.fog = new THREE.FogExp2(0x0c0a08, .052);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .25;

  const camera = new THREE.PerspectiveCamera(isSmall ? 55 : 40, 1, .1, 120);

  /* floor: mirror under a translucent dark-marble skin */
  const floorW = 30, floorL = 90;
  const mirror = new Reflector(new THREE.PlaneGeometry(floorW, floorL), {
    textureWidth: Math.floor(window.innerWidth * (isSmall ? .5 : .6)),
    textureHeight: Math.floor(window.innerHeight * (isSmall ? .5 : .6)),
    color: 0x6f675e
  });
  mirror.rotation.x = -Math.PI / 2; mirror.position.set(0, 0, -15);
  scene.add(mirror);

  const floorTex = marbleTexture({ base: [70, 64, 58], vein: [180, 150, 110], scale: 4, seed: 3 });
  floorTex.repeat.set(3, 9);
  const floorSkin = new THREE.Mesh(new THREE.PlaneGeometry(floorW, floorL),
    new THREE.MeshStandardMaterial({ map: floorTex, color: 0x5a524a, roughness: .35, metalness: 0, transparent: true, opacity: .72 }));
  floorSkin.rotation.x = -Math.PI / 2; floorSkin.position.set(0, .005, -15);
  scene.add(floorSkin);

  /* brass inlay lines along the nave */
  const inlayMat = new THREE.MeshStandardMaterial({ color: 0xc9a466, metalness: 1, roughness: .25, emissive: 0x3a2a10 });
  [-1.6, 1.6].forEach(x => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(.05, .01, floorL), inlayMat);
    s.position.set(x, .012, -15); scene.add(s);
  });

  /* columns */
  const colTex = marbleTexture({ base: [226, 218, 204], vein: [120, 104, 88], scale: 2.4, seed: 11 });
  colTex.repeat.set(1, 3);
  const colMat = new THREE.MeshStandardMaterial({ map: colTex, color: 0xd8cfc2, roughness: .38, metalness: 0, envMapIntensity: .35 });
  const colGeo = columnGeometry(7.2);
  const zs = []; for (let z = 18; z >= -40; z -= 4.6) zs.push(z);
  const columns = new THREE.InstancedMesh(colGeo, colMat, zs.length * 2);
  const m4 = new THREE.Matrix4();
  let k = 0;
  zs.forEach(z => [-3.6, 3.6].forEach(x => { m4.makeTranslation(x, 0, z); columns.setMatrixAt(k++, m4); }));
  scene.add(columns);

  /* entablature */
  const beamMat = new THREE.MeshStandardMaterial({ map: colTex, color: 0xbdb3a3, roughness: .5 });
  [-3.6, 3.6].forEach(x => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.9, .9, 64), beamMat);
    beam.position.set(x, 7.2 + .55, -11); scene.add(beam);
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(2.3, .22, 64), beamMat);
    cornice.position.set(x, 7.2 + 1.1, -11); scene.add(cornice);
  });

  /* far apse wall + plinth for Justice */
  const apse = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 16, 64, 1, true, Math.PI * .5, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x1a1511, roughness: .9, side: THREE.BackSide }));
  apse.position.set(0, 8, -40); apse.rotation.y = Math.PI; scene.add(apse);

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, .8, 64),
    new THREE.MeshStandardMaterial({ map: colTex, color: 0x9c9284, roughness: .3 }));
  plinth.position.set(0, .4, -16); scene.add(plinth);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.62, .03, 8, 96), inlayMat);
  ring.rotation.x = Math.PI / 2; ring.position.set(0, .82, -16); scene.add(ring);

  /* Lady Justice: the black-background film composited additively into the hall */
  let justice = null;
  if (video) {
    const vt = new THREE.VideoTexture(video);
    vt.colorSpace = THREE.SRGBColorSpace;
    const jm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
      uniforms: { map: { value: vt }, uOpacity: { value: 1 }, uTint: { value: new THREE.Color(1.0, .93, .82) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform sampler2D map; uniform float uOpacity; uniform vec3 uTint; varying vec2 vUv;
        void main(){ vec3 c = texture2D(map, vUv).rgb; c = max(c - .035, 0.) * 1.08;
          float edge = smoothstep(0., .08, vUv.x) * smoothstep(1., .92, vUv.x) * smoothstep(0., .06, vUv.y) * smoothstep(1., .9, vUv.y);
          gl_FragColor = vec4(c * uTint * edge * uOpacity, 1.); }`
    });
    const h = 8.4, w = h * (720 / 1280);
    justice = new THREE.Mesh(new THREE.PlaneGeometry(w, h), jm);
    justice.position.set(0, .82 + h / 2 - .2, -16.2);
    scene.add(justice);
  }

  /* lighting */
  scene.add(new THREE.HemisphereLight(0xffe6c0, 0x140e08, .06));
  const key = new THREE.SpotLight(0xffd9a0, 260, 40, Math.PI / 7, .6, 1.6);
  key.position.set(0, 16, -15); key.target.position.set(0, 0, -16);
  scene.add(key, key.target);
  const warm = [];
  zs.slice(0, 9).forEach((z, i) => {
    if (i % 2) return;
    const l = new THREE.PointLight(0xffb070, 14, 8, 1.7);
    l.position.set(0, 3.2, z + 2.3); scene.add(l); warm.push(l);
  });
  const rim = new THREE.DirectionalLight(0xffd2a0, .12); rim.position.set(-6, 10, -30); scene.add(rim);

  const shaft = lightShaft(); shaft.position.set(0, 16, -16); scene.add(shaft);
  const motes = dust(isSmall ? 700 : 1600, { x: 9, y: 10, z0: -30, z1: 20 });
  scene.add(motes);

  /* post */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .45, .7, .72);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* state */
  const state = { progress: 0, mx: 0, my: 0, sx: 0, sy: 0, visible: true, intro: 0 };
  const lookTarget = new THREE.Vector3();

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    bloom.resolution.set(w * .5, h * .5);
    camera.aspect = w / h; camera.fov = (w / h < .8) ? 62 : 40; camera.updateProjectionMatrix();
    motes.material.uniforms.uPx.value = renderer.getPixelRatio() * (h / 900);
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', e => {
    state.mx = (e.clientX / window.innerWidth) * 2 - 1;
    state.my = (e.clientY / window.innerHeight) * 2 - 1;
  });

  const clock = new THREE.Clock();
  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!state.visible) return;
    const t = clock.getElapsedTime();
    state.sx += (state.mx - state.sx) * .04; state.sy += (state.my - state.sy) * .04;
    const p = state.progress, e = p * p * (3 - 2 * p);
    const introZ = (1 - state.intro) * 10;
    camera.position.set(state.sx * .7, 1.75 + e * .9 - state.sy * .25, 22 - e * 17 + introZ);
    lookTarget.set(state.sx * .4, 2.6 + e * 1.5, -16);
    camera.lookAt(lookTarget);
    camera.rotation.z = state.sx * -.012;
    shaft.material.uniforms.uTime.value = t;
    shaft.material.uniforms.uIntensity.value = .38 + .08 * Math.sin(t * .7) + e * .08;
    motes.material.uniforms.uTime.value = t;
    warm.forEach((l, i) => { l.intensity = 14 * (.85 + .15 * Math.sin(t * 3 + i * 1.7) * Math.sin(t * 1.3 + i)); });
    if (justice) justice.material.uniforms.uOpacity.value = Math.min(1, state.intro * 1.2) * (1 - Math.max(0, e - .85) * 4);
    composer.render();
  }
  frame();
  onReady && onReady();

  return {
    setProgress(p) { state.progress = THREE.MathUtils.clamp(p, 0, 1); },
    setIntro(v) { state.intro = v; },
    setVisible(v) { state.visible = v; },
    state,
    dispose() { cancelAnimationFrame(raf); renderer.dispose(); }
  };
}
