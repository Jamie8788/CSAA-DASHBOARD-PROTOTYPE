/* global */
// ============================================================================
// Scroll-animation engine — IntersectionObserver-driven, runs once, survives
// React re-renders. Three jobs:
//   1. .reveal-on-scroll  → fades + slides up when it enters the viewport
//   2. data-reveal="..."  → directional reveals (up/left/right/scale/blur)
//   3. .animate-on-view   → adds .in-view so CSS can grow bars/rings/counters
//   + a slim scroll-progress bar pinned to the very top of the page.
// Respects prefers-reduced-motion: when set, everything is shown instantly.
// ============================================================================
(function () {
  if (typeof window === 'undefined') return;
  if (window.__revealInit) return;
  window.__revealInit = true;

  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- main reveal observer ----
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('is-revealed');
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.06, rootMargin: '0px 0px -36px 0px' });

  // ---- "animate when scrolled into view" observer (bars, rings, counters) ----
  const ioView = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('in-view');
        ioView.unobserve(e.target);
      }
    }
  }, { threshold: 0.18 });

  function observeReveal(el) {
    if (el.__revealed) return;
    el.__revealed = true;
    if (reduceMotion) { el.classList.add('is-revealed'); return; }
    io.observe(el);
  }
  function observeView(el) {
    if (el.__inview) return;
    el.__inview = true;
    if (reduceMotion) { el.classList.add('in-view'); return; }
    ioView.observe(el);
  }

  function scan() {
    document.querySelectorAll('.reveal-on-scroll:not(.is-revealed)').forEach(observeReveal);
    document.querySelectorAll('.animate-on-view:not(.in-view)').forEach(observeView);
  }

  // Auto-tag known card / panel patterns so we don't edit every JSX file.
  // Each selector gets .reveal-on-scroll and an optional directional variant.
  const REVEAL_TAGS = [
    // dashboard
    ['.stat-card', ''],
    ['.featured-card', ''],
    ['.dir-story', ''],
    // analytics-pro
    ['.ap-panel', 'reveal-up'],
    ['.ap-story', 'reveal-fade'],
    ['.ap-kpi', 'reveal-scale'],
    ['.ap-cmp-row', 'reveal-left'],
    // coverage / stats sections
    ['.coverage-view .card', 'reveal-up'],
    ['.teachings-ribbon', 'reveal-fade'],
  ];
  const VIEW_TAGS = [
    '.ap-bar-fill', '.ap-ring', '.ap-clock', '.ap-cov td',
    '.ap-dup-bar', '.pb-fill', '.bar-fill',
  ];

  function autoTag() {
    for (const [sel, variant] of REVEAL_TAGS) {
      document.querySelectorAll(sel).forEach((el) => {
        if (!el.classList.contains('reveal-on-scroll')) {
          el.classList.add('reveal-on-scroll');
          if (variant) el.classList.add(variant);
        }
      });
    }
    for (const sel of VIEW_TAGS) {
      document.querySelectorAll(sel).forEach((el) => {
        if (!el.classList.contains('animate-on-view')) el.classList.add('animate-on-view');
      });
    }
    // Stagger delays for KPI strip children so they cascade in.
    document.querySelectorAll('.ap-kpi-strip').forEach((strip) => {
      Array.from(strip.children).forEach((child, i) => {
        if (!child.style.getPropertyValue('--reveal-delay')) {
          child.style.setProperty('--reveal-delay', (i * 0.08) + 's');
        }
      });
    });
  }

  // ---- scroll progress bar ----
  let progressBar = null;
  function ensureProgressBar() {
    if (progressBar || reduceMotion) return;
    progressBar = document.createElement('div');
    progressBar.className = 'cms-scroll-progress';
    document.body.appendChild(progressBar);
    let ticking = false;
    function update() {
      const h = document.documentElement;
      const max = (h.scrollHeight - h.clientHeight) || 1;
      const pct = Math.min(1, Math.max(0, (h.scrollTop || window.scrollY) / max));
      progressBar.style.transform = 'scaleX(' + pct + ')';
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  // ---- mutation observer re-scans whenever React mounts new cards ----
  const mo = new MutationObserver(() => { autoTag(); scan(); });

  function start() {
    ensureProgressBar();
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
