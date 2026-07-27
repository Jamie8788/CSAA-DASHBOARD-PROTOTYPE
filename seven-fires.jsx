/* global React */
/*
 * THE LONG WALK — a scrollytelling history of this land, told with one fire
 * over a real map of the territory.
 *
 * DELIBERATELY GENERIC. Every nation has its own history and its own way of
 * telling it, and they differ. So this holds to the shared human arc only —
 * the people were here, newcomers came, promises were broken, the children
 * were taken, survivors spoke, the people are rebuilding. No dates, no
 * legislation, no institution and no sacred teaching is named, and no
 * community's words are put in its mouth.
 *
 * The last panel is not a drawing: it is the LIVE COUNT from this atlas.
 */

const { useState: useS7, useEffect: useE7, useRef: useR7, useMemo: useM7 } = React;

const _F7 = [
  {
    n: 1, key: 'before', title: 'The people were here',
    sub: 'Long before anyone drew a map of it',
    body: 'Many nations lived across this land, each with its own language, its own laws, its own medicines and its own way of caring for one another. Families travelled the water. Elders taught. Children grew up knowing exactly who they were.',
    era: 'In the beginning', accent: '#d4a017', scene: 'land',
    geo: { c: [47.6, -84.0], z: 5 }, mood: 'day',
  },
  {
    n: 2, key: 'came', title: 'The newcomers came',
    sub: 'And agreements were made',
    body: 'Ships arrived. Promises were exchanged — to live alongside one another and share what the land gives. The people here understood it as a relationship between equals, made to last as long as the rivers flow.',
    era: 'Then', accent: '#c07a1e', scene: 'contact',
    geo: { c: [46.3, -72.0], z: 5 }, mood: 'dusk',
  },
  {
    n: 3, key: 'law', title: 'The promises were broken',
    sub: 'Decisions made far away',
    body: 'Laws were written in distant rooms by people who had never been here. They decided who counted, where families could live, and what could be spoken or practised. Ceremony was pushed out of the daylight.',
    era: 'And then', accent: '#8f7aa8', scene: 'law',
    geo: { c: [45.42, -75.70], z: 7 }, mood: 'grey',
  },
  {
    n: 4, key: 'taken', title: 'The children were taken',
    sub: 'This is the part that still hurts',
    body: 'For generations, children were taken from their families and sent far from home to schools meant to make them someone else. Many came back changed. Many never came back at all. Every community here carries this.',
    era: 'For generations', accent: '#e07a2a', scene: 'shoes', heavy: true,
    geo: { c: [56.0, -96.0], z: 3.6 }, mood: 'night',
  },
  {
    n: 5, key: 'again', title: 'And it did not stop',
    sub: 'The taking wore new clothes',
    body: 'Later, children were taken again — this time by systems that called it care, and placed them far from their nations. Families are still looking for one another. This is not only something that happened long ago.',
    era: 'And after that', accent: '#c07a5a', scene: 'scoop', heavy: true,
    geo: { c: [52.0, -106.0], z: 4.4 }, mood: 'night',
  },
  {
    n: 6, key: 'spoke', title: 'Survivors spoke',
    sub: 'And would not be quiet',
    body: 'Those who lived it told the truth out loud — to their families, to their nations, to the whole country. It cost them something to say it. Because they spoke, it can no longer be denied, and it can no longer be repeated quietly.',
    era: 'Then something turned', accent: '#f0b93c', scene: 'voices',
    geo: { c: [49.9, -97.14], z: 6 }, mood: 'dawn',
  },
  {
    n: 7, key: 'now', title: 'The people are rebuilding',
    sub: 'On their own terms',
    body: 'Language is being taught again. Ceremony is out in the open. Nations are running their own health care, their own child welfare, their own schools. Elders teach, youth go out on the land, and the fire that was nearly out is burning.',
    era: 'Now', accent: '#d4a017', scene: 'return',
    geo: { c: [47.2, -82.0], z: 5.4 }, mood: 'day',
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

// ---- MANGA PANEL — each chapter gets one big illustrated frame: bold ink
//   outlines, screentone dots, dramatic backlight and a CLOSE-UP subject.
//   Emotion in comics comes from framing tight, not from tiny figures in a
//   wide landscape — so every panel is a hand, a face, or a silhouette. ----
function MangaPanel({ chapter, on }) {
  const k = chapter.key;
  const ink = '#17120e';
  return (
    <svg className={`sf-panel ${on ? 'on' : ''}`} viewBox="0 0 340 300" aria-hidden="true">
      <defs>
        <pattern id="tone" width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="1.6" cy="1.6" r="1.15" fill={ink} opacity="0.30" />
        </pattern>
        <pattern id="toneFine" width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="1.2" cy="1.2" r="0.7" fill={ink} opacity="0.22" />
        </pattern>
        <radialGradient id="sunG" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff3cf" /><stop offset="70%" stopColor="#f0b93c" /><stop offset="100%" stopColor="#e07a2a" />
        </radialGradient>
        <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f7efe0" /><stop offset="100%" stopColor="#e6dac4" />
        </linearGradient>
        <clipPath id="frame"><rect x="6" y="6" width="328" height="288" rx="4" /></clipPath>
      </defs>
      <rect x="6" y="6" width="328" height="288" rx="4" fill="url(#paper)" />
      <g clipPath="url(#frame)">
        {/* radiating speed lines — the manga "impact" device */}
        {(k === 'spoke' || k === 'now') && Array.from({ length: 34 }).map((_, i) => {
          const a = (i / 34) * Math.PI * 2;
          return <line key={i} x1={170 + Math.cos(a) * 46} y1={150 + Math.sin(a) * 46}
                       x2={170 + Math.cos(a) * 300} y2={150 + Math.sin(a) * 300}
                       stroke={ink} strokeWidth={i % 3 ? 1.1 : 2.4} opacity="0.16" />;
        })}
        {/* ---------- 1. THE PEOPLE WERE HERE — family against a huge sun */}
        {k === 'before' && (<>
          <circle cx="170" cy="128" r="82" fill="url(#sunG)" />
          <rect x="0" y="0" width="340" height="300" fill="url(#toneFine)" opacity="0.5" />
          <path d="M0 214 Q90 196 170 208 Q250 220 340 202 L340 300 L0 300 Z" fill={ink} />
          <g fill={ink}>
            <ellipse cx="120" cy="196" rx="15" ry="30" /><circle cx="120" cy="160" r="13" />
            <path d="M107 158 q13 -16 26 0 q-4 26 -8 34 q-9 3 -14 -2 Z" />
            <ellipse cx="168" cy="200" rx="17" ry="34" /><circle cx="168" cy="160" r="14" />
            <path d="M154 158 q14 -17 28 0 q-3 30 -9 40 q-9 3 -15 -3 Z" />
            <ellipse cx="212" cy="206" rx="11" ry="22" /><circle cx="212" cy="180" r="10" />
            <path d="M202 179 q10 -13 20 0 q-3 20 -6 26 q-7 2 -11 -2 Z" />
            <path d="M144 190 q12 -8 20 0" stroke={ink} strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M188 198 q10 -6 16 0" stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round" />
          </g>
        </>)}
        {/* ---------- 2. THE NEWCOMERS CAME — a hand shielding the eyes, ships beyond */}
        {k === 'came' && (<>
          <rect x="0" y="0" width="340" height="170" fill="url(#tone)" opacity="0.55" />
          <path d="M0 172 L340 172 L340 300 L0 300 Z" fill="#cdbfa4" />
          <path d="M0 172 L340 172" stroke={ink} strokeWidth="2.5" />
          {[[70, 0.9], [160, 1.15], [250, 0.8]].map(([sx, sc], i) => (
            <g key={i} fill={ink} transform={`translate(${sx} 172) scale(${sc})`}>
              <path d="M-22 0 L22 0 L14 -8 L-14 -8 Z" />
              <path d="M0 -8 L0 -62" stroke={ink} strokeWidth="2.5" />
              <path d="M0 -60 L22 -12 L0 -12 Z" /><path d="M0 -52 L-18 -12 L0 -12 Z" />
            </g>
          ))}
          <g fill={ink}>
            <path d="M84 300 L84 214 q0 -30 30 -30 l96 0 q30 0 30 30 l0 86 Z" opacity="0.14" />
            <path d="M120 300 q-6 -60 10 -92 q8 -16 24 -12 q-6 -22 8 -26 q14 -4 18 18 q6 -20 20 -14 q13 6 6 26 q14 -8 20 4 q7 12 -6 26 q-18 20 -22 70 Z" />
            <path d="M154 196 q-4 -18 4 -24" stroke="#f7efe0" strokeWidth="2" fill="none" opacity="0.5" />
            <path d="M180 192 q-2 -18 4 -22" stroke="#f7efe0" strokeWidth="2" fill="none" opacity="0.5" />
          </g>
        </>)}
        {/* ---------- 3. THE PROMISES WERE BROKEN — a paper tearing across the frame */}
        {k === 'law' && (<>
          <rect x="0" y="0" width="340" height="300" fill="url(#tone)" opacity="0.42" />
          <g>
            <path d="M40 62 L182 48 L196 236 L54 250 Z" fill="#f7efe0" stroke={ink} strokeWidth="3" />
            {[86, 104, 122, 140, 158, 176, 194, 212].map((yy, i) => (
              <line key={i} x1="58" y1={yy} x2={168 - (i % 3) * 22} y2={yy - 1} stroke={ink} strokeWidth="2" opacity="0.55" />
            ))}
            <path d="M182 48 L300 60 L288 246 L196 236 Z" fill="#f7efe0" stroke={ink} strokeWidth="3" transform="rotate(9 240 150)" />
            <path d="M182 48 L172 96 L192 132 L178 178 L196 236" fill="none" stroke={ink} strokeWidth="4" strokeLinejoin="round" />
          </g>
          <path d="M0 268 L340 268" stroke={ink} strokeWidth="3" />
          <rect x="0" y="268" width="340" height="32" fill={ink} opacity="0.9" />
        </>)}
        {/* ---------- 4 & 5. THE CHILDREN WERE TAKEN — a small hand slipping from a
                large hand. No child is shown; the gesture carries it. */}
        {(k === 'taken' || k === 'again') && (<>
          <rect x="0" y="0" width="340" height="300" fill="url(#tone)" opacity={k === 'again' ? 0.5 : 0.62} />
          <circle cx="170" cy="140" r="96" fill="#f7efe0" />
          <g fill={ink}>
            {/* the adult hand, reaching from the left */}
            <path d="M0 214 q40 -6 66 -26 q16 -12 30 -8 q-10 -16 4 -22 q14 -6 22 8 q0 -18 14 -18 q13 0 13 18 q8 -12 18 -4 q10 8 0 24 q-14 22 -44 30 q-46 12 -64 42 Z" />
            {/* the child's hand, small, reaching back — a gap between them */}
            <path d="M340 158 q-30 4 -50 20 q-12 10 -22 6 q8 12 -3 17 q-11 5 -17 -6 q0 14 -11 14 q-10 0 -10 -14 q-6 9 -14 3 q-8 -6 0 -18 q11 -17 34 -23 q35 -9 48 -32 Z"
                  opacity={k === 'again' ? 0.55 : 1} />
          </g>
          {/* the space between the hands — the whole point of the panel */}
          <g stroke={ink} strokeWidth="2.5" strokeLinecap="round" opacity="0.75">
            <path d="M150 168 l10 -10" /><path d="M168 176 l12 -12" /><path d="M186 170 l10 -10" />
          </g>
          <rect x="0" y="0" width="340" height="300" fill="none" />
        </>)}
        {/* ---------- 6. SURVIVORS SPOKE — a face in profile, speaking, light bursting */}
        {k === 'spoke' && (<>
          <circle cx="170" cy="150" r="104" fill="url(#sunG)" opacity="0.55" />
          <g fill={ink}>
            <path d="M196 300 q-8 -70 -6 -104 q2 -34 -18 -52 q-22 -20 -14 -50 q7 -28 40 -30 q34 -2 44 28 q7 22 -4 40 q14 8 10 26 q-4 18 -22 18 q6 46 4 124 Z" />
            <path d="M150 300 q-2 -60 12 -92" stroke={ink} strokeWidth="3" fill="none" />
          </g>
          <g fill="#f7efe0">
            <ellipse cx="206" cy="122" rx="6" ry="7" />
            <path d="M182 152 q16 -8 30 2 q-14 14 -30 -2 Z" />
          </g>
          {[0, 1, 2, 3].map(i => (
            <path key={i} d={`M120 ${132 + i * 16} q-40 ${-6 + i * 4} -${70 + i * 14} ${2 + i * 3}`}
                  stroke={ink} strokeWidth={3 - i * 0.5} fill="none" strokeLinecap="round" opacity={0.85 - i * 0.16} />
          ))}
        </>)}
        {/* ---------- 7. THE PEOPLE ARE REBUILDING — hands joining over a fire */}
        {k === 'now' && (<>
          <circle cx="170" cy="196" r="72" fill="url(#sunG)" />
          <rect x="0" y="0" width="340" height="300" fill="url(#toneFine)" opacity="0.42" />
          <g fill={ink}>
            <path d="M170 250 q-30 -26 -26 -56 q3 -22 20 -34 q-4 26 12 34 q-6 -34 20 -54 q-2 30 18 46 q14 12 12 34 q-3 22 -26 30 Z" fill="#e07a2a" stroke={ink} strokeWidth="3" />
            <path d="M170 244 q-16 -16 -14 -34 q2 -14 12 -22 q-1 18 8 22 q-4 -22 12 -34 q-1 18 10 30 q8 8 6 20 q-2 14 -16 18 Z" fill="#f0b93c" />
          </g>
          <g fill={ink}>
            <path d="M0 300 q30 -50 74 -66 q22 -8 30 -26 q6 14 -4 30 q-30 24 -50 62 Z" />
            <path d="M340 300 q-30 -50 -74 -66 q-22 -8 -30 -26 q-6 14 4 30 q30 24 50 62 Z" />
            <path d="M104 208 q-12 -14 -4 -24 q8 -10 18 0 q10 -12 18 -2 q8 10 -2 22 Z" />
            <path d="M236 208 q12 -14 4 -24 q-8 -10 -18 0 q-10 -12 -18 -2 q-8 10 2 22 Z" />
          </g>
          {Array.from({ length: 9 }).map((_, i) => (
            <circle key={i} cx={170 + Math.sin(i * 1.9) * (30 + i * 9)} cy={150 - i * 15} r={2.6 - i * 0.16} fill="#e07a2a" opacity={0.85 - i * 0.08} />
          ))}
        </>)}
      </g>
      <rect x="6" y="6" width="328" height="288" rx="4" fill="none" stroke={ink} strokeWidth="4" />
    </svg>
  );
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

  // ---- THE MAP UNDERNEATH: a real GIS basemap that flies across the actual
  //   territory as the story moves, with the animation painted over it. ----
  const mapElRef = useR7(null);
  const mapRef = useR7(null);
  const tileRef = useR7(null);
  const markersRef = useR7(null);
  const lastGeoRef = useR7(-1);

  useE7(() => {
    let poll = null, cancelled = false;
    function init() {
      if (cancelled || mapRef.current || !mapElRef.current) return true;
      if (!window.L) return false;                 // Leaflet may still be loading
      build();
      return true;
    }
    function build() {
    const map = window.L.map(mapElRef.current, {
      center: _F7[0].geo.c, zoom: _F7[0].geo.z,
      zoomControl: false, attributionControl: true,
      scrollWheelZoom: false, dragging: false, doubleClickZoom: false,
      boxZoom: false, keyboard: false, touchZoom: false,
    });
    map.attributionControl.setPrefix('');
    tileRef.current = window.L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      { attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 18 }
    ).addTo(map);
    markersRef.current = window.L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 60);
    }
    if (!init()) poll = setInterval(() => { if (init() && poll) { clearInterval(poll); poll = null; } }, 250);
    return () => {
      cancelled = true; if (poll) clearInterval(poll);
      try { if (mapRef.current) mapRef.current.remove(); } catch (e) {}
      mapRef.current = null;
    };
  }, []);

  // fly the map as the chapter changes; light up the real communities at the end
  useE7(() => {
    const map = mapRef.current; if (!map) return;
    const isLast = act >= _F7.length;
    const ch = isLast ? _F7[_F7.length - 1] : _F7[Math.min(act, _F7.length - 1)];
    if (lastGeoRef.current !== act) {
      lastGeoRef.current = act;
      try {
        if (isLast) {
          const pts = (all || []).filter(c => c.lat != null && c.lng != null).map(c => [c.lat, c.lng]);
          if (pts.length) map.flyToBounds(window.L.latLngBounds(pts).pad(0.18), { duration: 2.2 });
          else map.flyTo(ch.geo.c, ch.geo.z, { duration: 2.2 });
        } else {
          map.flyTo(ch.geo.c, ch.geo.z, { duration: 2.2 });
        }
      } catch (e) {}
    }
    // real community points appear on the closing panel
    const mk = markersRef.current; if (!mk) return;
    mk.clearLayers();
    if (isLast) {
      (all || []).forEach((c, i) => {
        if (c.lat == null || c.lng == null) return;
        const m = window.L.circleMarker([c.lat, c.lng], {
          radius: 5, color: '#ffd27a', weight: 1.4, fillColor: '#ff9f2e', fillOpacity: 0.9, opacity: 0.95,
        }).addTo(mk);
        m.bindTooltip(String(c.name || '').trim(), { direction: 'top', offset: [0, -6] });
        m.on('click', () => onSelect && onSelect(c.id));
      });
    }
  }, [act, all, onSelect]);

  // the basemap shifts with the mood, but always stays readable (accessibility)
  useE7(() => {
    const el = mapElRef.current; if (!el) return;
    const ch = act >= _F7.length ? _F7[_F7.length - 1] : _F7[Math.min(act, _F7.length - 1)];
    const F = {
      day:   'saturate(1.02) brightness(1.02) contrast(1.02)',
      dusk:  'saturate(0.92) brightness(0.94) contrast(1.04) sepia(0.16)',
      grey:  'saturate(0.32) brightness(0.88) contrast(1.08)',
      night: 'saturate(0.5) brightness(0.72) contrast(1.06) hue-rotate(-8deg)',
      dawn:  'saturate(1.0) brightness(1.0) contrast(1.02) sepia(0.10)',
    };
    el.style.filter = F[ch.mood] || F.day;
  }, [act]);

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

    // ---- reusable art helpers ------------------------------------------
    let tt = 0;                                   // animation clock, shared by the helpers below
    const rnd = (n) => { let s = n * 9301 + 49297; return ((s * 233280) % 233280) / 233280; };
    function ridge(y, amp, col, seed, step) {       // a soft rolling horizon band
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-10, H);
      for (let x = -10; x <= W + 10; x += (step || 26)) {
        const h = Math.sin(x * 0.0035 + seed) * amp + Math.sin(x * 0.0012 + seed * 2) * amp * 0.7;
        ctx.lineTo(x, y + h);
      }
      ctx.lineTo(W + 10, H); ctx.closePath(); ctx.fill();
    }
    function pines(y, h, col, seed, gap) {          // a silhouetted treeline
      ctx.fillStyle = col;
      for (let x = -20; x < W + 20; x += gap) {
        const j = rnd(x + seed), hh = h * (0.65 + j * 0.7), w = hh * 0.28;
        const bx = x + j * gap * 0.6, by = y + Math.sin(bx * 0.0035 + seed) * 6;
        ctx.beginPath(); ctx.moveTo(bx - w, by);
        ctx.lineTo(bx, by - hh); ctx.lineTo(bx + w, by); ctx.closePath(); ctx.fill();
      }
    }
    function mist(y, hgt, alpha, speed, seed) {     // drifting fog band
      ctx.save(); ctx.globalAlpha = alpha;
      const g = ctx.createLinearGradient(0, y - hgt, 0, y + hgt);
      g.addColorStop(0, 'rgba(226,232,240,0)'); g.addColorStop(0.5, 'rgba(226,232,240,0.85)');
      g.addColorStop(1, 'rgba(226,232,240,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-20, y + hgt);
      for (let x = -20; x <= W + 20; x += 30) ctx.lineTo(x, y + Math.sin(x * 0.004 + tt * speed + seed) * hgt * 0.5);
      ctx.lineTo(W + 20, y + hgt); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // ---- AN ILLUSTRATED PERSON — storybook style, not a stick figure.
    //   Shaded skin, a real face, hair with braids, a ribbon shirt with ribbon
    //   bands and a sash, a shawl option, jointed limbs, and a soft shadow. ----
    function figure(x, y, s, col, opt) {
      opt = opt || {};
      const skinL = '#c08c5e', skinD = '#8d5c33', hairD = '#150c06', hairH = '#3a2413';
      const HH = 108 * s;                                     // full standing height
      const hipY = y - HH * 0.46, shoY = y - HH * 0.78;
      const headR = 12.5 * s, headY = y - HH * 0.885 - headR * 0.5;
      const step = opt.walk ? Math.sin(tt * 2.6 + (opt.ph || 0)) : 0;
      const bob = opt.walk ? Math.abs(step) * 2.2 * s : Math.sin(tt * 1.1 + (opt.ph || 0)) * 1.2 * s;
      const dir = opt.dir || 1;
      // ground shadow anchors them to the bank
      ctx.fillStyle = 'rgba(18,26,14,0.34)';
      ctx.beginPath(); ctx.ellipse(x, y + 2 * s, 17 * s, 4.2 * s, 0, 0, 6.283); ctx.fill();
      const jl = (x0,y0,x1,y1,x2,y2,w,c) => {                 // 2-segment jointed limb
        ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      };
      // ---- legs: leggings that bend at the knee, moccasins with a cuff
      for (const sg of [-1, 1]) {
        const sw = step * sg * 10 * s;
        const kx = x + sg * 4.4 * s + sw * 0.45, ky = hipY + HH * 0.24 - bob;
        const ax = x + sg * 4.4 * s + sw,        ay = y - bob;
        jl(x + sg * 4.4 * s, hipY - bob, kx, ky, ax, ay, 8.4 * s, '#6b4a2a');
        ctx.fillStyle = '#3a2412';                              // moccasin
        ctx.beginPath(); ctx.ellipse(ax + sg * 1.2 * s, ay + 1.2 * s, 6.4 * s, 3 * s, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgba(226,196,140,0.75)';               // beaded cuff
        ctx.fillRect(ax - 4.4 * s, ay - 4.4 * s, 8.8 * s, 1.8 * s);
      }
      // ---- torso: ribbon shirt, shaded, with ribbon bands + a sash
      const tg = ctx.createLinearGradient(x - 12 * s, shoY, x + 13 * s, hipY);
      tg.addColorStop(0, col); tg.addColorStop(0.62, col); tg.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.moveTo(x - 11 * s, hipY - bob + 3 * s);
      ctx.lineTo(x - 10 * s, shoY - bob);
      ctx.quadraticCurveTo(x, shoY - bob - 4.6 * s, x + 10 * s, shoY - bob);
      ctx.lineTo(x + 11 * s, hipY - bob + 3 * s);
      ctx.quadraticCurveTo(x, hipY - bob + 6 * s, x - 11 * s, hipY - bob + 3 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(250,240,216,0.92)';                 // chest ribbon
      ctx.fillRect(x - 10 * s, shoY - bob + 9 * s, 20 * s, 2.6 * s);
      ctx.fillStyle = opt.band || '#d4a017';                    // applique band
      ctx.fillRect(x - 10.4 * s, shoY - bob + 13 * s, 20.8 * s, 1.8 * s);
      ctx.fillStyle = 'rgba(180,60,40,0.9)';                    // sash at the waist
      ctx.fillRect(x - 11.4 * s, hipY - bob - 3 * s, 22.8 * s, 4 * s);
      if (opt.shawl) {                                          // a shawl with fringe
        ctx.fillStyle = 'rgba(140,60,120,0.9)';
        ctx.beginPath();
        ctx.moveTo(x - 13 * s, shoY - bob + 2 * s);
        ctx.quadraticCurveTo(x, shoY - bob + 10 * s, x + 13 * s, shoY - bob + 2 * s);
        ctx.lineTo(x + 11 * s, hipY - bob - 4 * s); ctx.lineTo(x - 11 * s, hipY - bob - 4 * s);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(240,214,150,0.85)'; ctx.lineWidth = 1 * s;
        for (let f = -10; f <= 10; f += 3) {
          ctx.beginPath(); ctx.moveTo(x + f * s, hipY - bob - 4 * s);
          ctx.lineTo(x + f * s + Math.sin(tt * 2 + f) * 1.2 * s, hipY - bob + 4 * s); ctx.stroke();
        }
      }
      // ---- arms: shoulder → elbow → hand, with visible hands
      const sy2 = shoY - bob + 5 * s;
      for (const sg of [-1, 1]) {
        const up = opt.raise && sg === dir;
        const sw2 = opt.walk ? -step * sg * 5 * s : 0;
        const ex = x + sg * 14 * s + sw2 * 0.4, ey = up ? sy2 - 6 * s : sy2 + 11 * s;
        const hx = x + sg * (up ? 17 : 12.5) * s + sw2, hy = up ? sy2 - 26 * s : sy2 + 24 * s;
        jl(x + sg * 9.6 * s, sy2, ex, ey, hx, hy, 7 * s, skinD);
        ctx.fillStyle = skinL;
        ctx.beginPath(); ctx.arc(hx, hy, 3.6 * s, 0, 6.283); ctx.fill();
      }
      // ---- head: shaded skin, hair with a highlight, braids, a real face
      const hg = ctx.createRadialGradient(x - headR * 0.35, headY - headR * 0.35, headR * 0.2, x, headY, headR);
      hg.addColorStop(0, skinL); hg.addColorStop(1, skinD);
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.ellipse(x, headY, headR * 0.92, headR, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = hairD;                                    // hair crown
      ctx.beginPath(); ctx.ellipse(x, headY - headR * 0.22, headR * 1.02, headR * 0.94, 0, Math.PI + 0.16, 2 * Math.PI - 0.16); ctx.fill();
      ctx.strokeStyle = hairH; ctx.lineWidth = 1.6 * s;         // hair sheen
      ctx.beginPath(); ctx.arc(x - headR * 0.3, headY - headR * 0.42, headR * 0.5, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
      for (const sg of [-1, 1]) {                               // two braids, swinging
        const bw = Math.sin(tt * 1.6 + sg) * 1.6 * s;
        ctx.strokeStyle = hairD; ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x + sg * headR * 0.82, headY + headR * 0.1);
        ctx.quadraticCurveTo(x + sg * headR * 1.15 + bw, headY + headR * 1.5,
                             x + sg * headR * 0.95 + bw, headY + headR * 2.5); ctx.stroke();
        ctx.strokeStyle = opt.band || '#c93a1e'; ctx.lineWidth = 2.4 * s;   // hair tie
        ctx.beginPath(); ctx.moveTo(x + sg * headR * 1.02 + bw * 0.8, headY + headR * 2.15);
        ctx.lineTo(x + sg * headR * 0.86 + bw * 0.9, headY + headR * 2.35); ctx.stroke();
      }
      ctx.fillStyle = '#241407';                                 // eyes
      const blink = ((tt * 0.5 + (opt.ph || 0)) % 4) > 3.9 ? 0.15 : 1;
      ctx.beginPath(); ctx.ellipse(x - headR * 0.32, headY + headR * 0.06, 1.5 * s, 2.1 * s * blink, 0, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + headR * 0.32, headY + headR * 0.06, 1.5 * s, 2.1 * s * blink, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(90,44,20,0.75)'; ctx.lineWidth = 1.4 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, headY + headR * 0.26, headR * 0.34, 0.32 * Math.PI, 0.68 * Math.PI); ctx.stroke();
      if (opt.band) {                                            // beaded headband
        ctx.fillStyle = opt.band;
        ctx.beginPath(); ctx.ellipse(x, headY - headR * 0.44, headR * 0.96, headR * 0.22, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgba(250,240,210,0.9)';
        for (let b = -2; b <= 2; b++) { ctx.beginPath(); ctx.arc(x + b * headR * 0.34, headY - headR * 0.46, 1.1 * s, 0, 6.283); ctx.fill(); }
      }
      if (opt.feather) {                                         // an upright feather
        ctx.save(); ctx.translate(x + headR * 0.5, headY - headR * 0.9); ctx.rotate(0.28);
        ctx.fillStyle = '#f0e6d0';
        ctx.beginPath(); ctx.ellipse(0, -9 * s, 3 * s, 9 * s, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#3a2410';
        ctx.beginPath(); ctx.ellipse(0, -16 * s, 2.6 * s, 3 * s, 0, 0, 6.283); ctx.fill();
        ctx.restore();
      }
    }


    function draw(time) {
      tt = (time - (t0 == null ? (t0 = time) : t0)) / 1000;
      const p = pRef.current;
      const seg = p * (_F7.length + 1);
      const i = Math.max(0, Math.min(_F7.length - 1, Math.floor(seg)));
      const u = Math.max(0, Math.min(1, seg - i));
      const fire = _F7[i];
      const last = Math.max(0, Math.min(1, seg - _F7.length));   // the closing panel
      const sc = fire.scene;

      // ---- ATMOSPHERE OVER THE MAP — light, not darkness. The real basemap
      //   shows through; we paint weather and time-of-day on top of it. Every
      //   mood stays bright enough to read (accessibility). ----
      ctx.clearRect(0, 0, W, H);
      const MOOD = {
        day:   { top: [150,196,228], bot: [252,224,172], a: 0.15, star: 0,    warm: 1.00 },
        dusk:  { top: [162,168,220], bot: [252,196,150], a: 0.20, star: 0.12, warm: 0.95 },
        grey:  { top: [168,170,186], bot: [216,210,208], a: 0.26, star: 0,    warm: 0.75 },
        night: { top: [ 72, 86,136], bot: [146,132,156], a: 0.40, star: 0.85, warm: 0.62 },
        dawn:  { top: [168,172,222], bot: [255,226,170], a: 0.16, star: 0.20, warm: 1.00 },
      };
      const mNow = MOOD[fire.mood] || MOOD.day;
      const mNxt = MOOD[(_F7[Math.min(_F7.length - 1, i + 1)] || fire).mood] || mNow;
      const bl = (k, j) => lerp(mNow[k][j], mNxt[k][j], u);          // blend between chapters
      const mA  = lerp(mNow.a, mNxt.a, u), mStar = lerp(mNow.star, mNxt.star, u);
      const wash = ctx.createLinearGradient(0, 0, 0, H);
      wash.addColorStop(0,    `rgba(${Math.round(bl('top',0))},${Math.round(bl('top',1))},${Math.round(bl('top',2))},${mA + 0.10})`);
      wash.addColorStop(0.52, `rgba(${Math.round(lerp(bl('top',0), bl('bot',0), 0.5))},${Math.round(lerp(bl('top',1), bl('bot',1), 0.5))},${Math.round(lerp(bl('top',2), bl('bot',2), 0.5))},${mA * 0.55})`);
      wash.addColorStop(1,    `rgba(${Math.round(bl('bot',0))},${Math.round(bl('bot',1))},${Math.round(bl('bot',2))},${mA * 0.75})`);
      ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H);

      if (mStar > 0.05) {                                            // stars, upper sky only
        for (const s of stars) {
          ctx.globalAlpha = mStar * (0.25 + 0.55 * (0.5 + 0.5 * Math.sin(tt * 1.4 + s.tw)));
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(s.x * W, s.y * H * 0.42, s.r, 0, 6.283); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      // aurora — a gift at the start and again at the end
      const aur = Math.max(0, Math.max(1 - seg / 2.0, last)) * 0.95;
      if (aur > 0.04) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const cols = ['128,214,168', '236,190,86', '162,152,232'];
        for (let a2 = 0; a2 < 3; a2++) {
          ctx.globalAlpha = aur * (0.13 + 0.05 * Math.sin(tt * 0.5 + a2));
          ctx.strokeStyle = `rgb(${cols[a2]})`; ctx.lineWidth = 56;
          ctx.beginPath();
          for (let x = -30; x <= W + 30; x += 26) {
            ctx.lineTo(x, H * 0.11 + a2 * 44 + Math.sin(x * 0.005 + tt * 0.35 + a2 * 1.7) * 32 + Math.sin(x * 0.011 + tt * 0.5) * 12);
          }
          ctx.stroke();
        }
        ctx.restore(); ctx.globalAlpha = 1;
      }
      mist(H * 0.50, 34, 0.14, 0.10, 0.5);                            // weather over the territory

      // ---- THE STAGE: a lit foreground bank so the scene stands ON something
      //   instead of floating over the map. ----
      const gY = H * 0.845, wm = lerp(mNow.warm, mNxt.warm, u);
      const bank = ctx.createLinearGradient(0, gY - 60, 0, H);
      bank.addColorStop(0, `rgba(${Math.round(lerp(60,96,wm))},${Math.round(lerp(70,110,wm))},${Math.round(lerp(64,74,wm))},0.55)`);
      bank.addColorStop(0.35, `rgba(${Math.round(lerp(48,80,wm))},${Math.round(lerp(60,96,wm))},${Math.round(lerp(52,60,wm))},0.92)`);
      bank.addColorStop(1, `rgba(${Math.round(lerp(30,52,wm))},${Math.round(lerp(40,64,wm))},${Math.round(lerp(34,40,wm))},0.99)`);
      ctx.fillStyle = bank;
      ctx.beginPath(); ctx.moveTo(-10, H);
      for (let x = -10; x <= W + 10; x += 24) ctx.lineTo(x, gY + Math.sin(x * 0.0032 + 1.1) * 16 + Math.sin(x * 0.0009) * 10);
      ctx.lineTo(W + 10, H); ctx.closePath(); ctx.fill();
      // grass fringe along the crest so the edge isn't a hard line
      ctx.strokeStyle = `rgba(${Math.round(lerp(70,120,wm))},${Math.round(lerp(96,150,wm))},${Math.round(lerp(66,80,wm))},0.85)`;
      ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      for (let x = 0; x < W; x += 9) {
        const by = gY + Math.sin(x * 0.0032 + 1.1) * 16 + Math.sin(x * 0.0009) * 10;
        const h2 = 7 + rnd(x) * 11, sw = Math.sin(tt * 1.2 + x * 0.02) * 2.4;
        ctx.beginPath(); ctx.moveTo(x, by + 2); ctx.quadraticCurveTo(x + sw * 0.5, by - h2 * 0.6, x + sw, by - h2); ctx.stroke();
      }

      // ================= WORLD-CHANGING PROPS =================
      // the built world arrives and grows across the chapters: sail ships →
      // survey stakes, fence and a steam train → the school and the bus that
      // took the children → a car → the community's own buildings today.
      const bldg = (bx, by, bw, bh, col, roof) => {
        const L = bx - bw / 2;
        ctx.fillStyle = 'rgba(14,12,8,0.28)';                          // ground shadow
        ctx.beginPath(); ctx.ellipse(bx, by + 3, bw * 0.62, 6, 0, 0, 6.283); ctx.fill();
        const wg = ctx.createLinearGradient(L, by - bh, L + bw, by);   // shaded wall
        wg.addColorStop(0, col); wg.addColorStop(0.6, col); wg.addColorStop(1, 'rgba(0,0,0,0.34)');
        ctx.fillStyle = wg; ctx.fillRect(L, by - bh, bw, bh);
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;       // clapboard lines
        for (let yy = by - bh + 8; yy < by; yy += 9) { ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(L + bw, yy); ctx.stroke(); }
        ctx.fillStyle = roof || 'rgba(58,44,34,0.97)';                  // pitched roof with eaves
        ctx.beginPath(); ctx.moveTo(L - 9, by - bh);
        ctx.lineTo(bx, by - bh - bw * 0.30); ctx.lineTo(L + bw + 9, by - bh); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.22)';                             // eave shadow on the wall
        ctx.fillRect(L, by - bh, bw, 4);
        ctx.fillStyle = roof || 'rgba(58,44,34,0.97)';                  // chimney
        ctx.fillRect(bx + bw * 0.26, by - bh - bw * 0.24, 9, bw * 0.16);
        const cols2 = Math.max(2, Math.round(bw / 30));                 // windows, evenly inset
        const rows2 = bh > 74 ? 2 : 1;
        for (let r = 0; r < rows2; r++) for (let c = 0; c < cols2; c++) {
          const wx = L + bw * 0.12 + c * (bw * 0.76) / (cols2 - 1 || 1) - 6;
          const wy = by - bh + 16 + r * (bh * 0.40);
          ctx.fillStyle = 'rgba(250,226,150,0.9)'; ctx.fillRect(wx, wy, 12, 14);
          ctx.strokeStyle = 'rgba(40,28,16,0.5)'; ctx.lineWidth = 1.4; ctx.strokeRect(wx, wy, 12, 14);
          ctx.beginPath(); ctx.moveTo(wx + 6, wy); ctx.lineTo(wx + 6, wy + 14); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(52,36,22,0.95)';                          // a door
        ctx.fillRect(bx - 11, by - 30, 22, 30);
        ctx.fillStyle = 'rgba(250,226,150,0.55)'; ctx.fillRect(bx - 7, by - 26, 14, 9);
        ctx.fillStyle = 'rgba(30,22,14,0.5)';                           // foundation
        ctx.fillRect(L - 3, by - 4, bw + 6, 5);
      };
      const ship = (sx, sy, sc2) => {                                  // a tall sailing ship
        ctx.save(); ctx.translate(sx, sy); ctx.scale(sc2, sc2);
        ctx.fillStyle = 'rgba(52,38,26,0.96)';
        ctx.beginPath(); ctx.moveTo(-34, 0); ctx.quadraticCurveTo(0, 12, 34, 0);
        ctx.lineTo(26, -9); ctx.lineTo(-26, -9); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(52,38,26,0.96)'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, -66); ctx.stroke();
        ctx.fillStyle = 'rgba(246,242,232,0.96)';
        ctx.beginPath(); ctx.moveTo(2, -62); ctx.quadraticCurveTo(26, -40, 22, -14); ctx.lineTo(2, -14); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-2, -52); ctx.quadraticCurveTo(-22, -34, -18, -14); ctx.lineTo(-2, -14); ctx.closePath(); ctx.fill();
        ctx.restore();
      };
      const train = (tx, ty, sc2) => {                                 // a steam locomotive
        ctx.save(); ctx.translate(tx, ty); ctx.scale(sc2, sc2);
        ctx.fillStyle = 'rgba(38,32,30,0.96)';
        ctx.fillRect(-40, -26, 44, 22); ctx.fillRect(4, -18, 34, 14);
        ctx.fillRect(-34, -40, 16, 14);                                 // cab roof
        ctx.beginPath(); ctx.arc(20, -30, 6, 0, 6.283); ctx.fill();      // stack
        ctx.fillStyle = 'rgba(250,226,150,0.9)'; ctx.fillRect(-30, -22, 9, 9);
        ctx.fillStyle = 'rgba(38,32,30,0.96)';
        for (const wx of [-30, -14, 12, 30]) { ctx.beginPath(); ctx.arc(wx, -2, 6, 0, 6.283); ctx.fill(); }
        ctx.restore();
        for (let p = 0; p < 5; p++) {                                   // smoke plume
          const pu = ((tt * 0.5 + p * 0.2) % 1);
          ctx.globalAlpha = (1 - pu) * 0.5;
          ctx.fillStyle = 'rgba(216,212,204,1)';
          ctx.beginPath(); ctx.arc(tx + 20 * sc2 + pu * 46, ty - 36 * sc2 - pu * 40, (4 + pu * 12) * sc2, 0, 6.283); ctx.fill();
        }
        ctx.globalAlpha = 1;
      };
      const vehicle = (vx, vy, sc2, col, bus) => {                      // a bus (took the children) or a car
        ctx.save(); ctx.translate(vx, vy); ctx.scale(sc2, sc2);
        ctx.fillStyle = 'rgba(20,16,10,0.3)';
        ctx.beginPath(); ctx.ellipse(0, 4, bus ? 44 : 30, 4, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = col;
        if (bus) {
          ctx.fillRect(-40, -30, 80, 28);
          ctx.fillStyle = 'rgba(216,232,240,0.9)';
          for (let w = 0; w < 4; w++) ctx.fillRect(-33 + w * 19, -25, 13, 11);
        } else {
          ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(-28, -11);
          ctx.quadraticCurveTo(-14, -24, 4, -24); ctx.quadraticCurveTo(20, -24, 26, -11);
          ctx.lineTo(28, 0); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(216,232,240,0.9)';
          ctx.beginPath(); ctx.moveTo(-16, -12); ctx.lineTo(-12, -21); ctx.lineTo(2, -21); ctx.lineTo(2, -12); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = 'rgba(24,20,18,0.96)';
        for (const wx of bus ? [-26, 26] : [-16, 16]) { ctx.beginPath(); ctx.arc(wx, 0, bus ? 8 : 7, 0, 6.283); ctx.fill(); }
        ctx.fillStyle = 'rgba(255,232,160,0.9)';
        ctx.beginPath(); ctx.arc(bus ? 40 : 28, -10, 3.4, 0, 6.283); ctx.fill();
        ctx.restore();
      };

      // ================= CHAPTER SCENES =================
      const wY = gY;                                  // the scene stands on the lit bank
      if (sc === 'land') {                                       // BEFORE: a living camp
        for (let l = 0; l < 3; l++) {                            // lodges
          const lx = W * (0.58 + l * 0.13), ly = gY - 4;
          ctx.fillStyle = `rgba(${Math.round(lerp(92,132,wm))},${Math.round(lerp(64,92,wm))},${Math.round(lerp(40,56,wm))},1)`;
          ctx.beginPath(); ctx.moveTo(lx - 34, ly); ctx.quadraticCurveTo(lx, ly - 52, lx + 34, ly); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(20,12,6,0.8)';
          ctx.beginPath(); ctx.ellipse(lx, ly - 2, 7, 11, 0, Math.PI, 2 * Math.PI); ctx.fill();
        }
      }
      if (sc === 'contact') {                                    // THE NEWCOMERS ARRIVE: tall ships on the water
        // a strip of open water beyond the shore, so the ships FLOAT
        const shoreY = gY - 6, waterTop = shoreY - 132;
        const wg2 = ctx.createLinearGradient(W * 0.34, 0, W * 0.62, 0);   // fades in from the shore
        wg2.addColorStop(0, 'rgba(76,112,140,0)'); wg2.addColorStop(0.45, 'rgba(76,112,140,0.6)');
        wg2.addColorStop(1, 'rgba(64,102,128,0.82)');
        ctx.fillStyle = wg2;
        ctx.beginPath();
        ctx.moveTo(W * 0.30, shoreY);
        for (let x = W * 0.30; x <= W + 10; x += 20) ctx.lineTo(x, waterTop + Math.sin(x * 0.004 + 1.4) * 10);
        ctx.lineTo(W + 10, shoreY); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.2;   // swell lines
        for (let wv = 0; wv < 6; wv++) {
          const yy = waterTop + 18 + wv * 20;
          ctx.beginPath();
          for (let x = W * 0.40; x <= W; x += 16) ctx.lineTo(x, yy + Math.sin(x * 0.02 + tt * 1.1 + wv) * 2.6);
          ctx.stroke();
        }
        // the ships ride the swell, each at its own waterline
        ship(W * 0.58, waterTop + 46 + Math.sin(tt * 0.9) * 3, 1.05);
        ship(W * 0.74, waterTop + 78 + Math.sin(tt * 0.8 + 1) * 3.4, 1.35);
        ship(W * 0.90, waterTop + 112 + Math.sin(tt * 1.0 + 2) * 3.8, 1.7);
        for (let s = 0; s < 3; s++) {
          const sx = W * (0.62 + s * 0.13), sy = gY - 10;
          ctx.fillStyle = `rgba(246,242,232,${0.72 + 0.2 * wm})`;
          ctx.beginPath(); ctx.moveTo(sx, sy - 68); ctx.lineTo(sx + 22, sy); ctx.lineTo(sx - 22, sy); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(50,40,32,0.85)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(sx, sy - 74); ctx.lineTo(sx, sy); ctx.stroke();
        }
        const bx = W * 0.30, by = gY - 42;                       // wampum belt
        for (let b = 0; b < 22; b++) {
          ctx.fillStyle = (b % 7 < 3) ? 'rgba(240,238,230,0.95)' : 'rgba(80,110,150,0.95)';
          ctx.fillRect(bx + b * 9, by + Math.sin(b * 0.5 + tt) * 2, 7, 12);
        }
      }
      if (sc === 'law') {                                        // THE LAND IS CUT UP: survey stakes, fence, a train
        ctx.strokeStyle = 'rgba(70,58,46,0.95)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        for (let f = 0; f < 16; f++) {                            // a fence marching across the land
          const fx2 = W * 0.06 + f * (W * 0.062);
          ctx.beginPath(); ctx.moveTo(fx2, gY + 4); ctx.lineTo(fx2, gY - 26); ctx.stroke();
        }
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(W * 0.06, gY - 20); ctx.lineTo(W * 0.98, gY - 20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W * 0.06, gY - 10); ctx.lineTo(W * 0.98, gY - 10); ctx.stroke();
        train(((tt * 52) % (W + 520)) - 240, gY - 34, 1.7);       // the railway arrives
        ctx.save(); ctx.globalAlpha = 0.35 + u * 0.35;
        ctx.fillStyle = 'rgba(8,6,12,0.92)';
        for (let b = 0; b < 14; b++) ctx.fillRect(W * 0.06 + b * (W * 0.066), 0, 13, H);
        ctx.restore();
      }
      if (sc === 'shoes' || sc === 'scoop') {                    // THE INSTITUTION + THE VEHICLE THAT TOOK THEM
        bldg(W * 0.60, gY + 2, 210, 118, 'rgba(78,66,62,0.97)');  // the big institution, unmistakable
        bldg(W * 0.75, gY + 4, 104, 74, 'rgba(68,58,54,0.97)');
        const away = (tt * 0.11) % 1;                              // it drives away, and keeps driving
        ctx.save(); ctx.globalAlpha = 0.35 + 0.65 * (1 - away);
        if (sc === 'shoes') vehicle(W * 0.52 + away * W * 0.46, gY - 6, 1.55, 'rgba(54,48,44,0.97)', true);
        else                vehicle(W * 0.52 + away * W * 0.46, gY - 6, 1.4, 'rgba(58,62,70,0.97)', false);
        ctx.restore();
        const rows = 3, per = 8;
        for (let r = 0; r < rows; r++) for (let c = 0; c < per; c++) {
          const app = Math.max(0, Math.min(1, u * 3.4 - (r * per + c) / (rows * per) * 2.2));
          if (app <= 0) continue;
          const depth = 1 - r * 0.14;
          const sx = W * 0.5 + (c - (per - 1) / 2) * 92 * depth + r * 30;
          const sy = gY + 4 + r * 40;
          const S = 2.1 * depth;                                  // big enough to read as a shoe
          const warmSet = sc === 'scoop' ? ['#a8703f', '#bd8049', '#95643a'] : ['#e07a2a', '#cf6a20', '#f0913f'];
          const base = warmSet[(r + c) % 3];
          ctx.save(); ctx.globalAlpha = app;
          ctx.fillStyle = 'rgba(16,12,6,0.32)';                   // shadow
          ctx.beginPath(); ctx.ellipse(sx + 1 * S, sy + 2.6 * S, 13 * S, 2.8 * S, 0, 0, 6.283); ctx.fill();
          // ---- the upper: heel at the left, rising instep, long toe to the right
          ctx.beginPath();
          ctx.moveTo(sx - 10 * S, sy);                            // heel bottom
          ctx.lineTo(sx - 10 * S, sy - 6.5 * S);                  // heel back
          ctx.quadraticCurveTo(sx - 10 * S, sy - 10.5 * S, sx - 6 * S, sy - 10.8 * S);   // heel collar
          ctx.quadraticCurveTo(sx - 1.5 * S, sy - 11 * S, sx + 0.5 * S, sy - 7.5 * S);   // instep dip
          ctx.quadraticCurveTo(sx + 3 * S, sy - 5 * S, sx + 8 * S, sy - 4 * S);          // vamp
          ctx.quadraticCurveTo(sx + 12.5 * S, sy - 3.4 * S, sx + 12.5 * S, sy - 0.6 * S);// toe cap
          ctx.closePath();
          const ug = ctx.createLinearGradient(sx, sy - 11 * S, sx, sy);
          ug.addColorStop(0, base); ug.addColorStop(0.55, base); ug.addColorStop(1, 'rgba(0,0,0,0.4)');
          ctx.fillStyle = ug; ctx.fill();
          ctx.strokeStyle = 'rgba(46,20,4,0.55)'; ctx.lineWidth = 1.1 * S; ctx.stroke();
          // toe cap seam
          ctx.strokeStyle = 'rgba(46,20,4,0.4)'; ctx.lineWidth = 0.9 * S;
          ctx.beginPath(); ctx.moveTo(sx + 7 * S, sy - 4.2 * S); ctx.quadraticCurveTo(sx + 7.6 * S, sy - 2 * S, sx + 7.2 * S, sy - 0.4 * S); ctx.stroke();
          // padded collar around the opening
          ctx.fillStyle = 'rgba(255,242,220,0.7)';
          ctx.beginPath(); ctx.ellipse(sx - 4.4 * S, sy - 10.4 * S, 5.4 * S, 1.9 * S, -0.16, 0, 6.283); ctx.fill();
          // tongue
          ctx.fillStyle = 'rgba(255,238,206,0.55)';
          ctx.beginPath(); ctx.ellipse(sx - 0.6 * S, sy - 8.4 * S, 2.2 * S, 2.6 * S, -0.4, 0, 6.283); ctx.fill();
          // criss-cross laces
          ctx.strokeStyle = 'rgba(255,246,226,0.92)'; ctx.lineWidth = 1.15 * S; ctx.lineCap = 'round';
          for (let k = 0; k < 3; k++) {
            const lx = sx - 6.5 * S + k * 2.4 * S, ly = sy - 9.4 * S + k * 1.5 * S;
            ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 3.4 * S, ly + 1.9 * S); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(lx + 3.4 * S, ly); ctx.lineTo(lx, ly + 1.9 * S); ctx.stroke();
          }
          // the sole — a lighter slab that reads as rubber, slightly proud of the upper
          ctx.fillStyle = 'rgba(238,226,206,0.95)';
          ctx.beginPath();
          ctx.moveTo(sx - 11 * S, sy - 0.4 * S);
          ctx.lineTo(sx + 13.2 * S, sy - 0.8 * S);
          ctx.quadraticCurveTo(sx + 14.2 * S, sy + 1.6 * S, sx + 12 * S, sy + 2 * S);
          ctx.lineTo(sx - 10 * S, sy + 2 * S);
          ctx.quadraticCurveTo(sx - 12 * S, sy + 1.6 * S, sx - 11 * S, sy - 0.4 * S);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(60,40,20,0.35)'; ctx.lineWidth = 0.7 * S; ctx.stroke();
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
      if (sc === 'voices') {                                     // A GATHERING: people come together to be heard
        bldg(W * 0.80, gY + 2, 150, 84, 'rgba(104,88,76,0.94)');
        for (let s = 0; s < 26; s++) {                            // words rising as light
          const su = ((tt * 0.24 + s * 0.038) % 1);
          ctx.globalAlpha = (1 - su) * 0.75;
          ctx.fillStyle = '#ffe9b0';
          ctx.beginPath(); ctx.arc(W * (0.2 + (s % 5) * 0.14) + Math.sin(su * 5 + s) * 16, gY - 40 - su * 260, 2.2, 0, 6.283); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      if (sc === 'return') {                                     // THE COMMUNITY TODAY: its own buildings + a car
        bldg(W * 0.60, gY + 2, 176, 98, 'rgba(126,102,72,0.97)'); // their own community building
        bldg(W * 0.85, gY + 2, 152, 84, 'rgba(104,120,84,0.97)'); // and the school they run themselves
        vehicle(W * 0.70 + Math.sin(tt * 0.3) * W * 0.06, gY - 4, 1.25, 'rgba(186,68,44,0.97)', false);
      }

      // ---- THE PEOPLE, CHAPTER BY CHAPTER — the cast changes as the story
      //   moves: a full busy camp → watching the horizon → penned in and few →
      //   almost no one left → standing together again → a whole community. ----
      const CAST = {
        land:    [[0.16,1.2,'#b8351e','shawl'],[0.25,1.25,'#1f4e8f','raise'],[0.33,0.85,'#5a7d3a',''],[0.40,1.15,'#7c2f6b','shawl'],[0.47,1.2,'#d68a1f',''],[0.55,0.8,'#2f8f4f','']],
        contact: [[0.14,1.2,'#b8351e','raise'],[0.22,1.15,'#1f4e8f',''],[0.30,0.85,'#5a7d3a','']],
        law:     [[0.30,1.15,'#7c6a8f',''],[0.44,1.1,'#6b5f78','']],
        shoes:   [[0.30,1.2,'#8a5a4a','']],
        scoop:   [[0.28,1.15,'#8a6a5a',''],[0.40,1.1,'#7a5f52','']],
        voices:  [[0.20,1.2,'#c93a1e','raise'],[0.28,1.2,'#1f4e8f','raise'],[0.36,1.25,'#7c2f6b','raise'],[0.44,1.2,'#5a7d3a','raise'],[0.52,1.2,'#d68a1f','raise']],
        return:  [[0.10,1.2,'#c93a1e','walk'],[0.18,1.25,'#1f4e8f','walk'],[0.26,0.85,'#7c2f6b','walk'],[0.34,1.2,'#5a7d3a','walk'],[0.42,1.25,'#d68a1f','walk'],[0.50,0.9,'#2f8f4f','walk']],
      };
      (CAST[sc] || []).forEach(([fxr, fs, fc, mode], ci) => {
        const px2 = W * fxr + (mode === 'walk' ? Math.sin(tt * 0.4 + ci) * 6 : 0);
        figure(px2, gY + (ci % 3) * 7, fs, fc, {
          band: sc === 'law' || sc === 'shoes' || sc === 'scoop' ? null : '#d4a017',
          shawl: mode === 'shawl', raise: mode === 'raise', walk: mode === 'walk',
          feather: sc === 'land' && ci === 1, ph: ci * 1.1, dir: 1,
        });
        if (sc === 'return') {                                   // each carries a light home
          const lx2 = px2 + 16, ly2 = gY - 40;
          const lg2 = ctx.createRadialGradient(lx2, ly2, 0, lx2, ly2, 30);
          lg2.addColorStop(0, 'rgba(255,206,120,0.85)'); lg2.addColorStop(1, 'rgba(255,206,120,0)');
          ctx.fillStyle = lg2; ctx.beginPath(); ctx.arc(lx2, ly2, 30, 0, 6.283); ctx.fill();
        }
      });

      // ---- THE FIRE — one fire carried the whole way ----
      const fx = W * 0.5, fy = wY - 6;
      let str = 1;
      if (sc === 'law') str = 0.7;
      if (sc === 'shoes') str = 0.10 + 0.05 * Math.sin(tt * 2.2);
      if (sc === 'scoop') str = 0.16 + 0.05 * Math.sin(tt * 2);
      if (sc === 'voices') str = 0.45 + u * 0.5;
      if (sc === 'return') str = 0.9 + u * 0.7;
      str = Math.max(str, last * 2.1);
      const flk = 0.84 + Math.sin(tt * 8.5) * 0.11 + Math.sin(tt * 21) * 0.05;
      const R = 190 * str * flk;
      const fg = ctx.createRadialGradient(fx, fy - 34, 6, fx, fy - 34, R);
      fg.addColorStop(0, `rgba(255,222,158,${0.55 * Math.min(1, str)})`);
      fg.addColorStop(0.35, `rgba(255,150,58,${0.24 * Math.min(1, str)})`);
      fg.addColorStop(1, 'rgba(255,140,50,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(fx, fy - 34, R, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,180,90,0.16)';                     // firelight pool on the ground
      ctx.beginPath(); ctx.ellipse(fx, fy + 6, 130 * Math.min(1.3, str), 22 * Math.min(1.3, str), 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = `rgba(${Math.round(lerp(64,104,wm))},${Math.round(lerp(42,70,wm))},34,1)`;   // logs
      ctx.lineWidth = 11; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(fx - 44, fy + 10); ctx.lineTo(fx + 38, fy - 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx - 38, fy - 8); ctx.lineTo(fx + 44, fy + 10); ctx.stroke();
      const fh = 130 * Math.min(1.5, str) * flk;                   // layered flames
      for (let f = 0; f < 4; f++) {
        const w2 = (34 - f * 7) * Math.min(1.35, str);
        ctx.fillStyle = [`rgba(190,64,18,${0.85 * Math.min(1, str)})`,
                         `rgba(236,110,26,${0.9 * Math.min(1, str)})`,
                         `rgba(255,168,48,${0.92 * Math.min(1, str)})`,
                         `rgba(255,236,176,${0.95 * Math.min(1, str)})`][f];
        const sway = Math.sin(tt * 2.6 + f * 1.3) * 9 * Math.min(1, str);
        ctx.beginPath(); ctx.moveTo(fx - w2, fy);
        ctx.quadraticCurveTo(fx - w2 * 0.4 + sway, fy - fh * (0.55 - f * 0.09), fx + sway * 0.7, fy - fh * (1 - f * 0.17));
        ctx.quadraticCurveTo(fx + w2 * 0.4 + sway, fy - fh * (0.55 - f * 0.09), fx + w2, fy);
        ctx.closePath(); ctx.fill();
      }
      const nE = Math.round(14 + last * 54);                       // embers → become the communities
      for (let e = 0; e < nE; e++) {
        const eu = ((tt * 0.3 + e * 0.11) % 1);
        const spread = 44 + last * (W * 0.46);
        const ex = fx + Math.sin(eu * 5.5 + e * 2.1) * spread * eu;
        const ey = fy - 40 - eu * (230 + last * 300);
        ctx.globalAlpha = (1 - eu) * (0.5 + 0.5 * Math.min(1, str));
        ctx.fillStyle = e % 4 === 0 ? '#fff0c8' : '#ffb347';
        ctx.beginPath(); ctx.arc(ex, ey, 1.6 + (1 - eu) * 2, 0, 6.283); ctx.fill();
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
          <div ref={mapElRef} className="sf-map" />
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
            <div className="sf-era">Today</div>
            <div className="sf-num">And here is where it stands</div>
            <h2>Still here.</h2>
            <p>
              This atlas is not a story about survival. It is a count of it — every
              one of these is a nation or partner documenting how it cares for its
              own people, right now.
            </p>
            <div className="sf-live">
              <div><b>{truths.total}</b><span>communities &amp; partners standing</span></div>
              <div><b>{truths.withPillars}</b><span>documenting care for their people</span></div>
              <div><b>{truths.survivorSupport}</b><span>holding survivors</span></div>
              <div><b>{truths.youth}</b><span>with the youth on the land</span></div>
            </div>
            <p className="sf-close">
              The children who were taken have grandchildren who are being cared for
              by their own nations. Every ember above is one of them.
            </p>
            <div className="sf-cta">
              <button className="sf-btn" onClick={() => setView && setView('directory')}>Meet the {truths.total} →</button>
              <button className="sf-btn ghost" onClick={() => setView && setView('stories')}>Walk the teachings</button>
            </div>
            <p className="sf-src">
              Every nation has its own history and its own way of telling it. This page
              holds only to what is shared, names no one, and speaks for no one. The
              community numbers are live from this atlas.
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
