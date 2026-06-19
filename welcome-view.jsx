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
const WATER_TOP = ['#8a5a2e', '#5f7a6c', '#577a70', '#8a4730', '#102132'];
const WATER_BOT = ['#13201f', '#172726', '#192c29', '#161219', '#06101a'];
const SUN_COL   = ['#ffe2a0', '#fff3d0', '#fff6dd', '#ff9d5c', '#cdd8ee'];

// precomputed star + bird seeds (stable across frames)
const _STARS = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random() * 0.5, r: 0.4 + Math.random() * 1.3, ph: Math.random() * 6.28 }));
const _FLOCKS = [
  { baseX: 0.15, y: 0.16, n: 5, sp: 0.018, ph: 0 },
  { baseX: 0.55, y: 0.24, n: 4, sp: 0.012, ph: 2 },
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
  const halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, H * 0.55);
  const [hr, hg, hb] = _rampA(SUN_COL, p);
  halo.addColorStop(0, `rgba(${hr},${hg},${hb},${isMoon ? 0.35 : 0.8})`);
  halo.addColorStop(0.16, `rgba(${hr},${hg},${hb},0.32)`);
  halo.addColorStop(0.5, `rgba(${hr},${hg},${hb},0.08)`);
  halo.addColorStop(1, `rgba(${hr},${hg},${hb},0)`);
  ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
  ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, 6.283); ctx.fillStyle = sc; ctx.fill();

  // ---- BIRDS (more around day) ----
  const birdA = _smooth(0.12, 0.28, p) * (1 - _smooth(0.66, 0.82, p));
  if (birdA > 0.02) {
    for (const f of _FLOCKS) {
      const fx = ((f.baseX + tt * f.sp) % 1.4) - 0.2;
      for (let i = 0; i < f.n; i++) {
        const bx = (fx * W) + i * 22 * (i % 2 ? 1 : -1) * 0.6 - i * 4;
        const by = f.y * H + Math.abs(i - f.n / 2) * 9 + Math.sin(tt + i) * 2;
        const flap = Math.sin(tt * 6 + f.ph + i) * 4;
        ctx.globalAlpha = birdA * 0.8;
        ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx - 7, by + flap); ctx.lineTo(bx, by - 2); ctx.lineTo(bx + 7, by + flap);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- far treeline silhouette on the horizon ----
  ctx.beginPath(); ctx.moveTo(0, hY);
  for (let x = 0; x <= W; x += 14) {
    const t = hY - (6 + Math.abs(Math.sin(x * 0.05) * 10) + Math.sin(x * 0.13) * 5);
    ctx.lineTo(x, t);
  }
  ctx.lineTo(W, hY); ctx.closePath();
  ctx.fillStyle = `rgba(20,16,12,${0.55 + 0.25 * _smooth(0.6, 1, p)})`; ctx.fill();

  // ---- WATER ----
  const water = ctx.createLinearGradient(0, hY, 0, H);
  water.addColorStop(0, _ramp(WATER_TOP, p));
  water.addColorStop(0.45, _mix(_ramp(WATER_TOP, p), _ramp(WATER_BOT, p), 0.7));
  water.addColorStop(1, _ramp(WATER_BOT, p));
  ctx.fillStyle = water; ctx.fillRect(0, hY, W, H - hY);
  // soft horizon mist where the sky meets the lake (stronger toward dusk/night)
  const [mr, mg, mb] = _rampA(SKY_HORIZ, p);
  const mist = ctx.createLinearGradient(0, hY - 18, 0, hY + 48);
  mist.addColorStop(0, `rgba(${mr},${mg},${mb},0)`);
  mist.addColorStop(0.5, `rgba(${mr},${mg},${mb},${0.30 + 0.18 * _smooth(0.5, 0.9, p)})`);
  mist.addColorStop(1, `rgba(${mr},${mg},${mb},0)`);
  ctx.fillStyle = mist; ctx.fillRect(0, hY - 18, W, 66);
  // sun/moon reflection: a soft, narrow shimmer column beneath the light (never washes out)
  for (let i = 0; i < 24; i++) {
    const ry = hY + 3 + i * ((H - hY) / 24);
    const wob = Math.sin(tt * 1.8 + i * 0.6) * (3 + i * 0.5);
    const w = 22 + i * 3.2;
    ctx.fillStyle = `rgba(${hr},${hg},${hb},${(isMoon ? 0.07 : 0.11) * (1 - i / 24)})`;
    ctx.fillRect(sunX - w / 2 + wob, ry, w, 2.3);
  }
  // calm wave lines (subtle — read as ripples, not glare)
  for (let L = 0; L < 7; L++) {
    const baseY = hY + 16 + L * ((H - hY) / 7);
    const amp = 2 + L * 1.4;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 14) {
      const y = baseY + Math.sin(x * 0.013 + tt * (1 + L * 0.12) + L) * amp;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(228,234,226,${0.028 + L * 0.006})`; ctx.lineWidth = 1.3; ctx.stroke();
  }

  // ---- CANOE journeys across the lake by scroll progress ----
  const cx = -70 + _clamp(p, 0, 1) * (W + 140);
  const cy = hY + (H - hY) * 0.46 + Math.sin(tt * 1.4) * 3;
  const scl = Math.max(0.8, Math.min(1.5, W / 1100));
  ctx.save(); ctx.translate(cx, cy); ctx.scale(scl, scl);
  if (isMoon || p > 0.7) { // lantern glow at dusk/night
    const g = ctx.createRadialGradient(8, -14, 0, 8, -14, 60);
    g.addColorStop(0, 'rgba(255,180,80,0.55)'); g.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = g; ctx.fillRect(-60, -70, 130, 90);
  }
  ctx.beginPath(); ctx.moveTo(-6, 6); ctx.quadraticCurveTo(-70, 2, -150, 12);
  ctx.strokeStyle = 'rgba(255,236,190,0.18)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-46, 0); ctx.quadraticCurveTo(0, 16, 46, 0); ctx.quadraticCurveTo(0, 7, -46, 0);
  ctx.fillStyle = '#15100b'; ctx.fill();
  ctx.strokeStyle = '#15100b'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(2, -2); ctx.lineTo(2, -16); ctx.stroke();
  ctx.beginPath(); ctx.arc(2, -20, 3.6, 0, 6.283); ctx.fillStyle = '#15100b'; ctx.fill();
  const pad = Math.sin(tt * 3) * 0.55;
  ctx.beginPath(); ctx.moveTo(2, -10); ctx.lineTo(2 + 17 * Math.cos(pad + 0.4), -10 + 17 * Math.sin(pad + 0.4)); ctx.stroke();
  if (isMoon || p > 0.7) { ctx.beginPath(); ctx.arc(8, -16, 2.4, 0, 6.283); ctx.fillStyle = '#ffcf7a'; ctx.fill(); }
  ctx.restore();

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
  vg.addColorStop(0.88, 'rgba(10,8,6,0)'); vg.addColorStop(1, 'rgba(10,8,6,0.5)');
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
