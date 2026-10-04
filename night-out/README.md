# Night Out — cinematic cocktail-house concept

A scroll-driven, single-page concept site for a fictional cocktail bar. Scrolling the page plays out one night:
the header clock runs from 21:00 to 03:00 as you move through it.

Standalone static site with no build step and no dependency on the rest of this repository.

## Run locally

```bash
cd night-out
python3 -m http.server 8080   # or: npx serve .
# open http://localhost:8080
```

Serve it over HTTP rather than opening `index.html` directly, so the frame sequences load reliably.

## Story structure

| # | Section | Technique |
|---|---------|-----------|
| — | Threshold loader | Coarse-to-fine frame preloading, age confirmation, curtain wipe |
| 01 | **Story (hero)** | 164-frame canvas sequence scrubbed by scroll, 4 acts, live "Now pouring" ticker synced to each of 13 drinks, blurred ambient light canvas |
| 02 | Manifesto | Word-by-word reading reveal, inline image pills, counters |
| 03 | The signature | Second scrubbed sequence (smoke bubble), 3-step choreography |
| 04 | Signatures | Pinned horizontal track with per-card parallax (native swipe on mobile) |
| 05 | Ritual | Film expands from a window to full bleed; blend-mode type |
| 06 | Back bar | Sticky film + spirit index with cursor-following image reveal |
| 07 | Kitchen | Layered parallax collage, pairings |
| 08 | The week | Hover-reveal programme list |
| 09 | The room | Dual marquee whose speed follows scroll velocity |
| 10 | Reserve | Validated booking form → animated ticket (front-end only) |
| — | Last call | Letter-by-letter wordmark |

## Stack

- GSAP 3.15 (ScrollTrigger, SplitText) and Lenis 1.3, vendored in `vendor/`
- Self-hosted Cormorant Garamond, Inter Tight and JetBrains Mono (`assets/fonts/`)
- Vanilla HTML/CSS/JS

## Accessibility and performance

- `prefers-reduced-motion`: smooth scroll, parallax, marquee and grain are switched off. Scroll sequences stay because the user drives them directly.
- Keyboard focus styles, skip link, labelled form fields with inline errors, `aria` on the menu overlay.
- Frames are WebP, loaded in a coarse-to-fine order (every 8th frame first) so scrubbing works before everything arrives.
- Videos are muted, compressed H.264 that plays only while on screen.

## Media

All photography and footage came from the client-provided archive. The final second of the hero source clip
carried a third-party venue logo and was trimmed out. Before using this commercially, confirm usage rights
for the stock and social footage, or swap in a shoot.
