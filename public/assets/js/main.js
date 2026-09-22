import { initNav } from './modules/nav.js';
import { initPlanPicker } from './modules/planPicker.js';
import { initLeadForm } from './modules/leadForm.js';
import { initAvailability } from './modules/availability.js';
import { initMarquee } from './modules/marquee.js';
import { initDiver } from './modules/diver.js';
import { initCursorAura } from './modules/cursorAura.js';
import { initTimecode } from './modules/timecode.js';
import { initReveal } from './modules/reveal.js';
import { initDottedSurface } from './modules/dottedSurface.js';

/**
 * Entry point. Each module owns one behaviour and returns quietly when the
 * markup it needs is not on the page, so the same bundle works on /admin.html.
 */
function boot() {
  initNav();
  initPlanPicker();
  initLeadForm();
  initMarquee();
  initDiver();
  initCursorAura();
  initTimecode();
  initReveal();
  initDottedSurface();
  void initAvailability();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
