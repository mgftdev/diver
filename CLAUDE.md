# Double Take — agent notes

Landing page + lead API for a studio that builds digital twins: an avatar and a voice
clone that ship vertical video without the person being on set. Plans $300 / $1,000 /
$2,500 a month.

Written in English. The site's audience is international; the repo owner works in
Romanian, so explanations go in Romanian while all code, copy and comments stay English.

## Stack

HTML + **Tailwind CSS v4 (CLI)** + **vanilla ES modules** on the front, **Node 22 +
Express 5** on the back. No bundler, no framework, no native dependencies.

```bash
npm run dev      # Tailwind --watch + nodemon, http://localhost:3000
npm run build    # minified stylesheet — REQUIRED before deploying
npm start        # production
```

### Rebuild the CSS after any class change

There is no watcher outside `npm run dev`. Adding a class — especially an arbitrary
value like `max-w-[52ch]` — does nothing until `npm run build` regenerates
`public/assets/css/site.css`. If a style "isn't applying", check this first.

Design tokens live in one `@theme` block in `src/styles/tailwind.css`; component
classes in `@layer components` below it. Change a token there and the whole site
follows. Do not introduce a colour outside that block.

## Layout

```
public/            served to the browser; assets/css/site.css is BUILD OUTPUT (git-ignored)
  assets/js/main.js + modules/   api · nav · planPicker · leadForm · availability · marquee · diver · cursorAura
                                 · timecode · reveal · dottedSurface
  assets/img/diver/seq/          f000…f060.webp — the head-turn frame sequence
kling/                           generation workspace: source stills, aligned start/end, not served
diver.mp4                        the Kling clip the sequence was cut from, not served
backup/                          index + stylesheet as they were before the redesign
  admin.html + assets/js/admin.js   lead inbox, needs ADMIN_TOKEN
src/styles/tailwind.css            @theme tokens + components
server/
  index.js  app.js  config.js
  routes/ controllers/ services/ repositories/ validators/ middleware/ lib/
data/              leads.ndjson (git-ignored)
```

**The layering is enforced, not decorative.** A controller never touches the store; a
service never reads `req`; `server/repositories/leads.repository.js` is the only module
that knows how leads are persisted. Moving to Postgres means rewriting that one file's
four exported functions and nothing above them.

`server/config.js` is the only place that reads `process.env`.

## API

| Method | Path | Auth |
| --- | --- | --- |
| `GET` | `/api/health` | — |
| `GET` | `/api/availability` | — |
| `POST` | `/api/leads` | — (5 per 15 min per IP) |
| `GET` | `/api/leads` | `X-Admin-Token` or `Authorization: Bearer` |

Errors always return `{ ok: false, error: { code, message, details? } }`; `details` is
an array of `{ field, message }` that the client maps onto form fields.

Spam handling is three layers, no captcha: off-screen honeypot, a 1.2s minimum fill
time, and the rate limiter.

`/api/availability` drives the "Slots open for <month>" line, so that number comes from
`MONTHLY_SLOTS` minus leads marked `booked` — it is never a hard-coded claim.

## The hero composition — read before touching it

`public/index.html` lays the diver behind the headline. Several values look arbitrary
and are not. Full reasoning is in the `hero-compositing` skill.

The diver is a **61-frame image sequence** drawn on a canvas. `[data-diver]` holds a
resting `<img>` (`seq/f000.webp`) and a `<canvas>`; `modules/diver.js` draws
`assets/img/diver/seq/f000…f060.webp` onto the canvas as the page scrolls — the head
turning from the headline on the left to the stats on the right. Blend, blur,
brightness and mask live on the **box**, never on its children, so everything inside
composites as a single image.

Where the frames came from, in case they need regenerating:

1. Five stills generated in ChatGPT by the owner — archived in `kling/stills/`.
2. The first and last were **registered onto each other** (torso brute-force search:
   the generator had drifted 44–60px between stills) and exported as
   `kling/diver-start.png` / `kling/diver-end.png`.
3. Those went into Kling image-to-video as start and end frame → `diver.mp4` in the
   root (876×1052, 24fps, 5.04s). Because the ends were pre-aligned, the body holds
   within ~14px across the whole clip, so the frames need **no per-frame correction**.
4. Every second frame extracted with ffmpeg (`pip install imageio-ffmpeg` bundles one),
   encoded as WebP q70 → 61 frames, ~2 MB.

Why an image sequence and not the MP4 itself: an ordinary MP4 is keyframed sparsely, so
scrubbing it backwards by scroll stutters. Single images are instant in both directions.

- **The clip carries a "KlingAI 3.0" watermark** (free tier), bottom-right, at ~78–93%
  × 94–97% of the frame. It was deliberately **not cropped** — the owner has not
  confirmed Kling's free-tier terms for commercial use. On the page it lands inside the
  edge vignette of `.mask-robot` (effective opacity ≈ 0.01%) and under the translucent
  band, so it does not show. If the mask is ever widened, re-check this.
- **Scroll maps linearly to frames.** The clip eases in and out by itself; easing the
  mapping too made both ends of the turn crawl.
- Adjacent frames are blended (lower at 1, next fading in over it) so slow scrolling
  between two frames stays smooth.
- **Phones load every second frame** (31) — decoded bitmaps, not bytes, are what runs
  out on a phone. Desktop loads all 61.
- The resting frame loads first with `fetchpriority="high"`; the other frames load only
  once the animation actually starts, so reduced-motion visitors never download them.
- **The diver holds still until the band has covered him — no page pinning.** The
  module translates the box down by exactly what the page scrolls, so the diver stays
  put while content flows past. The head turn plays over the first
  `clamp(260px, 50vh, 560px)`; the hold lasts longer — until the band's top reaches the
  diver's top (`coverDistance`, measured from the DOM on load/resize, ~770px at
  1440×900). By then the band is opaque and the hero ends at its bottom edge, so the
  diver has disappeared under it; only then does he move with the page (still hidden).
  Owner's request: "the diver disappears under the carousel". No scroll hijack.
- **That translation must stay 2D** — `translate()`, never `translate3d()`. A 3D
  transform promotes the box to its own compositing layer, where `mix-blend-screen`
  loses the glow and the black box comes back. Found by A/B, not assumed. (A canvas
  *inside* the box is fine — verified.)
- **The hero has `pb-0`.** The band must be the hero's last pixel: the hold carries the
  diver downwards, and any padding below the band would show it as a stray sliver.
- `prefers-reduced-motion` and no-JS: the resting `<img>` only; the canvas stays hidden
  until the script marks it `data-ready`.

- **`isolate` belongs on the `<section>`, not the `<h1>`.** On the h1 it walls
  `mix-blend-screen` off from the hero glow and the render comes back as a black box.
- **`-translate-y-[2%]` anchors the helmet crown.** It is a percentage of the box's
  own height, so resizing extends the figure downwards and the crown stays put. 2% is
  where the crown sits in the *last* frame; in the first it sits at 5.1% (the head lifts
  as it turns). Anchoring to the last frame keeps the finished turn from rising behind
  the nav bar; at rest the crown is ~3% lower.
- **`.mask-robot`'s radial horizontal radius must stay ≤ 50%**, or the fade is still
  opaque at the box edge and both sides show a vertical seam.
- **Height is in `vw`, deliberately not `em`.** The figure is the centrepiece; making
  the headline smaller must not shrink it.
- **`top` is a clamp with a `vw` term, not a fixed offset.** Anchoring survives size
  changes but not viewport changes: a flat `-10.2rem` puts the crown under the nav at
  2000px and 46px *behind* it at 375px.
- `brightness-[0.72] blur-[1px]` are depth cues and legibility, not decoration. This
  render has far more bright metal than a silhouette; at full strength the visor washes
  out the headline.

Current: `h-[clamp(340px,46.5vw,1050px)]`, `top-[clamp(-10.2rem,-8vw,-3.5rem)]` — 930px
tall at 2000px, capped at 1050px from 2258px up; crown 6px below the nav at 2000px and
56–63px below it at 375–1280px.

Regression checks for the figure:

- **No sliver below the tool band.** Assert the hero's bottom equals the band's bottom
  (`pb-0`); with the diver moving during the hold, that is the only safe arrangement.
- **The hold works.** The crown's screen y is identical at scroll 0 and at scroll ~150
  (375px) / ~300 (2000px).
- **The band covers him.** At scroll = `coverDistance` the rig's top equals the band's
  top, and beyond it they move together (0px of diver above the band).
- Screenshots of scroll states in a hidden pane: override `window.scrollY` with a getter
  and translate `<main>` by `-scrollY`, then dispatch `resize`. The page renders exactly
  what that scroll position shows while the real scroll stays 0 (which is paintable).
- **The turn plays.** Read the canvas: the x of the helmet lamp (warm pixels, top 16%)
  should rise monotonically from ~306 to ~495 as scroll goes 0 → the turn distance.
- **Frames fetched:** 61 on desktop, 31 at 375px.
- A preview pane that is hidden pauses `requestAnimationFrame`, so scroll-driven renders
  never fire there. Test by scrolling and then dispatching `resize` — the module's resize
  path renders through `setTimeout`.
- **The band is a curtain** (`[data-diver-curtain]`). At rest it is translucent
  (`bg-ink-2/60`), because an opaque band slices the figure in a straight line across
  the hero. `diver.js` then raises it to fully opaque over the first 120px of scroll, so
  the held diver disappears *under* it as the page rises (owner's request) instead of
  showing through. The opacity is written as `color-mix(… var(--color-ink-2) N% …)` —
  from the token, and it equals the markup's own class at 0 scroll. Regression check:
  band alpha is 0.6 at scroll 0 and 1 at scroll ≥ 120.

## The tool marquee

`public/assets/js/modules/marquee.js` exists because the CSS loop
(`translateX(-50%)`) only reads as continuous while **one half of the track is at least
as wide as the viewport**. The two copies in the markup measure ~1833px per half —
fine to ~1800px, a 167px hole at 2000px. The module measures one copy and repeats it
until a half out-runs the viewport, keeping the halves equal so `-50%` stays exact.

- The markup must keep shipping **exactly two identical copies** — the module takes the
  first half as its base unit.
- Entries use the `.marquee-item` class. Do not inline the classes again; the module
  clones `outerHTML`.
- Regression check: `track.width / 2 >= innerWidth` at 375 / 768 / 1280 / 2000 / 2560px.

## The cursor aura

A faint amber glow trails the mouse (`.cursor-aura` in `tailwind.css`,
`modules/cursorAura.js`, one `<div data-cursor-aura>` after the footer). It is meant to
be barely noticed — it warms the area round the pointer, it does not light it.

- **Intensity lives in the gradient stops** (`9%` centre, `4%` at 45%, transparent at
  the edge, 560px circle). Raise those to make it more visible; do not add opacity
  elsewhere.
- **Plain alpha, no `mix-blend-mode`.** The element moves every frame, so it sits on its
  own compositing layer — the exact situation in which a blended element loses its
  backdrop (see the hero notes). On this near-black page low-alpha orange looks the same
  as a screen blend, without the risk.
- `z-40`: above page content, below the sticky nav (`z-50`); `pointer-events: none`, so
  it never intercepts a click.
- Mouse only. Hidden on touch/coarse pointers and for `prefers-reduced-motion`; the
  module also ignores pen and touch `pointermove` events.
- The trail is an ease toward the pointer (`EASE = 0.14` per frame); the loop stops once
  it settles, so an idle mouse costs nothing.

## Page structure — the page is a cut in four scenes

Adopted from a redesign built with the `ui-ux-pro-max` skill ("scroll-triggered
storytelling"). Its generic output was only partly used: the story structure was kept,
its black-and-white palette and all-Inter typography were rejected because they erase
the amber identity the diver's lights carry. The previous page is in `backup/`.

Order: **hero** → **Scene 01 The problem** (idea + the arithmetic) → **Scene 02 The
process** (film strip + what the work covers) → **Scene 03 The price** (plans + one-off
rates) → **Finale** (FAQ + booking). Each scene is a `.scene[data-scene]` wrapper with a
`.scene-slate` header; 01 and 02 close with a `.scene-next` mini call to action.

- **The amber builds scene by scene** — `.scene--1…--finale` set `--scene-glow` from 3%
  to 11%, peaking at the booking form. Keep it rising; that is the point.
- **The arithmetic sits in Scene 01**, not near the end: it states the problem the page
  solves. It is one `<table class="versus">` so each "before" sits beside its "after";
  on phones the rows become label + pair via `data-label` and `::before`. The
  strikethrough is on `.versus__value`, not the cell — a decoration on the cell would
  propagate into that `::before` label and cannot be undone there.
- **Process is a film strip** (`.filmstrip`, sprocket holes from pseudo-elements).
  Frame 02 is highlighted "Your part" because the headline says the client's time goes
  into the second step — the old page highlighted step 01, contradicting its own copy.
- **Booking finale:** the last frame of the head turn (`seq/f060.webp`) sits behind the
  form, facing it. The form has its own near-opaque surface so its small labels keep
  4.5:1 over the diver's bright metal. Hidden below `lg`.
- **Nav timecode** (`modules/timecode.js`): scene number + SMPTE timecode that reads the
  page as a 90-second cut, and a 1px amber progress bar under the nav. `xl` and up.
- **Reveals** (`modules/reveal.js`) are opt-in: content is visible by default, and only
  once the script adds `reveal-ready` to `<html>` does CSS hide what has not been
  revealed. Anything on screen at start-up is revealed synchronously.
- **Contrast**: `--color-ash` #7a7c88 (4.83:1) and `--color-shadow-text` #5c5d66 (3.06:1,
  large text) were lifted from values that failed AA (3.74 and 1.60 — half the H1 was
  below the minimum). Marquee names #5b5d6a (3.07:1). Keep these as the floor.

### The dotted surface (Scene 01)

A three.js dotted wave (`modules/dottedSurface.js`), ported from a React/shadcn
"DottedSurface" the owner supplied. Not ported as React on purpose — this site has no
framework, and adopting Next.js + shadcn + TypeScript for one background effect would
mean rewriting the site.

- `three` is a runtime dependency, served unbundled by `app.js` at `/vendor/three/`
  straight from `node_modules/three/build` (0.186 ships no minified build: ~2 MB,
  compressed on the wire). **Bundling/minifying three is the biggest remaining payload
  win** if performance becomes a concern.
- It is `import()`ed only when Scene 01 comes within 600px of the viewport, renders into
  a sticky viewport-tall layer inside the scene, pauses off screen and in hidden tabs,
  and draws one still frame under reduced motion.
- The host must not get `overflow: hidden` — it would become the sticky layer's scroll
  container and the layer would stop sticking.
- The original's colour buffer used 0–255 values in a 0–1 attribute (every dot clamped
  to white); the port uses real 0–1 colours read from the design tokens.
- Testing in a hidden preview pane: `IntersectionObserver` never fires there. Stub it to
  report "intersecting" and `import()` the module with a cache-busting query.

## Deploy — GitHub Pages

Repository: https://github.com/mgftdev/diver (public — required for Pages on a free
account). Live at **https://mgftdev.github.io/diver/**. Every push to `main` runs
`.github/workflows/deploy.yml`: `npm ci` → `npm run build` (Tailwind) →
`npm run build:static` → upload `dist/` → publish. A failed build never replaces the
live site. One-time repo setting: **Settings → Pages → Source: GitHub Actions**.

**Pages is static.** The Express server is not deployed; `public/` stays exactly as it
runs locally, and `scripts/build-static.mjs` adapts only the copy in `dist/`:

- Prefixes root-absolute URLs (`href`/`src`/`content`/`data-frames` in HTML, string
  literals in JS) with `BASE_PATH`, which CI takes from `actions/configure-pages`
  (`/diver`). Empty for a custom domain at the root.
- Bundles `three.module.js` + `three.core.js` into one minified module at
  `dist/vendor/three/three.module.js` (2.07 MB → 725 KB) — the path `dottedSurface.js`
  already imports.
- Drops `admin.html`/`admin.js`, writes `.nojekyll`.
- **Fails** if a root-absolute URL survives, if `site.css` is missing, or if
  `BASE_PATH` is not a URL path. **Notes** (does not fail) the `/api/` calls.

Consequences that are live on Pages until changed:

- **The booking form cannot submit** — `/api/leads` does not exist there; the form
  shows its error message. Fix: point the form at a hosted form service (Web3Forms or
  Formspree), which is a small change to `api.js`/`leadForm.js` — deliberately not made
  yet: the owner asked for no changes to the site code in the deploy step.
- `/api/availability` 404s; `availability.js` keeps the month and slot number written in
  the HTML, so update those by hand.
- No Helmet CSP headers (Pages cannot set headers).

Testing the Pages build locally — serve `dist/` under `/diver/`, not at the root, or
path bugs stay invisible:

```bash
npm run build && MSYS_NO_PATHCONV=1 BASE_PATH=/diver npm run build:static
# then copy dist/ to <tmp>/diver/ and run: python -m http.server 8766 in <tmp>
```

`MSYS_NO_PATHCONV=1` matters in Git Bash on Windows: without it `BASE_PATH=/diver` is
silently rewritten to `C:/Program Files/Git/diver` (the script now refuses that).

Kept out of the public repo by `.gitignore`: `.env`, lead data, `dist/`, `diver.mp4` (the
Kling clip with its watermark), `kling/`, the root `robot*.png` renders, `.claude/`.
Commits use `mgftdev@users.noreply.github.com` so no personal address is published.

## Verifying visual work

Screenshot at the preview pane's real width. **At anything wider, measure the DOM
instead** — the pane cannot faithfully paint an emulated viewport much wider than
itself, and the unpainted region looks identical to empty page.

Assert `document.body.scrollWidth - innerWidth <= 0` at 375 / 981 / 1440 / 2000px.
`max-w-none` on the hero image is the usual cause of sideways scroll.

The container is `max-w-[1920px]` with `clamp(18px,4vw,80px)` gutters — 96% of a 2000px
display. Because of that width, text blocks carry their own `ch` caps; `ch` is
font-relative (~0.62em body, ~0.88em display), so never reuse a cap across faces.

## Outstanding

- `public/assets/img/robot.png` (1.9 MB) is **no longer loaded by the hero** — the five
  WebP stills replaced it at ~800 KB total. It survives only as the `og:image`; swap
  that for a frame when convenient. `sharp` is no longer needed.
- `prefers-reduced-motion` handling in `diver.js` is implemented but was not exercised
  in a browser — the preview pane cannot emulate the media query.
- Placeholders before launch: the Telegram link (`https://t.me/`),
  `hi@doubletake.studio`, "since 2023" in the slate, and the 40 / 48 / 90 hero figures.
- The filename says `robot.png` but the render is a pressurised diving suit. Left as-is
  to avoid churning the OG tag.
- `dubl.html` in the root is the original single-file version, still the source of a
  published artifact. Not part of the build.

## Conventions

- Comments explain *why* a non-obvious value is what it is, and are kept true — if a
  value changes, the comment changes in the same edit.
- Copy is written from the reader's side: active voice, concrete numbers, no filler.
- Every interactive element needs a visible `focus-visible` state.
- One accent colour (`--color-flare`). Semantic colours are separate and never borrow it.
