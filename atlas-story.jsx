/* global React, L */
// ============================================================================
// Atlas Story — ArcGIS-StoryMaps-style scrollytelling (v2, cinematic).
//   Full-bleed Leaflet map flies between the four Sacred Directions as you
//   scroll. Active direction: markers DROP IN with a stagger, PULSE with
//   radar halos, and a route line DRAWS ITSELF between the communities. A
//   seasonal colour wash tints the map. Stats COUNT UP. Progress dots are
//   clickable. Every number/name is live from the master sheet. Self-
//   contained Leaflet instance, cleaned up on unmount — can't touch the
//   main map.
// ============================================================================
const { useState: useS_st, useEffect: useE_st, useRef: useR_st, useMemo: useM_st } = React;

const STORY_DIRS = [
  { key: 'East',  season: 'Spring · Ziigwan',  medicine: 'Tobacco · Asemaa',
    color: '#d4a017', stage: 'New beginnings',
    blurb: 'In the east the sun rises and the year is reborn. These are the communities of renewal — where new programs are taking root and the work begins again.' },
  { key: 'South', season: 'Summer · Niibin',   medicine: 'Cedar · Giizhik',
    color: '#b8351e', stage: 'Growth · the body',
    blurb: 'The south is warmth and growth, the season of the body and of youth. Here the focus turns to physical health and the vitality of the next generation.' },
  { key: 'West',  season: 'Autumn · Dagwaagin', medicine: 'Sage · Mashkodewashk',
    color: '#1a1612', stage: 'Reflection · the mind',
    blurb: 'In the west the light softens and we turn inward. The season of the mind — mental health, healing from harm, and the harder roads walked together.' },
  { key: 'North', season: 'Winter · Biboon',    medicine: 'Sweetgrass · Wiingashk',
    color: '#6b8d6b', stage: 'Wisdom · the elders',
    blurb: 'The north holds winter and wisdom — the elders, the ceremonies, the deep memory the community carries forward through the cold and into the light again.' },
];
const DIR_COLOR = { East: '#d4a017', South: '#b8351e', West: '#1a1612', North: '#6b8d6b', Central: '#6b8d6b' };
const DIR_FALLBACK = {
  East:  { center: [45.0, -76.0], zoom: 6 },
  South: { center: [43.2, -81.5], zoom: 6 },
  West:  { center: [49.8, -97.1], zoom: 5 },
  North: { center: [52.5, -87.5], zoom: 5 },
  Central:{ center: [49.0, -86.0], zoom: 4 },
};

// greedy nearest-neighbour ordering so the route line reads like a journey
function orderByNearest(points) {
  if (points.length < 3) return points.slice();
  const pts = points.slice();
  // start from the west-most point
  pts.sort((a, b) => a[1] - b[1]);
  const ordered = [pts.shift()];
  while (pts.length) {
    const last = ordered[ordered.length - 1];
    let bi = 0, bd = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const dx = pts[i][0] - last[0], dy = pts[i][1] - last[1];
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; bi = i; }
    }
    ordered.push(pts.splice(bi, 1)[0]);
  }
  return ordered;
}

function CountUp({ value, active, duration = 1000, format }) {
  const [v, setV] = useS_st(0);
  const raf = useR_st(null);
  useE_st(() => {
    if (!active) { setV(value); return; }
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setV(value); return; }
    let start = null; const from = 0;
    function tick(t) {
      if (start == null) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(from + (value - from) * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => raf.current && cancelAnimationFrame(raf.current);
  }, [active, value, duration]);
  return <>{format ? format(v) : v}</>;
}

// Read a CMS-controlled story setting with a fallback default.
function storySetting(key, fallback) {
  const s = window.ATLAS_SETTINGS || {};
  const v = s['story.' + key];
  if (v == null) return fallback;
  const t = String(v).trim();
  return t === '' ? fallback : v;
}

function AtlasStoryView({ all, setView, onSelect }) {
  // Re-render when the admin edits story content in the CMS (SSE).
  const [, _bumpSettings] = useS_st(0);
  useE_st(() => {
    function h() { _bumpSettings((n) => n + 1); }
    window.addEventListener('atlas:settings', h);
    return () => window.removeEventListener('atlas:settings', h);
  }, []);

  const mapElRef = useR_st(null);
  const mapRef = useR_st(null);
  const markerLayerRef = useR_st(null);
  const routeLayerRef = useR_st(null);
  const haloLayerRef = useR_st(null);
  const dirMarkersRef = useR_st({});
  const pulseRafRef = useR_st(null);
  const dropRafRef = useR_st(null);
  const sparkRafRef = useR_st(null);
  const sparkRef = useR_st(null);
  const svgRendererRef = useR_st(null);
  const scrollingRef = useR_st(false);   // true while the user is actively scrolling
  const permLabelsRef = useR_st([]);     // permanent name labels on the active direction
  const [activeDir, setActiveDir] = useS_st('intro');
  const [touring, setTouring] = useS_st(false);   // elder-friendly auto-advance
  const [bigText, setBigText] = useS_st(() => {
    try { return localStorage.getItem('story-big-text') === '1'; } catch (e) { return false; }
  });
  const tourTimerRef = useR_st(null);
  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Auto-tour: gently scroll through each scene on a timer so elders can
  // watch the whole journey hands-free. Any manual scroll/click stops it.
  const SCENE_ORDER = ['intro', ...STORY_DIRS.map((d) => d.key), 'outro'];
  useE_st(() => {
    if (!touring) { if (tourTimerRef.current) { clearTimeout(tourTimerRef.current); tourTimerRef.current = null; } return; }
    function step() {
      setActiveDir((cur) => {
        const i = SCENE_ORDER.indexOf(cur);
        const next = SCENE_ORDER[i + 1];
        if (!next) { setTouring(false); return cur; }
        const el = document.querySelector('[data-story-scene="' + next + '"]');
        if (el) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        return cur;   // scroll-spy will set the real activeDir
      });
      tourTimerRef.current = setTimeout(step, 6500);
    }
    tourTimerRef.current = setTimeout(step, 4500);
    return () => { if (tourTimerRef.current) clearTimeout(tourTimerRef.current); };
  }, [touring]);

  // Stop the tour the moment the visitor takes the wheel themselves.
  useE_st(() => {
    if (!touring) return;
    function stop() { setTouring(false); }
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchmove', stop, { passive: true });
    return () => { window.removeEventListener('wheel', stop); window.removeEventListener('touchmove', stop); };
  }, [touring]);

  useE_st(() => { try { localStorage.setItem('story-big-text', bigText ? '1' : '0'); } catch (e) {} }, [bigText]);

  const dirData = useM_st(() => {
    const out = {};
    for (const d of STORY_DIRS) {
      const comms = (all || []).filter((c) => (c.direction || 'Central') === d.key);
      const geo = comms.filter((c) => c.lat != null && (c.lng != null || c.lon != null));
      const totalPop = comms.reduce((s, c) => s + (c.population || 0), 0);
      const pc = { Physical: 0, Mental: 0, Spiritual: 0, Emotional: 0 };
      comms.forEach((c) => {
        if (c.hasPhysical) pc.Physical++; if (c.hasMental) pc.Mental++;
        if (c.hasSpiritual) pc.Spiritual++; if (c.hasEmotional) pc.Emotional++;
      });
      const top = Object.entries(pc).sort((a, b) => b[1] - a[1])[0];
      out[d.key] = {
        count: comms.length, geo, totalPop,
        topPillar: top && top[1] > 0 ? top[0] : null,
        samples: comms.map((c) => c.name),
      };
    }
    return out;
  }, [all]);

  // ---- init Leaflet once ----
  useE_st(() => {
    if (!mapElRef.current || mapRef.current || typeof L === 'undefined') return;
    const map = L.map(mapElRef.current, {
      center: [52.5, -88.5], zoom: 4,
      zoomControl: false, attributionControl: true,
      scrollWheelZoom: false, dragging: false, doubleClickZoom: false,
      boxZoom: false, keyboard: false, touchZoom: false, zoomSnap: 0.25,
      preferCanvas: true,          // canvas-render markers/halos → smooth animation
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abc', maxZoom: 18,
    }).addTo(map);
    // keep an SVG renderer just for the route line so it can draw itself in
    svgRendererRef.current = L.svg().addTo(map);
    haloLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const byDir = {};
    (all || []).forEach((c) => {
      const lat = c.lat, lng = (c.lng != null ? c.lng : c.lon);
      if (lat == null || lng == null) return;
      const dir = c.direction || 'Central';
      const color = DIR_COLOR[dir] || '#6b8d6b';
      const m = L.circleMarker([lat, lng], {
        radius: 5, color: '#fff', weight: 1.2, fillColor: color, fillOpacity: 0.35, opacity: 0.5,
        className: 'story-cmarker',
      });
      m.__color = color; m.__c = c; m.__base = 5;
      // hover: grow + glow + raise
      m.on('mouseover', () => {
        try { m.setRadius((m.__base || 5) + 5); m.setStyle({ fillOpacity: 1, opacity: 1, weight: 2.5 }); m.bringToFront(); } catch (e) {}
      });
      m.on('mouseout', () => {
        try { m.setRadius(m.__base || 5); m.setStyle({ weight: m.__activeNow ? 2 : 1 }); } catch (e) {}
      });
      // click: fly to it (offset for the drawer) + ping + open record
      m.on('click', () => { flyToCommunity(c.name); });
      m.bindTooltip(c.name, { direction: 'top', opacity: 0.95, className: 'story-mtt' });
      m.addTo(markerLayerRef.current);
      (byDir[dir] = byDir[dir] || []).push(m);
    });
    dirMarkersRef.current = byDir;

    setTimeout(() => {
      try {
        const allM = Object.values(byDir).flat();
        if (allM.length) map.fitBounds(L.featureGroup(allM).getBounds().pad(0.15), { animate: false });
      } catch (e) {}
    }, 60);

    return () => {
      if (pulseRafRef.current) cancelAnimationFrame(pulseRafRef.current);
      if (dropRafRef.current) cancelAnimationFrame(dropRafRef.current);
      if (sparkRafRef.current) cancelAnimationFrame(sparkRafRef.current);
      try { map.remove(); } catch (e) {}
      mapRef.current = null;
    };
  }, [all, onSelect]);

  // ---- stop the pulse/drop/spark animations ----
  function stopAnims() {
    if (pulseRafRef.current) { cancelAnimationFrame(pulseRafRef.current); pulseRafRef.current = null; }
    if (dropRafRef.current) { cancelAnimationFrame(dropRafRef.current); dropRafRef.current = null; }
    if (sparkRafRef.current) { cancelAnimationFrame(sparkRafRef.current); sparkRafRef.current = null; }
    sparkRef.current = null;
    try { haloLayerRef.current && haloLayerRef.current.clearLayers(); } catch (e) {}
    try { routeLayerRef.current && routeLayerRef.current.clearLayers(); } catch (e) {}
  }

  // ---- one-off expanding ping at a point (used on click) ----
  function pingAt(lat, lng, color) {
    if (reduceMotion || !haloLayerRef.current || typeof L === 'undefined') return;
    try {
      const ping = L.circleMarker([lat, lng], { radius: 8, color: color || '#b8351e', weight: 2.5, fillOpacity: 0, opacity: 1 })
        .addTo(haloLayerRef.current);
      let s = null;
      function pl(t) { if (s == null) s = t; const p = Math.min(1, (t - s) / 850);
        try { ping.setRadius(8 + p * 34); ping.setStyle({ opacity: 1 - p, weight: 2.5 * (1 - p) }); } catch (e) {}
        if (p < 1) requestAnimationFrame(pl); else { try { haloLayerRef.current.removeLayer(ping); } catch (e) {} } }
      requestAnimationFrame(pl);
    } catch (e) {}
  }

  // ---- pulsing radar halos ----
  // Capped to a handful of rings and throttled to ~30fps; paused entirely
  // while the user is actively scrolling so the page never janks.
  function startPulse(geoMarkers, color) {
    if (reduceMotion || !geoMarkers.length) return;
    // cap the number of animated rings — redrawing dozens of canvas circles
    // every frame is what made scrolling stutter on big directions.
    const PULSE_CAP = 8;
    const chosen = geoMarkers.length > PULSE_CAP
      ? geoMarkers.filter((_, i) => i % Math.ceil(geoMarkers.length / PULSE_CAP) === 0).slice(0, PULSE_CAP)
      : geoMarkers;
    const rings = chosen.map((m) => {
      const ll = m.getLatLng();
      return { ring: L.circleMarker(ll, { radius: 8, color, weight: 2, fillColor: color, fillOpacity: 0, opacity: 0.65 }).addTo(haloLayerRef.current) };
    });
    let t0 = null, last = 0;
    function loop(t) {
      pulseRafRef.current = requestAnimationFrame(loop);
      if (t0 == null) t0 = t;
      if (scrollingRef.current) return;          // don't repaint mid-scroll
      if (t - last < 33) return;                 // ~30fps cap
      last = t;
      const phase = ((t - t0) % 2000) / 2000;
      const r = 8 + phase * 32;
      const op = 0.6 * (1 - phase);
      const w = 2 * (1 - phase);
      rings.forEach(({ ring }) => { try { ring.setRadius(r); ring.setStyle({ opacity: op, weight: w }); } catch (e) {} });
    }
    pulseRafRef.current = requestAnimationFrame(loop);
  }

  // ---- a bright spark that travels along the route, looping ----
  function startSpark(pts, color) {
    if (reduceMotion || !pts || pts.length < 2 || !routeLayerRef.current) return;
    try {
      // cumulative segment lengths for even-speed travel
      const seg = [];
      let total = 0;
      for (let i = 1; i < pts.length; i++) {
        const dx = pts[i][0] - pts[i-1][0], dy = pts[i][1] - pts[i-1][1];
        const d = Math.sqrt(dx*dx + dy*dy); seg.push(d); total += d;
      }
      if (total <= 0) return;
      const spark = L.circleMarker(pts[0], { radius: 5, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1, opacity: 1 })
        .addTo(routeLayerRef.current);
      sparkRef.current = spark;
      const period = 3400;
      let t0 = null, last = 0;
      function loop(t) {
        sparkRafRef.current = requestAnimationFrame(loop);
        if (t0 == null) t0 = t;
        if (scrollingRef.current) return;        // pause while scrolling
        if (t - last < 33) return;               // ~30fps cap
        last = t;
        const prog = ((t - t0) % period) / period;     // 0..1 along route
        let dist = prog * total, i = 0;
        while (i < seg.length && dist > seg[i]) { dist -= seg[i]; i++; }
        if (i >= seg.length) i = seg.length - 1;
        const f = seg[i] ? dist / seg[i] : 0;
        const a = pts[i], b = pts[i+1] || pts[i];
        const lat = a[0] + (b[0]-a[0]) * f, lng = a[1] + (b[1]-a[1]) * f;
        try { spark.setLatLng([lat, lng]); } catch (e) {}
      }
      sparkRafRef.current = requestAnimationFrame(loop);
    } catch (e) {}
  }

  // ---- markers drop in with a stagger ----
  function dropIn(geoMarkers) {
    if (reduceMotion) { geoMarkers.forEach((m) => m.setRadius(8)); return; }
    geoMarkers.forEach((m) => m.setRadius(0.1));
    const dur = 480, gap = 55, start = performance.now();
    function tick(now) {
      let done = true;
      geoMarkers.forEach((m, i) => {
        const local = now - start - i * gap;
        let p = local <= 0 ? 0 : Math.min(1, local / dur);
        if (p < 1) done = false;
        const eased = p < 1 ? 1 - Math.pow(1 - p, 3) : 1;
        // slight overshoot for a bouncy drop
        const r = 8 * (eased + (p < 1 ? Math.sin(p * Math.PI) * 0.18 : 0));
        try { m.setRadius(Math.max(0.1, r)); } catch (e) {}
      });
      if (!done) dropRafRef.current = requestAnimationFrame(tick);
    }
    dropRafRef.current = requestAnimationFrame(tick);
  }

  // ---- permanent name labels on the active direction (elder-friendly: no
  //      hovering needed). Capped so big directions don't turn into clutter. ----
  function clearLabels() {
    const map = mapRef.current;
    permLabelsRef.current.forEach((tt) => { try { map && map.removeLayer(tt); } catch (e) {} });
    permLabelsRef.current = [];
  }
  function showLabels(geoMarkers) {
    clearLabels();
    const map = mapRef.current;
    if (!map || !geoMarkers || geoMarkers.length === 0 || geoMarkers.length > 9) return;
    geoMarkers.forEach((m) => {
      try {
        const tt = L.tooltip({ permanent: true, direction: 'top', opacity: 0.96,
          className: 'story-mtt story-mtt-perm' })
          .setLatLng(m.getLatLng())
          .setContent(m.__c ? m.__c.name : '');
        tt.addTo(map);
        permLabelsRef.current.push(tt);
      } catch (e) {}
    });
  }

  // ---- self-drawing route polyline; returns the ordered points ----
  function drawRoute(geoMarkers, color) {
    if (reduceMotion || geoMarkers.length < 2) return null;
    try {
      const pts = orderByNearest(geoMarkers.map((m) => {
        const ll = m.getLatLng(); return [ll.lat, ll.lng];
      }));
      const line = L.polyline(pts, {
        color, weight: 2.5, opacity: 0.7, dashArray: null,
        lineCap: 'round', lineJoin: 'round',
        renderer: svgRendererRef.current,   // SVG so it can self-draw
      }).addTo(routeLayerRef.current);
      const path = line._path;
      if (path && path.getTotalLength) {
        const len = path.getTotalLength();
        path.style.transition = 'none';
        path.style.strokeDasharray = len + ' ' + len;
        path.style.strokeDashoffset = String(len);
        path.getBoundingClientRect(); // reflow
        path.style.transition = 'stroke-dashoffset 1.7s cubic-bezier(.16,.84,.36,1)';
        path.style.strokeDashoffset = '0';
      }
      return pts;
    } catch (e) { return null; }
  }

  // ---- react to scene change: fly + emphasise + animate ----
  // Split into a CHEAP immediate part (marker emphasis only — no camera move,
  // no animation loops) and a HEAVY debounced part (the camera fly + drop-in +
  // route + pulse + labels). When the user scrolls fast through several scenes
  // the heavy part is cancelled and only the scene they settle on animates —
  // this is what stops the map hanging on scroll.
  useE_st(() => {
    const map = mapRef.current;
    if (!map) return;
    stopAnims();
    clearLabels();

    const byDir = dirMarkersRef.current;
    const allM = Object.values(byDir).flat();

    // -- cheap, immediate: just re-style the markers --
    if (activeDir === 'intro' || activeDir === 'outro') {
      allM.forEach((m) => { m.__activeNow = false; m.__base = 5; m.setStyle({ fillOpacity: 0.4, opacity: 0.55, weight: 1.2 }); m.setRadius(5); });
    } else {
      Object.entries(byDir).forEach(([dir, markers]) => {
        const on = dir === activeDir;
        markers.forEach((m) => {
          m.__activeNow = on;
          m.__base = on ? 8 : 3.5;
          m.setStyle({ fillOpacity: on ? 0.95 : 0.12, opacity: on ? 1 : 0.2, weight: on ? 2 : 1 });
          if (!on) m.setRadius(3.5);
          if (on) m.bringToFront();
        });
      });
    }

    // -- heavy, debounced: camera move + animations once the user settles --
    const dur = reduceMotion ? 0 : 1.3;
    const settleDelay = reduceMotion ? 0 : 280;
    const t = setTimeout(() => {
      if (activeDir === 'intro' || activeDir === 'outro') {
        try { if (allM.length) map.flyToBounds(L.featureGroup(allM).getBounds().pad(0.15), { duration: dur }); } catch (e) {}
        return;
      }
      const data = dirData[activeDir];
      const color = DIR_COLOR[activeDir] || '#b8351e';
      const activeMarkers = (byDir[activeDir] || []);
      if (data && data.geo.length) {
        try {
          const grp = L.featureGroup(data.geo.map((c) => L.marker([c.lat, (c.lng != null ? c.lng : c.lon)])));
          map.flyToBounds(grp.getBounds().pad(0.4), { duration: dur, maxZoom: 7 });
        } catch (e) {
          const fb = DIR_FALLBACK[activeDir] || DIR_FALLBACK.Central; map.flyTo(fb.center, fb.zoom, { duration: dur });
        }
      } else {
        const fb = DIR_FALLBACK[activeDir] || DIR_FALLBACK.Central; map.flyTo(fb.center, fb.zoom, { duration: dur });
      }
      // animations shortly after the camera starts moving
      setTimeout(() => {
        dropIn(activeMarkers);
        const pts = drawRoute(activeMarkers, color);
        startPulse(activeMarkers, color);
        showLabels(activeMarkers);
        if (pts) setTimeout(() => startSpark(pts, color), 900);
      }, reduceMotion ? 0 : 300);
    }, settleDelay);
    return () => clearTimeout(t);
  }, [activeDir, dirData, reduceMotion]);

  // ---- pause heavy canvas animation while the user is scrolling ----
  useE_st(() => {
    let idle = null;
    function onScroll() {
      scrollingRef.current = true;
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => { scrollingRef.current = false; }, 140);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (idle) clearTimeout(idle); };
  }, []);

  // ---- scene scroll spy ----
  useE_st(() => {
    const scenes = Array.from(document.querySelectorAll('[data-story-scene]'));
    if (!scenes.length) return;
    const io = new IntersectionObserver((entries) => {
      let best = null, bestRatio = 0;
      for (const e of entries) {
        if (e.isIntersecting && e.intersectionRatio > bestRatio) { bestRatio = e.intersectionRatio; best = e.target; }
      }
      if (best) setActiveDir(best.getAttribute('data-story-scene'));
    }, { root: null, rootMargin: '-40% 0px -40% 0px', threshold: [0.01, 0.25, 0.5, 0.75] });
    scenes.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [dirData]);

  function flyToCommunity(name) {
    const c = (all || []).find((x) => x.name === name);
    if (!c) return;
    const map = mapRef.current;
    const lat = c.lat, lng = (c.lng != null ? c.lng : c.lon);
    if (map && lat != null && lng != null) {
      try {
        const zoom = 8;
        // The record drawer opens on the right, so center the point in the
        // LEFT part of the map — otherwise the zoom lands behind the drawer
        // and it looks like "nothing happened".
        const size = map.getSize();
        const pt = map.project([lat, lng], zoom).add([size.x * 0.26, 0]);
        const center = map.unproject(pt, zoom);
        map.flyTo(center, zoom, { duration: reduceMotion ? 0 : 1.4 });
        pingAt(lat, lng, DIR_COLOR[c.direction] || '#b8351e');
      } catch (e) {}
    }
    // always open the record, even when the point has no coordinates, so a
    // click always does something visible.
    if (onSelect && c.id) setTimeout(() => onSelect(c.id), reduceMotion ? 0 : 850);
  }

  function jumpToScene(key) {
    const el = document.querySelector('[data-story-scene="' + key + '"]');
    if (el) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  }

  const grand = useM_st(() => ({
    total: (all || []).length,
    pop: (all || []).reduce((s, c) => s + (c.population || 0), 0),
  }), [all]);

  // active scene's CMS background image (empty → map shows through)
  const activeImage = storySetting(activeDir + '.image', '');
  const onImage = !!activeImage;

  return (
    <section className={`story-shell${bigText ? ' big-text' : ''}`}>
      <div className="story-controls" role="group" aria-label="Story controls">
        <button className={`story-ctrl${touring ? ' on' : ''}`}
                onClick={() => { if (!touring) { jumpToScene('intro'); } setTouring((t) => !t); }}
                title={touring ? 'Stop the guided tour' : 'Play a hands-free guided tour'}>
          {touring ? '⏸ Pause tour' : '▶ Play guided tour'}
        </button>
        <button className={`story-ctrl${bigText ? ' on' : ''}`}
                onClick={() => setBigText((b) => !b)}
                title="Make the text bigger and easier to read">
          🅰 {bigText ? 'Normal text' : 'Bigger text'}
        </button>
      </div>

      <div className="story-map-bg">
        <div ref={mapElRef} className="story-map" />
        <div className="story-map-tint"
             style={{ '--tint': DIR_COLOR[activeDir] || '#6b8d6b',
                      opacity: (activeDir === 'intro' || activeDir === 'outro') ? 0.35 : 1 }} />
        <div className="story-map-vignette" />
        <div className={`story-image-layer${onImage ? ' show' : ''}`}
             style={onImage ? { backgroundImage: `url("${activeImage}")` } : null} />
        <div className={`story-image-scrim${onImage ? ' show' : ''}`} />
        <div className="story-map-veil" />
      </div>

      <div className="story-scenes">
        <div className="story-scene story-intro" data-story-scene="intro">
          <div className={`story-card story-card-hero${storySetting('intro.image','') ? ' on-image' : ''}`}>
            <p className="story-eyebrow">{storySetting('intro.subtitle', 'Mino Bimaadiziwin · A guided journey')}</p>
            <h2 className="story-title">{storySetting('intro.title', 'Walk the four directions.')}</h2>
            <p className="story-lede">
              <strong><CountUp value={grand.total} active={activeDir === 'intro'} /></strong> communities
              and partners across Turtle Island, serving roughly{' '}
              <strong><CountUp value={grand.pop} active={activeDir === 'intro'} format={(n) => n.toLocaleString()} /></strong> people.
              {' '}{storySetting('intro.body', 'Scroll slowly — the map will carry you through each Sacred Direction, season by season.')}
            </p>
            <div className="story-scroll-cue">↓ scroll to begin</div>
          </div>
        </div>

        {STORY_DIRS.map((d) => {
          const data = dirData[d.key] || {};
          const isActive = activeDir === d.key;
          const dirImg = storySetting(d.key + '.image', '');
          const hasImg = !!dirImg;
          const accent = storySetting(d.key + '.accent', d.color);
          return (
            <div className="story-scene" data-story-scene={d.key} key={d.key}>
              <div className={`story-card${isActive ? ' is-active' : ''}`} style={{ '--accent': accent }}>
                {hasImg && (
                  <div className="story-card-img" style={{ backgroundImage: `url("${dirImg}")` }} role="img"
                       aria-label={storySetting(d.key + '.title', d.key) + ' image'} />
                )}
                <div className="story-card-dir" style={{ color: accent }}>{storySetting(d.key + '.title', d.key)}</div>
                <div className="story-card-season">{storySetting(d.key + '.subtitle', d.season)}</div>
                <p className="story-card-blurb">{storySetting(d.key + '.body', d.blurb)}</p>
                <div className="story-stats">
                  <div className="story-stat">
                    <span className="story-stat-n"><CountUp value={data.count || 0} active={isActive} /></span>
                    <span className="story-stat-l">communities</span>
                  </div>
                  <div className="story-stat">
                    <span className="story-stat-n"><CountUp value={Math.round((data.totalPop || 0) / 1000)} active={isActive} />k</span>
                    <span className="story-stat-l">people</span>
                  </div>
                  <div className="story-stat">
                    <span className="story-stat-n">{data.topPillar || '—'}</span>
                    <span className="story-stat-l">strongest pillar</span>
                  </div>
                </div>
                {data.samples && data.samples.length > 0 && (
                  <div className="story-samples-wrap">
                    <div className="story-samples-head">
                      {data.samples.length} {data.samples.length === 1 ? 'community' : 'communities'} · tap any to fly there
                    </div>
                    <div className="story-samples">
                      {data.samples.map((n) => (
                        <button key={n} className="story-sample" onClick={() => flyToCommunity(n)} title="Fly here & open record">
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="story-medicine">Medicine · {d.medicine} &nbsp;·&nbsp; {d.stage}</div>
              </div>
            </div>
          );
        })}

        <div className="story-scene story-outro" data-story-scene="outro">
          <div className={`story-card story-card-hero${storySetting('outro.image','') ? ' on-image' : ''}`}>
            <h2 className="story-title">{storySetting('outro.title', 'The whole circle.')}</h2>
            <p className="story-lede">
              {storySetting('outro.body', "Every direction, every season, held together in one living atlas. Explore it freely — search, filter, and open any community's full record.")}
            </p>
            <div className="story-cta-row">
              <button className="story-cta" onClick={() => setView && setView('map')}>◉ Open the full map</button>
              <button className="story-cta ghost" onClick={() => setView && setView('analytics')}>◐ See the analytics</button>
            </div>
          </div>
        </div>
      </div>

      <StoryCompass activeDir={activeDir} onPick={jumpToScene} />

      <div className="story-progress-dots">
        {['intro', ...STORY_DIRS.map((d) => d.key), 'outro'].map((k) => (
          <span key={k} className={k === activeDir ? 'on' : ''} title={k}
                style={{ pointerEvents: 'auto', cursor: 'pointer',
                         background: k === activeDir ? (DIR_COLOR[k] || '#b8351e') : undefined }}
                onClick={() => jumpToScene(k)} />
        ))}
      </div>
    </section>
  );
}

// Medicine-wheel compass overlay. Pure SVG (off the map canvas, so it never
// adds lag) — shows the four directions, highlights the active one, and the
// quadrants are clickable to jump straight to that scene. Elder-friendly: big
// labels, the active season + medicine spelled out beneath.
function StoryCompass({ activeDir, onPick }) {
  // clockwise from top: East, South, West, North (medicine-wheel order)
  const quads = [
    { key: 'East',  a0: -45, a1: 45,   color: '#d4a017' },
    { key: 'South', a0: 45,  a1: 135,  color: '#b8351e' },
    { key: 'West',  a0: 135, a1: 225,  color: '#1a1612' },
    { key: 'North', a0: 225, a1: 315,  color: '#6b8d6b' },
  ];
  const cx = 60, cy = 60, r = 50;
  const pol = (ang, rad) => [cx + rad * Math.cos((ang - 90) * Math.PI / 180),
                             cy + rad * Math.sin((ang - 90) * Math.PI / 180)];
  const wedge = (a0, a1) => {
    const [x0, y0] = pol(a0, r), [x1, y1] = pol(a1, r);
    return `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
  };
  const labelPos = (a0, a1) => pol((a0 + a1) / 2, r * 0.6);
  const active = STORY_DIRS.find((d) => d.key === activeDir);

  return (
    <div className="story-compass" aria-label="Four directions compass">
      <svg viewBox="0 0 120 120" width="120" height="120">
        {quads.map((q) => {
          const on = q.key === activeDir;
          const [lx, ly] = labelPos(q.a0, q.a1);
          return (
            <g key={q.key} className={`sc-quad${on ? ' on' : ''}`} onClick={() => onPick(q.key)} style={{ cursor: 'pointer' }}>
              <path d={wedge(q.a0, q.a1)} fill={q.color} opacity={on ? 0.95 : 0.28} />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
                    fill={q.key === 'West' ? '#fff' : (on ? '#fff' : 'rgba(255,255,255,0.85)')}
                    fontSize={on ? 12 : 10} fontWeight={on ? 700 : 500}>{q.key[0]}</text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r="6" fill="#fff" />
      </svg>
      {active && (
        <div className="story-compass-cap">
          <strong>{active.key}</strong>
          <span>{active.season}</span>
          <span>{active.medicine}</span>
        </div>
      )}
    </div>
  );
}
window.AtlasStoryView = AtlasStoryView;
