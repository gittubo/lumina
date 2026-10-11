/* =========================================================
   TUBO SHOT THIS — cinematic scroll experience
   GSAP + ScrollTrigger drive everything; Lenis smooths the
   wheel. The hero is an image sequence painted to <canvas>
   so scrubbing is frame-accurate in every browser.
   ========================================================= */
(() => {
  "use strict";

  const FRAME_COUNT = 239;
  const framePath = (i) => `assets/sequence/${String(i + 1).padStart(3, "0")}.webp`;
  const END_PLATE = "assets/lens-end.webp";

  // Source footage is 720×1280. Lens-glass centre and radius were
  // measured on the last sequence frame and on the clean end plate;
  // the plate is the same lens pushed in ~2×.
  const SRC = { w: 720, h: 1280 };
  const LENS_LAST = { x: 324, y: 702, r: 155 };
  const LENS_END = { x: 316.5, y: 708, r: 313 };
  const PUSH = LENS_END.r / LENS_LAST.r;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  const smooth = (a, b, t) => { const x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x); };

  const hasGSAP = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  $("[data-year]").textContent = new Date().getFullYear();

  /* ---------------------------------------------------------
     Canvas + frame store
     --------------------------------------------------------- */
  const canvas = $(".hero__canvas");
  const ctx = canvas.getContext("2d");
  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = 18; blurCanvas.height = 32;
  const blurCtx = blurCanvas.getContext("2d");

  const frames = new Array(FRAME_COUNT);
  let plate = null;
  let plateRaw = null;
  const view = { w: 0, h: 0, dpr: 1 };
  // Driven by the hero timeline
  const state = { frame: 0, push: 0, hold: 0 };

  function nearestLoaded(i) {
    for (let d = 0; d < FRAME_COUNT; d++) {
      if (frames[i - d] && frames[i - d].complete) return frames[i - d];
      if (frames[i + d] && frames[i + d].complete) return frames[i + d];
    }
    return null;
  }

  function resize() {
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.w = canvas.clientWidth;
    view.h = canvas.clientHeight;
    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.imageSmoothingQuality = "high";
    placeBrand();
    render();
  }

  // Scale of the end plate once the lens fills the screen
  function endScale() {
    const contain = Math.min(view.w / SRC.w, view.h / SRC.h);
    const cover = Math.max(view.w / SRC.w, view.h / SRC.h);
    return Math.max(contain * 1.35, Math.min(cover, (view.h * 0.98) / (2 * LENS_END.r)));
  }

  // Put the brand block exactly over the lens glass
  function placeBrand() {
    const root = document.documentElement.style;
    const d = 2 * LENS_END.r * endScale();
    root.setProperty("--lens-x", `${view.w / 2}px`);
    root.setProperty("--lens-y", `${view.h / 2}px`);
    root.setProperty("--lens-d", `${Math.min(d * 0.92, view.w * 0.9)}px`);
  }

  // Draw `img` so that source point (ax, ay) lands on screen centre at `scale`
  function drawAt(img, scale, ax, ay, alpha = 1) {
    if (!img || alpha <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, view.w / 2 - ax * scale, view.h / 2 - ay * scale, SRC.w * scale, SRC.h * scale);
    ctx.globalAlpha = 1;
  }

  // Cheap blur: shrink to 18×32 then stretch to cover
  function drawBackdrop(img, alpha) {
    if (!img || alpha <= 0) return;
    blurCtx.drawImage(img, 0, 0, blurCanvas.width, blurCanvas.height);
    const cover = Math.max(view.w / SRC.w, view.h / SRC.h) * 1.15;
    ctx.globalAlpha = alpha;
    ctx.drawImage(blurCanvas, view.w / 2 - (SRC.w * cover) / 2, view.h / 2 - (SRC.h * cover) / 2, SRC.w * cover, SRC.h * cover);
    ctx.fillStyle = "rgba(7,9,11,0.55)";
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.globalAlpha = 1;
  }

  function render() {
    if (!view.w) return;
    const { w, h } = view;
    ctx.fillStyle = "#07090b";
    ctx.fillRect(0, 0, w, h);

    const idx = Math.min(FRAME_COUNT - 1, Math.max(0, Math.round(state.frame)));
    const img = nearestLoaded(idx);
    const contain = Math.min(w / SRC.w, h / SRC.h);
    const sEnd = endScale();
    const e = state.push;

    if (e <= 0) {
      drawBackdrop(img, 1);
      drawAt(img, contain, SRC.w / 2, SRC.h / 2);
    } else {
      // Push into the lens: zoom the last frame toward its glass and
      // cross-fade to the clean plate, which is aligned 2× deeper.
      const last = nearestLoaded(FRAME_COUNT - 1);
      const s = contain * Math.pow((PUSH * sEnd) / contain, e) * (1 + 0.06 * state.hold);
      const ax = lerp(SRC.w / 2, LENS_LAST.x, e);
      const ay = lerp(SRC.h / 2, LENS_LAST.y, e);
      drawBackdrop(last, 1 - smooth(0, 0.6, e));
      drawBackdrop(plateRaw, smooth(0.35, 0.95, e));
      drawAt(last, s, ax, ay, 1 - smooth(0.55, 1, e));
      drawAt(plate, s / PUSH, LENS_END.x + PUSH * (ax - LENS_LAST.x), LENS_END.y + PUSH * (ay - LENS_LAST.y), smooth(0.35, 0.95, e));
    }
    updateHud(idx);
  }

  /* ---------------------------------------------------------
     Viewfinder HUD readouts
     --------------------------------------------------------- */
  const hud = { tc: $("[data-tc]"), iso: $("[data-iso]"), f: $("[data-fstop]"), focus: $("[data-focus]") };
  let lastHud = -1;
  function updateHud(idx) {
    const key = idx * 10 + Math.round(state.push * 9);
    if (key === lastHud) return;
    lastHud = key;
    // each sequence frame is 2 source frames @ 59.94fps; show it as 24fps timecode
    const total = Math.round((idx * 2 / 59.94) * 24);
    const ff = total % 24, ss = Math.floor(total / 24) % 60;
    hud.tc.textContent = `00:00:${String(ss).padStart(2, "0")}:${String(ff).padStart(2, "0")}`;
    const t = idx / (FRAME_COUNT - 1);
    hud.iso.textContent = [100, 200, 400, 800][Math.min(3, Math.floor(t * 4))];
    hud.f.textContent = (2.8 - 1.4 * Math.max(t, state.push)).toFixed(1);
    hud.focus.textContent = state.push > 0.6 ? "LOCK" : t < 0.05 ? "∞" : `${(12 - 11.5 * t).toFixed(1)}M`;
  }

  // Fade the plate's edges so it melts into the blurred backdrop
  // when the viewport is wider than the footage.
  function featherPlate(im) {
    const c = document.createElement("canvas");
    c.width = SRC.w; c.height = SRC.h;
    const g = c.getContext("2d");
    g.drawImage(im, 0, 0, SRC.w, SRC.h);
    g.globalCompositeOperation = "destination-in";
    const f = 140;
    const hx = g.createLinearGradient(0, 0, SRC.w, 0);
    hx.addColorStop(0, "rgba(0,0,0,0)"); hx.addColorStop(f / SRC.w, "#000");
    hx.addColorStop(1 - f / SRC.w, "#000"); hx.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = hx; g.fillRect(0, 0, SRC.w, SRC.h);
    const vy = g.createLinearGradient(0, 0, 0, SRC.h);
    vy.addColorStop(0, "rgba(0,0,0,0)"); vy.addColorStop(f / SRC.h, "#000");
    vy.addColorStop(1 - f / SRC.h, "#000"); vy.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = vy; g.fillRect(0, 0, SRC.w, SRC.h);
    plateRaw = im;
    return c;
  }

  /* ---------------------------------------------------------
     Preload
     --------------------------------------------------------- */
  function preload(onProgress) {
    let done = 0;
    const total = FRAME_COUNT + 1;
    const tick = () => onProgress(++done / total);
    const load = (src) => new Promise((res) => {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => { tick(); res(im); };
      im.onerror = () => { tick(); res(null); };
      im.src = src;
    });
    const jobs = [load(END_PLATE).then((im) => (plate = im && featherPlate(im)))];
    for (let i = 0; i < FRAME_COUNT; i++) {
      jobs.push(load(framePath(i)).then((im) => { if (im) frames[i] = im; if (i === 0) render(); }));
    }
    // never hold the visitor hostage on a slow connection
    return Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, 15000))]);
  }

  /* ---------------------------------------------------------
     Split helpers
     --------------------------------------------------------- */
  function splitChars(el) {
    const text = el.textContent;
    el.textContent = "";
    for (const c of text) {
      const s = document.createElement("span");
      s.className = "ch";
      s.textContent = c === " " ? " " : c;
      el.appendChild(s);
    }
  }

  function splitWords(el) {
    const nodes = Array.from(el.childNodes);
    el.textContent = "";
    nodes.forEach((n) => {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(" ")); return; }
          const s = document.createElement("span");
          s.className = "w";
          s.textContent = part;
          el.appendChild(s);
        });
      } else {
        n.classList.add("w");
        el.appendChild(n);
      }
    });
    return $$(".w", el);
  }

  $$("[data-split]").forEach(splitChars);
  const manifestoWords = splitWords($("[data-words]"));

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  window.addEventListener("resize", () => { resize(); });
  resize();

  const countEl = $("[data-count]");
  const barEl = $("[data-bar]");
  const loaderProgress = (p) => {
    countEl.textContent = String(Math.round(p * 100)).padStart(3, "0");
    barEl.style.transform = `scaleX(${p})`;
  };

  if (!hasGSAP || reduceMotion) {
    preload(loaderProgress).then(staticMode);
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  let lenis = null;
  if (typeof window.Lenis !== "undefined") {
    lenis = new Lenis({ duration: 1.25, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  window.scrollTo(0, 0);
  preload(loaderProgress).then(() => {
    render();
    buildScenes();
    intro();
  });

  /* ---------------------------------------------------------
     Intro after loading
     --------------------------------------------------------- */
  function intro() {
    const tl = gsap.timeline({
      onComplete: () => {
        document.body.classList.remove("is-loading");
        if (lenis) lenis.start();
        ScrollTrigger.refresh();
      },
    });
    tl.to(".loader__meta, .loader__bar", { opacity: 0, duration: 0.4 })
      .to(".loader__reticle", { scale: 6, opacity: 0, duration: 1.1, ease: "expo.in" }, 0.1)
      .to(".loader", { opacity: 0, duration: 0.6, ease: "power2.out" }, 0.9)
      .set(".loader", { display: "none" })
      .from(".hero__canvas", { scale: 1.12, filter: "blur(18px) brightness(0.4)", duration: 1.8, ease: "expo.out" }, 0.9)
      .from(".letterbox--top", { yPercent: 100, duration: 1.2, ease: "expo.out" }, 1.1)
      .from(".letterbox--bottom", { yPercent: -100, duration: 1.2, ease: "expo.out" }, 1.1)
      .from(".hud", { opacity: 0, duration: 1 }, 1.4)
      .from(".hud__corner", { scale: 2.2, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.06 }, 1.4)
      .from("[data-cue]", { opacity: 0, y: 12, duration: 0.8 }, 1.8);
  }

  /* ---------------------------------------------------------
     Scenes
     --------------------------------------------------------- */
  function buildScenes() {
    heroScene();
    eyeScene();
    stillsScene();
    motionScene();
    processScene();
    servicesScene();
    contactScene();
    chapterRail();
    cursor();
    $$("a[href^='#']").forEach((a) => a.addEventListener("click", (ev) => {
      const target = $(a.getAttribute("href"));
      if (!target) return;
      ev.preventDefault();
      if (lenis) lenis.scrollTo(target, { duration: 1.8 });
      else target.scrollIntoView({ behavior: "smooth" });
    }));
  }

  function heroScene() {
    const cue = $("[data-cue] span");
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "+=560%",
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        onUpdate: (st) => { cue.textContent = st.progress > 0.9 ? "Enter the story" : "Scroll to focus"; },
      },
      onUpdate: render,
    });

    // 0 → 70 : the lens film
    tl.to(state, { frame: FRAME_COUNT - 1, duration: 70 }, 0);
    tl.to("[data-cue]", { opacity: 0, duration: 3 }, 1);

    const caps = [[3, 16], [21, 34], [39, 52], [57, 67]];
    caps.forEach(([a, b], i) => {
      const el = $(`[data-caption="${i + 1}"]`);
      tl.fromTo(el, { opacity: 0, y: 40, filter: "blur(10px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 4, ease: "power2.out" }, a)
        .to(el, { opacity: 0, y: -30, filter: "blur(8px)", duration: 4, ease: "power2.in" }, b);
    });

    // 70 → 86 : push into the glass
    tl.to(state, { push: 1, duration: 16, ease: "power2.inOut" }, 70);
    tl.to(".letterbox--top", { yPercent: -100, duration: 10, ease: "power2.inOut" }, 76);
    tl.to(".letterbox--bottom", { yPercent: 100, duration: 10, ease: "power2.inOut" }, 76);
    tl.to(".hud__row", { opacity: 0, duration: 6 }, 78);
    tl.to(".hud__corner", { opacity: 0.35, duration: 6 }, 80);

    // 82 → 96 : focus locks, brand resolves on the lens
    tl.fromTo(".brand__ring", { opacity: 0 }, { opacity: 1, duration: 6 }, 82);
    tl.fromTo(".brand__lock", { opacity: 0, scale: 1.7 }, { opacity: 1, scale: 1, duration: 6, ease: "expo.out" }, 82);
    tl.fromTo(".brand__line .ch",
      { opacity: 0, filter: "blur(16px)", scale: 1.6, yPercent: 30 },
      { opacity: 1, filter: "blur(0px)", scale: 1, yPercent: 0, duration: 6, ease: "expo.out", stagger: 0.45 }, 85);
    tl.to(".brand__lock", { opacity: 0, scale: 1.08, duration: 3 }, 93);
    tl.fromTo(".brand__glint", { opacity: 0, rotate: -40 }, { opacity: 1, rotate: 0, duration: 8, ease: "power2.out" }, 88);
    tl.fromTo(".brand__sub", { opacity: 0, letterSpacing: "0.9em" }, { opacity: 1, letterSpacing: "0.34em", duration: 5, ease: "power3.out" }, 91);
    tl.to(".nav, .rail", { opacity: 1, y: 0, duration: 4 }, 92);
    tl.to("[data-cue]", { opacity: 1, duration: 3 }, 95);
    // slow breathing push while the title holds
    tl.to(state, { hold: 1, duration: 14 }, 86);
    tl.to({}, { duration: 2 }, 98);
  }

  function eyeScene() {
    gsap.to(manifestoWords, {
      opacity: 1,
      stagger: 0.08,
      ease: "none",
      scrollTrigger: { trigger: ".manifesto", start: "top 80%", end: "bottom 45%", scrub: 1 },
    });
    gsap.from(".eye__stats > div", {
      y: 40, opacity: 0, stagger: 0.12, duration: 1.1, ease: "expo.out",
      scrollTrigger: { trigger: ".eye__stats", start: "top 85%" },
    });
    const counter = $("[data-counter]");
    ScrollTrigger.create({
      trigger: counter, start: "top 85%", once: true,
      onEnter: () => gsap.to({ v: 0 }, { v: +counter.dataset.counter, duration: 1.6, ease: "power2.out",
        onUpdate() { counter.textContent = Math.round(this.targets()[0].v); } }),
    });
  }

  function stillsScene() {
    const track = $(".stills__track");
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: ".stills",
        start: "top top",
        end: () => `+=${distance()}`,
        pin: ".stills__pin",
        scrub: 1,
        invalidateOnRefresh: true,
        onUpdate: (st) => gsap.set("[data-stills-bar]", { scaleX: st.progress }),
      },
    });
    if (window.innerWidth > 760) {
      gsap.to(".stills__intro", {
        xPercent: -40, opacity: 0.1, ease: "none",
        scrollTrigger: { trigger: ".stills", start: "top top", end: () => `+=${window.innerWidth * 0.6}`, scrub: true, invalidateOnRefresh: true },
      });
    }
    $$(".frame").forEach((f) => {
      gsap.fromTo($("img", f), { xPercent: -6 }, {
        xPercent: 6, ease: "none",
        scrollTrigger: { trigger: f, containerAnimation: tween, start: "left right", end: "right left", scrub: true },
      });
    });
  }

  function motionScene() {
    const vid = $(".motion__video");
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: ".motion", start: "top top", end: "+=220%", pin: ".motion__pin", scrub: 1 },
    });
    tl.fromTo(".motion__aperture", { clipPath: "circle(14vmin at 50% 50%)" }, { clipPath: "circle(80vmax at 50% 50%)", duration: 10, ease: "power2.inOut" }, 0)
      .fromTo(vid, { scale: 1.3 }, { scale: 1, duration: 10 }, 0)
      .fromTo(".motion__title [data-line]", { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 1.4, duration: 4, ease: "power3.out" }, 2)
      .fromTo(".motion__note", { opacity: 0 }, { opacity: 1, duration: 3 }, 6)
      .to(".motion__title", { scale: 0.9, opacity: 0, duration: 3 }, 11);

    $$(".motion video").forEach((v) => {
      ScrollTrigger.create({
        trigger: v.closest(".motion__pin") || v, start: "top bottom", end: "bottom top",
        onToggle: (st) => (st.isActive ? v.play().catch(() => {}) : v.pause()),
      });
    });
    gsap.from(".motion__copy > *", {
      y: 40, opacity: 0, stagger: 0.12, duration: 1.1, ease: "expo.out",
      scrollTrigger: { trigger: ".motion__duo", start: "top 75%" },
    });
    gsap.fromTo(".motion__clip", { clipPath: "inset(18% 12% 18% 12%)" }, {
      clipPath: "inset(0% 0% 0% 0%)", ease: "none",
      scrollTrigger: { trigger: ".motion__clip", start: "top 90%", end: "center 55%", scrub: 1 },
    });
  }

  function processScene() {
    $$(".pc").forEach((el) => {
      const speed = parseFloat(el.dataset.speed) || 0;
      gsap.fromTo(el, { y: () => -speed * 320 }, {
        y: () => speed * 320, ease: "none",
        scrollTrigger: { trigger: ".process__collage", start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true },
      });
      gsap.fromTo($("img", el), { scale: 1.25 }, {
        scale: 1, ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom center", scrub: true },
      });
    });
    $$("[data-reveal]").forEach((el) => {
      gsap.from(el, { y: 50, opacity: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } });
    });
  }

  function servicesScene() {
    gsap.from(".svc", {
      y: 40, opacity: 0, stagger: 0.08, duration: 1, ease: "expo.out",
      scrollTrigger: { trigger: ".services__list", start: "top 80%" },
    });
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const preview = $(".svc-preview");
    const img = $("img", preview);
    const xTo = gsap.quickTo(preview, "x", { duration: 0.6, ease: "power3" });
    const yTo = gsap.quickTo(preview, "y", { duration: 0.6, ease: "power3" });
    window.addEventListener("mousemove", (e) => { xTo(e.clientX); yTo(e.clientY); });
    $$(".svc").forEach((li) => {
      li.addEventListener("mouseenter", () => {
        img.src = li.dataset.img;
        gsap.to(preview, { opacity: 1, scale: 1, rotate: gsap.utils.random(-6, 6), duration: 0.5, ease: "expo.out" });
      });
    });
    $(".services__list").addEventListener("mouseleave", () => gsap.to(preview, { opacity: 0, scale: 0.8, duration: 0.4 }));
  }

  function contactScene() {
    gsap.from(".contact__title [data-line]", {
      yPercent: 80, opacity: 0, stagger: 0.12, duration: 1.3, ease: "expo.out",
      scrollTrigger: { trigger: ".contact", start: "top 60%" },
    });
    gsap.from(".contact__lens", {
      scale: 0.4, opacity: 0, duration: 1.6, ease: "expo.out",
      scrollTrigger: { trigger: ".contact", start: "top 70%" },
    });
    gsap.from(".contact__mail, .contact__links", {
      y: 30, opacity: 0, stagger: 0.12, duration: 1, ease: "expo.out", delay: 0.3,
      scrollTrigger: { trigger: ".contact", start: "top 50%" },
    });
  }

  function chapterRail() {
    const items = $$(".rail li");
    $$("[data-chapter]").forEach((sec) => {
      ScrollTrigger.create({
        trigger: sec, start: "top center", end: "bottom center",
        onToggle: (st) => {
          if (!st.isActive) return;
          items.forEach((li) => li.classList.toggle("is-active", li.dataset.rail === sec.dataset.chapter));
        },
      });
    });
  }

  function cursor() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const c = $(".cursor"), label = $(".cursor-label");
    const cx = gsap.quickTo(c, "x", { duration: 0.35, ease: "power3" });
    const cy = gsap.quickTo(c, "y", { duration: 0.35, ease: "power3" });
    const lx = gsap.quickTo(label, "x", { duration: 0.35, ease: "power3" });
    const ly = gsap.quickTo(label, "y", { duration: 0.35, ease: "power3" });
    window.addEventListener("mousemove", (e) => { cx(e.clientX); cy(e.clientY); lx(e.clientX); ly(e.clientY); });
    document.addEventListener("mouseover", (e) => {
      const t = e.target.closest("a, button, [data-cursor]");
      c.classList.toggle("is-hover", !!t);
      const text = t && t.dataset.cursor;
      label.textContent = text || "";
      label.classList.toggle("is-on", !!text);
    });
  }

  /* ---------------------------------------------------------
     Reduced motion / no GSAP: a calm, fully visible page
     --------------------------------------------------------- */
  function staticMode() {
    state.frame = FRAME_COUNT - 1;
    state.push = 1;
    render();
    const show = (sel, styles) => $$(sel).forEach((el) => Object.assign(el.style, styles));
    show(".loader", { display: "none" });
    show(".letterbox, .hud__row, .captions, .brand__lock", { display: "none" });
    show(".brand__ring, .brand__glint, .brand__sub, .brand__line .ch, .nav, .rail", { opacity: "1", transform: "none" });
    show(".manifesto .w", { opacity: "1" });
    show(".motion__aperture", { clipPath: "none" });
    show(".motion__video", { transform: "none" });
    show(".stills__pin", { height: "auto", overflowX: "auto", padding: "120px 0" });
    show(".stills__intro", { position: "relative", transform: "none", top: "auto", marginBottom: "40px" });
    show(".stills__track", { paddingLeft: "var(--gutter)" });
    document.body.classList.remove("is-loading");
  }
})();
