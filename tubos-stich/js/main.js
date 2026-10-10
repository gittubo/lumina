/* =========================================================
   Tubo's Stich — story director
   ========================================================= */
import { Atelier } from './scene.js';
import { FrameSequence } from './sequence.js';

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ---------------------------------------------------------
   Themes — the page breathes between ink and bone
   --------------------------------------------------------- */
const THEMES = {
  ink: { '--bg': '#0c0b0a', '--fg': '#efe7da', '--muted': 'rgba(239,231,218,0.56)', '--line': 'rgba(239,231,218,0.16)', '--vig': 0.55 },
  bone: { '--bg': '#efe7da', '--fg': '#15120f', '--muted': 'rgba(21,18,15,0.6)', '--line': 'rgba(21,18,15,0.17)', '--vig': 0.1 },
};
const THREADS = [
  ['Brass', '#d4a85a'], ['Vermilion', '#e8541f'], ['Saffron', '#e9a227'], ['Blush', '#e9b7bf'],
  ['Powder Blue', '#8ccbe0'], ['Ultramarine', '#2b3fb8'], ['Clay', '#b2654a'], ['Bottle Green', '#2f3d33'],
];
const FABRICS = [
  { name: 'Midnight Wool', weight: '260 g/m²', weave: 'Twill, Super 120s', use: 'Suits · Overcoats' },
  { name: 'Storm Satin', weight: '140 g/m²', weave: 'Satin, silk blend', use: 'Gowns · Linings' },
  { name: 'Ivory Linen', weight: '190 g/m²', weave: 'Plain weave', use: 'Summer suits · Shirts' },
  { name: 'Ember Velvet', weight: '320 g/m²', weave: 'Cut pile', use: 'Evening jackets' },
  { name: 'Olive Tweed', weight: '420 g/m²', weave: 'Herringbone', use: 'Jackets · Waistcoats' },
];
// frame where each beat of the film begins (20 fps, 240 frames)
const BEATS = [0, 21, 42, 82, 113, 167];

/* ---------------------------------------------------------
   Film grain (generated, no image request)
   --------------------------------------------------------- */
(function grain() {
  const c = document.createElement('canvas'); c.width = c.height = 180;
  const g = c.getContext('2d'), d = g.createImageData(180, 180);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0);
  root.style.setProperty('--grain', `url(${c.toDataURL()})`);
})();

/* ---------------------------------------------------------
   Text splitting
   --------------------------------------------------------- */
$$('[data-split]').forEach((el) => {
  el.innerHTML = [...el.textContent].map((ch) => `<span class="ch">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
});
$$('[data-words]').forEach((el) => {
  el.innerHTML = el.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ');
});

/* ---------------------------------------------------------
   Smooth scroll
   --------------------------------------------------------- */
let lenis = null;
if (!reduced && Lenis) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, touchMultiplier: 1.3 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
const scrollTo = (target) => {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: 2.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
};
$$('[data-scroll-to]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); scrollTo(a.dataset.scrollTo); }));

/* ---------------------------------------------------------
   3D atelier
   --------------------------------------------------------- */
let scene = null;
try {
  scene = new Atelier($('#webgl'), { reduced });
} catch (err) {
  console.warn('WebGL unavailable — continuing without the 3D layer.', err);
  $('#webgl').style.display = 'none';
}

/* ---------------------------------------------------------
   Sound: the atelier soundtrack + tiny UI ticks
   --------------------------------------------------------- */
const sound = (() => {
  const audio = $('.soundtrack'), btn = $('.nav__sound'), label = $('.nav__sound-label');
  let on = false, ctx = null;
  const set = (v) => {
    on = v;
    btn.setAttribute('aria-pressed', String(on));
    label.textContent = on ? 'Sound on' : 'Sound off';
    if (on) {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      audio.volume = 0; audio.play().catch(() => {});
      gsap.to(audio, { volume: 0.5, duration: 1.4 });
    } else {
      gsap.to(audio, { volume: 0, duration: 0.6, onComplete: () => audio.pause() });
    }
  };
  btn.addEventListener('click', () => set(!on));
  // a soft "stitch" click — filtered noise burst
  const tick = (pitch = 1) => {
    if (!on || !ctx) return;
    const len = 0.05, buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400 * pitch; f.Q.value = 3;
    const g = ctx.createGain(); g.gain.value = 0.35;
    src.connect(f).connect(g).connect(ctx.destination); src.start();
  };
  return { tick, get on() { return on; } };
})();

/* ---------------------------------------------------------
   Theme + chapter tracking
   --------------------------------------------------------- */
let currentTheme = 'ink';
const metaTheme = $('meta[name="theme-color"]');
function setTheme(name) {
  if (name === currentTheme) return;
  currentTheme = name;
  gsap.to(root, { ...THEMES[name], duration: 1.1, ease: 'power2.inOut', overwrite: 'auto' });
  metaTheme?.setAttribute('content', THEMES[name]['--bg']);
  scene?.setTheme(name, gsap);
}
const chapterNum = $('.nav__chapter-num'), chapterName = $('.nav__chapter-name');
const rulerLinks = $$('.ruler__chapters a');
let currentChapter = '';
function setChapter(sec) {
  const [num, name] = sec.dataset.chapter.split('|');
  if (sec.dataset.chapter === currentChapter) return;
  currentChapter = sec.dataset.chapter;
  gsap.to([chapterNum, chapterName], {
    yPercent: -100, opacity: 0, duration: 0.25, stagger: 0.04, ease: 'power2.in',
    onComplete: () => {
      chapterNum.textContent = num.length < 2 ? num.padStart(2, '0') : num;
      chapterName.textContent = name;
      gsap.fromTo([chapterNum, chapterName], { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: 'power3.out' });
    },
  });
  const id = sec.id === 'finale' ? 'book' : sec.id === 'hero' ? 'top' : sec.id;
  rulerLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${id}`));
}
$$('[data-theme]').forEach((sec) => {
  ScrollTrigger.create({
    trigger: sec, start: 'top 55%', end: 'bottom 55%',
    onToggle: (self) => { if (self.isActive) { setTheme(sec.dataset.theme); setChapter(sec); } },
  });
});

/* ---------------------------------------------------------
   Reveals
   --------------------------------------------------------- */
function initReveals() {
  $$('.display').forEach((d) => {
    if (d.closest('.form__done')) return;
    gsap.from($$('.line > span', d), {
      yPercent: 108, rotate: 2.5, duration: 1.3, ease: 'expo.out', stagger: 0.09,
      scrollTrigger: { trigger: d, start: 'top 84%', once: true },
    });
  });
  $$('.reveal').forEach((el) => {
    if (el.closest('.hero')) return;
    gsap.from(el, { y: 36, opacity: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });
  $$('.reveal-card').forEach((el) => {
    const media = el.querySelector('video, img');
    gsap.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: 'expo.inOut', scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
    if (media) gsap.fromTo(media, { scale: 1.25 }, { scale: 1, duration: 2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
  });
  $$('.chapter-tag').forEach((el) => {
    gsap.from(el.children, { opacity: 0, x: -16, duration: 0.9, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });

  // manifesto: words light up as the thread is sewn
  const words = $$('.manifesto__text .w');
  gsap.to(words, {
    opacity: 1, stagger: 0.5, ease: 'none',
    scrollTrigger: { trigger: '#thread', start: 'top 20%', end: 'bottom 85%', scrub: 0.6 },
  });

  // measurement counters
  $$('[data-count]').forEach((b, i) => {
    const target = parseFloat(b.dataset.count), dec = target % 1 ? 1 : 0, o = { v: 0 };
    gsap.to(o, {
      v: target, duration: 1.8, delay: i * 0.08, ease: 'power3.out',
      onUpdate: () => { b.textContent = o.v.toFixed(dec); },
      scrollTrigger: { trigger: b, start: 'top 92%', once: true },
    });
  });

  // tape band marquee, nudged by scroll velocity
  const track = $('.tape-band__track');
  const marquee = gsap.to(track, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 });
  gsap.to('.tape-band__strip', { rotate: -1, ease: 'none', scrollTrigger: { trigger: '.tape-band', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.ticker.add(() => {
    const v = lenis ? lenis.velocity : 0;
    marquee.timeScale(gsap.utils.interpolate(marquee.timeScale(), 1 + Math.abs(v) * 0.25, 0.1));
  });

  // fitting
  gsap.from('.pin', { opacity: 0, y: 20, duration: 1, stagger: 0.18, ease: 'power3.out', scrollTrigger: { trigger: '.fitting__figure', start: 'top 70%', once: true } });
  gsap.from('.fitting__lines path', { opacity: 0, duration: 1.4, stagger: 0.18, scrollTrigger: { trigger: '.fitting__figure', start: 'top 70%', once: true } });
  gsap.fromTo('.fitting__img img', { yPercent: 6 }, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: '.fitting__figure', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from('.service', { opacity: 0, y: 40, duration: 1.1, stagger: 0.12, ease: 'power3.out', scrollTrigger: { trigger: '.services', start: 'top 80%', once: true } });
  gsap.to('.process__steps', { '--p': 1, ease: 'none', scrollTrigger: { trigger: '.process', start: 'top 85%', end: 'top 45%', scrub: true } });

  // measure photo parallax
  gsap.fromTo('.measure__photo', { y: 80 }, { y: -60, ease: 'none', scrollTrigger: { trigger: '.measure__grid', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.fromTo('.palette__film', { y: 60 }, { y: -60, ease: 'none', scrollTrigger: { trigger: '.palette__grid', start: 'top bottom', end: 'bottom top', scrub: true } });

  // hero drifts away
  gsap.to('.hero__title', { yPercent: -18, opacity: 0.15, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__top, .hero__bottom', { opacity: 0, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: '40% top', scrub: true } });
}

/* ---------------------------------------------------------
   Chapter III — fabric swatches
   --------------------------------------------------------- */
const swatches = $$('.swatch');
swatches.forEach((sw) => sw.addEventListener('click', () => {
  const i = +sw.dataset.fabric;
  swatches.forEach((s) => { s.classList.toggle('is-active', s === sw); s.setAttribute('aria-checked', String(s === sw)); });
  scene?.setFabric(i, gsap);
  sound.tick(1.2);
  const spec = FABRICS[i];
  $$('[data-spec]').forEach((dd, k) => {
    gsap.to(dd, {
      opacity: 0, y: -8, duration: 0.2, delay: k * 0.04,
      onComplete: () => { dd.textContent = spec[dd.dataset.spec]; gsap.fromTo(dd, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }); },
    });
  });
}));

/* ---------------------------------------------------------
   Chapter V — the thread palette (DOM list ⇄ 3D spools)
   --------------------------------------------------------- */
const threadItems = $$('.threads li');
let chosen = 0;
function previewThread(i) {
  if (scene) scene.highlight = i;
  threadItems.forEach((li, k) => li.classList.toggle('is-hover', k === i));
}
function chooseThread(i) {
  chosen = i;
  const [name, hex] = THREADS[i];
  gsap.to(root, { '--accent': hex, duration: 0.8 });
  scene?.setAccent(hex, gsap);
  threadItems.forEach((li, k) => { li.classList.toggle('is-active', k === i); li.setAttribute('aria-selected', String(k === i)); });
  $('.book__thread-name').textContent = name;
  sound.tick(0.8);
}
threadItems.forEach((li, i) => {
  li.addEventListener('pointerenter', () => { previewThread(i); sound.tick(1 + i * 0.06); });
  li.addEventListener('pointerleave', () => previewThread(-1));
  li.addEventListener('click', () => chooseThread(i));
  li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseThread(i); } });
  li.addEventListener('focus', () => previewThread(i));
  li.addEventListener('blur', () => previewThread(-1));
});
threadItems[0].classList.add('is-active');
threadItems[0].setAttribute('aria-selected', 'true');
if (scene) {
  scene.onSpoolHover = (i) => {
    threadItems.forEach((li, k) => li.classList.toggle('is-hover', k === i));
    cursor.setLabel(i >= 0 ? THREADS[i][0] : null);
    if (i >= 0) sound.tick(1 + i * 0.06);
  };
  scene.onSpoolClick = (i) => chooseThread(i);
}

/* ---------------------------------------------------------
   Chapter IV — the scroll-scrubbed film
   --------------------------------------------------------- */
const making = (() => {
  const section = $('#making');
  const beats = $$('.beat'), steps = $$('.making__timeline li');
  const line = $('.making__timeline-line span');
  const tc = $('.hud__tc'), fr = $('.hud__frame b');
  const seq = new FrameSequence({
    canvas: $('.making__canvas'), bg: $('.making__bg'), count: 240,
    path: (n) => `assets/seq/f${String(n).padStart(3, '0')}.webp`,
  });
  let target = 0, current = 0, beat = 0;
  ScrollTrigger.create({ trigger: section, start: 'top top', end: 'bottom bottom', onUpdate: (s) => { target = s.progress; } });

  beats.forEach((b, i) => { if (i) gsap.set(b, { opacity: 0, y: 40 }); });
  const showBeat = (i) => {
    if (i === beat) return;
    const dir = i > beat ? 1 : -1;
    gsap.to(beats[beat], { opacity: 0, y: -40 * dir, duration: 0.45, ease: 'power2.in', overwrite: true });
    gsap.fromTo(beats[i], { opacity: 0, y: 50 * dir }, { opacity: 1, y: 0, duration: 0.9, delay: 0.25, ease: 'expo.out', overwrite: true });
    gsap.fromTo($$('.beat__title, .beat__body', beats[i]), { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 1, delay: 0.25, stagger: 0.08, ease: 'expo.out' });
    beats.forEach((b, k) => b.classList.toggle('is-active', k === i));
    steps.forEach((s, k) => s.classList.toggle('is-active', k <= i));
    beat = i;
    sound.tick(0.7);
  };
  const pad = (n) => String(n).padStart(2, '0');
  return {
    seq,
    update() {
      const k = 1 - Math.pow(1 - 0.18, Math.min(4, gsap.ticker.deltaRatio()));
      current += (target - current) * k;
      if (Math.abs(target - current) < 0.0005) current = target;
      const f = seq.set(current);
      line.style.transform = `scaleX(${current})`;
      let b = 0; for (let k = 0; k < BEATS.length; k++) if (f >= BEATS[k]) b = k;
      showBeat(b);
      const abs = f + 68; // the film starts 3.4 s in
      tc.textContent = `00:00:${pad(Math.floor(abs / 20))}:${pad(abs % 20)}`;
      fr.textContent = String(f + 1).padStart(3, '0');
    },
  };
})();

/* ---------------------------------------------------------
   Cursor — a needle trailing a thread
   --------------------------------------------------------- */
const cursor = (() => {
  const el = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('.cursor__label');
  const cv = $('#cursor-thread'), g = cv.getContext('2d');
  const pos = { x: innerWidth / 2, y: innerHeight / 2 }, rp = { ...pos };
  let shown = false, forced = null, hoverLabel = null;
  const N = 20, REST = 6.5;
  const pts = Array.from({ length: N }, () => ({ x: pos.x, y: pos.y, px: pos.x, py: pos.y }));
  let accent = '#d4a85a';
  const size = () => { const d = Math.min(devicePixelRatio || 1, 2); cv.width = innerWidth * d; cv.height = innerHeight * d; g.setTransform(d, 0, 0, d, 0, 0); };
  if (finePointer) {
    root.classList.add('has-cursor');
    size(); addEventListener('resize', size);
    addEventListener('pointermove', (e) => { pos.x = e.clientX; pos.y = e.clientY; if (!shown) { shown = true; gsap.to(el, { opacity: 1, duration: 0.4 }); } }, { passive: true });
    document.addEventListener('pointerleave', () => { shown = false; gsap.to(el, { opacity: 0, duration: 0.3 }); });
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-cursor], a, button, label.chip, input, textarea');
      hoverLabel = t ? (t.dataset.cursor || '') : null;
      apply();
    });
    gsap.set(el, { opacity: 0 });
  }
  function apply() {
    const l = forced ?? hoverLabel;
    el.classList.toggle('is-hover', !!l);
    el.classList.toggle('is-link', l === '');
    label.textContent = l || '';
  }
  return {
    setLabel(l) { forced = l; apply(); },
    update() {
      if (!finePointer) return;
      rp.x += (pos.x - rp.x) * 0.16; rp.y += (pos.y - rp.y) * 0.16;
      dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      ring.style.transform = `translate3d(${rp.x}px, ${rp.y}px, 0)`;
      // verlet rope
      pts[0].x = pos.x; pts[0].y = pos.y;
      for (let i = 1; i < N; i++) {
        const p = pts[i], vx = (p.x - p.px) * 0.95, vy = (p.y - p.py) * 0.95;
        p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + 0.42;
      }
      for (let k = 0; k < 6; k++) {
        pts[0].x = pos.x; pts[0].y = pos.y;
        for (let i = 1; i < N; i++) {
          const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, diff = (d - REST) / d;
          if (i > 1) { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
          else { b.x -= dx * diff; b.y -= dy * diff; }
        }
      }
      g.clearRect(0, 0, innerWidth, innerHeight);
      if (!shown) return;
      accent = getComputedStyle(root).getPropertyValue('--accent').trim() || accent;
      g.strokeStyle = accent; g.lineWidth = 1.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < N - 1; i++) { const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2; g.quadraticCurveTo(pts[i].x, pts[i].y, mx, my); }
      g.lineTo(pts[N - 1].x, pts[N - 1].y);
      g.stroke();
      g.fillStyle = accent; g.beginPath(); g.arc(pts[N - 1].x, pts[N - 1].y, 2.2, 0, Math.PI * 2); g.fill();
    },
  };
})();

/* ---------------------------------------------------------
   Videos play only when on screen
   --------------------------------------------------------- */
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause();
}), { threshold: 0.15 });
$$('video[data-autoplay]').forEach((v) => io.observe(v));

/* ---------------------------------------------------------
   Booking form (front-end only for the concept)
   --------------------------------------------------------- */
$('.form').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  let ok = true;
  $$('input[required]', form).forEach((inp) => {
    const bad = !inp.value.trim() || (inp.type === 'email' && !/^\S+@\S+\.\S+$/.test(inp.value));
    inp.closest('.field').classList.toggle('is-invalid', bad);
    if (bad) ok = false;
  });
  if (!ok) { gsap.fromTo(form, { x: -8 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' }); sound.tick(0.5); return; }
  form.classList.add('is-sent');
  gsap.from($$('.form__done > *', form), { y: 24, opacity: 0, duration: 1, stagger: 0.12, ease: 'expo.out' });
  sound.tick(1.4);
});

/* ---------------------------------------------------------
   Side ruler + loop
   --------------------------------------------------------- */
const rulerNeedle = $('.ruler__needle'), rulerTrack = $('.ruler__track');
const counter = $('.manifesto__counter b');
let lastStitch = -1;
gsap.ticker.add((time, deltaMs) => {
  const dt = Math.min(deltaMs / 1000, 0.05);
  const max = document.documentElement.scrollHeight - innerHeight;
  const p = clamp(scrollY / Math.max(1, max));
  rulerNeedle.style.transform = `translateY(${p * rulerTrack.clientHeight}px)`;
  if (scene) {
    scene.render(time, dt, lenis ? lenis.velocity : 0);
    if (scene.stitches !== lastStitch) {
      counter.textContent = String(scene.stitches).padStart(4, '0');
      if (Math.floor(scene.stitches / 40) !== Math.floor(lastStitch / 40)) sound.tick(1.6);
      lastStitch = scene.stitches;
    }
  }
  making.update();
  cursor.update();
});

/* ---------------------------------------------------------
   Preloader — threading the needle, then the cut
   --------------------------------------------------------- */
async function boot() {
  const num = $('.loader__num'), fill = $('.loader__ruler-fill'), thread = $('.loader__thread');
  const shown = { v: 0 };
  let real = 0;
  const jobs = [];
  const track = (p) => p.then(() => { real += 1 / jobs.length; });
  jobs.push(track(document.fonts ? document.fonts.ready : Promise.resolve()));
  const first = []; for (let i = 0; i < 240; i += 8) first.push(i);
  first.forEach((i) => jobs.push(track(making.seq.loadFrame(i))));
  jobs.push(track(new Promise((r) => setTimeout(r, 1400)))); // let the needle be threaded properly

  const counterTween = gsap.ticker.add(() => {
    shown.v += (real - shown.v) * 0.08;
    const v = Math.min(100, Math.round(shown.v * 100));
    num.textContent = String(v).padStart(3, '0');
    fill.style.width = `${shown.v * 100}%`;
    thread.style.strokeDashoffset = String(700 * (1 - shown.v));
  });
  await Promise.all(jobs);
  await new Promise((r) => gsap.to(shown, { v: 1, duration: 0.5, ease: 'power2.out', onComplete: r }));
  gsap.ticker.remove(counterTween);
  num.textContent = '100';
  making.seq.loadAll();

  const loader = $('.loader');
  const tl = gsap.timeline({
    onComplete: () => {
      loader.remove();
      document.body.classList.remove('is-loading');
      lenis?.start();
      ScrollTrigger.refresh();
    },
  });
  tl.to('.loader__inner', { opacity: 0, scale: 0.96, duration: 0.6, ease: 'power2.in' })
    .add(() => loader.querySelectorAll('.loader__half').forEach((h) => h.classList.add('is-cut')))
    .to('.loader__half--top', { yPercent: -100, duration: 1.4, ease: 'expo.inOut' }, '+=0.35')
    .to('.loader__half--bottom', { yPercent: 100, duration: 1.4, ease: 'expo.inOut' }, '<')
    .add(heroIntro, '-=0.9');
}

// hidden until the curtain opens
gsap.set('.hero__title .ch', { yPercent: 115, rotate: 8 });
gsap.set('.hero__top > *, .hero__lede, .hero__scroll', { opacity: 0, y: 20 });
gsap.set('.nav > *', { opacity: 0, y: -16 });
gsap.set('.ruler', { opacity: 0, x: 20 });

function heroIntro() {
  const tl = gsap.timeline();
  tl.to('.hero__title .ch', { yPercent: 0, rotate: 0, duration: 1.6, ease: 'expo.out', stagger: 0.045 })
    .to('.hero__top > *, .hero__lede, .hero__scroll', { opacity: 1, y: 0, duration: 1.2, stagger: 0.08, ease: 'power3.out' }, 0.5)
    .to('.nav > *', { opacity: 1, y: 0, duration: 1, stagger: 0.08, ease: 'power3.out' }, 0.4)
    .to('.ruler', { opacity: 1, x: 0, duration: 1, ease: 'power3.out' }, 0.8);
  if (scene) tl.to(scene, { intro: 1, duration: 3.2, ease: 'power2.inOut' }, 0);
}

initReveals();
boot();
addEventListener('load', () => ScrollTrigger.refresh());
