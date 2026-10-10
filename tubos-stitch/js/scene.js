/* =========================================================
   Tubo's Stitch — WebGL atelier
   One fixed canvas. Each 3D "actor" is anchored to an empty
   DOM element ([data-anchor]) so it scrolls with the story.
   ========================================================= */
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/* ---------- procedural textures ---------- */
function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// twisted-thread stripes, used along the tube
const threadTex = () => canvasTex(64, 16, (g, w, h) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 5;
  for (let x = -w; x < w * 2; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 16, h); g.stroke(); }
}, { repeat: [520, 1] });

// wound thread on a cone
const woundTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.12})`; g.fillRect(0, y, w, 1); }
  // cross-wound diamonds
  g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 1.5;
  for (let x = -h; x < w + h; x += 22) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h * .5, h); g.stroke();
    g.beginPath(); g.moveTo(x, h); g.lineTo(x + h * .5, 0); g.stroke();
  }
  // soft shading towards the ends
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(0,0,0,.18)'); gr.addColorStop(.12, 'rgba(0,0,0,0)'); gr.addColorStop(.88, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.22)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}, { repeat: [3, 1] });

// woven cloth bump (twill)
const weaveTex = () => canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  const s = 8;
  for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
    const over = ((x / s + y / s) % 4) < 2;
    const grd = g.createLinearGradient(x, y, x + s, y + s);
    grd.addColorStop(0, over ? '#d8d8d8' : '#4a4a4a'); grd.addColorStop(1, over ? '#9a9a9a' : '#2a2a2a');
    g.fillStyle = grd; g.fillRect(x, y, s, s);
  }
}, { repeat: [14, 18], srgb: false });

// tailor's tape: black, white ticks on both edges, a number every cm
function tapeTex(cm = 80) {
  const W = 4096, H = 128, pxPerCm = W / cm;
  return canvasTex(W, H, (g) => {
    g.fillStyle = '#121212'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f2efe8';
    for (let mm = 0; mm <= cm * 10; mm++) {
      const x = Math.round(mm * pxPerCm / 10);
      const len = mm % 10 === 0 ? 34 : mm % 5 === 0 ? 24 : 14;
      g.fillRect(x, 0, 2, len); g.fillRect(x, H - len, 2, len);
    }
    g.font = '500 30px "JetBrains Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let c = 1; c < cm; c++) if (c < 3 || c > 4) g.fillText(String(c), c * pxPerCm, H / 2 + 2);
    g.fillStyle = '#d4a85a'; g.font = 'italic 34px "Instrument Serif", serif';
    g.fillText("Tubo's Stitch", 3.5 * pxPerCm, H / 2 + 2);
  }, { repeat: [1, 1] });
}

const dotTex = () => canvasTex(64, 64, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.4, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});

/* =========================================================
   A tube whose spine can be rewritten every frame
   ========================================================= */
class LiveTube {
  constructor(samples, radial, material) {
    this.n = samples; this.r = radial;
    const vcount = (samples + 1) * (radial + 1);
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(vcount * 3);
    this.nor = new Float32Array(vcount * 3);
    const uv = new Float32Array(vcount * 2);
    const idx = [];
    for (let i = 0; i <= samples; i++) for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j; uv[k * 2] = i / samples; uv[k * 2 + 1] = j / radial;
      if (i < samples && j < radial) {
        const a = k, b = k + radial + 1, c = b + 1, d = a + 1;
        idx.push(a, b, d, b, c, d);
      }
    }
    g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geometry = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.spine = Array.from({ length: samples + 1 }, () => new THREE.Vector3());
    this.tangents = Array.from({ length: samples + 1 }, () => new THREE.Vector3());
    this._n = new THREE.Vector3(); this._b = new THREE.Vector3(); this._t = new THREE.Vector3();
  }
  // radiusFn(u) -> radius
  build(radiusFn) {
    const { n, r, spine, tangents, pos, nor } = this;
    for (let i = 0; i <= n; i++) {
      const a = spine[Math.max(0, i - 1)], b = spine[Math.min(n, i + 1)];
      tangents[i].subVectors(b, a).normalize();
      if (tangents[i].lengthSq() === 0) tangents[i].set(1, 0, 0);
    }
    const N = this._n, B = this._b;
    // initial normal: any vector perpendicular to the first tangent
    N.set(0, 0, 1); if (Math.abs(tangents[0].z) > .9) N.set(0, 1, 0);
    N.sub(this._t.copy(tangents[0]).multiplyScalar(N.dot(tangents[0]))).normalize();
    for (let i = 0; i <= n; i++) {
      const T = tangents[i];
      N.sub(this._t.copy(T).multiplyScalar(N.dot(T))).normalize(); // parallel transport
      B.crossVectors(T, N);
      const rad = radiusFn(i / n), P = spine[i];
      for (let j = 0; j <= r; j++) {
        const v = (j / r) * Math.PI * 2, cs = Math.cos(v), sn = Math.sin(v);
        const nx = cs * N.x + sn * B.x, ny = cs * N.y + sn * B.y, nz = cs * N.z + sn * B.z;
        const k = (i * (r + 1) + j) * 3;
        nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
        pos[k] = P.x + nx * rad; pos[k + 1] = P.y + ny * rad; pos[k + 2] = P.z + nz * rad;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
  }
  reveal(f) { this.geometry.setDrawRange(0, Math.floor(clamp(f) * this.n) * this.r * 6); }
}

/* =========================================================
   Needle
   ========================================================= */
function makeNeedle() {
  const L = 2.7;
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xe7e3dc, metalness: 1, roughness: .14, envMapIntensity: 1.35 });
  // shaft: eye-end at y≈0.24 → point at y=L
  const prof = [
    [0, L], [.0035, L - .03], [.012, L - .2], [.024, L - .55], [.031, L - 1.1],
    [.032, .5], [.03, .3], [.024, .25], [0.0, .245],
  ].map(([r, y]) => new THREE.Vector2(r, y)).reverse();
  const shaft = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), steel);
  g.add(shaft);
  // the eye — an elongated loop
  const eye = new THREE.Mesh(new THREE.TorusGeometry(.12, .014, 16, 48), steel);
  eye.scale.set(.26, 1, .9);
  eye.position.y = .125;
  g.add(eye);
  g.userData.length = L;
  return g;
}

/* =========================================================
   The Scene
   ========================================================= */
export class Atelier {
  constructor(canvas, { reduced = false } = {}) {
    this.canvas = canvas;
    this.reduced = reduced;
    this.mouse = new THREE.Vector2(0, 0);
    this.mouseSmooth = new THREE.Vector2(0, 0);
    this.pointerPx = { x: -9999, y: -9999 };
    this.intro = 0;               // 0→1 hero thread draw-in
    this.accent = new THREE.Color('#d4a85a');
    this.anchors = {};
    document.querySelectorAll('[data-anchor]').forEach((el) => { this.anchors[el.dataset.anchor] = el; });
    this.sections = {
      hero: document.querySelector('#hero'),
      manifesto: document.querySelector('#thread'),
      cloth: document.querySelector('#cloth'),
      finale: document.querySelector('#finale'),
    };
    this.hoverSpool = -1;
    this.onSpoolHover = null;
    this.onSpoolClick = null;

    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setClearColor(0x000000, 0);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
    this.camera.position.set(0, 0, 10);

    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
    this.scene.environmentIntensity = .9;

    const key = new THREE.DirectionalLight(0xfff1dc, 2.4); key.position.set(4, 6, 7); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xbcd2ff, 1.3); rim.position.set(-6, 2, -4); this.scene.add(rim);
    this.scene.add(new THREE.HemisphereLight(0xfff4e6, 0x1a1410, .5));

    this.raycaster = new THREE.Raycaster();
    this.initThread();
    this.initTape();
    this.initCloth();
    this.initSpools();
    this.initDust();

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', (e) => {
      this.mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      this.pointerPx.x = e.clientX; this.pointerPx.y = e.clientY;
    }, { passive: true });
    window.addEventListener('click', (e) => {
      if (this.hoverSpool >= 0 && this.onSpoolClick) this.onSpoolClick(this.hoverSpool, e);
    });
  }

  /* ---------- layout helpers ---------- */
  resize() {
    this.vw = innerWidth; this.vh = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, this.vw < 760 ? 1.5 : 1.75);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.vw, this.vh, false);
    this.camera.aspect = this.vw / this.vh;
    this.camera.updateProjectionMatrix();
    this.worldH = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.worldW = this.worldH * this.camera.aspect;
  }
  rect(el) {
    const r = el.getBoundingClientRect(), u = this.worldH / this.vh;
    return {
      x: (r.left + r.width / 2 - this.vw / 2) * u,
      y: -(r.top + r.height / 2 - this.vh / 2) * u,
      w: r.width * u, h: r.height * u,
      top: r.top, bottom: r.bottom, height: r.height,
      visible: r.bottom > -this.vh * .15 && r.top < this.vh * 1.15,
    };
  }
  pinProgress(el) {
    const r = el.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, r.height - this.vh));
  }

  /* =========================================================
     THREAD + NEEDLE — the protagonist
     ========================================================= */
  initThread() {
    this.CTRL = 96;
    this.ctrl = Array.from({ length: this.CTRL }, () => new THREE.Vector3());
    this.ctrlA = Array.from({ length: this.CTRL }, () => new THREE.Vector3());
    this.ctrlB = Array.from({ length: this.CTRL }, () => new THREE.Vector3());
    this.curve = new THREE.CatmullRomCurve3(this.ctrl, false, 'centripetal');

    this.threadMat = new THREE.MeshStandardMaterial({
      color: this.accent.clone(), map: threadTex(), roughness: .5, metalness: .05,
      emissive: this.accent.clone().multiplyScalar(.18),
    });
    this.tube = new LiveTube(460, 8, this.threadMat);
    this.threadGroup = new THREE.Group();
    this.threadGroup.add(this.tube.mesh);
    this.needle = makeNeedle();
    this.threadGroup.add(this.needle);
    this.scene.add(this.threadGroup);

    // invisible "cloth" that hides the thread where it dives under — turns a wave into a running stitch
    this.occluder = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true }),
    );
    this.occluder.renderOrder = -1;
    this.scene.add(this.occluder);

    // hero key-points in stage-normalised coordinates (x: -1..1 of half width, y: -1..1 of half height)
    const k = [
      [-1.3, -.42, -1.2], [-.98, -.2, -.2], [-.72, -.62, .5], [-.44, -.36, 1.1], [-.56, .2, .6],
      [-.34, .48, -.1], [-.08, .1, .6], [.1, -.36, 1.1], [.3, -.3, 1.4], [.42, -.06, 1.6],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const hc = new THREE.CatmullRomCurve3(k, false, 'centripetal');
    this.heroBase = Array.from({ length: this.CTRL }, (_, i) => hc.getPoint(i / (this.CTRL - 1)));
    this.stitches = 0;
  }

  shapeHero(out, t, st) {
    const sx = st.w / 2, sy = st.h / 2;
    const s = Math.min(1, st.w / 11);
    for (let i = 0; i < this.CTRL; i++) {
      const b = this.heroBase[i], u = i / (this.CTRL - 1);
      out[i].set(
        st.x + b.x * sx + Math.sin(t * .7 + u * 7) * .1,
        st.y + b.y * sy * (this.vw < 760 ? .7 : 1) + Math.sin(t * .9 + u * 9) * .14 * (1 - u * .6),
        b.z * s + Math.cos(t * .6 + u * 5) * .2,
      );
    }
  }
  shapeStitch(out, t, st, p) {
    const W = st.w + 3;
    const head = st.x - W / 2 + p * W;
    const len = W + 2.5;
    for (let i = 0; i < this.CTRL; i++) {
      const u = i / (this.CTRL - 1);
      const x = head - (1 - u) * len;
      const near = smooth(.85, 1, u); // the last bit lifts into the needle
      out[i].set(
        x,
        st.y + Math.sin(x * .55 + t * .4) * .08 + near * .25,
        Math.sin(x * 3.2) * .26 * (1 - near) + near * .55,
      );
    }
  }
  shapeHeart(out, t, st) {
    const sc = Math.min(st.h / 32, st.w / 38);
    const a0 = .16; // the first stretch hangs down from above into the dip
    const oy = 2.65; // centres the curve vertically
    const dip = new THREE.Vector3(st.x, st.y + (5 + oy) * sc, 0);
    const from = new THREE.Vector3(st.x + Math.sin(t * .5) * .2, st.y + st.h * 1.4, -.5);
    for (let i = 0; i < this.CTRL; i++) {
      const u = i / (this.CTRL - 1);
      if (u < a0) {
        const f = u / a0;
        out[i].lerpVectors(from, dip, f);
        out[i].x += Math.sin(f * Math.PI) * .15 * Math.sin(t * .7);
      } else {
        const th = ((u - a0) / (1 - a0)) * Math.PI * 1.97;
        const x = 16 * Math.sin(th) ** 3;
        const y = 13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th);
        out[i].set(st.x + x * sc, st.y + (y + oy) * sc, Math.sin(th * 2 + t * .8) * .22);
      }
    }
  }

  updateThread(t) {
    const hero = this.rect(this.anchors.hero);
    const mani = this.rect(this.anchors.manifesto);
    const fin = this.rect(this.anchors.heart);
    const heroP = clamp(-this.sections.hero.getBoundingClientRect().top / this.vh);
    const maniP = this.pinProgress(this.sections.manifesto);

    let mode = null;
    if (fin.visible) mode = 'heart';
    else if (hero.visible || mani.visible) mode = 'story';
    this.threadGroup.visible = !!mode;
    this.occluder.visible = mode === 'story' && heroP > .2;
    if (!mode) return;

    let reveal = 1, radius = .016;
    if (mode === 'story') {
      const a = smooth(.12, .8, heroP);
      this.shapeHero(this.ctrlA, t, hero);
      this.shapeStitch(this.ctrlB, t, mani, smooth(0, .92, maniP) * .94 + .03);
      for (let i = 0; i < this.CTRL; i++) this.ctrl[i].lerpVectors(this.ctrlA[i], this.ctrlB[i], a);
      reveal = lerp(this.intro, 1, a);
      radius = lerp(.018, .014, a);
      // the occluder sits on the stitch line
      this.occluder.position.set(mani.x, mani.y, 0);
      this.occluder.scale.set(mani.w + 4, mani.h, 1);
      this.stitches = Math.floor(maniP * 1240);
    } else {
      const sec = this.sections.finale.getBoundingClientRect();
      const p = clamp((this.vh * .6 - sec.top) / (sec.height - this.vh * .6));
      this.shapeHeart(this.ctrl, t, fin);
      reveal = .04 + smooth(.08, 1, p) * .96;
      radius = .02;
    }

    // sample spine
    const n = this.tube.n;
    for (let i = 0; i <= n; i++) this.curve.getPoint(i / n, this.tube.spine[i]);
    this.tube.build((u) => radius * (u < .02 ? u / .02 : 1));
    this.tube.reveal(reveal);

    // needle rides the head of the thread
    const hi = Math.max(1, Math.floor(clamp(reveal) * n));
    const P = this.tube.spine[hi], T = this.tube.tangents[hi];
    this.needle.position.copy(P);
    this.needle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), T);
    this.needle.rotateY(t * .5);
    this.needle.position.addScaledVector(T, -.125); // thread passes through the eye
    const ns = mode === 'heart' ? .6 : lerp(.82, .6, smooth(.12, .8, heroP));
    this.needle.scale.setScalar(ns * Math.min(1, this.worldW / 7));
    this.needle.visible = reveal > .02;
  }

  /* =========================================================
     TAPE MEASURE — unspools across "The Measure"
     ========================================================= */
  initTape() {
    this.TSEG = 520;
    const g = new THREE.BufferGeometry();
    const vc = (this.TSEG + 1) * 2;
    this.tapePos = new Float32Array(vc * 3);
    const uv = new Float32Array(vc * 2), idx = [];
    for (let i = 0; i <= this.TSEG; i++) {
      uv[i * 4] = i / this.TSEG; uv[i * 4 + 1] = 0;
      uv[i * 4 + 2] = i / this.TSEG; uv[i * 4 + 3] = 1;
      if (i < this.TSEG) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(this.tapePos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.tapeGeo = g;
    const map = tapeTex();
    this.tape = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map, roughness: .42, metalness: 0, side: THREE.DoubleSide, envMapIntensity: .6 }));
    this.tape.frustumCulled = false;
    this.tapeTip = new THREE.Mesh(
      new THREE.BoxGeometry(.11, .02, 1),
      new THREE.MeshStandardMaterial({ color: 0xcfcac2, metalness: 1, roughness: .25 }),
    );
    this.tapeGroup = new THREE.Group();
    this.tapeGroup.add(this.tape, this.tapeTip);
    this.scene.add(this.tapeGroup);
    this._tv = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    // re-draw the tape numerals once the webfont is ready
    document.fonts?.ready.then(() => { this.tape.material.map = tapeTex(); this.tape.material.needsUpdate = true; });
  }

  updateTape(t) {
    const st = this.rect(this.anchors.tape);
    this.tapeGroup.visible = st.visible;
    if (!st.visible) return;
    const p = clamp((this.vh - st.top) / (this.vh + st.height));
    const mobile = this.vw < 760;
    const width = mobile ? .26 : .42;
    const span = st.w * .84;
    const L = span * 1.25 + 6;                          // total tape length (world units)
    const laid = lerp(.6, span, smooth(.05, .62, p));   // how much has rolled out
    const x0 = st.x - span / 2 - st.w * .04;
    const R0 = mobile ? .3 : .46, thick = .016;
    // texture: 150 cm across the full length
    const wave = (s) => ({
      y: Math.sin(s * 1.1 - t * .6) * .32 + Math.sin(s * .37 + 1.2) * .25,
      z: Math.sin(s * .8 + t * .4) * .6,
      tw: Math.sin(s * .55 + t * .35) * 1.1,
    });
    const P = this._tv[0];
    const contact = wave(laid);
    const cy = st.y + R0;
    for (let i = 0; i <= this.TSEG; i++) {
      const s = (i / this.TSEG) * L;
      let x, y, z, ax, ay, az; // centre & width axis
      if (s <= laid) {
        const fade = 1 - smooth(laid - 2.2, laid, s);   // flatten as it nears the roll
        const w = wave(s);
        x = x0 + s;
        y = st.y + (w.y - contact.y) * fade;
        z = w.z * fade;
        const tw = w.tw * fade;
        ax = 0; ay = Math.sin(tw); az = Math.cos(tw);
      } else {
        const th = (s - laid) / R0;
        const R = Math.max(.08, R0 - thick * th / (Math.PI * 2));
        x = x0 + laid + Math.sin(th) * R;
        y = cy - Math.cos(th) * R;
        z = 0; ax = 0; ay = 0; az = 1;
      }
      P.set(x, y, z);
      const k = i * 6;
      this.tapePos[k] = P.x - ax * width / 2; this.tapePos[k + 1] = P.y - ay * width / 2; this.tapePos[k + 2] = P.z - az * width / 2;
      this.tapePos[k + 3] = P.x + ax * width / 2; this.tapePos[k + 4] = P.y + ay * width / 2; this.tapePos[k + 5] = P.z + az * width / 2;
      if (i === 0) { this.tapeTip.position.set(x - .05, y, z); this.tapeTip.scale.set(1, 1, width * 1.05); }
    }
    this.tapeGeo.attributes.position.needsUpdate = true;
    this.tapeGeo.computeVertexNormals();
    this.tapeGroup.rotation.x = lerp(.35, -.15, p) + this.mouseSmooth.y * .08;
    this.tapeGroup.rotation.y = this.mouseSmooth.x * .1;
    this.tapeGroup.position.set(0, 0, 0);
  }

  /* =========================================================
     CLOTH — hanging drape with sheen, reacts to the cursor
     ========================================================= */
  initCloth() {
    this.fabrics = [
      { color: '#1b2233', roughness: .86, sheen: .8, sheenRoughness: .55, sheenColor: '#7e93c2', bump: .9, clearcoat: 0 },
      { color: '#6f8590', roughness: .3, sheen: 1, sheenRoughness: .22, sheenColor: '#eef6fb', bump: .08, clearcoat: .35 },
      { color: '#e6dccb', roughness: .95, sheen: .5, sheenRoughness: .7, sheenColor: '#ffffff', bump: 1.4, clearcoat: 0 },
      { color: '#6d1622', roughness: .75, sheen: 1, sheenRoughness: .35, sheenColor: '#ff6b7a', bump: .2, clearcoat: 0 },
      { color: '#4a4f36', roughness: 1, sheen: .6, sheenRoughness: .8, sheenColor: '#c2bd8c', bump: 2, clearcoat: 0 },
    ];
    const f = this.fabrics[0];
    const mat = this.clothMat = new THREE.MeshPhysicalMaterial({
      color: f.color, roughness: f.roughness, sheen: f.sheen, sheenRoughness: f.sheenRoughness,
      sheenColor: new THREE.Color(f.sheenColor), bumpMap: weaveTex(), bumpScale: f.bump,
      side: THREE.DoubleSide, clearcoat: f.clearcoat, clearcoatRoughness: .4,
    });
    this.clothU = { uTime: { value: 0 }, uMouse: { value: new THREE.Vector3(0, 0, 0) }, uRipple: { value: 0 }, uWhoosh: { value: 0 }, uH: { value: 4.2 } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.clothU);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uTime, uRipple, uWhoosh, uH; uniform vec3 uMouse;
          vec3 drape(vec2 p){
            float hang = clamp((uH*.5 - p.y)/uH, 0., 1.);
            float h = pow(hang, 1.15);
            float z = .2*sin(p.x*2.1 + uTime*.9) + .1*sin(p.x*5.3 - uTime*1.3 + p.y*.7) + .16*sin(p.y*1.5 + uTime*.7);
            z += .26*cos(p.x*3.6 + .4) + .08*cos(p.x*9.0 + 1.3);
            float d = distance(p, uMouse.xy);
            z += uRipple * .45 * exp(-d*d*2.2) * sin(d*7. - uTime*5.);
            z += uWhoosh * .6 * sin(p.y*2.4 + uWhoosh*8.) * hang;
            float x = p.x + h*.07*sin(uTime*.8 + p.y*1.2);
            return vec3(x, p.y, z*h);
          }`)
        .replace('#include <beginnormal_vertex>', `
          vec3 _p0 = drape(position.xy);
          vec3 _px = drape(position.xy + vec2(.02, 0.));
          vec3 _py = drape(position.xy + vec2(0., .02));
          vec3 objectNormal = normalize(cross(_px - _p0, _py - _p0));
          #ifdef USE_TANGENT
            vec3 objectTangent = vec3(1., 0., 0.);
          #endif`)
        .replace('#include <begin_vertex>', 'vec3 transformed = _p0;');
    };
    const cloth = this.cloth = new THREE.Mesh(new THREE.PlaneGeometry(3, 4.2, 110, 150), mat);
    cloth.frustumCulled = false;
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a25c, metalness: 1, roughness: .28 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 3.7, 24), brass);
    rod.rotation.z = Math.PI / 2; rod.position.y = 2.12;
    const capG = new THREE.SphereGeometry(.075, 24, 16);
    const c1 = new THREE.Mesh(capG, brass), c2 = new THREE.Mesh(capG, brass);
    c1.position.set(-1.85, 2.12, 0); c2.position.set(1.85, 2.12, 0);
    this.clothGroup = new THREE.Group();
    this.clothInner = new THREE.Group();
    this.clothInner.add(cloth, rod, c1, c2);
    this.clothGroup.add(this.clothInner);
    this.scene.add(this.clothGroup);
    this._plane = new THREE.Plane(); this._hit = new THREE.Vector3();
  }

  setFabric(i, gsap) {
    const f = this.fabrics[i], m = this.clothMat;
    const c = new THREE.Color(f.color), sc = new THREE.Color(f.sheenColor);
    const opts = { duration: 1.1, ease: 'power2.inOut' };
    gsap.to(m.color, { r: c.r, g: c.g, b: c.b, ...opts });
    gsap.to(m.sheenColor, { r: sc.r, g: sc.g, b: sc.b, ...opts });
    gsap.to(m, { roughness: f.roughness, sheen: f.sheen, sheenRoughness: f.sheenRoughness, bumpScale: f.bump, clearcoat: f.clearcoat, ...opts });
    gsap.fromTo(this.clothU.uWhoosh, { value: 1 }, { value: 0, duration: 1.6, ease: 'power3.out' });
  }

  updateCloth(t, dt) {
    const st = this.rect(this.anchors.cloth);
    this.clothGroup.visible = st.visible;
    if (!st.visible) return;
    const p = this.pinProgress(this.sections.cloth);
    const s = Math.min(st.h / 4.6, st.w / 3.6);
    this.clothGroup.position.set(st.x, st.y - .05 * s, 0);
    this.clothGroup.scale.setScalar(s);
    this.clothInner.rotation.y = lerp(-.55, .35, p) + this.mouseSmooth.x * .15;
    this.clothInner.rotation.x = -.04 + this.mouseSmooth.y * .05;
    this.clothU.uTime.value = t;

    // cursor → local cloth coordinates for ripples
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObject(this.cloth, false);
    if (hits.length) {
      const local = this.cloth.worldToLocal(hits[0].point.clone());
      this.clothU.uMouse.value.lerp(local, .2);
      this.clothU.uRipple.value = lerp(this.clothU.uRipple.value, 1, .06);
    } else {
      this.clothU.uRipple.value = lerp(this.clothU.uRipple.value, 0, .03);
    }
  }

  /* =========================================================
     SPOOLS — eight thread cones hanging on strings
     ========================================================= */
  initSpools() {
    this.threadColors = ['#d4a85a', '#e8541f', '#e9a227', '#e9b7bf', '#8ccbe0', '#2b3fb8', '#b2654a', '#2f3d33'];
    const wound = woundTex();
    const coneG = new THREE.CylinderGeometry(.22, .34, 1, 48, 1, true);
    const topG = new THREE.CircleGeometry(.22, 48); topG.rotateX(-Math.PI / 2); topG.translate(0, .5, 0);
    const botG = new THREE.CircleGeometry(.34, 48); botG.rotateX(Math.PI / 2); botG.translate(0, -.5, 0);
    const coreG = new THREE.CylinderGeometry(.07, .1, 1.08, 24, 1, true);
    const paper = new THREE.MeshStandardMaterial({ color: 0xd9ccb4, roughness: .9, side: THREE.DoubleSide });
    const hole = new THREE.MeshBasicMaterial({ color: 0x0a0908 });
    // layout: [x (−1..1 of stage half-width), drop (0..1 of stage height), z]
    const layout = [[-.62, .34, .2], [-.2, .2, -.4], [.24, .3, .3], [.66, .22, -.2], [-.42, .66, .5], [.02, .58, 0], [.46, .7, .45], [-.05, .86, -.5]];
    this.spools = [];
    this.spoolGroup = new THREE.Group();
    const lineMat = new THREE.LineBasicMaterial({ color: 0xbfb6a8, transparent: true, opacity: .35 });
    this.threadColors.forEach((hex, i) => {
      const mat = new THREE.MeshPhysicalMaterial({ color: hex, map: wound, roughness: .62, sheen: .6, sheenRoughness: .4, sheenColor: new THREE.Color(hex).offsetHSL(0, 0, .2) });
      const body = new THREE.Group();
      const cone = new THREE.Mesh(coneG, mat);
      const top = new THREE.Mesh(topG, mat), bot = new THREE.Mesh(botG, mat);
      const core = new THREE.Mesh(coreG, paper);
      const h1 = new THREE.Mesh(new THREE.CircleGeometry(.05, 20), hole); h1.rotation.x = -Math.PI / 2; h1.position.y = .541;
      body.add(cone, top, bot, core, h1);
      body.userData.index = i;
      cone.userData.index = i; top.userData.index = i; bot.userData.index = i;
      const pivot = new THREE.Group();   // hangs from here
      const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0)]);
      const string = new THREE.Line(lineGeo, lineMat);
      pivot.add(string, body);
      this.spoolGroup.add(pivot);
      this.spools.push({ pivot, body, string, mat, layout: layout[i], phase: Math.random() * 6.28, scale: 1, spin: 0, picked: [cone, top, bot] });
    });
    this.spoolPickables = this.spools.flatMap((s) => s.picked);
    this.scene.add(this.spoolGroup);
    this.highlight = -1;
  }

  updateSpools(t, dt) {
    const st = this.rect(this.anchors.spools);
    this.spoolGroup.visible = st.visible;
    if (!st.visible) { this.setHoverSpool(-1); return; }
    const s = Math.min(st.w / 3.4, st.h / 4.4) * .82;
    const topY = st.y + st.h / 2 + .2;
    const scroll = clamp((this.vh - st.top) / (this.vh + st.height));
    this.spools.forEach((sp, i) => {
      const [lx, drop, lz] = sp.layout;
      const len = .6 + drop * st.h * .78;
      sp.pivot.position.set(st.x + lx * st.w * .42, topY, lz * s);
      const push = this.mouseSmooth.x * .12;
      sp.pivot.rotation.z = Math.sin(t * .9 + sp.phase) * .07 + push * (1 - drop * .5) + (scroll - .5) * .1 * (i % 2 ? 1 : -1);
      sp.pivot.rotation.x = Math.cos(t * .7 + sp.phase) * .05;
      sp.string.scale.y = len - .5 * s;
      const target = (this.highlight === i ? 1.3 : this.highlight >= 0 ? .88 : 1) * (this.hoverSpool === i ? 1.08 : 1);
      sp.scale = lerp(sp.scale, target, .12);
      sp.body.scale.setScalar(s * sp.scale);
      sp.body.position.y = -len;
      sp.spin += dt * (this.highlight === i ? 2.4 : .25);
      sp.body.rotation.y = sp.spin;
    });

    // hover picking (only when the pointer is over the stage area)
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObjects(this.spoolPickables, false)[0];
    this.setHoverSpool(hit ? hit.object.userData.index : -1);
  }
  setHoverSpool(i) {
    if (i === this.hoverSpool) return;
    this.hoverSpool = i;
    this.onSpoolHover?.(i);
  }

  /* ---------- dust in the light ---------- */
  initDust() {
    const N = this.vw < 760 ? 160 : 380;
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(N * 3), sp = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      p[i * 3] = (Math.random() - .5) * 18; p[i * 3 + 1] = (Math.random() - .5) * 11; p[i * 3 + 2] = (Math.random() - .5) * 8;
      sp[i] = .5 + Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.dustSpeed = sp;
    this.dustMat = new THREE.PointsMaterial({ size: .045, map: dotTex(), transparent: true, opacity: .55, depthWrite: false, color: 0xd9b77a, sizeAttenuation: true });
    this.dust = new THREE.Points(g, this.dustMat);
    this.scene.add(this.dust);
  }
  updateDust(dt, scrollVel) {
    const a = this.dust.geometry.attributes.position, arr = a.array;
    for (let i = 0; i < this.dustSpeed.length; i++) {
      arr[i * 3 + 1] += dt * .06 * this.dustSpeed[i] - scrollVel * .0006 * this.dustSpeed[i];
      arr[i * 3] += Math.sin((arr[i * 3 + 1] + i) * .6) * dt * .02;
      if (arr[i * 3 + 1] > 5.5) arr[i * 3 + 1] = -5.5;
      if (arr[i * 3 + 1] < -5.5) arr[i * 3 + 1] = 5.5;
    }
    a.needsUpdate = true;
  }

  /* ---------- public API ---------- */
  setTheme(theme, gsap) {
    const bone = theme === 'bone';
    const c = new THREE.Color(bone ? 0x3a2f22 : 0xd9b77a);
    gsap.to(this.dustMat.color, { r: c.r, g: c.g, b: c.b, duration: 1 });
    gsap.to(this.dustMat, { opacity: bone ? .35 : .55, duration: 1 });
    gsap.to(this.renderer, { toneMappingExposure: bone ? .95 : 1.05, duration: 1 });
  }
  setAccent(hex, gsap, d = .8) {
    const c = new THREE.Color(hex);
    gsap.to(this.threadMat.color, { r: c.r, g: c.g, b: c.b, duration: d });
    gsap.to(this.threadMat.emissive, { r: c.r * .18, g: c.g * .18, b: c.b * .18, duration: d });
  }

  render(t, dt, scrollVel = 0) {
    this.mouseSmooth.lerp(this.mouse, .05);
    this.camera.position.x = this.mouseSmooth.x * .22;
    this.camera.position.y = this.mouseSmooth.y * .14;
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();

    this.updateThread(t);
    this.updateTape(t);
    this.updateCloth(t, dt);
    this.updateSpools(t, dt);
    this.updateDust(dt, scrollVel);
    this.renderer.render(this.scene, this.camera);
  }
}
