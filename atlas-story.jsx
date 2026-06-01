/* global React, L */
// ============================================================================
// Atlas Story — ArcGIS-StoryMaps-style scrollytelling.
//   A full-bleed Leaflet map sits fixed behind the page. As the visitor
//   scrolls through narrative "scenes", the map camera FLIES between the
//   four Sacred Directions, and that direction's community markers light up.
//   Every number and name is pulled live from the master sheet (the `all`
//   prop = enriched window.COMMUNITIES). Self-contained: its own map
//   instance, cleaned up on unmount, so it can never affect the main map.
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

// Approximate fly-to fallbacks if a direction has no geocoded communities.
const DIR_FALLBACK = {
  East:  { center: [45.0, -76.0], zoom: 6 },
  South: { center: [43.2, -81.5], zoom: 6 },
  West:  { center: [49.8, -97.1], zoom: 5 },
  North: { center: [52.5, -87.5], zoom: 5 },
  Central:{ center: [49.0, -86.0], zoom: 4 },
};

function AtlasStoryView({ all, setView, onSelect }) {
  const mapElRef = useR_st(null);
  const mapRef = useR_st(null);
  const markerLayerRef = useR_st(null);
  const dirMarkersRef = useR_st({});       // direction -> [circleMarker]
  const [activeDir, setActiveDir] = useS_st('intro');
  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- compute per-direction stats + bounds from real data ----
  const dirData = useM_st(() => {
    const out = {};
    for (const d of STORY_DIRS) {
      const comms = (all || []).filter((c) => (c.direction || 'Central') === d.key);
      const geo = comms.filter((c) => c.lat != null && (c.lng != null || c.lon != null));
      const totalPop = comms.reduce((s, c) => s + (c.population || 0), 0);
      const pillarCounts = { Physical: 0, Mental: 0, Spiritual: 0, Emotional: 0 };
      comms.forEach((c) => {
        if (c.hasPhysical) pillarCounts.Physical++;
        if (c.hasMental) pillarCounts.Mental++;
        if (c.hasSpiritual) pillarCounts.Spiritual++;
        if (c.hasEmotional) pillarCounts.Emotional++;
      });
      const topPillar = Object.entries(pillarCounts).sort((a, b) => b[1] - a[1])[0];
      out[d.key] = {
        count: comms.length,
        geo,
        totalPop,
        topPillar: topPillar && topPillar[1] > 0 ? topPillar[0] : null,
        samples: comms.slice(0, 5).map((c) => c.name),
        pillarCounts,
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
      boxZoom: false, keyboard: false, touchZoom: false,
      zoomSnap: 0.25,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abc', maxZoom: 18,
    }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // build markers per direction
    const byDir = {};
    (all || []).forEach((c) => {
      const lat = c.lat, lng = (c.lng != null ? c.lng : c.lon);
      if (lat == null || lng == null) return;
      const dir = c.direction || 'Central';
      const meta = STORY_DIRS.find((d) => d.key === dir);
      const color = meta ? meta.color : '#6b8d6b';
      const m = L.circleMarker([lat, lng], {
        radius: 5, color: '#fff', weight: 1.2,
        fillColor: color, fillOpacity: 0.35, opacity: 0.5,
      });
      m.on('click', () => { if (onSelect && c.id) onSelect(c.id); });
      m.bindTooltip(c.name, { direction: 'top', opacity: 0.9 });
      m.addTo(markerLayerRef.current);
      (byDir[dir] = byDir[dir] || []).push(m);
    });
    dirMarkersRef.current = byDir;

    // a beat later, fit everything for the intro
    setTimeout(() => {
      try {
        const allM = Object.values(byDir).flat();
        if (allM.length) {
          const grp = L.featureGroup(allM);
          map.fitBounds(grp.getBounds().pad(0.15), { animate: false });
        }
      } catch (e) {}
    }, 60);

    return () => { try { map.remove(); } catch (e) {} mapRef.current = null; };
  }, [all, onSelect]);

  // ---- fly the camera + emphasise markers when the active scene changes ----
  useE_st(() => {
    const map = mapRef.current;
    if (!map) return;
    const dur = reduceMotion ? 0 : 1.7;

    // de-emphasise all, emphasise active direction
    Object.entries(dirMarkersRef.current).forEach(([dir, markers]) => {
      const isActive = dir === activeDir;
      markers.forEach((m) => {
        m.setStyle({
          fillOpacity: isActive ? 0.92 : 0.18,
          opacity: isActive ? 1 : 0.28,
          radius: isActive ? 8 : 4,
          weight: isActive ? 2 : 1,
        });
        if (isActive) m.bringToFront();
      });
    });

    if (activeDir === 'intro' || activeDir === 'outro') {
      const allM = Object.values(dirMarkersRef.current).flat();
      // on intro/outro show everything at equal weight
      allM.forEach((m) => m.setStyle({ fillOpacity: 0.4, opacity: 0.55, radius: 5, weight: 1.2 }));
      try {
        if (allM.length) {
          const grp = L.featureGroup(allM);
          map.flyToBounds(grp.getBounds().pad(0.15), { duration: dur });
        }
      } catch (e) {}
      return;
    }

    const data = dirData[activeDir];
    if (data && data.geo.length) {
      try {
        const grp = L.featureGroup(
          data.geo.map((c) => L.marker([c.lat, (c.lng != null ? c.lng : c.lon)]))
        );
        map.flyToBounds(grp.getBounds().pad(0.35), { duration: dur, maxZoom: 7 });
        return;
      } catch (e) {}
    }
    const fb = DIR_FALLBACK[activeDir] || DIR_FALLBACK.Central;
    map.flyTo(fb.center, fb.zoom, { duration: dur });
  }, [activeDir, dirData, reduceMotion]);

  // ---- scene scroll spy ----
  useE_st(() => {
    const scenes = Array.from(document.querySelectorAll('[data-story-scene]'));
    if (!scenes.length) return;
    const io = new IntersectionObserver((entries) => {
      // pick the most-visible scene crossing the centre band
      let best = null, bestRatio = 0;
      for (const e of entries) {
        if (e.isIntersecting && e.intersectionRatio > bestRatio) {
          bestRatio = e.intersectionRatio; best = e.target;
        }
      }
      if (best) setActiveDir(best.getAttribute('data-story-scene'));
    }, { root: null, rootMargin: '-40% 0px -40% 0px', threshold: [0.01, 0.25, 0.5, 0.75] });
    scenes.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [dirData]);

  const grand = useM_st(() => {
    const total = (all || []).length;
    const pop = (all || []).reduce((s, c) => s + (c.population || 0), 0);
    return { total, pop };
  }, [all]);

  return (
    <section className="story-shell">
      {/* fixed full-bleed map behind everything */}
      <div className="story-map-bg">
        <div ref={mapElRef} className="story-map" />
        <div className="story-map-veil" />
      </div>

      {/* scrolling narrative scenes */}
      <div className="story-scenes">

        {/* INTRO */}
        <div className="story-scene story-intro" data-story-scene="intro">
          <div className="story-card story-card-hero">
            <p className="story-eyebrow">Mino Bimaadiziwin · A guided journey</p>
            <h2 className="story-title">Walk the four directions.</h2>
            <p className="story-lede">
              {grand.total} communities and partners across Turtle Island, serving
              roughly {grand.pop.toLocaleString()} people. Scroll slowly — the map
              will carry you through each Sacred Direction, season by season.
            </p>
            <div className="story-scroll-cue">↓ scroll to begin</div>
          </div>
        </div>

        {/* DIRECTION SCENES */}
        {STORY_DIRS.map((d) => {
          const data = dirData[d.key] || {};
          return (
            <div className="story-scene" data-story-scene={d.key} key={d.key}>
              <div className="story-card" style={{ '--accent': d.color }}>
                <div className="story-card-dir" style={{ color: d.color }}>{d.key}</div>
                <div className="story-card-season">{d.season}</div>
                <p className="story-card-blurb">{d.blurb}</p>
                <div className="story-stats">
                  <div className="story-stat">
                    <span className="story-stat-n">{data.count || 0}</span>
                    <span className="story-stat-l">communities</span>
                  </div>
                  <div className="story-stat">
                    <span className="story-stat-n">{Math.round((data.totalPop || 0) / 1000)}k</span>
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
                      <button key={n} className="story-sample"
                        onClick={() => { const hit = (all || []).find((c) => c.name === n); if (hit && onSelect) onSelect(hit.id); }}>
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

        {/* OUTRO */}
        <div className="story-scene story-outro" data-story-scene="outro">
          <div className="story-card story-card-hero">
            <h2 className="story-title">The whole circle.</h2>
            <p className="story-lede">
              Every direction, every season, held together in one living atlas.
              Explore it freely — search, filter, and open any community's full record.
            </p>
            <div className="story-cta-row">
              <button className="story-cta" onClick={() => setView && setView('map')}>◉ Open the full map</button>
              <button className="story-cta ghost" onClick={() => setView && setView('analytics')}>◐ See the analytics</button>
            </div>
          </div>
        </div>
      </div>

      {/* scene dot indicator */}
      <div className="story-progress-dots">
        {['intro', ...STORY_DIRS.map((d) => d.key), 'outro'].map((k) => (
          <span key={k} className={k === activeDir ? 'on' : ''} title={k} />
        ))}
      </div>
    </section>
  );
}
window.AtlasStoryView = AtlasStoryView;
