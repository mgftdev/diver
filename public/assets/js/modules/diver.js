/**
 * Scroll-driven head turn for the hero diver.
 *
 * A 61-frame image sequence (every second frame of a 24fps clip) is drawn onto a
 * canvas inside [data-diver] as the page scrolls. An image sequence rather than a
 * scrubbed <video>: ordinary MP4s are keyframed sparsely, so seeking backwards
 * stutters; single images are instant in both directions.
 *
 * The hold — the diver staying still on screen while the page scrolls, until the tool
 * band has swept up over him — is CSS `position: sticky`, set up once here (see
 * .diver-track in tailwind.css). It used to be a transform written on every scroll
 * event; browsers scroll on a separate thread, so that transform always arrived a
 * frame late and the diver visibly jittered, worst right after a reload while the
 * main thread was busy. Sticky is applied by the compositor in the same frame as the
 * scroll, so it cannot lag.
 *
 * Per scroll, script now only picks the head-turn frame and the band's opacity —
 * neither moves anything, so being a frame behind is invisible.
 */

const MIN_TURN_PX = 260;
const MAX_TURN_PX = 560;
const TURN_VIEWPORT_SHARE = 0.5;
const RESIZE_DEBOUNCE_MS = 150;
const LOAD_CONCURRENCY = 4;
// Phones draw a 340px figure; every second frame is plenty there and halves the
// decoded-bitmap memory, which is what actually runs out on a phone.
const NARROW_QUERY = '(max-width: 767px)';
// The tool band starts translucent (60%) and is fully opaque after this much scroll,
// so the held diver disappears under it instead of showing through.
const CURTAIN_REST = 60;
const CURTAIN_CLOSED_PX = 120;

export function initDiver() {
  const rig = document.querySelector('[data-diver]');
  const canvas = rig?.querySelector('canvas');
  const pattern = rig?.dataset.frames;
  const count = Number(rig?.dataset.frameCount);
  const hero = rig?.closest('section');
  if (!rig || !canvas || !pattern || !count || !hero) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const curtain = document.querySelector('[data-diver-curtain]');

  const step = window.matchMedia(NARROW_QUERY).matches ? 2 : 1;
  const indices = [];
  for (let i = 0; i < count; i += step) indices.push(i);
  if (indices[indices.length - 1] !== count - 1) indices.push(count - 1);

  const url = (i) => pattern.replace('{n}', String(i).padStart(3, '0'));
  const frames = new Array(indices.length).fill(null); // decoded HTMLImageElements

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let turnDistance = MIN_TURN_PX;
  let queued = false;
  let lastKey = '';
  let running = false;
  let restRequested = false;

  // ---- loading ------------------------------------------------------------

  const loadFrame = (slot) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = async () => {
        // Decode off the main thread now, so the first drawImage of this frame
        // during a scroll does not stall on a synchronous decode.
        await img.decode().catch(() => {});
        frames[slot] = img;
        resolve();
      };
      img.onerror = () => resolve(); // a missing frame falls back to its neighbour
      img.src = url(indices[slot]);
    });

  const loadRest = async () => {
    let next = 1;
    const worker = async () => {
      while (next < indices.length) {
        const slot = next++;
        await loadFrame(slot);
        if (running) {
          lastKey = ''; // a frame the current position wanted may have just arrived
          schedule();
        }
      }
    };
    await Promise.all(Array.from({ length: LOAD_CONCURRENCY }, worker));
  };

  /** Nearest decoded frame to `slot`, searching outward. */
  const nearest = (slot) => {
    for (let d = 0; d < frames.length; d++) {
      if (frames[slot - d]) return frames[slot - d];
      if (frames[slot + d]) return frames[slot + d];
    }
    return null;
  };

  // ---- the hold: lift the rig into a sticky track, once ----------------------

  let anchor = null;
  let track = null;
  let lifted = false;

  /**
   * The anchor is an invisible copy of the rig's box left where the rig was, inside
   * the h1, so it keeps following the headline's layout (web fonts arriving, resizes).
   * Every hold value is measured from it; nothing is hard-coded.
   */
  const measureHold = () => {
    if (!lifted) return;
    const a = anchor.getBoundingClientRect();
    const h = hero.getBoundingClientRect();
    hero.style.setProperty('--diver-track-top', `${Math.round(a.top - h.top)}px`);
    hero.style.setProperty('--diver-left', `${Math.round(a.left - h.left)}px`);
    // The viewport offset to hold at: where the diver rests with the page at the top.
    hero.style.setProperty('--diver-hold-top', `${Math.round(a.top + window.scrollY)}px`);
  };

  const lift = () => {
    if (lifted) return;
    anchor = document.createElement('div');
    anchor.className = rig.className;
    anchor.setAttribute('aria-hidden', 'true');
    anchor.style.visibility = 'hidden';
    rig.before(anchor);

    track = document.createElement('div');
    track.className = 'diver-track';
    track.setAttribute('aria-hidden', 'true');
    const sticky = document.createElement('div');
    sticky.className = 'diver-sticky';
    track.append(sticky);
    hero.prepend(track);

    sticky.append(rig);
    rig.classList.add('is-lifted');
    lifted = true;
    measureHold();
  };

  const unlift = () => {
    if (!lifted) return;
    anchor.replaceWith(rig);
    rig.classList.remove('is-lifted');
    track.remove();
    anchor = null;
    track = null;
    lifted = false;
  };

  // ---- per-scroll rendering: which frame, how opaque the band ---------------

  const measure = () => {
    const share = window.innerHeight * TURN_VIEWPORT_SHARE;
    turnDistance = Math.min(MAX_TURN_PX, Math.max(MIN_TURN_PX, share));
    measureHold();
  };

  const render = () => {
    queued = false;
    const scrolled = Math.max(0, window.scrollY);

    // Linear on purpose: the clip already eases in and out on its own, and easing the
    // scroll mapping as well made both ends of the turn crawl.
    const position = Math.min(1, scrolled / turnDistance) * (frames.length - 1);
    const base = Math.min(frames.length - 2, Math.floor(position));
    const blend = position - base;
    const closed = Math.min(1, scrolled / CURTAIN_CLOSED_PX);

    const key = `${base}|${blend.toFixed(2)}|${closed.toFixed(2)}`;
    if (key === lastKey) return;
    lastKey = key;

    const a = nearest(base);
    const b = nearest(base + 1);
    if (a) {
      ctx.globalAlpha = 1;
      ctx.drawImage(a, 0, 0, canvas.width, canvas.height);
      // Blend toward the next frame so slow scrolling between two frames stays smooth.
      if (b && b !== a && blend > 0.02) {
        ctx.globalAlpha = blend;
        ctx.drawImage(b, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
      }
    }

    // Mixed from the ink-2 token rather than a literal, so the band keeps following
    // the theme. At 0 scroll this equals the markup's own bg-ink-2/60.
    if (curtain) {
      const opacity = Math.round(CURTAIN_REST + (100 - CURTAIN_REST) * closed);
      curtain.style.backgroundColor = `color-mix(in oklab, var(--color-ink-2) ${opacity}%, transparent)`;
    }
  };

  const schedule = () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(render);
  };

  let resizeTimer;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      measure();
      lastKey = '';
      render(); // setTimeout path: still renders where rAF is paused (hidden tabs)
    }, RESIZE_DEBOUNCE_MS);
  };
  const heroObserver = new ResizeObserver(onResize);

  const start = () => {
    if (running) return;
    running = true;
    // Straight away — not after the first frame has loaded — so a reload that
    // restores a mid-page scroll never shows the diver in the wrong place first.
    lift();
    measure();
    render();
    heroObserver.observe(hero);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', onResize);

    loadFrame(0).then(() => {
      if (!running) return;
      lastKey = '';
      render();
      canvas.setAttribute('data-ready', '');
      // The remaining frames (~2 MB, half that on phones) are fetched only when the
      // turn will actually play.
      if (!restRequested) {
        restRequested = true;
        loadRest();
      }
    });
  };

  // Reduced motion: the resting <img> in its original place — no hold, no turn.
  const stop = () => {
    running = false;
    heroObserver.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', onResize);
    canvas.removeAttribute('data-ready');
    curtain?.style.removeProperty('background-color');
    unlift();
    lastKey = '';
  };

  const apply = () => (reducedMotion.matches ? stop() : start());
  reducedMotion.addEventListener('change', apply);
  apply();
}
