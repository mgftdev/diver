/**
 * Scroll-driven head turn for the hero diver.
 *
 * A 61-frame image sequence (every second frame of a 24fps clip) is drawn onto a
 * canvas inside [data-diver] as the page scrolls. An image sequence rather than a
 * scrubbed <video>: ordinary MP4s are keyframed sparsely, so seeking backwards
 * stutters; single images are instant in both directions.
 *
 * The rig holds still on screen — translated down by exactly as much as the page
 * moves up — while the head turns over the first stretch of scroll, and keeps holding
 * until the tool band (the curtain) has swept up over it. The band is opaque by then
 * and the hero ends at the band's bottom edge, so once the band's top passes the
 * diver's top nothing of him is left to see: he disappears under the band. Only then
 * does the hold stop. Nothing is pinned, nothing hijacks the scroll — the page moves
 * normally the whole time; the diver waits.
 *
 * The rig's own `translate` (centring + crown anchor) comes from Tailwind utilities;
 * this writes `transform`, a separate property that composes with it.
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
  if (!rig || !canvas || !pattern || !count) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const curtain = document.querySelector('[data-diver-curtain]');

  const step = window.matchMedia(NARROW_QUERY).matches ? 2 : 1;
  const indices = [];
  for (let i = 0; i < count; i += step) indices.push(i);
  if (indices[indices.length - 1] !== count - 1) indices.push(count - 1);

  const url = (i) => pattern.replace('{n}', String(i).padStart(3, '0'));
  const frames = new Array(indices.length).fill(null); // HTMLImageElement once decoded

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let turnDistance = MIN_TURN_PX;
  let coverDistance = MAX_TURN_PX; // scroll at which the band's top reaches the diver's top
  let appliedHold = 0;
  let queued = false;
  let lastKey = '';
  let running = false;
  let restRequested = false;

  // ---- loading ------------------------------------------------------------

  const loadFrame = (slot) =>
    new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
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

  /** Nearest decoded frame to `slot`, searching outward — never undefined once slot 0 has loaded. */
  const nearest = (slot) => {
    for (let d = 0; d < frames.length; d++) {
      if (frames[slot - d]) return frames[slot - d];
      if (frames[slot + d]) return frames[slot + d];
    }
    return null;
  };

  // ---- rendering ------------------------------------------------------------

  const measure = () => {
    const share = window.innerHeight * TURN_VIEWPORT_SHARE;
    turnDistance = Math.min(MAX_TURN_PX, Math.max(MIN_TURN_PX, share));

    // Document positions with the current hold taken back out. While held, the rig
    // stays at its resting screen position and the band rises by 1px per 1px of scroll,
    // so the band covers the diver after exactly (bandTop - rigTop) of scroll.
    if (curtain) {
      const rigTop = rig.getBoundingClientRect().top + window.scrollY - appliedHold;
      const bandTop = curtain.getBoundingClientRect().top + window.scrollY;
      coverDistance = Math.max(turnDistance, bandTop - rigTop);
    } else {
      coverDistance = turnDistance;
    }
  };

  const render = () => {
    queued = false;
    const scrolled = Math.max(0, window.scrollY);

    // Linear on purpose: the clip already eases in and out on its own, and easing the
    // scroll mapping as well made both ends of the turn crawl.
    const position = Math.min(1, scrolled / turnDistance) * (frames.length - 1);
    const base = Math.min(frames.length - 2, Math.floor(position));
    const blend = position - base;
    const hold = Math.round(Math.min(scrolled, coverDistance));

    const closed = Math.min(1, scrolled / CURTAIN_CLOSED_PX);
    const key = `${base}|${blend.toFixed(2)}|${hold}|${closed.toFixed(2)}`;
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

    // 2D on purpose. translate3d promotes the rig to its own compositing layer, and
    // there mix-blend-mode loses the hero glow behind it: the render's black shows
    // as a box again. Verified by A/B in the browser, not assumed.
    rig.style.transform = `translate(0, ${hold}px)`;
    appliedHold = hold;

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

  const start = () => {
    running = true;
    measure();
    lastKey = '';
    render();
    canvas.setAttribute('data-ready', '');
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', onResize);
    // The remaining frames (~2 MB, half that on phones) are fetched only when the
    // turn will actually play.
    if (!restRequested) {
      restRequested = true;
      loadRest();
    }
  };

  // Reduced motion: the resting <img> only — canvas hidden, no hold, no turn.
  const stop = () => {
    running = false;
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', onResize);
    canvas.removeAttribute('data-ready');
    rig.style.removeProperty('transform');
    appliedHold = 0;
    curtain?.style.removeProperty('background-color');
    lastKey = '';
  };

  const apply = () => (reducedMotion.matches ? stop() : start());

  // Start only once the resting frame is on the canvas, so switching from the <img>
  // to the canvas never shows an empty frame.
  loadFrame(0).then(() => {
    apply();
    reducedMotion.addEventListener('change', () => {
      stop();
      apply();
    });
  });
}
