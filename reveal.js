/* global */
// Tiny IntersectionObserver helper: any element with class .reveal-on-scroll
// fades + slides up when it enters the viewport. Runs once per element.
// Hooked at the document level so it works across React re-renders.
(function () {
  if (typeof window === 'undefined') return;
  if (window.__revealInit) return;
  window.__revealInit = true;

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('is-revealed');
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  function scan() {
    document.querySelectorAll('.reveal-on-scroll:not(.is-revealed)').forEach(el => {
      if (!el.__revealed) {
        el.__revealed = true;
        io.observe(el);
      }
    });
  }

  // Auto-tag known card patterns so we don't have to touch every JSX file
  function autoTag() {
    document.querySelectorAll('.stat-card, .featured-card, .dir-story').forEach(el => {
      if (!el.classList.contains('reveal-on-scroll')) {
        el.classList.add('reveal-on-scroll');
      }
    });
  }

  // Mutation observer re-scans whenever React mounts new cards
  const mo = new MutationObserver(() => {
    autoTag();
    scan();
  });
  function start() {
    autoTag();
    scan();
    mo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
