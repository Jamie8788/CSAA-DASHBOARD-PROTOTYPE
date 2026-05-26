/* global React */
// ============================================================================
// MIIKANA · Learning Journey  (v2 — proper input capture, polished visuals)
// Top-down driving game over a stylized map of Anishinaabe / First Nations
// territory. Click the map to take control; arrow keys / WASD steer.
// Reaching an undocumented community triggers a quiz built ONLY from that
// community's real record (population, pillars, direction).
// ============================================================================
const { useState, useMemo, useEffect, useRef } = React;

// -- World projection -------------------------------------------------------
const WORLD_W = 3200;
const WORLD_H = 2000;
function projectLat(lat) { return Math.max(40, Math.min(WORLD_H - 40, ((58 - lat) / (58 - 41)) * WORLD_H)); }
function projectLon(lon) { return Math.max(40, Math.min(WORLD_W - 40, ((lon + 118) / 46) * WORLD_W)); }

// Lakes (stylized — world coordinates)
const LAKES = [
  { name:'Gichigami · L. Superior', cx: projectLon(-87.5),  cy: projectLat(47.7), rx: 280, ry: 115, rot: -0.18 },
  { name:'L. Huron',                cx: projectLon(-82.4),  cy: projectLat(45.2), rx: 175, ry: 140, rot: 0.05  },
  { name:'L. Michigan',             cx: projectLon(-87.0),  cy: projectLat(43.5), rx: 80,  ry: 180, rot: 0.04  },
  { name:'L. Erie',                 cx: projectLon(-81.2),  cy: projectLat(42.2), rx: 175, ry: 50,  rot: 0.04  },
  { name:'L. Ontario',              cx: projectLon(-77.8),  cy: projectLat(43.7), rx: 135, ry: 55,  rot: 0.08  },
  { name:'L. Winnipeg',             cx: projectLon(-97.5),  cy: projectLat(52.5), rx: 60,  ry: 200, rot: -0.05 },
  { name:'Hudson Bay',              cx: projectLon(-83.5),  cy: projectLat(56.7), rx: 300, ry: 220, rot: 0.0   },
  { name:'James Bay',               cx: projectLon(-80.5),  cy: projectLat(53.0), rx: 70,  ry: 135, rot: 0.0   },
];

// Trails — historical routes. Each is a polyline in world coords.
const TRAILS = [
  // Trans-Canada-ish corridor through Algoma
  [[projectLon(-90),  projectLat(48.4)], [projectLon(-86),   projectLat(48.5)], [projectLon(-84.3), projectLat(46.5)], [projectLon(-82),   projectLat(46.4)], [projectLon(-79.5), projectLat(46.5)], [projectLon(-77),   projectLat(45.9)]],
  // North-south Sudbury → Toronto
  [[projectLon(-81),  projectLat(46.5)], [projectLon(-80),   projectLat(45.2)], [projectLon(-79.5), projectLat(43.7)]],
  // James Bay road
  [[projectLon(-80.6),projectLat(50.8)], [projectLon(-80.7), projectLat(51.6)], [projectLon(-80.5), projectLat(52.2)]],
  // Ottawa river route
  [[projectLon(-79.5),projectLat(46.7)], [projectLon(-77.7), projectLat(45.9)], [projectLon(-75.7), projectLat(45.4)], [projectLon(-73.6), projectLat(45.5)]],
  // North shore Superior
  [[projectLon(-89),  projectLat(48.6)], [projectLon(-87.5), projectLat(48.4)], [projectLon(-85.7), projectLat(47.8)], [projectLon(-84.3), projectLat(46.5)]],
];

// Rivers — drawn beneath trails
const RIVERS = [
  [[projectLon(-92), projectLat(51.4)], [projectLon(-87), projectLat(51.8)], [projectLon(-82.5), projectLat(52.2)]],
  [[projectLon(-80.6), projectLat(50.4)], [projectLon(-81.2), projectLat(49.8)], [projectLon(-81.6), projectLat(48.9)]],
  [[projectLon(-79.5), projectLat(46.7)], [projectLon(-77.7), projectLat(45.9)], [projectLon(-75.7), projectLat(45.4)], [projectLon(-74.0), projectLat(45.5)]],
  [[projectLon(-79.4), projectLat(43.8)], [projectLon(-76.5), projectLat(44.2)], [projectLon(-73.5), projectLat(45.5)], [projectLon(-71.2), projectLat(46.8)]],
];

const DIR_HEX = { East:'#d4a017', South:'#b8351e', West:'#3a5d8c', North:'#1a1612', Central:'#6b8d6b' };

// -- Question builder -------------------------------------------------------
function shuffle(a){ const b=[...a]; for(let i=b.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[b[i],b[j]]=[b[j],b[i]];} return b; }

function buildQuestion(c) {
  const pillars = [
    { key:'hasPhysical', text:'physical health programming' },
    { key:'hasMental',   text:'mental health programming' },
    { key:'hasSpiritual',text:'spiritual / cultural support' },
    { key:'hasEmotional',text:'emotional wellness support' },
    { key:'hasYouth',    text:'youth programming' },
    { key:'hasSurvivors',text:'residential-school survivor support' },
  ];

  // 1. Population (preferred when present)
  if (c.population && c.population > 0) {
    const real = c.population;
    const wrong1 = Math.max(10, Math.round(real * 0.25));
    const wrong2 = Math.round(real * 2.8);
    return {
      q: `How many members does ${c.name.trim()} have on record?`,
      sub: `From the master sheet — ${c.regionGroup} region.`,
      options: shuffle([
        { label: real.toLocaleString(), correct: true },
        { label: wrong1.toLocaleString(), correct: false },
        { label: wrong2.toLocaleString(), correct: false },
      ]),
      hint: c.popInfo ? c.popInfo.slice(0, 240) : 'Sourced from the population column of the master sheet.',
    };
  }

  // 2. Pillar coverage
  const has = pillars.filter(p => c[p.key]);
  const missing = pillars.filter(p => !c[p.key]);
  if (has.length >= 1 && missing.length >= 2) {
    const correct = has[Math.floor(Math.random()*has.length)];
    const wrongs = shuffle(missing).slice(0, 2);
    return {
      q: `Which of these does ${c.name.trim()} document in the atlas?`,
      sub: `Pulled live from the service-pillar columns.`,
      options: shuffle([
        { label: correct.text, correct: true },
        ...wrongs.map(w => ({ label: w.text, correct: false })),
      ]),
      hint: `Documented pillars: ${has.map(p=>p.text).join(', ') || 'none recorded yet'}.`,
    };
  }

  // 3. Direction fallback
  const otherDirs = ['East','South','West','North'].filter(d => d !== c.direction);
  return {
    q: `In which direction is ${c.name.trim()}?`,
    sub: `Communities are grouped by East / South / West / North.`,
    options: shuffle([
      { label: c.direction, correct: true },
      { label: otherDirs[0], correct: false },
      { label: otherDirs[1], correct: false },
    ]),
    hint: 'East = Spring · South = Summer · West = Autumn · North = Winter.',
  };
}

// ============================================================================
// Main component
// ============================================================================
function JourneyGame({ all, onSelect }) {
  const stops = useMemo(() => {
    return all.filter(c => c.orgType === 'Community' && c.lat && c.lon).map(c => ({
      c, wx: projectLon(c.lon), wy: projectLat(c.lat),
    }));
  }, [all]);

  // Persisted progress
  const [visited, setVisited] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('mino-journey-visited') || '[]')); }
    catch { return new Set(); }
  });
  const [wampum, setWampum] = useState(() => parseInt(localStorage.getItem('mino-journey-wampum')||'0', 10));
  useEffect(() => {
    try {
      localStorage.setItem('mino-journey-visited', JSON.stringify([...visited]));
      localStorage.setItem('mino-journey-wampum', String(wampum));
    } catch {}
  }, [visited, wampum]);

  const [mode, setMode] = useState('car');
  const [active, setActive] = useState(true);     // auto-active by default — no click required
  const [question, setQuestion] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [approaching, setApproaching] = useState(null);
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(0);

  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const inputRef = useRef({ up:false, down:false, left:false, right:false });
  const pausedRef = useRef(false);
  const approachingRef = useRef(null);
  const visitedRef = useRef(visited);
  const modeRef = useRef(mode);
  const activeRef = useRef(active);
  useEffect(() => { approachingRef.current = approaching; }, [approaching]);
  useEffect(() => { visitedRef.current = visited; }, [visited]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { activeRef.current = active; }, [active]);

  function makeInitialState() {
    return { x: projectLon(-83.9), y: projectLat(46.5), vx:0, vy:0, heading: -Math.PI/4, camX:0, camY:0 };
  }

  // ============= Input — key capture with passive:false to truly block scroll ==
  useEffect(() => {
    const NAV = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','Space'];
    function onKey(e, down) {
      // While the stage is active, always block these keys from scrolling/space-paging.
      if (!activeRef.current) return;
      if (!NAV.includes(e.code)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      const c = e.code;
      const i = inputRef.current;
      if (c === 'ArrowUp' || c === 'KeyW') i.up = down;
      else if (c === 'ArrowDown' || c === 'KeyS') i.down = down;
      else if (c === 'ArrowLeft' || c === 'KeyA') i.left = down;
      else if (c === 'ArrowRight' || c === 'KeyD') i.right = down;
      else if (c === 'Space' && down) {
        const a = approachingRef.current;
        if (a && !visitedRef.current.has(a.c.id) && !pausedRef.current) {
          const q = buildQuestion(a.c);
          pausedRef.current = true;
          setQuestion({ ...q, target: a.c });
        }
      }
    }
    const kd = e => onKey(e, true);
    const ku = e => onKey(e, false);
    window.addEventListener('keydown', kd, { passive: false, capture: true });
    window.addEventListener('keyup',   ku, { passive: false, capture: true });
    function blur(){ const i = inputRef.current; i.up=i.down=i.left=i.right=false; }
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', kd, { capture: true });
      window.removeEventListener('keyup',   ku, { capture: true });
      window.removeEventListener('blur', blur);
    };
  }, []);

  // Auto-deactivate when the user clicks far outside the stage AND the question
  // overlay isn't currently open. (Keeps keys captured while playing without
  // requiring an initial click.)
  useEffect(() => {
    function onMouseDown(e) {
      if (question || feedback) return;
      if (stageRef.current && stageRef.current.contains(e.target)) {
        if (!active) setActive(true);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [active, question, feedback]);

  // ============= Game loop ==================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    if (!stateRef.current) stateRef.current = makeInitialState();

    let lastT = performance.now();
    let raf = null;
    let alive = true;
    let frame = 0;

    function step(now) {
      if (!alive) return;
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      frame++;
      if (!pausedRef.current && activeRef.current) update(dt);
      draw(frame);
      raf = requestAnimationFrame(step);
    }

    function update(dt) {
      const s = stateRef.current;
      const i = inputRef.current;
      const isCanoe = modeRef.current === 'canoe';
      const inWater = pointInLakes(s.x, s.y);
      const onTrail = pointOnTrail(s.x, s.y);

      const maxAccel = isCanoe ? (inWater ? 130 : 50) : (onTrail ? 240 : 170);
      const maxSpeed = isCanoe ? (inWater ? 200 : 90) : (onTrail ? 340 : 240);
      const turnRate = isCanoe ? 1.7 : 2.7;
      const friction = isCanoe ? 0.58 : 0.88;

      let thrust = 0;
      if (i.up)   thrust += maxAccel;
      if (i.down) thrust -= maxAccel * 0.7;

      const sp0 = Math.hypot(s.vx, s.vy);
      const turnEff = Math.min(1, sp0 / 60);
      if (i.left)  s.heading -= turnRate * dt * (i.up || i.down ? turnEff : 0.32);
      if (i.right) s.heading += turnRate * dt * (i.up || i.down ? turnEff : 0.32);

      s.vx += Math.cos(s.heading) * thrust * dt;
      s.vy += Math.sin(s.heading) * thrust * dt;

      const sp = Math.hypot(s.vx, s.vy);
      if (sp > maxSpeed) { s.vx *= maxSpeed/sp; s.vy *= maxSpeed/sp; }
      s.vx *= Math.pow(friction, dt * 6);
      s.vy *= Math.pow(friction, dt * 6);

      const oldX = s.x, oldY = s.y;
      s.x = Math.max(20, Math.min(WORLD_W - 20, s.x + s.vx * dt));
      s.y = Math.max(20, Math.min(WORLD_H - 20, s.y + s.vy * dt));

      const moved = Math.hypot(s.x - oldX, s.y - oldY);
      if (moved > 0.5) setDistance(d => d + moved);
      setSpeed(Math.round(Math.hypot(s.vx, s.vy)));

      const w = canvas.clientWidth, h = canvas.clientHeight;
      s.camX = s.x - w/2;
      s.camY = s.y - h/2;

      // Approach detection
      let nearest = null, nd = Infinity;
      for (const st of stops) {
        const d = Math.hypot(st.wx - s.x, st.wy - s.y);
        if (d < 65 && d < nd) { nd = d; nearest = st; }
      }
      if (nearest && !visitedRef.current.has(nearest.c.id)) {
        if (approachingRef.current?.c?.id !== nearest.c.id) setApproaching(nearest);
      } else if (approachingRef.current) {
        setApproaching(null);
      }
    }

    function pointInLakes(x, y) {
      for (const L of LAKES) {
        const dx = (x - L.cx) / L.rx, dy = (y - L.cy) / L.ry;
        if (dx*dx + dy*dy < 1) return true;
      }
      return false;
    }
    function pointOnTrail(x, y) {
      const T = 18;
      for (const trail of TRAILS) {
        for (let i = 1; i < trail.length; i++) {
          const a = trail[i-1], b = trail[i];
          const dx = b[0]-a[0], dy = b[1]-a[1];
          const t = Math.max(0, Math.min(1, ((x-a[0])*dx + (y-a[1])*dy) / (dx*dx+dy*dy)));
          const px = a[0] + t*dx, py = a[1] + t*dy;
          if (Math.hypot(x-px, y-py) < T) return true;
        }
      }
      return false;
    }

    // ============= Draw ====================================================
    function draw(f) {
      const s = stateRef.current;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      // Parchment background
      const gbg = ctx.createLinearGradient(0, 0, 0, h);
      gbg.addColorStop(0, '#ecdfc5');
      gbg.addColorStop(1, '#d8c89e');
      ctx.fillStyle = gbg;
      ctx.fillRect(0, 0, w, h);

      // Map grid lines (faint)
      ctx.strokeStyle = 'rgba(90,79,64,0.05)';
      ctx.lineWidth = 1;
      const grid = 80;
      const gx0 = Math.floor(s.camX / grid) * grid;
      const gy0 = Math.floor(s.camY / grid) * grid;
      ctx.beginPath();
      for (let x = gx0; x < s.camX + w; x += grid) { ctx.moveTo(x - s.camX, 0); ctx.lineTo(x - s.camX, h); }
      for (let y = gy0; y < s.camY + h; y += grid) { ctx.moveTo(0, y - s.camY); ctx.lineTo(w, y - s.camY); }
      ctx.stroke();

      // Forest dots (deterministic seeded scatter)
      ctx.fillStyle = 'rgba(80,108,68,0.20)';
      const SEED = 420;
      for (let i = 0; i < SEED; i++) {
        const hx = ((i * 9301 + 49297) % 233280) / 233280;
        const hy = ((i * 4783 + 13127) % 233280) / 233280;
        const wx = hx * WORLD_W, wy = hy * WORLD_H;
        const x = wx - s.camX, y = wy - s.camY;
        if (x < -10 || x > w + 10 || y < -10 || y > h + 10) continue;
        let inLake = false;
        for (const L of LAKES) {
          const dx = (wx - L.cx)/L.rx, dy = (wy - L.cy)/L.ry;
          if (dx*dx + dy*dy < 1) { inLake = true; break; }
        }
        if (inLake) continue;
        const r = 2 + ((i*7) % 5);
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
        // tiny triangle on top
        if ((i % 3) === 0) {
          ctx.fillStyle = 'rgba(50,80,55,0.4)';
          ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x, y - 4); ctx.lineTo(x + 2, y); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(80,108,68,0.20)';
        }
      }

      // Lakes
      for (const L of LAKES) {
        const x = L.cx - s.camX, y = L.cy - s.camY;
        ctx.save();
        ctx.translate(x, y); ctx.rotate(L.rot);
        const grad = ctx.createRadialGradient(0, 0, L.rx*0.15, 0, 0, L.rx);
        grad.addColorStop(0, '#86acce');
        grad.addColorStop(0.65, '#4a73a0');
        grad.addColorStop(1, '#2e4a6f');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, L.rx, L.ry, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#15314e';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // animated shimmer
        const phase = (f * 0.02 + L.cx) % (Math.PI * 2);
        ctx.strokeStyle = `rgba(245,237,224,${0.18 + Math.sin(phase) * 0.08})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(0, 0, L.rx * 0.78, L.ry * 0.78, 0, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, 0, L.rx * 0.55, L.ry * 0.55, 0, 0, Math.PI*2);
        ctx.strokeStyle = `rgba(245,237,224,${0.1 + Math.sin(phase + 1) * 0.05})`;
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.fillStyle = 'rgba(245,237,224,0.9)';
        ctx.font = 'italic 13px Newsreader, serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(21,17,13,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText(L.name, x, y);
        ctx.restore();
      }

      // Rivers (under trails)
      ctx.strokeStyle = '#6c92b2';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const r of RIVERS) {
        ctx.beginPath();
        ctx.moveTo(r[0][0] - s.camX, r[0][1] - s.camY);
        for (let i = 1; i < r.length; i++) ctx.lineTo(r[i][0] - s.camX, r[i][1] - s.camY);
        ctx.stroke();
      }
      // River highlights
      ctx.strokeStyle = 'rgba(245,237,224,0.4)';
      ctx.lineWidth = 1;
      for (const r of RIVERS) {
        ctx.beginPath();
        ctx.moveTo(r[0][0] - s.camX, r[0][1] - s.camY);
        for (let i = 1; i < r.length; i++) ctx.lineTo(r[i][0] - s.camX, r[i][1] - s.camY);
        ctx.stroke();
      }

      // Trails (roads)
      // Casing
      ctx.strokeStyle = 'rgba(40,30,18,0.6)';
      ctx.lineWidth = 9;
      for (const t of TRAILS) {
        ctx.beginPath();
        ctx.moveTo(t[0][0] - s.camX, t[0][1] - s.camY);
        for (let i = 1; i < t.length; i++) ctx.lineTo(t[i][0] - s.camX, t[i][1] - s.camY);
        ctx.stroke();
      }
      // Road surface
      ctx.strokeStyle = '#caa765';
      ctx.lineWidth = 6;
      for (const t of TRAILS) {
        ctx.beginPath();
        ctx.moveTo(t[0][0] - s.camX, t[0][1] - s.camY);
        for (let i = 1; i < t.length; i++) ctx.lineTo(t[i][0] - s.camX, t[i][1] - s.camY);
        ctx.stroke();
      }
      // Centerline dashes
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 12]);
      for (const t of TRAILS) {
        ctx.beginPath();
        ctx.moveTo(t[0][0] - s.camX, t[0][1] - s.camY);
        for (let i = 1; i < t.length; i++) ctx.lineTo(t[i][0] - s.camX, t[i][1] - s.camY);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Community markers (lodges with smoke for visited)
      for (const st of stops) {
        const x = st.wx - s.camX, y = st.wy - s.camY;
        if (x < -40 || x > w + 40 || y < -40 || y > h + 40) continue;
        const isVisited = visitedRef.current.has(st.c.id);
        const isNear = approachingRef.current?.c?.id === st.c.id;
        const col = DIR_HEX[st.c.direction] || '#6b8d6b';

        // Ground shadow
        ctx.fillStyle = 'rgba(21,17,13,0.18)';
        ctx.beginPath(); ctx.ellipse(x, y + 9, 14, 4, 0, 0, Math.PI*2); ctx.fill();

        // Lodge body
        ctx.fillStyle = isVisited ? '#d4a017' : col;
        ctx.strokeStyle = '#15110d';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 10, y + 8);
        ctx.lineTo(x, y - 13);
        ctx.lineTo(x + 10, y + 8);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Cross poles
        ctx.beginPath();
        ctx.moveTo(x - 3, y - 9); ctx.lineTo(x + 3, y - 9);
        ctx.strokeStyle = '#15110d';
        ctx.stroke();

        // Smoke for visited
        if (isVisited) {
          const smokeP = (f * 0.5 + st.wx) % 60;
          ctx.fillStyle = `rgba(120,108,90,${0.5 - smokeP/120})`;
          ctx.beginPath();
          ctx.arc(x + Math.sin(smokeP * 0.2) * 3, y - 14 - smokeP * 0.3, 3 + smokeP * 0.08, 0, Math.PI*2);
          ctx.fill();
          ctx.fillStyle = '#15110d';
          ctx.font = 'bold 11px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('✓', x, y + 3);
        }
        // Near pulse + name
        if (isNear) {
          const pulse = (Math.sin(f * 0.08) + 1) * 6 + 16;
          ctx.strokeStyle = '#b8351e';
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(x, y, pulse, 0, Math.PI*2); ctx.stroke();
          ctx.strokeStyle = 'rgba(184,53,30,0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x, y, pulse + 8, 0, Math.PI*2); ctx.stroke();
          const n = st.c.name.trim();
          ctx.font = '600 12px Inter, sans-serif';
          ctx.textAlign = 'center';
          const tw = ctx.measureText(n).width + 14;
          ctx.fillStyle = '#15110d';
          ctx.fillRect(x - tw/2, y - 36, tw, 19);
          ctx.fillStyle = '#fbf6ec';
          ctx.fillText(n, x, y - 22);
        }
      }

      // Player
      const px = s.x - s.camX, py = s.y - s.camY;
      const isCanoe = modeRef.current === 'canoe';
      // shadow
      ctx.fillStyle = 'rgba(21,17,13,0.22)';
      ctx.beginPath(); ctx.ellipse(px + 1, py + 7, 13, 4, 0, 0, Math.PI*2); ctx.fill();

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(s.heading);
      if (isCanoe) {
        // Hull
        ctx.fillStyle = '#7d4d22';
        ctx.strokeStyle = '#2e2820';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(0, 0, 17, 5, 0, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();
        // Gunwale stripe
        ctx.strokeStyle = '#d4a017';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
        // Paddle
        ctx.fillStyle = '#2e2820';
        ctx.fillRect(-1, -10, 2, 6);
        ctx.beginPath(); ctx.ellipse(0, -12, 3, 5, 0, 0, Math.PI*2); ctx.fill();
      } else {
        // Car body
        ctx.fillStyle = '#b8351e';
        ctx.fillRect(-11, -6, 22, 12);
        // Cabin
        ctx.fillStyle = '#1a1612';
        ctx.fillRect(-5, -7, 10, 14);
        // Hood window
        ctx.fillStyle = '#7da8c7';
        ctx.fillRect(2, -5, 4, 10);
        // Headlights (when moving forward)
        if (inputRef.current.up) {
          ctx.fillStyle = '#fff3c4';
          ctx.fillRect(10, -5, 2, 3);
          ctx.fillRect(10, 2, 2, 3);
          // Light cone
          const g = ctx.createRadialGradient(13, 0, 0, 60, 0, 60);
          g.addColorStop(0, 'rgba(255,243,196,0.4)');
          g.addColorStop(1, 'rgba(255,243,196,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(11, -4); ctx.lineTo(70, -22); ctx.lineTo(70, 22); ctx.lineTo(11, 4); ctx.closePath();
          ctx.fill();
        }
        // Brake lights (when braking)
        if (inputRef.current.down) {
          ctx.fillStyle = '#ff3b1f';
          ctx.fillRect(-12, -5, 1.5, 3);
          ctx.fillRect(-12, 2, 1.5, 3);
        }
        ctx.strokeStyle = '#15110d';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-11, -6, 22, 12);
      }
      ctx.restore();

      // Mini-map (top-right)
      const miniW = 200, miniH = 124, miniPad = 14;
      const mx = w - miniW - miniPad, my = miniPad;
      ctx.fillStyle = 'rgba(21,17,13,0.88)';
      ctx.fillRect(mx, my, miniW, miniH);
      ctx.strokeStyle = '#d4a017';
      ctx.lineWidth = 1;
      ctx.strokeRect(mx, my, miniW, miniH);
      // lakes mini
      for (const L of LAKES) {
        ctx.fillStyle = '#4a73a0';
        ctx.beginPath();
        ctx.ellipse(mx + L.cx/WORLD_W * miniW, my + L.cy/WORLD_H * miniH,
                    Math.max(2, L.rx/WORLD_W*miniW), Math.max(2, L.ry/WORLD_H*miniH),
                    L.rot, 0, Math.PI*2);
        ctx.fill();
      }
      // stops mini
      for (const st of stops) {
        const isVisited = visitedRef.current.has(st.c.id);
        ctx.fillStyle = isVisited ? '#d4a017' : '#e8dcc1';
        ctx.beginPath();
        ctx.arc(mx + st.wx/WORLD_W * miniW, my + st.wy/WORLD_H * miniH, 1.6, 0, Math.PI*2);
        ctx.fill();
      }
      // player mini
      ctx.fillStyle = '#b8351e';
      ctx.beginPath();
      ctx.arc(mx + s.x/WORLD_W * miniW, my + s.y/WORLD_H * miniH, 3.5, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#d4a017';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('OVERVIEW', mx + 8, my + miniH - 8);

      // Compass (top-left)
      ctx.save();
      const compX = 30, compY = 30;
      ctx.fillStyle = 'rgba(21,17,13,0.85)';
      ctx.beginPath(); ctx.arc(compX, compY, 22, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#d4a017';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fbf6ec';
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('N', compX, compY - 12);
      ctx.fillText('S', compX, compY + 17);
      ctx.fillText('W', compX - 14, compY + 3);
      ctx.fillText('E', compX + 14, compY + 3);
      // arrow
      ctx.save();
      ctx.translate(compX, compY);
      ctx.rotate(s.heading + Math.PI/2);
      ctx.fillStyle = '#b8351e';
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(4, 6); ctx.lineTo(0, 3); ctx.lineTo(-4, 6); ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.restore();
    }

    raf = requestAnimationFrame(step);
    return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [stops]);

  function setKey(k, v) { inputRef.current[k] = v; }

  function answerQuestion(opt) {
    if (!question) return;
    if (opt.correct) {
      setVisited(prev => new Set(prev).add(question.target.id));
      setWampum(w => w + 1);
      setFeedback({ ok:true, msg: `+1 wampum · ${question.target.name.trim()} added to your journey.`, target: question.target });
    } else {
      setFeedback({ ok:false, msg:`Not quite — keep going, you can return any time.`, target: question.target, hint: question.hint });
    }
    setQuestion(null);
    setTimeout(() => { setFeedback(null); pausedRef.current = false; }, 2400);
  }

  function approachVisit() {
    const a = approaching;
    if (!a || visited.has(a.c.id)) return;
    const q = buildQuestion(a.c);
    pausedRef.current = true;
    setQuestion({ ...q, target: a.c });
  }

  function resetJourney() {
    if (!confirm('Reset your visited communities and wampum count?')) return;
    setVisited(new Set());
    setWampum(0);
    try { localStorage.removeItem('mino-journey-visited'); localStorage.removeItem('mino-journey-wampum'); } catch {}
  }

  const totalStops = stops.length;
  const visitedCount = visited.size;
  const pct = totalStops ? Math.round(visitedCount / totalStops * 100) : 0;

  return (
    <div className="game-pane journey-pane">
      <div className="game-head journey-head">
        <div style={{maxWidth:560}}>
          <div className="game-kicker">Miikana · The Path</div>
          <h3 className="game-title">Drive the territory. Learn each community as you go.</h3>
          <p className="game-sub">
            <strong>Click the map to take control.</strong> Then use <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd>
            {' '}or <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to steer.
            Press <kbd>Space</kbd> at a glowing community to answer one question pulled from that community's
            own record. Roads are fast, off-road is slow; switch to canoe for the lakes.
          </p>
        </div>
        <div className="journey-hud">
          <div className="hud-stat">
            <span className="hud-num">{visitedCount}<span className="hud-of">/{totalStops}</span></span>
            <span className="hud-lab">Communities visited</span>
            <div className="hud-bar"><div className="hud-fill" style={{ width: pct + '%' }} /></div>
          </div>
          <div className="hud-stat">
            <span className="hud-num">{wampum}</span>
            <span className="hud-lab">Wampum earned</span>
          </div>
          <div className="hud-stat">
            <span className="hud-num">{Math.round(distance / 50)}<span className="hud-of"> km</span></span>
            <span className="hud-lab">Distance traveled</span>
          </div>
          <div className="hud-stat">
            <span className="hud-num">{speed}<span className="hud-of"> px/s</span></span>
            <span className="hud-lab">Current speed</span>
          </div>
        </div>
      </div>

      <div className="journey-toolbar">
        <div className="jt-seg">
          <button className={mode==='car'?'on':''} onClick={() => setMode('car')}>◐ Car (land · fast on roads)</button>
          <button className={mode==='canoe'?'on':''} onClick={() => setMode('canoe')}>≈ Canoe (water · fast on lakes)</button>
        </div>
        <div className="jt-spacer" />
        <div className="jt-status">
          <span className={`jt-dot ${active?'live':''}`}></span>
          {active ? 'Game active · keys captured' : 'Click stage to control →'}
        </div>
        <button className="jt-reset" onClick={resetJourney}>⟲ Reset journey</button>
      </div>

      <div
        ref={stageRef}
        className={`journey-stage ${active?'is-active':''}`}
        tabIndex={0}
        onMouseDown={() => setActive(true)}
        onTouchStart={() => setActive(true)}
      >
        <canvas ref={canvasRef} className="journey-canvas" />

        {!active && !question && !feedback && (
          <div className="journey-start">
            <div className="js-card">
              <div className="js-glyph">▶</div>
              <div className="js-h">Ready to drive.</div>
              <div className="js-sub">Arrow keys or W·A·S·D · Space at a glowing lodge to learn it.</div>
            </div>
          </div>
        )}

        {approaching && !question && !feedback && active && (
          <div className="journey-approach">
            <div className="ja-name">{approaching.c.name.trim()}</div>
            <div className="ja-meta">
              {approaching.c.regionGroup}{approaching.c.population ? ` · ${approaching.c.population.toLocaleString()} members` : ''}
            </div>
            <button className="ja-cta" onClick={approachVisit}>Press SPACE or tap to visit →</button>
          </div>
        )}

        {question && (
          <div className="journey-overlay">
            <div className="jo-card">
              <div className="jo-eyebrow">{question.target.regionGroup} · {question.target.direction}</div>
              <div className="jo-target">{question.target.name.trim()}</div>
              <div className="jo-q">{question.q}</div>
              {question.sub && <div className="jo-subq">{question.sub}</div>}
              <div className="jo-opts">
                {question.options.map((o, i) => (
                  <button key={i} className="jo-opt" onClick={() => answerQuestion(o)}>
                    <span className="jo-opt-letter">{String.fromCharCode(65+i)}</span>{o.label}
                  </button>
                ))}
              </div>
              <button className="jo-skip" onClick={() => { setQuestion(null); pausedRef.current = false; }}>
                Skip for now (no penalty)
              </button>
            </div>
          </div>
        )}

        {feedback && (
          <div className={`journey-feedback ${feedback.ok ? 'ok' : 'no'}`}>
            <div className="jf-icon">{feedback.ok ? '✓' : '◇'}</div>
            <div>
              <div className="jf-msg">{feedback.msg}</div>
              {feedback.hint && <div className="jf-hint">{feedback.hint}</div>}
              <button className="jf-open" onClick={() => onSelect(feedback.target.id)}>
                Open full record →
              </button>
            </div>
          </div>
        )}

        {/* Mobile / touch joystick */}
        <div className="journey-touchpad" aria-hidden="true">
          <button className="tp tp-up"
            onTouchStart={()=>{setActive(true);setKey('up',true);}} onTouchEnd={()=>setKey('up',false)}
            onMouseDown={()=>{setActive(true);setKey('up',true);}} onMouseUp={()=>setKey('up',false)} onMouseLeave={()=>setKey('up',false)}>▲</button>
          <button className="tp tp-left"
            onTouchStart={()=>{setActive(true);setKey('left',true);}} onTouchEnd={()=>setKey('left',false)}
            onMouseDown={()=>{setActive(true);setKey('left',true);}} onMouseUp={()=>setKey('left',false)} onMouseLeave={()=>setKey('left',false)}>◀</button>
          <button className="tp tp-down"
            onTouchStart={()=>{setActive(true);setKey('down',true);}} onTouchEnd={()=>setKey('down',false)}
            onMouseDown={()=>{setActive(true);setKey('down',true);}} onMouseUp={()=>setKey('down',false)} onMouseLeave={()=>setKey('down',false)}>▼</button>
          <button className="tp tp-right"
            onTouchStart={()=>{setActive(true);setKey('right',true);}} onTouchEnd={()=>setKey('right',false)}
            onMouseDown={()=>{setActive(true);setKey('right',true);}} onMouseUp={()=>setKey('right',false)} onMouseLeave={()=>setKey('right',false)}>▶</button>
        </div>
      </div>

      <div className="journey-legend">
        <span><span className="ll" style={{background:'#b8351e'}}></span>You</span>
        <span><span className="ll" style={{background:'#d4a017'}}></span>Visited (smoke rising)</span>
        <span><span className="ll" style={{background:'#1a1612'}}></span>Unvisited</span>
        <span><span className="ll" style={{background:'#caa765', height:4, marginTop:3}}></span>Road (fast in car)</span>
        <span><span className="ll" style={{background:'#4a73a0'}}></span>Lake (use canoe)</span>
        <span style={{marginLeft:'auto'}} className="mono">All quiz facts pulled live from the master sheet.</span>
      </div>
    </div>
  );
}

window.JourneyGame = JourneyGame;
