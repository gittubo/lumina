// The Scales — a procedural brass balance that tips with the facts the visitor places on it.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const brass = (rough = .28) => new THREE.MeshStandardMaterial({ color: 0xd0a35c, metalness: 1, roughness: rough, envMapIntensity: 1.25 });

function lathe(points, seg = 64) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg);
}

export function createScales(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .03).texture;

  const camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
  camera.position.set(0, 3.1, 11.5);
  camera.lookAt(0, 2.5, 0);

  const key = new THREE.SpotLight(0xffe2b0, 120, 30, .6, .5, 1.4); key.position.set(3, 9, 6); scene.add(key);
  const fill = new THREE.PointLight(0xb35a3c, 14, 20); fill.position.set(-5, 2, 3); scene.add(fill);
  scene.add(new THREE.AmbientLight(0xffe6c8, .15));

  const rig = new THREE.Group(); scene.add(rig);
  const mat = brass(), matDark = brass(.45); matDark.color.set(0x8a6a3a);
  const wood = new THREE.MeshStandardMaterial({ color: 0x3b1612, roughness: .35, metalness: .05 });

  // walnut base and brass foot
  const baseWood = new THREE.Mesh(lathe([[0, 0], [1.9, 0], [1.95, .08], [1.85, .28], [1.5, .36], [0, .36]]), wood);
  rig.add(baseWood);
  const foot = new THREE.Mesh(lathe([[0, .36], [1.1, .36], [1.1, .44], [.7, .52], [.45, .7], [.28, .95], [.22, 1.2], [0, 1.2]]), mat);
  rig.add(foot);
  // column with knops
  const column = new THREE.Mesh(new THREE.CylinderGeometry(.11, .14, 3.4, 32), mat); column.position.y = 2.9; rig.add(column);
  [1.4, 2.4, 3.6].forEach(y => { const k = new THREE.Mesh(new THREE.SphereGeometry(.2, 32, 16), mat); k.scale.y = .55; k.position.y = y; rig.add(k); });
  const finial = new THREE.Mesh(lathe([[0, 0], [.14, 0], [.2, .1], [.12, .3], [.05, .55], [0, .7]]), mat); finial.position.y = 4.85; rig.add(finial);

  // beam on its pivot
  const pivot = new THREE.Group(); pivot.position.y = 4.65; rig.add(pivot);
  const beamLen = 3.2;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, beamLen * 2, 16), mat); beam.rotation.z = Math.PI / 2; pivot.add(beam);
  const hub = new THREE.Mesh(new THREE.TorusGeometry(.22, .05, 12, 48), mat); pivot.add(hub);
  const needle = new THREE.Mesh(new THREE.ConeGeometry(.05, .7, 12), mat); needle.position.y = .5; pivot.add(needle);
  [-1, 1].forEach(s => {
    const collar = new THREE.Mesh(new THREE.SphereGeometry(.07, 16, 12), mat); collar.position.x = s * 1.6; pivot.add(collar);
    const taper = new THREE.Mesh(new THREE.CylinderGeometry(.02, .075, 1.4, 16), mat); taper.rotation.z = s * Math.PI / 2; taper.position.x = s * .85; pivot.add(taper);
    const end = new THREE.Mesh(new THREE.SphereGeometry(.09, 16, 12), mat); end.position.x = s * beamLen; pivot.add(end);
  });

  // pans with chains
  const pans = [-1, 1].map(s => {
    const g = new THREE.Group(); rig.add(g);
    const dish = new THREE.Mesh(lathe([[0, 0], [.95, .05], [1.12, .22], [1.18, .3], [1.12, .3], [1.0, .2], [.8, .1], [0, .08]]), mat);
    dish.position.y = -2.6; g.add(dish);
    const chains = new THREE.Group(); g.add(chains);
    const linkGeo = new THREE.TorusGeometry(.045, .012, 6, 12);
    for (let c = 0; c < 3; c++) {
      const a = c / 3 * Math.PI * 2 + .4;
      const bottom = new THREE.Vector3(Math.cos(a) * 1.08, -2.32, Math.sin(a) * 1.08);
      const dir = bottom.clone(); const len = dir.length(); dir.normalize();
      const n = Math.floor(len / .085);
      for (let i = 0; i < n; i++) {
        const l = new THREE.Mesh(linkGeo, matDark);
        l.position.copy(dir).multiplyScalar(i * .085 + .04);
        l.lookAt(l.position.clone().add(dir)); l.rotateZ(i % 2 ? Math.PI / 2 : 0);
        chains.add(l);
      }
    }
    const weights = new THREE.Group(); weights.position.y = -2.5; g.add(weights);
    return { group: g, side: s, weights };
  });

  // shadow-catcher glow under the scales
  const glow = new THREE.Mesh(new THREE.CircleGeometry(3.4, 64), new THREE.MeshBasicMaterial({ color: 0xc9a466, transparent: true, opacity: .07 }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = .001; rig.add(glow);

  rig.position.y = -.2;

  /* physics */
  const state = { angle: 0, vel: 0, target: 0, rotY: -.35, rotYTarget: -.35, drag: false, lastX: 0, inView: true };
  const tmp = new THREE.Vector3();

  function addWeight(side, w, id) {
    const pan = pans[side === 'for' ? 0 : 1];
    const h = .1 + w * .12, r = .26 + w * .06;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * .92, r, h, 32), side === 'for' ? brass(.2) : new THREE.MeshStandardMaterial({ color: 0x7a2c22, metalness: .4, roughness: .3 }));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(r * .32, 16, 12), m.material); knob.position.y = h / 2 + r * .12; m.add(knob);
    m.userData = { id, h, vy: 0, y: 3.5 };
    m.position.set(0, 3.5, 0);
    m.rotation.y = Math.random() * Math.PI;
    pan.weights.add(m);
    state.vel += (side === 'for' ? 1 : -1) * .05; // impact jolt
  }
  function removeWeight(id) {
    pans.forEach(p => p.weights.children.slice().forEach(m => { if (m.userData.id === id) p.weights.remove(m); }));
  }
  function setBalance(forW, againstW) {
    const d = forW - againstW;
    state.target = THREE.MathUtils.clamp(d * .14, -.36, .36);
  }

  /* interaction */
  canvas.addEventListener('pointerdown', e => { state.drag = true; state.lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (!state.drag) return; state.rotYTarget += (e.clientX - state.lastX) * .008; state.lastX = e.clientX; });
  const end = () => { state.drag = false; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.style.touchAction = 'pan-y';

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize(); window.addEventListener('resize', resize);
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([en]) => { state.inView = en.isIntersecting; }).observe(canvas);

  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 1 / 30);
    if (!state.inView) return;
    const t = clock.elapsedTime;
    // damped spring towards target, plus a breath of idle sway
    const goal = state.target + Math.sin(t * .9) * .012;
    state.vel += (goal - state.angle) * 18 * dt;
    state.vel *= Math.pow(.12, dt);
    state.angle += state.vel;
    pivot.rotation.z = state.angle;
    if (!state.drag) state.rotYTarget += dt * .06;
    state.rotY += (state.rotYTarget - state.rotY) * .08;
    rig.rotation.y = state.rotY;
    pans.forEach(p => {
      tmp.set(p.side * beamLen, 0, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), state.angle).add(pivot.position);
      p.group.position.copy(tmp);
      p.group.rotation.z = -state.vel * 2.2; // pendulum lag
      let stack = 0;
      p.weights.children.forEach(m => {
        const u = m.userData; const rest = stack + u.h / 2 + .06;
        if (u.y > rest) { u.vy -= 22 * dt; u.y += u.vy * dt; if (u.y <= rest) { u.y = rest; u.vy = -u.vy * .25; } }
        m.position.y = u.y; stack += u.h * .9;
      });
    });
    renderer.render(scene, camera);
  }
  frame();

  return { addWeight, removeWeight, setBalance };
}
