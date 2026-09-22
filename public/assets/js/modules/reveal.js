/**
 * Fades [data-reveal] blocks up as they enter the viewport.
 *
 * Opt-in: content is visible by default, and only once this script adds
 * `reveal-ready` to <html> does CSS hide what has not been revealed yet. So with JS
 * off, with reduced motion, or without IntersectionObserver, every block is simply
 * there. Anything already on screen at start-up is marked revealed synchronously,
 * so the first view never flashes empty.
 */

export function initReveal() {
  const items = Array.from(document.querySelectorAll('[data-reveal]'));
  if (items.length === 0) return;
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const below = items.filter((el) => el.getBoundingClientRect().top > window.innerHeight);
  items.filter((el) => !below.includes(el)).forEach((el) => el.classList.add('is-in'));
  if (below.length === 0) return;

  document.documentElement.classList.add('reveal-ready');

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  below.forEach((el) => observer.observe(el));
}
