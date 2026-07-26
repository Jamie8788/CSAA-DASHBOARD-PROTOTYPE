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
    // a properly drawn standing person (head, hair, shaped body, jointed limbs)
    function figure(x, y, s, col, opt) {
      opt = opt || {};
      const skin = opt.skin || '#a3704a', hair = '#150c06';
      const HH = 62 * s, hipY = y - HH * 0.44, shoY = y - HH * 0.80;
      const headR = 7.2 * s, headY = y - HH * 0.90 - headR * 0.6;
      const step = opt.walk ? Math.sin(tt * 3 + (opt.ph || 0)) : 0;
      const seg = (x0, y0, x1, y1, x2, y2, w, c) => {
        ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      };
      for (const sg of [-1, 1]) {                   // legs, bent at the knee
        const sw = step * sg * 6 * s;
        seg(x + sg * 2.6 * s, hipY, x + sg * 2.6 * s + sw * 0.5, hipY + HH * 0.24,
            x + sg * 2.6 * s + sw, y, 4.6 * s, '#4e3a24');
        ctx.fillStyle = '#241608';
        ctx.beginPath(); ctx.ellipse(x + sg * 2.6 * s + sw, y + 0.8 * s, 3.2 * s, 1.5 * s, 0, 0, 6.283); ctx.fill();
      }
      const bg = ctx.createLinearGradient(x - 7 * s, shoY, x + 7 * s, hipY);   // shaded torso
      bg.addColorStop(0, col); bg.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(x - 6.6 * s, hipY); ctx.lineTo(x - 5.6 * s, shoY);
      ctx.quadraticCurveTo(x, shoY - 2.4 * s, x + 5.6 * s, shoY);
      ctx.lineTo(x + 6.6 * s, hipY);
      ctx.quadraticCurveTo(x, hipY + 1.6 * s, x - 6.6 * s, hipY);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(248,238,214,0.85)';                                 // ribbon
      ctx.fillRect(x - 5.8 * s, shoY + 5 * s, 11.6 * s, 1.5 * s);
      const sy2 = shoY + 2.4 * s;                                               // arms, bent at the elbow
      for (const sg of [-1, 1]) {
        const lift = opt.raise && sg === (opt.dir || 1);
        const ex = x + sg * 8 * s, ey = lift ? sy2 - 2 * s : sy2 + 6 * s;
        const hx = x + sg * (lift ? 10 : 7) * s, hy = lift ? sy2 - 14 * s : sy2 + 13 * s;
        seg(x + sg * 5.4 * s, sy2, ex, ey, hx, hy, 4 * s, skin);
        ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hx, hy, 2.3 * s, 0, 6.283); ctx.fill();
      }
      ctx.fillStyle = skin;                                                     // head
      ctx.beginPath(); ctx.arc(x, headY, headR, 0, 6.283); ctx.fill();
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.arc(x, headY - 0.8 * s, headR * 1.05, Math.PI + 0.2, 2 * Math.PI - 0.2); ctx.fill();
      ctx.strokeStyle = hair; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';     // braid
      ctx.beginPath(); ctx.moveTo(x - headR * 0.6, headY + headR * 0.4);
      ctx.quadraticCurveTo(x - headR * 1.4, headY + headR * 2.6, x - headR * 1.1, headY + headR * 4.6);
      ctx.stroke();
      if (opt.band) { ctx.fillStyle = opt.band; ctx.fillRect(x - headR, headY - headR * 0.42, headR * 2, 2.4 * s); }
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

      // ================= CHAPTER SCENES =================
      const wY = gY;                                  // the scene stands on the lit bank
      if (sc === 'land') {                                       // BEFORE: a living camp
        for (let l = 0; l < 3; l++) {                            // lodges
          const lx = W * (0.14 + l * 0.09), ly = gY - 4;
          ctx.fillStyle = `rgba(${Math.round(lerp(92,132,wm))},${Math.round(lerp(64,92,wm))},${Math.round(lerp(40,56,wm))},1)`;
          ctx.beginPath(); ctx.moveTo(lx - 34, ly); ctx.quadraticCurveTo(lx, ly - 52, lx + 34, ly); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(20,12,6,0.8)';
          ctx.beginPath(); ctx.ellipse(lx, ly - 2, 7, 11, 0, Math.PI, 2 * Math.PI); ctx.fill();
        }
        figure(W * 0.40, gY, 1.0, '#b8351e', { band: '#d4a017' });
        figure(W * 0.47, gY + 6, 1.05, '#1f4e8f', { band: '#c93a1e', raise: true, dir: 1 });
        figure(W * 0.545, gY + 2, 0.7, '#5a7d3a', { band: '#2f8f4f' });
      }
      if (sc === 'contact') {                                    // sails + a wampum belt of light
        for (let s = 0; s < 3; s++) {
          const sx = W * (0.62 + s * 0.13), sy = gY - 10;
          ctx.fillStyle = `rgba(246,242,232,${0.72 + 0.2 * wm})`;
          ctx.beginPath(); ctx.moveTo(sx, sy - 68); ctx.lineTo(sx + 22, sy); ctx.lineTo(sx - 22, sy); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(50,40,32,0.85)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(sx, sy - 74); ctx.lineTo(sx, sy); ctx.stroke();
        }
        figure(W * 0.24, gY, 1.1, '#b8351e', { band: '#d4a017', raise: true, dir: 1 });
        const bx = W * 0.30, by = gY - 42;                       // wampum belt
        for (let b = 0; b < 22; b++) {
          ctx.fillStyle = (b % 7 < 3) ? 'rgba(240,238,230,0.95)' : 'rgba(80,110,150,0.95)';
          ctx.fillRect(bx + b * 9, by + Math.sin(b * 0.5 + tt) * 2, 7, 12);
        }
      }
      if (sc === 'law') {                                        // bars of statute across the land
        ctx.save(); ctx.globalAlpha = 0.35 + u * 0.35;
        ctx.fillStyle = 'rgba(8,6,12,0.92)';
        for (let b = 0; b < 14; b++) ctx.fillRect(W * 0.06 + b * (W * 0.066), 0, 13, H);
        ctx.restore();
        figure(W * 0.5, gY, 1.15, '#7c6a8f', { band: '#c07a1e' });
      }
      if (sc === 'shoes' || sc === 'scoop') {                    // the taking — small shoes, laid in rows
        const rows = 3, per = 9;
        for (let r = 0; r < rows; r++) for (let c = 0; c < per; c++) {
          const app = Math.max(0, Math.min(1, u * 3.4 - (r * per + c) / (rows * per) * 2.2));
          if (app <= 0) continue;
          const depth = 1 - r * 0.13;                             // rows recede
          const sx = W * 0.5 + (c - (per - 1) / 2) * 74 * depth + r * 22;
          const sy = gY + 6 + r * 34;
          const S = 1.5 * depth;
          const body = sc === 'scoop' ? ['#b0724a', '#c4834f', '#9c6440'] : ['#e07a2a', '#d4691e', '#ef8c3a'];
          const col = body[(r + c) % 3];
          ctx.save(); ctx.globalAlpha = app;
          ctx.fillStyle = 'rgba(20,14,6,0.30)';                   // cast shadow on the ground
          ctx.beginPath(); ctx.ellipse(sx + 2 * S, sy + 2.5 * S, 15 * S, 3.4 * S, 0, 0, 6.283); ctx.fill();
          ctx.beginPath();                                        // upper: heel → toe, rounded
          ctx.moveTo(sx - 12 * S, sy);
          ctx.lineTo(sx - 12 * S, sy - 9 * S);
          ctx.quadraticCurveTo(sx - 12 * S, sy - 15 * S, sx - 5 * S, sy - 15 * S);
          ctx.quadraticCurveTo(sx + 1 * S, sy - 15 * S, sx + 3 * S, sy - 9 * S);
          ctx.quadraticCurveTo(sx + 6 * S, sy - 6 * S, sx + 13 * S, sy - 4 * S);
          ctx.quadraticCurveTo(sx + 16 * S, sy - 3 * S, sx + 15 * S, sy);
          ctx.closePath();
          const sg = ctx.createLinearGradient(sx, sy - 15 * S, sx, sy);
          sg.addColorStop(0, col); sg.addColorStop(1, 'rgba(0,0,0,0.34)');
          ctx.fillStyle = sg; ctx.fill();
          ctx.strokeStyle = 'rgba(40,18,4,0.5)'; ctx.lineWidth = 1 * S; ctx.stroke();
          ctx.fillStyle = 'rgba(255,232,200,0.55)';               // collar
          ctx.beginPath(); ctx.ellipse(sx - 4.5 * S, sy - 14 * S, 7 * S, 2.4 * S, -0.12, 0, 6.283); ctx.fill();
          ctx.strokeStyle = 'rgba(255,240,214,0.75)'; ctx.lineWidth = 1.1 * S;   // laces
          ctx.beginPath(); ctx.moveTo(sx - 8 * S, sy - 11 * S); ctx.lineTo(sx - 1 * S, sy - 9 * S); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sx - 8 * S, sy - 8.5 * S); ctx.lineTo(sx - 1 * S, sy - 6.5 * S); ctx.stroke();
          ctx.fillStyle = 'rgba(28,16,8,0.85)';                   // sole
          ctx.beginPath(); ctx.ellipse(sx + 1 * S, sy + 0.4 * S, 14 * S, 2.6 * S, 0, 0, 6.283); ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
      if (sc === 'voices') {                                     // survivors speaking — rising lights
        for (let v = 0; v < 5; v++) {
          const vx = W * (0.22 + v * 0.14);
          figure(vx, gY + (v % 2) * 8, 1.0, ['#c93a1e', '#1f4e8f', '#7c2f6b', '#5a7d3a', '#d68a1f'][v], { band: '#e0a53a', raise: v % 2 === 0, dir: 1 });
        }
        for (let s = 0; s < 26; s++) {                            // words rising as light
          const su = ((tt * 0.24 + s * 0.038) % 1);
          ctx.globalAlpha = (1 - su) * 0.75;
          ctx.fillStyle = '#ffe9b0';
          ctx.beginPath(); ctx.arc(W * (0.2 + (s % 5) * 0.14) + Math.sin(su * 5 + s) * 16, gY - 40 - su * 260, 2.2, 0, 6.283); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      if (sc === 'return') {                                     // people walking home with light
        for (let w = 0; w < 6; w++) {
          const wx = W * (0.12 + w * 0.145) + Math.sin(tt * 0.4 + w) * 5;
          const wy = gY + (w % 3) * 10;
          figure(wx, wy, 1.05 + (w % 3) * 0.08, ['#c93a1e', '#1f4e8f', '#7c2f6b', '#5a7d3a', '#d68a1f', '#2f8f4f'][w],
                 { band: '#d4a017', walk: true, ph: w * 1.1 });
          const lx = wx + 14, ly = wy - 34;                       // the light each one carries
          const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 34);
          lg.addColorStop(0, 'rgba(255,206,120,0.9)'); lg.addColorStop(1, 'rgba(255,206,120,0)');
          ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lx, ly, 34, 0, 6.283); ctx.fill();
          ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(lx, ly, 3.4, 0, 6.283); ctx.fill();
        }
      }

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
