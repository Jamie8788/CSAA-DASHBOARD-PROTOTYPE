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
  const [activeDir, setActiveDir] = useS_st('intro');
  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
        samples: comms.slice(0, 5).map((c) => c.name),
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
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abc', maxZoom: 18,
    }).addTo(map);
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
      });
      m.__color = color; m.__c = c;
      m.on('click', () => { if (onSelect && c.id) onSelect(c.id); });
      m.bindTooltip(c.name, { direction: 'top', opacity: 0.9 });
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
      try { map.remove(); } catch (e) {}
      mapRef.current = null;
    };
  }, [all, onSelect]);

  // ---- stop the pulse/drop animations ----
  function stopAnims() {
    if (pulseRafRef.current) { cancelAnimationFrame(pulseRafRef.current); pulseRafRef.current = null; }
    if (dropRafRef.current) { cancelAnimationFrame(dropRafRef.current); dropRafRef.current = null; }
    try { haloLayerRef.current && haloLayerRef.current.clearLayers(); } catch (e) {}
    try { routeLayerRef.current && routeLayerRef.current.clearLayers(); } catch (e) {}
  }

  // ---- pulsing radar halos for the active direction ----
  function startPulse(geoMarkers, color) {
    if (reduceMotion || !geoMarkers.length) return;
    const halos = geoMarkers.map((m) => {
      const ll = m.getLatLng();
      return L.circleMarker(ll, { radius: 8, color, weight: 1.5, fillColor: color, fillOpacity: 0, opacity: 0.6 })
        .addTo(haloLayerRef.current);
    });
    let t0 = null;
    function loop(t) {
      if (t0 == null) t0 = t;
      const phase = ((t - t0) % 1800) / 1800;       // 0..1 over 1.8s
      const r = 8 + phase * 26;
      const op = 0.55 * (1 - phase);
      halos.forEach((h) => { try { h.setRadius(r); h.setStyle({ opacity: op, weight: 1.5 - phase }); } catch (e) {} });
      pulseRafRef.current = requestAnimationFrame(loop);
    }
    pulseRafRef.current = requestAnimationFrame(loop);
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

  // ---- self-drawing route polyline ----
  function drawRoute(geoMarkers, color) {
    if (reduceMotion || geoMarkers.length < 2) return;
    try {
      const pts = orderByNearest(geoMarkers.map((m) => {
        const ll = m.getLatLng(); return [ll.lat, ll.lng];
      }));
      const line = L.polyline(pts, {
        color, weight: 2.5, opacity: 0.75, dashArray: null,
        lineCap: 'round', lineJoin: 'round',
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
    } catch (e) {}
  }

  // ---- react to scene change: fly + emphasise + animate ----
  useE_st(() => {
    const map = mapRef.current;
    if (!map) return;
    const dur = reduceMotion ? 0 : 1.7;
    stopAnims();

    const byDir = dirMarkersRef.current;
    const allM = Object.values(byDir).flat();

    if (activeDir === 'intro' || activeDir === 'outro') {
      allM.forEach((m) => m.setStyle({ fillOpacity: 0.4, opacity: 0.55, weight: 1.2 }) || m.setRadius(5));
      try { if (allM.length) map.flyToBounds(L.featureGroup(allM).getBounds().pad(0.15), { duration: dur }); } catch (e) {}
      return;
    }

    // dim everything, then light + animate the active direction
    Object.entries(byDir).forEach(([dir, markers]) => {
      const on = dir === activeDir;
      markers.forEach((m) => {
        m.setStyle({ fillOpacity: on ? 0.95 : 0.12, opacity: on ? 1 : 0.2, weight: on ? 2 : 1 });
        if (!on) m.setRadius(3.5);
        if (on) m.bringToFront();
      });
    });

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

    // kick the animations slightly after the camera starts moving
    const delay = reduceMotion ? 0 : 650;
    const t = setTimeout(() => {
      dropIn(activeMarkers);
      drawRoute(activeMarkers, color);
      startPulse(activeMarkers, color);
    }, delay);
    return () => clearTimeout(t);
  }, [activeDir, dirData, reduceMotion]);

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
        map.flyTo([lat, lng], 8, { duration: reduceMotion ? 0 : 1.3 });
        // quick ping halo
        if (!reduceMotion && haloLayerRef.current) {
          const ping = L.circleMarker([lat, lng], { radius: 8, color: '#b8351e', weight: 2, fillOpacity: 0, opacity: 1 })
            .addTo(haloLayerRef.current);
          let s = null;
          function pl(t) { if (s == null) s = t; const p = Math.min(1, (t - s) / 900);
            try { ping.setRadius(8 + p * 30); ping.setStyle({ opacity: 1 - p }); } catch (e) {}
            if (p < 1) requestAnimationFrame(pl); else { try { haloLayerRef.current.removeLayer(ping); } catch (e) {} } }
          requestAnimationFrame(pl);
        }
      } catch (e) {}
    }
    if (onSelect && c.id) setTimeout(() => onSelect(c.id), reduceMotion ? 0 : 700);
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
    <section className="story-shell">
      <div className="story-map-bg">
        <div ref={mapElRef} className="story-map" />
        <div className="story-map-tint"
             style={{ background: DIR_COLOR[activeDir] || 'transparent',
                      opacity: (activeDir === 'intro' || activeDir === 'outro') ? 0 : 0.07 }} />
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
          const hasImg = !!storySetting(d.key + '.image', '');
          const accent = storySetting(d.key + '.accent', d.color);
          return (
            <div className="story-scene" data-story-scene={d.key} key={d.key}>
              <div className={`story-card${isActive ? ' is-active' : ''}${hasImg ? ' on-image' : ''}`} style={{ '--accent': accent }}>
                <div className="story-card-dir" style={{ color: accent }}>{d.key}</div>
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
                  <div className="story-samples">
                    {data.samples.map((n) => (
                      <button key={n} className="story-sample" onClick={() => flyToCommunity(n)} title="Fly here & open record">
                        {n}
                      </button>
                    ))}
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
window.AtlasStoryView = AtlasStoryView;
