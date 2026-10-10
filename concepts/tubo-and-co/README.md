# Tubo & Co. — cinematic concept site

A portfolio and pitch concept for a fictional law firm, **Tubo & Co.**: a single-page,
scroll-driven experience set in a marble hall at night. Static HTML, CSS and JavaScript.
There is no build step.

## Run it

Serve the folder with any static server that supports HTTP range requests (needed for
video seeking), for example:

```bash
npx http-server concepts/tubo-and-co -p 8080
```

Then open http://localhost:8080. Opening `index.html` straight from disk won't work,
because ES modules need to be served over HTTP.

## The chapters

| § | Chapter | What happens |
|---|---------|--------------|
| — | Preloader | The firm's name sets in Cinzel capitals, a § counter runs to 100, then two curtains part. |
| 0 | **The Hall** | A real-time Three.js colonnade: fluted marble columns, a mirror-marble floor with brass inlay, drifting dust and a volumetric light shaft. The Lady Justice film is composited into the scene additively, so she floats over her own reflection. Scrolling walks the camera down the nave. |
| I | The Firm | A manifesto that lights up word by word as you scroll, beside the cut-out bronze Justice. A hand-drawn signature writes itself in. |
| II | In Chambers | An arched window opens to full screen on the corridor footage of robed counsel. |
| III | Practice | Six "dossier" cards on a pinned horizontal scroll, each with 3D hover tilt and a statute citation. |
| IV | **The Record** | The gavel strike is scrubbed by scroll in slow motion. On impact the screen flashes and shakes, "Ruled." slams in and the figures count up. |
| V | **Weigh Your Matter** | An interactive 3D brass scale. Tap facts for and against, and weights drop into the pans and tip the beam. You can drag to rotate it. |
| VI | Method | Four steps beside a sticky arched video that changes from the scales to the signing footage. |
| VII | Selected Matters | A docket-style case list. Hovering a row shows a floating photo. |
| VIII | The Brief | The camera-rig footage, framed as the firm's film and podcast series. |
| IX | Retain Counsel | A confidential enquiry form over the signing footage. It validates input but sends nothing. |

## Assets

All photos and videos come from the supplied `Law_Firm.zip`:

- Videos were re-encoded to H.264 MP4 plus VP9 WebM, with audio removed and `faststart` set.
- The gavel clip was reversed, slowed 4× with motion interpolation, and encoded all-intra so it scrubs smoothly. The "NOT Guilty" overlay was trimmed off.
- The bronze Lady Justice was cut out of its fake checkerboard background (`assets/img/justice-bronze.webp`).
- The marble textures, columns, light shaft, dust and the brass scales are all generated in code.

## Stack

- [three.js](https://threejs.org) 0.160 (Reflector, RoomEnvironment, UnrealBloom)
- [GSAP](https://gsap.com) 3.12.5 + ScrollTrigger
- [Lenis](https://lenis.darkroom.engineering) 1.1.13 smooth scroll
- Type: Bodoni Moda, Cinzel, Hanken Grotesk and IBM Plex Mono (Google Fonts)

If the browser has no WebGL, the hero falls back to the Lady Justice video. Users who
prefer reduced motion get a static, fully readable page with no pinning or smooth scroll.

## Editing content

All copy lives in `index.html`. Firm details, matter names and figures are placeholders
for the concept.

## Walkthrough films

`walkthrough/` holds three portfolio films (H.264, 30fps, about 1:48 each). They were
recorded frame by frame in headless Chromium on a virtual clock, so the scroll, the 3D
scenes and the videos stay perfectly smooth.

- `tubo-and-co-desktop-walkthrough.mp4`: 1920×1080
- `tubo-and-co-phone-walkthrough.mp4`: 1080×1920, vertical for Reels, Shorts and TikTok
- `tubo-and-co-phone-showcase.mp4`: 1920×1080, the phone recording in a device frame on a branded background
