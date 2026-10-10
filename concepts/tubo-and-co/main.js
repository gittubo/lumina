// Tubo & Co. — scroll choreography, preloader and interactions.
const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

document.body.classList.add('is-loading');

/* ---------- smooth scroll ---------- */
let lenis = null;
if (!reduced && window.Lenis) {
  lenis = new window.Lenis({ lerp: .085, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const id = a.getAttribute('href');
  const el = id === '#top' ? document.body : $(id);
  if (!el) return;
  e.preventDefault();
  lenis ? lenis.scrollTo(el, { duration: 2, offset: 0 }) : el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}));

/* ---------- split helpers ---------- */
function splitChars(el) {
  const text = el.textContent; el.textContent = '';
  return [...text].map(ch => { const s = document.createElement('span'); s.className = 'char'; s.textContent = ch; el.appendChild(s); return s; });
}
function splitWords(el) {
  const words = el.innerHTML.trim().split(/\s+/);
  el.innerHTML = words.map(w => `<span class="w">${w}</span>`).join(' ');
  return $$('.w', el);
}

/* ---------- autoplay videos only when on screen ---------- */
const vio = new IntersectionObserver(entries => entries.forEach(en => {
  const v = en.target;
  if (en.isIntersecting) { v.play().catch(() => {}); } else v.pause();
}), { rootMargin: '20% 0px' });
$$('video[data-autoplay]').forEach(v => vio.observe(v));

/* ---------- the hall (WebGL hero) ---------- */
const justiceVideo = $('#justiceVideo');
let hall = null;
const hallReady = (async () => {
  try {
    const t = document.createElement('canvas');
    if (!(t.getContext('webgl2') || t.getContext('webgl'))) throw new Error('no webgl');
    const { createHall } = await import('./hall.js');
    hall = createHall($('#hall'), { video: justiceVideo });
    justiceVideo.play().catch(() => {});
  } catch (err) {
    console.warn('Hall fallback:', err);
    document.documentElement.classList.add('no-webgl');
  }
})();

/* ---------- preloader ---------- */
const heroChars = $$('[data-split]', $('.hero__h1')).flatMap(splitChars);
const loader = { v: 0 };
const counter = $('#loaderCount'), bar = $('#loaderBar');
const waitVideo = new Promise(res => {
  if (justiceVideo.readyState >= 3) return res();
  justiceVideo.addEventListener('canplay', res, { once: true });
  setTimeout(res, 4500);
});
const assetsReady = Promise.all([document.fonts ? document.fonts.ready : Promise.resolve(), hallReady, waitVideo]);

gsap.to('.loader__mark span', { opacity: 1, y: 0, duration: 1, stagger: .06, ease: 'power3.out', delay: .15 });
const fill = gsap.to(loader, {
  v: 88, duration: 2.2, ease: 'power2.out',
  onUpdate() { counter.textContent = String(Math.round(loader.v)).padStart(3, '0'); bar.style.transform = `scaleX(${loader.v / 100})`; }
});

assetsReady.then(() => {
  fill.kill();
  gsap.to(loader, {
    v: 100, duration: .6, ease: 'power1.inOut',
    onUpdate() { counter.textContent = String(Math.round(loader.v)).padStart(3, '0'); bar.style.transform = `scaleX(${loader.v / 100})`; },
    onComplete: reveal
  });
});

function reveal() {
  const tl = gsap.timeline({ onComplete() { $('#loader').remove(); } });
  tl.to('.loader__inner', { opacity: 0, y: -20, duration: .6, ease: 'power2.in' })
    .to('.loader__curtain--l', { xPercent: -101, duration: 1.4, ease: 'expo.inOut' }, '-=.1')
    .to('.loader__curtain--r', { xPercent: 101, duration: 1.4, ease: 'expo.inOut' }, '<')
    .add(() => {
      document.body.classList.remove('is-loading');
      lenis && lenis.start();
      if (hall) gsap.to(hall.state, { intro: 1, duration: 3.2, ease: 'expo.out' });
    }, '<.1')
    .from(heroChars, { yPercent: 110, rotate: 6, duration: 1.4, stagger: .05, ease: 'expo.out' }, '<.4')
    .from('.hero__eyebrow, .hero__lede, .hero__meta, .hero__scroll, .hero__docket, .nav', { opacity: 0, y: 20, duration: 1.2, stagger: .08, ease: 'power3.out' }, '<.4');
}
if (reduced) { gsap.set(loader, { v: 100 }); }

/* ---------- hero scroll ---------- */
const docket = $('#docketNo');
ScrollTrigger.create({
  trigger: '#hero', start: 'top top', end: 'bottom bottom', scrub: true,
  onUpdate(self) {
    const p = self.progress;
    hall && hall.setProgress(p);
    docket.textContent = `TC/1998/${String(1 + Math.floor(p * 1239)).padStart(4, '0')}`;
  },
  onToggle(self) { hall && hall.setVisible(self.isActive || self.progress < 1); }
});
ScrollTrigger.create({
  trigger: '#hero', start: 'top top', end: 'bottom top',
  onLeave() { hall && hall.setVisible(false); }, onEnterBack() { hall && hall.setVisible(true); }
});
if (!reduced) {
  gsap.timeline({ scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom bottom', scrub: 1 } })
    .to('.hero__title', { y: -120, opacity: 0, ease: 'none', duration: .3 }, 0)
    .to('.hero__meta, .hero__scroll', { opacity: 0, duration: .2 }, 0)
    .fromTo('#heroOath', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: .2 }, .45)
    .to('#heroOath', { opacity: 0, y: -40, duration: .15 }, .85);
}

/* ---------- nav ---------- */
const nav = $('#nav'); let lastY = 0;
ScrollTrigger.create({
  start: 0, end: 'max',
  onUpdate(self) {
    const y = self.scroll();
    nav.classList.toggle('is-scrolled', y > 60);
    nav.classList.toggle('is-hidden', y > lastY && y > 400);
    lastY = y;
  }
});

/* ---------- manifesto ---------- */
const mWords = splitWords($('#manifestoText'));
if (!reduced) {
  gsap.to(mWords, {
    color: '#ece6da', stagger: .1, ease: 'none',
    scrollTrigger: { trigger: '.manifesto', start: 'top 70%', end: 'bottom 75%', scrub: true }
  });
  gsap.fromTo('.manifesto__statue', { yPercent: 18, rotate: -3 }, { yPercent: -10, rotate: 2, ease: 'none', scrollTrigger: { trigger: '.manifesto', start: 'top bottom', end: 'bottom top', scrub: true } });
  const sig = $('#sigPath'); const L = sig.getTotalLength();
  gsap.fromTo(sig, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 2.4, ease: 'power2.inOut', scrollTrigger: { trigger: '.manifesto__sig', start: 'top 85%' } });
}

/* ---------- corridor: arch opens into the corridor ---------- */
if (!reduced) {
  gsap.timeline({ scrollTrigger: { trigger: '#corridor', start: 'top top', end: 'bottom bottom', scrub: 1 } })
    .fromTo('#corridorFrame', { clipPath: 'inset(22% 38% 14% 38% round 50vw 50vw 0vw 0vw)' }, { clipPath: 'inset(0% 0% 0% 0% round 0vw 0vw 0vw 0vw)', ease: 'power2.inOut', duration: .55 }, 0)
    .fromTo('#corridorFrame video', { scale: 1.35 }, { scale: 1, ease: 'none', duration: 1 }, 0)
    .to('#corridorA', { opacity: 0, y: -60, duration: .2 }, .35)
    .fromTo('#corridorB', { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: .25 }, .6)
    .from('.corridor__facts li', { opacity: 0, y: 30, stagger: .05, duration: .15 }, .7);
}

/* ---------- practice: horizontal dossier ---------- */
const track = $('#practiceTrack');
if (!reduced) {
  const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
  gsap.to(track, {
    x: () => -dist(), ease: 'none',
    scrollTrigger: {
      trigger: '.practice__pin', start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 1, invalidateOnRefresh: true,
      onUpdate(self) { $('#practiceProgress').style.transform = `scaleX(${self.progress})`; }
    }
  });
  $$('.dossier').forEach(card => {
    const img = $('img', card);
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      gsap.to(card, { rotateY: x * 10, rotateX: -y * 10, transformPerspective: 900, duration: .6, ease: 'power3.out' });
      gsap.to(img, { x: x * -16, y: y * -16, duration: .6, ease: 'power3.out' });
    });
    card.addEventListener('pointerleave', () => { gsap.to(card, { rotateY: 0, rotateX: 0, duration: 1, ease: 'elastic.out(1,.5)' }); gsap.to(img, { x: 0, y: 0, duration: 1 }); });
  });
} else {
  track.style.overflowX = 'auto';
}

/* ---------- verdict: scroll-scrubbed gavel strike ---------- */
const gavel = $('#gavelVideo');
const vLetters = $$('#verdictWord span');
const statEls = $$('#verdictStats > div');
let struck = false;
gavel.pause();
const primeGavel = () => { gavel.play().then(() => gavel.pause()).catch(() => {}); window.removeEventListener('pointerdown', primeGavel); window.removeEventListener('touchstart', primeGavel); };
window.addEventListener('pointerdown', primeGavel, { once: true });
window.addEventListener('touchstart', primeGavel, { once: true, passive: true });

function strike() {
  struck = true;
  gsap.fromTo('#verdictFlash', { opacity: .9 }, { opacity: 0, duration: 1.4, ease: 'power2.out' });
  const pin = $('#verdictPin'); pin.classList.remove('shake'); void pin.offsetWidth; pin.classList.add('shake');
  gsap.to(vLetters, { opacity: 1, y: 0, yPercent: 0, scale: 1, filter: 'blur(0px)', duration: .7, stagger: .045, ease: 'expo.out', overwrite: true });
  gsap.to(statEls, { opacity: 1, y: 0, duration: .9, stagger: .1, delay: .25, ease: 'power3.out', overwrite: true });
  $$('[data-count]').forEach(el => {
    const to = parseFloat(el.dataset.count), dec = parseInt(el.dataset.decimals || 0, 10);
    const o = { v: 0 };
    gsap.to(o, { v: to, duration: 2, delay: .3, ease: 'power3.out', onUpdate() { el.textContent = dec ? o.v.toFixed(dec) : Math.round(o.v).toLocaleString('en-US'); } });
  });
}
function unstrike() {
  struck = false;
  gsap.to(vLetters, { opacity: 0, yPercent: -60, scale: 1.4, filter: 'blur(10px)', duration: .4, stagger: .02, overwrite: true });
  gsap.to(statEls, { opacity: 0, y: 30, duration: .3, overwrite: true });
}
if (!reduced) {
  let pending = null, seeking = false, want = 0;
  const seek = t => {
    want = t;
    if (gavel.readyState < 1) return;
    if (seeking) { pending = t; return; }
    seeking = true; gavel.currentTime = t;
  };
  gavel.addEventListener('loadeddata', () => seek(want));
  gavel.addEventListener('seeked', () => { seeking = false; if (pending !== null) { const t = pending; pending = null; seek(t); } });
  ScrollTrigger.create({
    trigger: '#verdict', start: 'top top', end: 'bottom bottom', scrub: true,
    onUpdate(self) {
      const p = self.progress;
      seek(clamp(p / .5, 0, 1) * 1.32);
      if (p > .46 && !struck) strike();
      if (p < .38 && struck) unstrike();
    }
  });
} else {
  gavel.currentTime = 1.4; strike();
}

/* ---------- scales (3D, lazy) ---------- */
const scalesCanvas = $('#scalesCanvas');
let scales = null;
const scalesIO = new IntersectionObserver(async ([en]) => {
  if (!en.isIntersecting || scales) return;
  scalesIO.disconnect();
  try { const { createScales } = await import('./scales.js'); scales = createScales(scalesCanvas); syncScales(); }
  catch (e) { console.warn('Scales unavailable', e); }
}, { rootMargin: '400px 0px' });
scalesIO.observe(scalesCanvas);

const reading = $('#scalesReading');
function syncScales() {
  let f = 0, a = 0, n = 0;
  $$('.chip').forEach(c => { if (c.getAttribute('aria-pressed') === 'true') { n++; const w = parseFloat(c.dataset.w); c.dataset.side === 'for' ? f += w : a += w; } });
  scales && scales.setBalance(f, a);
  const d = f - a;
  let msg = 'Place a fact on either side.';
  if (n) {
    if (d > 1.6) msg = 'Strongly in your favour. Let’s move quickly.';
    else if (d > .3) msg = 'Leaning your way. Worth a conversation.';
    else if (d >= -.3) msg = 'In balance. The details will decide it.';
    else if (d >= -1.6) msg = 'Uphill, not lost. Strategy matters here.';
    else msg = 'Heavy against you. Call us before the deadline does.';
  }
  if (reading.textContent !== msg) {
    gsap.to(reading, { opacity: 0, y: -8, duration: .2, onComplete() { reading.textContent = msg; gsap.to(reading, { opacity: 1, y: 0, duration: .4 }); } });
  }
}
$$('.chip').forEach((c, i) => c.addEventListener('click', () => {
  const on = c.getAttribute('aria-pressed') !== 'true';
  c.setAttribute('aria-pressed', String(on));
  if (scales) on ? scales.addWeight(c.dataset.side, parseFloat(c.dataset.w), i) : scales.removeWeight(i);
  syncScales();
}));
reading.textContent = 'Place a fact on either side.';

/* ---------- method ---------- */
const stamp = $('#methodStamp'), mFrame = $('.method__frame');
$$('.method__step').forEach(step => ScrollTrigger.create({
  trigger: step, start: 'top 60%', end: 'bottom 40%',
  onToggle(self) {
    step.classList.toggle('is-active', self.isActive);
    if (self.isActive) {
      const i = +step.dataset.step;
      stamp.textContent = `Step ${i + 1} of 4`;
      mFrame.classList.toggle('show-alt', i >= 2);
    }
  }
}));

/* ---------- matters: floating evidence photo ---------- */
const float = $('#mattersFloat'), floatImg = $('#mattersFloatImg');
if (finePointer) {
  const pos = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  window.addEventListener('pointermove', e => { pos.x = e.clientX; pos.y = e.clientY; });
  gsap.ticker.add(() => { cur.x += (pos.x - cur.x) * .12; cur.y += (pos.y - cur.y) * .12; float.style.left = cur.x + 'px'; float.style.top = cur.y + 'px'; });
  $$('.matter').forEach(m => {
    m.addEventListener('pointerenter', () => { floatImg.src = m.dataset.img; float.classList.add('is-on'); });
    m.addEventListener('pointerleave', () => float.classList.remove('is-on'));
  });
}
if (!reduced) {
  gsap.from('.matter', { opacity: 0, y: 40, stagger: .08, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.matters__list', start: 'top 85%' } });
  gsap.from('.brief__media', { rotate: 6, y: 80, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.brief', start: 'top 75%' } });
}

/* ---------- testimony ---------- */
const tWords = splitWords($('#testimonyText'));
if (!reduced) {
  gsap.from(tWords, { opacity: 0, yPercent: 60, rotate: 4, stagger: .04, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.testimony', start: 'top 70%' } });
}

/* ---------- consult form ---------- */
const form = $('#consultForm'), err = $('#formError');
$('#refNo').textContent = `REF TC-${Math.floor(1000 + Math.random() * 8999)}`;
form.addEventListener('submit', e => {
  e.preventDefault();
  const missing = $$('[required]', form).filter(f => !f.value.trim() || (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(f.value)));
  if (missing.length) {
    const label = $(`label[for="${missing[0].id}"]`).textContent;
    err.textContent = missing[0].type === 'email' && missing[0].value ? 'Enter an email address like name@company.com.' : `Please fill in “${label}”.`;
    err.hidden = false; missing[0].focus(); return;
  }
  err.hidden = true;
  const done = $('#formDone'); done.hidden = false;
  gsap.from(done, { opacity: 0, scale: .96, duration: .8, ease: 'expo.out' });
});

/* ---------- cursor ---------- */
if (finePointer) {
  const c = $('#cursor'), label = $('#cursorLabel');
  const p = { x: -100, y: -100 }, s = { x: -100, y: -100 };
  window.addEventListener('pointermove', e => { p.x = e.clientX; p.y = e.clientY; c.classList.add('is-on'); });
  document.addEventListener('pointerleave', () => c.classList.remove('is-on'));
  gsap.ticker.add(() => { s.x += (p.x - s.x) * .2; s.y += (p.y - s.y) * .2; c.style.transform = `translate(${s.x}px, ${s.y}px)`; });
  $$('[data-cursor]').forEach(el => {
    el.addEventListener('pointerenter', () => { label.textContent = el.dataset.cursor; c.classList.add('is-big'); });
    el.addEventListener('pointerleave', () => c.classList.remove('is-big'));
  });
}

/* ---------- footer mark ---------- */
if (!reduced) {
  gsap.from('.footer__mark', { yPercent: 40, opacity: 0, letterSpacing: '.3em', duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '.footer', start: 'top 70%' } });
}

window.addEventListener('load', () => ScrollTrigger.refresh());
