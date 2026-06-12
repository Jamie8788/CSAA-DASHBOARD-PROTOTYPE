/* global React */
// ============================================================================
// 3D TERRITORY VIEW — a free, satellite + terrain globe (MapLibre GL).
// Lazy-loads maplibre-gl from CDN only when the user opens it, so the main
// dashboard stays light. Every community with coordinates becomes a marker;
// clicking one opens its full record.
// ============================================================================
const { useState, useEffect, useRef } = React;

let _maplibrePromise = null;
function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (_maplibrePromise) return _maplibrePromise;
  _maplibrePromise = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js';
    s.onload = () => resolve(window.maplibregl);
    s.onerror = () => reject(new Error('Could not load the 3D map library'));
    document.head.appendChild(s);
  });
  return _maplibrePromise;
}

const SAT_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

function Map3D({ all, onClose, onSelect }) {
  const wrapRef = useRef(null);
  const mapRef = useRef(null);
  const spinRef = useRef(true);
  const [status, setStatus] = useState('loading');   // loading | ready | error
  const [spinning, setSpinning] = useState(true);
  const [terrainOn, setTerrainOn] = useState(true);
  const [focus, setFocus] = useState(null);          // community under the cursor

  useEffect(() => {
    let dead = false;
    let raf = null;
    loadMapLibre().then(maplibregl => {
      if (dead || !wrapRef.current) return;
      const map = new maplibregl.Map({
        container: wrapRef.current,
        style: {
          version: 8,
          projection: { type: 'globe' },
          sources: {
            sat: { type: 'raster', tiles: [SAT_TILES], tileSize: 256,
                   attribution: 'Imagery © Esri — Source: Esri, Maxar, Earthstar Geographics' },
            dem: { type: 'raster-dem', encoding: 'terrarium',
                   tiles: [DEM_TILES], tileSize: 256, maxzoom: 13,
                   attribution: 'Terrain: Mapzen/AWS Open Data' },
          },
          layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
          sky: {
            'sky-color': '#0b1526',
            'horizon-color': '#27405e',
            'fog-color': '#0b1526',
            'sky-horizon-blend': 0.6,
            'horizon-fog-blend': 0.6,
          },
        },
        center: [-85.5, 49.5],
        zoom: 4.2,
        pitch: 50,
        bearing: -12,
        maxPitch: 80,
        attributionControl: { compact: true },
      });
      mapRef.current = map;

      map.on('load', () => {
        if (dead) return;
        try { map.setTerrain({ source: 'dem', exaggeration: 1.6 }); } catch (e) {}
        setStatus('ready');

        // Markers for every located community
        all.filter(c => c.lat != null && c.lng != null).forEach(c => {
          const el = document.createElement('button');
          el.className = 'm3d-marker';
          el.style.setProperty('--dir', window.dirHex(c));
          el.title = c.name.trim();
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            spinRef.current = false; setSpinning(false);
            map.flyTo({ center: [c.lng, c.lat], zoom: 11.5, pitch: 65, bearing: -20, duration: 2600 });
            onSelect && onSelect(c.id);
          });
          el.addEventListener('mouseenter', () => setFocus(c));
          el.addEventListener('mouseleave', () => setFocus(null));
          new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([c.lng, c.lat]).addTo(map);
        });

        // Gentle globe rotation until the user touches the map
        function spin() {
          if (!spinRef.current || !mapRef.current) return;
          const center = map.getCenter();
          center.lng -= 0.012;
          map.easeTo({ center, duration: 60, easing: t => t });
          raf = requestAnimationFrame(spin);
        }
        raf = requestAnimationFrame(spin);
        map.on('mousedown', () => { spinRef.current = false; setSpinning(false); });
        map.on('touchstart', () => { spinRef.current = false; setSpinning(false); });
      });
      map.on('error', () => { /* tile errors are non-fatal */ });
    }).catch(() => { if (!dead) setStatus('error'); });

    return () => {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  function toggleSpin() {
    const next = !spinRef.current;
    spinRef.current = next; setSpinning(next);
    if (next && mapRef.current) {
      const map = mapRef.current;
      (function spin() {
        if (!spinRef.current || !mapRef.current) return;
        const center = map.getCenter();
        center.lng -= 0.012;
        map.easeTo({ center, duration: 60, easing: t => t });
        requestAnimationFrame(spin);
      })();
    }
  }
  function toggleTerrain() {
    const map = mapRef.current; if (!map) return;
    if (terrainOn) map.setTerrain(null);
    else map.setTerrain({ source: 'dem', exaggeration: 1.6 });
    setTerrainOn(t => !t);
  }
  function resetView() {
    spinRef.current = false; setSpinning(false);
    mapRef.current && mapRef.current.flyTo({ center: [-85.5, 49.5], zoom: 4.2, pitch: 50, bearing: -12, duration: 2200 });
  }

  useEffect(() => {
    function esc(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const located = all.filter(c => c.lat != null).length;

  return (
    <div className="m3d-overlay" role="dialog" aria-label="3D territory view">
      <div ref={wrapRef} className="m3d-canvas"></div>

      {status === 'loading' && (
        <div className="m3d-status">
          <div className="m3d-spinner"></div>
          Preparing the 3D territory…
        </div>
      )}
      {status === 'error' && (
        <div className="m3d-status err">
          The 3D view needs an internet connection to load satellite imagery.
          <button className="m3d-btn" onClick={onClose}>Back to the 2D map</button>
        </div>
      )}

      <div className="m3d-head">
        <div>
          <div className="m3d-kicker">3D Territory · satellite + real terrain</div>
          <div className="m3d-title">{located} communities on the living land</div>
        </div>
        <button className="m3d-x" onClick={onClose} title="Back to 2D map (Esc)">✕ Exit 3D</button>
      </div>

      <div className="m3d-controls">
        <button className={`m3d-btn ${spinning ? 'on' : ''}`} onClick={toggleSpin}>
          {spinning ? '⏸ Pause rotation' : '▶ Rotate the globe'}
        </button>
        <button className={`m3d-btn ${terrainOn ? 'on' : ''}`} onClick={toggleTerrain}>
          {terrainOn ? '◭ Terrain on' : '◬ Terrain off'}
        </button>
        <button className="m3d-btn" onClick={resetView}>⤢ Full territory</button>
      </div>

      {focus && (
        <div className="m3d-tip">
          <div className="m3d-tip-name">{focus.name.trim()}</div>
          <div className="m3d-tip-meta">
            {focus.regionGroup}
            {focus.population ? ` · ${focus.population.toLocaleString()} members` : ''}
            {' · click to open record'}
          </div>
        </div>
      )}
    </div>
  );
}

window.Map3D = Map3D;
