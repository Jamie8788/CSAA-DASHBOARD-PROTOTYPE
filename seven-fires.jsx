/* global React */
/*
 * THE LONG WALK — a scrollytelling history of this land, told with one fire.
 *
 * DELIBERATELY GENERIC. Every nation has its own history, its own teachings and
 * its own prophecies, and they differ. So this tells only what is publicly
 * documented and shared across nations — the land before, the treaties, the
 * Indian Act, residential schools, the Sixties Scoop, the TRC, and the work
 * happening now. No sacred teaching is retold here and no community's beliefs
 * are put in its mouth.
 *
 * The last panel is not a drawing: it is the LIVE COUNT from this atlas.
 *
 * Sources: Truth and Reconciliation Commission of Canada (2015) and its 94
 * Calls to Action; the Indian Act (1876); public federal records.
 */

const { useState: useS7, useEffect: useE7, useRef: useR7, useMemo: useM7 } = React;

const _F7 = [
  {
    n: 1, key: 'before', title: 'Before',
    sub: 'Since time out of memory',
    body: 'For thousands of years before any map was drawn of this place, nations lived here — with their own languages, laws, medicines, trade routes and ways of caring for one another. Not one people, but many. The land was not empty and it was never silent.',
    era: 'Time immemorial', accent: '#d4a017', scene: 'land',
  },
  {
    n: 2, key: 'treaty', title: 'The Agreements',
    sub: 'Nation to nation',
    body: 'Newcomers arrived, and agreements were made — wampum, and later written treaties. They were understood by the nations here as a relationship between equals: to share the land, not to surrender it. That understanding and the written text did not say the same thing.',
    era: '1600s – 1900s', accent: '#c07a1e', scene: 'contact',
  },
  {
    n: 3, key: 'act', title: 'The Law',
    sub: 'A statute over a people',
    body: 'In 1876 Canada passed the Indian Act — one law placed over hundreds of distinct nations. It defined who counted as "Indian," controlled movement, governance and land, and for decades banned ceremonies. Much of it is still in force today.',
    era: '1876 onward', accent: '#7c6a8f', scene: 'law',
  },
  {
    n: 4, key: 'schools', title: 'The Taking',
    sub: 'When the children were taken',
    body: 'Over more than a century, more than 150,000 First Nations, Inuit and Métis children were taken from their families to residential schools. Thousands never came home. The last school closed in 1996. In 2015 the Truth and Reconciliation Commission called it cultural genocide.',
    era: '1831 – 1996', accent: '#c2571e', scene: 'shoes', heavy: true,
  },
  {
    n: 5, key: 'scoop', title: 'And Again',
    sub: 'The taking did not stop at the school door',
    body: 'From the 1950s, thousands more children were removed by child welfare — the period known as the Sixties Scoop — and placed far from their nations. Today Indigenous children remain vastly over-represented in care. This is not only history.',
    era: '1950s – today', accent: '#8f5a3a', scene: 'scoop', heavy: true,
  },
  {
    n: 6, key: 'truth', title: 'The Telling',
    sub: 'Survivors spoke, and it was written down',
    body: 'Survivors testified. Between 2008 and 2015 the Truth and Reconciliation Commission gathered thousands of statements and issued 94 Calls to Action. September 30 is now a national day of truth and reconciliation. The record exists because survivors made it exist.',
    era: '2008 – 2015', accent: '#e0a53a', scene: 'voices',
  },
  {
    n: 7, key: 'now', title: 'The Return',
    sub: 'Languages, ceremony, and care coming home',
    body: 'Nations are running their own health services, child welfare, schools and language programs. Elders teach. Youth go out on the land. This is not recovery from the past tense — it is people rebuilding, right now, on their own terms.',
    era: 'Now', accent: '#d4a017', scene: 'return',
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

      // ---- SKY: warm dawn → deep night through the taking → dawn again ----
      const dark = Math.min(1, Math.max(0, (seg - 2.0) / 2.2)) * (1 - last * 0.92);
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.78);
      sky.addColorStop(0,   `rgb(${Math.round(lerp(38,8,dark))},${Math.round(lerp(44,10,dark))},${Math.round(lerp(78,26,dark))})`);
      sky.addColorStop(0.55,`rgb(${Math.round(lerp(150,20,dark))},${Math.round(lerp(96,22,dark))},${Math.round(lerp(96,46,dark))})`);
      sky.addColorStop(1,   `rgb(${Math.round(lerp(238,44,dark))},${Math.round(lerp(160,30,dark))},${Math.round(lerp(96,52,dark))})`);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      if (dark > 0.06) {                                        // stars
        for (const s of stars) {
          ctx.globalAlpha = dark * (0.2 + 0.7 * (0.5 + 0.5 * Math.sin(tt * 1.4 + s.tw)));
          ctx.fillStyle = '#eef3ff';
          ctx.beginPath(); ctx.arc(s.x * W, s.y * H * 0.68, s.r, 0, 6.283); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      // aurora — strongest at the beginning and the end
      const aur = Math.max(0, Math.max(1 - seg / 2.2, last)) * 0.9;
      if (aur > 0.04) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const cols = ['120,200,150', '212,160,23', '150,140,220'];
        for (let a = 0; a < 3; a++) {
          ctx.globalAlpha = aur * (0.10 + 0.05 * Math.sin(tt * 0.5 + a));
          ctx.strokeStyle = `rgb(${cols[a]})`; ctx.lineWidth = 46;
          ctx.beginPath();
          for (let x = -30; x <= W + 30; x += 26) {
            ctx.lineTo(x, H * 0.16 + a * 40 + Math.sin(x * 0.005 + tt * 0.35 + a * 1.7) * 34 + Math.sin(x * 0.011 + tt * 0.5) * 12);
          }
          ctx.stroke();
        }
        ctx.restore(); ctx.globalAlpha = 1;
      }
      // sun / moon low on the horizon
      const orbX = W * (0.22 + Math.min(1, seg / 7) * 0.56), orbY = H * 0.40;
      const og = ctx.createRadialGradient(orbX, orbY, 4, orbX, orbY, 150);
      og.addColorStop(0, `rgba(255,${Math.round(lerp(226,244,dark))},${Math.round(lerp(170,230,dark))},${0.45 + 0.2 * (1 - dark)})`);
      og.addColorStop(1, 'rgba(255,226,170,0)');
      ctx.fillStyle = og; ctx.beginPath(); ctx.arc(orbX, orbY, 150, 0, 6.283); ctx.fill();
      ctx.fillStyle = `rgba(255,${Math.round(lerp(238,250,dark))},${Math.round(lerp(198,238,dark))},0.95)`;
      ctx.beginPath(); ctx.arc(orbX, orbY, lerp(34, 24, dark), 0, 6.283); ctx.fill();

      // ---- LAYERED LAND: far ridge, mist, mid ridge, treeline, near bank ----
      const hz = H * 0.56;
      ridge(hz, 26, `rgba(${Math.round(lerp(96,26,dark))},${Math.round(lerp(92,30,dark))},${Math.round(lerp(112,52,dark))},1)`, 1.2, 34);
      mist(hz + 16, 26, 0.16 * (1 - dark * 0.5), 0.12, 0.5);
      ridge(hz + 44, 20, `rgba(${Math.round(lerp(66,18,dark))},${Math.round(lerp(74,24,dark))},${Math.round(lerp(74,42,dark))},1)`, 3.4, 30);
      pines(hz + 58, 46, `rgba(${Math.round(lerp(30,8,dark))},${Math.round(lerp(42,14,dark))},${Math.round(lerp(34,22,dark))},1)`, 7, 24);
      ridge(hz + 96, 16, `rgba(${Math.round(lerp(38,10,dark))},${Math.round(lerp(52,16,dark))},${Math.round(lerp(40,26,dark))},1)`, 5.1, 26);
      // the water in front
      const wY = H * 0.80;
      const wat = ctx.createLinearGradient(0, wY - 40, 0, H);
      wat.addColorStop(0, `rgba(${Math.round(lerp(96,14,dark))},${Math.round(lerp(120,22,dark))},${Math.round(lerp(124,44,dark))},1)`);
      wat.addColorStop(1, `rgba(${Math.round(lerp(52,8,dark))},${Math.round(lerp(74,14,dark))},${Math.round(lerp(84,30,dark))},1)`);
      ctx.fillStyle = wat; ctx.fillRect(0, wY - 40, W, H - wY + 40);
      ctx.strokeStyle = `rgba(255,255,255,${0.05 + 0.05 * (1 - dark)})`; ctx.lineWidth = 1;
      for (let w = 0; w < 6; w++) {
        const yy = wY - 24 + w * 26;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 20) ctx.lineTo(x, yy + Math.sin(x * 0.013 + tt * 0.6 + w) * 3);
        ctx.stroke();
      }
      // reflection of the orb on the water
      ctx.save(); ctx.globalAlpha = 0.18;
      const rg = ctx.createLinearGradient(orbX, wY - 40, orbX, H);
      rg.addColorStop(0, 'rgba(255,220,150,0.9)'); rg.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = rg; ctx.fillRect(orbX - 46, wY - 40, 92, H); ctx.restore();

      // ================= CHAPTER SCENES =================
      const gY = wY - 34;                                        // where people stand
      if (sc === 'land') {                                       // BEFORE: a living camp
        for (let l = 0; l < 3; l++) {                            // lodges
          const lx = W * (0.16 + l * 0.1), ly = gY - 4;
          ctx.fillStyle = `rgba(${Math.round(lerp(120,42,dark))},${Math.round(lerp(84,32,dark))},${Math.round(lerp(52,24,dark))},1)`;
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
          const sx = W * (0.62 + s * 0.13), sy = hz + 84;
          ctx.fillStyle = `rgba(238,234,224,${0.9 - dark * 0.35})`;
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
        ctx.fillStyle = 'rgba(10,8,14,0.9)';
        for (let b = 0; b < 14; b++) ctx.fillRect(W * 0.06 + b * (W * 0.066), hz - 30, 13, H);
        ctx.restore();
        figure(W * 0.5, gY, 1.15, '#7c6a8f', { band: '#c07a1e' });
      }
      if (sc === 'shoes' || sc === 'scoop') {                    // the taking — empty shoes
        const rows = 3, per = 11;
        for (let r = 0; r < rows; r++) for (let c = 0; c < per; c++) {
          const app = Math.max(0, Math.min(1, u * 3.4 - (r * per + c) / (rows * per) * 2.2));
          if (app <= 0) continue;
          const sx = W * 0.5 + (c - (per - 1) / 2) * 62 + r * 16;
          const sy = gY + 12 + r * 44;
          ctx.globalAlpha = app * 0.96;
          const col = sc === 'scoop' ? ['#8f5a3a', '#a4693f', '#7c4a30'] : ['#d4691e', '#c2571e', '#e07a2a'];
          ctx.fillStyle = col[(r + c) % 3];
          ctx.beginPath();
          ctx.moveTo(sx - 15, sy); ctx.lineTo(sx - 15, sy - 12);
          ctx.quadraticCurveTo(sx - 15, sy - 20, sx - 6, sy - 20);
          ctx.quadraticCurveTo(sx + 3, sy - 20, sx + 7, sy - 12);
          ctx.quadraticCurveTo(sx + 17, sy - 9, sx + 17, sy);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(30,14,4,0.5)'; ctx.lineWidth = 1.2; ctx.stroke();
          ctx.fillStyle = 'rgba(0,0,0,0.28)';                    // shadow
          ctx.beginPath(); ctx.ellipse(sx, sy + 3, 17, 3.5, 0, 0, 6.283); ctx.fill();
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
      ctx.strokeStyle = `rgba(${Math.round(lerp(92,52,dark))},${Math.round(lerp(62,34,dark))},32,1)`;   // logs
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
      mist(wY - 60, 30, 0.10, 0.08, 2.2);                          // foreground haze for depth
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
              Every nation has its own history, its own teachings and its own words for it —
              this page deliberately tells only the shared, publicly documented record and
              speaks for no one. Sources: Truth and Reconciliation Commission of Canada (2015)
              and its 94 Calls to Action; the Indian Act (1876); public federal records.
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
