/**
 * Keeps the tool marquee seamless at any viewport width.
 *
 * The CSS loop animates the track to translateX(-50%), which only reads as
 * continuous while one half of the track is at least as wide as the viewport.
 * The markup ships two copies of the list — about 1830px — so it is seamless up
 * to roughly a 1800px screen and works with JS disabled. Past that a gap opens
 * (measured: a 167px hole at 2000px), so this tops the track up instead.
 */

const MIN_COPIES = 2;
const RESIZE_DEBOUNCE_MS = 200;

export function initMarquee() {
  const track = document.querySelector('[data-marquee]');
  if (!track) return;

  // The shipped markup is exactly two identical copies; the first half is the
  // base unit that gets repeated.
  const children = Array.from(track.children);
  if (children.length < 2) return;
  const base = children
    .slice(0, Math.floor(children.length / 2))
    .map((node) => node.outerHTML)
    .join('');
  if (!base) return;

  const fill = () => {
    // Measure a single copy to get the base width.
    track.innerHTML = base;
    const baseWidth = track.scrollWidth;
    if (!baseWidth) return;

    // Each half must out-run the viewport, with a margin so the seam never
    // lands on screen mid-frame.
    const halves = Math.max(MIN_COPIES, Math.ceil((window.innerWidth + 240) / baseWidth));

    // Two equal halves keep translateX(-50%) landing exactly one period on.
    track.innerHTML = base.repeat(halves * 2);
  };

  fill();

  let timer;
  window.addEventListener('resize', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(fill, RESIZE_DEBOUNCE_MS);
  });
}
