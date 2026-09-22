/**
 * Animated dotted wave surface — a plain-module port of the React/shadcn
 * "DottedSurface" component. Same scene as the original (a 40×60 grid of points,
 * 150 units apart, lifted by two sine waves, seen from (0, 355, 1220) at 60° fov),
 * adapted to this site (denser: see SEPARATION):
 *
 * - No React, no next-themes: the site has one dark theme, so the colours come from
 *   the design tokens instead of a theme hook.
 * - Scoped to a section instead of `position: fixed` over the whole page. The canvas
 *   lives in a viewport-tall layer anchored to the bottom of [data-dotted-surface] and
 *   scrolls with it, like an ordinary background. (It was sticky at first; with the
 *   page sliding over a fixed floor, that read as odd.)
 * - three.js (~2 MB unminified, compressed on the wire) is fetched only when the
 *   section comes within LOAD_MARGIN of the viewport, never on first paint.
 * - Rendering pauses whenever the section is off screen or the tab is hidden.
 * - Reduced motion, or data-motion="static" on the host: one still frame, no loop.
 *   The site uses the static mode — the owner found the moving waves odd while the
 *   page scrolls.
 * - The wave advances by time, not per frame, so 120Hz screens do not run it double
 *   speed. The original's colour attribute pushed 0–255 values into a 0–1 buffer,
 *   which clamps every dot to white; colours here are real 0–1 values.
 */

const THREE_URL = '/vendor/three/three.module.js';
// Denser than the original (150 units apart, 40×60) at the owner's request, covering
// the same ~6000×9000 area — so the counts grow as the spacing shrinks.
const SEPARATION = 85;
const AMOUNT_X = 70;
const AMOUNT_Y = 106;
// The original's waves were defined per point index at 150-unit spacing. Scaling the
// index by this keeps the wave shape in world space, so only the density changes.
const WAVE_SCALE = SEPARATION / 150;
// The original advanced its phase by 0.1 per frame at ~60fps.
const WAVE_SPEED = 6;
const LOAD_MARGIN = '600px';
const MAX_PIXEL_RATIO = 2;

// Fallbacks match the @theme tokens, used only if the custom properties are absent.
const FALLBACK = { dot: '#9b9ca8', accent: '#ff6a1a', ground: '#08080b' };

const token = (name, fallback) => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
};

export function initDottedSurface() {
  const hosts = Array.from(document.querySelectorAll('[data-dotted-surface]'));
  if (hosts.length === 0 || !('IntersectionObserver' in window)) return;

  const loader = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        loader.unobserve(entry.target);
        mount(entry.target);
      }
    },
    { rootMargin: `${LOAD_MARGIN} 0px` },
  );
  hosts.forEach((host) => loader.observe(host));
}

async function mount(host) {
  const layer = host.querySelector('.dotted-surface__layer') ?? host;

  let THREE;
  try {
    THREE = await import(THREE_URL);
  } catch {
    return; // no three.js, no surface — the section reads fine without it
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    return; // no WebGL
  }

  const still = host.dataset.motion === 'static';
  const size = Number(host.dataset.size) || 8;
  const opacity = Number(host.dataset.opacity) || 0.45;

  const ground = new THREE.Color(token('--color-ink', FALLBACK.ground));
  const dot = new THREE.Color(token('--color-mist', FALLBACK.dot));
  const accent = new THREE.Color(token('--color-flare', FALLBACK.accent));

  const scene = new THREE.Scene();
  // Far dots fade into the page ground instead of into white.
  scene.fog = new THREE.Fog(ground, 2000, 10000);

  const camera = new THREE.PerspectiveCamera(60, 1, 1, 10000);
  camera.position.set(0, 355, 1220);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.setClearColor(ground, 0);
  renderer.domElement.style.display = 'block';
  layer.appendChild(renderer.domElement);

  // ---- geometry -------------------------------------------------------------
  const positions = new Float32Array(AMOUNT_X * AMOUNT_Y * 3);
  const colors = new Float32Array(AMOUNT_X * AMOUNT_Y * 3);
  const nearZ = camera.position.z - 100;
  const farZ = -(AMOUNT_Y * SEPARATION) / 2;
  const mixed = new THREE.Color();

  let i = 0;
  for (let ix = 0; ix < AMOUNT_X; ix++) {
    for (let iy = 0; iy < AMOUNT_Y; iy++) {
      const x = ix * SEPARATION - (AMOUNT_X * SEPARATION) / 2;
      const z = iy * SEPARATION - (AMOUNT_Y * SEPARATION) / 2;
      positions[i * 3] = x;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = z;

      // Rows nearest the camera pick up a little of the amber accent.
      const nearness = Math.min(1, Math.max(0, (z - farZ) / (nearZ - farZ)));
      mixed.copy(dot).lerp(accent, nearness ** 3 * 0.65);
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
      i++;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size,
    vertexColors: true,
    transparent: true,
    opacity,
    sizeAttenuation: true,
    depthWrite: false,
  });
  scene.add(new THREE.Points(geometry, material));

  // Animation state is declared before sizing: resize() reads `frame` on its first call.
  let phase = 0;
  let last = 0;
  let frame = 0;
  let onScreen = false;

  // ---- sizing ---------------------------------------------------------------
  const resize = () => {
    const width = layer.clientWidth || window.innerWidth;
    const height = layer.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    // With no animation loop running, nothing else would repaint at the new size.
    if (!frame) renderer.render(scene, camera);
  };
  resize();
  new ResizeObserver(resize).observe(layer);

  // ---- animation ------------------------------------------------------------
  const wave = () => {
    const attribute = geometry.attributes.position;
    const array = attribute.array;
    let n = 0;
    for (let ix = 0; ix < AMOUNT_X; ix++) {
      for (let iy = 0; iy < AMOUNT_Y; iy++) {
        array[n * 3 + 1] =
          Math.sin((ix * WAVE_SCALE + phase) * 0.3) * 50 + Math.sin((iy * WAVE_SCALE + phase) * 0.5) * 50;
        n++;
      }
    }
    attribute.needsUpdate = true;
  };

  const tick = (now) => {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    phase += dt * WAVE_SPEED;
    wave();
    renderer.render(scene, camera);
    frame = window.requestAnimationFrame(tick);
  };

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const play = () => {
    if (still || frame || !onScreen || document.hidden || reducedMotion.matches) return;
    last = 0;
    frame = window.requestAnimationFrame(tick);
  };
  const pause = () => {
    if (!frame) return;
    window.cancelAnimationFrame(frame);
    frame = 0;
  };

  // A still frame first, so reduced-motion visitors (and the moment before the loop
  // starts) still see the surface.
  wave();
  renderer.render(scene, camera);

  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) play();
    else pause();
  }).observe(host);

  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) pause();
    else play();
  });
}
