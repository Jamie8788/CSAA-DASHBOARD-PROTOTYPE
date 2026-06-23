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
const WATER_TOP = ['#b07a42', '#80a48e', '#79a494', '#b06038', '#274463'];
const WATER_BOT = ['#46584e', '#4c6c64', '#527066', '#46343a', '#182a44'];
const SUN_COL   = ['#ffe2a0', '#fff3d0', '#fff6dd', '#ff9d5c', '#cdd8ee'];

// precomputed star + bird seeds (stable across frames)
const _STARS = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random() * 0.5, r: 0.4 + Math.random() * 1.3, ph: Math.random() * 6.28 }));
// Seven brighter stars in a gentle ring that breathe together — a quiet honouring
// of the Seven Grandfather Teachings (no labels, just seven lights watching over).
const _SEVEN = Array.from({ length: 7 }, (_, i) => {
  const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
  return { x: 0.5 + Math.cos(a) * 0.075, y: 0.2 + Math.sin(a) * 0.06, ph: i * 0.62 };
});
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
// visitor taps on the lake → expanding ripples (interactive). { x, y, t } in px / ms.
const _CLICKS = [];
// slow drifting clouds, tinted by the sky for atmosphere
const _CLOUDS = [
  { x: 0.10, y: 0.34, r: 150, sp: 0.006, op: 0.5 },
  { x: 0.45, y: 0.22, r: 110, sp: 0.009, op: 0.42 },
  { x: 0.72, y: 0.40, r: 170, sp: 0.005, op: 0.55 },
  { x: 0.92, y: 0.28, r: 120, sp: 0.007, op: 0.4 },
];
// candlelight-vigil lights drifting on the water at dusk/night (remembrance).
// y = fraction down the water (0..1); x drifts slowly across.
const _VIGIL = [
  { x: 0.18, y: 0.26, sp: 0.0040, ph: 0.0 },
  { x: 0.33, y: 0.52, sp: 0.0030, ph: 1.2 },
  { x: 0.47, y: 0.36, sp: 0.0050, ph: 2.1 },
  { x: 0.78, y: 0.60, sp: 0.0035, ph: 3.3 },
  { x: 0.88, y: 0.30, sp: 0.0045, ph: 4.0 },
  { x: 0.60, y: 0.70, sp: 0.0030, ph: 5.1 },
];
// fireflies that come out at dusk near the foreground reeds (sparse, organic)
const _FLIES = Array.from({ length: 9 }, () => ({
  x: Math.random(), y: 0.66 + Math.random() * 0.3, r: 0.8 + Math.random() * 1.0,
  sp: 0.2 + Math.random() * 0.5, ph: Math.random() * 6.28, blink: 0.3 + Math.random() * 0.6,
}));
// leaping-fish events (a fish arcs out of the water now and then)
const _FISH = [
  { x: 0.34, yb: 0.34, period: 13, phase: 2, dir: 1 },
  { x: 0.70, yb: 0.50, period: 17, phase: 9, dir: -1 },
  { x: 0.22, yb: 0.62, period: 21, phase: 4, dir: 1 },
];
// cursor position (-1..1 from centre), eased, for a parallax depth effect
let _MX = 0, _MY = 0, _MXe = 0, _MYe = 0;

// Calming ambient lake soundscape — fully SYNTHESIZED (no recordings): soft layered
// water, gentle wind, frequent quiet birdsong, a lone loon, a slow soft heartbeat,
// and a sparse wooden-flute melody (pentatonic — evoking the Anishinaabe flute).
// Web Audio; starts on a user gesture; fades in/out. Tuned to be relaxing, not busy.
function createAmbient(getP) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  const timers = [];
  const T = () => ctx.currentTime;
  const P = () => { try { return Math.max(0, Math.min(1, getP ? getP() : 0)); } catch (e) { return 0; } };
  const pan = (v) => { try { const p = ctx.createStereoPanner(); p.pan.value = v; return p; } catch (e) { return ctx.createGain(); } };
  function brown() {
    const len = 2 * ctx.sampleRate, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    return b;
  }
  // deep water rumble
  const n1 = ctx.createBufferSource(); n1.buffer = brown(); n1.loop = true;
  const lp1 = ctx.createBiquadFilter(); lp1.type = 'lowpass'; lp1.frequency.value = 300;
  const g1 = ctx.createGain(); g1.gain.value = 0.075;
  n1.connect(lp1); lp1.connect(g1); g1.connect(master);
  const lfo1 = ctx.createOscillator(); lfo1.frequency.value = 0.08; const lg1 = ctx.createGain(); lg1.gain.value = 0.05;
  lfo1.connect(lg1); lg1.connect(g1.gain); n1.start(); lfo1.start();
  // soft lapping wavelets (stereo)
  [-0.5, 0.5].forEach((pp, idx) => {
    const n = ctx.createBufferSource(); n.buffer = brown(); n.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 560 + idx * 180; bp.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = 0.028; const p = pan(pp);
    n.connect(bp); bp.connect(g); g.connect(p); p.connect(master);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.24 + idx * 0.1; const lg = ctx.createGain(); lg.gain.value = 0.034;
    lfo.connect(lg); lg.connect(g.gain); n.start(); lfo.start();
  });
  // very soft wind
  const wn = ctx.createBufferSource(); wn.buffer = brown(); wn.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 760;
  const wg = ctx.createGain(); wg.gain.value = 0.005;
  wn.connect(hp); hp.connect(wg); wg.connect(master);
  const wlfo = ctx.createOscillator(); wlfo.frequency.value = 0.045; const wlg = ctx.createGain(); wlg.gain.value = 0.008;
  wlfo.connect(wlg); wlg.connect(wg.gain); wn.start(); wlfo.start();
  // slow, soft heartbeat (REMOVED — Hassan flagged the existing pads as a
  // "trumpet" noise. Soundscape now: water/wind ambient + scroll-gated
  // rattle/eagle/fish/wolves only. No flute, no loon, no heartbeat, no
  // constant birdsong.)
  function thump() {}
  function heart() {}
  // birdsong (REMOVED — was constant and not time-of-day gated)
  function bird() {}
  // loon (REMOVED — was the "trumpet"-like tone)
  function loon() {}
  // wooden flute (REMOVED — also read as "trumpet")
  function flute() {}
  // (frequent birdsong / loon / wooden flute were removed above —
  //  their function bodies became no-ops.)

  // ===========================================================================
  // TIME-OF-DAY VOICES — driven by the scroll position (P()):
  //   morning  (P < 0.30) → traditional Anishinaabe RATTLE that starts the day,
  //                          and a bald eagle's high cry overhead
  //   day      (0.30..0.66) → fish splashing on the lake, an otter slipping in
  //   dusk/night (> 0.66)  → wolves howling on the ridge, the loon takes over
  // ===========================================================================

  // --- Anishinaabe rattle (shaker): short bursts of softly-filtered noise pulses,
  //   the rattle that opens the day. Plays once at start, then occasionally in morning.
  function rattle(strong) {
    const t0 = T() + 0.05;
    const shakes = strong ? 14 : 8;
    const shaker = ctx.createGain(); shaker.gain.value = 1;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3800; bp.Q.value = 1.6;
    const out = ctx.createGain(); out.gain.value = 0;
    shaker.connect(bp); bp.connect(out); out.connect(master);
    for (let k = 0; k < shakes; k++) {
      const tk = t0 + k * (0.085 + (k % 2) * 0.02);
      const n = ctx.createBufferSource(); n.buffer = brown(); n.loop = false;
      const g = ctx.createGain();
      const vol = (strong ? 0.22 : 0.14) * (1 - k / (shakes + 4));
      g.gain.setValueAtTime(0.0001, tk);
      g.gain.linearRampToValueAtTime(vol, tk + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, tk + 0.075);
      n.connect(g); g.connect(shaker);
      n.start(tk); n.stop(tk + 0.09);
    }
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.linearRampToValueAtTime(1, t0 + 0.05);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + shakes * 0.1 + 0.4);
  }
  // schedule rattle: a strong opening rattle to start the day, then sparingly during morning
  function rattleLoop() {
    if (P() < 0.32) rattle(false);
    timers.push(setTimeout(rattleLoop, 16000 + Math.random() * 14000));
  }

  // --- bald eagle: a high descending screech (morning)
  function eagle() {
    if (P() >= 0.30 && P() <= 0.65) {     // moved to DAY/EVENING per Hassan
      const t = T() + 0.05;
      const p = pan((Math.random() * 2 - 1) * 0.5);
      const cries = 2 + (Math.random() < 0.4 ? 1 : 0);
      for (let c = 0; c < cries; c++) {
        const tc = t + c * 0.22;
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(2400, tc);
        o.frequency.exponentialRampToValueAtTime(1100, tc + 0.18);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 4;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, tc);
        g.gain.linearRampToValueAtTime(0.05, tc + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, tc + 0.22);
        o.connect(bp); bp.connect(g); g.connect(p);
        o.start(tc); o.stop(tc + 0.24);
      }
      p.connect(master);
    }
    timers.push(setTimeout(eagle, 11000 + Math.random() * 14000));
  }

  // --- fish splash (day): a quick noise burst with a downward filter
  function splash(big) {
    const t = T() + 0.02;
    const p = pan((Math.random() * 2 - 1) * 0.7);
    const n = ctx.createBufferSource(); n.buffer = brown(); n.loop = false;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(big ? 2400 : 1600, t);
    lp.frequency.exponentialRampToValueAtTime(380, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(big ? 0.20 : 0.12, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 0.7 : 0.45));
    n.connect(lp); lp.connect(g); g.connect(p); p.connect(master);
    n.start(t); n.stop(t + 0.8);
  }
  function fishLoop() {
    const pp = P();
    if (pp >= 0.30 && pp <= 0.65) splash(Math.random() < 0.3);          // DAY/EVENING only
    timers.push(setTimeout(fishLoop, 5500 + Math.random() * 7000));
  }
  function otterLoop() {
    const pp = P();
    if (pp >= 0.30 && pp <= 0.65 && Math.random() < 0.6) {
      // a quick double-splash (otter slipping in)
      splash(false);
      timers.push(setTimeout(() => splash(false), 220 + Math.random() * 120));
    }
    timers.push(setTimeout(otterLoop, 9000 + Math.random() * 12000));
  }

  // --- wolf howl (night): a slow rising-then-falling sine tone, faintly reverberant
  function wolf() {
    if (P() > 0.62) {
      const t = T() + 0.05;
      const p = pan((Math.random() * 2 - 1) * 0.55);
      const f0 = 280 + Math.random() * 60;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f0 * 0.6, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 1.45, t + 0.6);
      o.frequency.exponentialRampToValueAtTime(f0 * 1.1, t + 2.6);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 3.4);
      // a quiet second voice answers a beat later (the pair on the ridge)
      const o2 = ctx.createOscillator(); o2.type = 'sine';
      o2.frequency.setValueAtTime(f0 * 0.55 * 1.18, t + 1.2);
      o2.frequency.exponentialRampToValueAtTime(f0 * 1.32 * 1.18, t + 1.9);
      o2.frequency.exponentialRampToValueAtTime(f0 * 0.55 * 1.18, t + 4.0);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.6);
      g.gain.linearRampToValueAtTime(0.06, t + 2.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
      o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(p); p.connect(master);
      o.start(t); o.stop(t + 4.3); o2.start(t + 1.2); o2.stop(t + 4.3);
    }
    timers.push(setTimeout(wolf, 14000 + Math.random() * 16000));
  }

  // (heart/bird/loon/flute removed — they were the "trumpet"-like pads)
  // OPEN THE DAY — a strong traditional rattle as the soundscape begins
  rattle(true);
  timers.push(setTimeout(rattleLoop, 17000));
  timers.push(setTimeout(eagle, 4500));
  timers.push(setTimeout(fishLoop, 6500));
  timers.push(setTimeout(otterLoop, 12000));
  timers.push(setTimeout(wolf, 9000));
  try { master.gain.linearRampToValueAtTime(0.46, T() + 2.6); } catch (e) {}
  return {
    stop() {
      timers.forEach(clearTimeout);
      try { master.gain.linearRampToValueAtTime(0.0001, T() + 0.5); } catch (e) {}
      setTimeout(() => { try { ctx.close(); } catch (e) {} }, 700);
    },
  };
}

function drawScene(ctx, W, H, p, tt, now) {
  const hY = H * 0.5;
  // Begin the story in bright MORNING (not pre-dawn dark) and end at night, so
  // the very first screen is a luminous, lit lake. The whole day still unfolds.
  p = 0.30 + 0.70 * _clamp(p, 0, 1);
  // ease the cursor for a gentle parallax (foreground moves more than background)
  _MXe += (_MX - _MXe) * 0.08; _MYe += (_MY - _MYe) * 0.08;
  const pxX = _MXe, pxY = _MYe;
  // ---- SKY ----
  const sky = ctx.createLinearGradient(0, 0, 0, hY + 30);
  sky.addColorStop(0, _ramp(SKY_TOP, p));
  sky.addColorStop(1, _ramp(SKY_HORIZ, p));
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hY + 30);

  // ---- drifting clouds, tinted by the horizon light (fade away at night) ----
  const cloudA = 0.55 * (1 - _smooth(0.66, 0.92, p));
  if (cloudA > 0.02) {
    const ct = _rampA(SKY_HORIZ, p);
    for (const cl of _CLOUDS) {
      const cxp = (((cl.x + tt * cl.sp) % 1.3) - 0.15) * W + pxX * 7;
      const cyp = cl.y * hY + pxY * 5;
      ctx.save(); ctx.translate(cxp, cyp); ctx.scale(1, 0.4);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, cl.r);
      g.addColorStop(0, `rgba(${ct[0] + 18},${ct[1] + 14},${ct[2] + 10},${cloudA * cl.op})`);
      g.addColorStop(0.6, `rgba(${ct[0]},${ct[1]},${ct[2]},${cloudA * cl.op * 0.4})`);
      g.addColorStop(1, `rgba(${ct[0]},${ct[1]},${ct[2]},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, cl.r, 0, 6.283); ctx.fill();
      ctx.restore();
    }
  }

  // ---- STARS (night) ----
  const starA = _smooth(0.66, 0.95, p);
  if (starA > 0.01) {
    for (const s of _STARS) {
      const tw = 0.5 + 0.5 * Math.sin(tt * 2 + s.ph);
      ctx.globalAlpha = starA * tw * 0.9;
      ctx.beginPath(); ctx.arc(s.x * W, s.y * hY, s.r, 0, 6.283);
      ctx.fillStyle = '#fdf6e8'; ctx.fill();
    }
    // the seven, breathing together (a collective glow over the gentle twinkle)
    const breath = 0.62 + 0.38 * Math.sin(tt * 1.1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const s of _SEVEN) {
      const px = s.x * W, py = s.y * hY;
      const tw = 0.55 + 0.45 * Math.sin(tt * 1.1 + s.ph);
      const a = starA * breath * tw;
      const g = ctx.createRadialGradient(px, py, 0, px, py, 9);
      g.addColorStop(0, `rgba(255,244,214,${0.5 * a})`); g.addColorStop(1, 'rgba(255,244,214,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 9, 0, 6.283); ctx.fill();
      ctx.fillStyle = `rgba(255,250,232,${0.9 * a})`; ctx.beginPath(); ctx.arc(px, py, 1.6, 0, 6.283); ctx.fill();
    }
    ctx.restore();
    // an occasional shooting star streaking through the night
    const shoot = tt % 11;
    if (starA > 0.3 && shoot < 0.7) {
      const k = shoot / 0.7;
      const sx = W * 0.24 + k * W * 0.46, sy = hY * 0.16 + k * hY * 0.26;
      ctx.save(); ctx.globalAlpha = starA * (1 - k);
      const tg = ctx.createLinearGradient(sx, sy, sx - 46, sy - 18);
      tg.addColorStop(0, 'rgba(255,250,235,0.95)'); tg.addColorStop(1, 'rgba(255,250,235,0)');
      ctx.strokeStyle = tg; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 46, sy - 18); ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  // ---- AURORA — the northern lights, "the ancestors dancing" (deep dusk → night) ----
  const aurA = _smooth(0.62, 0.92, p);
  if (aurA > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';   // glows additively, more alive
    const cols = ['80,212,150', '120,150,232', '156,92,204', '88,200,182'];
    for (let b = 0; b < 4; b++) {
      ctx.beginPath();
      const baseY = hY * (0.12 + b * 0.10);
      for (let x = 0; x <= W; x += 14) {
        const y = baseY
          + Math.sin(x * 0.005 + tt * 0.6 + b * 1.3) * 26
          + Math.sin(x * 0.013 + tt * 0.9) * 12
          + Math.sin(x * 0.026 + tt * 0.4 + b) * 6;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${cols[b]},${aurA * (0.2 + 0.06 * Math.sin(tt * 0.8 + b))})`;
      ctx.lineWidth = 16 + 8 * Math.sin(tt * 0.7 + b); ctx.lineCap = 'round'; ctx.stroke();
    }
    ctx.restore();
  }

  // ---- SUN & MOON (a smooth, believable hand-off at dusk) ----
  const alt = Math.sin(_clamp(p, 0, 1) * Math.PI);     // 0 at the horizon, 1 at the zenith
  const sunX = W * (0.16 + p * 0.66);
  const sunY = hY - alt * (hY * 0.74) + 8;
  const sunA = 1 - _smooth(0.82, 0.93, p);             // sun dims out as night arrives
  const moonA = _smooth(0.84, 0.985, p);               // moon glows up
  const moonRise = _smooth(0.80, 1.0, p);
  const moonX = W * 0.30;
  const moonY = hY - (0.12 + moonRise * 0.5) * hY;
  const moonR = 34;
  let lightX = sunX, lightCol = [255, 240, 210], lightA = 0.2;

  if (sunA > 0.01) {
    const sunR = _lerp(86, 38, alt);                   // large & low at sunset, small at noon
    // colour: deep red-orange when low, warm white-gold when high overhead
    const sunC = [255, Math.round(_lerp(82, 246, alt)), Math.round(_lerp(40, 214, alt))];
    const halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 8);
    halo.addColorStop(0, `rgba(${sunC[0]},${sunC[1]},${sunC[2]},${0.6 * sunA})`);
    halo.addColorStop(0.16, `rgba(${sunC[0]},${sunC[1]},${sunC[2]},${0.28 * sunA})`);
    halo.addColorStop(0.45, `rgba(${sunC[0]},${sunC[1]},${sunC[2]},${0.08 * sunA})`);
    halo.addColorStop(1, `rgba(${sunC[0]},${sunC[1]},${sunC[2]},0)`);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, hY + 2); ctx.clip();
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, hY + 2);
    // volumetric light shafts (god rays) fanning softly down from the sun
    ctx.globalCompositeOperation = 'lighter';
    for (let r = 0; r < 7; r++) {
      const ang = Math.PI / 2 + (r - 3) * 0.13 + Math.sin(tt * 0.3 + r) * 0.025;
      const len = H * 0.75;
      const ex = sunX + Math.cos(ang) * len, ey = sunY + Math.sin(ang) * len;
      const nx = Math.cos(ang + Math.PI / 2), ny = Math.sin(ang + Math.PI / 2);
      const wTop = 5, wBot = 24 + 10 * Math.sin(tt * 0.5 + r * 1.3);
      ctx.beginPath();
      ctx.moveTo(sunX - nx * wTop, sunY - ny * wTop);
      ctx.lineTo(sunX + nx * wTop, sunY + ny * wTop);
      ctx.lineTo(ex + nx * wBot, ey + ny * wBot);
      ctx.lineTo(ex - nx * wBot, ey - ny * wBot);
      ctx.closePath();
      ctx.fillStyle = `rgba(${sunC[0]},${sunC[1]},${sunC[2]},${0.035 * sunA})`;
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1; ctx.restore();
    ctx.globalAlpha = sunA;
    const disc = ctx.createRadialGradient(sunX - sunR * 0.25, sunY - sunR * 0.25, sunR * 0.1, sunX, sunY, sunR);
    disc.addColorStop(0, `rgb(255,${Math.min(255, sunC[1] + 26)},${Math.min(255, sunC[2] + 40)})`);
    disc.addColorStop(1, `rgb(${sunC[0]},${sunC[1]},${sunC[2]})`);
    ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, 6.283); ctx.fillStyle = disc; ctx.fill();
    ctx.globalAlpha = 1;
    lightCol = sunC; lightA = sunA;
  }

  if (moonA > 0.01) {
    const mh = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 6);
    mh.addColorStop(0, `rgba(206,219,243,${0.42 * moonA})`);
    mh.addColorStop(0.4, `rgba(206,219,243,${0.1 * moonA})`);
    mh.addColorStop(1, 'rgba(206,219,243,0)');
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, hY + 2); ctx.clip();
    ctx.fillStyle = mh; ctx.fillRect(0, 0, W, hY + 2); ctx.restore();
    ctx.globalAlpha = moonA;
    ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, 6.283); ctx.fillStyle = '#e9eef8'; ctx.fill();
    ctx.fillStyle = 'rgba(150,165,198,0.5)';
    for (const c of [[-9, -7, 6], [8, 4, 4.5], [-4, 10, 3.4], [13, -9, 3], [-15, 5, 2.6]]) {
      ctx.beginPath(); ctx.arc(moonX + c[0], moonY + c[1], c[2], 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (moonA >= sunA) { lightX = moonX; lightCol = [206, 219, 243]; lightA = moonA; }
  }
  const isMoon = moonA > 0.5;
  const [hr, hg, hb] = lightCol;

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

  // ---- BALD EAGLE soaring overhead (morning → afternoon) ----
  //   Larger, more anatomically detailed: broad outstretched wings with
  //   distinct primary feather fingers, dark chocolate body, snow-white
  //   head and tail, hooked yellow beak. Circles slowly across the sky.
  const eagleA = _smooth(0.05, 0.20, p) * (1 - _smooth(0.55, 0.74, p));
  if (eagleA > 0.02) {
    // Clean, iconic bald-eagle silhouette. The previous version had too
    // many tiny feather strokes that read as noise on a small canvas — this
    // version uses bigger shapes and a clear flight pose.
    const eT = tt * 0.07;
    const eRX = W * 0.32, eRY = hY * 0.36;
    const ex = eRX + Math.cos(eT) * W * 0.24;
    const ey = eRY + Math.sin(eT) * 30;
    const heading = Math.cos(eT + Math.PI / 2);
    const dir = heading >= 0 ? 1 : -1;
    const wingPhase = Math.sin(tt * 1.1);                       // strong, deliberate flap
    const ES = 2.2;                                              // big enough to read
    ctx.save(); ctx.globalAlpha = eagleA;
    ctx.translate(ex, ey); ctx.scale(dir * ES, ES);

    // ---- WINGS (drawn first so body sits on top) ----
    //   A single, clean swept wing on each side. The shape itself reads as
    //   "soaring eagle" — no fiddly feather strokes.
    const drawWing = (sign) => {
      const d = sign;
      const lift = wingPhase * 0.25;
      ctx.fillStyle = 'rgba(28,18,10,1)';
      ctx.beginPath();
      ctx.moveTo(2 * d, -1.5);
      // leading edge sweeps outward & slightly up
      ctx.bezierCurveTo(10 * d, -6 - lift * 8,
                        24 * d, -8 - lift * 10,
                        36 * d, -5 - lift * 10);
      // wingtip notch (the iconic "fingers" shown as one rounded notch)
      ctx.lineTo(34 * d, -2 - lift * 6);
      ctx.lineTo(36 * d, -1 - lift * 5);
      ctx.lineTo(33 * d, 1 - lift * 3);
      // trailing edge curves back to the body
      ctx.bezierCurveTo(22 * d, 2,
                        12 * d, 2,
                        4 * d, 0);
      ctx.closePath(); ctx.fill();
      // a lighter brown band along the inner wing for depth
      ctx.fillStyle = 'rgba(72,50,28,1)';
      ctx.beginPath();
      ctx.moveTo(4 * d, -1);
      ctx.bezierCurveTo(12 * d, -4 - lift * 4, 22 * d, -5 - lift * 6, 24 * d, -3 - lift * 5);
      ctx.bezierCurveTo(18 * d, 0, 10 * d, 0, 4 * d, 0);
      ctx.closePath(); ctx.fill();
    };
    drawWing(1);
    drawWing(-1);

    // ---- BODY (dark chocolate, simple ellipse) ----
    const bodG = ctx.createLinearGradient(0, -3, 0, 4);
    bodG.addColorStop(0, 'rgba(58,38,22,1)');
    bodG.addColorStop(1, 'rgba(22,14,8,1)');
    ctx.fillStyle = bodG;
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 3.4, 0, 0, 6.283); ctx.fill();

    // ---- WHITE TAIL FAN (short, fanned) ----
    ctx.fillStyle = 'rgba(248,244,232,1)';
    ctx.beginPath();
    ctx.moveTo(-7, -2); ctx.lineTo(-16, -4); ctx.lineTo(-16, 4); ctx.lineTo(-7, 2);
    ctx.closePath(); ctx.fill();
    // a single dark feather division so it doesn't look like a flat block
    ctx.strokeStyle = 'rgba(140,130,110,0.6)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-16, 0); ctx.stroke();

    // ---- WHITE HEAD ----
    ctx.fillStyle = 'rgba(248,244,232,1)';
    ctx.beginPath(); ctx.ellipse(9, -0.4, 3.4, 2.6, 0, 0, 6.283); ctx.fill();
    // dark eye + brow line
    ctx.fillStyle = 'rgba(20,12,8,1)';
    ctx.beginPath(); ctx.arc(10.4, -1.0, 0.65, 0, 6.283); ctx.fill();

    // ---- BRIGHT YELLOW HOOKED BEAK ----
    ctx.fillStyle = 'rgba(248,196,52,1)';
    ctx.beginPath();
    ctx.moveTo(12, -0.8);
    ctx.lineTo(15.5, 0.6);
    ctx.lineTo(14.5, 1.2);
    ctx.lineTo(12, 0.6);
    ctx.closePath(); ctx.fill();
    // hooked tip
    ctx.strokeStyle = 'rgba(140,80,20,0.7)'; ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.moveTo(14.5, 0.6); ctx.lineTo(15.5, 1.4); ctx.stroke();

    ctx.restore();
  }
  // ---- far shore: treeline + a small community gathering, with a fire glow ----
  const shoreAlpha = 0.6 + 0.28 * _smooth(0.6, 1, p);
  const vx = W * 0.66;                                 // the village gathering sits here on the shore
  // warm campfire glow at the village, warming toward dusk & night (flickering)
  const fireA = _smooth(0.45, 0.95, p);
  if (fireA > 0.02) {
    const flick = 0.7 + 0.3 * Math.sin(tt * 9) + 0.15 * Math.sin(tt * 17);
    const fglow = ctx.createRadialGradient(vx, hY - 2, 0, vx, hY - 2, 96);
    fglow.addColorStop(0, `rgba(255,168,72,${0.55 * fireA * flick})`);
    fglow.addColorStop(1, 'rgba(255,168,72,0)');
    ctx.fillStyle = fglow; ctx.fillRect(vx - 96, hY - 96, 192, 130);
  }
  // ---- distant hills: three layered ridges with atmospheric haze (far = lighter) ----
  const haze = _rampA(SKY_HORIZ, p);
  const ridge = (base, amp, freq, phase, mixF, alpha) => {
    const r = Math.round(_lerp(26, haze[0], mixF)), g = Math.round(_lerp(21, haze[1], mixF)), b = Math.round(_lerp(15, haze[2], mixF));
    ctx.beginPath(); ctx.moveTo(0, hY + 2);
    for (let x = 0; x <= W; x += 12) {
      const y = hY - base - amp * (0.6 * Math.sin(x * freq + phase) + 0.28 * Math.sin(x * freq * 2.3 + phase * 1.7) + 0.12 * Math.sin(x * freq * 0.5));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, hY + 2); ctx.closePath();
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`; ctx.fill();
  };
  ridge(24, 15, 0.0080, 2.1, 0.62, shoreAlpha * 0.5);   // farthest, hazy & pale
  ridge(13, 19, 0.0110, 0.7, 0.34, shoreAlpha * 0.72);  // middle
  ridge(3, 22, 0.0140, 0.0, 0.10, shoreAlpha);          // nearest, darkest
  // a pine treeline standing along the nearest ridge crest
  ctx.fillStyle = `rgba(13,10,7,${shoreAlpha})`;
  for (let x = 7; x < W; x += 12) {
    const crest = hY - 3 - 22 * (0.6 * Math.sin(x * 0.014) + 0.28 * Math.sin(x * 0.0322) + 0.12 * Math.sin(x * 0.007));
    const th = 8 + (Math.sin(x * 1.7) * 0.5 + 0.5) * 9;
    const tw = th * 0.34;
    ctx.beginPath(); ctx.moveTo(x, crest - th); ctx.lineTo(x - tw, crest + 1); ctx.lineTo(x + tw, crest + 1); ctx.closePath(); ctx.fill();
  }
  // ---- a small Anishinaabe gathering circle at the shore (no houses — the
  //   community is here in person: standing, sitting, working together) ----
  for (const Lg of [[-30, 0.85], [-12, 1.05], [6, 0.8], [22, 1.0], [38, 0.7]]) {
    const lx = vx + Lg[0] * 1.25, s = Lg[1];
    const bob = Math.sin(tt * 1.4 + Lg[0]) * 0.5;
    ctx.fillStyle = `rgba(8,5,3,${Math.max(0.75, shoreAlpha)})`;
    ctx.beginPath(); ctx.ellipse(lx, hY - 1 + bob, 1.6 * s, 4 * s, 0, Math.PI, 2 * Math.PI); ctx.fill();   // body
    ctx.beginPath(); ctx.arc(lx, hY - 5.5 * s + bob, 1.4 * s, 0, 6.283); ctx.fill();                       // head
    // a faint warm fire-glow rim on the side facing the fire
    if (fireA > 0.3) { ctx.fillStyle = `rgba(255,176,86,${0.35 * fireA})`; ctx.beginPath(); ctx.arc(lx + (lx < vx ? 1 : -1), hY - 5.5 * s + bob, 1.4 * s, 0, 6.283); ctx.fill(); }
  }
  // ---- the community gathered around the sacred fire (dusk → night) ----
  if (fireA > 0.32) {
    const fx = vx + 2, fy = hY + 3;
    // people seated around the fire — larger so they read clearly, fire-lit on the inner side
    ctx.fillStyle = `rgba(6,4,2,${Math.max(0.85, shoreAlpha)})`;
    const folks = [[-27, 0.95], [-16, 1.08], [-4, 0.85], [13, 1.08], [25, 0.95], [6, 0.78]];
    for (const fk of folks) {
      const bob = Math.sin(tt * 1.5 + fk[0]) * 0.6;                                                                // gentle living sway
      const px = fx + fk[0], s2 = fk[1], bh = 10 * s2, py = fy + bob;
      ctx.fillStyle = `rgba(6,4,2,${Math.max(0.85, shoreAlpha)})`;
      ctx.beginPath(); ctx.ellipse(px, py - bh * 0.32, 4 * s2, bh * 0.58, 0, Math.PI, 2 * Math.PI); ctx.fill();   // seated body
      ctx.beginPath(); ctx.arc(px, py - bh - 1, 2.7 * s2, 0, 6.283); ctx.fill();                                   // head
      const inn = px < fx ? 1 : -1;                                                                                 // warm fire-glow rim on the side facing the fire
      ctx.strokeStyle = `rgba(255,150,70,${0.55 * fireA})`; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(px, py - bh - 1, 2.7 * s2, inn > 0 ? -1 : 2.1, inn > 0 ? 1 : 4.2); ctx.stroke();
    }
    // the fire — layered flickering flames (additive glow), now larger
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const cols = ['255,110,34', '255,165,58', '255,224,130'];
    for (let i = 0; i < 3; i++) {
      const fw = 9 - i * 2.2, fh = (22 - i * 4) * (0.8 + 0.35 * Math.sin(tt * (9 + i * 4) + i));
      ctx.fillStyle = `rgba(${cols[i]},${0.85 * fireA})`;
      ctx.beginPath();
      ctx.moveTo(fx - fw, fy);
      ctx.quadraticCurveTo(fx - fw * 0.5 + Math.sin(tt * 8 + i) * 3, fy - fh * 0.6, fx, fy - fh);
      ctx.quadraticCurveTo(fx + fw * 0.5 + Math.sin(tt * 8 + i + 2) * 3, fy - fh * 0.6, fx + fw, fy);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // logs at the base
    ctx.strokeStyle = `rgba(26,15,8,${Math.max(0.85, shoreAlpha)})`; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(fx - 10, fy + 1); ctx.lineTo(fx + 10, fy - 2); ctx.moveTo(fx - 10, fy - 2); ctx.lineTo(fx + 10, fy + 1); ctx.stroke();
    // the fire's reflection on the water below
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const rgl = ctx.createLinearGradient(fx, hY + 2, fx, hY + 58);
    rgl.addColorStop(0, `rgba(255,168,78,${0.2 * fireA})`); rgl.addColorStop(1, 'rgba(255,150,60,0)');
    const wob = Math.sin(tt * 2) * 3;
    ctx.fillStyle = rgl; ctx.beginPath();
    ctx.moveTo(fx - 16, hY + 2); ctx.lineTo(fx + 16, hY + 2); ctx.lineTo(fx + 9 + wob, hY + 58); ctx.lineTo(fx - 9 + wob, hY + 58); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // ---- DAY on the land: the community at work by the water (fades out toward dusk) ----
  const dayA = (1 - _smooth(0.40, 0.66, p)) * shoreAlpha;
  if (dayA > 0.03) {
    ctx.save(); ctx.globalAlpha = dayA;
    // a fish-drying rack (posts + crossbar + hanging fish) — shoreline work, larger so it reads
    const rx = vx - 62;
    ctx.strokeStyle = 'rgba(30,22,13,1)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(rx, hY + 2); ctx.lineTo(rx, hY - 14); ctx.moveTo(rx + 30, hY + 2); ctx.lineTo(rx + 30, hY - 14); ctx.moveTo(rx - 3, hY - 14); ctx.lineTo(rx + 33, hY - 14); ctx.stroke();
    ctx.fillStyle = 'rgba(34,24,15,1)';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(rx + 3 + i * 5, hY - 8, 1.6, 3.4, 0, 0, 6.283); ctx.fill(); }
    // a few people at work — now animated (working arm motion + gentle bob)
    const person = (px, bend, ph) => {
      ctx.fillStyle = 'rgba(14,9,5,1)';
      if (bend) {                                       // bent over a task, arm working
        const work = Math.sin(tt * 3 + ph) * 2.2;
        ctx.beginPath(); ctx.ellipse(px, hY - 4.5, 3.4, 4.4, 0.5, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 3.8, hY - 7.5, 2.1, 0, 6.283); ctx.fill();
        ctx.strokeStyle = 'rgba(14,9,5,1)'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px + 2, hY - 6); ctx.lineTo(px + 7 + work, hY - 2 + Math.abs(work) * 0.4); ctx.stroke();
      } else {                                          // standing, gentle sway
        const bob = Math.sin(tt * 1.5 + ph) * 0.7;
        ctx.beginPath(); ctx.ellipse(px, hY - 5 + bob, 3, 5.5, 0, Math.PI, 2 * Math.PI); ctx.fill();
        ctx.beginPath(); ctx.arc(px, hY - 11 + bob, 2.3, 0, 6.283); ctx.fill();
      }
    };
    person(vx - 14, false, 0); person(vx + 7, true, 1); person(vx + 40, false, 2); person(rx + 15, true, 3.5);
    ctx.restore();
    // a thin wisp of cooking smoke rising from the village (day)
    ctx.save(); ctx.globalAlpha = dayA * 0.45; ctx.strokeStyle = 'rgba(184,178,168,1)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let s = 0; s <= 13; s++) { const sy = hY - 2 - s * 4.5; const sx = vx + 16 + Math.sin(s * 0.6 + tt * 1.1) * (2.5 + s * 0.5); s === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy); }
    ctx.stroke(); ctx.restore();
  }
  // ---- a memorial of orange shirts on a line at the shore ----
  //   "Every Child Matters" — remembering the children of the residential schools.
  {
    const x0 = W * 0.40, x1 = W * 0.55, mlY = hY - 16;
    const sa = Math.max(0.72, shoreAlpha);
    // two posts + a gently sagging line strung between them
    ctx.strokeStyle = `rgba(38,28,18,${sa})`; ctx.lineCap = 'round';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(x0 - 8, mlY - 4); ctx.lineTo(x0 - 8, hY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1 + 8, mlY - 4); ctx.lineTo(x1 + 8, hY); ctx.stroke();
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(x0 - 8, mlY - 3);
    ctx.quadraticCurveTo((x0 + x1) / 2, mlY + 6, x1 + 8, mlY - 3); ctx.stroke();
    const nsh = 7;
    for (let i = 0; i < nsh; i++) {
      const fx = (i + 0.5) / nsh, sx = x0 + fx * (x1 - x0);
      const lineY = mlY - 3 + Math.sin(fx * Math.PI) * 9;   // hang along the sag
      const sway = Math.sin(tt * 1.4 + i * 0.8) * 1.4;
      ctx.save(); ctx.translate(sx + sway, lineY); ctx.rotate(sway * 0.05);
      // a small vigil glow behind each shirt at dusk/night so the memorial is seen
      if (fireA > 0.3) {
        const gg = ctx.createRadialGradient(0, 7, 0, 0, 7, 13);
        gg.addColorStop(0, `rgba(255,150,70,${0.38 * fireA})`); gg.addColorStop(1, 'rgba(255,150,70,0)');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 7, 13, 0, 6.283); ctx.fill();
      }
      ctx.fillStyle = `rgba(233,104,28,${sa})`;
      ctx.fillRect(-1.6, 0, 3.2, 2);                       // collar
      ctx.fillRect(-3.5, 1.5, 7, 9);                       // body
      ctx.fillRect(-6, 1.5, 2.6, 4); ctx.fillRect(3.4, 1.5, 2.6, 4);  // sleeves
      ctx.restore();
    }
  }
  // gentle embers drifting up from the village fire (remembrance), at dusk & night
  if (fireA > 0.25) {
    for (let i = 0; i < 7; i++) {
      const t2 = (tt * 0.28 + i * 0.31) % 1;
      const ex = vx + Math.sin(i * 2.1 + tt * 0.8) * 11;
      const ey = hY - 4 - t2 * 64;
      ctx.globalAlpha = fireA * (1 - t2) * 0.8;
      ctx.fillStyle = '#ffba6a';
      ctx.beginPath(); ctx.arc(ex, ey, 1.1, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- WATER: a darkened, rippling MIRROR of the sky (never a dead black slab) ----
  const _hz = _rampA(SKY_HORIZ, p);   // horizon colour (waterline)
  const _tp = _rampA(SKY_TOP, p);     // zenith colour (deep water)
  const _dim = (c, f) => `rgb(${Math.round(c[0] * f)},${Math.round(c[1] * f)},${Math.round(c[2] * f)})`;
  // deep water ≈ a deeper version of the zenith, lifted so it never goes pure black
  const _wb = [Math.max(Math.round(_tp[0] * 0.72), 16), Math.max(Math.round(_tp[1] * 0.72), 22), Math.max(Math.round(_tp[2] * 0.72), 34)];
  const water = ctx.createLinearGradient(0, hY, 0, H);
  water.addColorStop(0, _dim(_hz, 0.92));
  water.addColorStop(0.4, _dim(_hz, 0.62));
  water.addColorStop(1, `rgb(${_wb.join(',')})`);
  ctx.fillStyle = water; ctx.fillRect(0, hY, W, H - hY);
  // bright specular sheen right at the waterline (where the sky reflects strongest)
  const sheen = ctx.createLinearGradient(0, hY, 0, hY + 90);
  sheen.addColorStop(0, `rgba(${Math.min(255, _hz[0] + 40)},${Math.min(255, _hz[1] + 40)},${Math.min(255, _hz[2] + 40)},0.32)`);
  sheen.addColorStop(1, `rgba(${_hz[0]},${_hz[1]},${_hz[2]},0)`);
  ctx.fillStyle = sheen; ctx.fillRect(0, hY, W, 90);
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

  // ---- GLITTER: a wide, living column of light reflected from the sun/moon ----
  ctx.save();
  const colHalf = Math.max(46, W * 0.07);
  ctx.beginPath();
  ctx.moveTo(lightX - colHalf, hY + 2); ctx.lineTo(lightX + colHalf, hY + 2);
  ctx.lineTo(lightX + colHalf * 0.45, H); ctx.lineTo(lightX - colHalf * 0.45, H);
  ctx.closePath(); ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  const gcol = ctx.createLinearGradient(0, hY, 0, H);
  gcol.addColorStop(0, `rgba(${hr},${hg},${hb},${(isMoon ? 0.22 : 0.4) * Math.max(lightA, 0.3)})`);
  gcol.addColorStop(1, `rgba(${hr},${hg},${hb},0)`);
  ctx.fillStyle = gcol; ctx.fillRect(lightX - colHalf, hY, colHalf * 2, H - hY);
  // dancing specular dashes — brighter and busier so the water clearly shimmers
  for (let i = 0; i < 40; i++) {
    const f = i / 40, ry = hY + 4 + f * (H - hY);
    const a = (isMoon ? 0.13 : 0.22) * Math.max(lightA, 0.4) * (1 - f) * (0.4 + 0.6 * Math.sin(tt * 3.4 + i * 0.7));
    if (a <= 0) continue;
    const w = 20 + 16 * Math.sin(i * 1.1 + tt * 1.3);
    const dx = Math.sin(tt * 2.2 + i * 0.6) * (8 + f * 18);
    ctx.fillStyle = isMoon ? `rgba(214,226,250,${a})` : `rgba(255,250,236,${a})`;
    ctx.fillRect(lightX + dx - w / 2, ry, Math.max(5, w), 2.2);
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
    // ripples catch the bright horizon light → they read as light on water
    ctx.strokeStyle = `rgba(${Math.min(255, _hz[0] + 60)},${Math.min(255, _hz[1] + 60)},${Math.min(255, _hz[2] + 60)},${0.05 + L * 0.008})`;
    ctx.lineWidth = 1.2; ctx.stroke();
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

  // ---- a candlelight vigil drifting on the water (dusk → night): remembrance ----
  const vigilA = _smooth(0.56, 0.86, p);
  if (vigilA > 0.02) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const v of _VIGIL) {
      const vxp = (((v.x + tt * v.sp) % 1.1) - 0.05) * W;
      const vyp = hY + 16 + (H - hY) * v.y;
      const fl = 0.72 + 0.28 * Math.sin(tt * 3 + v.ph);
      const g = ctx.createRadialGradient(vxp, vyp, 0, vxp, vyp, 15);
      g.addColorStop(0, `rgba(255,178,90,${0.45 * vigilA * fl})`);
      g.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(vxp, vyp, 15, 0, 6.283); ctx.fill();
      ctx.fillStyle = `rgba(255,228,176,${0.8 * vigilA * fl})`;
      ctx.beginPath(); ctx.arc(vxp, vyp, 1.5, 0, 6.283); ctx.fill();          // flame core
      // soft shimmering reflection below (a fading gradient, not a hard line)
      const rg = ctx.createLinearGradient(vxp, vyp + 2, vxp, vyp + 16);
      rg.addColorStop(0, `rgba(255,190,110,${0.22 * vigilA * fl})`);
      rg.addColorStop(1, 'rgba(255,170,90,0)');
      const wob = Math.sin(tt * 2 + v.ph) * 1.5;
      ctx.fillStyle = rg; ctx.beginPath();
      ctx.moveTo(vxp - 2, vyp + 2); ctx.lineTo(vxp + 2, vyp + 2);
      ctx.lineTo(vxp + wob, vyp + 16); ctx.lineTo(vxp + wob, vyp + 16); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // ---- INTERACTIVE: ripples where the visitor taps the lake ----
  for (let i = _CLICKS.length - 1; i >= 0; i--) {
    const age = (now - _CLICKS[i].t) / 1000;
    if (age > 1.7) { _CLICKS.splice(i, 1); continue; }
    const k = age / 1.7;
    const rx = _CLICKS[i].x, ry = Math.max(_CLICKS[i].y, hY + 6);
    const rad = 6 + k * 80, a = 0.4 * (1 - k);
    ctx.lineWidth = 1.7; ctx.strokeStyle = `rgba(250,250,242,${a})`;
    ctx.beginPath(); ctx.ellipse(rx, ry, rad, rad * 0.3, 0, 0, 6.283); ctx.stroke();
    if (k > 0.18) {
      ctx.strokeStyle = `rgba(250,250,242,${a * 0.55})`;
      ctx.beginPath(); ctx.ellipse(rx, ry, rad * 0.55, rad * 0.55 * 0.3, 0, 0, 6.283); ctx.stroke();
    }
  }

  // ---- CANOE: a warm wooden canoe + paddler, gliding across with bob, wake & reflection ----
  const cx = 70 + _clamp(p, 0, 1) * (W - 140) + pxX * 26;
  const bob = Math.sin(tt * 1.3) * 3;
  const cy = hY + (H - hY) * 0.15 + bob + pxY * 14;
  const scl = Math.max(1.3, Math.min(2.5, W / 780));
  const rock = Math.sin(tt * 1.3 + 0.5) * 0.035;
  const strokeT = Math.sin(tt * 2.1);
  const padSide = strokeT >= 0 ? 1 : -1;
  const rim = lightX < cx ? -1 : 1;                    // warm rim-light from the sun/moon side
  const night = isMoon || p > 0.72;

  // contact shadow so the hull sits IN the water (not floating on top)
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,12,0.22)';
  ctx.beginPath(); ctx.ellipse(cx, cy + 9 * scl, 52 * scl, 7 * scl, 0, 0, 6.283); ctx.fill();
  ctx.restore();

  // soft reflection of the canoe on the water (flipped, faded)
  ctx.save();
  ctx.translate(cx, cy + 16 * scl); ctx.scale(scl, -scl * 0.5); ctx.globalAlpha = 0.13;
  ctx.beginPath(); ctx.moveTo(-48, 0); ctx.quadraticCurveTo(0, 16, 48, 0); ctx.quadraticCurveTo(0, 6, -48, 0);
  ctx.fillStyle = '#3a2515'; ctx.fill();
  ctx.restore();

  // V-wake trailing behind
  ctx.save();
  ctx.strokeStyle = 'rgba(250,244,228,0.2)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (let s = -1; s <= 1; s += 2) {
    ctx.beginPath(); ctx.moveTo(cx - 40 * scl, cy);
    ctx.quadraticCurveTo(cx - 160 * scl, cy + s * 10, cx - 320 * scl, cy + s * 48 * scl);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rock); ctx.scale(scl, scl);
  if (night) { // lantern glow at the bow
    const g = ctx.createRadialGradient(34, -18, 0, 34, -18, 64);
    g.addColorStop(0, 'rgba(255,190,95,0.6)'); g.addColorStop(1, 'rgba(255,190,95,0)');
    ctx.fillStyle = g; ctx.fillRect(-30, -82, 130, 100);
  }
  // ---- BIRCH-BARK ANISHINAABE CANOE ----
  //   Longer hull, sharply upturned stem/stern, warm birch-bark tone with the
  //   characteristic dark horizontal stripes, decorative red bow band, lashed
  //   ribbing inside. Holds three paddlers.
  ctx.beginPath();
  ctx.moveTo(-62, -2);
  ctx.quadraticCurveTo(-74, -22, -56, -18);                                 // sharply upturned stern
  ctx.quadraticCurveTo(0, -7, 56, -18);                                       // sweeping sheer line
  ctx.quadraticCurveTo(74, -22, 62, -2);                                      // upturned bow
  ctx.quadraticCurveTo(0, 22, -62, -2);                                       // bottom curve
  ctx.closePath();
  const hullG = ctx.createLinearGradient(0, -18, 0, 22);
  hullG.addColorStop(0, '#e3b07a');                                           // warm birch bark
  hullG.addColorStop(0.45, '#a5703e');
  hullG.addColorStop(1, '#3e2410');
  ctx.fillStyle = hullG; ctx.fill();
  // dark birch-bark horizontal stripes — distinctive look of real birch bark
  ctx.strokeStyle = 'rgba(60,36,20,0.45)'; ctx.lineWidth = 0.7;
  for (let yb = -12; yb <= 14; yb += 3) {
    ctx.beginPath();
    ctx.moveTo(-58, yb + Math.sin(yb * 0.4) * 0.5);
    ctx.quadraticCurveTo(0, yb + 4, 58, yb + Math.sin(yb * 0.4) * 0.5);
    ctx.stroke();
  }
  // gunwale strip (lighter wood band along the rim)
  ctx.strokeStyle = 'rgba(244,206,150,0.95)'; ctx.lineWidth = 2.0; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-56, -16); ctx.quadraticCurveTo(0, -5, 56, -16); ctx.stroke();
  // warm rim-light along the sun-side gunwale
  ctx.strokeStyle = 'rgba(255,222,166,0.7)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(rim * 10, -8); ctx.quadraticCurveTo(rim * 56, -14, rim * 60, -3); ctx.stroke();
  // ribs (inner cedar ribs visible above the gunwale)
  ctx.strokeStyle = 'rgba(96,58,30,0.7)'; ctx.lineWidth = 0.9;
  for (let rb = -44; rb <= 44; rb += 8) {
    ctx.beginPath();
    ctx.moveTo(rb, -10); ctx.quadraticCurveTo(rb * 0.4, 6, rb * 0.95, 12); ctx.stroke();
  }
  // decorative red bands at bow and stern + a centred medallion (traditional)
  ctx.fillStyle = 'rgba(176,52,30,0.95)';
  ctx.fillRect(48, -19, 14, 3);
  ctx.fillRect(-62, -19, 14, 3);
  ctx.fillStyle = 'rgba(240,222,180,0.95)';
  ctx.beginPath(); ctx.arc(56, -17.5, 1.4, 0, 6.283); ctx.fill();
  ctx.beginPath(); ctx.arc(-56, -17.5, 1.4, 0, 6.283); ctx.fill();
  // a horizontal BEADWORK-STYLE pattern band along the mid-hull: alternating
  // cream + red diamonds, the kind of geometric trim seen on real Anishinaabe
  // birch-bark canoes. Subtle but adds the colour Hassan wanted on the canoe itself.
  const beadY = 4;
  for (let bx2 = -50; bx2 <= 50; bx2 += 6) {
    const isRed = ((bx2 + 50) / 6) % 2 < 1;
    ctx.fillStyle = isRed ? 'rgba(176,52,30,0.85)' : 'rgba(240,222,180,0.85)';
    ctx.beginPath();
    ctx.moveTo(bx2, beadY - 1.6);
    ctx.lineTo(bx2 + 3, beadY);
    ctx.lineTo(bx2, beadY + 1.6);
    ctx.lineTo(bx2 - 3, beadY);
    ctx.closePath(); ctx.fill();
  }
  // thin dark line beneath the bead band so it reads as trim, not noise
  ctx.strokeStyle = 'rgba(40,22,12,0.55)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(-52, beadY + 2.4); ctx.quadraticCurveTo(0, beadY + 3.6, 52, beadY + 2.4); ctx.stroke();
  // stitched seam (faint dark line where bark sheets are sewn with spruce root)
  ctx.strokeStyle = 'rgba(40,22,12,0.6)'; ctx.lineWidth = 0.6;
  ctx.setLineDash([1.5, 1.8]);
  ctx.beginPath(); ctx.moveTo(-58, -1); ctx.quadraticCurveTo(0, 6, 58, -1); ctx.stroke();
  ctx.setLineDash([]);
  // bow lantern pole + lantern
  if (night) {
    ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(40, -6); ctx.lineTo(40, -18); ctx.stroke();
    ctx.fillStyle = '#ffce7a'; ctx.beginPath(); ctx.arc(40, -21, 3.4, 0, 6.283); ctx.fill();
  }
  // --- THREE PADDLERS seated in the canoe — staggered along its length,
  //     each in a different ribbon-shirt colour, paddling on alternating sides.
  const skin = '#b7855a';
  // Three paddlers in matched dark-red ribbon shirts (Hassan: the canoe
  // itself can carry the colour; the paddlers should look unified, not
  // dressed in three different bright shirts). Hair varies subtly only.
  const PADDLER_SHIRT = '#7d1f15';
  const crew = [
    { x: -34, shirt: PADDLER_SHIRT, hair: 'braid', side: -1, phase: 0.0 },
    { x:   0, shirt: PADDLER_SHIRT, hair: 'feather', side: 1, phase: 0.55 },
    { x:  34, shirt: PADDLER_SHIRT, hair: 'long', side: -1, phase: 1.1 },
  ];
  crew.forEach((pdl) => {
    const stroke = Math.sin(tt * 2.1 + pdl.phase);
    const localSide = stroke >= 0 ? pdl.side : -pdl.side;
    const lean = localSide * 0.08 * Math.abs(stroke);
    ctx.save(); ctx.translate(pdl.x, 0); ctx.rotate(lean);
    const gun = -12;
    // torso (ribbon shirt with cream stripe)
    ctx.fillStyle = pdl.shirt;
    ctx.beginPath();
    ctx.moveTo(-6, gun); ctx.lineTo(-5, -19);
    ctx.quadraticCurveTo(0, -22, 5, -19); ctx.lineTo(6, gun);
    ctx.quadraticCurveTo(0, gun + 2, -6, gun); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(245,232,200,0.85)'; ctx.fillRect(-5.6, -16, 11.2, 0.9);
    ctx.fillStyle = 'rgba(20,12,8,0.45)'; ctx.fillRect(-5.6, -14.8, 11.2, 0.5);
    // shoulders
    ctx.lineCap = 'round'; ctx.lineWidth = 4.2; ctx.strokeStyle = pdl.shirt;
    ctx.beginPath(); ctx.moveTo(-6, -19); ctx.lineTo(6, -19); ctx.stroke();
    // neck + head
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.moveTo(-1.6, -19); ctx.lineTo(1.6, -19); ctx.lineTo(1.3, -22); ctx.lineTo(-1.3, -22); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -26, 4.2, 0, 6.283); ctx.fill();
    // hair
    ctx.fillStyle = '#1a0e08';
    ctx.beginPath(); ctx.arc(0, -26.4, 4.4, Math.PI + 0.25, 2 * Math.PI - 0.25); ctx.fill();
    if (pdl.hair === 'braid') {
      ctx.strokeStyle = '#1a0e08'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-2, -24); ctx.quadraticCurveTo(-4, -19, -3, -14); ctx.stroke();
    } else if (pdl.hair === 'feather') {
      ctx.strokeStyle = '#f4e6c2'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-1, -30); ctx.lineTo(-2, -36); ctx.stroke();
      ctx.fillStyle = '#cc8a3a'; ctx.fillRect(-4, -30.5, 8, 0.7);
    } else if (pdl.hair === 'long') {
      ctx.fillStyle = '#1a0e08';
      ctx.beginPath();
      ctx.moveTo(-4.2, -26); ctx.quadraticCurveTo(-5, -22, -3, -18); ctx.lineTo(3, -18);
      ctx.quadraticCurveTo(5, -22, 4.2, -26); ctx.closePath(); ctx.fill();
    }
    // rim light on the lit side
    ctx.strokeStyle = 'rgba(255,210,150,0.55)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, -26, 4.2, rim < 0 ? 1.9 : -1.2, rim < 0 ? 4.4 : 1.3); ctx.stroke();
    // paddle — held in both hands, blade dipping on `localSide`
    const topGrip = [localSide * -2, -20];
    const bladeTip = [localSide * (40 + 4 * Math.abs(stroke)), 8 + 5 * Math.abs(stroke)];
    const lowGrip = [topGrip[0] + (bladeTip[0] - topGrip[0]) * 0.42, topGrip[1] + (bladeTip[1] - topGrip[1]) * 0.42];
    ctx.strokeStyle = '#6b4626'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(topGrip[0], topGrip[1]); ctx.lineTo(bladeTip[0], bladeTip[1]); ctx.stroke();
    ctx.strokeStyle = skin; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(localSide * -5, -18); ctx.lineTo(topGrip[0], topGrip[1]); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(localSide * 5, -18); ctx.lineTo(lowGrip[0], lowGrip[1]); ctx.stroke();
    ctx.save(); ctx.translate(bladeTip[0], bladeTip[1]); ctx.rotate(Math.atan2(bladeTip[1] - topGrip[1], bladeTip[0] - topGrip[0]));
    ctx.fillStyle = '#7a5230'; ctx.beginPath(); ctx.ellipse(4, 0, 6.5, 2.8, 0, 0, 6.283); ctx.fill();
    // dark grain stripe along the paddle blade
    ctx.strokeStyle = 'rgba(40,22,12,0.7)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(8, 0); ctx.stroke();
    ctx.restore();
    ctx.restore();
  });
  ctx.restore();
  // ripple where the paddle dips
  if (Math.abs(strokeT) > 0.9) {
    ctx.strokeStyle = 'rgba(245,248,240,0.22)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(cx + padSide * 22 * scl, cy + 6 * scl, 7 * scl, 2.6 * scl, 0, 0, 6.283); ctx.stroke();
  }

  // ============================================================================
  // FOREGROUND VILLAGE — a near shore on the lower-right where the lake meets the
  //   land. The community works by day and gathers at the fire by night, crossfading
  //   smoothly as the sun goes down. Self-contained block (easy to revert).
  // ============================================================================
  {
    const nm = _smooth(0.52, 0.9, p);                     // nightness 0..1
    const lx0 = W * 0.52;                                  // shore begins earlier so there is more village land
    const RISE = H * 0.22;                                  // taller bank (was 0.16) — more room for activity
    const shoreY = (x) => { const t = _clamp((x - lx0) / (W - lx0), 0, 1); return H - 6 - RISE * (t * 0.6 + t * t * 0.4); };
    const ground = (x) => shoreY(x) + 9;
    // land bank
    const et = [Math.round(_lerp(74, 32, nm)), Math.round(_lerp(82, 40, nm)), Math.round(_lerp(50, 28, nm))];
    const eb = [Math.round(_lerp(42, 17, nm)), Math.round(_lerp(48, 22, nm)), Math.round(_lerp(28, 14, nm))];
    const lgr = ctx.createLinearGradient(0, H * 0.78, 0, H);
    lgr.addColorStop(0, `rgb(${et.join(',')})`); lgr.addColorStop(1, `rgb(${eb.join(',')})`);
    ctx.fillStyle = lgr;
    ctx.beginPath(); ctx.moveTo(lx0, H);
    for (let x = lx0; x <= W; x += 10) ctx.lineTo(x, shoreY(x));
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    // a paler sandy strip + lit waterline blend the lake into the land
    ctx.save(); ctx.globalAlpha = 0.5; ctx.lineCap = 'round';
    ctx.strokeStyle = `rgb(${Math.round(_lerp(120, 58, nm))},${Math.round(_lerp(112, 54, nm))},${Math.round(_lerp(84, 40, nm))})`;
    ctx.lineWidth = 4; ctx.beginPath();
    for (let x = lx0; x <= W; x += 8) { const y = shoreY(x) + 3 + Math.sin(x * 0.05 + tt * 1.5) * 1.2; x === lx0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke(); ctx.restore();
    const hzc = _rampA(SKY_HORIZ, p);
    ctx.strokeStyle = `rgba(${hzc[0]},${hzc[1]},${hzc[2]},0.28)`; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let x = lx0; x <= W; x += 8) { const y = shoreY(x) + Math.sin(x * 0.05 + tt * 1.5) * 1.2; x === lx0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
    // (Removed the tall blade/sweetgrass strokes — they read as seaweed.
    //  The bank now has only the cattails + wild rice + low ground tone.)
    // ---- BULL RUSH (cattail) stand on the bank: tall stems with sausage-shaped
    //   brown seed-heads. A signature Anishinaabe-territory wetland plant. ----
    const cattailClumps = [[W * 0.68, 5], [W * 0.755, 4], [W * 0.86, 6]];
    cattailClumps.forEach(([cxC, n], ci) => {
      for (let k = 0; k < n; k++) {
        const sx0 = cxC + (k - n / 2) * 6 + Math.sin(ci + k) * 2;
        const gy = ground(sx0);
        const tall = 28 + (k % 3) * 5;
        const sway = Math.sin(tt * 1.3 + k * 0.7 + ci) * 3;
        // stem
        ctx.strokeStyle = `rgba(${Math.round(_lerp(78, 38, nm))},${Math.round(_lerp(104, 52, nm))},${Math.round(_lerp(44, 22, nm))},0.95)`;
        ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.beginPath();
        ctx.moveTo(sx0, gy); ctx.quadraticCurveTo(sx0 + sway * 0.4, gy - tall * 0.6, sx0 + sway, gy - tall); ctx.stroke();
        // brown sausage seed-head
        ctx.fillStyle = `rgb(${Math.round(_lerp(96, 48, nm))},${Math.round(_lerp(58, 30, nm))},${Math.round(_lerp(24, 14, nm))})`;
        ctx.beginPath(); ctx.ellipse(sx0 + sway, gy - tall + 4, 1.7, 6, 0, 0, 6.283); ctx.fill();
        // tip spike
        ctx.strokeStyle = `rgba(${Math.round(_lerp(78, 38, nm))},${Math.round(_lerp(104, 52, nm))},${Math.round(_lerp(44, 22, nm))},0.95)`;
        ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(sx0 + sway, gy - tall + 2); ctx.lineTo(sx0 + sway, gy - tall - 4); ctx.stroke();
        // a long thin leaf curving up alongside
        if (k % 2 === 0) {
          ctx.strokeStyle = `rgba(${Math.round(_lerp(86, 40, nm))},${Math.round(_lerp(118, 58, nm))},${Math.round(_lerp(52, 26, nm))},0.9)`;
          ctx.lineWidth = 1.3; ctx.beginPath();
          ctx.moveTo(sx0 - 1, gy); ctx.quadraticCurveTo(sx0 - 6 + sway * 0.3, gy - tall * 0.5, sx0 - 2 + sway, gy - tall * 0.9); ctx.stroke();
        }
      }
    });
    // ---- WILD RICE (manoomin) growing along the water's edge: clusters of
    //   tall slender stems with feathery seed-heads. Traditional Anishinaabe food. ----
    const ricePatches = [[W * 0.80, 8], [W * 0.88, 7], [W * 0.93, 6]];
    ricePatches.forEach(([cxR, n], ri) => {
      for (let k = 0; k < n; k++) {
        const sx0 = cxR + (k - n / 2) * 4.5 + Math.sin(ri * 2 + k) * 1.6;
        const gy = ground(sx0);
        const tall = 18 + (k % 4) * 4;
        const sway = Math.sin(tt * 1.7 + k * 0.55 + ri * 1.3) * 2.4;
        // slender stem
        ctx.strokeStyle = `rgba(${Math.round(_lerp(110, 48, nm))},${Math.round(_lerp(126, 64, nm))},${Math.round(_lerp(58, 28, nm))},0.85)`;
        ctx.lineWidth = 0.9; ctx.lineCap = 'round'; ctx.beginPath();
        ctx.moveTo(sx0, gy); ctx.quadraticCurveTo(sx0 + sway * 0.5, gy - tall * 0.6, sx0 + sway, gy - tall); ctx.stroke();
        // feathery seed-head — a soft fan of fine lines
        ctx.strokeStyle = `rgba(${Math.round(_lerp(178, 96, nm))},${Math.round(_lerp(156, 80, nm))},${Math.round(_lerp(86, 44, nm))},0.85)`;
        ctx.lineWidth = 0.7;
        for (let f = -2; f <= 2; f++) {
          ctx.beginPath();
          ctx.moveTo(sx0 + sway, gy - tall);
          ctx.lineTo(sx0 + sway + f * 1.4, gy - tall - 5 - Math.abs(f) * 0.5);
          ctx.stroke();
        }
      }
    });
    // ---- a fish-drying rack with fish strung up (shoreline work) ----
    const dx = W * 0.74, dyy = ground(dx);
    ctx.strokeStyle = 'rgba(34,24,14,1)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(dx - 18, dyy); ctx.lineTo(dx - 18, dyy - 22); ctx.moveTo(dx + 18, dyy); ctx.lineTo(dx + 18, dyy - 22); ctx.moveTo(dx - 21, dyy - 22); ctx.lineTo(dx + 21, dyy - 22); ctx.stroke();
    ctx.fillStyle = 'rgba(122,92,62,1)';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(dx - 15 + i * 6, dyy - 14, 2, 4.4, 0, 0, 6.283); ctx.fill(); }
    // ---- a HIDE-STRETCHING FRAME with a moose/deer hide tied to it ----
    //   Traditional Anishinaabe day work: scraping & tanning a hide on a square
    //   wooden frame planted on the ground. A person works it (in the day block below).
    const hfx = W * 0.79, hfy = ground(hfx);
    ctx.strokeStyle = 'rgba(34,24,14,1)'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    // four-poster frame
    ctx.beginPath();
    ctx.moveTo(hfx - 16, hfy); ctx.lineTo(hfx - 16, hfy - 28);
    ctx.moveTo(hfx + 16, hfy); ctx.lineTo(hfx + 16, hfy - 28);
    ctx.moveTo(hfx - 19, hfy - 28); ctx.lineTo(hfx + 19, hfy - 28);
    ctx.moveTo(hfx - 19, hfy - 4); ctx.lineTo(hfx + 19, hfy - 4);
    ctx.stroke();
    // the hide stretched across (warm tan / cream)
    const hideG = ctx.createLinearGradient(hfx, hfy - 28, hfx, hfy - 4);
    hideG.addColorStop(0, `rgb(${Math.round(_lerp(214, 110, nm))},${Math.round(_lerp(184, 96, nm))},${Math.round(_lerp(140, 70, nm))})`);
    hideG.addColorStop(1, `rgb(${Math.round(_lerp(170, 84, nm))},${Math.round(_lerp(138, 70, nm))},${Math.round(_lerp(96, 48, nm))})`);
    ctx.fillStyle = hideG;
    ctx.beginPath();
    ctx.moveTo(hfx - 14, hfy - 26);
    ctx.quadraticCurveTo(hfx, hfy - 28, hfx + 14, hfy - 26);
    ctx.quadraticCurveTo(hfx + 16, hfy - 16, hfx + 12, hfy - 6);
    ctx.quadraticCurveTo(hfx, hfy - 4, hfx - 12, hfy - 6);
    ctx.quadraticCurveTo(hfx - 16, hfy - 16, hfx - 14, hfy - 26);
    ctx.closePath(); ctx.fill();
    // sinew lashings around the edge (small ticks)
    ctx.strokeStyle = 'rgba(40,24,12,0.7)'; ctx.lineWidth = 0.6;
    for (let ti = 0; ti < 6; ti++) {
      const tx = hfx - 13 + ti * 5;
      ctx.beginPath(); ctx.moveTo(tx, hfy - 27); ctx.lineTo(tx, hfy - 29); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tx, hfy - 3); ctx.lineTo(tx, hfy - 5); ctx.stroke();
    }
    // ---- a SMOKEHOUSE: low conical bark structure with smoke rising from the top
    //   (used to smoke fish — a signature Anishinaabe activity on the lake) ----
    const smx = W * 0.88, smy = ground(smx);
    // bark cone
    ctx.fillStyle = `rgb(${Math.round(_lerp(86, 42, nm))},${Math.round(_lerp(58, 28, nm))},${Math.round(_lerp(34, 16, nm))})`;
    ctx.beginPath();
    ctx.moveTo(smx - 12, smy);
    ctx.quadraticCurveTo(smx, smy - 26, smx + 12, smy);
    ctx.closePath(); ctx.fill();
    // horizontal bark seams
    ctx.strokeStyle = 'rgba(20,12,6,0.4)'; ctx.lineWidth = 0.7;
    for (let bs = -22; bs <= -6; bs += 5) {
      ctx.beginPath();
      ctx.moveTo(smx - 11 * (1 + bs / 30), smy + bs * 0.5);
      ctx.quadraticCurveTo(smx, smy + bs * 0.4, smx + 11 * (1 + bs / 30), smy + bs * 0.5);
      ctx.stroke();
    }
    // a small dark opening at the front
    ctx.fillStyle = 'rgba(8,6,4,1)';
    ctx.beginPath(); ctx.ellipse(smx, smy - 1, 3.4, 2.0, 0, Math.PI, 2 * Math.PI); ctx.fill();
    // smoke billowing up from the apex
    if (nm < 0.95) {
      ctx.save(); ctx.globalAlpha = (1 - nm * 0.7) * 0.55;
      ctx.strokeStyle = 'rgba(214,210,200,1)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let s = 0; s <= 15; s++) {
        const sy = smy - 26 - s * 5;
        const sx = smx + Math.sin(s * 0.55 + tt * 1.0) * (2 + s * 0.7);
        s === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      }
      ctx.stroke(); ctx.restore();
    }
    // ---- a WILD-RICE POUNDING MORTAR: a tall wooden bucket with a long pestle
    //   that someone strikes down into it (manoomin processing). The pestle
    //   animates up & down for life. ----
    const wmx = W * 0.555, wmy = ground(wmx);
    ctx.fillStyle = `rgb(${Math.round(_lerp(96, 48, nm))},${Math.round(_lerp(64, 32, nm))},${Math.round(_lerp(34, 16, nm))})`;
    // mortar (tapered tall bucket)
    ctx.beginPath();
    ctx.moveTo(wmx - 5, wmy);
    ctx.lineTo(wmx - 6, wmy - 14);
    ctx.lineTo(wmx + 6, wmy - 14);
    ctx.lineTo(wmx + 5, wmy);
    ctx.closePath(); ctx.fill();
    // dark mouth
    ctx.fillStyle = 'rgba(10,6,4,1)';
    ctx.beginPath(); ctx.ellipse(wmx, wmy - 14, 6, 1.4, 0, 0, 6.283); ctx.fill();
    // pestle (long pole, strikes down rhythmically)
    const pound = Math.abs(Math.sin(tt * 2.6));
    const peY = wmy - 28 + pound * 12;                                  // up/down stroke
    ctx.strokeStyle = `rgb(${Math.round(_lerp(80, 40, nm))},${Math.round(_lerp(50, 24, nm))},${Math.round(_lerp(26, 12, nm))})`;
    ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(wmx, peY); ctx.lineTo(wmx, peY - 32); ctx.stroke();
    // little puff of rice dust on each strike
    if (pound > 0.85) {
      ctx.fillStyle = `rgba(220,206,168,${(pound - 0.85) * 4 * (1 - nm * 0.6)})`;
      ctx.beginPath(); ctx.ellipse(wmx, wmy - 14, 8, 2.4, 0, 0, 6.283); ctx.fill();
    }
    // ---- a ceremonial drum on a low stand near the fire (Anishinaabe day activity) ----
    const drx = W * 0.595, dry = ground(drx) + 4;
    ctx.fillStyle = `rgba(${Math.round(_lerp(108, 52, nm))},${Math.round(_lerp(68, 32, nm))},${Math.round(_lerp(34, 16, nm))},1)`;
    ctx.beginPath(); ctx.ellipse(drx, dry, 7, 4.4, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = `rgba(${Math.round(_lerp(192, 96, nm))},${Math.round(_lerp(172, 84, nm))},${Math.round(_lerp(132, 62, nm))},1)`;
    ctx.beginPath(); ctx.ellipse(drx, dry - 1, 6.4, 3.6, 0, 0, 6.283); ctx.fill();
    // village fire
    const fx = W * 0.625, fy = ground(fx) + 6, fa = 0.45 + 0.55 * nm;
    const gl = ctx.createRadialGradient(fx, fy - 6, 0, fx, fy - 6, 64 * (0.6 + nm));
    gl.addColorStop(0, `rgba(255,162,82,${0.34 * fa})`); gl.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = gl; ctx.fillRect(fx - 80, fy - 80, 160, 110);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const fcols = ['255,110,34', '255,165,58', '255,224,130'];
    for (let i = 0; i < 3; i++) {
      const fw = (7.5 - i * 1.9) * (0.7 + 0.6 * nm), fh = (18 - i * 3.4) * (0.7 + 0.6 * nm) * (0.8 + 0.3 * Math.sin(tt * (9 + i * 4) + i));
      ctx.fillStyle = `rgba(${fcols[i]},${0.8 * fa})`;
      ctx.beginPath(); ctx.moveTo(fx - fw, fy);
      ctx.quadraticCurveTo(fx - fw * 0.5 + Math.sin(tt * 8 + i) * 2, fy - fh * 0.6, fx, fy - fh);
      ctx.quadraticCurveTo(fx + fw * 0.5 + Math.sin(tt * 8 + i + 2) * 2, fy - fh * 0.6, fx + fw, fy);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    if (nm < 0.95) {
      // a wispier, longer string of smoke curling up from the fire — translucent, layered
      ctx.save();
      const smokeA = (1 - nm * 0.6) * 0.7;
      for (let pass = 0; pass < 3; pass++) {
        ctx.globalAlpha = smokeA * (0.55 - pass * 0.13);
        ctx.strokeStyle = `rgba(${210 - pass * 8},${204 - pass * 8},${192 - pass * 8},1)`;
        ctx.lineWidth = 4 - pass * 0.9; ctx.lineCap = 'round'; ctx.beginPath();
        for (let s = 0; s <= 22; s++) {
          const sy = fy - 9 - s * 6.5 - pass * 2;
          const drift = Math.sin(s * 0.42 + tt * 0.9 + pass * 0.6) * (3 + s * 0.95);
          const sx = fx + drift + s * 0.7;
          s === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    // --- PEOPLE: more human (head, tapered torso, legs/arms), animated ---
    // -------- VILLAGER (proper clothed person, not a black stick figure) -----
    // Each villager has: skin head, hair (with options for braid / headband / feather),
    // ribbon-shirt torso (varied colour), tan leggings, and animated arms+legs.
    // `opt` carries per-person style so they don't all look identical.
    const RIBBON = ['#c93a1e', '#1f4e8f', '#d68a1f', '#5a7d3a', '#7c2f6b', '#b04a2a'];
    const fig = (px, py, sc, kind, ph, opt) => {
      opt = opt || {};
      const dir = opt.dir || 1;                                // facing 1=right, -1=left
      const skin = opt.skin || '#a3704a';
      const hair = opt.hair || '#1a0e08';
      const shirt = opt.shirt || RIBBON[Math.abs(Math.floor(ph * 7)) % RIBBON.length];
      const leg = opt.leg || '#6b4a2a';
      const boot = '#2a1808';
      const bh = 18 * sc;                                       // taller person (was 14)
      const headR = 2.7 * sc;
      const hipY = py - bh * 0.40;
      const shoulderY = py - bh * 0.82;
      const headCY = py - bh * 0.96 - headR * 1.0;

      // walking gait: opposing legs, swinging arms
      const gait = (kind === 'walk') ? Math.sin(tt * 3.6 + ph) : 0;
      const armSwing = gait * 0.55;
      const legL = gait * 3.2 * sc;
      const legR = -legL;
      const bodyBob = Math.sin(tt * 1.4 + ph) * 0.4 * sc + (kind === 'walk' ? Math.abs(gait) * 0.6 * sc : 0);

      // helper to stroke a limb with width
      const limb = (x0, y0, x1, y1, w, color) => {
        ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      };

      // ---- LEGS (tan leggings + dark moccasins) ----
      if (kind !== 'sit') {
        limb(px - 1.6 * sc, hipY - bodyBob, px - 1.6 * sc + legL, py - bodyBob, 3.0 * sc, leg);
        limb(px + 1.6 * sc, hipY - bodyBob, px + 1.6 * sc + legR, py - bodyBob, 3.0 * sc, leg);
        // moccasins
        ctx.fillStyle = boot;
        ctx.beginPath(); ctx.ellipse(px - 1.6 * sc + legL, py - bodyBob, 1.7 * sc, 0.9 * sc, 0, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.ellipse(px + 1.6 * sc + legR, py - bodyBob, 1.7 * sc, 0.9 * sc, 0, 0, 6.283); ctx.fill();
      } else {
        // cross-legged seated: knees pointing forward, feet tucked
        ctx.fillStyle = leg;
        ctx.beginPath(); ctx.ellipse(px - 2.4 * sc, hipY + 2 * sc, 3.4 * sc, 2 * sc, 0, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.ellipse(px + 2.4 * sc, hipY + 2 * sc, 3.4 * sc, 2 * sc, 0, 0, 6.283); ctx.fill();
      }

      // ---- TORSO: ribbon shirt with a contrast hem ----
      const torsoX = px, torsoY = (kind === 'sit') ? hipY - 1 * sc : hipY - bodyBob;
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.moveTo(torsoX - 4.0 * sc, torsoY);                                     // hip L
      ctx.lineTo(torsoX - 3.4 * sc, shoulderY - bodyBob);                          // L side up to shoulder
      ctx.quadraticCurveTo(torsoX, shoulderY - bodyBob - 1.2 * sc,
                           torsoX + 3.4 * sc, shoulderY - bodyBob);                // shoulder top
      ctx.lineTo(torsoX + 4.0 * sc, torsoY);                                       // hip R
      ctx.quadraticCurveTo(torsoX, torsoY + 0.6 * sc, torsoX - 4.0 * sc, torsoY);   // hem curve
      ctx.closePath(); ctx.fill();
      // ribbon stripes — a thin contrasting band across the chest
      ctx.fillStyle = 'rgba(245,232,200,0.85)';
      ctx.fillRect(torsoX - 3.6 * sc, shoulderY - bodyBob + 3.2 * sc, 7.2 * sc, 0.7 * sc);
      ctx.fillStyle = 'rgba(20,12,8,0.45)';
      ctx.fillRect(torsoX - 3.6 * sc, shoulderY - bodyBob + 4.2 * sc, 7.2 * sc, 0.4 * sc);

      // ---- ARMS (in skin tone) + activity hand ----
      const sArmY = shoulderY - bodyBob + 1.2 * sc;
      // base resting arm positions
      const bArmAng = (kind === 'walk') ? armSwing : Math.sin(tt * 1.3 + ph) * 0.15;
      // left arm (back-swing in walk)
      limb(torsoX - 3.4 * sc, sArmY,
           torsoX - 3.4 * sc - Math.sin(bArmAng) * 5 * sc,
           sArmY + 6 * sc + Math.cos(bArmAng) * 1.5 * sc,
           2.4 * sc, skin);
      // right arm — driven by activity
      let rArmEndX = torsoX + 3.4 * sc + Math.sin(-bArmAng) * 5 * sc;
      let rArmEndY = sArmY + 6 * sc + Math.cos(-bArmAng) * 1.5 * sc;
      if (kind === 'stir') {
        const a = Math.sin(tt * 3 + ph) * 0.6 - 0.3;
        rArmEndX = torsoX + (5 + Math.cos(a) * 4) * sc;
        rArmEndY = sArmY + (3 + Math.sin(a) * 4) * sc;
      } else if (kind === 'hang') {
        const a = Math.sin(tt * 1.6 + ph) * 0.25 - 1.15;
        rArmEndX = torsoX + 7 * sc * Math.cos(a);
        rArmEndY = sArmY + 7 * sc * Math.sin(a);
      } else if (kind === 'wave') {
        const a = -1.3 + Math.sin(tt * 3 + ph) * 0.25;
        rArmEndX = torsoX + 6 * sc * Math.cos(a);
        rArmEndY = sArmY + 6 * sc * Math.sin(a);
      } else if (kind === 'carry') {
        rArmEndX = torsoX + 4 * sc; rArmEndY = sArmY + 2 * sc;
        // a basket held in front
        ctx.fillStyle = '#6b4824';
        ctx.beginPath(); ctx.ellipse(torsoX + 5 * sc, sArmY + 4 * sc, 3.2 * sc, 2.2 * sc, 0, 0, 6.283); ctx.fill();
        ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 0.6;
        for (let bw = -2.4; bw <= 2.4; bw += 0.8) {
          ctx.beginPath(); ctx.moveTo(torsoX + 5 * sc + bw * sc, sArmY + 2 * sc); ctx.lineTo(torsoX + 5 * sc + bw * sc, sArmY + 6 * sc); ctx.stroke();
        }
      } else if (kind === 'drum') {
        // both hands striking the drum
        const beat = Math.abs(Math.sin(tt * 4 + ph));
        rArmEndX = torsoX + 4 * sc; rArmEndY = sArmY + (5 - beat * 2.5) * sc;
        limb(torsoX - 3.4 * sc, sArmY, torsoX - 3 * sc, sArmY + (5 - Math.abs(Math.cos(tt * 4 + ph)) * 2.5) * sc, 2.4 * sc, skin);
      }
      limb(torsoX + 3.4 * sc, sArmY, rArmEndX, rArmEndY, 2.4 * sc, skin);

      // ---- HEAD ----
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(px, headCY - bodyBob, headR, 0, 6.283); ctx.fill();
      // jaw shading
      ctx.fillStyle = 'rgba(80,46,24,0.35)';
      ctx.beginPath(); ctx.arc(px - 0.4 * sc * dir, headCY - bodyBob + 0.7 * sc, headR * 0.92, 0.3, 2.9); ctx.fill();

      // ---- HAIR (with options) ----
      ctx.fillStyle = hair;
      // crown / cap
      ctx.beginPath(); ctx.arc(px, headCY - bodyBob - 0.4 * sc, headR * 1.05, Math.PI + 0.25, 2 * Math.PI - 0.25); ctx.fill();
      if (opt.hairStyle === 'braid') {
        // a single long braid down the back
        ctx.strokeStyle = hair; ctx.lineWidth = 1.6 * sc; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px - dir * headR * 0.6, headCY - bodyBob + headR * 0.3);
        ctx.quadraticCurveTo(px - dir * headR * 1.4, headCY - bodyBob + headR * 2.4, px - dir * headR * 1.2, headCY - bodyBob + headR * 4.0);
        ctx.stroke();
      } else if (opt.hairStyle === 'feather') {
        // a single eagle feather rising from a headband
        ctx.strokeStyle = '#f4e6c2'; ctx.lineWidth = 0.8 * sc;
        ctx.beginPath(); ctx.moveTo(px - dir * 0.5 * sc, headCY - bodyBob - headR * 0.8);
        ctx.lineTo(px - dir * 1.6 * sc, headCY - bodyBob - headR * 2.6); ctx.stroke();
        ctx.fillStyle = '#cc8a3a';
        ctx.fillRect(px - headR, headCY - bodyBob - headR * 0.9, headR * 2, 0.7 * sc);
      } else if (opt.hairStyle === 'long') {
        // long hair past the shoulders
        ctx.fillStyle = hair;
        ctx.beginPath();
        ctx.moveTo(px - headR, headCY - bodyBob);
        ctx.quadraticCurveTo(px - headR * 1.3, headCY - bodyBob + headR * 2, px - headR * 0.6, headCY - bodyBob + headR * 3.4);
        ctx.lineTo(px + headR * 0.6, headCY - bodyBob + headR * 3.4);
        ctx.quadraticCurveTo(px + headR * 1.3, headCY - bodyBob + headR * 2, px + headR, headCY - bodyBob);
        ctx.closePath(); ctx.fill();
      }
    };
    if (nm < 0.98) {
      ctx.save(); ctx.globalAlpha = 1 - nm;
      // ---- a LARGER, livelier village: more people, more variety, no lockstep ----
      //   Each villager carries its own phase + style options so they don't move
      //   in identical sync and don't all look the same.
      fig(fx + 16, ground(fx + 16) + 6, 1.45, 'stir', 0.0, { shirt: '#c93a1e', hairStyle: 'long' });
      fig(fx - 24, ground(fx - 24) + 6, 1.35, 'sit', 1.7, { shirt: '#1f4e8f', hairStyle: 'braid', dir: -1 });
      fig(dx - 2, dyy + 6, 1.4, 'hang', 1.2, { shirt: '#d68a1f', hairStyle: 'braid' });
      fig(dx + 18, dyy + 6, 1.3, 'hang', 4.0, { shirt: '#5a7d3a' });
      fig(W * 0.78, ground(W * 0.78) + 7, 1.35, 'walk', 2.4, { shirt: '#b04a2a', hairStyle: 'long' });
      fig(W * 0.715, ground(W * 0.715) + 7, 1.4, 'walk', 5.1, { shirt: '#7c2f6b', hairStyle: 'feather', dir: -1 });
      fig(W * 0.81, ground(W * 0.81) + 7, 1.25, 'carry', 2.0, { shirt: '#1f4e8f', hairStyle: 'braid' });
      fig(W * 0.66, ground(W * 0.66) + 6, 1.3, 'wave', 3.3, { shirt: '#d68a1f', hairStyle: 'feather' });
      fig(W * 0.92, ground(W * 0.92) + 7, 1.25, 'walk', 0.9, { shirt: '#5a7d3a', hairStyle: 'long', dir: -1 });
      fig(W * 0.94, ground(W * 0.94) + 7, 1.1, 'walk', 5.7, { shirt: '#c93a1e', hairStyle: 'braid', dir: -1 });
      // a person SCRAPING THE HIDE on the stretching frame (real activity)
      fig(hfx - 22, hfy + 6, 1.35, 'stir', 2.3, { shirt: '#b04a2a', hairStyle: 'braid' });
      // a person POUNDING WILD RICE at the mortar (manoomin processing)
      fig(wmx + 6, wmy + 6, 1.35, 'stir', 4.4, { shirt: '#1f4e8f', hairStyle: 'long', dir: -1 });
      // a person at the smokehouse tending the fire
      fig(smx - 10, smy + 6, 1.25, 'stir', 0.8, { shirt: '#d68a1f', hairStyle: 'braid' });
      // a drummer seated at the ceremonial drum (rhythm of the day)
      const drumPx = drx - 4, drumPy = ground(drumPx) + 6;
      fig(drumPx, drumPy, 1.4, 'drum', 7, { shirt: '#7c2f6b', hairStyle: 'feather' });
      // a person fishing from the shore with a long pole reaching over the water
      const fshX = W * 0.83, fshY = ground(fshX) + 6;
      fig(fshX, fshY, 1.3, 'sit', 4, { shirt: '#1f4e8f', hairStyle: 'braid' });
      ctx.strokeStyle = 'rgba(46,32,18,1)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      const rodSway = Math.sin(tt * 1.1) * 1.4;
      ctx.beginPath(); ctx.moveTo(fshX + 2, fshY - 16); ctx.lineTo(fshX - 32 + rodSway, fshY - 6); ctx.stroke();
      ctx.strokeStyle = 'rgba(220,214,200,0.6)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(fshX - 32 + rodSway, fshY - 6); ctx.lineTo(fshX - 34 + rodSway, fshY + 6); ctx.stroke();
      ctx.restore();
      // ---- HORSES grazing on the bank (Anishinaabe communities have long
      //   kept horses — adds a real sign of life Hassan asked for) ----
      const drawHorse = (hx, hy, sc, ph, headDown) => {
        ctx.save(); ctx.globalAlpha = (1 - nm);
        const body = 'rgba(74,46,28,1)';
        const mane = 'rgba(28,16,8,1)';
        const sock = 'rgba(220,212,196,1)';
        const t = headDown ? 0.5 + 0.5 * Math.sin(tt * 0.6 + ph) : 0;       // graze dip
        const tail = Math.sin(tt * 1.8 + ph) * 1.2;
        // body
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(hx - 12 * sc, hy - 5 * sc);
        ctx.quadraticCurveTo(hx - 6 * sc, hy - 9 * sc, hx + 4 * sc, hy - 8 * sc);
        ctx.quadraticCurveTo(hx + 12 * sc, hy - 7 * sc, hx + 14 * sc, hy - 3 * sc);
        ctx.quadraticCurveTo(hx + 13 * sc, hy + 2 * sc, hx + 6 * sc, hy + 2 * sc);
        ctx.quadraticCurveTo(hx - 4 * sc, hy + 2 * sc, hx - 12 * sc, hy - 5 * sc);
        ctx.closePath(); ctx.fill();
        // legs (four)
        ctx.fillRect(hx - 9 * sc, hy + 1 * sc, 2.2 * sc, 9 * sc);
        ctx.fillRect(hx - 5 * sc, hy + 1 * sc, 2.2 * sc, 9 * sc);
        ctx.fillRect(hx + 6 * sc, hy + 1 * sc, 2.2 * sc, 9 * sc);
        ctx.fillRect(hx + 10 * sc, hy + 1 * sc, 2.2 * sc, 9 * sc);
        // white socks on the front legs
        ctx.fillStyle = sock;
        ctx.fillRect(hx + 6 * sc, hy + 7 * sc, 2.2 * sc, 3 * sc);
        ctx.fillRect(hx + 10 * sc, hy + 7 * sc, 2.2 * sc, 3 * sc);
        // tail
        ctx.strokeStyle = mane; ctx.lineWidth = 2.4 * sc; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hx - 11 * sc, hy - 4 * sc);
        ctx.quadraticCurveTo(hx - 16 * sc, hy - 2 * sc + tail, hx - 17 * sc, hy + 4 * sc + tail);
        ctx.stroke();
        // head + neck (dips when grazing)
        ctx.fillStyle = body;
        const hnx = hx + 14 * sc, hny = hy - 4 * sc + t * 8 * sc;
        ctx.beginPath();
        ctx.moveTo(hx + 12 * sc, hy - 7 * sc);
        ctx.quadraticCurveTo(hnx + 4 * sc, hny - 4 * sc, hnx + 8 * sc, hny);
        ctx.quadraticCurveTo(hnx + 10 * sc, hny + 3 * sc, hnx + 6 * sc, hny + 4 * sc);
        ctx.quadraticCurveTo(hx + 13 * sc, hy - 3 * sc, hx + 12 * sc, hy - 7 * sc);
        ctx.closePath(); ctx.fill();
        // mane (along the neck)
        ctx.strokeStyle = mane; ctx.lineWidth = 1.8 * sc;
        ctx.beginPath();
        ctx.moveTo(hx + 5 * sc, hy - 9 * sc);
        ctx.quadraticCurveTo(hx + 10 * sc, hy - 8 * sc, hnx + 2 * sc, hny - 3 * sc);
        ctx.stroke();
        // ear, eye, nostril
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.moveTo(hnx + 1 * sc, hny - 4 * sc); ctx.lineTo(hnx + 2 * sc, hny - 7 * sc); ctx.lineTo(hnx + 3 * sc, hny - 4 * sc); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.beginPath(); ctx.arc(hnx + 4 * sc, hny - 1.5 * sc, 0.5 * sc, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.arc(hnx + 8.5 * sc, hny + 1.5 * sc, 0.5 * sc, 0, 6.283); ctx.fill();
        ctx.restore();
      };
      drawHorse(W * 0.70, ground(W * 0.70) - 2, 0.85, 0.0, true);          // grazing
      drawHorse(W * 0.62, ground(W * 0.62) - 2, 0.75, 2.3, false);         // standing watch
      // ---- a LARGE BROWN/BLACK BEAR at the water's edge, fishing ----
      //   Scaled up ~2.4x so it actually reads as a bear. Multi-tone fur with
      //   highlight on the hump + belly shading, claws breaking the water,
      //   a thrashing salmon caught in its jaws, and a real splash plume.
      ctx.save(); ctx.globalAlpha = (1 - nm);
      const bx = W * 0.585, by = shoreY(bx) - 8;                          // moved further inland & up so the bear is unmissable
      const S = 3.6;                                                       // scale up dramatically (Hassan: still not visible)
      const lunge = (0.5 + 0.5 * Math.sin(tt * 0.9)) * 3.5;
      // rich brown-black fur with a warm undertone, so it doesn't blot black
      const furG = ctx.createLinearGradient(bx, by - 14 * S, bx, by + 14 * S);
      furG.addColorStop(0, 'rgba(70,46,28,1)');
      furG.addColorStop(0.45, 'rgba(46,30,18,1)');
      furG.addColorStop(1, 'rgba(22,14,8,1)');
      const furHi  = 'rgba(110,82,52,1)';                                  // rim/highlight
      const furMid = 'rgba(58,38,22,1)';
      // --- hind legs (planted in shallow water)
      ctx.fillStyle = furG;
      ctx.beginPath(); ctx.ellipse(bx + 11 * S, by + 8 * S, 4.6 * S, 8 * S, 0, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.ellipse(bx + 17 * S, by + 9 * S, 4.2 * S, 7.5 * S, 0.08, 0, 6.283); ctx.fill();
      // --- main body: arched back, deep chest, low belly, sloping to rump
      ctx.beginPath();
      ctx.moveTo(bx - 19 * S, by + 2 * S);
      ctx.quadraticCurveTo(bx - 15 * S, by - 6 * S, bx - 4 * S, by - 9 * S);     // shoulder up to hump
      ctx.quadraticCurveTo(bx + 4 * S, by - 13 * S, bx + 11 * S, by - 8 * S);    // top of hump
      ctx.quadraticCurveTo(bx + 22 * S, by - 4 * S, bx + 23 * S, by + 5 * S);    // rump
      ctx.quadraticCurveTo(bx + 19 * S, by + 11 * S, bx + 6 * S, by + 11 * S);   // belly
      ctx.quadraticCurveTo(bx - 8 * S, by + 11 * S, bx - 19 * S, by + 2 * S);
      ctx.closePath(); ctx.fill();
      // --- shoulder hump highlight (the bear silhouette tell)
      ctx.fillStyle = furHi;
      ctx.beginPath(); ctx.ellipse(bx + 4 * S, by - 10 * S, 8 * S, 3.6 * S, -0.15, 0, 6.283); ctx.fill();
      // --- belly shading (lighter brown underbelly)
      ctx.fillStyle = furMid;
      ctx.beginPath(); ctx.ellipse(bx + 4 * S, by + 8 * S, 11 * S, 3.2 * S, 0, 0, 6.283); ctx.fill();
      // soft fur texture: a few short dark strokes along the back
      ctx.strokeStyle = 'rgba(8,5,3,0.55)'; ctx.lineWidth = 0.9;
      for (let fx2 = -8; fx2 <= 18; fx2 += 3) {
        const ty = by - 11 * S + Math.sin(fx2 * 0.4) * 0.5 * S;
        ctx.beginPath(); ctx.moveTo(bx + fx2 * S, ty); ctx.lineTo(bx + fx2 * S - 0.6 * S, ty + 1.7 * S); ctx.stroke();
      }
      // --- front legs reaching down into the water
      ctx.fillStyle = furG;
      ctx.beginPath();
      ctx.moveTo(bx - 14 * S, by - 2 * S);
      ctx.quadraticCurveTo(bx - 18 * S, by + 5 * S, bx - 16 * S - lunge * 0.2, by + 12 * S);
      ctx.lineTo(bx - 10 * S - lunge * 0.2, by + 12 * S);
      ctx.quadraticCurveTo(bx - 10 * S, by + 5 * S, bx - 8 * S, by - 1 * S);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bx - 8 * S, by);
      ctx.quadraticCurveTo(bx - 6 * S, by + 7 * S, bx - 4 * S - lunge * 0.1, by + 12 * S);
      ctx.lineTo(bx + 1 * S, by + 12 * S);
      ctx.quadraticCurveTo(bx + 1 * S, by + 4 * S, bx - 2 * S, by);
      ctx.closePath(); ctx.fill();
      // claws breaking the water surface (visible cream-coloured curves)
      ctx.strokeStyle = 'rgba(240,232,210,0.85)'; ctx.lineWidth = 1.0;
      for (let c = 0; c < 3; c++) {
        ctx.beginPath();
        ctx.arc(bx + (-14 + c * 1.6) * S - lunge * 0.2, by + 13.4 * S, 1.1, 0.2, 2.9);
        ctx.stroke();
      }
      // --- neck + head plunged low to the water (key salmon-grabbing pose)
      ctx.fillStyle = furG;
      const hx3 = bx + (-22) * S - lunge * 0.5;
      const hy3 = by + 5 * S + lunge * 0.4;
      ctx.beginPath();
      ctx.moveTo(bx - 12 * S, by - 6 * S);
      ctx.quadraticCurveTo(bx - 19 * S, by - 3 * S, hx3 + 3, hy3 - 5);
      ctx.quadraticCurveTo(hx3 - 4, hy3 - 4, hx3 - 8, hy3 + 2);           // forehead
      ctx.quadraticCurveTo(hx3 - 12, hy3 + 7, hx3 - 6, hy3 + 9);           // muzzle tip
      ctx.quadraticCurveTo(hx3 + 2, hy3 + 7, hx3 + 5, hy3 + 4);            // jaw
      ctx.quadraticCurveTo(bx - 14 * S, hy3 + 1, bx - 12 * S, by);
      ctx.closePath(); ctx.fill();
      // small rounded ear
      ctx.beginPath(); ctx.ellipse(hx3 + 4, hy3 - 5, 2.4, 2.8, -0.2, 0, 6.283); ctx.fill();
      // inner ear (slightly lighter)
      ctx.fillStyle = furHi;
      ctx.beginPath(); ctx.ellipse(hx3 + 4, hy3 - 5, 1.3, 1.6, -0.2, 0, 6.283); ctx.fill();
      // muzzle tan colour wraps around the nose
      ctx.fillStyle = 'rgba(126,92,58,1)';
      ctx.beginPath(); ctx.ellipse(hx3 - 7, hy3 + 6, 4, 2.2, -0.2, 0, 6.283); ctx.fill();
      // nose (matte black)
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.beginPath(); ctx.ellipse(hx3 - 9, hy3 + 6.5, 1.6, 1.2, 0, 0, 6.283); ctx.fill();
      // eye (catchlight)
      ctx.fillStyle = 'rgba(20,12,6,1)';
      ctx.beginPath(); ctx.arc(hx3 - 1, hy3 - 0.5, 0.9, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,236,180,1)';
      ctx.beginPath(); ctx.arc(hx3 - 0.7, hy3 - 0.8, 0.35, 0, 6.283); ctx.fill();
      // --- the SALMON caught in the bear's jaws — pink-silver, body bent, thrashing
      const fishWag = Math.sin(tt * 9) * 0.35;
      ctx.save(); ctx.translate(hx3 - 13, hy3 + 7); ctx.rotate(-0.4 + fishWag);
      const salmonG = ctx.createLinearGradient(0, -5, 0, 5);
      salmonG.addColorStop(0, 'rgba(238,228,220,1)');
      salmonG.addColorStop(0.45, 'rgba(220,160,140,1)');               // pink salmon stripe
      salmonG.addColorStop(0.55, 'rgba(170,120,110,1)');
      salmonG.addColorStop(1, 'rgba(80,90,100,1)');
      ctx.fillStyle = salmonG;
      // body (longer, fatter than before so it reads as a real salmon)
      ctx.beginPath();
      ctx.moveTo(-11, 0);
      ctx.quadraticCurveTo(-7, -5, 1, -4.6);
      ctx.quadraticCurveTo(11, -3, 14, 0);
      ctx.quadraticCurveTo(11, 3.6, 1, 4.4);
      ctx.quadraticCurveTo(-7, 4.6, -11, 0);
      ctx.closePath(); ctx.fill();
      // forked tail
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(20, -5 + fishWag * 3); ctx.lineTo(17, 0); ctx.lineTo(20, 5 + fishWag * 3);
      ctx.closePath(); ctx.fill();
      // dorsal fin
      ctx.beginPath();
      ctx.moveTo(0, -4); ctx.lineTo(4, -8); ctx.lineTo(7, -4);
      ctx.closePath(); ctx.fill();
      // pectoral fin
      ctx.beginPath();
      ctx.moveTo(-2, 3); ctx.lineTo(0, 7); ctx.lineTo(3, 4);
      ctx.closePath(); ctx.fill();
      // gill mark + eye
      ctx.strokeStyle = 'rgba(60,30,30,0.7)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-3, -3); ctx.lineTo(-3, 3); ctx.stroke();
      ctx.fillStyle = 'rgba(20,18,18,1)';
      ctx.beginPath(); ctx.arc(-7, -1, 0.7, 0, 6.283); ctx.fill();
      ctx.restore();
      // --- water disturbance: ripples + tall spray plume
      ctx.strokeStyle = 'rgba(240,246,238,0.8)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(bx - 10 * S, by + 14 * S, 20 * S, 3.4 * S, 0, 0, 6.283); ctx.stroke();
      ctx.strokeStyle = 'rgba(240,246,238,0.45)';
      ctx.beginPath(); ctx.ellipse(bx - 10 * S, by + 14 * S, 32 * S, 5 * S, 0, 0, 6.283); ctx.stroke();
      // spray flying off where head meets water
      ctx.fillStyle = 'rgba(245,250,242,0.9)';
      for (let s = 0; s < 9; s++) {
        const sang = -0.55 - s * 0.14 - Math.sin(tt * 4 + s) * 0.05;
        const sr = 10 + Math.abs(Math.sin(tt * 3 + s)) * 8;
        ctx.beginPath();
        ctx.arc(hx3 - 6 + Math.cos(sang) * sr, hy3 + 6 + Math.sin(sang) * sr, 1.1, 0, 6.283);
        ctx.fill();
      }
      ctx.restore();
      // ---- a GREAT BLUE HERON wading: slate-blue, S-neck, dagger beak, sometimes
      //   stabbing for a fish. Anatomically tall and angular.
      ctx.save(); ctx.globalAlpha = (1 - nm) * 0.95;
      const hx2 = W * 0.695, hy2 = shoreY(hx2) + 7;
      const heronBlue = 'rgba(96,118,142,1)';
      const heronLight = 'rgba(150,168,188,1)';
      const stab = Math.sin(tt * 0.6) > 0.85 ? 1 : 0;                     // occasional rapid stab
      // long thin legs standing in the shallows
      ctx.strokeStyle = 'rgba(58,46,38,1)'; ctx.lineWidth = 1.0; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx2 - 1, hy2 - 6); ctx.lineTo(hx2 - 3, hy2 + 9); ctx.lineTo(hx2 - 6, hy2 + 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx2 + 2, hy2 - 6); ctx.lineTo(hx2 + 4, hy2 + 9); ctx.lineTo(hx2 + 7, hy2 + 10); ctx.stroke();
      // teardrop body (chest forward, tail flicking back)
      ctx.fillStyle = heronBlue;
      ctx.beginPath();
      ctx.moveTo(hx2 - 9, hy2 - 7);
      ctx.quadraticCurveTo(hx2 - 3, hy2 - 11, hx2 + 4, hy2 - 8);
      ctx.quadraticCurveTo(hx2 + 12, hy2 - 5, hx2 + 14, hy2 - 1);          // tail tip
      ctx.quadraticCurveTo(hx2 + 8, hy2, hx2 + 2, hy2 - 2);
      ctx.quadraticCurveTo(hx2 - 6, hy2 - 3, hx2 - 9, hy2 - 7);
      ctx.closePath(); ctx.fill();
      // wing markings (a pale primary feather edge)
      ctx.fillStyle = heronLight;
      ctx.beginPath(); ctx.ellipse(hx2 + 3, hy2 - 6, 4.5, 1.3, -0.1, 0, 6.283); ctx.fill();
      // S-curved neck — characteristic of herons, tucked when alert
      ctx.strokeStyle = heronBlue; ctx.lineWidth = 2.0; ctx.lineCap = 'round';
      const neckTopY = hy2 - 20 + stab * 8;                                 // dips when stabbing
      ctx.beginPath();
      ctx.moveTo(hx2 - 4, hy2 - 9);
      ctx.quadraticCurveTo(hx2 - 8, hy2 - 14, hx2 - 3, hy2 - 17);
      ctx.quadraticCurveTo(hx2, hy2 - 19, hx2 - 1, neckTopY);
      ctx.stroke();
      // head + black plume + long yellow dagger beak
      ctx.fillStyle = heronBlue;
      ctx.beginPath(); ctx.ellipse(hx2 - 1, neckTopY, 2.2, 1.6, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(20,22,26,1)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(hx2, neckTopY - 1); ctx.lineTo(hx2 + 3, neckTopY - 4); ctx.stroke();     // plume
      ctx.strokeStyle = 'rgba(220,184,84,1)'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(hx2 + 1, neckTopY); ctx.lineTo(hx2 + 10 + stab * 4, neckTopY + stab * 3); ctx.stroke();
      // tiny eye
      ctx.fillStyle = 'rgba(245,225,150,1)';
      ctx.beginPath(); ctx.arc(hx2, neckTopY - 0.3, 0.4, 0, 6.283); ctx.fill();
      ctx.restore();
      // ---- an OTTER slipping into the water near the bank (day) ----
      ctx.save(); ctx.globalAlpha = (1 - nm) * 0.9;
      const otCycle = (tt * 0.7) % 6;
      const otX = W * 0.535 + otCycle * 8;
      const otY = shoreY(otX) + 8;
      ctx.fillStyle = 'rgba(48,30,18,1)';
      ctx.beginPath(); ctx.ellipse(otX, otY, 7, 2.4, 0.1, 0, 6.283); ctx.fill();        // body
      ctx.beginPath(); ctx.arc(otX - 5, otY - 1, 1.7, 0, 6.283); ctx.fill();              // head
      // splash trail behind
      ctx.strokeStyle = 'rgba(232,238,232,0.45)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.ellipse(otX + 4, otY + 1, 4, 1.2, 0, 0, 6.283); ctx.stroke();
      ctx.restore();
    }
    if (nm > 0.02) {
      ctx.save(); ctx.globalAlpha = nm;
      // night: a fuller circle around the fire, varied dress + hair, gently breathing
      const styles = [
        { shirt: '#c93a1e', hairStyle: 'long' },
        { shirt: '#1f4e8f', hairStyle: 'braid' },
        { shirt: '#d68a1f', hairStyle: 'feather' },
        { shirt: '#5a7d3a', hairStyle: 'long' },
        { shirt: '#7c2f6b', hairStyle: 'braid' },
        { shirt: '#b04a2a', hairStyle: 'feather' },
        { shirt: '#1f4e8f', hairStyle: 'long' },
        { shirt: '#d68a1f', hairStyle: 'braid' },
      ];
      [[-32, 1.25, -1], [-22, 1.35, -1], [-11, 1.4, -1], [12, 1.4, 1], [23, 1.35, 1], [33, 1.2, 1], [-42, 1.15, -1], [43, 1.15, 1]].forEach(([dxx, sc, dir], i) => {
        const bob = Math.sin(tt * 1.5 + i) * 0.7;
        fig(fx + dxx, fy + 7 + bob, sc, 'sit', i, Object.assign({ dir }, styles[i % styles.length]));
      });
      ctx.restore();
      // ---- WOLVES at night on the ridge: a proper lupine silhouette, one howling
      //   with muzzle raised to the moon. Pose lifted from photo references —
      //   long sloping back, deep chest, low-set tail, pointed ears.
      ctx.save(); ctx.globalAlpha = nm * 0.95;
      const wRidgeX = W * 0.42, wRidgeY = hY - 32;
      // Wolves were too small / not animated enough. Wrap in a 2.2x scale and
      // do everything in local (0, 0) coordinates so we don't have to rewrite
      // every offset by hand.
      ctx.translate(wRidgeX, wRidgeY); ctx.scale(2.2, 2.2);
      const wolfBody = 'rgba(8,6,4,1)';
      const wolfRim  = `rgba(180,196,224,${0.18 * nm})`;
      ctx.fillStyle = wolfBody;
      // breathing motion + visible chest rise during the howl
      const howl = 0.5 + 0.5 * Math.sin(tt * 0.55);
      const breath = Math.sin(tt * 1.3) * 0.5;       // chest expands/contracts

      // --- wolf 1: HOWLING at the moon (the classic silhouette) ---
      const wx = 0, wy = 0 + breath * 0.4;
      ctx.beginPath();
      // hindquarters → sloping back → chest (left = head end facing left toward moon)
      ctx.moveTo(wx + 11, wy + 3);                                          // tail base
      ctx.quadraticCurveTo(wx + 16, wy + 1, wx + 18, wy - 3);                // rump
      ctx.quadraticCurveTo(wx + 14, wy - 6, wx + 4, wy - 5);                 // back sloping forward
      ctx.quadraticCurveTo(wx - 4, wy - 4, wx - 8, wy - 3);                  // shoulder
      ctx.quadraticCurveTo(wx - 10, wy + 1, wx - 4, wy + 3);                 // chest under
      ctx.quadraticCurveTo(wx + 4, wy + 4, wx + 11, wy + 3);                 // belly
      ctx.closePath(); ctx.fill();
      // hind legs
      ctx.beginPath();
      ctx.moveTo(wx + 12, wy + 3); ctx.quadraticCurveTo(wx + 14, wy + 7, wx + 13, wy + 10);
      ctx.lineTo(wx + 17, wy + 10); ctx.quadraticCurveTo(wx + 18, wy + 6, wx + 17, wy + 3);
      ctx.closePath(); ctx.fill();
      // front legs (slightly apart, planted on the ridge)
      ctx.beginPath();
      ctx.moveTo(wx - 6, wy + 3); ctx.quadraticCurveTo(wx - 7, wy + 7, wx - 8, wy + 10);
      ctx.lineTo(wx - 4, wy + 10); ctx.quadraticCurveTo(wx - 3, wy + 6, wx - 3, wy + 3);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(wx - 2, wy + 3); ctx.quadraticCurveTo(wx - 2, wy + 7, wx - 1, wy + 10);
      ctx.lineTo(wx + 2, wy + 10); ctx.quadraticCurveTo(wx + 3, wy + 6, wx + 2, wy + 3);
      ctx.closePath(); ctx.fill();
      // long bushy tail, low and out behind (wolves don't curl tails up like dogs)
      ctx.strokeStyle = wolfBody; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(wx + 16, wy - 1);
      ctx.quadraticCurveTo(wx + 22, wy + 2, wx + 24, wy + 5);
      ctx.stroke();
      // neck stretched up — head raised to howl
      const headTipX = wx - 12, headTipY = wy - 14 - howl * 2;
      ctx.fillStyle = wolfBody;
      ctx.beginPath();
      ctx.moveTo(wx - 8, wy - 3);
      ctx.quadraticCurveTo(wx - 11, wy - 9, headTipX + 2, headTipY + 3);
      ctx.quadraticCurveTo(headTipX - 2, headTipY + 1, headTipX - 3, headTipY - 1);    // crown
      ctx.quadraticCurveTo(headTipX, headTipY - 3, headTipX + 1, headTipY + 1);         // forehead → muzzle start
      ctx.quadraticCurveTo(headTipX + 6, headTipY + 2, headTipX + 9, headTipY + 5);     // muzzle pointed up-left
      ctx.quadraticCurveTo(headTipX + 5, headTipY + 6, headTipX, headTipY + 5);
      ctx.quadraticCurveTo(wx - 6, wy - 4, wx - 4, wy - 2);
      ctx.closePath(); ctx.fill();
      // open mouth (small triangular gap mid-howl)
      if (howl > 0.55) {
        ctx.fillStyle = 'rgba(36,18,14,1)';
        ctx.beginPath();
        ctx.moveTo(headTipX + 3, headTipY + 4);
        ctx.lineTo(headTipX + 7, headTipY + 5.5);
        ctx.lineTo(headTipX + 4, headTipY + 6);
        ctx.closePath(); ctx.fill();
      }
      // pointed ears laid back along the skull (howling posture)
      ctx.fillStyle = wolfBody;
      ctx.beginPath();
      ctx.moveTo(headTipX - 2, headTipY - 1); ctx.lineTo(headTipX - 1, headTipY - 5); ctx.lineTo(headTipX + 2, headTipY - 1);
      ctx.closePath(); ctx.fill();
      // faint moonlit rim along the back (just barely visible)
      ctx.strokeStyle = wolfRim; ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(wx + 18, wy - 3); ctx.quadraticCurveTo(wx + 4, wy - 6, headTipX - 2, headTipY - 1);
      ctx.stroke();

      // --- wolf 2: a companion alongside, standing watch (smaller, profile)
      const w2x = wx - 22, w2y = wy + 2;
      ctx.fillStyle = wolfBody;
      ctx.beginPath();
      ctx.moveTo(w2x + 7, w2y);
      ctx.quadraticCurveTo(w2x + 10, w2y - 3, w2x + 6, w2y - 4);
      ctx.quadraticCurveTo(w2x - 2, w2y - 4, w2x - 6, w2y - 2);
      ctx.quadraticCurveTo(w2x - 7, w2y + 1, w2x - 3, w2y + 2);
      ctx.quadraticCurveTo(w2x + 4, w2y + 3, w2x + 7, w2y);
      ctx.closePath(); ctx.fill();
      // legs
      ctx.fillRect(w2x - 5, w2y + 2, 1.8, 5);
      ctx.fillRect(w2x - 1, w2y + 2, 1.8, 5);
      ctx.fillRect(w2x + 4, w2y + 1, 1.8, 5);
      // tail
      ctx.strokeStyle = wolfBody; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w2x + 9, w2y - 1); ctx.quadraticCurveTo(w2x + 13, w2y, w2x + 14, w2y + 3); ctx.stroke();
      // head looking left (profile)
      ctx.fillStyle = wolfBody;
      ctx.beginPath();
      ctx.moveTo(w2x - 6, w2y - 3); ctx.lineTo(w2x - 10, w2y - 2); ctx.lineTo(w2x - 11, w2y); ctx.lineTo(w2x - 6, w2y);
      ctx.closePath(); ctx.fill();
      // ears
      ctx.beginPath(); ctx.moveTo(w2x - 6, w2y - 3); ctx.lineTo(w2x - 5, w2y - 6); ctx.lineTo(w2x - 4, w2y - 3); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  // ---- foreground reeds for depth (restored — the simpler tapered grasses) ----
  ctx.strokeStyle = 'rgba(15,12,9,0.8)'; ctx.lineCap = 'round';
  const reeds = [[W * 0.03, 8], [W * 0.06, 6], [W * 0.085, 9], [W * 0.95, 8], [W * 0.92, 6], [W * 0.975, 10]];
  reeds.forEach((r, i) => {
    const sway = Math.sin(tt * 1.2 + i) * 6;
    const rx = r[0] + pxX * 40;                       // foreground parallax
    ctx.lineWidth = r[1]; ctx.beginPath();
    ctx.moveTo(rx, H);
    ctx.quadraticCurveTo(rx + sway * 0.5, H - 70, rx + sway, H - 130);
    ctx.stroke();
  });

  // ---- LEAPING FISH: a proper parabolic arc, the body curls/bends as it goes ----
  for (const fi of _FISH) {
    const loc = ((tt + fi.phase) % fi.period) / fi.period;
    if (loc >= 0.16) continue;                       // a slightly longer, more readable leap
    const k = loc / 0.16;                            // 0..1 through the arc
    const dir = fi.dir || 1;                          // direction of travel along the parabola
    const span = 36;                                  // horizontal distance of the leap
    const arcH = 32;                                  // peak height
    const fx0 = fi.x * W;
    const fx = fx0 + (k - 0.5) * span * dir;          // travel forward through the arc
    const baseY = hY + 14 + (H - hY) * fi.yb;
    const fy = baseY - Math.sin(k * Math.PI) * arcH;
    // splash crown when LEAVING the water (k just above 0)
    if (k < 0.18) {
      ctx.fillStyle = 'rgba(240,246,238,0.85)';
      for (let s = 0; s < 6; s++) {
        const ang = -Math.PI / 2 + (s - 2.5) * 0.35;
        const r = 8 + k * 30;
        ctx.beginPath();
        ctx.arc(fx0 - 10 * dir + Math.cos(ang) * r, baseY + Math.sin(ang) * r * 0.6, 1.0, 0, 6.283);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(235,240,232,0.5)'; ctx.lineWidth = 1.0;
      ctx.beginPath(); ctx.ellipse(fx0 - 10 * dir, baseY, 9, 2.6, 0, 0, 6.283); ctx.stroke();
    }
    // body — orientation follows the tangent of the arc (not a stiff rotation)
    const ang = Math.atan2(-Math.cos(k * Math.PI) * arcH * Math.PI, span * dir);
    const bodyA = 0.85 * (1 - Math.abs(k - 0.5) * 0.5);
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(ang);
    // curl: the fish bends slightly as if mid-flex
    const curl = Math.sin(tt * 14) * 0.2;
    const fishG2 = ctx.createLinearGradient(0, -4, 0, 4);
    fishG2.addColorStop(0, `rgba(228,232,236,${bodyA})`);
    fishG2.addColorStop(0.5, `rgba(178,190,200,${bodyA})`);
    fishG2.addColorStop(1, `rgba(72,86,98,${bodyA})`);
    ctx.fillStyle = fishG2;
    // curved body
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.quadraticCurveTo(-5, -4 + curl * 2, 2, -3.6 + curl * 1.5);
    ctx.quadraticCurveTo(9, -2, 12, 0);
    ctx.quadraticCurveTo(9, 3 + curl * 1.5, 2, 3.6 + curl * 2);
    ctx.quadraticCurveTo(-5, 4 + curl * 2, -10, 0);
    ctx.closePath(); ctx.fill();
    // forked tail flicking
    ctx.beginPath();
    ctx.moveTo(12, 0); ctx.lineTo(17, -4 + curl * 3); ctx.lineTo(14, 0); ctx.lineTo(17, 4 + curl * 3);
    ctx.closePath(); ctx.fill();
    // dorsal fin
    ctx.beginPath(); ctx.moveTo(0, -3.5); ctx.lineTo(3, -7); ctx.lineTo(6, -3.5); ctx.closePath(); ctx.fill();
    // eye
    ctx.fillStyle = `rgba(20,20,22,${bodyA})`;
    ctx.beginPath(); ctx.arc(-6, -0.8, 0.7, 0, 6.283); ctx.fill();
    // water droplets sliding off the back
    if (k < 0.55) {
      ctx.fillStyle = `rgba(220,232,236,${bodyA * 0.85})`;
      for (let d = 0; d < 3; d++) {
        ctx.beginPath(); ctx.arc(-4 + d * 4, -5 - d * 1.5 - k * 4, 0.7, 0, 6.283); ctx.fill();
      }
    }
    ctx.restore();
    // splash on re-entry
    if (k > 0.82) {
      ctx.fillStyle = 'rgba(240,246,238,0.9)';
      for (let s = 0; s < 7; s++) {
        const ang2 = -Math.PI / 2 + (s - 3) * 0.32;
        const r = 6 + (k - 0.82) / 0.18 * 22;
        ctx.beginPath();
        ctx.arc(fx0 + 10 * dir + Math.cos(ang2) * r, baseY + Math.sin(ang2) * r * 0.55, 1.0, 0, 6.283);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(235,240,232,0.55)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(fx0 + 10 * dir, baseY, 11, 3, 0, 0, 6.283); ctx.stroke();
    }
  }

  // ---- fireflies near the reeds (dusk → night): wandering, soft, organic blink ----
  const flyA = _smooth(0.44, 0.64, p);
  if (flyA > 0.02) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const f of _FLIES) {
      // gentle figure-8 wander, not a fixed dot
      const fx = f.x * W + Math.sin(tt * 0.4 * f.sp + f.ph) * 26 + Math.sin(tt * 0.17 + f.ph * 2) * 14 + pxX * 30;
      const fy = f.y * H + Math.cos(tt * 0.33 * f.sp + f.ph) * 15 + Math.sin(tt * 0.5 + f.ph) * 7;
      // organic blink: mostly dark, brief soft pulses (rarer, dimmer than before)
      const s = Math.sin(tt * f.blink * 0.7 + f.ph);
      const pulse = s > 0.35 ? Math.pow((s - 0.35) / 0.65, 2) : 0;
      const a = flyA * pulse * 0.6;
      if (a < 0.012) continue;
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 5.5);
      g.addColorStop(0, `rgba(200,255,150,${a * 0.7})`);
      g.addColorStop(0.45, `rgba(240,224,120,${a * 0.4})`);
      g.addColorStop(1, 'rgba(220,210,90,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, 5.5, 0, 6.283); ctx.fill();
      ctx.fillStyle = `rgba(224,255,180,${a * 0.9})`; ctx.beginPath(); ctx.arc(fx, fy, 0.9, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }

  // ---- top + bottom vignette to blend with page ----
  const vg = ctx.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, 'rgba(10,8,6,0.30)'); vg.addColorStop(0.22, 'rgba(10,8,6,0)');
  vg.addColorStop(0.9, 'rgba(10,8,6,0)'); vg.addColorStop(1, 'rgba(10,8,6,0.14)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

function WelcomeView({ all, setView }) {
  const stageRef = useR_w(null);
  const canvasRef = useR_w(null);
  const progressRef = useR_w(0);
  const panelRefs = useR_w([]);
  const setPanelRef = (i) => (el) => { panelRefs.current[i] = el; };
  const reduce = _motionOff();

  // Always begin the landing page at the very top. Browsers restore the previous
  // scroll position on reload, which could land the pinned story on a chapter
  // boundary (the fade-through gap) and make the text look like it disappeared.
  useE_w(() => {
    try { if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'; } catch (e) {}
    window.scrollTo(0, 0);
    progressRef.current = 0;
  }, []);

  // ambient soundscape (water, birds, soft heartbeat) — off by default
  const [soundOn, setSoundOn] = useS_w(false);
  const ambientRef = useR_w(null);
  const toggleSound = () => {
    if (soundOn) { if (ambientRef.current) { ambientRef.current.stop(); ambientRef.current = null; } setSoundOn(false); }
    else { ambientRef.current = createAmbient(() => progressRef.current); if (ambientRef.current) setSoundOn(true); }
  };
  useE_w(() => () => { if (ambientRef.current) { ambientRef.current.stop(); ambientRef.current = null; } }, []);

  const data = useM_w(() => {
    const list = Array.isArray(all) ? all : [];
    const comms = list.filter((c) => c.orgType === 'Community');
    return { communities: comms.length, orgs: list.length - comms.length, people: list.reduce((s, c) => s + (c.population || 0), 0) };
  }, [all]);
  const nComm = window.useCountUp(data.communities, 1600);
  const nOrg = window.useCountUp(data.orgs, 1600);
  const nPeople = window.useCountUp(data.people, 1900);

  // cursor parallax: track the pointer over the scene (-1..1 from centre)
  const onMoveScene = (e) => {
    _MX = (e.clientX / (window.innerWidth || 1)) * 2 - 1;
    _MY = (e.clientY / (window.innerHeight || 1)) * 2 - 1;
  };
  // tap the lake → an expanding ripple (ignored on buttons/links)
  const onTapLake = (e) => {
    if (e.target && e.target.closest && e.target.closest('button, a')) return;
    const cv = canvasRef.current; if (!cv) return;
    const r = cv.getBoundingClientRect();
    _CLICKS.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() });
    if (_CLICKS.length > 24) _CLICKS.shift();
  };
  // smooth-scroll forward ~one screen each time the arrow is pressed (advances a chapter)
  const scrollNext = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const stage = stageRef.current;
    const rect = stage && stage.getBoundingClientRect();
    const total = rect ? rect.height - window.innerHeight : 0;
    if (!stage || total <= 0) { window.scrollBy({ top: window.innerHeight, behavior: 'smooth' }); return; }
    const top = window.scrollY + rect.top;                 // absolute top of the stage
    const cur = _clamp((window.scrollY - top) / total, 0, 1);
    const seg = 1 / 5;                                      // five chapters
    // Land on the NEXT chapter's CENTRE (never a boundary, which is the blank gap).
    const curIdx = _clamp(Math.floor(cur / seg + 0.0001), 0, 4);
    const nextIdx = Math.min(4, curIdx + 1);
    const targetP = (nextIdx + 0.5) * seg;
    try { window.scrollTo({ top: top + targetP * total, behavior: 'smooth' }); }
    catch (_) { window.scrollTo(0, top + targetP * total); }
  };

  // ---- canvas animation loop ----
  useE_w(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, dpr, raf = null, t0 = null, last = 0;
    function resize() { dpr = Math.min(1.5, window.devicePixelRatio || 1); W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = Math.max(1, W * dpr); canvas.height = Math.max(1, H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    resize();
    const ro = ('ResizeObserver' in window) ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(canvas); else window.addEventListener('resize', resize);
    if (reduce) { drawScene(ctx, W, H, 0.32, 0, performance.now()); }
    else {
      const frame = (time) => {
        raf = requestAnimationFrame(frame);
        if (time - last < 32) return; last = time; if (t0 == null) t0 = time;
        drawScene(ctx, W, H, progressRef.current, (time - t0) / 1000, time);
      };
      raf = requestAnimationFrame(frame);
    }
    function onVis() { if (document.hidden && raf) { cancelAnimationFrame(raf); raf = null; } else if (!document.hidden && !raf && !reduce) { last = 0; raf = requestAnimationFrame((t) => { t0 = null; const f = (time) => { raf = requestAnimationFrame(f); if (time - last < 32) return; last = time; if (t0 == null) t0 = time; drawScene(ctx, W, H, progressRef.current, (time - t0) / 1000, time); }; f(t); }); } }
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
        // ONE chapter at a time: fully opaque in its core, faded right down to 0
        // by the segment boundary so two chapters' text can never overlap/merge.
        const op = 1 - _smooth(seg * 0.33, seg * 0.50, d);
        const opc = _clamp(op, 0, 1);
        el.style.opacity = String(opc);
        // larger vertical hand-off (one slides up & out as the next rises in)
        el.style.transform = `translate3d(0, ${(p - center) * -150}px, 0) scale(${_lerp(1.03, 1, opc)})`;
        el.style.pointerEvents = opc > 0.6 ? 'auto' : 'none';
        // graceful staggered line-reveal: arm it once the chapter is on screen
        if (opc > 0.55) el.classList.add('wv-in'); else if (opc < 0.05) el.classList.remove('wv-in');
      });
    }
    function onScroll() { if (!raf) raf = requestAnimationFrame(update); }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    // Run repeatedly across the load lifecycle so panels are never left hidden
    // because layout/fonts weren't settled on the first pass (the "text sometimes
    // disappears until you refresh" race).
    update();
    requestAnimationFrame(() => { update(); requestAnimationFrame(update); });
    const t1 = setTimeout(update, 160);
    const t2 = setTimeout(update, 550);
    window.addEventListener('load', update);
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(update).catch(() => {}); }
    return () => {
      window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll);
      window.removeEventListener('load', update); clearTimeout(t1); clearTimeout(t2);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduce]);

  // Safety net: reveal panel text shortly after mount (the scroll handler then
  // manages per-chapter crossfade). Guarantees the hero copy is never stuck hidden.
  useE_w(() => {
    if (reduce) return;
    const id = setTimeout(() => { panelRefs.current.forEach((el) => el && el.classList.add('wv-in')); }, 80);
    return () => clearTimeout(id);
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
        <div className="wv-pin" onPointerDown={onTapLake} onPointerMove={onMoveScene}>
          <canvas ref={canvasRef} className="wv-canvas" aria-hidden="true"></canvas>
          <div className="wv-panels">{panels}</div>
          <button type="button" className={`wv-sound ${soundOn ? 'on' : ''}`} onClick={toggleSound}
                  aria-pressed={soundOn} title="Ambient sound — water, birds & a soft heartbeat drum">
            <span className="wv-sound-ico" aria-hidden="true">{soundOn ? '♪' : '♪'}</span>
            <span className="wv-sound-lab">{soundOn ? 'Sound on' : 'Sound off'}</span>
            {soundOn && <span className="wv-sound-eq" aria-hidden="true"><i></i><i></i><i></i></span>}
          </button>
          <button type="button" className="wv-scrollcue" onClick={scrollNext} aria-label="Scroll to the next chapter">
            <span>scroll to discover</span><i>↓</i>
          </button>
        </div>
      </div>
    </section>
  );
}
window.WelcomeView = WelcomeView;
