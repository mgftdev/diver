/**
 * Faint amber glow that trails the mouse pointer.
 *
 * The glow eases toward the pointer instead of snapping to it, which is what makes it
 * read as light rather than as a cursor decoration. The animation loop only runs
 * while the glow is still catching up, so an idle mouse costs nothing.
 *
 * Mouse only: touch and pen input are ignored, and the CSS hides the element on
 * coarse pointers and for prefers-reduced-motion.
 */

// Share of the remaining distance covered per frame — lower trails further behind.
const EASE = 0.14;
// Below this many pixels of remaining distance the glow is considered settled.
const SETTLE_PX = 0.3;

export function initCursorAura() {
  const aura = document.querySelector('[data-cursor-aura]');
  if (!aura) return;

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!finePointer.matches || reducedMotion.matches) return;

  let radius = aura.offsetWidth / 2;
  let targetX = 0;
  let targetY = 0;
  let x = 0;
  let y = 0;
  let frame = 0;

  const place = () => {
    aura.style.transform = `translate3d(${x - radius}px, ${y - radius}px, 0)`;
  };

  const tick = () => {
    x += (targetX - x) * EASE;
    y += (targetY - y) * EASE;
    place();
    frame =
      Math.abs(targetX - x) + Math.abs(targetY - y) > SETTLE_PX
        ? window.requestAnimationFrame(tick)
        : 0;
  };

  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse') return;
      targetX = event.clientX;
      targetY = event.clientY;

      // First sighting: appear where the pointer is, rather than sliding in from 0,0.
      if (!aura.hasAttribute('data-active')) {
        x = targetX;
        y = targetY;
        place();
        aura.setAttribute('data-active', '');
      }
      if (!frame) frame = window.requestAnimationFrame(tick);
    },
    { passive: true },
  );

  // Fade out when the pointer leaves the window; it fades back in on return.
  document.addEventListener('mouseout', (event) => {
    if (!event.relatedTarget) aura.removeAttribute('data-active');
  });

  window.addEventListener('resize', () => {
    radius = aura.offsetWidth / 2;
  });
}
