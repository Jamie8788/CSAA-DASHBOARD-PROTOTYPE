/* global React */
// ============================================================================
// WelcomeView — a scroll-driven cinematic landing page.
//   The lake scene is PINNED while you scroll; scroll progress drives the whole
//   story: dawn → morning → golden afternoon → dusk → starry night with aurora.
//   The sun arcs and sets, the moon rises, birds fly, and a canoe paddles all
//   the way across the lake. Each chapter of the atlas rises in over the scene.
//   Rich but performant canvas; fully reduce-motion aware (calm stacked layout).
// ============================================================================
const { useState: useS_w, useEffect: useE_w, useMemo: useM_w, useRef: useR_w } = React;

function _motionOff() {
  return (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      || document.documentElement.classList.contains('reduce-motion');
}
const _lerp = (a, b, t) => a + (b - a) * t;
const _clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const _smooth = (a, b, x) => { if (x <= a) return 0; if (x >= b) return 1; const t = (x - a) / (b - a); return t * t * (3 - 2 * t); };
function _hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function _mix(c1, c2, t) { const a = _hex(c1), b = _hex(c2); return `rgb(${Math.round(_lerp(a[0], b[0], t))},${Math.round(_lerp(a[1], b[1], t))},${Math.round(_lerp(a[2], b[2], t))})`; }
function _ramp(stops, p) { const n = stops.length - 1; const x = _clamp(p, 0, 1) * n; const i = Math.min(n - 1, Math.floor(x)); return _mix(stops[i], stops[i + 1], x - i); }
function _rampA(stops, p) { // returns [r,g,b] for alpha use
  const n = stops.length - 1; const x = _clamp(p, 0, 1) * n; const i = Math.min(n - 1, Math.floor(x));
  const a = _hex(stops[i]), b = _hex(stops[i + 1]), t = x - i;
  return [Math.round(_lerp(a[0], b[0], t)), Math.round(_lerp(a[1], b[1], t)), Math.round(_lerp(a[2], b[2], t))];
}

// time-of-day palettes: [dawn, morning, afternoon, dusk, night]
const SKY_TOP   = ['#2a1f38', '#23476a', '#2f5b86', '#43263f', '#070b18'];
const SKY_HORIZ = ['#c97b2e', '#e8c879', '#f0d486', '#d35a28', '#16223a'];
const WATER_TOP = ['#9a6a38', '#6f8a7a', '#688a7e', '#9a5538', '#1c3450'];
const WATER_BOT = ['#24322e', '#28423c', '#2c463f', '#261e26', '#0c1828'];
const SUN_COL   = ['#ffe2a0', '#fff3d0', '#fff6dd', '#ff9d5c', '#cdd8ee'];

// precomputed star + bird seeds (stable across frames)
const _STARS = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random() * 0.5, r: 0.4 + Math.random() * 1.3, ph: Math.random() * 6.28 }));
const _FLOCKS = [
  { baseX: 0.02, y: 0.20, n: 7, sp: 0.020, ph: 0, scale: 1.05 },
  { baseX: 0.38, y: 0.13, n: 5, sp: 0.015, ph: 1.6, scale: 0.78 },
  { baseX: 0.66, y: 0.25, n: 6, sp: 0.012, ph: 3.1, scale: 1.18 },
];
// jumping-fish ripple sources: x across, yb = how far down the water (0..1)
const _RIPPLES = [
  { x: 0.30, yb: 0.30, period: 6.5, phase: 0.0 },
  { x: 0.67, yb: 0.52, period: 8.2, phase: 2.6 },
  { x: 0.49, yb: 0.18, period: 10.4, phase: 5.1 },
  { x: 0.82, yb: 0.40, period: 7.4, phase: 1.3 },
  { x: 0.16, yb: 0.62, period: 9.1, phase: 3.7 },
];
// far-shore community lodges (silhouettes on the horizon)
const _LODGES = [
  { x: 0.595, s: 1.0 }, { x: 0.63, s: 0.78 }, { x: 0.668, s: 1.15 }, { x: 0.715, s: 0.9 },
];

function drawScene(ctx, W, H, p, tt) {
  const hY = H * 0.5;
  // ---- SKY ----
  const sky = ctx.createLinearGradient(0, 0, 0, hY + 30);
  sky.addColorStop(0, _ramp(SKY_TOP, p));
  sky.addColorStop(1, _ramp(SKY_HORIZ, p));
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hY + 30);

  // ---- STARS (night) ----
  const starA = _smooth(0.66, 0.95, p);
  if (starA > 0.01) {
    for (const s of _STARS) {
      const tw = 0.5 + 0.5 * Math.sin(tt * 2 + s.ph);
      ctx.globalAlpha = starA * tw * 0.9;
      ctx.beginPath(); ctx.arc(s.x * W, s.y * hY, s.r, 0, 6.283);
      ctx.fillStyle = '#fdf6e8'; ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // ---- AURORA (deep night) ----
  const aurA = _smooth(0.74, 1, p);
  if (aurA > 0.01) {
    for (let b = 0; b < 3; b++) {
      ctx.beginPath();
      const baseY = hY * (0.18 + b * 0.12);
      for (let x = 0; x <= W; x += 16) {
        const y = baseY + Math.sin(x * 0.006 + tt * 0.5 + b) * 18 + Math.sin(x * 0.018 + tt) * 8;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      const col = b === 1 ? '150,90,200' : '90,200,150';
      ctx.strokeStyle = `rgba(${col},${aurA * 0.28})`;
      ctx.lineWidth = 22; ctx.lineCap = 'round'; ctx.stroke();
    }
  }

  // ---- SUN / MOON ----
  const sunX = W * (0.18 + p * 0.64);
  const sunY = hY - Math.sin(_clamp(p, 0, 1) * Math.PI) * (hY * 0.72) + 8;
  const isMoon = p > 0.86;
  const sunR = isMoon ? 30 : _lerp(40, 60, _smooth(0.55, 1, p));
  const sc = _ramp(SUN_COL, p);
  const halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, H * 0.46);
  const [hr, hg, hb] = _rampA(SUN_COL, p);
  halo.addColorStop(0, `rgba(${hr},${hg},${hb},${isMoon ? 0.30 : 0.7})`);
  halo.addColorStop(0.18, `rgba(${hr},${hg},${hb},0.22)`);
  halo.addColorStop(0.55, `rgba(${hr},${hg},${hb},0.06)`);
  halo.addColorStop(1, `rgba(${hr},${hg},${hb},0)`);
  // keep the glow in the SKY only, so it never floods (washes out) the lake
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, hY + 2); ctx.clip();
  ctx.fillStyle = halo; ctx.fillRect(0, 0, W, hY + 2); ctx.restore();
  ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, 6.283); ctx.fillStyle = sc; ctx.fill();

  // ---- BIRDS — geese in V-formation, wings flapping, crossing the sky ----
  const birdA = _smooth(0.08, 0.24, p) * (1 - _smooth(0.60, 0.80, p));
  if (birdA > 0.02) {
    ctx.lineCap = 'round';
    for (const f of _FLOCKS) {
      const lead = ((f.baseX + tt * f.sp) % 1.5) - 0.25;   // leader sweeps L→R
      const lx = lead * W, ly = f.y * H;
      for (let i = 0; i < f.n; i++) {
        const side = i % 2 ? 1 : -1, rank = Math.ceil(i / 2);
        const bx = lx - rank * 26 * f.scale;
        const by = ly + rank * 12 * side * 0.5 + Math.sin(tt * 1.4 + i) * 1.5;
        const flap = Math.sin(tt * 7 + f.ph + i * 0.7);
        const wing = (6 + 3 * Math.abs(flap)) * f.scale;
        ctx.globalAlpha = birdA * 0.9;
        ctx.strokeStyle = '#241c14'; ctx.lineWidth = 1.7 * f.scale;
        ctx.beginPath();
        ctx.moveTo(bx - wing, by + flap * 3);
        ctx.quadraticCurveTo(bx - wing * 0.35, by - wing * 0.55, bx, by);
        ctx.quadraticCurveTo(bx + wing * 0.35, by - wing * 0.55, bx + wing, by + flap * 3);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- far shore: treeline + a small community of lodges, with a fire glow ----
  const shoreAlpha = 0.6 + 0.28 * _smooth(0.6, 1, p);
  // campfire glow on the far shore, warming toward dusk & night (flickering)
  const fireA = _smooth(0.5, 0.95, p);
  if (fireA > 0.02) {
    const fx = W * 0.655, fy = hY - 2;
    const flick = 0.7 + 0.3 * Math.sin(tt * 9) + 0.15 * Math.sin(tt * 17);
    const fglow = ctx.createRadialGradient(fx, fy, 0, fx, fy, 84);
    fglow.addColorStop(0, `rgba(255,170,70,${0.5 * fireA * flick})`);
    fglow.addColorStop(1, 'rgba(255,170,70,0)');
    ctx.fillStyle = fglow; ctx.fillRect(fx - 84, fy - 84, 168, 120);
  }
  ctx.beginPath(); ctx.moveTo(0, hY);
  for (let x = 0; x <= W; x += 14) {
    const t = hY - (6 + Math.abs(Math.sin(x * 0.05) * 10) + Math.sin(x * 0.13) * 5);
    ctx.lineTo(x, t);
  }
  ctx.lineTo(W, hY); ctx.closePath();
  ctx.fillStyle = `rgba(20,16,12,${shoreAlpha})`; ctx.fill();
  // lodge / teepee silhouettes on the far shore — the community by the water
  for (const Lg of _LODGES) {
    const lx = Lg.x * W, lh = 16 * Lg.s, lw = 11 * Lg.s;
    ctx.fillStyle = `rgba(16,12,9,${shoreAlpha})`;
    ctx.beginPath(); ctx.moveTo(lx, hY - lh); ctx.lineTo(lx - lw, hY); ctx.lineTo(lx + lw, hY); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(16,12,9,${shoreAlpha})`; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(lx - lw * 0.45, hY - lh * 0.5); ctx.lineTo(lx + lw * 0.45, hY - lh * 0.5); ctx.stroke();
  }

  // ---- WATER ----
  const water = ctx.createLinearGradient(0, hY, 0, H);
  water.addColorStop(0, _ramp(WATER_TOP, p));
  water.addColorStop(0.45, _mix(_ramp(WATER_TOP, p), _ramp(WATER_BOT, p), 0.7));
  water.addColorStop(1, _ramp(WATER_BOT, p));
  ctx.fillStyle = water; ctx.fillRect(0, hY, W, H - hY);
  // a darker band right under the horizon → the water reads as its own surface
  const band = ctx.createLinearGradient(0, hY, 0, hY + 70);
  band.addColorStop(0, 'rgba(0,0,0,0.10)'); band.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = band; ctx.fillRect(0, hY, W, 70);
  // soft horizon mist where the sky meets the lake
  const [mr, mg, mb] = _rampA(SKY_HORIZ, p);
  const mist = ctx.createLinearGradient(0, hY - 16, 0, hY + 42);
  mist.addColorStop(0, `rgba(${mr},${mg},${mb},0)`);
  mist.addColorStop(0.5, `rgba(${mr},${mg},${mb},${0.26 + 0.16 * _smooth(0.5, 0.9, p)})`);
  mist.addColorStop(1, `rgba(${mr},${mg},${mb},0)`);
  ctx.fillStyle = mist; ctx.fillRect(0, hY - 16, W, 58);
  // wavering reflection of the horizon colour just below the shore
  ctx.save();
  ctx.globalAlpha = 0.16 + 0.1 * _smooth(0.4, 1, p);
  for (let i = 0; i < 8; i++) {
    const ry = hY + 4 + i * 4;
    const off = Math.sin(tt * 1.6 + i * 0.9) * (2 + i);
    ctx.fillStyle = `rgba(${mr},${mg},${mb},${0.5 - i * 0.05})`;
    ctx.fillRect(off, ry, W, 2.4);
  }
  ctx.restore();

  // ---- sun / moon GLITTER: a tidy column of light on the water (clipped, no flood) ----
  ctx.save();
  const colHalf = Math.max(34, W * 0.05);
  ctx.beginPath();
  ctx.moveTo(sunX - colHalf, hY + 2); ctx.lineTo(sunX + colHalf, hY + 2);
  ctx.lineTo(sunX + colHalf * 0.4, H); ctx.lineTo(sunX - colHalf * 0.4, H);
  ctx.closePath(); ctx.clip();
  const gcol = ctx.createLinearGradient(0, hY, 0, H);
  gcol.addColorStop(0, `rgba(${hr},${hg},${hb},${isMoon ? 0.16 : 0.26})`);
  gcol.addColorStop(1, `rgba(${hr},${hg},${hb},0)`);
  ctx.fillStyle = gcol; ctx.fillRect(sunX - colHalf, hY, colHalf * 2, H - hY);
  for (let i = 0; i < 26; i++) {
    const f = i / 26, ry = hY + 4 + f * (H - hY);
    const a = (isMoon ? 0.10 : 0.16) * (1 - f) * (0.45 + 0.55 * Math.sin(tt * 3 + i * 0.8));
    if (a <= 0) continue;
    const w = 16 + 12 * Math.sin(i * 1.2 + tt);
    const dx = Math.sin(tt * 2 + i * 0.7) * 7;
    ctx.fillStyle = `rgba(255,250,236,${a})`;
    ctx.fillRect(sunX + dx - w / 2, ry, Math.max(4, w), 2);
  }
  ctx.restore();

  // ---- gentle ripple lines across the whole lake ----
  for (let L = 0; L < 7; L++) {
    const baseY = hY + 18 + L * ((H - hY) / 7);
    const amp = 2 + L * 1.3;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 14) {
      const y = baseY + Math.sin(x * 0.013 + tt * (1 + L * 0.12) + L) * amp;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(228,234,226,${0.03 + L * 0.006})`; ctx.lineWidth = 1.2; ctx.stroke();
  }

  // ---- jumping-fish ripple rings expanding on the surface ----
  for (const r of _RIPPLES) {
    const loc = ((tt + r.phase) % r.period) / r.period;   // 0..1 cycle
    if (loc >= 0.62) continue;
    const k = loc / 0.62;
    const rx = r.x * W, ry = hY + 10 + (H - hY) * r.yb;
    const rad = 5 + k * 46, a = 0.22 * (1 - k);
    ctx.strokeStyle = `rgba(232,238,230,${a})`; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(rx, ry, rad, rad * 0.34, 0, 0, 6.283); ctx.stroke();
    if (k > 0.25) {
      ctx.strokeStyle = `rgba(232,238,230,${a * 0.6})`;
      ctx.beginPath(); ctx.ellipse(rx, ry, rad * 0.6, rad * 0.6 * 0.34, 0, 0, 6.283); ctx.stroke();
    }
  }

  // ---- CANOE journeys across the lake by scroll progress (with a wake) ----
  const cx = -80 + _clamp(p, 0, 1) * (W + 160);
  const cy = hY + (H - hY) * 0.5 + Math.sin(tt * 1.4) * 3;
  const scl = Math.max(0.95, Math.min(1.7, W / 1000));
  // V-shaped wake trailing behind the canoe, drawn on the water
  ctx.save();
  ctx.strokeStyle = 'rgba(245,238,222,0.16)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (let s = -1; s <= 1; s += 2) {
    ctx.beginPath(); ctx.moveTo(cx - 40 * scl, cy);
    ctx.quadraticCurveTo(cx - 150 * scl, cy + s * 10, cx - 280 * scl, cy + s * 46 * scl);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save(); ctx.translate(cx, cy); ctx.scale(scl, scl);
  if (isMoon || p > 0.7) { // lantern glow at dusk/night
    const g = ctx.createRadialGradient(8, -14, 0, 8, -14, 60);
    g.addColorStop(0, 'rgba(255,180,80,0.55)'); g.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = g; ctx.fillRect(-60, -70, 130, 90);
  }
  // hull
  ctx.beginPath(); ctx.moveTo(-46, 0); ctx.quadraticCurveTo(0, 18, 46, 0); ctx.quadraticCurveTo(0, 7, -46, 0);
  ctx.fillStyle = '#15100b'; ctx.fill();
  // paddler
  ctx.strokeStyle = '#15100b'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(2, -2); ctx.lineTo(2, -17); ctx.stroke();
  ctx.beginPath(); ctx.arc(2, -21, 3.8, 0, 6.283); ctx.fillStyle = '#15100b'; ctx.fill();
  // paddle dipping side to side
  const pad = Math.sin(tt * 3) * 0.6;
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(2, -11); ctx.lineTo(2 + 20 * Math.cos(pad + 0.4), -11 + 20 * Math.sin(pad + 0.4)); ctx.stroke();
  if (isMoon || p > 0.7) { ctx.beginPath(); ctx.arc(8, -17, 2.4, 0, 6.283); ctx.fillStyle = '#ffcf7a'; ctx.fill(); }
  ctx.restore();
  // a small ripple where the paddle dips the water
  if (Math.sin(tt * 3) > 0.85) {
    ctx.strokeStyle = 'rgba(240,244,236,0.22)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(cx + 22 * scl, cy + 3 * scl, 8 * scl, 3 * scl, 0, 0, 6.283); ctx.stroke();
  }

  // ---- foreground reeds for depth ----
  ctx.strokeStyle = 'rgba(15,12,9,0.8)'; ctx.lineCap = 'round';
  const reeds = [[W * 0.04, 5], [W * 0.07, 4], [W * 0.95, 5], [W * 0.92, 4], [W * 0.98, 6]];
  reeds.forEach((r, i) => {
    const sway = Math.sin(tt * 1.2 + i) * 6;
    ctx.lineWidth = r[1]; ctx.beginPath();
    ctx.moveTo(r[0], H);
    ctx.quadraticCurveTo(r[0] + sway * 0.5, H - 70, r[0] + sway, H - 130);
    ctx.stroke();
  });

  // ---- top + bottom vignette to blend with page ----
  const vg = ctx.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, 'rgba(10,8,6,0.30)'); vg.addColorStop(0.22, 'rgba(10,8,6,0)');
  vg.addColorStop(0.88, 'rgba(10,8,6,0)'); vg.addColorStop(1, 'rgba(10,8,6,0.3)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

function WelcomeView({ all, setView }) {
  const stageRef = useR_w(null);
  const canvasRef = useR_w(null);
  const progressRef = useR_w(0);
  const panelRefs = useR_w([]);
  const setPanelRef = (i) => (el) => { panelRefs.current[i] = el; };
  const reduce = _motionOff();

  const data = useM_w(() => {
    const list = Array.isArray(all) ? all : [];
    const comms = list.filter((c) => c.orgType === 'Community');
    return { communities: comms.length, orgs: list.length - comms.length, people: list.reduce((s, c) => s + (c.population || 0), 0) };
  }, [all]);
  const nComm = window.useCountUp(data.communities, 1600);
  const nOrg = window.useCountUp(data.orgs, 1600);
  const nPeople = window.useCountUp(data.people, 1900);

  // ---- canvas animation loop ----
  useE_w(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, dpr, raf = null, t0 = null, last = 0;
    function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = Math.max(1, W * dpr); canvas.height = Math.max(1, H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    resize();
    const ro = ('ResizeObserver' in window) ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(canvas); else window.addEventListener('resize', resize);
    if (reduce) { drawScene(ctx, W, H, 0.32, 0); }
    else {
      const frame = (time) => {
        raf = requestAnimationFrame(frame);
        if (time - last < 18) return; last = time; if (t0 == null) t0 = time;
        drawScene(ctx, W, H, progressRef.current, (time - t0) / 1000);
      };
      raf = requestAnimationFrame(frame);
    }
    function onVis() { if (document.hidden && raf) { cancelAnimationFrame(raf); raf = null; } else if (!document.hidden && !raf && !reduce) { last = 0; raf = requestAnimationFrame((t) => { t0 = null; const f = (time) => { raf = requestAnimationFrame(f); if (time - last < 18) return; last = time; if (t0 == null) t0 = time; drawScene(ctx, W, H, progressRef.current, (time - t0) / 1000); }; f(t); }); } }
    document.addEventListener('visibilitychange', onVis);
    return () => { if (raf) cancelAnimationFrame(raf); if (ro) ro.disconnect(); else window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis); };
  }, [reduce]);

  // ---- scroll → progress + panel opacities ----
  useE_w(() => {
    if (reduce) { panelRefs.current.forEach((el) => { if (el) { el.style.opacity = 1; el.style.transform = 'none'; } }); return; }
    let raf = null;
    function update() {
      raf = null;
      const stage = stageRef.current; if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const p = _clamp(-rect.top / (total || 1), 0, 1);
      progressRef.current = p;
      // Crossfade: each panel owns an even slice and fades gently across its
      // neighbours, so there is always at least one chapter on screen.
      const N = panelRefs.current.length || 1;
      const seg = 1 / N;
      panelRefs.current.forEach((el, i) => {
        if (!el) return;
        const center = (i + 0.5) * seg;
        let d = Math.abs(p - center);
        if (i === 0 && p < center) d = 0;          // hero stays solid at the very top
        if (i === N - 1 && p > center) d = 0;      // last chapter stays solid at the bottom
        const op = 1 - _smooth(seg * 0.44, seg * 0.80, d);
        el.style.opacity = String(_clamp(op, 0, 1));
        el.style.transform = `translateY(${(p - center) * -70}px)`;
        el.style.pointerEvents = op > 0.55 ? 'auto' : 'none';
      });
    }
    function onScroll() { if (!raf) raf = requestAnimationFrame(update); }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [reduce]);

  const directions = [
    { k: 'East', season: 'Spring · Ziigwan', body: 'New beginnings — programs taking root.', color: '#d4a017' },
    { k: 'South', season: 'Summer · Niibin', body: 'Growth and youth — the vitality of the body.', color: '#b8351e' },
    { k: 'West', season: 'Autumn · Dagwaagin', body: 'Reflection — mental health and healing.', color: '#3a4658' },
    { k: 'North', season: 'Winter · Biboon', body: 'Wisdom — elders, ceremony, deep memory.', color: '#6b8d6b' },
  ];
  const actions = [
    { view: 'map', icon: '◉', title: 'Explore the Map', body: 'Every community and partner across the territory.' },
    { view: 'list', icon: '☷', title: 'Browse the Directory', body: 'A searchable list — filter by region, services, population.' },
    { view: 'story', icon: '✦', title: 'The Guided Journey', body: 'A Story Map through the four directions, season by season.' },
    { view: 'stories', icon: '❋', title: 'Stories & Games', body: 'Calm games and real quotes — learn by playing.' },
    { view: 'analytics', icon: '◐', title: 'The Analytics', body: 'Honest, live numbers: coverage, gaps, organizations.' },
    { view: 'coverage', icon: '⌧', title: 'Coverage of the 85', body: 'Track every one of the 85 committed communities.' },
  ];

  const panels = [
    <div className="wv-panel wv-p-hero" key="hero" ref={setPanelRef(0)}>
      <p className="wv-eyebrow">Mino Bimaadiziwin · The Good Life</p>
      <h1 className="wv-title">A living atlas of<br /><em>community care.</em></h1>
      <p className="wv-lead">Physical, mental, spiritual, and emotional health programming across First Nations communities and partners — in their own words.</p>
      <div className="wv-hero-cta">
        <button className="wv-btn" onClick={() => setView('map')}>◉ Explore the map</button>
        <button className="wv-btn ghost" onClick={() => setView('story')}>✦ Guided journey</button>
      </div>
    </div>,
    <div className="wv-panel" key="what" ref={setPanelRef(1)}>
      <p className="wv-kick">As the sun rises</p>
      <h2 className="wv-h2">One place for the whole picture of care.</h2>
      <p className="wv-p">Knowledge that once lived in scattered notes and websites, gathered into one living record — searchable, mappable, and kept current as communities share more.</p>
      <div className="wv-stats">
        <div className="wv-stat"><div className="n">{nComm}</div><div className="l">Communities</div></div>
        <div className="wv-stat"><div className="n">{nOrg}</div><div className="l">Partners</div></div>
        <div className="wv-stat"><div className="n">{nPeople.toLocaleString()}</div><div className="l">People served</div></div>
      </div>
    </div>,
    <div className="wv-panel" key="dirs" ref={setPanelRef(2)}>
      <p className="wv-kick">Through the day</p>
      <h2 className="wv-h2">A circle of care, season by season.</h2>
      <div className="wv-dirs">
        {directions.map((d) => (
          <div key={d.k} className="wv-dir" style={{ '--dc': d.color }}>
            <span className="wv-dir-dot"></span>
            <div className="wv-dir-name">{d.k}</div>
            <div className="wv-dir-season">{d.season}</div>
            <div className="wv-dir-body">{d.body}</div>
          </div>
        ))}
      </div>
    </div>,
    <div className="wv-panel" key="act" ref={setPanelRef(3)}>
      <p className="wv-kick">As the sun sets</p>
      <h2 className="wv-h2">Where would you like to begin?</h2>
      <div className="wv-actions">
        {actions.map((a) => (
          <button key={a.view} className="wv-action" onClick={() => setView(a.view)}>
            <span className="wv-a-icon" aria-hidden="true">{a.icon}</span>
            <span className="wv-a-title">{a.title}</span>
            <span className="wv-a-body">{a.body}</span>
            <span className="wv-a-go" aria-hidden="true">Open →</span>
          </button>
        ))}
      </div>
    </div>,
    <div className="wv-panel" key="how" ref={setPanelRef(4)}>
      <p className="wv-kick">Under the stars</p>
      <h2 className="wv-h2">Simple to use, for everyone.</h2>
      <div className="wv-steps">
        <div className="wv-step"><span className="s-n">1</span><div><b>Use the tabs up top</b><p>Or any card — each takes you straight there.</p></div></div>
        <div className="wv-step"><span className="s-n">2</span><div><b>Open a community</b><p>Click a marker or card to see everything on file.</p></div></div>
        <div className="wv-step"><span className="s-n">3</span><div><b>Make it comfortable</b><p>“Accessibility” (top-right) enlarges text or pauses motion.</p></div></div>
      </div>
      <p className="wv-foot">Every figure and quote is pulled live from the project’s master sheet. Honouring the original peoples of these lands.</p>
    </div>,
  ];

  if (reduce) {
    return (
      <section className="welcome2 wv-static">
        <div className="wv-pin"><canvas ref={canvasRef} className="wv-canvas" aria-hidden="true"></canvas></div>
        <div className="wv-static-flow">{panels}</div>
      </section>
    );
  }

  return (
    <section className="welcome2">
      <div className="wv-stage" ref={stageRef}>
        <div className="wv-pin">
          <canvas ref={canvasRef} className="wv-canvas" aria-hidden="true"></canvas>
          <div className="wv-panels">{panels}</div>
          <div className="wv-scrollcue" aria-hidden="true"><span>scroll to discover</span><i>↓</i></div>
        </div>
      </div>
    </section>
  );
}
window.WelcomeView = WelcomeView;
