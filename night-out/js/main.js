/* ==========================================================================
   NIGHT OUT — interaction & motion
   GSAP + ScrollTrigger + SplitText + Lenis, no build step.
   ========================================================================== */
(() => {
  'use strict';

  const { gsap, ScrollTrigger, SplitText } = window;
  gsap.registerPlugin(ScrollTrigger, SplitText);

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const pad = (n, l = 2) => String(n).padStart(l, '0');

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const DESKTOP = '(min-width: 900px)';
  const MOBILE = '(max-width: 899px)';

  /* ------------------------------------------------------------------------
     Story data — frame ranges were mapped by hand against the hero footage
     ------------------------------------------------------------------------ */
  const HERO_FRAMES = 164;
  const SMOKE_FRAMES = 87;

  const DRINKS = [
    ['Scarlet Hour', 'Gin · raspberry · rose · egg white'],
    ['Rose Static', 'Vodka · lychee · pink grapefruit soda'],
    ['Amber Hours', 'Rye · amaro · burnt orange'],
    ['Electric Tide', 'Gin · blue curaçao · lime · sea salt'],
    ['Cloud Nine', 'Coconut rum · pineapple · lime foam'],
    ['Garden Party', 'White rum · mint · lime · basil'],
    ['Neon Hibiscus', 'Tequila · hibiscus · agave · soda'],
    ['Lagoon', 'Vodka · curaçao · lemon · tonic'],
    ['Carnival', 'Rum · passion fruit · grenadine · lime'],
    ['Lime Wire', 'Gin · kaffir lime · cucumber · soda'],
    ['Clear Night', 'Vodka · elderflower · cucumber ribbon'],
    ['Midnight Cherry', 'Bourbon · sour cherry · lemon'],
    ['The Last Word', 'Dark rum · cacao · orchid · smoke'],
  ];
  // [first frame (1-based), drink index]
  const POUR_SEGMENTS = [
    [1, 0], [21, 1], [29, 2], [41, 3], [53, 4], [61, 5], [69, 6], [77, 7],
    [85, 8], [105, 9], [113, 10], [125, 11], [133, 5], [141, 4], [149, 3], [161, 12],
  ];
  const drinkAt = (frame) => {
    let d = 0;
    for (const [from, idx] of POUR_SEGMENTS) if (frame >= from) d = idx;
    return d;
  };

  /* ------------------------------------------------------------------------
     Image-sequence player (canvas). Loads frames coarse-to-fine so scrubbing
     works immediately and sharpens as the rest arrive.
     ------------------------------------------------------------------------ */
  class Sequence {
    constructor({ canvas, ambient = null, dir, count, ambientSize = 48 }) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.ambient = ambient;
      this.actx = ambient ? ambient.getContext('2d') : null;
      this.ambientSize = ambientSize;
      this.dir = dir;
      this.count = count;
      this.images = new Array(count);
      this.ready = new Array(count).fill(false);
      this.current = -1;
      this.loadedCount = 0;
      this.resize();
    }

    src(i) { return `${this.dir}/${pad(i + 1, 3)}.webp`; }

    order() {
      const seen = new Set();
      const out = [];
      for (const step of [8, 4, 2, 1]) {
        for (let i = 0; i < this.count; i += step) if (!seen.has(i)) { seen.add(i); out.push(i); }
      }
      if (!seen.has(this.count - 1)) out.push(this.count - 1);
      return out;
    }

    /** Load every frame; resolves `essential` once the first coarse pass is in. */
    load({ essentialStep = 4, onProgress } = {}) {
      const queue = this.order();
      const essentialSet = new Set(queue.filter((i) => i % essentialStep === 0));
      let essentialLeft = essentialSet.size;
      let resolveEssential;
      const essential = new Promise((r) => { resolveEssential = r; });

      const loadOne = (i) => new Promise((res) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = img.onerror = () => {
          if (img.naturalWidth) { this.images[i] = img; this.ready[i] = true; }
          this.loadedCount++;
          if (essentialSet.has(i)) {
            essentialLeft--;
            onProgress && onProgress(1 - essentialLeft / essentialSet.size);
            if (essentialLeft === 0) resolveEssential();
          }
          // Repaint if this frame is closer to what's on screen than what we drew
          if (this.current === i || (this.current >= 0 && !this.ready[this.current])) this.render(this.current, true);
          res();
        };
        img.src = this.src(i);
      });

      const worker = async () => { while (queue.length) await loadOne(queue.shift()); };
      Promise.all(Array.from({ length: 6 }, worker));
      return essential;
    }

    nearest(i) {
      if (this.ready[i]) return i;
      for (let d = 1; d < this.count; d++) {
        if (i - d >= 0 && this.ready[i - d]) return i - d;
        if (i + d < this.count && this.ready[i + d]) return i + d;
      }
      return -1;
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      if (!w || !h) return;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      if (this.ambient) {
        const aw = this.ambient.clientWidth || 16;
        const ah = this.ambient.clientHeight || 9;
        this.ambient.width = this.ambientSize;
        this.ambient.height = Math.max(1, Math.round(this.ambientSize * (ah / aw)));
      }
      if (this.current >= 0) this.render(this.current, true);
    }

    static drawCover(ctx, img, cw, ch) {
      const ir = img.naturalWidth / img.naturalHeight;
      const cr = cw / ch;
      let w, h;
      if (ir > cr) { h = ch; w = h * ir; } else { w = cw; h = w / ir; }
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    }

    render(i, force = false) {
      i = Math.max(0, Math.min(this.count - 1, i));
      if (i === this.current && !force) return;
      this.current = i;
      const n = this.nearest(i);
      if (n < 0) return;
      const img = this.images[n];
      Sequence.drawCover(this.ctx, img, this.canvas.width, this.canvas.height);
      if (this.actx) Sequence.drawCover(this.actx, img, this.ambient.width, this.ambient.height);
    }
  }

  /* ------------------------------------------------------------------------
     Smooth scroll
     ------------------------------------------------------------------------ */
  let lenis = null;
  if (!reduceMotion && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  const scrollToTarget = (target) => {
    if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else if (typeof target === 'number') window.scrollTo(0, target);
    else target.scrollIntoView();
  };

  /* ------------------------------------------------------------------------
     Sequences
     ------------------------------------------------------------------------ */
  const hero = new Sequence({
    canvas: $('.story__canvas'),
    ambient: $('.story__ambient'),
    dir: 'assets/seq/hero',
    count: HERO_FRAMES,
  });
  const smoke = new Sequence({
    canvas: $('.reveal__canvas'),
    dir: 'assets/seq/smoke',
    count: SMOKE_FRAMES,
  });

  /* ------------------------------------------------------------------------
     Loader / threshold
     ------------------------------------------------------------------------ */
  function runLoader() {
    const loader = $('.loader');
    const countEl = $('[data-count]', loader);
    const bar = $('.loader__bar i', loader);
    const label = $('.loader__label', loader);
    const enter = $('.loader__enter', loader);
    const gate = $('.loader__gate', loader);
    const shown = { v: 0 };

    gsap.fromTo('.loader__mark > *', { y: 0, yPercent: 110 }, { yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: 0.05, delay: 0.2 });

    const labels = ['Chilling the glassware', 'Cutting the citrus', 'Lighting the candles', 'Ready when you are'];
    const setProgress = (p) => {
      gsap.to(shown, {
        v: p * 100, duration: 0.6, ease: 'power2.out', overwrite: true,
        onUpdate: () => {
          countEl.textContent = pad(Math.round(shown.v));
          bar.style.transform = `scaleX(${shown.v / 100})`;
          label.textContent = labels[Math.min(2, Math.floor(shown.v / 34))];
        },
      });
    };

    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    const heroEssential = hero.load({ essentialStep: 4, onProgress: (p) => setProgress(p * 0.9) });
    heroEssential.then(() => { hero.render(0, true); smoke.load({ essentialStep: 87 }); });

    const minTime = new Promise((r) => setTimeout(r, reduceMotion ? 300 : 1600));
    Promise.all([fonts, heroEssential, minTime]).then(() => {
      setProgress(1);
      setTimeout(() => {
        label.textContent = labels[3];
        enter.disabled = false;
        gsap.to(gate, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'expo.out' });
        enter.focus({ preventScroll: true });
      }, 650);
    });

    enter.addEventListener('click', () => {
      enter.disabled = true;
      const done = () => {
        loader.remove();
        document.body.classList.remove('is-loading');
        lenis && lenis.start();
        ScrollTrigger.refresh();
      };
      if (reduceMotion) {
        gsap.to(loader, { autoAlpha: 0, duration: 0.3, onComplete: () => { done(); intro(); } });
        return;
      }
      const tl = gsap.timeline({ onComplete: done });
      tl.to('.loader__inner', { y: -40, autoAlpha: 0, duration: 0.6, ease: 'power3.in' })
        .to('.loader__curtain', { scaleY: 1, duration: 0.7, ease: 'expo.inOut' }, '-=.2')
        .set(loader, { backgroundColor: 'transparent' })
        .set('.loader__curtain', { transformOrigin: 'top' })
        .add(intro, '+=.02')
        .to('.loader__curtain', { scaleY: 0, duration: 0.9, ease: 'expo.inOut' }, '<');
    });
  }

  /* Hero entrance after the curtain lifts */
  function intro() {
    if (reduceMotion) return;
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from('.story__canvas', { clipPath: 'inset(50% 0% 50% 0%)', duration: 1.6, ease: 'expo.inOut' }, 0)
      .from('.story__ambient', { autoAlpha: 0, duration: 2 }, 0.3)
      .from('.story__title', { y: 80, autoAlpha: 0, duration: 1.6 }, 0.55)
      .from('.story__kicker', { clipPath: 'inset(0 0 100% 0)', duration: 1.2 }, 0.9)
      .from(['.header', '.story__rail', '.story__hint', '.story__rec', '.corner'], { autoAlpha: 0, duration: 1.2, stagger: 0.05 }, 1);
  }

  /* ------------------------------------------------------------------------
     Act I — the scroll story
     ------------------------------------------------------------------------ */
  function buildStory(mm) {
    const acts = $$('.act');
    const nameEl = $('[data-pour-name]');
    const notesEl = $('[data-pour-notes]');
    const idxEl = $('[data-pour-index]');
    $('[data-pour-total]').textContent = pad(DRINKS.length);
    const railBar = $('.story__bar i');
    let drink = 0;

    const setDrink = (d) => {
      if (d === drink) return;
      const dirUp = d > drink;
      drink = d;
      idxEl.textContent = pad(d + 1);
      if (reduceMotion) { nameEl.textContent = DRINKS[d][0]; notesEl.textContent = DRINKS[d][1]; return; }
      gsap.killTweensOf(nameEl);
      gsap.timeline()
        .to(nameEl, { yPercent: dirUp ? -105 : 105, duration: 0.18, ease: 'power2.in' })
        .add(() => { nameEl.textContent = DRINKS[d][0]; notesEl.textContent = DRINKS[d][1]; })
        .fromTo(nameEl, { yPercent: dirUp ? 105 : -105 }, { yPercent: 0, duration: 0.45, ease: 'expo.out' });
    };

    const setAct = (frame) => {
      for (const a of acts) {
        const on = frame >= +a.dataset.from && frame <= +a.dataset.to;
        a.classList.toggle('is-active', on);
      }
    };

    const state = { f: 0 };
    const onFrame = () => {
      const i = Math.round(state.f);
      hero.render(i);
      setAct(i + 1);
      setDrink(drinkAt(i + 1));
    };

    mm.add({ desktop: DESKTOP, mobile: MOBILE }, (ctx) => {
      const { desktop } = ctx.conditions;
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '.story',
          start: 'top top',
          end: () => '+=' + Math.round(window.innerHeight * (desktop ? 5.5 : 4.5)),
          pin: '.story__pin',
          scrub: reduceMotion ? true : 0.7,
          anticipatePin: 1,
          onUpdate: (self) => { railBar.style.transform = `scaleX(${self.progress})`; },
          onRefresh: () => hero.resize(),
        },
      });
      tl.to(state, { f: HERO_FRAMES - 1, ease: 'none', duration: 1, onUpdate: onFrame }, 0)
        .to('.story__word--l', { xPercent: desktop ? -70 : -40, autoAlpha: 0, duration: 0.11, ease: 'power2.in' }, 0)
        .to('.story__word--r', { xPercent: desktop ? 70 : 40, autoAlpha: 0, duration: 0.11, ease: 'power2.in' }, 0)
        .to('.story__kicker', { autoAlpha: 0, y: -24, duration: 0.05 }, 0)
        .to('.story__hint', { autoAlpha: 0, duration: 0.03 }, 0)
        .fromTo('.pour', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.05 }, 0.09);
      if (desktop) {
        tl.fromTo('.story__frame', { scale: 0.86 }, { scale: 1, duration: 0.12, ease: 'power1.inOut' }, 0)
          .to('.story__frame', { scale: 1.06, duration: 0.2, ease: 'none' }, 0.8);
      }
      onFrame();
      return () => { state.f = 0; };
    });
  }

  /* ------------------------------------------------------------------------
     Smoke reveal — second scrubbed sequence
     ------------------------------------------------------------------------ */
  function buildReveal(mm) {
    const steps = $$('.step');
    const state = { f: 0 };
    mm.add({ desktop: DESKTOP, mobile: MOBILE }, () => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '.reveal',
          start: 'top top',
          end: () => '+=' + Math.round(window.innerHeight * 2.4),
          pin: '.reveal__pin',
          scrub: reduceMotion ? true : 0.6,
          onRefresh: () => smoke.resize(),
          onUpdate: (self) => {
            const p = self.progress;
            steps.forEach((s, k) => s.classList.toggle('is-on', p >= [0.08, 0.5, 0.78][k]));
          },
        },
      });
      tl.to(state, { f: SMOKE_FRAMES - 1, ease: 'none', duration: 1, onUpdate: () => smoke.render(Math.round(state.f)) }, 0)
        .from('.reveal__copy > *', { y: 40, autoAlpha: 0, stagger: 0.03, duration: 0.12 }, 0)
        .from('.reveal__tag', { y: 30, autoAlpha: 0, duration: 0.1 }, 0.62);
      smoke.render(0, true);
    });
  }

  /* ------------------------------------------------------------------------
     Manifesto — words light up as you read
     ------------------------------------------------------------------------ */
  function buildManifesto() {
    const el = $('.manifesto__text');
    const split = SplitText.create(el, { type: 'words', wordsClass: 'word' });
    if (reduceMotion) { gsap.set(split.words, { opacity: 1 }); return; }
    gsap.to(split.words, {
      opacity: 1, ease: 'none', stagger: 0.1,
      scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 50%', scrub: true },
    });
    gsap.from($$('.pill', el), {
      scale: 0, duration: 1.2, ease: 'expo.out', stagger: 0.15,
      scrollTrigger: { trigger: el, start: 'top 75%' },
    });

    $$('[data-counter]').forEach((n) => {
      const to = +n.dataset.counter;
      const o = { v: 0 };
      ScrollTrigger.create({
        trigger: n, start: 'top 90%', once: true,
        onEnter: () => gsap.to(o, { v: to, duration: 2, ease: 'power3.out', onUpdate: () => { n.textContent = Math.round(o.v); } }),
      });
    });
  }

  /* ------------------------------------------------------------------------
     Signatures — horizontal track
     ------------------------------------------------------------------------ */
  function buildMenu(mm) {
    const track = $('.menu__track');
    const bar = $('.menu__progress i');
    mm.add(DESKTOP, () => {
      const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
      const tween = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: {
          trigger: '.menu', start: 'top top', end: () => '+=' + dist(),
          pin: '.menu__pin', scrub: reduceMotion ? true : 0.8, invalidateOnRefresh: true,
          onUpdate: (self) => { bar.style.transform = `scaleX(${self.progress})`; },
        },
      });
      if (!reduceMotion) {
        $$('.card__media img', track).forEach((img) => {
          gsap.fromTo(img, { xPercent: -8 }, {
            xPercent: 8, ease: 'none',
            scrollTrigger: { trigger: img.parentElement, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
          });
        });
      }
    });
    if (!reduceMotion) {
      gsap.from('.card', {
        y: 80, autoAlpha: 0, duration: 1.3, ease: 'expo.out', stagger: 0.08,
        scrollTrigger: { trigger: '.menu', start: 'top 70%' },
      });
    }
  }

  /* ------------------------------------------------------------------------
     Ritual — the film opens up
     ------------------------------------------------------------------------ */
  function buildRitual(mm) {
    const words = $$('.ritual__words span');
    mm.add({ desktop: DESKTOP, mobile: MOBILE }, (ctx) => {
      const { desktop } = ctx.conditions;
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '.ritual', start: 'top top',
          end: () => '+=' + Math.round(window.innerHeight * 2),
          pin: '.ritual__pin', scrub: reduceMotion ? true : 0.8,
        },
      });
      tl.fromTo('.ritual__media',
        { clipPath: desktop ? 'inset(30% 37% 30% 37% round 6px)' : 'inset(36% 18% 36% 18% round 6px)' },
        { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'power2.inOut', duration: 0.6 }, 0)
        .to(words[0], desktop ? { xPercent: -60, autoAlpha: 0 } : { yPercent: -120, autoAlpha: 0 }, 0)
        .to(words[2], desktop ? { xPercent: 60, autoAlpha: 0 } : { yPercent: 120, autoAlpha: 0 }, 0)
        .to(words[1], { scale: 1.6, autoAlpha: 0, duration: 0.5 }, 0.05)
        .to('.ritual__veil', { opacity: 1, duration: 0.25 }, 0.55)
        .fromTo('.ritual__copy', { y: 60, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.25 }, 0.62)
        .to({}, { duration: 0.15 });
    });
  }

  /* ------------------------------------------------------------------------
     Headline reveals, fades, parallax
     ------------------------------------------------------------------------ */
  function buildReveals(mm) {
    if (reduceMotion) return;

    $$('[data-split]').forEach((el) => {
      SplitText.create(el, {
        type: 'lines', mask: 'lines', linesClass: 'split-line', autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, {
          yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: 0.1,
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        }),
      });
    });

    const fades = ['.section .eyebrow', '.library__lede', '.row', '.dish', '.stat', '.reserve .form', '.footer__col'];
    $$(fades.join(',')).forEach((el) => {
      if (el.closest('.reveal, .ritual, .menu')) return;
      gsap.from(el, {
        y: 28, autoAlpha: 0, duration: 1.1, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
      });
    });

    mm.add(DESKTOP, () => {
      $$('[data-speed]').forEach((el) => {
        const s = +el.dataset.speed;
        gsap.fromTo(el, { yPercent: s }, {
          yPercent: -s, ease: 'none',
          scrollTrigger: { trigger: '.kitchen__collage', start: 'top bottom', end: 'bottom top', scrub: true },
        });
        gsap.fromTo($('img', el), { yPercent: -8 }, {
          yPercent: 0, ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });
      gsap.fromTo('.library__frame video', { scale: 1.15 }, {
        scale: 1, ease: 'none',
        scrollTrigger: { trigger: '.library', start: 'top bottom', end: 'center center', scrub: true },
      });
    });

    gsap.from('.kc', {
      clipPath: 'inset(100% 0% 0% 0%)', duration: 1.6, ease: 'expo.inOut', stagger: 0.12,
      scrollTrigger: { trigger: '.kitchen__collage', start: 'top 75%' },
    });

    // Footer wordmark rises letter by letter
    const mark = $('.footer__mark');
    const chars = SplitText.create(mark, { type: 'chars', charsClass: 'char' }).chars;
    gsap.from(chars, {
      yPercent: 105, duration: 1.4, ease: 'expo.out', stagger: 0.045,
      scrollTrigger: { trigger: mark, start: 'top 95%' },
    });

    gsap.fromTo('.gallery__title', { scale: 0.8 }, {
      scale: 1.1, ease: 'none',
      scrollTrigger: { trigger: '.gallery', start: 'top bottom', end: 'bottom top', scrub: true },
    });
  }

  /* ------------------------------------------------------------------------
     Gallery marquee — speed follows scroll velocity
     ------------------------------------------------------------------------ */
  function buildMarquee() {
    const rows = $$('.marquee').map((m) => {
      const track = $('.marquee__track', m);
      Array.from(track.children).forEach((c) => {
        const clone = c.cloneNode(true);
        clone.alt = '';
        clone.setAttribute('aria-hidden', 'true');
        track.appendChild(clone);
      });
      return { track, dir: +m.dataset.dir, x: 0 };
    });
    if (reduceMotion) return;

    let visible = false;
    ScrollTrigger.create({ trigger: '.gallery', start: 'top bottom', end: 'bottom top', onToggle: (s) => { visible = s.isActive; } });

    let boost = 0;
    gsap.ticker.add((_, dt) => {
      if (!visible) return;
      const v = lenis ? lenis.velocity : 0;
      boost += (Math.min(Math.abs(v), 60) - boost) * 0.08;
      for (const r of rows) {
        const half = r.track.scrollWidth / 2;
        r.x -= (0.045 + boost * 0.012) * dt * r.dir;
        if (r.x <= -half) r.x += half;
        if (r.x > 0) r.x -= half;
        r.track.style.transform = `translate3d(${r.x}px,0,0)`;
      }
    });
  }

  /* ------------------------------------------------------------------------
     Global chrome: clock, progress, nav state, videos, overlay
     ------------------------------------------------------------------------ */
  function buildChrome() {
    const clock = $('[data-clock]');
    const progress = $('.header__progress i');
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: (self) => {
        const mins = 21 * 60 + Math.round(self.progress * 360);
        clock.textContent = `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;
        progress.style.transform = `scaleX(${self.progress})`;
      },
    });

    const links = $$('.nav a');
    links.forEach((a) => {
      const sec = $(a.getAttribute('href'));
      if (!sec) return;
      ScrollTrigger.create({
        trigger: sec, start: 'top 50%', end: 'bottom 50%',
        onToggle: (s) => a.classList.toggle('is-active', s.isActive),
      });
    });

    // Anchor links ride the smooth scroller
    $$('[data-scroll-to]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        const target = id === '#story' ? 0 : $(id);
        if (target === null) return;
        e.preventDefault();
        closeOverlay();
        scrollToTarget(target);
      });
    });

    // Play videos only while on screen
    const vids = $$('video');
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        const v = en.target;
        if (en.isIntersecting) { const p = v.play(); p && p.catch(() => {}); } else v.pause();
      }
    }, { rootMargin: '10% 0px' });
    vids.forEach((v) => { if (!reduceMotion) io.observe(v); });

    // Mobile overlay
    const burger = $('.burger');
    const overlay = $('#overlay');
    function closeOverlay() {
      if (!overlay.classList.contains('is-open')) return;
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Open menu');
      lenis && lenis.start();
    }
    buildChrome.closeOverlay = closeOverlay;
    burger.addEventListener('click', () => {
      const open = !overlay.classList.contains('is-open');
      if (!open) { closeOverlay(); return; }
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Close menu');
      lenis && lenis.stop();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(); });
  }
  const closeOverlay = () => buildChrome.closeOverlay && buildChrome.closeOverlay();

  /* ------------------------------------------------------------------------
     Pointer: cursor, magnetic buttons, hover-reveal images
     ------------------------------------------------------------------------ */
  function buildPointer() {
    if (!finePointer) return;
    document.documentElement.classList.add('has-cursor');
    const cursor = $('.cursor');
    const label = $('.cursor__label');
    const dotX = gsap.quickTo('.cursor__dot', 'x', { duration: 0.12, ease: 'power3' });
    const dotY = gsap.quickTo('.cursor__dot', 'y', { duration: 0.12, ease: 'power3' });
    const ringX = gsap.quickTo('.cursor__ring', 'x', { duration: 0.5, ease: 'power3' });
    const ringY = gsap.quickTo('.cursor__ring', 'y', { duration: 0.5, ease: 'power3' });

    const reveal = $('.hover-reveal');
    const revealImg = $('img', reveal);
    const revX = gsap.quickTo(reveal, 'x', { duration: 0.7, ease: 'power3' });
    const revY = gsap.quickTo(reveal, 'y', { duration: 0.7, ease: 'power3' });
    const revR = gsap.quickTo(reveal, 'rotation', { duration: 0.9, ease: 'power3' });
    let lastX = 0;

    window.addEventListener('pointermove', (e) => {
      cursor.classList.add('is-visible');
      dotX(e.clientX); dotY(e.clientY); ringX(e.clientX); ringY(e.clientY);
      revX(e.clientX); revY(e.clientY);
      revR(gsap.utils.clamp(-12, 12, (e.clientX - lastX) * 0.6));
      lastX = e.clientX;
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => cursor.classList.remove('is-visible'));

    document.addEventListener('pointerover', (e) => {
      const lab = e.target.closest('[data-cursor]');
      const hov = e.target.closest('a, button, label, .row, select, input');
      cursor.classList.toggle('is-label', !!lab);
      cursor.classList.toggle('is-hover', !lab && !!hov);
      label.textContent = lab ? lab.dataset.cursor : '';
    });

    $$('[data-reveal-img]').forEach((row) => {
      row.addEventListener('mouseenter', () => {
        revealImg.src = row.dataset.revealImg;
        gsap.to(reveal, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'expo.out', overwrite: 'auto' });
        gsap.fromTo(revealImg, { scale: 1.3 }, { scale: 1.1, duration: 0.9, ease: 'expo.out' });
      });
      row.addEventListener('mouseleave', () => {
        gsap.to(reveal, { autoAlpha: 0, scale: 0.85, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
      });
    });
    gsap.set(reveal, { scale: 0.85 });

    if (reduceMotion) return;
    $$('[data-magnetic]').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.38);
      });
      el.addEventListener('pointerleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, .4)' });
      });
    });
  }

  /* ------------------------------------------------------------------------
     Reservation form
     ------------------------------------------------------------------------ */
  function buildForm() {
    const form = $('.form');
    const ticket = $('.ticket');
    const date = $('#f-date');
    const today = new Date();
    const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    date.min = iso(today);

    const rules = {
      date: (v) => (!v ? 'Pick a date for your visit.' : v < iso(today) ? 'That night has already happened — choose a future date.' : ''),
      time: (v) => (!v ? 'Choose a time.' : ''),
      name: (v) => (v.trim().length < 2 ? 'Tell us who the table is for.' : ''),
      email: (v) => (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? 'Enter an email like you@example.com.' : ''),
    };

    const check = (name) => {
      const input = form.elements[name];
      const msg = rules[name](input.value);
      const field = input.closest('.field');
      const err = $(`#e-${name}`);
      field.classList.toggle('is-invalid', !!msg);
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (msg) input.setAttribute('aria-describedby', `e-${name}`); else input.removeAttribute('aria-describedby');
      err.textContent = msg;
      return !msg;
    };

    Object.keys(rules).forEach((n) => {
      const input = form.elements[n];
      input.addEventListener('blur', () => { if (input.value) check(n); });
      input.addEventListener('input', () => { if (input.closest('.field').classList.contains('is-invalid')) check(n); });
      input.addEventListener('change', () => { if (input.closest('.field').classList.contains('is-invalid')) check(n); });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const bad = Object.keys(rules).filter((n) => !check(n));
      if (bad.length) { form.elements[bad[0]].focus(); return; }

      const btn = $('button[type="submit"]', form);
      btn.classList.add('is-sending');
      $('.btn__label', btn).textContent = 'Holding…';

      setTimeout(() => {
        const d = new Date(form.elements.date.value + 'T12:00:00');
        const first = form.elements.name.value.trim().split(/\s+/)[0];
        $('[data-t-name]').textContent = first ? `, ${first}` : '';
        $('[data-t-when]').textContent = form.elements.date.value === iso(today)
          ? 'tonight'
          : 'on ' + d.toLocaleDateString('en-GB', { weekday: 'long' });
        $('[data-t-guests]').textContent = form.elements.guests.value;
        $('[data-t-date]').textContent = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        $('[data-t-time]').textContent = form.elements.time.value;
        $('[data-t-ref]').textContent = 'NO-' + Math.floor(1000 + Math.random() * 9000);

        gsap.to(form, {
          autoAlpha: 0, y: -20, duration: reduceMotion ? 0 : 0.45, ease: 'power3.in',
          onComplete: () => {
            form.hidden = true;
            ticket.hidden = false;
            gsap.fromTo(ticket, { autoAlpha: 0, y: 40, rotateX: -25, transformPerspective: 800 }, { autoAlpha: 1, y: 0, rotateX: 0, duration: reduceMotion ? 0 : 1.1, ease: 'expo.out' });
            ticket.focus({ preventScroll: true });
            ScrollTrigger.refresh();
            const r = ticket.getBoundingClientRect();
            if (r.top < 0 || r.bottom > window.innerHeight) {
              if (lenis) lenis.scrollTo(ticket, { offset: -window.innerHeight * 0.2, duration: 1.2 });
              else ticket.scrollIntoView({ block: 'center' });
            }
          },
        });
        btn.classList.remove('is-sending');
        $('.btn__label', btn).textContent = 'Hold my table';
      }, reduceMotion ? 200 : 1100);
    });

    $('.ticket__again').addEventListener('click', () => {
      form.reset();
      ticket.hidden = true;
      form.hidden = false;
      gsap.fromTo(form, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out' });
      form.elements.date.focus();
      ScrollTrigger.refresh();
    });
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */
  const mm = gsap.matchMedia();
  // Pinned sections first, in page order, so later triggers measure the pin spacers
  buildStory(mm);
  buildManifesto();
  buildReveal(mm);
  buildMenu(mm);
  buildRitual(mm);
  buildChrome();
  buildReveals(mm);
  buildMarquee();
  buildPointer();
  buildForm();
  runLoader();

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { hero.resize(); smoke.resize(); }, 120);
  });
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
