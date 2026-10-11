# Tubo Shot This: cinematic scroll site

A static, single-page site for the videography and photography studio
**Tubo Shot This**. As you scroll, a lens film plays frame by frame. The camera
pushes into the glass and the brand name resolves on the lens. After that, the
story continues through six chapters: The Eye, Stills, Motion, Process,
Services and Contact.

## Run locally

There is no build step. Serve the folder over HTTP, because opening the file
directly with `file://` won't load the frames:

```bash
cd tubo-shot-this
python3 -m http.server 8080   # then open http://localhost:8080
```

You can deploy it to any static host (Netlify, Vercel, GitHub Pages, S3) by
uploading this folder as is.

## How the hero works

- `assets/sequence/` holds 239 WebP frames (720×1280) cut from the source
  video. The frames are painted to a `<canvas>` and scrubbed by scroll, which
  keeps it frame-accurate on every browser, including Safari.
- The "Ud" mark that faded in on the lens at the end of the original video is
  removed. The sequence stops before the mark appears. The final shot
  (`assets/lens-end.webp`) is the last frame with the mark and the viewfinder
  lines inpainted out. The push into the lens is rebuilt on the canvas, and
  "TUBO SHOT THIS" is set over the glass as live HTML text.
- `js/main.js` runs the whole timeline: GSAP + ScrollTrigger, plus Lenis for
  smooth scrolling. The libraries are vendored in `js/vendor/`, so the site
  needs no third-party CDN apart from Google Fonts.
- If the visitor has `prefers-reduced-motion` turned on, the page skips the
  pinned scenes and shows the lens and brand as a still.

## Before launch

- **Font:** add the licensed Hebra files. See `fonts/README.md`.
- **Contact:** `hello@tuboshotthis.com` and the social links in `index.html`
  are placeholders.
- **Footage:** the two clips in `assets/video/` came from the supplied ZIP.
  Confirm you have the rights to use them.
