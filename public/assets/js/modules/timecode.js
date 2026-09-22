/**
 * Treats the page as a 90-second cut: a 1px amber progress bar under the nav, and a
 * running SMPTE-style timecode (HH:MM:SS:FF at 24fps) with the current scene number.
 * Pure read-out of scroll position — nothing here moves content.
 *
 * Returns quietly on pages that have none of the elements (admin.html).
 */

const FPS = 24;
const CUT_SECONDS = 90;
// A scene counts as "current" once its top passes this share of the viewport.
const SCENE_LINE = 0.4;

const pad = (n) => String(n).padStart(2, '0');

export function initTimecode() {
  const bar = document.querySelector('[data-progress]');
  const time = document.querySelector('[data-tc-time]');
  const scene = document.querySelector('[data-tc-scene]');
  if (!bar && !time && !scene) return;

  const scenes = Array.from(document.querySelectorAll('[data-scene]'));
  let queued = false;

  const render = () => {
    queued = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;

    if (bar) bar.style.transform = `scaleX(${progress.toFixed(4)})`;

    if (time) {
      const frames = Math.round(progress * CUT_SECONDS * FPS);
      const seconds = Math.floor(frames / FPS);
      time.textContent = `00:${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}:${pad(frames % FPS)}`;
    }

    if (scene) {
      let current = '00';
      for (const el of scenes) {
        if (el.getBoundingClientRect().top < window.innerHeight * SCENE_LINE) current = el.dataset.scene;
      }
      scene.textContent = `SC ${current}`;
    }
  };

  const schedule = () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(render);
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', render);
  render();
}
