/* global React */
/*
 * THE SEVEN FIRES — Niizhwaaswi Ishkode
 *
 * A scrollytelling walk through the Anishinaabe Seven Fires Prophecy, told with
 * one living fire on a hand-drawn canvas: the migration from the eastern ocean
 * to the food that grows on water, the two faces of the newcomer, the Sixth
 * Fire when the cup of life became a cup of grief and the children were taken,
 * and the Seventh Fire when the New People retrace their steps to pick up what
 * was left by the trail.
 *
 * The Eighth Fire is not a drawing — it is THIS ATLAS: the live count of
 * communities carrying their people's health today. The fire is lit by real data.
 *
 * The prophecy as recorded by Ojibwe elder Edward Benton-Banai in *The Mishomis
 * Book* (1988). Residential-school facts are from the Truth and Reconciliation
 * Commission of Canada (2015). Nothing here is invented, and nothing depicts
 * harm to children — the Sixth Fire is told through the empty shoes that
 * survivors and families themselves use to remember.
 */

const { useState: useS7, useEffect: useE7, useRef: useR7, useMemo: useM7 } = React;

const _F7 = [
  {
    n: 1, name: 'Waabanong', title: 'The First Fire',
    sub: 'Turn toward the setting sun',
    body: 'The people lived by the great salt water in the east. Seven prophets came and told them to move west, or they would be destroyed. They would know the way by a sacred miigis — a cowrie shell — rising in the sky, and they would know the journey\'s end when they came to the food that grows on water.',
    era: 'Long before contact', scene: 'ocean', accent: '#d4a017',
  },
  {
    n: 2, name: 'Naawakwe', title: 'The Second Fire',
    sub: 'The people lose their way',
    body: 'At the second stopping place the nation would be camped by a great lake, and the people would lose their way — the sacred path faltered. A boy would dream the road back to the miigis, and the people would carry on west.',
    era: 'The long migration', scene: 'river', accent: '#c07a1e',
  },
  {
    n: 3, name: 'Manoomin', title: 'The Third Fire',
    sub: 'The food that grows on water',
    body: 'The people found the chosen ground the prophets spoke of — the place where manoomin, wild rice, grows on the water. Here the nation planted itself and grew strong. This is the country of the Great Lakes, and it is home.',
    era: 'Arrival · the chosen ground', scene: 'rice', accent: '#6b8d6b',
  },
  {
    n: 4, name: 'Niizho-doodem', title: 'The Fourth Fire',
    sub: 'Two prophets, two faces',
    body: 'Two prophets came as one. A light-skinned race would arrive. If they came wearing the face of brotherhood, there would be a great nation together. But if they came wearing the face of death, and the rivers ran with poison and the fish were unfit to eat — the people must be careful.',
    era: 'The newcomers arrive', scene: 'sails', accent: '#3a4658',
  },
  {
    n: 5, name: 'Gichi-aanimad', title: 'The Fifth Fire',
    sub: 'A promise that was false',
    body: 'There would come a time of great struggle. A promise of joy and salvation would be offered to the people, and those who took it would nearly lose the way of their grandfathers for many generations.',
    era: 'The time of struggle', scene: 'storm', accent: '#5c4a6b',
  },
  {
    n: 6, name: 'Gaawiin', title: 'The Sixth Fire',
    sub: 'The cup of life became a cup of grief',
    body: 'The prophecy said the children would be taken away from the elders, and the elders would lose their reason for living. For over a century this came to pass. More than 150,000 First Nations, Inuit and Métis children were taken to residential schools; the last one closed in 1996. The Truth and Reconciliation Commission named it cultural genocide.',
    era: '1831 – 1996', scene: 'shoes', accent: '#c2571e', heavy: true,
  },
  {
    n: 7, name: 'Oshkibimaadiziig', title: 'The Seventh Fire',
    sub: 'The New People retrace their steps',
    body: 'A New People would emerge. They would retrace their steps to pick up what was left by the trail — the language, the ceremonies, the medicines. Their steps would take them to the elders, and they would ask to be guided. Some elders would have fallen asleep; they would say nothing. But the New People would keep asking.',
    era: 'Now · in our own lifetime', scene: 'return', accent: '#d4a017',
  },
];

function _fireTruths(all) {
  const list = all || [];
  // read the RAW sheet fields (don't depend on enriched has* flags, which only
  // exist after helpers.enrich runs) — a field counts only if it holds real text
  const real = (v) => {
    const s = String(v == null ? '' : v).trim();
    return !!s && !['missing information', 'needs review', 'n/a', 'no definite value', 'tbd', '-'].includes(s.toLowerCase());
  };
  const any = (c, keys) => keys.some(k => real(c[k]) || c['has' + k.charAt(0).toUpperCase() + k.slice(1)]);
  const withPillars = list.filter(c => any(c, ['physical', 'mental', 'spiritual', 'emotional'])).length;
  const survivorSupport = list.filter(c => any(c, ['survivors'])).length;
  const youth = list.filter(c => any(c, ['youth'])).length;
  const people = list.reduce((s, c) => s + (Number(c.population) || 0), 0);
  return { total: list.length, withPillars, survivorSupport, youth, people };
}

function SevenFiresView({ all, setView, onSelect }) {
  const stageRef = useR7(null);
  const canvasRef = useR7(null);
  const pRef = useR7(0);                       // scroll progress 0..1 across the whole story
  const [act, setAct] = useS7(0);              // which fire is in view
  const truths = useM7(() => _fireTruths(all), [all]);
  const reduce = typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- scroll → progress ----
  useE7(() => {
    function onScroll() {
      const st = stageRef.current; if (!st) return;
      const r = st.getBoundingClientRect();
      const total = st.offsetHeight - window.innerHeight;
      const p = Math.max(0, Math.min(1, -r.top / (total || 1)));
      pRef.current = p;
      const a = Math.max(0, Math.min(_F7.length, Math.floor(p * (_F7.length + 1))));
      setAct(a);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);

  // ---- the living fire ----
  useE7(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    let raf = null, t0 = null, W = 0, H = 0;
    function resize() {
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * DPR; canvas.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    const ro = ('ResizeObserver' in window) ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(canvas);
    const lerp = (a, b, u) => a + (b - a) * u;
    const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * 0.7, r: Math.random() * 1.3 + 0.3, tw: Math.random() * 6.3 }));

    function draw(time) {
      const tt = (time - (t0 == null ? (t0 = time) : t0)) / 1000;
      const p = pRef.current;
      const seg = p * (_F7.length + 1);        // 0..8 across seven fires + the eighth
      const i = Math.max(0, Math.min(_F7.length - 1, Math.floor(seg)));
      const u = Math.max(0, Math.min(1, seg - i));
      const fire = _F7[i];
      const nxt = _F7[Math.min(_F7.length - 1, i + 1)];
      const eighth = Math.max(0, Math.min(1, seg - _F7.length));   // the Eighth Fire reveal

      // ---- SKY: dawn in the east → deep night through the sixth fire → dawn again
      const dark = Math.min(1, Math.max(0, (seg - 3.2) / 2.6)) * (1 - eighth);
      const top = [lerp(28, 10, dark), lerp(34, 12, dark), lerp(58, 24, dark)];
      const bot = [lerp(214, 40, dark), lerp(140, 30, dark), lerp(70, 44, dark)];
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, `rgb(${top.map(Math.round).join(',')})`);
      sky.addColorStop(1, `rgb(${bot.map(Math.round).join(',')})`);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // stars come out as it darkens
      if (dark > 0.05) {
        for (const s of stars) {
          ctx.globalAlpha = dark * (0.25 + 0.6 * (0.5 + 0.5 * Math.sin(tt * 1.5 + s.tw)));
          ctx.fillStyle = '#eaf0ff';
          ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 6.283); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      // the miigis shell rising — guides fires 1-3
      const miig = Math.max(0, 1 - Math.abs(seg - 1.2) / 2.2);
      if (miig > 0.02) {
        const mx = W * 0.5 + Math.sin(tt * 0.3) * 20, my = H * (0.30 - miig * 0.06);
        const gl = ctx.createRadialGradient(mx, my, 2, mx, my, 90);
        gl.addColorStop(0, `rgba(255,235,190,${0.5 * miig})`); gl.addColorStop(1, 'rgba(255,235,190,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(mx, my, 90, 0, 6.283); ctx.fill();
        ctx.globalAlpha = miig; ctx.fillStyle = '#f6ead0';
        ctx.beginPath(); ctx.ellipse(mx, my, 16, 11, 0.2, 0, 6.283); ctx.fill();
        ctx.strokeStyle = 'rgba(160,120,70,0.7)'; ctx.lineWidth = 1;
        for (let r = -3; r <= 3; r++) { ctx.beginPath(); ctx.moveTo(mx - 14, my + r * 2.6); ctx.lineTo(mx + 14, my + r * 2.2); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }

      // ---- WATER / LAND
      const hY = H * 0.62;
      const wat = ctx.createLinearGradient(0, hY, 0, H);
      wat.addColorStop(0, `rgba(${Math.round(lerp(120, 22, dark))},${Math.round(lerp(150, 30, dark))},${Math.round(lerp(150, 56, dark))},1)`);
      wat.addColorStop(1, `rgba(${Math.round(lerp(70, 12, dark))},${Math.round(lerp(100, 18, dark))},${Math.round(lerp(110, 36, dark))},1)`);
      ctx.fillStyle = wat; ctx.fillRect(0, hY, W, H - hY);
      ctx.strokeStyle = `rgba(255,255,255,${0.06 + 0.05 * (1 - dark)})`; ctx.lineWidth = 1;
      for (let w = 0; w < 7; w++) {
        const yy = hY + 14 + w * 22;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 18) ctx.lineTo(x, yy + Math.sin(x * 0.014 + tt * 0.7 + w) * 3);
        ctx.stroke();
      }

      // ---- SCENE ELEMENTS per fire
      const sc = fire.scene;
      // migration canoes (fires 1-3) travelling west
      if (sc === 'ocean' || sc === 'river' || sc === 'rice') {
        const nC = sc === 'rice' ? 3 : 2;
        for (let c = 0; c < nC; c++) {
          const cx = ((tt * 12 + c * 220 + i * 120) % (W + 260)) - 130;
          const cy = hY + 60 + c * 34, s2 = 0.8 + c * 0.12;
          ctx.save(); ctx.translate(cx, cy + Math.sin(tt * 1.2 + c) * 2); ctx.scale(s2, s2);
          ctx.fillStyle = 'rgb(146,104,64)';
          ctx.beginPath(); ctx.moveTo(-34, 0); ctx.quadraticCurveTo(0, 9, 34, 0);
          ctx.quadraticCurveTo(38, -5, 34, -6); ctx.quadraticCurveTo(0, 2, -34, -6);
          ctx.quadraticCurveTo(-38, -5, -34, 0); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgb(40,28,18)';
          for (const px of [-12, 12]) {
            ctx.beginPath(); ctx.ellipse(px, -11, 4, 7, 0, 0, 6.283); ctx.fill();
            ctx.beginPath(); ctx.arc(px, -21, 3.4, 0, 6.283); ctx.fill();
            ctx.strokeStyle = 'rgb(90,62,34)'; ctx.lineWidth = 2;
            const pa = Math.sin(tt * 3 + px) * 0.5;
            ctx.beginPath(); ctx.moveTo(px + 3, -14); ctx.lineTo(px + 11 + Math.sin(pa) * 5, 6); ctx.stroke();
          }
          ctx.restore();
        }
      }
      // wild rice beds — the journey's end
      if (sc === 'rice') {
        ctx.strokeStyle = `rgba(${Math.round(lerp(150, 70, dark))},${Math.round(lerp(160, 80, dark))},70,0.95)`;
        for (let r = 0; r < 46; r++) {
          const rx = (r * 61) % W, ry = hY + 40 + ((r * 37) % 120);
          const sw = Math.sin(tt * 1.1 + r) * 3;
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(rx, ry); ctx.quadraticCurveTo(rx + sw * 0.5, ry - 22, rx + sw, ry - 40); ctx.stroke();
          ctx.fillStyle = 'rgba(206,176,92,0.9)';
          ctx.beginPath(); ctx.ellipse(rx + sw, ry - 44, 1.6, 4.4, 0, 0, 6.283); ctx.fill();
        }
      }
      // sails on the horizon — the newcomers
      if (sc === 'sails' || sc === 'storm') {
        const nS = sc === 'storm' ? 4 : 2;
        for (let s = 0; s < nS; s++) {
          const sx = W * (0.18 + s * 0.22) + Math.sin(tt * 0.2 + s) * 10, sy = hY - 4;
          ctx.fillStyle = `rgba(236,232,222,${0.85 - dark * 0.3})`;
          ctx.beginPath(); ctx.moveTo(sx, sy - 46); ctx.lineTo(sx + 15, sy); ctx.lineTo(sx - 15, sy); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(60,50,40,0.8)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(sx, sy - 50); ctx.lineTo(sx, sy); ctx.stroke();
        }
      }
      // ---- SIXTH FIRE: the empty shoes. Told the way families tell it —
      //      small shoes on the steps, no child depicted, nothing enacted. ----
      if (sc === 'shoes') {
        const rows = 3, per = 9;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < per; c++) {
            const sx = W * 0.5 + (c - (per - 1) / 2) * 44 + r * 12;
            const sy = hY + 70 + r * 40;
            const app = Math.max(0, Math.min(1, (u * 3) - (r * per + c) / (rows * per) * 2));
            if (app <= 0) continue;
            ctx.globalAlpha = app;
            ctx.fillStyle = ['#d4691e', '#c2571e', '#e07a2a'][(r + c) % 3];   // orange — Every Child Matters
            ctx.beginPath();
            ctx.moveTo(sx - 9, sy); ctx.lineTo(sx - 9, sy - 7);
            ctx.quadraticCurveTo(sx - 9, sy - 12, sx - 4, sy - 12);
            ctx.quadraticCurveTo(sx + 2, sy - 12, sx + 4, sy - 7);
            ctx.quadraticCurveTo(sx + 10, sy - 5, sx + 10, sy);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(60,30,10,0.35)'; ctx.lineWidth = 0.8; ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }
      // ---- SEVENTH FIRE: the New People walking back along the trail ----
      if (sc === 'return') {
        for (let w = 0; w < 5; w++) {
          const wx = W * 0.18 + w * (W * 0.13) + Math.sin(tt * 0.5 + w) * 4;
          const wy = hY + 96 + (w % 2) * 16, s3 = 1.1 + (w % 3) * 0.12;
          const step = Math.sin(tt * 3 + w * 1.2);
          ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 3 * s3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(wx - 2 * s3, wy - 16 * s3); ctx.lineTo(wx - 2 * s3 + step * 4 * s3, wy); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(wx + 2 * s3, wy - 16 * s3); ctx.lineTo(wx + 2 * s3 - step * 4 * s3, wy); ctx.stroke();
          ctx.fillStyle = ['#c93a1e', '#1f4e8f', '#7c2f6b', '#5a7d3a', '#d68a1f'][w];
          ctx.beginPath();
          ctx.moveTo(wx - 5 * s3, wy - 16 * s3); ctx.lineTo(wx - 4 * s3, wy - 30 * s3);
          ctx.quadraticCurveTo(wx, wy - 33 * s3, wx + 4 * s3, wy - 30 * s3);
          ctx.lineTo(wx + 5 * s3, wy - 16 * s3); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#a3704a';
          ctx.beginPath(); ctx.arc(wx, wy - 37 * s3, 4.6 * s3, 0, 6.283); ctx.fill();
          ctx.fillStyle = '#1a0e08';
          ctx.beginPath(); ctx.arc(wx, wy - 38 * s3, 4.9 * s3, Math.PI + 0.2, 2 * Math.PI - 0.2); ctx.fill();
          // each carries a small light — what was picked up from the trail
          const lx = wx + 8 * s3, ly = wy - 22 * s3;
          const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 16);
          lg.addColorStop(0, 'rgba(255,200,110,0.85)'); lg.addColorStop(1, 'rgba(255,200,110,0)');
          ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lx, ly, 16, 0, 6.283); ctx.fill();
        }
      }

      // ---- THE FIRE ITSELF — one fire, carried the whole way. It nearly dies
      //      in the Sixth Fire and is rekindled by the Seventh. ----
      const fx = W * 0.5, fy = H * 0.80;
      let strength = 1;
      if (sc === 'storm') strength = 0.55;
      if (sc === 'shoes') strength = 0.12 + 0.06 * Math.sin(tt * 2);      // almost out
      if (sc === 'return') strength = 0.5 + u * 0.8;
      strength = Math.max(strength, eighth * 1.9);                        // the Eighth Fire blazes
      const flk = 0.82 + Math.sin(tt * 9) * 0.12 + Math.sin(tt * 23) * 0.06;
      const R = 110 * strength * flk;
      const fg = ctx.createRadialGradient(fx, fy - 16, 4, fx, fy - 16, R);
      fg.addColorStop(0, `rgba(255,214,140,${0.5 * Math.min(1, strength)})`);
      fg.addColorStop(0.4, `rgba(255,150,60,${0.22 * Math.min(1, strength)})`);
      fg.addColorStop(1, 'rgba(255,140,50,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(fx, fy - 16, R, 0, 6.283); ctx.fill();
      // logs
      ctx.strokeStyle = `rgba(${Math.round(lerp(80, 44, dark))},${Math.round(lerp(54, 30, dark))},28,1)`;
      ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(fx - 26, fy + 6); ctx.lineTo(fx + 22, fy - 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx - 22, fy - 6); ctx.lineTo(fx + 26, fy + 6); ctx.stroke();
      // flames
      const fh = 76 * Math.min(1.5, strength) * flk;
      for (let f = 0; f < 3; f++) {
        const w2 = (20 - f * 5) * Math.min(1.4, strength);
        ctx.fillStyle = [`rgba(214,86,26,${0.9 * Math.min(1, strength)})`,
                         `rgba(255,150,40,${0.92 * Math.min(1, strength)})`,
                         `rgba(255,226,150,${0.95 * Math.min(1, strength)})`][f];
        const sway = Math.sin(tt * 3 + f) * 5 * strength;
        ctx.beginPath();
        ctx.moveTo(fx - w2, fy);
        ctx.quadraticCurveTo(fx - w2 * 0.5 + sway, fy - fh * (0.6 - f * 0.12), fx + sway * 0.6, fy - fh * (1 - f * 0.2));
        ctx.quadraticCurveTo(fx + w2 * 0.5 + sway, fy - fh * (0.6 - f * 0.12), fx + w2, fy);
        ctx.closePath(); ctx.fill();
      }
      // embers rising — they become the communities in the Eighth Fire
      const nE = Math.round(10 + eighth * 40);
      for (let e = 0; e < nE; e++) {
        const eu = ((tt * 0.32 + e * 0.13) % 1);
        const spread = 30 + eighth * (W * 0.42);
        const ex = fx + Math.sin(eu * 6 + e * 2.4) * spread * eu;
        const ey = fy - 20 - eu * (150 + eighth * 260);
        ctx.globalAlpha = (1 - eu) * (0.55 + 0.45 * Math.min(1, strength));
        ctx.fillStyle = e % 4 === 0 ? '#ffe9b0' : '#ffb347';
        ctx.beginPath(); ctx.arc(ex, ey, 1.4 + (1 - eu) * 1.4, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (reduce) { draw(performance.now()); return () => { if (ro) ro.disconnect(); }; }
    const frame = (time) => { raf = requestAnimationFrame(frame); draw(time); };
    raf = requestAnimationFrame(frame);
    return () => { if (raf) cancelAnimationFrame(raf); if (ro) ro.disconnect(); };
  }, [reduce]);

  return (
    <div className="sf-wrap">
      <div className="sf-stage" ref={stageRef}>
        <div className="sf-pin">
          <canvas ref={canvasRef} className="sf-canvas" />
          <div className="sf-vig" />

          {/* the seven cards */}
          {_F7.map((f, i) => (
            <div key={f.n} className={`sf-card ${act === i ? 'on' : ''} ${f.heavy ? 'heavy' : ''}`}
                 style={{ '--ac': f.accent }}>
              <div className="sf-era">{f.era}</div>
              <div className="sf-num">{f.title}</div>
              <h2>{f.name}</h2>
              <div className="sf-sub">{f.sub}</div>
              <p>{f.body}</p>
              {f.heavy && (
                <div className="sf-honour">
                  Every Child Matters. If this raises hard things, the Indian Residential
                  Schools Crisis Line is <b>1-866-925-4419</b>, 24 hours a day.
                </div>
              )}
            </div>
          ))}

          {/* THE EIGHTH FIRE — lit by the live atlas */}
          <div className={`sf-card sf-eighth ${act >= _F7.length ? 'on' : ''}`}>
            <div className="sf-era">The Eighth Fire · Ishkode Niishwaaswi</div>
            <div className="sf-num">And this is the fire, today</div>
            <h2>It is already lit.</h2>
            <p>
              The prophecy says that if the New People choose well, they light an Eighth
              Fire — an eternal fire of peace and kinship. This atlas is not a story about
              that fire. It is a count of it.
            </p>
            <div className="sf-live">
              <div><b>{truths.total}</b><span>communities & partners standing</span></div>
              <div><b>{truths.withPillars}</b><span>documenting care for their people</span></div>
              <div><b>{truths.survivorSupport}</b><span>holding survivors</span></div>
              <div><b>{truths.youth}</b><span>with the youth on the land</span></div>
            </div>
            <p className="sf-close">
              The children who were taken have grandchildren who are being cared for by
              their own nations. That is the fire. Every ember above is one of them.
            </p>
            <div className="sf-cta">
              <button className="sf-btn" onClick={() => setView && setView('directory')}>Meet the {truths.total} →</button>
              <button className="sf-btn ghost" onClick={() => setView && setView('stories')}>Walk the teachings</button>
            </div>
            <p className="sf-src">
              The Seven Fires as recorded by Ojibwe elder Edward Benton-Banai, <i>The Mishomis Book</i> (1988).
              Residential-school figures from the Truth and Reconciliation Commission of Canada (2015).
              Community numbers are live from this atlas.
            </p>
          </div>

          {/* fire-by-fire progress rail */}
          <div className="sf-rail">
            {_F7.map((f, i) => (
              <span key={f.n} className={`sf-dot ${act === i ? 'here' : ''} ${act > i ? 'past' : ''}`}
                    style={{ '--ac': f.accent }} title={`${f.title} — ${f.sub}`} />
            ))}
            <span className={`sf-dot eighth ${act >= _F7.length ? 'here' : ''}`} title="The Eighth Fire" />
          </div>
          {act === 0 && <div className="sf-scroll">↓ scroll slowly</div>}
        </div>
      </div>
    </div>
  );
}

window.SevenFiresView = SevenFiresView;
