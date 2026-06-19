/* global React */
// ============================================================================
// WelcomeView — an immersive, scroll-told landing page.
//   • A living dawn-lake canvas: moving water, sun shimmer, and a canoe that
//     paddles slowly across — drawn in the brand palette.
//   • The story of the atlas unfolds as you scroll: each chapter rises in.
//   • Big quick-action cards into every section, and a short how-to.
//   • Accessible: large type, big targets; all motion stops when the
//     reduce-motion setting is on (then a calm still frame is shown).
// ============================================================================
const { useState: useS_w, useEffect: useE_w, useMemo: useM_w, useRef: useR_w } = React;

function _motionOff() {
  return (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      || document.documentElement.classList.contains('reduce-motion');
}

// ---- the living dawn-lake + canoe canvas -----------------------------------
function useLakeCanvas(canvasRef) {
  useE_w(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1, raf = null, t0 = null, last = 0;

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.max(1, W * dpr); canvas.height = Math.max(1, H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = ('ResizeObserver' in window) ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(canvas); else window.addEventListener('resize', resize);

    function scene(tt) {
      const hY = H * 0.52;                         // horizon
      // -- sky --
      const sky = ctx.createLinearGradient(0, 0, 0, hY);
      sky.addColorStop(0, '#241a10');
      sky.addColorStop(0.45, '#6e3f1a');
      sky.addColorStop(0.8, '#b9742b');
      sky.addColorStop(1, '#e7b264');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hY);
      // -- sun + halo --
      const sx = W * 0.62, sy = hY - 24;
      const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.5);
      halo.addColorStop(0, 'rgba(255,228,150,0.85)');
      halo.addColorStop(0.18, 'rgba(243,196,110,0.45)');
      halo.addColorStop(0.5, 'rgba(220,150,70,0.12)');
      halo.addColorStop(1, 'rgba(220,150,70,0)');
      ctx.fillStyle = halo; ctx.fillRect(0, 0, W, hY + 40);
      ctx.beginPath(); ctx.arc(sx, sy, 46, 0, Math.PI * 2);
      ctx.fillStyle = '#ffe6a0'; ctx.fill();
      // -- water base --
      const water = ctx.createLinearGradient(0, hY, 0, H);
      water.addColorStop(0, '#c98a3a');
      water.addColorStop(0.12, '#7d6a3c');
      water.addColorStop(0.5, '#3f5a52');
      water.addColorStop(1, '#1c2e2c');
      ctx.fillStyle = water; ctx.fillRect(0, hY, W, H - hY);
      // -- sun reflection shimmer column --
      for (let i = 0; i < 26; i++) {
        const ry = hY + i * ((H - hY) / 26);
        const wob = Math.sin(tt * 1.6 + i * 0.7) * (6 + i);
        const w = 70 + i * 7;
        ctx.fillStyle = `rgba(255,224,150,${0.20 * (1 - i / 26)})`;
        ctx.fillRect(sx - w / 2 + wob, ry, w, 3);
      }
      // -- moving wave lines --
      for (let L = 0; L < 7; L++) {
        const baseY = hY + 16 + L * ((H - hY) / 7);
        const amp = 3 + L * 1.6;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 12) {
          const y = baseY + Math.sin(x * 0.012 + tt * (0.6 + L * 0.12) + L) * amp;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(251,246,236,${0.05 + L * 0.012})`;
        ctx.lineWidth = 1.5; ctx.stroke();
      }
      // -- the canoe --
      const period = 46;                            // seconds to cross
      const prog = ((tt % period) / period);
      const cx = -80 + prog * (W + 160);
      const cy = hY + (H - hY) * 0.42 + Math.sin(tt * 0.9) * 4;
      const scale = Math.max(0.7, Math.min(1.3, W / 1200));
      ctx.save();
      ctx.translate(cx, cy); ctx.scale(scale, scale);
      // wake
      ctx.beginPath();
      ctx.moveTo(-6, 6);
      ctx.quadraticCurveTo(-70, 2, -150, 12);
      ctx.strokeStyle = 'rgba(255,236,190,0.18)'; ctx.lineWidth = 2; ctx.stroke();
      // hull (crescent)
      ctx.beginPath();
      ctx.moveTo(-46, 0);
      ctx.quadraticCurveTo(0, 16, 46, 0);
      ctx.quadraticCurveTo(0, 7, -46, 0);
      ctx.fillStyle = '#1a1410'; ctx.fill();
      // paddler
      ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(2, -2); ctx.lineTo(2, -16); ctx.stroke();      // body
      ctx.beginPath(); ctx.arc(2, -20, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#1a1410'; ctx.fill(); // head
      const paddle = Math.sin(tt * 2.2) * 0.5;                                  // paddling motion
      ctx.beginPath(); ctx.moveTo(2, -10);
      ctx.lineTo(2 + 16 * Math.cos(paddle + 0.4), -10 + 16 * Math.sin(paddle + 0.4));
      ctx.stroke();
      ctx.restore();
      // -- soft top + bottom vignette to blend into the page --
      const vg = ctx.createLinearGradient(0, 0, 0, H);
      vg.addColorStop(0, 'rgba(20,14,9,0.35)');
      vg.addColorStop(0.25, 'rgba(20,14,9,0)');
      vg.addColorStop(0.85, 'rgba(20,14,9,0)');
      vg.addColorStop(1, 'rgba(20,14,9,0.45)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }

    function frame(time) {
      raf = requestAnimationFrame(frame);
      if (time - last < 33) return;                 // ~30fps cap
      last = time; if (t0 == null) t0 = time;
      scene((time - t0) / 1000);
    }

    if (_motionOff()) { scene(0); }                 // still frame for reduced motion
    else raf = requestAnimationFrame(frame);

    function onVis() { if (document.hidden && raf) { cancelAnimationFrame(raf); raf = null; }
                       else if (!document.hidden && !raf && !_motionOff()) raf = requestAnimationFrame(frame); }
    document.addEventListener('visibilitychange', onVis);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [canvasRef]);
}

function WelcomeView({ all, setView }) {
  const canvasRef = useR_w(null);
  useLakeCanvas(canvasRef);

  // Reveal-on-scroll
  useE_w(() => {
    const els = Array.from(document.querySelectorAll('.wv-reveal'));
    if (!els.length) return;
    if (_motionOff()) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.18 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  const data = useM_w(() => {
    const list = Array.isArray(all) ? all : [];
    const comms = list.filter((c) => c.orgType === 'Community');
    return {
      communities: comms.length,
      orgs: list.length - comms.length,
      people: list.reduce((s, c) => s + (c.population || 0), 0),
    };
  }, [all]);
  const nComm = window.useCountUp(data.communities, 1600);
  const nOrg = window.useCountUp(data.orgs, 1600);
  const nPeople = window.useCountUp(data.people, 1900);

  const directions = [
    { k: 'East', season: 'Spring · Ziigwan', body: 'New beginnings — programs taking root.', color: '#d4a017' },
    { k: 'South', season: 'Summer · Niibin', body: 'Growth and youth — the vitality of the body.', color: '#b8351e' },
    { k: 'West', season: 'Autumn · Dagwaagin', body: 'Reflection — mental health and healing.', color: '#3a4658' },
    { k: 'North', season: 'Winter · Biboon', body: 'Wisdom — elders, ceremony, deep memory.', color: '#6b8d6b' },
  ];
  const actions = [
    { view: 'map', icon: '◉', title: 'Explore the Map', body: 'Every community and partner across the territory. Click a marker to open its record.' },
    { view: 'list', icon: '☷', title: 'Browse the Directory', body: 'A searchable list — filter by region, services, or population.' },
    { view: 'story', icon: '✦', title: 'The Guided Journey', body: 'A scrolling Story Map through the four directions, season by season.' },
    { view: 'stories', icon: '❋', title: 'Stories & Games', body: 'Calm games and real quotes — learn the atlas by playing.' },
    { view: 'analytics', icon: '◐', title: 'The Analytics', body: 'Honest, live numbers: coverage, gaps, and partner organizations.' },
    { view: 'coverage', icon: '⌧', title: 'Coverage of the 85', body: 'Track every one of the 85 communities the project set out to document.' },
  ];

  return (
    <section className="welcome2">
      {/* ── HERO with living lake ── */}
      <div className="wv-hero">
        <canvas ref={canvasRef} className="wv-canvas" aria-hidden="true"></canvas>
        <div className="wv-hero-content">
          <p className="wv-eyebrow">Mino Bimaadiziwin · The Good Life</p>
          <h1 className="wv-title">A living atlas of<br/><em>community care.</em></h1>
          <p className="wv-lead">
            Physical, mental, spiritual, and emotional health programming across
            First Nations communities and partners — in their own words.
          </p>
          <div className="wv-hero-cta">
            <button className="wv-btn" onClick={() => setView('map')}>◉ Explore the map</button>
            <button className="wv-btn ghost" onClick={() => setView('story')}>✦ Guided journey</button>
          </div>
        </div>
        <div className="wv-scrollcue" aria-hidden="true"><span>scroll to discover</span><i>↓</i></div>
      </div>

      {/* ── CHAPTER: what it is + stats ── */}
      <div className="wv-chapter wv-reveal">
        <div className="wv-chapter-inner">
          <p className="wv-kick">What this is</p>
          <h2 className="wv-h2">One place for the whole picture of care.</h2>
          <p className="wv-p">
            For years this knowledge lived in scattered notes and websites. The atlas
            gathers it into one living record — searchable, mappable, and kept current
            as communities and partners share more.
          </p>
          <div className="wv-stats">
            <div className="wv-stat"><div className="n">{nComm}</div><div className="l">Communities</div></div>
            <div className="wv-stat"><div className="n">{nOrg}</div><div className="l">Partner organizations</div></div>
            <div className="wv-stat"><div className="n">{nPeople.toLocaleString()}</div><div className="l">People served</div></div>
          </div>
        </div>
      </div>

      {/* ── CHAPTER: four directions ── */}
      <div className="wv-chapter wv-reveal">
        <div className="wv-chapter-inner">
          <p className="wv-kick">The four directions</p>
          <h2 className="wv-h2">A circle of care, season by season.</h2>
          <div className="wv-dirs">
            {directions.map((d, i) => (
              <div key={d.k} className="wv-dir" style={{ '--dc': d.color, transitionDelay: (0.08 * i) + 's' }}>
                <span className="wv-dir-dot"></span>
                <div className="wv-dir-name">{d.k}</div>
                <div className="wv-dir-season">{d.season}</div>
                <div className="wv-dir-body">{d.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CHAPTER: quick actions ── */}
      <div className="wv-chapter wv-reveal">
        <div className="wv-chapter-inner">
          <p className="wv-kick">Begin anywhere</p>
          <h2 className="wv-h2">Where would you like to start?</h2>
          <div className="wv-actions">
            {actions.map((a, i) => (
              <button key={a.view} className="wv-action" style={{ transitionDelay: (0.05 * i) + 's' }}
                      onClick={() => setView(a.view)}>
                <span className="wv-a-icon" aria-hidden="true">{a.icon}</span>
                <span className="wv-a-title">{a.title}</span>
                <span className="wv-a-body">{a.body}</span>
                <span className="wv-a-go" aria-hidden="true">Open →</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CHAPTER: how to navigate ── */}
      <div className="wv-chapter wv-reveal wv-howto">
        <div className="wv-chapter-inner">
          <p className="wv-kick">Finding your way</p>
          <h2 className="wv-h2">Simple to use, for everyone.</h2>
          <div className="wv-steps">
            <div className="wv-step"><span className="s-n">1</span><div><b>Use the tabs up top</b><p>Or any card above — each takes you straight to a section.</p></div></div>
            <div className="wv-step"><span className="s-n">2</span><div><b>Open a community</b><p>Click a map marker or a directory card to see everything on file.</p></div></div>
            <div className="wv-step"><span className="s-n">3</span><div><b>Make it comfortable</b><p>The “Accessibility” button (top-right) enlarges text, raises contrast, or pauses motion.</p></div></div>
          </div>
          <p className="wv-foot">Every figure and quote is pulled live from the project’s master sheet — nothing is invented. Honouring the original peoples of these lands.</p>
        </div>
      </div>
    </section>
  );
}
window.WelcomeView = WelcomeView;
