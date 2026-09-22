/** Mobile menu: a disclosure button and a drawer that closes on use. */
export function initNav() {
  const toggle = document.querySelector('#nav-toggle');
  const drawer = document.querySelector('#nav-drawer');
  if (!toggle || !drawer) return;

  const setOpen = (open) => {
    drawer.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };

  toggle.addEventListener('click', () => {
    setOpen(drawer.hidden);
  });

  drawer.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !drawer.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });

  // A resize past the breakpoint leaves the drawer stranded open otherwise.
  window.matchMedia('(min-width: 768px)').addEventListener('change', (event) => {
    if (event.matches) setOpen(false);
  });
}
