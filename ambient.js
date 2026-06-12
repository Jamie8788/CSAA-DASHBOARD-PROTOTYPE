// ============================================================================
// AMBIENT CANVAS — living background for the whole atlas.
// Flowing northern-lights ribbons + slow-drifting embers, in brand colours.
// No GIFs, no libraries. Pauses when the tab is hidden, caps at ~30 fps,
// and fully stops when the user turns motion off in Accessibility.
// ============================================================================
(function () {
  'use strict';

  const canvas = document.createElement('canvas');
  canvas.id = 'ambient-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    zIndex: '-1', pointerEvents: 'none',
  });
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // ---- aurora ribbons --------------------------------------------------- //
  const RIBBONS = [
    { hue: [212, 160, 23],  baseY: 0.16, amp: 60, speed: 0.00009, wl: 0.0019, alpha: 0.085, thick: 130 },
    { hue: [107, 141, 107], baseY: 0.30, amp: 80, speed: 0.00006, wl: 0.0013, alpha: 0.065, thick: 170 },
    { hue: [184, 53, 30],   baseY: 0.10, amp: 45, speed: 0.00012, wl: 0.0024, alpha: 0.05,  thick: 100 },
    { hue: [58, 93, 140],   baseY: 0.45, amp: 95, speed: 0.00005, wl: 0.0010, alpha: 0.045, thick: 200 },
  ];

  // ---- embers ------------------------------------------------------------ //
  const EMBERS = [];
  const EMBER_COUNT = Math.min(46, Math.round(window.innerWidth / 34));
  function spawnEmber(randomY) {
    return {
      x: Math.random() * W,
      y: randomY ? Math.random() * H : H + 8,
      r: 0.8 + Math.random() * 1.9,
      vy: 0.06 + Math.random() * 0.18,
      vx: (Math.random() - 0.5) * 0.08,
      tw: Math.random() * Math.PI * 2,
      gold: Math.random() < 0.6,
    };
  }
  for (let i = 0; i < EMBER_COUNT; i++) EMBERS.push(spawnEmber(true));

  function drawRibbon(t, rb) {
    const y0 = rb.baseY * H;
    ctx.beginPath();
    const step = Math.max(14, W / 90);
    for (let x = -40; x <= W + 40; x += step) {
      const y = y0
        + Math.sin(x * rb.wl + t * rb.speed * 1000) * rb.amp
        + Math.sin(x * rb.wl * 0.43 + t * rb.speed * 640 + 2.1) * rb.amp * 0.55;
      if (x <= -40) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    const [r, g, b] = rb.hue;
    const grad = ctx.createLinearGradient(0, y0 - rb.thick, 0, y0 + rb.thick);
    grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},${rb.alpha})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = rb.thick;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function drawEmbers(t) {
    for (const e of EMBERS) {
      e.y -= e.vy; e.x += e.vx + Math.sin(t * 0.0004 + e.tw) * 0.05;
      if (e.y < -10 || e.x < -10 || e.x > W + 10) Object.assign(e, spawnEmber(false));
      const twinkle = 0.45 + 0.55 * Math.sin(t * 0.0011 + e.tw);
      const a = 0.16 * twinkle;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fillStyle = e.gold ? `rgba(190,150,40,${a})` : `rgba(110,100,80,${a * 0.8})`;
      ctx.fill();
    }
  }

  // ---- loop --------------------------------------------------------------- //
  let raf = null, last = 0;
  const FRAME = 1000 / 30;
  function motionAllowed() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return !document.documentElement.classList.contains('reduce-motion');
  }
  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (t - last < FRAME) return;
    last = t;
    ctx.clearRect(0, 0, W, H);
    for (const rb of RIBBONS) drawRibbon(t, rb);
    drawEmbers(t);
  }
  function start() { if (!raf && motionAllowed()) raf = requestAnimationFrame(frame); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } ctx.clearRect(0, 0, W, H); drawStatic(); }

  // Static fallback so reduced-motion users still get the colour wash.
  function drawStatic() {
    for (const rb of RIBBONS) drawRibbon(120000, rb);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = null; } }
    else start();
  });
  // The Accessibility panel toggles html.reduce-motion — watch for it.
  new MutationObserver(() => { motionAllowed() ? start() : stop(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  if (motionAllowed()) start(); else drawStatic();
})();
