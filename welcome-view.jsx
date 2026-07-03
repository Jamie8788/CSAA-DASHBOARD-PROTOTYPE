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
  { baseX: 0.02, y: 0.20, n: 8, sp: 0.020, ph: 0, scale: 1.45 },
  { baseX: 0.38, y: 0.12, n: 6, sp: 0.015, ph: 1.6, scale: 1.05 },
  { baseX: 0.66, y: 0.27, n: 7, sp: 0.012, ph: 3.1, scale: 1.6 },
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
  { x: 0.34, yb: 0.34, period: 8,  phase: 2,   dir: 1 },
  { x: 0.70, yb: 0.50, period: 10, phase: 9,   dir: -1 },
  { x: 0.22, yb: 0.62, period: 9,  phase: 4,   dir: 1 },
  { x: 0.52, yb: 0.42, period: 7,  phase: 5.5, dir: 1 },
  { x: 0.80, yb: 0.36, period: 11, phase: 1.2, dir: -1 },
  { x: 0.44, yb: 0.58, period: 8.5,phase: 7.1, dir: -1 },
  { x: 0.62, yb: 0.66, period: 9.5,phase: 3.3, dir: 1 },
];

// ============================================================================
// REAL BEAR SPRITE PACK (professional asset pack in bear_hunter_dev_asset_pack/)
// Transparent 768x512 frames, pivot bottom-centre (384,450) per the dev README.
// Loaded once, lazily; _SPR.ready flips true only if EVERY frame loaded, so the
// canvas-drawn bear remains as a safe automatic fallback.
// ============================================================================
const _SPRROOT = 'bear_hunter_dev_asset_pack/';
const _SPR = { started: false, ready: false, fail: false, anims: {} };
function _loadSprites() {
  if (_SPR.started) return; _SPR.started = true;
  const groups = { idle: 4, stalk: 6, strike: 6, splash_impact: 3, catch_mouth: 2, recovery_victory: 1 };
  const jobs = [];
  const track = (im) => jobs.push(new Promise((res) => { im.onload = res; im.onerror = () => { _SPR.fail = true; res(); }; }));
  for (const g of Object.keys(groups)) {
    _SPR.anims[g] = [];
    for (let i = 1; i <= groups[g]; i++) {
      const im = new Image();
      im.src = _SPRROOT + '01_bear_transparent_png_frames_768x512/' + g + '/bear_' + g + '_' + String(i).padStart(2, '0') + '.png';
      _SPR.anims[g].push(im); track(im);
    }
  }
  const singles = {
    fishSwim: '02_fish_transparent_png_assets/fish_salmon_side_swim.png',
    patch:    '03_water_fx_transparent_png_assets/water_contact_water_patch.png',
    ripple:   '03_water_fx_transparent_png_assets/water_ripple_medium_01.png',
  };
  for (const k of Object.keys(singles)) {
    const im = new Image(); im.src = _SPRROOT + singles[k];
    _SPR[k] = im; track(im);
  }
  Promise.all(jobs).then(() => { if (!_SPR.fail) _SPR.ready = true; });
}

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
  // (DEEP WATER RUMBLE REMOVED — the low 300Hz noise bed was the "car engine"
  //  Hassan kept hearing. Water is now ONLY the soft higher-frequency lapping.)
  // soft lapping wavelets (stereo) — bright, airy, clearly water (no low rumble)
  [-0.5, 0.5].forEach((pp, idx) => {
    const n = ctx.createBufferSource(); n.buffer = brown(); n.loop = true;
    const hpw = ctx.createBiquadFilter(); hpw.type = 'highpass'; hpw.frequency.value = 700;  // cut all the low rumble
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100 + idx * 300; bp.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = 0.014; const p = pan(pp);
    n.connect(hpw); hpw.connect(bp); bp.connect(g); g.connect(p); p.connect(master);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.2 + idx * 0.12; const lg = ctx.createGain(); lg.gain.value = 0.02;
    lfo.connect(lg); lg.connect(g.gain); n.start(); lfo.start();
  });
  // (PHASE DRONE REMOVED — it sounded like an engine. No continuous tone now;
  //  the soundscape is just soft water + gentle birds + the time-of-day voices.)

  // slow, soft heartbeat (REMOVED — Hassan flagged the existing pads as a
  // "trumpet" noise. Soundscape now: water/wind ambient + scroll-gated
  // rattle/eagle/fish/wolves only. No flute, no loon, no heartbeat, no
  // constant birdsong.)
  function thump() {}
  function heart() {}
  function loon() {}
  function flute() {}
  // gentle, calming birdsong — soft 2-3 note chirps that play through the day
  // (this is the pleasant "alive" layer Hassan wants back). Quiet, sparse.
  function bird() {
    const t = T() + 0.02, p = pan((Math.random() * 2 - 1) * 0.6);
    const base = 1900 + Math.random() * 1500;
    const notes = 2 + Math.floor(Math.random() * 2);
    for (let k = 0; k < notes; k++) {
      const t0 = t + k * (0.09 + Math.random() * 0.05);
      const f = base * (1 + (Math.random() * 0.16 - 0.08));
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f, t0);
      o.frequency.linearRampToValueAtTime(f * 1.2, t0 + 0.04);
      o.frequency.linearRampToValueAtTime(f * 0.96, t0 + 0.1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.026, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
      o.connect(g); g.connect(p); o.start(t0); o.stop(t0 + 0.15);
    }
    p.connect(master);
    // birds quieten down at night
    const gap = (P() > 0.7) ? (9000 + Math.random() * 8000) : (2600 + Math.random() * 3000);
    timers.push(setTimeout(bird, gap));
  }

  // ===========================================================================
  // TIME-OF-DAY VOICES — driven by the scroll position (P()):
  //   morning  (P < 0.30) → traditional Anishinaabe RATTLE that starts the day,
  //                          and a bald eagle's high cry overhead
  //   day      (0.30..0.66) → fish splashing on the lake, an otter slipping in
  //   dusk/night (> 0.66)  → wolves howling on the ridge, the loon takes over
  // ===========================================================================

  // --- Anishinaabe RATTLE (ceremonial shaker that opens the day). A real
  //   rattle is a woody/seed sound, so each "shake" is a short noise grain
  //   with body (lower bandpass + a touch of lowpassed thud). It plays a clear
  //   STEADY rhythm — shake-shake-shake — and repeats through the morning so
  //   the start of the day is unmistakably a rattle.
  // A single very short PEBBLE CLICK (one pebble/seed striking the rawhide shell).
  function pebbleClick(tk, vol, freq) {
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(freq, tk);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, tk + 0.012);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 2.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, tk);
    g.gain.linearRampToValueAtTime(vol, tk + 0.002);          // sharp click attack
    g.gain.exponentialRampToValueAtTime(0.0001, tk + 0.02);   // very short
    o.connect(bp); bp.connect(g); g.connect(master);
    o.start(tk); o.stop(tk + 0.03);
  }
  // ONE SHAKE of the rattle = a dense cluster of pebble/seed clicks within ~45ms
  // (many pebbles + red willow seeds hitting the hide shell at once), over a soft
  // hide-body resonance. This is the dry "shrill rattle to mark the time" sound.
  function oneShake(tk, vol) {
    const pebbles = 10 + Math.floor(Math.random() * 8);       // 10-18 grains per shake
    for (let i = 0; i < pebbles; i++) {
      const jitter = Math.random() * 0.045;                   // spread across the shake
      const f = 2600 + Math.random() * 3200;                  // bright pebble/seed pitches
      pebbleClick(tk + jitter, vol * (0.5 + Math.random() * 0.5), f);
    }
    // soft hide-shell body resonance under the cluster
    const n2 = ctx.createBufferSource(); n2.buffer = brown(); n2.loop = false;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, tk);
    g2.gain.linearRampToValueAtTime(vol * 0.5, tk + 0.005);
    g2.gain.exponentialRampToValueAtTime(0.0001, tk + 0.07);
    n2.connect(lp); lp.connect(g2); g2.connect(master);
    n2.start(tk); n2.stop(tk + 0.09);
  }
  // one ceremonial phrase: paired down-UP wrist shakes (loud forward shake +
  // softer back shake) — the natural "ka-cha ka-cha" of a hand rattle.
  function synthRattle(strong) {
    let t = T() + 0.05;
    const beats = strong ? 10 : 7;
    for (let k = 0; k < beats; k++) {
      oneShake(t, (strong ? 0.34 : 0.26));
      oneShake(t + 0.11, (strong ? 0.20 : 0.16));
      t += 0.30;
    }
  }
  // REAL HAND-RATTLE RECORDING (Hassan supplied audio/rattle.mp4). We try to play
  // the recorded rattle through Web Audio; if loading fails for any reason we
  // silently fall back to the synthesized rattle so the soundscape never breaks.
  let rattleBuffer = null, rattleLoading = false, rattleFailed = false;
  function loadRattle() {
    if (rattleBuffer || rattleLoading || rattleFailed) return;
    rattleLoading = true;
    fetch('audio/rattle.mp4', { cache: 'force-cache' })
      .then(r => r.ok ? r.arrayBuffer() : Promise.reject('http ' + r.status))
      .then(ab => ctx.decodeAudioData(ab))
      .then(buf => { rattleBuffer = buf; rattleLoading = false; })
      .catch(_ => { rattleFailed = true; rattleLoading = false; });
  }
  loadRattle();
  function rattle(strong) {
    if (rattleBuffer) {
      const src = ctx.createBufferSource(); src.buffer = rattleBuffer;
      const g = ctx.createGain(); g.gain.value = strong ? 0.62 : 0.42;
      src.connect(g); g.connect(master);
      src.start(T() + 0.02);
      return;
    }
    synthRattle(strong);
  }
  // morning rattle loop — frequent, so the morning is clearly "rattle time"
  function rattleLoop() {
    if (P() < 0.34) rattle(false);
    timers.push(setTimeout(rattleLoop, 5000 + Math.random() * 4000));
  }

  // --- AFTERNOON BIRDS: gentle songbird chirps (2-3 quick notes), pitched and
  //   soft — the daytime voice Hassan asked for. Plus an occasional distant
  //   eagle cry (kept subtle, not a constant screech).
  function songbird() {
    const t = T() + 0.02, p = pan((Math.random() * 2 - 1) * 0.7);
    const base = 2000 + Math.random() * 1600;
    const notes = 2 + Math.floor(Math.random() * 2);
    for (let k = 0; k < notes; k++) {
      const t0 = t + k * (0.09 + Math.random() * 0.05);
      const f = base * (1 + (Math.random() * 0.16 - 0.08));
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f, t0);
      o.frequency.linearRampToValueAtTime(f * 1.22, t0 + 0.04);
      o.frequency.linearRampToValueAtTime(f * 0.96, t0 + 0.1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.03, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
      o.connect(g); g.connect(p); o.start(t0); o.stop(t0 + 0.15);
    }
    p.connect(master);
  }
  function eagle() {                                    // now: afternoon bird voice
    const pp = P();
    if (pp >= 0.30 && pp <= 0.66) {
      songbird();
      // sometimes a faint, distant eagle cry on top (soft)
      if (Math.random() < 0.25) {
        const t = T() + 0.3, p = pan((Math.random() * 2 - 1) * 0.4);
        const o = ctx.createOscillator(); o.type = 'triangle';
        o.frequency.setValueAtTime(1900, t);
        o.frequency.exponentialRampToValueAtTime(1200, t + 0.25);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 3;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.025, t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        o.connect(bp); bp.connect(g); g.connect(p); p.connect(master);
        o.start(t); o.stop(t + 0.32);
      }
    }
    timers.push(setTimeout(eagle, 2600 + Math.random() * 3200));   // frequent in the afternoon
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

  // --- NIGHT: a SOFT, DISTANT lone wolf — gentle and far away, NOT a horror
  //   howl (Hassan: "really light wolf, not horror movie"). Heavily lowpassed,
  //   quiet, single voice, infrequent. Plus a calm owl hoot now and then.
  function owl() {
    const t = T() + 0.05, p = pan((Math.random() * 2 - 1) * 0.3);
    // two soft low "hoo" notes
    for (let k = 0; k < 2; k++) {
      const t0 = t + k * 0.5;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(360, t0);
      o.frequency.linearRampToValueAtTime(330, t0 + 0.18);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.035, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
      o.connect(lp); lp.connect(g); g.connect(p); o.start(t0); o.stop(t0 + 0.34);
    }
    p.connect(master);
  }
  function wolf() {
    const pp = P();
    if (pp > 0.66) {
      if (Math.random() < 0.5) {
        // a single soft, distant howl
        const t = T() + 0.05;
        const p = pan((Math.random() * 2 - 1) * 0.4);
        const f0 = 250 + Math.random() * 40;
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(f0 * 0.7, t);
        o.frequency.exponentialRampToValueAtTime(f0 * 1.3, t + 0.8);
        o.frequency.exponentialRampToValueAtTime(f0 * 1.0, t + 2.4);
        o.frequency.exponentialRampToValueAtTime(f0 * 0.6, t + 3.4);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;  // far away
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.032, t + 0.8);   // much quieter than before
        g.gain.linearRampToValueAtTime(0.026, t + 2.4);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
        o.connect(lp); lp.connect(g); g.connect(p); p.connect(master);
        o.start(t); o.stop(t + 3.7);
      } else {
        owl();
      }
    }
    timers.push(setTimeout(wolf, 20000 + Math.random() * 18000));   // infrequent
  }

  // --- CAMPFIRE crackle (NIGHT): sparse short noise pops + a soft warm bed,
  //   so the night clearly sounds like sitting around the fire. ---
  let fireBed = null;
  function fireCrackle() {
    const pp = P();
    if (pp > 0.6) {
      // start the warm low bed once we're in the night
      if (!fireBed) {
        const n = ctx.createBufferSource(); n.buffer = brown(); n.loop = true;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480;
        const g = ctx.createGain(); g.gain.value = 0.0001;
        n.connect(lp); lp.connect(g); g.connect(master); n.start();
        g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 1.5);
        fireBed = g;
      }
      // a little burst of crackle pops
      const pops = 2 + Math.floor(Math.random() * 4);
      for (let k = 0; k < pops; k++) {
        const tk = T() + k * (0.04 + Math.random() * 0.09);
        const n = ctx.createBufferSource(); n.buffer = brown(); n.loop = false;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200 + Math.random() * 2200; bp.Q.value = 2;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, tk);
        g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.06, tk + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, tk + 0.04 + Math.random() * 0.05);
        n.connect(bp); bp.connect(g); g.connect(master); n.start(tk); n.stop(tk + 0.12);
      }
    } else if (fireBed) {
      // fade the fire bed out when we leave the night
      try { fireBed.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1.0); } catch (e) {}
      fireBed = null;
    }
    timers.push(setTimeout(fireCrackle, 700 + Math.random() * 900));
  }

  // SOUNDSCAPE (Hassan: "remove all sound, just calming lake + birds + animal
  // voices"). Kept: ambient water lapping (always on, set up earlier) + gentle
  // BIRDSONG + an occasional EAGLE cry + distant WOLF howls at night.
  // Removed: rattle, fire-crackle, fish splashes, otter splashes.
  timers.push(setTimeout(bird, 1500));
  timers.push(setTimeout(eagle, 4500));
  timers.push(setTimeout(wolf, 9000));
  try { master.gain.linearRampToValueAtTime(0.46, T() + 2.6); } catch (e) {}
  return {
    stop() {
      timers.forEach((t) => { if (t && t.__interval != null) clearInterval(t.__interval); else clearTimeout(t); });
      try { master.gain.linearRampToValueAtTime(0.0001, T() + 0.5); } catch (e) {}
      setTimeout(() => { try { ctx.close(); } catch (e) {} }, 700);
    },
  };
}

function drawScene(ctx, W, H, p, tt, now) {
  _loadSprites();   // lazy one-time load of the real bear sprite pack
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
  // ---- AURORA — the northern lights (deep dusk → night). Soft, subtle bands
  //   (Hassan asked me NOT to change the sky — reverted to the original gentle
  //   version, no bright vertical "purple line" curtains). ----
  const aurA = _smooth(0.62, 0.92, p);
  if (aurA > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
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
      ctx.strokeStyle = `rgba(${cols[b]},${aurA * (0.18 + 0.05 * Math.sin(tt * 0.8 + b))})`;
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
    // (Removed the volumetric "god ray" shafts — Hassan found them fake. The
    //  warm halo glow + the sun's reflection on the water carry the light now.)
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

  // ---- GULLS / CRANES gliding LOW over the lake (Hassan wanted lake birds).
  //   They cross just above the water; now and then one dips to the surface to
  //   snatch a fish, sending up a tiny splash. Visible through the lit part of
  //   the day, fading at night. ----
  const gullA = _smooth(0.05, 0.22, p) * (1 - _smooth(0.62, 0.84, p));
  if (gullA > 0.02) {
    ctx.lineCap = 'round';
    const gulls = [
      { bx: 0.20, y: 0.50, sp: 0.045, ph: 0.0, sc: 1.0, dip: 0.0 },
      { bx: 0.55, y: 0.44, sp: 0.038, ph: 1.7, sc: 0.85, dip: 0.5 },
      { bx: 0.78, y: 0.55, sp: 0.052, ph: 3.1, sc: 1.1, dip: 0.0 },
      { bx: 0.40, y: 0.60, sp: 0.041, ph: 4.6, sc: 0.7, dip: 0.0 },
    ];
    for (const g of gulls) {
      const prog = (g.bx + tt * g.sp) % 1.25 - 0.12;       // glide L→R across the lake
      const gx = prog * W;
      const waterY = hY + 10 + (H - hY) * g.y;
      // occasional swoop: dip toward the water mid-crossing, then climb
      const swoop = g.dip > 0 ? Math.max(0, Math.sin((prog - 0.45) * 6)) * 26 * g.dip : 0;
      const gy = waterY - 16 * g.sc + swoop;
      const flap = Math.sin(tt * 5.5 + g.ph);
      const wing = (9 + 4 * Math.abs(flap)) * g.sc;
      ctx.globalAlpha = gullA * 0.9;
      ctx.strokeStyle = `rgba(${Math.round(_lerp(238,150,p))},${Math.round(_lerp(240,150,p))},${Math.round(_lerp(244,156,p))},1)`;
      ctx.lineWidth = 1.6 * g.sc;
      // a relaxed gull "M": two shallow wing-arcs
      ctx.beginPath();
      ctx.moveTo(gx - wing, gy + flap * 2.4);
      ctx.quadraticCurveTo(gx - wing * 0.4, gy - wing * 0.5, gx, gy);
      ctx.quadraticCurveTo(gx + wing * 0.4, gy - wing * 0.5, gx + wing, gy + flap * 2.4);
      ctx.stroke();
      // splash if the gull is at the bottom of a swoop touching the water
      if (g.dip > 0 && swoop > 22) {
        ctx.globalAlpha = gullA * 0.7;
        ctx.fillStyle = 'rgba(244,250,244,0.9)';
        for (let s = 0; s < 4; s++) {
          ctx.beginPath();
          ctx.arc(gx + (s - 1.5) * 3, waterY + 8, 1.1, 0, 6.283); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(244,250,244,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(gx, waterY + 8, 7, 2.2, 0, 0, 6.283); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- BALD EAGLE (migizi) — SIDE PROFILE in flight, fully animated. A side
  //   view reads clearly at any size (the top-down versions never did). The
  //   eagle crosses the sky with slow, powerful WING BEATS: the wing sweeps
  //   from raised over the back to swept below the body, the body rises on
  //   each downstroke, the tail trims, the head stays level like a real bird.
  const eagA = _smooth(0.06, 0.24, p) * (1 - _smooth(0.62, 0.84, p));
  if (eagA > 0.02) {
    const ex = ((tt * 0.016) % 1.3 - 0.15) * W;                 // crosses L→R
    const flapT = Math.sin(tt * 3.2);                           // slow, powerful beats
    const ey = hY * 0.28 + Math.sin(tt * 0.5) * 10 - flapT * 2; // body lifts on the downstroke
    ctx.save(); ctx.globalAlpha = eagA;
    ctx.translate(ex, ey);
    ctx.scale(-1.35, 1.35);  // mirrored: head leads the L→R flight
    const dark = 'rgba(52,36,22,1)';
    // FAR WING (behind the body, half a beat out of phase visually smaller)
    {
      const lift = flapT * 14;
      ctx.fillStyle = 'rgba(38,26,16,1)';
      ctx.beginPath();
      ctx.moveTo(2, -3);
      ctx.quadraticCurveTo(10, -8 - lift * 0.7, 22, -6 - lift);          // leading edge up/back
      ctx.quadraticCurveTo(24, -2 - lift, 18, 1 - lift * 0.4);           // wingtip
      ctx.quadraticCurveTo(9, 2, 2, 0);                                   // trailing edge back to body
      ctx.closePath(); ctx.fill();
    }
    // BODY — sleek horizontal fuselage, dark brown
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-14, 0);                                                    // chest front
    ctx.quadraticCurveTo(-6, -5, 6, -4);                                   // back
    ctx.quadraticCurveTo(16, -3, 22, -1);                                  // toward tail root
    ctx.quadraticCurveTo(14, 3, 4, 4);                                     // belly
    ctx.quadraticCurveTo(-8, 5, -14, 0);
    ctx.closePath(); ctx.fill();
    // WHITE TAIL — fanned, trimming slightly with the beat
    ctx.fillStyle = 'rgba(244,242,236,1)';
    ctx.beginPath();
    ctx.moveTo(20, -2);
    ctx.lineTo(30, -4 + flapT * 1.5);
    ctx.lineTo(31, 1 + flapT * 1.5);
    ctx.lineTo(21, 2);
    ctx.closePath(); ctx.fill();
    // NEAR WING — the star of the animation. Shoulder at (-2,-3). The wing
    // sweeps through a full beat: raised high over the back → level → swept
    // down below the belly. Broad inner wing + 4 long fingered primaries.
    {
      const lift = flapT * 22;                                              // -22 (down) .. +22 (up)
      const wx = -2, wy = -3;
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.quadraticCurveTo(wx - 6, wy - 6 - lift * 0.55, wx - 4, wy - lift);        // inner wing rises
      ctx.quadraticCurveTo(wx - 2 , wy - lift - 3, wx + 8, wy - lift - 2);           // mid-wing
      ctx.quadraticCurveTo(wx + 18, wy - lift, wx + 20, wy - lift + 2);              // to the wrist
      ctx.quadraticCurveTo(wx + 12, wy + 2, wx + 4, wy + 3);                          // trailing edge home
      ctx.closePath(); ctx.fill();
      // fingered primaries splaying from the wrist
      ctx.strokeStyle = dark; ctx.lineWidth = 2.0; ctx.lineCap = 'round';
      for (let ftr = 0; ftr < 4; ftr++) {
        const baseX2 = wx + 20, baseY2 = wy - lift + 2;
        ctx.beginPath();
        ctx.moveTo(baseX2, baseY2);
        ctx.lineTo(baseX2 + 7 + ftr * 1.5, baseY2 + 2 + ftr * 2.5 - lift * 0.25);
        ctx.stroke();
      }
      // pale feather-edge along the inner wing (subtle woodland-art accent)
      ctx.strokeStyle = 'rgba(210,218,228,0.5)'; ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(wx - 2, wy - lift * 0.8);
      ctx.quadraticCurveTo(wx + 8, wy - lift - 1, wx + 18, wy - lift + 1);
      ctx.stroke();
    }
    // WHITE HEAD — forward of the chest, level gaze
    ctx.fillStyle = 'rgba(244,242,236,1)';
    ctx.beginPath();
    ctx.moveTo(-13, -4);
    ctx.quadraticCurveTo(-20, -6, -23, -2);                                 // crown → forehead
    ctx.quadraticCurveTo(-20, 2, -13, 1);                                    // throat back to chest
    ctx.closePath(); ctx.fill();
    // GOLDEN HOOKED BEAK
    ctx.fillStyle = 'rgba(226,176,48,1)';
    ctx.beginPath();
    ctx.moveTo(-23, -3);
    ctx.quadraticCurveTo(-28, -2.5, -27.5, -0.5);                            // upper mandible
    ctx.quadraticCurveTo(-26, 1.5, -23, 0.5);                                // hook curls down & back
    ctx.closePath(); ctx.fill();
    // fierce EYE with brow
    ctx.fillStyle = 'rgba(20,14,8,1)';
    ctx.beginPath(); ctx.arc(-19.5, -2.2, 1.0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(120,110,96,0.8)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(-21.5, -3.6); ctx.lineTo(-17.5, -3.2); ctx.stroke();  // brow ridge
    // TALONS tucked under the tail in flight
    ctx.strokeStyle = 'rgba(226,176,48,1)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(8, 4); ctx.lineTo(12, 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(11, 4); ctx.lineTo(15, 5.5); ctx.stroke();
    ctx.restore();
  }
  // ---- RAVENS — a pair flapping & tumbling near the treeline (croaking sentries
  //   of the bush). Quick wingbeats + the odd barrel-roll, clearly black. ----
  const ravA = (1 - _smooth(0.66, 0.86, p));
  if (ravA > 0.04) {
    for (let rv = 0; rv < 2; rv++) {
      const rt = tt * 0.5 + rv * 3.0;
      const rx = W * (0.30 + rv * 0.06) + Math.cos(rt) * W * 0.05;
      const ry = hY * 0.5 + Math.sin(rt * 1.4) * 22 - rv * 10;
      const flap = Math.sin(tt * 6 + rv * 2);
      const roll = (Math.sin(rt * 0.7) > 0.9) ? Math.sin(tt * 8) : 0;        // occasional tumble
      const wing = (7 + 3 * Math.abs(flap));
      ctx.globalAlpha = ravA * 0.95;
      ctx.strokeStyle = 'rgba(16,14,18,1)'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(rx - wing, ry + flap * 3 + roll * 3);
      ctx.quadraticCurveTo(rx - wing * 0.3, ry - wing * 0.5, rx, ry);
      ctx.quadraticCurveTo(rx + wing * 0.3, ry - wing * 0.5, rx + wing, ry + flap * 3 - roll * 3);
      ctx.stroke();
      // wedge tail + head (raven silhouette)
      ctx.fillStyle = 'rgba(16,14,18,1)';
      ctx.beginPath(); ctx.ellipse(rx, ry, 2.2, 1.2, 0, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.moveTo(rx - 2, ry); ctx.lineTo(rx - 5, ry - 1); ctx.lineTo(rx - 2, ry + 1); ctx.fill();
    }
    ctx.globalAlpha = 1;
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
  ctx.beginPath(); ctx.ellipse(cx, cy + 9 * scl, 60 * scl, 7 * scl, 0, 0, 6.283); ctx.fill();
  ctx.restore();

  // soft reflection of the canoe on the water (flipped, faded)
  ctx.save();
  ctx.translate(cx, cy + 16 * scl); ctx.scale(scl, -scl * 0.5); ctx.globalAlpha = 0.13;
  ctx.beginPath(); ctx.moveTo(-56, 0); ctx.quadraticCurveTo(0, 18, 56, 0); ctx.quadraticCurveTo(0, 6, -56, 0);
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
  // ---- BIRCH-BARK ANISHINAABE CANOE (wiigwaasi-jiimaan) ----
  //   Tuned to match real birch-bark canoes in the reference photos: pale
  //   cream/golden bark colour, dramatically upturned stem & stern that rise
  //   well above the sheer line, dark horizontal seams running along the bark
  //   sheets, lighter wooden gunwale, exposed cedar ribs inside.
  ctx.beginPath();
  ctx.moveTo(-58, -2);
  ctx.bezierCurveTo(-78, -10, -82, -28, -58, -26);                            // sharply upturned STERN (left)
  ctx.bezierCurveTo(-50, -22, -30, -14, 0, -12);                              // sweeping sheer down
  ctx.bezierCurveTo(30, -14, 50, -22, 58, -26);
  ctx.bezierCurveTo(82, -28, 78, -10, 58, -2);                                // sharply upturned BOW (right)
  ctx.quadraticCurveTo(0, 20, -58, -2);                                       // smooth keel-line bottom
  ctx.closePath();
  // FOUR-COLOURED HULL BODY (Hassan: the canoe BODY itself in 4 colours, not
  // brown). The four sacred / four-direction colours painted as four panels
  // along the length — black (stern), red, yellow, white (bow) — each shaded
  // top-to-keel so it still reads as a rounded hull, not flat blocks.
  ctx.save();
  ctx.clip();                                                                  // clip to the hull silhouette
  const panelCols = [
    [60, 60, 66],     // black-ish (stern)
    [196, 52, 32],    // red
    [232, 184, 52],   // yellow
    [238, 234, 224],  // white (bow)
  ];
  for (let pi = 0; pi < 4; pi++) {
    const x0 = -84 + pi * 42, x1 = x0 + 42;                                   // four bands across the hull width
    const [r, g, b] = panelCols[pi];
    const pg = ctx.createLinearGradient(0, -26, 0, 22);
    pg.addColorStop(0,    `rgb(${Math.min(255,r+40)},${Math.min(255,g+40)},${Math.min(255,b+40)})`);  // lit rim
    pg.addColorStop(0.55, `rgb(${r},${g},${b})`);
    pg.addColorStop(1,    `rgb(${Math.round(r*0.42)},${Math.round(g*0.42)},${Math.round(b*0.42)})`);   // shadow at keel
    ctx.fillStyle = pg;
    ctx.fillRect(x0, -30, x1 - x0, 56);
  }
  ctx.restore();
  // (Removed the dense horizontal bark-seam lines — crossing the ribs they read
  //  as a "net of squares" on the hull. The hull now keeps the 4 colour panels
  //  clean, with just the ribs + gunwale + lashing as real canoe detail.)
  // a darker waterline shadow along the keel (where the hull sits in the lake)
  ctx.strokeStyle = 'rgba(28,16,8,0.65)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-58, -1); ctx.quadraticCurveTo(0, 18, 58, -1); ctx.stroke();
  // gunwale strip (lighter wood band along the rim, follows the rising stems)
  ctx.strokeStyle = 'rgba(244,206,150,0.95)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-58, -24);
  ctx.bezierCurveTo(-50, -20, -30, -14, 0, -12);
  ctx.bezierCurveTo(30, -14, 50, -20, 58, -24);
  ctx.stroke();
  // warm rim-light along the sun-side gunwale
  ctx.strokeStyle = 'rgba(255,222,166,0.7)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(rim * 10, -8); ctx.quadraticCurveTo(rim * 56, -14, rim * 60, -3); ctx.stroke();
  // RIBS — the characteristic curved transverse cedar ribs of a birch-bark
  // canoe, evenly spaced (clean, not a grid). Dark enough to read over the
  // colour panels but not busy.
  ctx.strokeStyle = 'rgba(38,22,12,0.5)'; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
  for (let rb = -46; rb <= 46; rb += 9) {
    const span = 1 - Math.abs(rb) / 70;                                        // shorter ribs toward the ends
    ctx.beginPath();
    ctx.moveTo(rb, -9 * span - 2);
    ctx.quadraticCurveTo(rb * 0.5, 12 * span + 2, rb * 0.9, 13 * span);
    ctx.stroke();
  }
  // LASHING at the bow & stern stems (spruce-root wraps around the upturned
  // ends — a signature detail in the reference photos).
  ctx.strokeStyle = 'rgba(54,32,16,0.8)'; ctx.lineWidth = 1.0;
  for (const sgn of [-1, 1]) {
    for (let w = 0; w < 5; w++) {
      const lx = sgn * (52 + w * 1.6);
      ctx.beginPath(); ctx.moveTo(lx, -24 + w * 1.2); ctx.lineTo(lx + sgn * 4, -16 + w * 1.6); ctx.stroke();
    }
  }
  // a single clean stitched bark seam along the sheer (not a grid)
  ctx.strokeStyle = 'rgba(40,22,12,0.5)'; ctx.lineWidth = 0.6;
  ctx.setLineDash([1.5, 2.2]);
  ctx.beginPath(); ctx.moveTo(-54, -6); ctx.quadraticCurveTo(0, -2, 54, -6); ctx.stroke();
  ctx.setLineDash([]);
  // bow lantern pole + lantern
  if (night) {
    ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(40, -6); ctx.lineTo(40, -18); ctx.stroke();
    ctx.fillStyle = '#ffce7a'; ctx.beginPath(); ctx.arc(40, -21, 3.4, 0, 6.283); ctx.fill();
  }
  // --- TWO PADDLERS (Hassan: max two). One in the bow, one in the stern,
  //     paddling on FIXED OPPOSITE sides like a real canoe (bow-right,
  //     stern-left) so their paddles & hands can never collide. They stroke
  //     in unison; the stroke drives the blade fore→aft, not across the hull.
  const skin = '#b7855a';
  // ONE MALE + ONE FEMALE (Hassan). Male in the bow wears RED; female in the
  // stern wears ORANGE. Male has short hair; female has long hair.
  const crew = [
    { x: -30, shirt: '#e0852f', hair: 'long',  side: -1, phase: 0.0, female: true },  // stern, FEMALE (orange)
    { x:  30, shirt: '#c0301c', hair: 'short', side:  1, phase: 0.0, female: false }, // bow, MALE (red)
  ];
  crew.forEach((pdl) => {
    const stroke = Math.sin(tt * 2.0 + pdl.phase);
    const localSide = pdl.side;                       // FIXED — never crosses the hull
    const lean = localSide * 0.06 * Math.abs(stroke);
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
    } else if (pdl.hair === 'long') {
      ctx.fillStyle = '#1a0e08';
      ctx.beginPath();
      ctx.moveTo(-4.2, -26); ctx.quadraticCurveTo(-5, -22, -3, -18); ctx.lineTo(3, -18);
      ctx.quadraticCurveTo(5, -22, 4.2, -26); ctx.closePath(); ctx.fill();
    }
    // rim light on the lit side
    ctx.strokeStyle = 'rgba(255,210,150,0.55)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, -26, 4.2, rim < 0 ? 1.9 : -1.2, rim < 0 ? 4.4 : 1.3); ctx.stroke();
    // paddle — held in both hands, blade fixed to `localSide`. The stroke
    // moves the blade FORE→AFT (forward catch → back pull), never across the
    // hull, so two paddlers on opposite sides can't clash.
    const reach = stroke * 10;                         // fore(+) to aft(-) sweep along the hull
    const topGrip = [localSide * 3, -20];
    const bladeTip = [localSide * 26, 9 + reach];
    const lowGrip = [topGrip[0] + (bladeTip[0] - topGrip[0]) * 0.45, topGrip[1] + (bladeTip[1] - topGrip[1]) * 0.45];
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
    const lx0 = W * 0.45;                                  // shore starts much earlier — bigger village land (Hassan)
    const RISE = H * 0.30;                                  // taller, deeper bank — far more room for activity
    const shoreY = (x) => { const t = _clamp((x - lx0) / (W - lx0), 0, 1); return H - 6 - RISE * (t * 0.6 + t * t * 0.4); };
    const ground = (x) => shoreY(x) + 9;
    // ---- REALISTIC SMOKE: a column of soft puffs that rise, expand, drift on a
    //   light breeze and fade out. baseScale sets the column height; alpha scales
    //   the whole plume. Replaces the old single wavy line. ----
    const puffSmoke = (px, py, baseScale, alpha) => {
      ctx.save();
      // TWO independent streams of puffs, offset in seed + drift direction,
      // so the column reads as turbulent rolling smoke rather than a tidy
      // chain of beads. Each puff rises, expands, drifts and fades.
      const N = 11;                                         // puffs per stream
      const rise = 14 * baseScale;                          // vertical spacing
      const streams = [
        { seed: 0,    driftDir:  1, hueBias:  0 },
        { seed: 0.37, driftDir: -1, hueBias: -8 },
      ];
      for (const st of streams) {
        for (let i = 0; i < N; i++) {
          const life = ((tt * 0.42 + st.seed + i / N) % 1);
          const yy = py - life * rise * N;
          const wob = Math.sin(life * 5.5 + i + st.seed * 7) * 2.2;            // small wobble
          const drift = (Math.sin(life * 2.2 + i + st.seed) * (3 + life * 12) + life * 14) * st.driftDir;
          const xx = px + drift + wob;
          const rad = (2.2 + life * 12) * baseScale;        // grows as it rises
          const a = alpha * 0.36 * (1 - life * 0.92) * Math.min(1, life * 5);
          if (a <= 0.01) continue;
          const tone = Math.round(_lerp(218, 150, nm)) + st.hueBias;
          const gpf = ctx.createRadialGradient(xx, yy, 0, xx, yy, rad);
          gpf.addColorStop(0,    `rgba(${tone + 12},${tone + 8},${tone},${a})`);
          gpf.addColorStop(0.55, `rgba(${tone},${tone - 4},${tone - 12},${a * 0.7})`);
          gpf.addColorStop(1,    `rgba(${tone - 24},${tone - 28},${tone - 36},0)`);
          ctx.fillStyle = gpf;
          ctx.beginPath(); ctx.arc(xx, yy, rad, 0, 6.283); ctx.fill();
        }
      }
      // small dark base — the dense, dirty smoke right at the source
      if (alpha > 0.05) {
        const base = ctx.createRadialGradient(px, py + 1, 0, px, py + 1, 7 * baseScale);
        base.addColorStop(0, `rgba(70,60,50,${alpha * 0.55})`);
        base.addColorStop(1, 'rgba(70,60,50,0)');
        ctx.fillStyle = base;
        ctx.beginPath(); ctx.ellipse(px, py + 1, 7 * baseScale, 3 * baseScale, 0, 0, 6.283); ctx.fill();
      }
      ctx.restore();
    };
    // land bank
    const et = [Math.round(_lerp(74, 32, nm)), Math.round(_lerp(82, 40, nm)), Math.round(_lerp(50, 28, nm))];
    const eb = [Math.round(_lerp(42, 17, nm)), Math.round(_lerp(48, 22, nm)), Math.round(_lerp(28, 14, nm))];
    const lgr = ctx.createLinearGradient(0, H * 0.66, 0, H);
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
    const cattailClumps = [[W * 0.68, 5], [W * 0.86, 6]];
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
    // smoke billowing up from the apex — soft expanding puffs that rise, drift
    // and fade (realistic volume rather than a single wavy line)
    if (nm < 0.95) puffSmoke(smx, smy - 26, 1.0, (1 - nm * 0.7));
    // ---- a WILD-RICE POUNDING MORTAR: a tall wooden bucket with a long pestle
    //   that someone strikes down into it (manoomin processing). The pestle
    //   animates up & down for life. ----
    const wmx = W * 0.705, wmy = ground(wmx);   // moved right, clear of the bear's space
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
    // pestle — only STRIKES while the pounder is present (day). When the
    // village winds down (night) it RESTS leaning in the mortar, instead of
    // bobbing on its own (Hassan: "that stick is moving on its own" at night).
    const pounding = nm < 0.5;                                          // someone is at the mortar
    ctx.strokeStyle = `rgb(${Math.round(_lerp(80, 40, nm))},${Math.round(_lerp(50, 24, nm))},${Math.round(_lerp(26, 12, nm))})`;
    ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    if (pounding) {
      const pound = Math.abs(Math.sin(tt * 2.6));
      const peY = wmy - 28 + pound * 12;                               // up/down stroke
      ctx.beginPath(); ctx.moveTo(wmx, peY); ctx.lineTo(wmx, peY - 32); ctx.stroke();
      if (pound > 0.85) {
        ctx.fillStyle = `rgba(220,206,168,${(pound - 0.85) * 4 * (1 - nm * 0.6)})`;
        ctx.beginPath(); ctx.ellipse(wmx, wmy - 14, 8, 2.4, 0, 0, 6.283); ctx.fill();
      }
    } else {
      // resting: leaned against the rim of the mortar, static
      ctx.beginPath(); ctx.moveTo(wmx + 4, wmy - 16); ctx.lineTo(wmx + 12, wmy - 44); ctx.stroke();
    }
    // ---- a ceremonial drum on a low stand near the fire (Anishinaabe day activity) ----
    const drx = W * 0.665, dry = ground(drx) + 4;   // moved right, clear of the bear
    ctx.fillStyle = `rgba(${Math.round(_lerp(108, 52, nm))},${Math.round(_lerp(68, 32, nm))},${Math.round(_lerp(34, 16, nm))},1)`;
    ctx.beginPath(); ctx.ellipse(drx, dry, 7, 4.4, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = `rgba(${Math.round(_lerp(192, 96, nm))},${Math.round(_lerp(172, 84, nm))},${Math.round(_lerp(132, 62, nm))},1)`;
    ctx.beginPath(); ctx.ellipse(drx, dry - 1, 6.4, 3.6, 0, 0, 6.283); ctx.fill();
    // ---- a BEACHED birch-bark canoe pulled up on the shore (sign the village
    //   uses the lake; matches the canoe out on the water). ----
    {
      const cxB = W * 0.71, cyB = ground(cxB) + 3;
      ctx.save(); ctx.translate(cxB, cyB);
      const bg = ctx.createLinearGradient(0, -7, 0, 6);
      bg.addColorStop(0, `rgb(${Math.round(_lerp(220, 110, nm))},${Math.round(_lerp(160, 80, nm))},${Math.round(_lerp(112, 56, nm))})`);
      bg.addColorStop(1, `rgb(${Math.round(_lerp(140, 60, nm))},${Math.round(_lerp(92, 44, nm))},${Math.round(_lerp(58, 28, nm))})`);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(-26, 0);
      ctx.quadraticCurveTo(-32, -12, -22, -9);
      ctx.quadraticCurveTo(0, -4, 22, -9);
      ctx.quadraticCurveTo(32, -12, 26, 0);
      ctx.quadraticCurveTo(0, 7, -26, 0);
      ctx.closePath(); ctx.fill();
      // bark stripes
      ctx.strokeStyle = 'rgba(60,36,20,0.5)'; ctx.lineWidth = 0.6;
      for (let yb = -5; yb <= 4; yb += 2) {
        ctx.beginPath(); ctx.moveTo(-24, yb); ctx.quadraticCurveTo(0, yb + 2, 24, yb); ctx.stroke();
      }
      ctx.restore();
    }
    // ---- a WOODPILE: stacked split logs (shows the chopping has a purpose) ----
    {
      const lpx = W * 0.69, lpy = ground(lpx);
      ctx.fillStyle = `rgb(${Math.round(_lerp(120, 56, nm))},${Math.round(_lerp(80, 38, nm))},${Math.round(_lerp(46, 22, nm))})`;
      // two stacked rows of logs (end-grain circles)
      for (let row = 0; row < 2; row++) {
        for (let c = 0; c < 5 - row; c++) {
          const ex = lpx - 8 + c * 4 + row * 2;
          const ey = lpy - 2 - row * 4;
          ctx.beginPath(); ctx.arc(ex, ey, 1.8, 0, 6.283); ctx.fill();
          // growth rings
          ctx.strokeStyle = 'rgba(40,22,10,0.6)'; ctx.lineWidth = 0.4;
          ctx.beginPath(); ctx.arc(ex, ey, 0.9, 0, 6.283); ctx.stroke();
        }
      }
    }
    // (No dwellings/houses in this scene — Hassan: houses are not allowed here.
    //  The bank shows only outdoor work + activity, water, animals and plants.)
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
    // realistic rising smoke from the fire (taller column)
    if (nm < 0.95) puffSmoke(fx, fy - 9, 1.25, (1 - nm * 0.6));
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
      const bh = 30 * sc;                                       // +25% — villagers properly scaled to the bear/horse
      const headR = 4.2 * sc;
      const hipY = py - bh * 0.40;
      const shoulderY = py - bh * 0.82;
      const headCY = py - bh * 0.96 - headR * 1.0;

      // walking gait: opposing legs, swinging arms. 'dance' also steps (the
      // children's feet move in the friendship dance), but its arms are held
      // OUT to the sides holding hands, not swinging.
      const steps = (kind === 'walk' || kind === 'dance');
      const gait = steps ? Math.sin(tt * 3.6 + ph) : 0;
      const armSwing = (kind === 'walk') ? gait * 0.55 : 0;
      const legL = gait * 3.2 * sc;
      const legR = -legL;
      const bodyBob = Math.sin(tt * 1.4 + ph) * 0.4 * sc + (steps ? Math.abs(gait) * 0.6 * sc : 0);

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
        // cross-legged seated: a small, low crossed-legs base (NOT a big round
        // "butt" — Hassan). One slim crossed-leg shape tucked under the torso.
        ctx.fillStyle = leg;
        ctx.beginPath(); ctx.ellipse(px, hipY + 1.6 * sc, 3.6 * sc, 1.5 * sc, 0, 0, 6.283); ctx.fill();
        // a couple of short shins crossing in front
        ctx.strokeStyle = leg; ctx.lineWidth = 1.6 * sc; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px - 3 * sc, hipY + 2.2 * sc); ctx.lineTo(px + 1.5 * sc, hipY + 1.2 * sc); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px + 3 * sc, hipY + 2.2 * sc); ctx.lineTo(px - 1.5 * sc, hipY + 1.2 * sc); ctx.stroke();
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
      // RIBBON-WORK detailing (Hassan: richer shirts). A pale ribbon band across
      // the chest with a row of applique TRIANGLES, a vertical ribbon down the
      // front, and a coloured hem band — the look of a real ribbon shirt.
      const ribTop = shoulderY - bodyBob + 3.0 * sc;
      ctx.fillStyle = 'rgba(245,232,200,0.9)';
      ctx.fillRect(torsoX - 3.6 * sc, ribTop, 7.2 * sc, 0.8 * sc);                 // chest ribbon
      // a row of little applique triangles along the band (per-figure accent hue)
      const accent = ['rgba(214,90,40,0.95)', 'rgba(60,120,170,0.95)', 'rgba(210,170,60,0.95)', 'rgba(120,150,80,0.95)'][Math.floor(ph) % 4];
      ctx.fillStyle = accent;
      for (let tr = -3; tr <= 3; tr++) {
        const txc = torsoX + tr * 1.1 * sc;
        ctx.beginPath();
        ctx.moveTo(txc - 0.5 * sc, ribTop + 0.8 * sc);
        ctx.lineTo(txc + 0.5 * sc, ribTop + 0.8 * sc);
        ctx.lineTo(txc, ribTop + 1.7 * sc);
        ctx.closePath(); ctx.fill();
      }
      // vertical ribbon down the centre-front
      ctx.fillStyle = 'rgba(245,232,200,0.7)';
      ctx.fillRect(torsoX - 0.35 * sc, ribTop + 1.7 * sc, 0.7 * sc, (torsoY - ribTop) - 2.0 * sc);
      // coloured hem band at the bottom of the shirt
      ctx.fillStyle = accent;
      ctx.fillRect(torsoX - 3.9 * sc, torsoY - 1.0 * sc, 7.8 * sc, 0.9 * sc);

      // ---- ARMS (in skin tone) + activity hand ----
      const sArmY = shoulderY - bodyBob + 1.2 * sc;
      // base resting arm positions
      const bArmAng = (kind === 'walk') ? armSwing : Math.sin(tt * 1.3 + ph) * 0.15;
      // left arm (back-swing in walk; reaches OUT & slightly DOWN to hold a
      // neighbour's hand in the dance — at linked-hand height, not raised)
      if (kind === 'dance') {
        limb(torsoX - 3.4 * sc, sArmY, torsoX - 9 * sc, sArmY + 5 * sc, 2.0 * sc, skin);
      } else {
        limb(torsoX - 3.4 * sc, sArmY,
             torsoX - 3.4 * sc - Math.sin(bArmAng) * 5 * sc,
             sArmY + 6 * sc + Math.cos(bArmAng) * 1.5 * sc,
             2.4 * sc, skin);
      }
      // right arm — driven by activity
      let rArmEndX = torsoX + 3.4 * sc + Math.sin(-bArmAng) * 5 * sc;
      let rArmEndY = sArmY + 6 * sc + Math.cos(-bArmAng) * 1.5 * sc;
      if (kind === 'dance') {
        rArmEndX = torsoX + 9 * sc; rArmEndY = sArmY + 5 * sc;                              // reach out-right & down (hand-hold)
      } else if (kind === 'stir') {
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
      } else if (kind === 'chop') {
        // BOTH hands grip an axe; it arcs from UP-HIGH (cocked) down to the LOG
        // on the ground in front of the feet, so it actually strikes wood.
        const chop = (Math.sin(tt * 2.4 + ph) + 1) / 2;             // 0=raised, 1=struck
        // the chopping block / log sits just in front of the figure at foot level
        const logX = px + dir * 7 * sc, logY = py - 1.5 * sc;
        // axe-head travels along an arc from high-back to the log
        const upX = px + dir * 1 * sc, upY = sArmY - 12 * sc;        // cocked high above the shoulder
        const ax = upX + (logX - upX) * chop;
        const ay = upY + (logY - upY) * (chop * chop);              // accelerate down onto the log
        // hands grip near the top of the handle, between shoulder and axe-head
        const handX = torsoX + dir * 2 * sc + (ax - torsoX) * 0.35;
        const handY = sArmY + (ay - sArmY) * 0.35;
        limb(torsoX - 3.4 * sc, sArmY, handX - 1.5 * sc, handY, 2.4 * sc, skin);
        limb(torsoX + 3.4 * sc, sArmY, handX + 1.5 * sc, handY, 2.4 * sc, skin);
        // axe handle from the hands to the head
        ctx.strokeStyle = '#5a3a1c'; ctx.lineWidth = 1.8 * sc; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(handX, handY); ctx.lineTo(ax, ay); ctx.stroke();
        // axe head
        ctx.fillStyle = '#3a3a40';
        ctx.beginPath();
        ctx.moveTo(ax - dir * 1.0 * sc, ay - 1.6 * sc);
        ctx.lineTo(ax + dir * 3.4 * sc, ay - 0.6 * sc);
        ctx.lineTo(ax + dir * 3.2 * sc, ay + 1.8 * sc);
        ctx.lineTo(ax - dir * 1.0 * sc, ay + 1.6 * sc);
        ctx.closePath(); ctx.fill();
        // the LOG on its chopping block (always drawn so there is wood to cut)
        ctx.fillStyle = '#7a4e28';
        ctx.beginPath(); ctx.ellipse(logX, logY, 4.2 * sc, 2.2 * sc, 0, 0, 6.283); ctx.fill();
        ctx.strokeStyle = 'rgba(40,24,10,0.7)'; ctx.lineWidth = 0.5 * sc;
        ctx.beginPath(); ctx.arc(logX, logY, 1.8 * sc, 0, 6.283); ctx.stroke();
        // wood chips fly when the axe lands
        if (chop > 0.82) {
          ctx.fillStyle = '#b98a52';
          for (let cc = 0; cc < 3; cc++) {
            const a2 = -0.6 - cc * 0.5;
            ctx.beginPath(); ctx.arc(logX + Math.cos(a2) * 5 * sc, logY + Math.sin(a2) * 5 * sc, 0.8 * sc, 0, 6.283); ctx.fill();
          }
        }
        rArmEndX = handX; rArmEndY = handY;                          // suppress default right arm
      } else if (kind === 'scrape') {
        // bent forward, both hands sliding a scraping stone back-and-forth along the hide
        const slide = Math.sin(tt * 3 + ph);                          // -1..1 along the hide
        const sx = torsoX + dir * (6 + slide * 4) * sc;
        const sy = sArmY + 4 * sc;
        limb(torsoX - 3.4 * sc, sArmY, sx - 1.5 * sc, sy, 2.4 * sc, skin);
        limb(torsoX + 3.4 * sc, sArmY, sx + 1.5 * sc, sy, 2.4 * sc, skin);
        // the stone scraper
        ctx.fillStyle = '#7a7068';
        ctx.beginPath(); ctx.ellipse(sx, sy, 2.2 * sc, 1.1 * sc, 0, 0, 6.283); ctx.fill();
        rArmEndX = sx + 1.5 * sc; rArmEndY = sy;
      } else if (kind === 'pound') {
        // BOTH hands on a tall pestle, lifting and slamming straight down into a rice mortar
        const phase = Math.sin(tt * 2.6 + ph);                        // -1..1
        const lift = (phase + 1) / 2;                                  // 0=down, 1=up
        const px2 = torsoX + dir * 2 * sc;
        const peTop = sArmY - (2 + lift * 8) * sc;                     // top of the pestle
        const peBot = sArmY + (10 - lift * 4) * sc;                    // bottom (strikes into mortar at lift=0)
        // both hands gripping the pestle near the top
        limb(torsoX - 3.4 * sc, sArmY, px2 - 1 * sc, peTop + 2 * sc, 2.4 * sc, skin);
        limb(torsoX + 3.4 * sc, sArmY, px2 + 1 * sc, peTop + 4 * sc, 2.4 * sc, skin);
        // pestle (long wooden pole)
        ctx.strokeStyle = '#6b4626'; ctx.lineWidth = 1.8 * sc; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px2, peTop); ctx.lineTo(px2, peBot); ctx.stroke();
        rArmEndX = px2 + 1 * sc; rArmEndY = peTop + 4 * sc;
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
    // SHARP DAY↔NIGHT CROSSFADE (fix ghost overlap): the day vignette and night
    // fire-circle previously both rendered with low alpha across a wide nm range,
    // making villagers look ghostly. Now they hand over over a narrow ~10% window
    // centred at nm=0.5, so figures cleanly fade out / in at scene change.
    const dayA   = _clamp((0.55 - nm) / 0.10, 0, 1);   // 1 below 0.45, 0 above 0.55
    const nightA = _clamp((nm - 0.45) / 0.10, 0, 1);   // 0 below 0.45, 1 above 0.55
    if (dayA > 0.02) {
      ctx.save(); ctx.globalAlpha = dayA;
      // ---- VILLAGE STAGED AS WORK VIGNETTES ----
      // ACTIVITIES VARY BY TIME OF DAY (Hassan: "should vary from day → evening → night")
      //   MORNING  (p < 0.20)  : woodcutter chops, gardener tends, walkers head out
      //   MIDDAY   (0.20-0.36) : full village — pounding rice, hide work, weaving,
      //                          kids playing, fishing, smokehouse running
      //   EVENING  (0.36-0.55) : kids settle, hide-scraping wraps, food brought to
      //                          the fire; walkers heading home; gardener gone
      // The flags below let any vignette skip drawing outside its window.
      // smooth membership 0..1 for each phase so figures gently fade in/out
      // across phase boundaries instead of popping (Hassan: "smooth transitions")
      const wMorning = _clamp((0.22 - p) / 0.08, 0, 1);                                          // 1 until ~0.14, fades to 0 by ~0.22
      const wMidday  = _clamp((p - 0.14) / 0.08, 0, 1) * _clamp((0.40 - p) / 0.08, 0, 1);         // peaks midday
      const wEvening = _clamp((p - 0.32) / 0.08, 0, 1);                                          // fades in from 0.32 onward
      const isMorning = wMorning > 0.5;
      const isMidday  = wMidday  > 0.5;
      const isEvening = wEvening > 0.5;

      // helper: a dark trodden-earth patch under a work station
      const earth = (ex, ey, w) => {
        const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, w);
        g.addColorStop(0, `rgba(${Math.round(_lerp(64, 34, nm))},${Math.round(_lerp(46, 24, nm))},${Math.round(_lerp(28, 14, nm))},0.55)`);
        g.addColorStop(1, `rgba(${Math.round(_lerp(64, 34, nm))},${Math.round(_lerp(46, 24, nm))},${Math.round(_lerp(28, 14, nm))},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(ex, ey, w, w * 0.42, 0, 0, 6.283); ctx.fill();
      };

      // (Upper-bank villagers I added last round were rendering OVER THE WATER
      //  on wide screens because the bank slope is too low at those x positions.
      //  Removed. Villagers stay along the existing work stations on the bank.)

      // --- VIGNETTE 1: HIDE-WORKING — always staffed (scraper + helper). ---
      earth(hfx - 4, hfy + 10, 38);
      fig(hfx - 16, hfy + 6, 1.55, 'scrape', 2.3, { shirt: '#b04a2a', hairStyle: 'braid', dir: 1 });
      fig(hfx + 22, hfy + 6, 1.35, 'carry', 1.8, { shirt: '#5a7d3a', hairStyle: 'long', dir: -1 });

      // --- VIGNETTE 2: WILD-RICE POUNDING — always staffed (pounder + winnower) ---
      earth(wmx + 4, wmy + 10, 32);
      fig(wmx - 8, wmy + 6, 1.55, 'pound', 4.4, { shirt: '#1f4e8f', hairStyle: 'long', dir: 1 });
      fig(wmx + 18, wmy + 6, 1.30, 'stir', 0.6, { shirt: '#d68a1f', hairStyle: 'braid', dir: -1 });

      // --- VIGNETTE 2b: THREE SISTERS GARDEN (corn, beans, squash — farming) ---
      //   A row of tall corn stalks with low squash mounds, tended by a person
      //   with a digging stick. Placed in the open stretch past the smokehouse.
      {
        const gx0 = W * 0.915, gy0 = ground(gx0) + 4;
        earth(gx0, gy0 + 6, 30);
        const grn = `rgb(${Math.round(_lerp(70, 36, nm))},${Math.round(_lerp(120, 60, nm))},${Math.round(_lerp(48, 26, nm))})`;
        // squash mounds (low, broad leaves)
        ctx.fillStyle = grn;
        for (let m = -1; m <= 1; m++) {
          ctx.beginPath(); ctx.ellipse(gx0 + m * 11, gy0 + 3, 5, 2.2, 0, 0, 6.283); ctx.fill();
        }
        // corn stalks — tall stems with a sway and a few leaves
        for (let cstk = 0; cstk < 5; cstk++) {
          const sx = gx0 - 16 + cstk * 8;
          const sway = Math.sin(tt * 0.9 + cstk) * 1.4;
          const topY = gy0 - 26 - (cstk % 2) * 3;
          ctx.strokeStyle = grn; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(sx, gy0 + 2); ctx.quadraticCurveTo(sx + sway * 0.5, (gy0 + topY) / 2, sx + sway, topY); ctx.stroke();
          // leaves
          ctx.lineWidth = 1.1;
          ctx.beginPath(); ctx.moveTo(sx + sway * 0.4, gy0 - 10); ctx.quadraticCurveTo(sx + 6, gy0 - 12, sx + 8, gy0 - 8); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sx + sway * 0.6, gy0 - 16); ctx.quadraticCurveTo(sx - 6, gy0 - 18, sx - 8, gy0 - 14); ctx.stroke();
          // a corn cob (golden) on alternate stalks
          if (cstk % 2 === 0) {
            ctx.fillStyle = `rgb(${Math.round(_lerp(228, 120, nm))},${Math.round(_lerp(190, 96, nm))},${Math.round(_lerp(70, 40, nm))})`;
            ctx.beginPath(); ctx.ellipse(sx + sway * 0.7 + 2, gy0 - 13, 1.4, 3, -0.3, 0, 6.283); ctx.fill();
          }
        }
        // gardeners — present morning + midday (garden work eases by evening).
        if (!isEvening) {
          fig(gx0 - 22, gy0 + 4, 1.35, 'scrape', 1.5, { shirt: '#5a7d3a', hairStyle: 'braid', dir: 1 });
          fig(gx0 + 20, gy0 + 4, 1.25, 'carry', 3.1, { shirt: '#1f4e8f', hairStyle: 'long', dir: -1 });
        }
      }

      // --- VIGNETTE 3: WOOD-CHOPPING ---
      //   morning: woodcutter chops, no helper yet. midday: both. evening: just
      //   the helper carrying the day's wood to the fire.
      const chopX = W * 0.63, chopY = ground(chopX) + 6;        // its own clear spot
      earth(chopX + 4, chopY + 6, 34);
      fig(chopX, chopY, 1.55, 'chop', 1.7, { shirt: '#3a4658', hairStyle: 'braid', dir: 1 });
      fig(chopX + 26, chopY, 1.35, 'carry', 3.5, { shirt: '#c93a1e', hairStyle: 'long', dir: -1 });

      // --- VIGNETTE 4: SMOKEHOUSE / FISH-DRYING (tender + a hanger) ---
      earth(smx, smy + 8, 30);
      fig(smx - 14, smy + 6, 1.40, 'stir', 0.8, { shirt: '#d68a1f', hairStyle: 'braid', dir: 1 });
      earth(dx, dyy + 8, 30);
      fig(dx - 6, dyy + 6, 1.50, 'hang', 1.2, { shirt: '#7c2f6b', hairStyle: 'braid' });
      fig(dx + 18, dyy + 6, 1.30, 'hang', 4.0, { shirt: '#5a7d3a', dir: -1 });

      // --- LEFT-BANK / "EMPTY TRIANGLE" group (Hassan: utilise the empty space).
      //   A shore-fishing pair on the open left of the bank: one casting a line
      //   over the water, one cleaning the catch, on solid ground (not floating).
      {
        const lbx = W * 0.485, lby = ground(W * 0.485) + 6;
        earth(lbx, lby + 4, 26);
        fig(lbx, lby, 1.35, 'sit', 0.8, { shirt: '#1f4e8f', hairStyle: 'braid', dir: 1 });            // angler
        ctx.strokeStyle = 'rgba(46,32,18,1)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
        const rod = Math.sin(tt * 1.1) * 1.4;
        ctx.beginPath(); ctx.moveTo(lbx + 2, lby - 14); ctx.lineTo(lbx - 30 + rod, lby - 4); ctx.stroke();
        ctx.strokeStyle = 'rgba(220,214,200,0.55)'; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(lbx - 30 + rod, lby - 4); ctx.lineTo(lbx - 32 + rod, lby + 6); ctx.stroke();
        fig(lbx + 20, lby + 2, 1.25, 'scrape', 2.4, { shirt: '#7c2f6b', hairStyle: 'long', dir: -1 });  // cleaning the catch
      }

      // --- VIGNETTE 5: FIRE CIRCLE (cook stirring the pot + drummer) ---
      earth(fx + 4, fy + 14, 36);
      fig(fx + 16, ground(fx + 16) + 6, 1.55, 'stir', 0.0, { shirt: '#c93a1e', hairStyle: 'long' });
      fig(fx - 24, ground(fx - 24) + 6, 1.40, 'sit', 1.7, { shirt: '#1f4e8f', hairStyle: 'braid', dir: -1 });

      // (Removed the shoreline pacing walkers — Hassan: "walking in a line then
      //  disappear". They were filler that faded oddly at the dusk crossfade.)
      // --- MI'KMAQ FRIENDSHIP DANCE (foreground attraction, prominent) ---
      //   Five children HOLD HANDS in a circle and move CLOCKWISE, taking
      //   THREE STEPS FORWARD and ONE STEP BACK in time with the drum — the
      //   real Friendship Dance, not random hand-waving. DAY / AFTERNOON ONLY
      //   (Hassan: ring-of-roses belongs to the day, not the evening/night).
      if (isMorning || isMidday) {
        const ringX = W * 0.83, ringY = H - 24, ringR = 16;   // TIGHT ring: kids' own arms genuinely reach each other
        // trodden grass ring
        ctx.fillStyle = `rgba(${Math.round(_lerp(150, 70, nm))},${Math.round(_lerp(132, 60, nm))},${Math.round(_lerp(86, 36, nm))},0.45)`;
        ctx.beginPath(); ctx.ellipse(ringX, ringY + 6, ringR + 5, (ringR + 5) * 0.4, 0, 0, 6.283); ctx.fill();
        ctx.strokeStyle = `rgba(${Math.round(_lerp(58, 28, nm))},${Math.round(_lerp(40, 18, nm))},${Math.round(_lerp(22, 10, nm))},0.6)`;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.ellipse(ringX, ringY + 6, ringR, ringR * 0.4, 0, 0, 6.283); ctx.stroke();

        // 3-steps-forward-1-back rotation, locked to a steady drum beat
        const stepSize = 0.32;                        // radians advanced per step
        const beat = tt * 1.6;                        // ~1.6 steps/sec (drum tempo)
        const idx = Math.floor(beat), frac = beat - idx;
        const pattern = [1, 1, 1, -1];                // forward, forward, forward, back
        let steps = Math.floor(idx / 4) * 2;          // each 4-beat measure nets +2 steps clockwise
        for (let b = 0; b < idx % 4; b++) steps += pattern[b];
        const rot = (steps + pattern[idx % 4] * frac) * stepSize;
        const stepBob = Math.abs(Math.sin(beat * Math.PI)) * 2.5;   // little hop on each step

        const N = 5;
        const kidShirts = ['#d68a1f', '#5a7d3a', '#c93a1e', '#1f4e8f', '#7c2f6b'];
        const kp = [];
        for (let c = 0; c < N; c++) {
          const a = rot + c * (Math.PI * 2 / N);
          kp.push({
            x: ringX + Math.cos(a) * ringR,
            y: ringY + 6 + Math.sin(a) * ringR * 0.4 - (Math.sin(a) > 0 ? stepBob : stepBob * 0.5),
            a,
          });
        }
        // the children, facing their clockwise direction of travel
        for (let c = 0; c < N; c++) {
          const { x, y, a } = kp[c];
          const kdir = Math.cos(a) >= 0 ? 1 : -1;       // tangential facing (clockwise)
          fig(x, y, 0.82, 'dance', c * 1.3, { shirt: kidShirts[c], hairStyle: c % 2 ? 'long' : 'braid', dir: kdir });  // clearly small CHILDREN
        }
        // NO bridge lines at all (they read as "weird sticks"). The ring is now
        // tight enough (R=16) that each child's own outstretched dance arms
        // genuinely reach the neighbour's — the hands meet naturally.
      }
      // (Removed the TATANKA chase — its runners swept across the ring-of-roses,
      //  reading as "4 girls walking straight through" the dancing children.)
      // --- NEW VIGNETTE: BIRCH-BARK BASKET WEAVING (a classic Anishinaabe craft) ---
      //   A seated weaver up the bank with a small pile of bark strips and a
      //   finished basket beside them.
      {
        const wvX = W * 0.83, wvY = ground(wvX) + 6;
        earth(wvX, wvY + 6, 24);
        // pile of bark strips (cream/tan)
        ctx.fillStyle = `rgba(${Math.round(_lerp(220, 120, nm))},${Math.round(_lerp(190, 100, nm))},${Math.round(_lerp(140, 70, nm))},0.95)`;
        ctx.beginPath(); ctx.ellipse(wvX - 12, wvY + 4, 5, 1.6, 0.2, 0, 6.283); ctx.fill();
        // finished basket
        ctx.fillStyle = '#7a4e22';
        ctx.beginPath(); ctx.ellipse(wvX + 12, wvY + 4, 4, 2.6, 0, 0, 6.283); ctx.fill();
        ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 0.5;
        for (let bw = -3; bw <= 3; bw += 1) {
          ctx.beginPath(); ctx.moveTo(wvX + 12 + bw, wvY + 1.4); ctx.lineTo(wvX + 12 + bw, wvY + 6); ctx.stroke();
        }
        fig(wvX, wvY + 4, 1.35, 'sit', 2.6, { shirt: '#7c2f6b', hairStyle: 'braid' });
      }
      // --- MORNING WATER CEREMONY — at first light an elder stands at the
      //   water's edge offering tobacco/asemaa to the lake, arms slowly raised
      //   and lowered. A calm dawn ritual distinct from the day's bustle. ----
      if (isMorning) {
        const ceX = fx - 50, ceY = ground(fx - 50) + 6;
        earth(ceX + 4, ceY + 6, 24);
        const raise = 0.5 + 0.5 * Math.sin(tt * 0.6);                          // arms rise & lower
        fig(ceX, ceY, 1.5, 'wave', 0.0, { shirt: '#d68a1f', hairStyle: 'long', dir: -1 });
        // a small offering of tobacco drifting down to the water
        ctx.fillStyle = `rgba(${Math.round(_lerp(180,120,nm))},${Math.round(_lerp(150,90,nm))},${Math.round(_lerp(90,56,nm))},${0.5 * raise})`;
        for (let o = 0; o < 3; o++) {
          ctx.beginPath(); ctx.arc(ceX - 10 - o * 2, ceY - 6 + o * 5 + Math.sin(tt + o) * 2, 0.8, 0, 6.283); ctx.fill();
        }
      }
      // --- ELDER STORYTELLER + listening child — appears in the EVENING when
      //   work winds down. Replaces day-bustle with quieter gathering energy.
      if (isEvening) {
        const stX = fx - 50, stY = ground(stX) + 6;
        earth(stX + 4, stY + 6, 26);
        fig(stX, stY, 1.45, 'wave', 1.1, { shirt: '#5a7d3a', hairStyle: 'long', dir: 1 });
        fig(stX + 18, stY + 2, 0.85, 'sit', 0.4, { shirt: '#d68a1f', hairStyle: 'long', dir: -1 });
        fig(stX + 26, stY + 2, 0.85, 'sit', 1.9, { shirt: '#c93a1e', hairStyle: 'braid', dir: -1 });

        // --- EVENING MEAL (evening-only — the day's harvest shared before dark).
        //   A woven mat with steaming bowls; a family eating together. Placed on
        //   the open right stretch so it doesn't crowd anything. ---
        const emX = W * 0.90, emY = ground(W * 0.90) + 6;
        earth(emX, emY + 4, 26);
        ctx.fillStyle = `rgba(${Math.round(_lerp(96, 58, nm))},${Math.round(_lerp(64, 40, nm))},${Math.round(_lerp(28, 18, nm))},0.85)`;
        ctx.beginPath(); ctx.ellipse(emX, emY + 2, 22, 5, 0, 0, 6.283); ctx.fill();
        const bowlCols2 = ['#d8c896', '#7a2a18', '#a6c1d6'];
        for (let bw = 0; bw < 3; bw++) {
          const bxC = emX - 12 + bw * 12, byC = emY - 1;
          ctx.fillStyle = '#3a2410';
          ctx.beginPath(); ctx.ellipse(bxC, byC, 3.6, 1.5, 0, 0, 6.283); ctx.fill();
          ctx.fillStyle = bowlCols2[bw];
          ctx.beginPath(); ctx.ellipse(bxC, byC - 0.4, 2.7, 1.0, 0, 0, 6.283); ctx.fill();
          ctx.strokeStyle = `rgba(220,214,200,${0.3 + 0.2 * Math.sin(tt * 2 + bw)})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.moveTo(bxC, byC - 1); ctx.quadraticCurveTo(bxC + 2 * Math.sin(tt + bw), byC - 5, bxC, byC - 10); ctx.stroke();
        }
        fig(emX - 18, emY - 1, 1.25, 'sit', 1.2, { shirt: '#1f4e8f', hairStyle: 'braid', dir: 1 });
        fig(emX + 18, emY - 1, 1.25, 'sit', 3.4, { shirt: '#7c2f6b', hairStyle: 'long', dir: -1 });
        fig(emX + 2, emY - 3, 0.85, 'sit', 2.1, { shirt: '#d68a1f', hairStyle: 'long', dir: -1 });  // child between them
      }
      // --- TALKING CIRCLE (Mi'kmaq) — EVENING: people sit in a circle and a
      //   TALKING STICK passes clockwise; only the holder "speaks" (gestures).
      //   Placed on the open left of the bank, its own clear space.
      if (isMidday || isEvening) {
        const tcX = W * 0.515, tcY = ground(W * 0.515) + 12, tcR = 24;
        earth(tcX, tcY + 4, tcR + 6);
        const M = 6;                                            // six seated participants
        const holder = Math.floor(tt / 3) % M;                  // talking stick advances every 3s
        const tcShirts = ['#b04a2a', '#1f4e8f', '#d68a1f', '#5a7d3a', '#7c2f6b', '#3a4658'];
        // build seat positions (ellipse), draw far seats first for depth
        const seats = [];
        for (let s = 0; s < M; s++) {
          const a = s * (Math.PI * 2 / M) - Math.PI / 2;
          seats.push({ x: tcX + Math.cos(a) * tcR, y: tcY + Math.sin(a) * tcR * 0.45, s });
        }
        seats.sort((p1, p2) => p1.y - p2.y);
        for (const seat of seats) {
          const speaking = seat.s === holder;
          // the speaker gestures (wave), the rest sit and listen
          fig(seat.x, seat.y, 1.15, speaking ? 'wave' : 'sit', seat.s * 1.4,
              { shirt: tcShirts[seat.s], hairStyle: seat.s % 2 ? 'braid' : 'long', dir: seat.x < tcX ? 1 : -1 });
          // the talking stick: a small decorated stick the speaker holds up
          if (speaking) {
            ctx.strokeStyle = '#6b4421'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(seat.x + 3, seat.y - 6); ctx.lineTo(seat.x + 6, seat.y - 18); ctx.stroke();
            // a feather tied to the top
            ctx.strokeStyle = `rgba(${Math.round(_lerp(220,120,nm))},${Math.round(_lerp(180,96,nm))},${Math.round(_lerp(120,64,nm))},0.95)`;
            ctx.lineWidth = 1.1;
            ctx.beginPath(); ctx.moveTo(seat.x + 6, seat.y - 18); ctx.lineTo(seat.x + 9, seat.y - 23); ctx.stroke();
          }
        }
      }
      // a drummer seated at the ceremonial drum (rhythm of the day)
      const drumPx = drx - 4, drumPy = ground(drumPx) + 6;
      fig(drumPx, drumPy, 1.4, 'drum', 7, { shirt: '#7c2f6b', hairStyle: 'braid' });
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
        ctx.save(); ctx.globalAlpha = dayA;   // solid through the day, fades at dusk like the villagers (not ghosty)
        // colours
        const coat = ctx.createLinearGradient(hx, hy - 16 * sc, hx, hy + 12 * sc);
        coat.addColorStop(0, 'rgba(96,62,36,1)');
        coat.addColorStop(1, 'rgba(58,36,20,1)');
        const mane = 'rgba(26,15,8,1)';
        const t = headDown ? 0.5 + 0.5 * Math.sin(tt * 0.6 + ph) : 0;       // graze dip 0..1
        const tailSwish = Math.sin(tt * 1.6 + ph) * 2.2 * sc;
        const step = Math.sin(tt * 2 + ph) * 1.4 * sc;                       // subtle weight shift
        // facing RIGHT. Body is a smooth rounded barrel.
        ctx.fillStyle = coat;
        ctx.beginPath();
        ctx.moveTo(hx - 15 * sc, hy - 6 * sc);                               // chest/shoulder
        ctx.quadraticCurveTo(hx - 16 * sc, hy - 11 * sc, hx - 10 * sc, hy - 11 * sc);  // withers
        ctx.quadraticCurveTo(hx + 2 * sc, hy - 12 * sc, hx + 12 * sc, hy - 10 * sc);   // back
        ctx.quadraticCurveTo(hx + 18 * sc, hy - 9 * sc, hx + 18 * sc, hy - 3 * sc);    // croup/rump
        ctx.quadraticCurveTo(hx + 17 * sc, hy + 3 * sc, hx + 12 * sc, hy + 3 * sc);    // hindquarter down
        ctx.quadraticCurveTo(hx + 2 * sc, hy + 4 * sc, hx - 12 * sc, hy + 3 * sc);     // belly
        ctx.quadraticCurveTo(hx - 16 * sc, hy + 2 * sc, hx - 15 * sc, hy - 6 * sc);    // back to chest
        ctx.closePath(); ctx.fill();
        // legs — two front, two back, with a knee bend; thinner at the hoof
        const leg = (lx, swing) => {
          ctx.strokeStyle = coat; ctx.lineWidth = 2.8 * sc; ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(lx, hy + 2 * sc);
          ctx.quadraticCurveTo(lx + swing * 0.4, hy + 6 * sc, lx + swing, hy + 12 * sc);
          ctx.stroke();
          // hoof
          ctx.strokeStyle = 'rgba(20,14,8,1)'; ctx.lineWidth = 2.8 * sc;
          ctx.beginPath(); ctx.moveTo(lx + swing, hy + 11.5 * sc); ctx.lineTo(lx + swing, hy + 13 * sc); ctx.stroke();
        };
        leg(hx + 12 * sc, step);          // near hind
        leg(hx - 11 * sc, -step);         // near front
        leg(hx + 9 * sc, -step * 0.6);    // far hind
        leg(hx - 8 * sc, step * 0.6);     // far front
        // tail — a flowing dark tail off the rump
        ctx.strokeStyle = mane; ctx.lineWidth = 3.2 * sc; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hx + 17 * sc, hy - 4 * sc);
        ctx.quadraticCurveTo(hx + 23 * sc, hy + 1 * sc + tailSwish, hx + 20 * sc, hy + 8 * sc + tailSwish);
        ctx.stroke();
        // NECK + HEAD (arched neck sweeping down-forward; dips further when grazing)
        const neckBaseX = hx - 13 * sc, neckBaseY = hy - 9 * sc;
        const headX = hx - 22 * sc, headY = hy - 10 * sc + t * 13 * sc;      // muzzle drops to graze
        ctx.fillStyle = coat;
        ctx.beginPath();
        ctx.moveTo(neckBaseX + 2 * sc, neckBaseY + 1 * sc);
        ctx.quadraticCurveTo(headX + 4 * sc, headY - 4 * sc, headX - 3 * sc, headY - 2 * sc);  // top of neck → poll
        ctx.quadraticCurveTo(headX - 6 * sc, headY + 1 * sc, headX - 4 * sc, headY + 4 * sc);  // face → muzzle
        ctx.quadraticCurveTo(headX, headY + 5 * sc, headX + 3 * sc, headY + 3 * sc);            // jaw
        ctx.quadraticCurveTo(neckBaseX - 1 * sc, headY - 1 * sc, neckBaseX, neckBaseY + 4 * sc); // throat back to chest
        ctx.closePath(); ctx.fill();
        // mane along the crest of the neck
        ctx.strokeStyle = mane; ctx.lineWidth = 2.2 * sc; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(neckBaseX + 1 * sc, neckBaseY - 1 * sc);
        ctx.quadraticCurveTo(headX + 5 * sc, headY - 5 * sc, headX - 1 * sc, headY - 2 * sc);
        ctx.stroke();
        // forelock + ears
        ctx.fillStyle = coat;
        ctx.beginPath(); ctx.moveTo(headX - 2 * sc, headY - 3 * sc); ctx.lineTo(headX - 1 * sc, headY - 6 * sc); ctx.lineTo(headX + 1 * sc, headY - 3 * sc); ctx.closePath(); ctx.fill();
        // eye + nostril
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.beginPath(); ctx.arc(headX - 1 * sc, headY - 1 * sc, 0.7 * sc, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.arc(headX - 4 * sc, headY + 3 * sc, 0.5 * sc, 0, 6.283); ctx.fill();
        ctx.restore();
      };
      // grazing horse moved to the OPEN left bank so it no longer stands in
      // front of the fish-drying rack (Hassan: the hide-dryers were hidden
      // behind the horse). Second horse stays at the far end.
      drawHorse(W * 0.555, ground(W * 0.555) - 7, 1.7, 0.0, true);          // grazing, open left bank
      drawHorse(W * 0.95, ground(W * 0.95) - 9, 2.0, 2.3, false);          // standing watch, far end

      // ---- CANADA GEESE on the ground (LHS bank) — brown body, pale breast,
      //   black S-neck, white cheek patch. One honks (neck up), others graze
      //   (neck down, pecking). Matches Hassan's reference photo. ----
      const drawGoose = (gx, gy, gsc, honk, ph) => {
        // WADDLE: the whole goose gently rocks side to side + tiny step shuffle,
        // so it reads as a live bird, not a sticker.
        const rock = Math.sin(tt * 1.8 + ph) * 0.05;
        const shuffle = Math.sin(tt * 0.5 + ph) * 3;
        ctx.save(); ctx.translate(gx + shuffle, gy); ctx.rotate(rock); ctx.scale(gsc, gsc); ctx.globalAlpha = dayA;
        const bodyCol = `rgb(${Math.round(_lerp(150,76,nm))},${Math.round(_lerp(136,68,nm))},${Math.round(_lerp(112,54,nm))})`;
        const breast = `rgb(${Math.round(_lerp(214,108,nm))},${Math.round(_lerp(206,104,nm))},${Math.round(_lerp(186,92,nm))})`;
        // legs
        ctx.strokeStyle = 'rgba(28,24,20,1)'; ctx.lineWidth = 1.0; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-1, 3); ctx.lineTo(-1.5, 8); ctx.moveTo(2, 3); ctx.lineTo(2.5, 8); ctx.stroke();
        // body (teardrop, tail up to the right)
        ctx.fillStyle = bodyCol;
        ctx.beginPath();
        ctx.moveTo(-7, 0);
        ctx.quadraticCurveTo(-9, -5, -3, -6);
        ctx.quadraticCurveTo(6, -7, 11, -2);                 // back to tail tip
        ctx.quadraticCurveTo(6, 0, 2, 3);
        ctx.quadraticCurveTo(-4, 4, -7, 0);
        ctx.closePath(); ctx.fill();
        // pale breast
        ctx.fillStyle = breast;
        ctx.beginPath(); ctx.ellipse(-5, -0.5, 3, 2.4, 0.2, 0, 6.283); ctx.fill();
        // LONG black neck — tall vertical S when honking/alert, swept down to
        // the grass when grazing. ANIMATED: the honker's neck PUMPS up and down
        // as it calls; grazers PECK — the head bobs down to the grass and back.
        const pump = honk ? Math.sin(tt * 2.2 + ph) * 2.5 : 0;                  // honk pump
        const peck = honk ? 0 : Math.max(0, Math.sin(tt * 1.6 + ph)) * 5;       // grazing peck
        const headX = honk ? -8 : -15, headY = (honk ? -20 + pump : 1 + peck);
        ctx.strokeStyle = 'rgba(20,18,16,1)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-6, -3.5);
        if (honk) ctx.bezierCurveTo(-9, -10, -6, -16, headX, headY);          // upright S, head high
        else      ctx.bezierCurveTo(-12, -5, -16, 1, headX, headY);            // reaching down to graze
        ctx.stroke();
        // head
        ctx.fillStyle = 'rgba(20,18,16,1)';
        ctx.beginPath(); ctx.ellipse(headX, headY, 2.3, 1.9, honk ? 0 : 0.5, 0, 6.283); ctx.fill();
        // white cheek patch (the Canada-goose chin-strap)
        ctx.fillStyle = 'rgba(238,238,232,0.95)';
        ctx.beginPath(); ctx.ellipse(headX + (honk ? 0.8 : -0.8), headY + 0.6, 1.1, 1.5, 0, 0, 6.283); ctx.fill();
        // bill
        ctx.fillStyle = 'rgba(24,20,18,1)';
        ctx.beginPath();
        if (honk) { ctx.moveTo(headX - 1.5, headY - 1); ctx.lineTo(headX - 4, headY - 1.8); ctx.lineTo(headX - 1.5, headY); }   // open, pointing up
        else { ctx.moveTo(headX - 1.5, headY); ctx.lineTo(headX - 4, headY + 0.6); ctx.lineTo(headX - 1.5, headY + 1); }       // down, grazing
        ctx.closePath(); ctx.fill();
        ctx.restore();
      };
      // geese ("swans") moved OFF the centred scroll-down button to the open
      // mid-right bank, grouped together near the water's edge.
      // geese on the OPEN LEFT stretch of bank — well away from any villager
      // work-station (they were merging with the rice-pounders at ~0.70).
      // geese in the BIG EMPTY bottom-middle foreground grass — far from every
      // villager, station, plant clump and the horse (they kept merging before).
      drawGoose(W * 0.70, H - 34, 1.9, true, 0);                           // the honker (neck up)
      drawGoose(W * 0.675, H - 26, 1.7, false, 1.5);                      // grazing
      drawGoose(W * 0.73, H - 28, 1.75, false, 3.0);                      // grazing

      // ---- DEER (waawaashkeshi) on the upper bank — a CLAN animal (poets &
      //   peacemakers). Stands grazing, lifts its head ALERT now and then, ears
      //   flicking, tail twitching. Slender legs, white throat & tail. ----
      {
        // On the solid mid-bank between the wood-chop and the fire — a spot
        // where the green slope is high enough that it actually stands on land.
        const dxe = W * 0.76, dye = ground(W * 0.76) - 4, dsc = 2.0;
        ctx.save(); ctx.translate(dxe, dye); ctx.scale(dsc, dsc); ctx.globalAlpha = dayA;
        const coat = `rgb(${Math.round(_lerp(168,86,nm))},${Math.round(_lerp(120,60,nm))},${Math.round(_lerp(78,40,nm))})`;
        const alert = Math.max(0, Math.sin(tt * 0.4));                      // 0 grazing → 1 head up
        const headY = 4 - alert * 12, headX = -11 + alert * 3;             // head lifts & draws back when alert
        // legs (slender)
        ctx.strokeStyle = `rgb(${Math.round(_lerp(120,58,nm))},${Math.round(_lerp(84,40,nm))},${Math.round(_lerp(52,26,nm))})`;
        ctx.lineWidth = 1.3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-6, 1); ctx.lineTo(-6.5, 11); ctx.moveTo(-3, 1); ctx.lineTo(-3, 11);
        ctx.moveTo(5, 1); ctx.lineTo(5.5, 11); ctx.moveTo(8, 1); ctx.lineTo(8, 11); ctx.stroke();
        // body
        ctx.fillStyle = coat;
        ctx.beginPath();
        ctx.moveTo(-7, 0); ctx.quadraticCurveTo(-8, -5, -2, -5);
        ctx.quadraticCurveTo(7, -6, 10, -2); ctx.quadraticCurveTo(9, 1, 5, 1);
        ctx.quadraticCurveTo(-3, 2, -7, 0); ctx.closePath(); ctx.fill();
        // neck + head (raises when alert)
        ctx.strokeStyle = coat; ctx.lineWidth = 3.0;
        ctx.beginPath(); ctx.moveTo(-6, -3); ctx.quadraticCurveTo(headX + 3, (headY - 3), headX, headY); ctx.stroke();
        ctx.fillStyle = coat;
        ctx.beginPath(); ctx.ellipse(headX - 1, headY, 2.6, 1.7, -0.3, 0, 6.283); ctx.fill();   // head
        // ears (flick)
        const ear = Math.sin(tt * 3) * 0.3;
        ctx.strokeStyle = coat; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(headX, headY - 1); ctx.lineTo(headX - 1 + ear, headY - 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(headX + 1, headY - 1); ctx.lineTo(headX + 2 + ear, headY - 4); ctx.stroke();
        // white throat + nose
        ctx.fillStyle = 'rgba(238,232,220,0.9)';
        ctx.beginPath(); ctx.ellipse(headX - 2.4, headY + 0.6, 0.9, 0.7, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgba(20,14,10,1)';
        ctx.beginPath(); ctx.arc(headX - 2.6, headY + 0.3, 0.5, 0, 6.283); ctx.fill();          // nose
        ctx.beginPath(); ctx.arc(headX, headY - 0.6, 0.4, 0, 6.283); ctx.fill();                // eye
        // white tail (twitches up)
        const tail = Math.sin(tt * 5) > 0.7 ? -3 : 0;
        ctx.fillStyle = 'rgba(240,234,222,0.95)';
        ctx.beginPath(); ctx.ellipse(9.5, -2 + tail, 1.2, 2.0, 0.3, 0, 6.283); ctx.fill();
        ctx.restore();
      }

      // ---- MARTEN (waabizheshi) — the 7th CLAN animal (warriors). A small,
      //   sleek weasel that darts ALONG A FALLEN LOG, low and quick, with a long
      //   bushy tail, pointed face and pale throat. Scampers back and forth. ----
      {
        const logX = W * 0.82, logY = ground(logX) + 2, logLen = 34;
        // the fallen log it runs along
        ctx.save(); ctx.globalAlpha = dayA;   // solid through the day, fades at dusk like the villagers (not ghosty)
        ctx.fillStyle = `rgb(${Math.round(_lerp(96,52,nm))},${Math.round(_lerp(64,34,nm))},${Math.round(_lerp(36,18,nm))})`;
        ctx.beginPath(); ctx.ellipse(logX, logY, logLen / 2, 3.2, -0.05, 0, 6.283); ctx.fill();
        ctx.strokeStyle = `rgba(${Math.round(_lerp(40,22,nm))},${Math.round(_lerp(26,14,nm))},${Math.round(_lerp(14,8,nm))},0.7)`;
        ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.arc(logX - logLen / 2, logY, 2.4, 0, 6.283); ctx.stroke();   // log end-grain
        // the marten scampers back and forth along the log
        const run = Math.sin(tt * 1.1);
        const mxp = logX + run * (logLen / 2 - 5);
        const mdir = Math.cos(tt * 1.1) >= 0 ? -1 : 1;   // body is drawn head-LEFT, so invert to face travel
        const gallop = Math.abs(Math.sin(tt * 9)) * 1.4;                                  // bounding body arch
        ctx.save(); ctx.translate(mxp, logY - 3); ctx.scale(mdir, 1);
        const fur = `rgb(${Math.round(_lerp(132,68,nm))},${Math.round(_lerp(78,40,nm))},${Math.round(_lerp(38,20,nm))})`;
        // long bushy tail
        ctx.strokeStyle = fur; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(6, 0); ctx.quadraticCurveTo(12, -2 - gallop, 15, -5 - gallop * 2); ctx.stroke();
        // low arched body
        ctx.fillStyle = fur;
        ctx.beginPath();
        ctx.moveTo(-7, 0); ctx.quadraticCurveTo(-2, -3 - gallop, 4, -2); ctx.quadraticCurveTo(7, -1, 7, 1);
        ctx.quadraticCurveTo(0, 2, -7, 0); ctx.closePath(); ctx.fill();
        // little legs (bounding)
        ctx.strokeStyle = fur; ctx.lineWidth = 1.0;
        ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-6, 3 + gallop); ctx.moveTo(4, 0); ctx.lineTo(5, 3 - gallop); ctx.stroke();
        // pointed head + pale throat + dark eye
        ctx.fillStyle = fur;
        ctx.beginPath(); ctx.ellipse(-8, -1, 2.4, 1.6, -0.2, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgba(228,214,180,0.9)';
        ctx.beginPath(); ctx.ellipse(-8, 0.4, 1.0, 0.7, 0, 0, 6.283); ctx.fill();           // throat patch
        ctx.fillStyle = 'rgba(16,12,8,1)';
        ctx.beginPath(); ctx.arc(-9, -1.4, 0.5, 0, 6.283); ctx.fill();                       // eye
        ctx.beginPath(); ctx.arc(-10, -0.6, 0.4, 0, 6.283); ctx.fill();                      // nose
        // tiny round ears
        ctx.fillStyle = fur;
        ctx.beginPath(); ctx.arc(-7.5, -2.6, 0.7, 0, 6.283); ctx.fill();
        ctx.restore();
        ctx.restore();
      }

      // ---- LAND PLANTS on the LHS bank (Hassan: "where are the plants on the
      //   land? they can all be on LHS"): clumps of green grass/sedge tufts and
      //   a few flowering stems, swaying. ----
      const grassCol = `rgba(${Math.round(_lerp(72,38,nm))},${Math.round(_lerp(120,62,nm))},${Math.round(_lerp(46,26,nm))},0.95)`;
      [[0.46, 6], [0.49, 7], [0.52, 6]]  /* clumps at 0.55/0.585 removed — they drew INSIDE the horse */.forEach(([fxC, n], gi) => {
        const bx0 = W * fxC, by0 = ground(bx0) + 6;
        ctx.strokeStyle = grassCol; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
        for (let b = 0; b < n; b++) {
          const sx = bx0 + (b - n / 2) * 3;
          const h = 9 + (b % 3) * 4;
          const sway = Math.sin(tt * 1.4 + gi + b * 0.5) * 2.2;
          ctx.beginPath(); ctx.moveTo(sx, by0); ctx.quadraticCurveTo(sx + sway * 0.5, by0 - h * 0.6, sx + sway, by0 - h); ctx.stroke();
        }
        // a couple of small flower heads on the taller clumps
        if (gi % 2 === 0) {
          ctx.fillStyle = `rgba(${Math.round(_lerp(228,120,nm))},${Math.round(_lerp(200,104,nm))},${Math.round(_lerp(120,60,nm))},0.95)`;
          ctx.beginPath(); ctx.arc(bx0 + Math.sin(tt + gi) * 2, by0 - 16, 1.4, 0, 6.283); ctx.fill();
        }
      });

      // ================= REAL SPRITE BEAR (professional asset pack) =============
      // Full Nat-Geo hunt loop with the artist's frames: IDLE watch -> STALK ->
      // 6-frame STRIKE -> SPLASH IMPACT -> MOUTH CATCH -> VICTORY hold with the
      // fish. The hand-drawn bear below remains the automatic fallback while
      // sprites load (or if any frame fails).
      if (_SPR.ready) {
        ctx.save(); ctx.globalAlpha = dayA;
        const bx = W * 0.28, by = H * 0.90;                    // pivot point at the waterline
        const sc = Math.max(0.20, Math.min(0.33, W / 4600));   // responsive sprite scale
        const FW = 768 * sc, FH = 512 * sc;
        const hunt = (tt % 9) / 9;                             // 9s full hunt cycle
        let anim, fi;
        if (hunt < 0.38)      { anim = 'idle';            fi = Math.floor(tt * 5.5) % 4; }
        else if (hunt < 0.55) { anim = 'stalk';           fi = Math.floor(tt * 7.5) % 6; }
        else if (hunt < 0.66) { anim = 'strike';          fi = Math.min(5, Math.floor((hunt - 0.55) / 0.11 * 6)); }
        else if (hunt < 0.74) { anim = 'splash_impact';   fi = Math.min(2, Math.floor((hunt - 0.66) / 0.08 * 3)); }
        else if (hunt < 0.84) { anim = 'catch_mouth';     fi = Math.min(1, Math.floor((hunt - 0.74) / 0.10 * 2)); }
        else                  { anim = 'recovery_victory'; fi = 0; }
        // water contact patch under the bear (artist FX asset)
        ctx.globalAlpha = dayA * 0.9;
        ctx.drawImage(_SPR.patch, bx - FW * 0.42, by - FH * 0.10, FW * 0.84, FH * 0.22);
        // expanding ripple ring
        const rp = (tt * 0.55) % 1;
        ctx.globalAlpha = dayA * (1 - rp) * 0.85;
        const rw = FW * (0.35 + rp * 0.55);
        ctx.drawImage(_SPR.ripple, bx - rw / 2, by - rw * 0.11, rw, rw * 0.22);
        ctx.globalAlpha = dayA;
        // live salmon cruises in from the right while the bear watches/stalks
        // (the artist fish faces LEFT natively = swimming toward the bear)
        if (hunt < 0.55) {
          const u = hunt / 0.55;
          const fsc = sc * 0.55, fwW = 512 * fsc, fwH = 256 * fsc;
          const fxp = bx + FW * (0.62 - u * 0.38);
          const fyp = by - fwH * 0.42 + Math.sin(tt * 2.2) * 3;
          ctx.globalAlpha = dayA * 0.85;
          ctx.drawImage(_SPR.fishSwim, fxp - fwW / 2, fyp, fwW, fwH * 0.6);
          ctx.globalAlpha = dayA;
        }
        // the bear frame itself — pivot (384,450) lands on (bx,by)
        const frame = _SPR.anims[anim][fi];
        ctx.drawImage(frame, bx - 384 * sc, by - 450 * sc, FW, FH);
        ctx.restore();
      } else {
      // ---- BROWN BEAR CROUCHED AT THE WATER, paw raised mid-strike at a salmon.
      //   The iconic Anishinaabe/Pacific Northwest "bear fishing" silhouette.
      //   Facing LEFT (head & paw over the water). Body crouched low, weight on
      //   the hind legs, ONE front paw raised in a striking arc, big shoulder
      //   hump, round head with two round ears, short tan snout, dark nose, eye.
      ctx.save(); ctx.globalAlpha = (1 - nm);
      const S = 4.4;                                            // big, but fully on-screen
      // Bear stands in the OPEN FOREGROUND LAKE WATER on the left (the area left
      // of the village bank is open water). FIXED y — NOT the clamped shoreline —
      // so it is always FULLY visible (Hassan: bear was cut in half), well clear
      // of the centred hero text + scroll prompt, hunting in real water.
      const bx = W * 0.30;
      const by = H * 0.80;
      // strike rhythm: paw cocks up, then slams down
      // ---- HUNT CYCLE (full 7-second loop): 4 phases →
      //   0.00-0.40  WATCH   — fish swims past, bear tracks it
      //   0.40-0.55  LUNGE   — paw cocks high, body coils
      //   0.55-0.65  STRIKE  — paw slams down into the water, splash
      //   0.65-0.83  CARRY   — bear lifts the wriggling fish in its paw toward
      //                          the mouth (head meets paw)
      //   0.83-1.00  DEVOUR  — fish is at the bear's mouth, head shakes
      //                          chewing motion, fish shrinks then disappears
      //                          (Hassan: "bear is not eating, fish runs away")
      const huntT = (tt % 7) / 7;
      const watchEnd = 0.40, lungeEnd = 0.55, strikeEnd = 0.65, carryEnd = 0.83;
      let phase, strikePhase, carryT = 0, devourT = 0;
      if (huntT < watchEnd) {
        phase = 'watch';
        strikePhase = 0;
      } else if (huntT < lungeEnd) {
        phase = 'lunge';
        const u = (huntT - watchEnd) / (lungeEnd - watchEnd);
        strikePhase = 0.15 * u;
      } else if (huntT < strikeEnd) {
        phase = 'strike';
        const u = (huntT - lungeEnd) / (strikeEnd - lungeEnd);
        strikePhase = 0.15 + 0.85 * (u * u);
      } else if (huntT < carryEnd) {
        phase = 'carry';
        carryT = (huntT - strikeEnd) / (carryEnd - strikeEnd);
        strikePhase = 1 - 0.85 * carryT;                          // paw lifts back up holding the fish
      } else {
        phase = 'devour';
        devourT = (huntT - carryEnd) / (1 - carryEnd);            // 0..1
        strikePhase = 0.15 + 0.05 * Math.sin(devourT * 18);       // paw near mouth, small shaking
      }
      const fishCaught = phase === 'hold';
      // BREATHING — slow vertical bob of the whole body (~3.6s cycle), bigger
      // in watch/devour, suppressed during the strike (bear is tensed).
      const breathBase = Math.sin(tt * 1.75) * 0.7;
      const breath = (phase === 'strike' || phase === 'lunge') ? breathBase * 0.2 : breathBase;
      // BLINK — eyelid drops every ~3.5s for ~0.12s (long enough to read)
      const blink = (((tt + 0.4) % 3.5) < 0.12);
      // TAIL flick — small wiggle, more in carry/devour
      const tailFlick = Math.sin(tt * 4) * 0.8 * (phase === 'carry' || phase === 'devour' ? 1.4 : 0.5);
      // WHOLE-BODY hunt motion (Nat-Geo feel): the bear COILS back slightly
      // during the lunge, then the whole body PITCHES FORWARD-DOWN into the
      // strike (rotation about the hips) and recovers through the carry.
      const bodyPitch = strikePhase * 0.10 - (phase === 'lunge' ? 0.04 : 0);
      ctx.translate(bx, by + breath);
      ctx.rotate(bodyPitch);

      // ---- WATER INLET at the bear's feet: the shallows it is fishing in, so it
      //   reads as a bear hunting IN water (Nat-Geo), not standing on grass. Drawn
      //   first, behind the bear. Colour tracks day→night like the lake. ----
      {
        const wr = Math.round(_lerp(74, 30, nm)), wg = Math.round(_lerp(98, 44, nm)), wb = Math.round(_lerp(104, 52, nm));
        const poolCx = -13 * S, poolCy = 12.5 * S, poolRX = 26 * S, poolRY = 8 * S;
        const poolG = ctx.createRadialGradient(poolCx, poolCy, 0, poolCx, poolCy, poolRX);
        poolG.addColorStop(0, `rgba(${wr},${wg},${wb},0.95)`);
        poolG.addColorStop(0.7, `rgba(${wr},${wg},${wb},0.7)`);
        poolG.addColorStop(1, `rgba(${wr},${wg},${wb},0)`);
        ctx.fillStyle = poolG;
        ctx.beginPath(); ctx.ellipse(poolCx, poolCy, poolRX, poolRY, 0, 0, 6.283); ctx.fill();
        // a couple of concentric surface ripples in the pool
        ctx.strokeStyle = `rgba(${wr + 40},${wg + 40},${wb + 36},0.4)`; ctx.lineWidth = 1;
        for (let rr = 0; rr < 2; rr++) {
          const rad = (6 + rr * 7 + (tt * 4) % 7) * S;
          ctx.beginPath(); ctx.ellipse(poolCx, poolCy, rad, rad * 0.32, 0, 0, 6.283); ctx.stroke();
        }
      }

      const furG = ctx.createLinearGradient(0, -10 * S, 0, 12 * S);
      furG.addColorStop(0, 'rgba(80,50,28,1)');                 // sunlit caramel back
      furG.addColorStop(0.5, 'rgba(48,30,16,1)');
      furG.addColorStop(1, 'rgba(20,12,6,1)');                  // shadow at the belly
      const furHi = 'rgba(120,84,48,1)';                         // hump highlight

      // -- far hind leg (drawn first, behind) --
      ctx.fillStyle = 'rgba(14,8,4,1)';
      ctx.beginPath();
      ctx.moveTo(8 * S, 2 * S); ctx.quadraticCurveTo(12 * S, 8 * S, 11 * S, 12 * S);
      ctx.lineTo(15 * S, 12 * S); ctx.quadraticCurveTo(16 * S, 7 * S, 14 * S, 2 * S);
      ctx.closePath(); ctx.fill();

      // -- BODY: crouched, low arched back, weight on the hind end --
      ctx.fillStyle = furG;
      ctx.beginPath();
      ctx.moveTo(-12 * S, 4 * S);                                                // chest
      ctx.quadraticCurveTo(-14 * S, -2 * S, -8 * S, -6 * S);                      // up to shoulder hump
      ctx.quadraticCurveTo(-2 * S, -9 * S, 4 * S, -7 * S);                        // hump (highest point)
      ctx.quadraticCurveTo(12 * S, -4 * S, 16 * S, 0 * S);                        // back down to rump
      ctx.quadraticCurveTo(18 * S, 4 * S, 14 * S, 7 * S);                         // rump rolls down
      ctx.quadraticCurveTo(8 * S, 6 * S, 0 * S, 6 * S);                           // belly
      ctx.quadraticCurveTo(-8 * S, 6 * S, -12 * S, 4 * S);
      ctx.closePath(); ctx.fill();

      // hump highlight
      ctx.fillStyle = furHi;
      ctx.beginPath(); ctx.ellipse(-1 * S, -7 * S, 6 * S, 2.4 * S, -0.15, 0, 6.283); ctx.fill();
      // belly shadow
      ctx.fillStyle = 'rgba(8,5,3,0.55)';
      ctx.beginPath(); ctx.ellipse(2 * S, 6.5 * S, 11 * S, 1.6 * S, 0, 0, 6.283); ctx.fill();

      // -- planted near hind leg (visible in front of body) --
      ctx.fillStyle = furG;
      ctx.beginPath();
      ctx.moveTo(6 * S, 5 * S); ctx.quadraticCurveTo(6 * S, 9 * S, 8 * S, 12 * S);
      ctx.lineTo(12 * S, 12 * S); ctx.quadraticCurveTo(12 * S, 8 * S, 11 * S, 5 * S);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(8,5,3,1)';
      ctx.beginPath(); ctx.ellipse(10 * S, 12.2 * S, 2.6 * S, 1.2 * S, 0, 0, 6.283); ctx.fill();

      // -- PLANTED far front leg (supporting weight in the water) --
      ctx.fillStyle = furG;
      ctx.beginPath();
      ctx.moveTo(-9 * S, 4 * S); ctx.quadraticCurveTo(-11 * S, 8 * S, -10 * S, 12 * S);
      ctx.lineTo(-6 * S, 12 * S); ctx.quadraticCurveTo(-6 * S, 8 * S, -6 * S, 4 * S);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(8,5,3,1)';
      ctx.beginPath(); ctx.ellipse(-8 * S, 12.2 * S, 2.6 * S, 1.2 * S, 0, 0, 6.283); ctx.fill();

      // -- NEAR FRONT LEG (normal planted leg — NO raised arm. A real bear catches
      //   fish with its MOUTH, head down in the water; the legs just stand.) --
      ctx.fillStyle = furG;
      ctx.beginPath();
      ctx.moveTo(-3 * S, 4 * S); ctx.quadraticCurveTo(-5 * S, 8 * S, -4 * S, 12 * S);
      ctx.lineTo(0 * S, 12 * S); ctx.quadraticCurveTo(0 * S, 8 * S, 0 * S, 4 * S);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(8,5,3,1)';
      ctx.beginPath(); ctx.ellipse(-2 * S, 12.2 * S, 2.6 * S, 1.2 * S, 0, 0, 6.283); ctx.fill();
      // a dummy "paw" reference kept at the water for splash/fish code below
      const pawX = -16 * S, pawY = 13 * S;

      // -- NECK + HEAD — the bear DIPS its head down into the water to grab the
      //   fish in its MOUTH on the strike, then lifts it back up. A natural
      //   fishing motion, not an arm thrown overhead.
      const headFwd = strikePhase * 2.5 * S;                    // muzzle reaches forward over the water
      const headDip = strikePhase * strikePhase * 9 * S;        // head plunges DOWN to the water on strike
      // HEAD TRACKS THE FISH while watching — the muzzle follows the swimming
      // fish left→right, exactly like a bear locked onto prey in a documentary.
      let track = 0;
      if (phase === 'watch' || phase === 'lunge') {
        const swimU2 = (huntT / lungeEnd);
        track = (swimU2 - 0.5) * 2.2 * S;                        // follows the fish across the pool
      }
      const hcX = -16 * S - headFwd + track, hcY = 1 * S + headDip + Math.abs(track) * 0.12;
      // thick crouching neck
      ctx.fillStyle = furG;
      ctx.beginPath();
      ctx.moveTo(-10 * S, -5 * S);
      ctx.quadraticCurveTo(-14 * S, -3 * S, hcX + 1 * S, hcY - 2 * S);
      ctx.quadraticCurveTo(hcX + 3 * S, hcY + 3 * S, -8 * S, 1 * S);
      ctx.closePath(); ctx.fill();
      // round head
      ctx.beginPath(); ctx.arc(hcX, hcY, 4.0 * S, 0, 6.283); ctx.fill();
      // ROUND EARS on top — they FLICK now and then (fly shake), like a real bear
      const earFlick = (((tt + 1.2) % 4.2) < 0.15) ? Math.sin(tt * 40) * 0.5 * S : 0;
      ctx.beginPath(); ctx.arc(hcX - 2.0 * S + earFlick, hcY - 3.6 * S, 1.7 * S, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(hcX + 2.6 * S - earFlick, hcY - 3.4 * S, 1.7 * S, 0, 6.283); ctx.fill();
      ctx.fillStyle = furHi;
      ctx.beginPath(); ctx.arc(hcX - 2.0 * S, hcY - 3.6 * S, 0.9 * S, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(hcX + 2.6 * S, hcY - 3.4 * S, 0.9 * S, 0, 6.283); ctx.fill();
      // SHORT TAN SNOUT (forward-down, toward the fish)
      ctx.fillStyle = 'rgba(126,92,56,1)';
      ctx.beginPath(); ctx.ellipse(hcX - 3.6 * S, hcY + 1.6 * S, 2.6 * S, 1.9 * S, -0.15, 0, 6.283); ctx.fill();
      // black nose
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.beginPath(); ctx.ellipse(hcX - 5.4 * S, hcY + 2.4 * S, 1.2 * S, 1.0 * S, 0, 0, 6.283); ctx.fill();
      // eye + catchlight — BLINKS periodically (Hassan: eyes should animate).
      // During devour, eyes squint (chewing/satisfied).
      ctx.fillStyle = 'rgba(18,12,6,1)';
      const eyeOpen = blink ? 0.15 : (phase === 'devour' ? 0.55 : 1.0);
      ctx.beginPath(); ctx.ellipse(hcX - 1.6 * S, hcY - 0.2 * S, 0.8 * S, 0.8 * S * eyeOpen, 0, 0, 6.283); ctx.fill();
      if (eyeOpen > 0.5) {
        ctx.fillStyle = 'rgba(255,236,180,1)';
        ctx.beginPath(); ctx.arc(hcX - 1.4 * S, hcY - 0.5 * S, 0.35 * S, 0, 6.283); ctx.fill();
      }
      // mouth — animates: closed in watch, open wide on strike/carry/devour;
      // during devour it CHEWS (open/close rapidly).
      const chewing = phase === 'devour' ? Math.abs(Math.sin(devourT * 24)) : 0;
      const mouthOpen = phase === 'strike' || phase === 'carry' ? 1.0
                      : phase === 'devour' ? chewing
                      : 0.3;
      ctx.strokeStyle = 'rgba(8,5,3,0.85)'; ctx.lineWidth = 0.7 * S;
      ctx.fillStyle = 'rgba(20,8,4,0.95)';
      ctx.beginPath();
      ctx.ellipse(hcX - 3.3 * S, hcY + 3.0 * S, 1.6 * S, 0.7 * S + mouthOpen * 1.2 * S, -0.1, 0, 6.283);
      ctx.fill();
      // tiny stub tail on the rump — FLICKS (animated)
      ctx.fillStyle = furG;
      ctx.beginPath(); ctx.arc(17 * S + tailFlick * S, 1 * S, 1.3 * S, 0, 6.283); ctx.fill();

      // -- THE SALMON: SMALL (about head-size). Swims past under the bear during
      //   WATCH, is caught in the paw during HOLD. Body uses local units that
      //   are NOT multiplied by the bear scale S, so it's a realistic small fish.
      const drawSalmon = (cx, cy, ang, alpha) => {
        const FS = 2.7;                                          // clearly visible prey, still realistic
        const fwag = Math.sin(tt * 10) * 0.35;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang + fwag * 0.1);
        ctx.globalAlpha = alpha;
        const sg = ctx.createLinearGradient(0, -2 * FS, 0, 2 * FS);
        sg.addColorStop(0, 'rgba(238,228,218,1)');
        sg.addColorStop(0.5, 'rgba(210,150,134,1)');
        sg.addColorStop(1, 'rgba(96,104,112,1)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.moveTo(4 * FS, 0);
        ctx.quadraticCurveTo(2 * FS, -2 * FS, -2 * FS, -1.8 * FS);
        ctx.quadraticCurveTo(-5 * FS, -1 * FS, -6 * FS, 0);
        ctx.quadraticCurveTo(-5 * FS, 1.4 * FS, -2 * FS, 1.8 * FS);
        ctx.quadraticCurveTo(2 * FS, 2 * FS, 4 * FS, 0);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-6 * FS, 0); ctx.lineTo(-9 * FS, -2 * FS + fwag); ctx.lineTo(-7.5 * FS, 0); ctx.lineTo(-9 * FS, 2 * FS + fwag);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(20,18,18,1)';
        ctx.beginPath(); ctx.arc(2 * FS, -0.4 * FS, 0.45 * FS, 0, 6.283); ctx.fill();
        ctx.restore();
      };
      if (phase === 'watch' || phase === 'lunge') {
        // fish swims left→right through the shallows; it repeatedly breaks the
        // SURFACE (dorsal/back showing, with a small wake) so it's obviously live
        // prey the bear is tracking — then dips under right before the strike.
        // fish swims in the OPEN POOL in FRONT of the bear (left side, around the
        // strike zone) — never over the bear's face/body. Porpoises gently.
        const swimU = (huntT / lungeEnd);                        // 0..1 across watch+lunge
        const sx = -30 * S + swimU * 14 * S;                     // stays left, in front of the bear
        const surface = Math.max(0, Math.sin(swimU * Math.PI * 3));  // porpoising in/out of the water
        const sy = 13.5 * S - surface * 2.4 * S;                // sits down in the water
        // a small wake behind the fish on the water surface
        ctx.strokeStyle = 'rgba(235,242,236,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(sx - 3 * S, 13.6 * S, 4 * S, 1.2 * S, 0, 0, 6.283); ctx.stroke();
        drawSalmon(sx, sy, surface * 0.3, 0.95);
      } else if (phase === 'strike') {
        // fish darts under, mostly hidden, just below the descending paw
        drawSalmon(pawX - 2 * S, 13 * S, 0.1, 0.55);
      } else if (phase === 'carry') {
        // fish caught in the paw is carried UP to the MOUTH (eases from the paw
        // position to the snout) — no longer paraded by the eye.
        const wrig = Math.sin(tt * 16) * 0.4;
        const mX = hcX - 3.6 * S, mY = hcY + 2.6 * S;           // mouth / snout tip
        const fromX = pawX + 1.2 * S, fromY = pawY - 0.5 * S;
        const e = carryT * carryT;                              // accelerate toward the mouth
        drawSalmon(fromX + (mX - fromX) * e, fromY + (mY - fromY) * e, -0.5 + wrig, 1.0);
      } else if (phase === 'devour') {
        // fish hangs from the JAWS and is EATEN IN BITES — it shortens in four
        // discrete chunks (synced to the chewing) until it's gone, instead of
        // smoothly fading away (Hassan: the vanishing looked fake).
        const mX = hcX - 3.6 * S, mY = hcY + 2.6 * S;
        const remaining = Math.max(0, 1 - Math.floor(devourT * 4 + 0.001) / 4);  // 1,.75,.5,.25,0
        if (remaining > 0.05) {
          ctx.save();
          ctx.translate(mX, mY); ctx.rotate(0.55); ctx.scale(remaining, 0.92);   // hangs down, shortens
          drawSalmon(0, 0, 0, 1.0);
          ctx.restore();
        }
        // chew flecks fly off as it bites
        if (chewing > 0.7) {
          ctx.fillStyle = 'rgba(228,178,142,0.85)';
          for (let f = 0; f < 3; f++) {
            const fa = -2.2 - f * 0.4, fr = 2 + (tt * 8 + f) % 4;
            ctx.beginPath();
            ctx.arc(mX + Math.cos(fa) * fr, mY + Math.sin(fa) * fr, 0.6 * S, 0, 6.283);
            ctx.fill();
          }
        }
      }

      // -- water disturbance: ripples + spray under the paw strike --
      const wlY = 12 * S;
      ctx.strokeStyle = 'rgba(240,246,238,0.85)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(pawX, wlY, 9 * S, 2 * S, 0, 0, 6.283); ctx.stroke();
      ctx.strokeStyle = 'rgba(240,246,238,0.45)';
      ctx.beginPath(); ctx.ellipse(pawX, wlY, 14 * S, 3.4 * S, 0, 0, 6.283); ctx.stroke();
      // spray flying off when the paw hits the water (strikePhase near 1)
      if (strikePhase > 0.7) {
        ctx.fillStyle = 'rgba(245,250,242,0.95)';
        for (let s = 0; s < 9; s++) {
          const sang = -0.55 - s * 0.16 - Math.sin(tt * 4 + s) * 0.06;
          const sr = (4 + Math.abs(Math.sin(tt * 3 + s)) * 6) * S * (strikePhase - 0.6);
          ctx.beginPath();
          ctx.arc(pawX + Math.cos(sang) * sr, pawY + 2 * S + Math.sin(sang) * sr * 0.5, 1.0 * S, 0, 6.283);
          ctx.fill();
        }
      }

      ctx.restore();
      }
      // ---- a GREAT BLUE HERON wading: slate-blue, S-neck, dagger beak, sometimes
      //   stabbing for a fish. Anatomically tall and angular.
      ctx.save(); ctx.globalAlpha = (1 - nm) * 0.95;
      const hx2 = W * 0.695, hy2 = shoreY(hx2) + 7;
      // shrink the heron to ~0.72 so it reads as a wading bird, much smaller
      // than the horses (Hassan: crane and horse were the same size).
      ctx.translate(hx2, hy2 + 10); ctx.scale(0.72, 0.72); ctx.translate(-hx2, -(hy2 + 10));
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
    if (nightA > 0.02) {
      ctx.save(); ctx.globalAlpha = nightA;
      // night: a fuller circle around the fire, varied dress + hair, gently breathing
      const styles = [
        { shirt: '#c93a1e', hairStyle: 'long' },
        { shirt: '#1f4e8f', hairStyle: 'braid' },
        { shirt: '#d68a1f', hairStyle: 'braid' },
        { shirt: '#5a7d3a', hairStyle: 'long' },
        { shirt: '#7c2f6b', hairStyle: 'braid' },
        { shirt: '#b04a2a', hairStyle: 'braid' },
        { shirt: '#1f4e8f', hairStyle: 'long' },
        { shirt: '#d68a1f', hairStyle: 'braid' },
      ];
      // NIGHT = ONE clean BONFIRE CIRCLE (Hassan: "elder in the middle and all
      // around him in a circle"). An elder sits at the fire telling stories; the
      // community sits AROUND in a ring facing the flames. Calm and spaced — the
      // only night gathering, nothing else cluttering the bank.
      {
        // a male ELDER seated just behind the fire, gesturing as he tells a story
        // (short hair so he reads as an older man, not a girl)
        fig(fx, fy - 2, 1.5, 'wave', 1.0, { shirt: '#5a3a2a', hairStyle: 'short', dir: 1 });
        // listeners seated AROUND the fire — a MIXED community: tall adults,
        // medium youths and small children (per-seat size + hair + shirt vary).
        const seats = [
          [-44, -3, 1.45, 'braid'],   // tall adult (left)
          [-28, 2, 0.85, 'long'],     // small child
          [-13, 5, 1.30, 'long'],     // youth (front-left)
          [13, 5, 0.95, 'braid'],     // small child (front-right)
          [28, 2, 1.45, 'short'],     // tall adult (man)
          [44, -3, 1.15, 'long'],     // medium (right)
        ];
        seats.forEach(([dxx, dyy, sc, hair], i) => {
          const bob = Math.sin(tt * 1.3 + i) * 0.5;
          // PER-SEAT ground: the bank slopes DOWN to the left, so seats left of
          // the fire were rendering below the grass line ("sitting in water").
          const seatY = ground(fx + dxx) + 2 + dyy * 0.4 + bob;
          fig(fx + dxx, seatY, sc, 'sit', i,
              { dir: dxx < 0 ? 1 : -1, shirt: styles[i % styles.length].shirt, hairStyle: hair });
        });
        // one drummer keeping a soft beat, set a little apart
        fig(fx - 66, ground(fx - 66) + 4, 1.25, 'drum', 2, { shirt: '#3a4658', hairStyle: 'braid', dir: 1 });
      }
      // two CHILDREN asleep on a hide, set well AWAY from the fire (left), so the
      // night reads as spread out, not one big crowd.
      {
        const slX = fx - 150, slY = ground(fx - 150) + 8;
        ctx.fillStyle = 'rgba(120,84,52,0.9)';
        ctx.beginPath(); ctx.ellipse(slX, slY + 2, 16, 4, 0, 0, 6.283); ctx.fill();
        for (let s = 0; s < 2; s++) {
          const bx2 = slX - 6 + s * 12, brC = Math.sin(tt * 1.2 + s) * 0.6;
          ctx.fillStyle = ['#5a7d3a', '#c93a1e'][s];
          ctx.beginPath(); ctx.ellipse(bx2, slY - 1 + brC * 0.2, 6, 2.6, 0, 0, 6.283); ctx.fill();
          ctx.fillStyle = '#b7855a';
          ctx.beginPath(); ctx.arc(bx2 - 6, slY - 1, 1.8, 0, 6.283); ctx.fill();
        }
      }
      ctx.restore();
      // ---- WOLVES on the ridge — REMOVED (Hassan: read as "black dinosaurs").
      ctx.save(); ctx.globalAlpha = 0;   // disabled; left in place to avoid touching the long block below
      const wRidgeX = W * 0.42, wRidgeY = hY - 32;
      // Wolves were too small / not animated enough. Wrap in a 2.2x scale and
      // do everything in local (0, 0) coordinates so we don't have to rewrite
      // every offset by hand.
      ctx.translate(wRidgeX, wRidgeY); ctx.scale(0.9, 0.9);    // small distant silhouettes (was 2.2× = "black dinosaurs")
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

  // ---- foreground WILD RICE clumps for depth (Hassan: these were black sticks —
  //   now proper green manoomin stalks: slim green stems, tapering leaves and a
  //   feathery seed-head, swaying. Kept fairly dark for foreground depth but
  //   clearly GREEN and plant-like, never black poles). ----
  {
    const nmF = _smooth(0.52, 0.9, p);                  // match village nightness for colour
    const clumps = [[W * 0.03, 4], [W * 0.06, 3], [W * 0.085, 4], [W * 0.95, 4], [W * 0.92, 3], [W * 0.975, 5]];
    const stemCol = `rgba(${Math.round(_lerp(58, 30, nmF))},${Math.round(_lerp(96, 50, nmF))},${Math.round(_lerp(42, 24, nmF))},0.95)`;
    const headCol = `rgba(${Math.round(_lerp(150, 70, nmF))},${Math.round(_lerp(140, 70, nmF))},${Math.round(_lerp(74, 38, nmF))},0.95)`;
    clumps.forEach((c, i) => {
      const baseX = c[0] + pxX * 40;                    // foreground parallax
      for (let s = 0; s < c[1]; s++) {
        const rx = baseX + (s - c[1] / 2) * 7;
        const tall = 120 + (s % 3) * 26;
        const sway = Math.sin(tt * 1.1 + i + s * 0.6) * (8 + s);
        const topX = rx + sway, topY = H - tall;
        // slim stem
        ctx.strokeStyle = stemCol; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(rx, H);
        ctx.quadraticCurveTo(rx + sway * 0.4, H - tall * 0.55, topX, topY);
        ctx.stroke();
        // a couple of long tapering leaves peeling off the stem
        ctx.lineWidth = 1.6;
        for (const lf of [0.45, 0.7]) {
          const lx = rx + sway * lf * 0.5, ly = H - tall * lf;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.quadraticCurveTo(lx + 16 - s * 3, ly - 8, lx + 26 - s * 4, ly + 6);
          ctx.stroke();
        }
        // feathery seed-head — a soft fan of fine lines at the top (manoomin)
        ctx.strokeStyle = headCol; ctx.lineWidth = 1.0;
        for (let f = 0; f < 6; f++) {
          const fa = -1.3 + f * 0.16;
          ctx.beginPath();
          ctx.moveTo(topX, topY);
          ctx.lineTo(topX + Math.cos(fa) * 14, topY + Math.sin(fa) * 16 + 4);
          ctx.stroke();
        }
      }
    });
  }

  // ---- LAKE WILDLIFE — the CLAN ANIMALS of the water: a LOON (maang, a leader
  //   clan) gliding calmly, and the CRANE (ajijaak, also a leader clan) on the
  //   shore. The old fake-looking ducks/beaver were removed. Gated to daylight. ----
  const wildA = (1 - _smooth(0.62, 0.86, p));
  // `nm` (nightness) is village-block-scoped; define it locally here too so the
  // wildlife colours don't throw "nm is not defined" and crash the render.
  const nm = _smooth(0.52, 0.9, p);
  if (wildA > 0.04) {
    // --- LOON (maang): black head, checkerboard back, white breast, red eye.
    //   Glides slowly across the lake with a soft wake; dips its bill now & then. ---
    {
      const loX = ((tt * 0.010) % 1.25 - 0.12) * W;
      const loY = hY + 30 + (H - hY) * 0.30 + Math.sin(tt * 0.8) * 1.2;
      const dip = Math.max(0, Math.sin(tt * 0.35)) * 3;                          // periodic bill-dip
      ctx.globalAlpha = wildA;
      // SIT the loon IN the water (it was "floating in air"): a soft ripple ring
      // around the hull + a dark reflection beneath, and the wake starts AT the
      // waterline instead of hanging off mid-air.
      ctx.strokeStyle = 'rgba(232,238,236,0.35)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.ellipse(loX, loY + 2.4, 13, 2.6, 0, 0, 6.283); ctx.stroke();   // ripple ring at waterline
      ctx.fillStyle = 'rgba(14,14,18,0.25)';
      ctx.beginPath(); ctx.ellipse(loX, loY + 4, 10, 2, 0, 0, 6.283); ctx.fill();          // reflection/shadow
      // wake trailing on the surface
      ctx.strokeStyle = 'rgba(232,238,236,0.25)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(loX - 10, loY + 2.4); ctx.lineTo(loX - 26, loY + 5.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(loX - 10, loY + 2.4); ctx.lineTo(loX - 26, loY + 0.5); ctx.stroke();
      // low sleek body (dark with a pale flank) — hull sits DOWN into the water
      ctx.fillStyle = 'rgba(28,26,30,1)';
      ctx.beginPath(); ctx.ellipse(loX, loY, 11, 3.2, -0.05, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(225,228,228,0.9)';                                   // white breast/flank
      ctx.beginPath(); ctx.ellipse(loX - 2, loY + 0.8, 7, 1.6, 0, 0, 6.283); ctx.fill();
      // checkerboard hint on the back
      ctx.fillStyle = 'rgba(210,214,214,0.7)';
      for (let cb = 0; cb < 4; cb++) { ctx.beginPath(); ctx.arc(loX - 4 + cb * 3, loY - 2, 0.5, 0, 6.283); ctx.fill(); }
      // upright neck + head (black), dipping bill
      ctx.strokeStyle = 'rgba(20,18,22,1)'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(loX + 7, loY - 1); ctx.quadraticCurveTo(loX + 10, loY - 7, loX + 11, loY - 8 + dip); ctx.stroke();
      ctx.fillStyle = 'rgba(20,18,22,1)';
      ctx.beginPath(); ctx.arc(loX + 11, loY - 8 + dip, 2.2, 0, 6.283); ctx.fill();
      // dagger bill + red eye
      ctx.strokeStyle = 'rgba(20,18,22,1)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(loX + 12.5, loY - 8.5 + dip); ctx.lineTo(loX + 16, loY - 8 + dip); ctx.stroke();
      ctx.fillStyle = 'rgba(190,40,30,1)';
      ctx.beginPath(); ctx.arc(loX + 11, loY - 8.5 + dip, 0.5, 0, 6.283); ctx.fill();
    }
    // --- CRANE / heron standing tall on the near shore, occasionally bowing ---
    {
      // NOTE: `ground` is village-block-scoped and NOT available here, so compute
      // the shore Y inline (same formula: lx0=W*0.45, RISE=H*0.30, +9 ground, +4).
      // Using `ground` here was throwing "ground is not defined" every frame and
      // crashing the whole render — which is why the scene looked frozen/stale.
      const crX = W * 0.86;
      const _crT = _clamp((crX - W * 0.45) / (W - W * 0.45), 0, 1);
      const crBase = (H - 6 - (H * 0.30) * (_crT * 0.6 + _crT * _crT * 0.4)) + 13;
      ctx.save(); ctx.translate(crX, crBase); ctx.scale(1.6, 1.6); ctx.translate(-crX, -crBase);  // bigger / more prominent
      ctx.globalAlpha = wildA * 0.95;
      const bow = Math.max(0, Math.sin(tt * 0.5)) * 6;                                       // periodic bow toward the water
      const col = `rgba(${Math.round(_lerp(150,80,nm))},${Math.round(_lerp(160,92,nm))},${Math.round(_lerp(170,104,nm))},1)`;
      // long legs
      ctx.strokeStyle = 'rgba(50,40,32,1)'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(crX - 1, crBase - 16); ctx.lineTo(crX - 2, crBase); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(crX + 2, crBase - 16); ctx.lineTo(crX + 3, crBase); ctx.stroke();
      // body
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(crX, crBase - 19, 5, 3.2, -0.1, 0, 6.283); ctx.fill();
      // tail plume
      ctx.beginPath(); ctx.moveTo(crX - 4, crBase - 20); ctx.lineTo(crX - 9, crBase - 22); ctx.lineTo(crX - 4, crBase - 18); ctx.fill();
      // S-neck + head (bows down toward the water periodically)
      ctx.strokeStyle = col; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(crX + 3, crBase - 21);
      ctx.quadraticCurveTo(crX + 7, crBase - 27, crX + 5, crBase - 30 + bow);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(crX + 5, crBase - 30 + bow, 1.5, 0, 6.283); ctx.fill();
      // dagger bill
      ctx.strokeStyle = 'rgba(210,180,90,1)'; ctx.lineWidth = 1.0;
      ctx.beginPath(); ctx.moveTo(crX + 5, crBase - 30 + bow); ctx.lineTo(crX + 11, crBase - 29 + bow); ctx.stroke();
      ctx.restore();                                                           // close the 1.6x scale wrap
    }
    // --- PAINTED TURTLE basking on a half-sunk log (mikinaak — culturally
    //   important; Turtle Island). Occasionally stretches its neck. ---
    {
      const tuX = W * 0.30, tuY = hY + 18 + (H - hY) * 0.34;
      ctx.globalAlpha = wildA * 0.95;
      // the log it rests on
      ctx.fillStyle = 'rgba(58,40,24,1)';
      ctx.beginPath(); ctx.ellipse(tuX, tuY + 2, 22, 3.4, -0.04, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(34,22,12,0.7)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(tuX - 18, tuY + 1.5); ctx.lineTo(tuX + 18, tuY + 1); ctx.stroke();
      // reflection under the log
      ctx.fillStyle = 'rgba(20,16,12,0.18)';
      ctx.beginPath(); ctx.ellipse(tuX, tuY + 6, 20, 2.2, 0, 0, 6.283); ctx.fill();
      // shell (domed, with scute lines + a warm rim)
      const shell = ctx.createLinearGradient(tuX, tuY - 6, tuX, tuY + 1);
      shell.addColorStop(0, 'rgba(70,86,52,1)'); shell.addColorStop(1, 'rgba(36,46,26,1)');
      ctx.fillStyle = shell;
      ctx.beginPath(); ctx.ellipse(tuX, tuY - 1, 8, 4.4, 0, Math.PI, 2 * Math.PI); ctx.fill();
      ctx.beginPath(); ctx.ellipse(tuX, tuY - 1, 8, 2.2, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(30,38,20,0.8)'; ctx.lineWidth = 0.5;
      for (let sl = -2; sl <= 2; sl++) { ctx.beginPath(); ctx.moveTo(tuX + sl * 3, tuY - 5); ctx.lineTo(tuX + sl * 3.4, tuY - 1); ctx.stroke(); }
      // head stretches out periodically + red ear-stripe of a painted turtle
      const neck = Math.max(0, Math.sin(tt * 0.4)) * 4;
      ctx.fillStyle = 'rgba(58,70,40,1)';
      ctx.beginPath(); ctx.ellipse(tuX - 8 - neck, tuY - 1, 2.4, 1.6, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(200,70,50,0.9)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(tuX - 8 - neck, tuY - 2); ctx.lineTo(tuX - 6 - neck, tuY - 1); ctx.stroke();
      // little legs
      ctx.fillStyle = 'rgba(50,62,34,1)';
      ctx.beginPath(); ctx.ellipse(tuX - 5, tuY + 1, 2, 1.1, 0.4, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.ellipse(tuX + 5, tuY + 1, 2, 1.1, -0.4, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- LEAPING FISH: a proper parabolic arc, the body curls/bends as it goes ----
  for (const fi of _FISH) {
    const loc = ((tt + fi.phase) % fi.period) / fi.period;
    if (loc >= 0.22) continue;                       // a longer, slower, more readable leap
    const k = loc / 0.22;                            // 0..1 through the arc
    const dir = fi.dir || 1;                          // direction of travel along the parabola
    const span = 90;                                  // WIDE horizontal travel → a real projectile arc, not a vertical pop
    const arcH = 26;                                  // lower peak so the arc is long & shallow like a real leap
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
    // curved body — HEAD at +x (leads the direction of travel), TAIL at -x
    ctx.beginPath();
    ctx.moveTo(12, 0);                                       // nose
    ctx.quadraticCurveTo(7, -4 + curl * 2, -2, -3.6 + curl * 1.5);
    ctx.quadraticCurveTo(-9, -2, -12, 0);                    // back toward tail
    ctx.quadraticCurveTo(-9, 3 + curl * 1.5, -2, 3.6 + curl * 2);
    ctx.quadraticCurveTo(7, 4 + curl * 2, 12, 0);
    ctx.closePath(); ctx.fill();
    // forked tail flicking (at the BACK, -x)
    ctx.beginPath();
    ctx.moveTo(-12, 0); ctx.lineTo(-17, -4 + curl * 3); ctx.lineTo(-14, 0); ctx.lineTo(-17, 4 + curl * 3);
    ctx.closePath(); ctx.fill();
    // dorsal fin (points up)
    ctx.beginPath(); ctx.moveTo(0, -3.5); ctx.lineTo(-3, -7); ctx.lineTo(-6, -3.5); ctx.closePath(); ctx.fill();
    // eye (near the nose, +x)
    ctx.fillStyle = `rgba(20,20,22,${bodyA})`;
    ctx.beginPath(); ctx.arc(6, -0.8, 0.7, 0, 6.283); ctx.fill();
    // water droplets sliding off the back
    if (k < 0.55) {
      ctx.fillStyle = `rgba(220,232,236,${bodyA * 0.85})`;
      for (let d = 0; d < 3; d++) {
        ctx.beginPath(); ctx.arc(4 - d * 4, -5 - d * 1.5 - k * 4, 0.7, 0, 6.283); ctx.fill();
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
      <h1 className="wv-title">A Living Atlas of<br /><em>Individual, Family &amp; Community<br />Health &amp; Wellness.</em></h1>
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
