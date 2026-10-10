/* =========================================================
   Scroll-scrubbed film — draws a 240-frame image sequence
   onto a canvas (plus a blurred ambient copy behind it).
   Frames load progressively: keyframes first, then the gaps.
   ========================================================= */
export class FrameSequence {
  constructor({ canvas, bg, count, path, fps = 20, onFirst }) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.bg = bg; this.bgCtx = bg?.getContext('2d');
    this.count = count; this.path = path; this.fps = fps;
    this.frames = new Array(count);
    this.loaded = new Uint8Array(count);
    this.current = -1; this.target = 0;
    this.onFirst = onFirst;
    this.resize();
    addEventListener('resize', () => { this.resize(); this.draw(this.current, true); });
  }

  src(i) { return this.path(i + 1); }

  // load a subset of frames; resolves when they're all decoded
  loadSet(indices) {
    return Promise.all(indices.map((i) => this.loadFrame(i)));
  }
  loadFrame(i) {
    if (this.frames[i]) return this.frames[i].p;
    const img = new Image();
    img.decoding = 'async';
    const p = new Promise((res) => {
      img.onload = () => { this.loaded[i] = 1; if (i === 0) { this.draw(0, true); this.onFirst?.(); } if (Math.abs(i - this.target) < 6) this.draw(this.target, true); res(); };
      img.onerror = () => res();
    });
    img.src = this.src(i);
    this.frames[i] = { img, p };
    return p;
  }
  // everything, in passes of decreasing stride
  async loadAll() {
    for (const stride of [8, 4, 2, 1]) {
      const set = [];
      for (let i = 0; i < this.count; i += stride) if (!this.frames[i]) set.push(i);
      // a few at a time so the network isn't flooded
      for (let k = 0; k < set.length; k += 12) await this.loadSet(set.slice(k, k + 12));
    }
  }

  nearestLoaded(i) {
    if (this.loaded[i]) return i;
    for (let d = 1; d < this.count; d++) {
      if (i - d >= 0 && this.loaded[i - d]) return i - d;
      if (i + d < this.count && this.loaded[i + d]) return i + d;
    }
    return -1;
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(2, Math.round(r.width * dpr));
    this.canvas.height = Math.max(2, Math.round(r.height * dpr));
    if (this.bg) { this.bg.width = 96; this.bg.height = 54; }
  }

  set(progress) {
    this.target = Math.min(this.count - 1, Math.max(0, Math.round(progress * (this.count - 1))));
    this.draw(this.target);
    return this.target;
  }

  draw(i, force = false) {
    const k = this.nearestLoaded(i);
    if (k < 0 || (k === this.current && !force)) return;
    this.current = k;
    const img = this.frames[k].img;
    this.cover(this.ctx, img, this.canvas.width, this.canvas.height);
    if (this.bgCtx) this.cover(this.bgCtx, img, this.bg.width, this.bg.height);
  }

  cover(ctx, img, W, H) {
    const ir = img.naturalWidth / img.naturalHeight, cr = W / H;
    let w, h;
    if (ir > cr) { h = H; w = H * ir; } else { w = W; h = W / ir; }
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  }
}
