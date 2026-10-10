# Tubo's Stitch — a cinematic, scroll-told atelier

A concept website for a bespoke tailoring house. One golden thread runs through the whole page: it is threaded through a needle in the prologue, sews a running stitch under the manifesto, and is finally drawn into a heart at the end. The palette chapter lets visitors choose its colour.

## The story (scroll order)

| # | Chapter | What happens |
|---|---|---|
| — | **Loader** | A needle is threaded while assets load, then the screen is cut open along a stitched seam. |
| 00 | **Prologue** | A 3D steel needle and live thread loop through the "Tubo's Stitch" title. |
| I | **The Thread** | The manifesto lights up word by word while the needle sews a real running stitch across the screen (a hidden depth plane makes the thread dip "under the cloth"). |
| II | **The Measure** | Background turns to bone paper. A 3D tailor's tape unrolls from its coil as you scroll, measurements count up, and the green tape film plays. |
| III | **The Cloth** | A hanging WebGL drape with sheen and twill weave. It ripples under the cursor. Five swatches (wool, satin, linen, velvet, tweed) change the material live. |
| IV | **The Making** | The landing film becomes a 240-frame scroll-scrubbed sequence with a camera HUD and six story beats: feel, cut, pin, thread, set, stitch. |
| V | **The Palette** | Eight 3D thread cones hang on strings next to the real thread-cone footage. Hover or click a cone, or a name in the list, to recolour the site's thread. |
| VI | **The Fitting** | The mannequin photo with annotated details, the four services, and the process timeline. |
| VII | **The Knot** | The thread draws a heart (a nod to the 🧵❤️ opening of the landing video), followed by the booking form, which remembers your thread colour. |

The page shifts between ink and bone tones as you move through the chapters. Throughout, you get a needle cursor with a physics thread trailing behind it, a tape-measure progress ruler, film grain, an optional soundtrack taken from the landing film, and soft stitch "ticks".

## Run it

The site uses ES modules, so serve it over HTTP rather than opening the file directly:

```bash
cd tubos-stitch
npx serve .            # or: python3 -m http.server 8080
```

No build step. Three.js, GSAP + ScrollTrigger and Lenis are vendored in `vendor/`, so the site works offline. Only the Google Fonts need a network connection, and fallbacks are defined.

## Structure

```
index.html          markup + story copy
css/style.css       design system, layout, responsive rules
js/main.js          director: loader, smooth scroll, themes, reveals, cursor, sound, interactions
js/scene.js         WebGL: needle + live thread tube, tape measure, cloth shader, spools, dust
js/sequence.js      progressive image-sequence scrubber for the film chapter
assets/seq/         240 WebP frames cut from the landing film (3.4 s → 15.4 s, 20 fps)
assets/video/       re-encoded thread-cone and tape-measure loops + posters
assets/img/         tape-measure and mannequin stills, og image
assets/audio/       soundtrack extracted from the landing film
```

## Notes

- Respects `prefers-reduced-motion`: smooth scrolling and the decorative loops are switched off.
- Touch devices get the native cursor. The film chapter goes full-bleed with captions overlaid.
- The booking form is front-end only (it shows a confirmation and does not send anything).
