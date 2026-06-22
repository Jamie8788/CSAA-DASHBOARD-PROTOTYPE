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
const _FISH = [{ x: 0.34, yb: 0.34, period: 13, phase: 2 }, { x: 0.7, yb: 0.5, period: 17, phase: 9 }];
// cursor position (-1..1 from centre), eased, for a parallax depth effect
let _MX = 0, _MY = 0, _MXe = 0, _MYe = 0;

// Calming ambient lake soundscape — fully SYNTHESIZED (no recordings): soft layered
// water, gentle wind, frequent quiet birdsong, a lone loon, a slow soft heartbeat,
// and a sparse wooden-flute melody (pentatonic — evoking the Anishinaabe flute).
// Web Audio; starts on a user gesture; fades in/out. Tuned to be relaxing, not busy.
function createAmbient() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  const timers = [];
  const T = () => ctx.currentTime;
  const pan = (v) => { try { const p = ctx.createStereoPanner(); p.pan.value = v; return p; } catch (e) { return ctx.createGain(); } };
  function brown() {
    const len = 2 * ctx.sampleRate, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    return b;
  }
  // deep water rumble
  const n1 = ctx.createBufferSource(); n1.buffer = brown(); n1.loop = true;
  const lp1 = ctx.createBiquadFilter(); lp1.type = 'lowpass'; lp1.frequency.value = 300;
  const g1 = ctx.createGain(); g1.gain.value = 0.1;
  n1.connect(lp1); lp1.connect(g1); g1.connect(master);
  const lfo1 = ctx.createOscillator(); lfo1.frequency.value = 0.08; const lg1 = ctx.createGain(); lg1.gain.value = 0.05;
  lfo1.connect(lg1); lg1.connect(g1.gain); n1.start(); lfo1.start();
  // soft lapping wavelets (stereo)
  [-0.5, 0.5].forEach((pp, idx) => {
    const n = ctx.createBufferSource(); n.buffer = brown(); n.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 560 + idx * 180; bp.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = 0.038; const p = pan(pp);
    n.connect(bp); bp.connect(g); g.connect(p); p.connect(master);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.24 + idx * 0.1; const lg = ctx.createGain(); lg.gain.value = 0.034;
    lfo.connect(lg); lg.connect(g.gain); n.start(); lfo.start();
  });
  // very soft wind
  const wn = ctx.createBufferSource(); wn.buffer = brown(); wn.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 760;
  const wg = ctx.createGain(); wg.gain.value = 0.008;
  wn.connect(hp); hp.connect(wg); wg.connect(master);
  const wlfo = ctx.createOscillator(); wlfo.frequency.value = 0.045; const wlg = ctx.createGain(); wlg.gain.value = 0.008;
  wlfo.connect(wlg); wlg.connect(wg.gain); wn.start(); wlfo.start();
  // slow, soft heartbeat (quieter & calmer)
  function thump(t, vol) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(82, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.22);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 150;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.035); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + 0.65);
  }
  function heart() { const t = T() + 0.05; thump(t, 0.12); thump(t + 0.32, 0.07); timers.push(setTimeout(heart, 2400)); }
  // frequent, gentle birdsong
  function bird() {
    const t = T() + 0.02, p = pan((Math.random() * 2 - 1) * 0.7), base = 1700 + Math.random() * 1700;
    const kind = Math.random(), notes = kind < 0.45 ? 3 : kind < 0.8 ? 2 : 1;
    for (let k = 0; k < notes; k++) {
      const t0 = t + k * (0.085 + Math.random() * 0.05), f = base * (1 + (Math.random() * 0.18 - 0.09));
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f, t0); o.frequency.linearRampToValueAtTime(f * 1.28, t0 + 0.04); o.frequency.linearRampToValueAtTime(f * 0.93, t0 + 0.1);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.038, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      o.connect(g); g.connect(p); o.start(t0); o.stop(t0 + 0.16);
    }
    p.connect(master); timers.push(setTimeout(bird, 1500 + Math.random() * 3200));
  }
  // a lone loon call drifting across the lake
  function loon() {
    const t = T() + 0.1, p = pan((Math.random() * 2 - 1) * 0.4), f = 420 + Math.random() * 70;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.8, t); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.5); o.frequency.exponentialRampToValueAtTime(f * 1.08, t + 1.4);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.055, t + 0.2); g.gain.linearRampToValueAtTime(0.045, t + 1.0); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    o.connect(lp); lp.connect(g); g.connect(p); p.connect(master); o.start(t); o.stop(t + 1.8);
    timers.push(setTimeout(loon, 19000 + Math.random() * 22000));
  }
  // a sparse, breathy wooden-flute melody (pentatonic) — the calming heart of it
  const SCALE = [392.0, 440.0, 523.25, 587.33, 659.25];
  function flute() {
    const t = T() + 0.05;
    const f = SCALE[Math.floor(Math.random() * SCALE.length)] * (Math.random() < 0.28 ? 0.5 : 1);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(f, t);
    const vib = ctx.createOscillator(); vib.frequency.value = 5; const vibg = ctx.createGain(); vibg.gain.value = f * 0.006;
    vib.connect(vibg); vibg.connect(o.frequency);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700;
    const g = ctx.createGain(); const dur = 0.9 + Math.random() * 0.9;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.055, t + 0.25); g.gain.setValueAtTime(0.05, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = pan((Math.random() * 2 - 1) * 0.22);
    o.connect(lp); lp.connect(g); g.connect(p); p.connect(master);
    vib.start(t); vib.stop(t + dur + 0.1); o.start(t); o.stop(t + dur + 0.1);
    timers.push(setTimeout(flute, 4200 + Math.random() * 5200));
  }
  heart(); timers.push(setTimeout(bird, 900)); timers.push(setTimeout(loon, 7000)); timers.push(setTimeout(flute, 2500));
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

  // ---- far shore: treeline + a small community of lodges, with a fire glow ----
  const shoreAlpha = 0.6 + 0.28 * _smooth(0.6, 1, p);
  const vx = W * 0.66;                                 // the village sits here on the shore
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
  // ---- a small Anishinaabe village (wigwam domes) nestled at the shore ----
  for (const Lg of [[-30, 0.85], [-12, 1.05], [6, 0.8], [22, 1.0], [38, 0.7]]) {
    const lx = vx + Lg[0] * 1.25, s = Lg[1], lw = 9 * s, lh = 7 * s;
    ctx.fillStyle = `rgba(11,8,5,${shoreAlpha})`;
    ctx.beginPath(); ctx.ellipse(lx, hY, lw, lh, 0, Math.PI, 2 * Math.PI); ctx.fill();
    // a soft warm doorway light at dusk/night
    if (fireA > 0.3) { ctx.fillStyle = `rgba(255,176,86,${0.5 * fireA})`; ctx.beginPath(); ctx.arc(lx, hY - 1, 1.2 * s, 0, 6.283); ctx.fill(); }
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
  // hull — a canoe with upturned ends and a warm wood gradient (stays visible at dusk)
  ctx.beginPath();
  ctx.moveTo(-50, -2);
  ctx.quadraticCurveTo(-58, -13, -46, -13);
  ctx.quadraticCurveTo(0, -4, 46, -13);
  ctx.quadraticCurveTo(58, -13, 50, -2);
  ctx.quadraticCurveTo(0, 20, -50, -2);
  ctx.closePath();
  const hullG = ctx.createLinearGradient(0, -13, 0, 19);
  hullG.addColorStop(0, '#9a6238'); hullG.addColorStop(0.5, '#653c20'); hullG.addColorStop(1, '#38220f');
  ctx.fillStyle = hullG; ctx.fill();
  // gunwale strip + a ribbed pattern + warm rim light on the lit side
  ctx.strokeStyle = 'rgba(228,184,124,0.85)'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-46, -11); ctx.quadraticCurveTo(0, -3.5, 46, -11); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,214,150,0.6)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(rim * 8, -6); ctx.quadraticCurveTo(rim * 48, -11, rim * 51, -2); ctx.stroke();
  ctx.strokeStyle = 'rgba(70,42,22,0.5)'; ctx.lineWidth = 1;
  for (let rb = -34; rb <= 34; rb += 12) { ctx.beginPath(); ctx.moveTo(rb, -8); ctx.lineTo(rb, 9); ctx.stroke(); }
  // bow lantern pole + lantern
  if (night) {
    ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(40, -6); ctx.lineTo(40, -18); ctx.stroke();
    ctx.fillStyle = '#ffce7a'; ctx.beginPath(); ctx.arc(40, -21, 3.4, 0, 6.283); ctx.fill();
  }
  // --- paddler: seated IN the canoe — only torso & up show above the gunwale ---
  const lean = padSide * 0.09 * Math.abs(strokeT);
  ctx.save(); ctx.translate(-1, 0); ctx.rotate(lean);
  const skin = '#caa07a', cloth = '#ef6a1c', clothLine = 'rgba(46,22,8,0.85)';
  const gun = -11;                                    // gunwale line — nothing of the body below this
  // torso: gunwale up to the shoulders (no hips or legs visible)
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(-6.5, gun); ctx.lineTo(-5.5, -19); ctx.quadraticCurveTo(0, -22.5, 5.5, -19); ctx.lineTo(6.5, gun);
  ctx.quadraticCurveTo(0, gun + 2.5, -6.5, gun); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = clothLine; ctx.lineWidth = 0.8; ctx.stroke();
  // shoulders
  ctx.lineCap = 'round'; ctx.lineWidth = 4.4; ctx.strokeStyle = cloth;
  ctx.beginPath(); ctx.moveTo(-6.5, -19); ctx.lineTo(6.5, -19); ctx.stroke();
  // neck + head
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.moveTo(-1.8, -19); ctx.lineTo(1.8, -19); ctx.lineTo(1.4, -22.5); ctx.lineTo(-1.4, -22.5); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -27, 4.8, 0, 6.283); ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,150,0.5)'; ctx.lineWidth = 1.3;       // rim light on the lit side
  ctx.beginPath(); ctx.arc(0, -27, 4.8, rim < 0 ? 1.9 : -1.2, rim < 0 ? 4.4 : 1.3); ctx.stroke();
  // --- paddle held with BOTH hands, blade dipping in the water beside the canoe ---
  const topGrip = [padSide * -2, -20];
  const bladeTip = [padSide * (44 + 5 * Math.abs(strokeT)), 9 + 6 * Math.abs(strokeT)];
  const lowGrip = [topGrip[0] + (bladeTip[0] - topGrip[0]) * 0.42, topGrip[1] + (bladeTip[1] - topGrip[1]) * 0.42];
  ctx.strokeStyle = '#6b4626'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(topGrip[0], topGrip[1]); ctx.lineTo(bladeTip[0], bladeTip[1]); ctx.stroke();  // shaft
  ctx.strokeStyle = skin; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(padSide * -5, -18); ctx.lineTo(topGrip[0], topGrip[1]); ctx.stroke();   // upper arm → top hand
  ctx.beginPath(); ctx.moveTo(padSide * 5, -18); ctx.lineTo(lowGrip[0], lowGrip[1]); ctx.stroke();     // lower arm → mid-shaft hand
  ctx.save(); ctx.translate(bladeTip[0], bladeTip[1]); ctx.rotate(Math.atan2(bladeTip[1] - topGrip[1], bladeTip[0] - topGrip[0]));
  ctx.fillStyle = '#7a5230'; ctx.beginPath(); ctx.ellipse(4, 0, 6, 2.6, 0, 0, 6.283); ctx.fill(); ctx.restore();
  ctx.restore();
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
    const nm = _smooth(0.52, 0.9, p);                 // nightness 0..1 — drives the crossfade
    const lx0 = W * 0.70;                              // waterline meets the land here (lower-right)
    const shoreY = (x) => { const t = _clamp((x - lx0) / (W - lx0), 0, 1); return H - 4 - Math.pow(t, 0.9) * H * 0.26; };
    const ground = (x) => shoreY(x) + 8;
    // --- land bank (earth tone, darkens at night) ---
    const et = [Math.round(_lerp(70, 30, nm)), Math.round(_lerp(76, 38, nm)), Math.round(_lerp(46, 26, nm))];
    const eb = [Math.round(_lerp(40, 17, nm)), Math.round(_lerp(44, 21, nm)), Math.round(_lerp(26, 14, nm))];
    const lgr = ctx.createLinearGradient(0, H * 0.74, 0, H);
    lgr.addColorStop(0, `rgb(${et.join(',')})`); lgr.addColorStop(1, `rgb(${eb.join(',')})`);
    ctx.fillStyle = lgr;
    ctx.beginPath(); ctx.moveTo(lx0, H);
    for (let x = lx0; x <= W; x += 10) ctx.lineTo(x, shoreY(x));
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    // soft lit waterline where land meets the lake (blends the edge)
    const hzc = _rampA(SKY_HORIZ, p);
    ctx.strokeStyle = `rgba(${hzc[0]},${hzc[1]},${hzc[2]},0.25)`; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let x = lx0; x <= W; x += 8) { const y = shoreY(x) + Math.sin(x * 0.05 + tt * 1.5) * 1.3; x === lx0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();

    // --- two homes (wigwam domes) with a warm doorway at night ---
    [[W * 0.80, 1.0], [W * 0.875, 0.82]].forEach(([hx, s]) => {
      const gy = ground(hx);
      ctx.fillStyle = `rgb(${Math.round(_lerp(44, 18, nm))},${Math.round(_lerp(36, 16, nm))},${Math.round(_lerp(24, 12, nm))})`;
      ctx.beginPath(); ctx.ellipse(hx, gy, 24 * s, 17 * s, 0, Math.PI, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = nm > 0.35 ? `rgba(255,170,86,${0.55 * nm})` : 'rgba(18,12,8,0.85)';
      ctx.beginPath(); ctx.ellipse(hx, gy, 4 * s, 8 * s, 0, Math.PI, 2 * Math.PI); ctx.fill();
    });
    // --- garden plot (rows of plants gently swaying) ---
    const gx = W * 0.95, gyy = ground(gx);
    for (let r = 0; r < 4; r++) {
      const ry = gyy + 3 + r * 5;
      ctx.strokeStyle = 'rgba(38,48,26,0.8)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(gx - 26, ry); ctx.lineTo(gx + 26, ry); ctx.stroke();
      ctx.strokeStyle = 'rgba(74,98,50,0.85)'; ctx.lineWidth = 1.4;
      for (let c = 0; c < 6; c++) { const px = gx - 22 + c * 9; ctx.beginPath(); ctx.moveTo(px, ry); ctx.lineTo(px + Math.sin(tt * 1.4 + c + r) * 1.4, ry - 4.5); ctx.stroke(); }
    }
    // --- drying rack with fish ---
    const dx = W * 0.90, dyy = ground(dx);
    ctx.strokeStyle = 'rgba(34,24,14,1)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(dx - 17, dyy); ctx.lineTo(dx - 17, dyy - 22); ctx.moveTo(dx + 17, dyy); ctx.lineTo(dx + 17, dyy - 22); ctx.moveTo(dx - 20, dyy - 22); ctx.lineTo(dx + 20, dyy - 22); ctx.stroke();
    ctx.fillStyle = 'rgba(122,92,62,1)';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(dx - 14 + i * 5.6, dyy - 14, 1.9, 4.2, 0, 0, 6.283); ctx.fill(); }
    // --- the village fire: cooking by day → bonfire by night, always glowing a little ---
    const fx = W * 0.785, fy = ground(fx) + 7, fa = 0.45 + 0.55 * nm;
    const gl = ctx.createRadialGradient(fx, fy - 6, 0, fx, fy - 6, 60 * (0.6 + nm));
    gl.addColorStop(0, `rgba(255,160,80,${0.32 * fa})`); gl.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = gl; ctx.fillRect(fx - 70, fy - 70, 140, 100);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const fcols = ['255,110,34', '255,165,58', '255,224,130'];
    for (let i = 0; i < 3; i++) {
      const fw = (7 - i * 1.8) * (0.7 + 0.6 * nm), fh = (16 - i * 3) * (0.7 + 0.6 * nm) * (0.8 + 0.3 * Math.sin(tt * (9 + i * 4) + i));
      ctx.fillStyle = `rgba(${fcols[i]},${0.8 * fa})`;
      ctx.beginPath(); ctx.moveTo(fx - fw, fy);
      ctx.quadraticCurveTo(fx - fw * 0.5 + Math.sin(tt * 8 + i) * 2, fy - fh * 0.6, fx, fy - fh);
      ctx.quadraticCurveTo(fx + fw * 0.5 + Math.sin(tt * 8 + i + 2) * 2, fy - fh * 0.6, fx + fw, fy);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // cooking smoke (day only)
    if (nm < 0.85) {
      ctx.save(); ctx.globalAlpha = (1 - nm) * 0.5; ctx.strokeStyle = 'rgba(190,184,174,1)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath();
      for (let s = 0; s <= 12; s++) { const sy = fy - 8 - s * 6; const sx = fx + Math.sin(s * 0.5 + tt * 1.1) * (3 + s * 0.7); s === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy); }
      ctx.stroke(); ctx.restore();
    }
    // --- PEOPLE (moderate size), animated; day: doing tasks, night: gathered at the fire ---
    const fig = (px, py, sc, kind, ph) => {
      ctx.fillStyle = 'rgba(12,8,5,1)';
      const bh = 11 * sc;
      ctx.beginPath(); ctx.ellipse(px, py - bh * 0.4, 3.1 * sc, bh * 0.5, 0, Math.PI, 2 * Math.PI); ctx.fill();   // body
      ctx.beginPath(); ctx.arc(px, py - bh, 2.4 * sc, 0, 6.283); ctx.fill();                                       // head
      ctx.strokeStyle = 'rgba(12,8,5,1)'; ctx.lineWidth = 2 * sc; ctx.lineCap = 'round';
      if (kind === 'stir') { const a = Math.sin(tt * 3 + ph) * 0.5; ctx.beginPath(); ctx.moveTo(px, py - bh * 0.7); ctx.lineTo(px + 7 * sc * Math.cos(a - 0.3), py - bh * 0.45 + 7 * sc * Math.sin(a - 0.3)); ctx.stroke(); }
      else if (kind === 'hang') { const a = Math.sin(tt * 1.6 + ph) * 0.3 - 1.05; ctx.beginPath(); ctx.moveTo(px, py - bh * 0.7); ctx.lineTo(px + 6 * sc * Math.cos(a), py - bh * 0.7 + 6 * sc * Math.sin(a)); ctx.stroke(); }
      else if (kind === 'hoe') { const a = Math.abs(Math.sin(tt * 2.4 + ph)); ctx.beginPath(); ctx.moveTo(px, py - bh * 0.6); ctx.lineTo(px + 8 * sc, py - bh * 0.3 + 6 * sc * a); ctx.stroke(); }
    };
    // day workers (fade out as the sun sets)
    if (nm < 0.98) {
      ctx.save(); ctx.globalAlpha = 1 - nm;
      fig(fx + 15, ground(fx + 15) + 7, 1.5, 'stir', 0);   // cooking at the fire
      fig(dx - 1, dyy + 7, 1.45, 'hang', 1);               // hanging fish to dry
      fig(gx + 4, gyy + 8, 1.45, 'hoe', 2);                // tending the garden
      ctx.restore();
    }
    // night — the community gathered around the fire (fade in)
    if (nm > 0.02) {
      ctx.save(); ctx.globalAlpha = nm;
      [[-19, 1.45], [-9, 1.55], [11, 1.55], [20, 1.45]].forEach(([dxx, sc], i) => { const bob = Math.sin(tt * 1.5 + i) * 0.7; fig(fx + dxx, fy + 8 + bob, sc, 'sit', i); });
      ctx.restore();
    }
  }

  // ---- foreground reeds for depth (restored — the simpler tapered grasses) ----
  ctx.strokeStyle = 'rgba(15,12,9,0.8)'; ctx.lineCap = 'round';
  const reeds = [[W * 0.04, 5], [W * 0.07, 4], [W * 0.95, 5], [W * 0.92, 4], [W * 0.98, 6]];
  reeds.forEach((r, i) => {
    const sway = Math.sin(tt * 1.2 + i) * 6;
    const rx = r[0] + pxX * 40;                       // foreground parallax
    ctx.lineWidth = r[1]; ctx.beginPath();
    ctx.moveTo(rx, H);
    ctx.quadraticCurveTo(rx + sway * 0.5, H - 70, rx + sway, H - 130);
    ctx.stroke();
  });

  // ---- leaping fish: a body arcs out of the water now and then, with a splash ----
  for (const fi of _FISH) {
    const loc = ((tt + fi.phase) % fi.period) / fi.period;
    if (loc >= 0.10) continue;                       // brief leap
    const k = loc / 0.10;                            // 0..1 through the arc
    const fx = fi.x * W, baseY = hY + 14 + (H - hY) * fi.yb;
    const arc = Math.sin(k * Math.PI) * 30;          // height of the leap
    const fy = baseY - arc;
    ctx.save(); ctx.translate(fx, fy); ctx.rotate((k - 0.5) * 1.1);
    ctx.fillStyle = `rgba(190,180,165,${0.7 * (1 - Math.abs(k - 0.5) * 0.6)})`;
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 2.6, 0, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(11, -3); ctx.lineTo(11, 3); ctx.closePath(); ctx.fill();  // tail
    ctx.restore();
    if (k > 0.85) {                                  // splash on re-entry
      ctx.strokeStyle = 'rgba(235,240,232,0.4)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(fx, baseY, 8, 2.6, 0, 0, 6.283); ctx.stroke();
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
    else { ambientRef.current = createAmbient(); if (ambientRef.current) setSoundOn(true); }
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
