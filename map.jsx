/* global React, L */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// FOUR DIRECTIONS — English-only labels until cultural review approves Indigenous-language naming
const DIRECTION = {
  East:          { color: '#d4a017', deep: '#8c6614', soft: '#f1d97a', label: 'East',  season: 'Spring',  medicine: '', stage: 'New beginnings', element: '' },
  South:         { color: '#b8351e', deep: '#7a1f10', soft: '#e08470', label: 'South', season: 'Summer',  medicine: '', stage: 'Youth', element: '' },
  West:          { color: '#1a1612', deep: '#000',    soft: '#5a4f40', label: 'West',  season: 'Autumn',  medicine: '', stage: 'Adulthood', element: '' },
  North:         { color: '#cabd9c', deep: '#8a7c66', soft: '#fbf6ec', label: 'North', season: 'Winter',  medicine: '', stage: 'Elders', element: '' },
  AllDirections: { color: '#6b4358', deep: '#3d2433', soft: '#9d7388', label: 'All Directions', season: 'All seasons', medicine: '', stage: 'Service across communities', element: '' },
};
// Alias 'Central' (used by enrichRaw for partners) to AllDirections
DIRECTION.Central = DIRECTION.AllDirections;
window.DIRECTION = DIRECTION;
window.dirOf = (c) => DIRECTION[c.direction] || DIRECTION.AllDirections;

const TILE_LAYERS = {
  parchment: {
    name: 'Parchment',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '\u00a9 OpenStreetMap contributors',
    filter: 'sepia(0.55) saturate(0.7) contrast(0.95) brightness(1.05) hue-rotate(-8deg)',
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: 'Tiles \u00a9 Esri \u2014 Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP',
    filter: 'none',
  },
  topo: {
    name: 'Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attr: 'Map data: \u00a9 OpenStreetMap contributors, SRTM | Map style: \u00a9 OpenTopoMap (CC-BY-SA)',
    filter: 'sepia(0.2) saturate(0.85)',
  },
  dark: {
    name: 'Night',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attr: '\u00a9 OpenStreetMap, \u00a9 CARTO',
    filter: 'none',
  },
};

// Ambient scenery over the map — drifting "spirit lights" + a faint aurora ribbon.
// Purely decorative (pointer-events: none) so the map stays fully usable.
function MapAmbient() {
  const cref = useRef(null);
  useEffect(() => {
    const cv = cref.current; if (!cv) return;
    if ((window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        || document.documentElement.classList.contains('reduce-motion')) return;
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, raf = null, t0 = null, last = 0;
    const N = 26;
    const motes = Array.from({ length: N }, () => ({
      x: Math.random(), y: Math.random(), r: 0.8 + Math.random() * 2.2,
      sp: 0.006 + Math.random() * 0.018, drift: 0.2 + Math.random() * 0.8,
      ph: Math.random() * 6.28, warm: Math.random() > 0.35,
    }));
    function resize() {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.max(1, W * dpr); cv.height = Math.max(1, H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = ('ResizeObserver' in window) ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(cv); else window.addEventListener('resize', resize);
    function frame(time) {
      raf = requestAnimationFrame(frame);
      if (time - last < 33) return; last = time;       // ~30fps, light
      if (t0 == null) t0 = time; const tt = (time - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      // faint aurora ribbon drifting along the top
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let b = 0; b < 2; b++) {
        ctx.beginPath();
        const baseY = 40 + b * 34;
        for (let x = 0; x <= W; x += 20) {
          const y = baseY + Math.sin(x * 0.004 + tt * 0.4 + b) * 16 + Math.sin(x * 0.011 + tt * 0.7) * 7;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = b === 0 ? 'rgba(110,160,120,0.06)' : 'rgba(150,140,200,0.05)';
        ctx.lineWidth = 26; ctx.lineCap = 'round'; ctx.stroke();
      }
      ctx.restore();
      // drifting spirit-lights rising slowly
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const m of motes) {
        const y = ((m.y - tt * m.sp) % 1 + 1) % 1;
        const x = (m.x + Math.sin(tt * 0.3 * m.drift + m.ph) * 0.02);
        const px = x * W, py = y * H;
        const tw = 0.5 + 0.5 * Math.sin(tt * 1.6 + m.ph);
        const a = 0.06 + 0.10 * tw;
        const col = m.warm ? '255,196,110' : '210,224,255';
        const g = ctx.createRadialGradient(px, py, 0, px, py, m.r * 6);
        g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, m.r * 6, 0, 6.283); ctx.fill();
        ctx.fillStyle = `rgba(${col},${a * 1.6})`; ctx.beginPath(); ctx.arc(px, py, m.r, 0, 6.283); ctx.fill();
      }
      ctx.restore();

      // a small flock of birds crossing the upper sky (ambient)
      ctx.save(); ctx.globalAlpha = 0.32; ctx.strokeStyle = 'rgba(38,30,22,0.85)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      const fxx = (((tt * 0.02 + 0.15) % 1.4) - 0.2) * W;
      for (let i = 0; i < 5; i++) {
        const bx = fxx - i * 16, by = H * 0.14 + Math.abs(i - 2) * 7 + Math.sin(tt + i) * 2;
        const flap = Math.sin(tt * 7 + i) * 3;
        ctx.beginPath(); ctx.moveTo(bx - 6, by + flap); ctx.lineTo(bx, by - 1); ctx.lineTo(bx + 6, by + flap); ctx.stroke();
      }
      ctx.restore();

      // a canoe drifting slowly across (echoes the landing page), with the orange-shirt paddler
      const cx = (((tt * 0.012) % 1.25) - 0.13) * W;
      const cy = H * 0.84 + Math.sin(tt * 0.8) * 4;
      const s = Math.max(0.7, Math.min(1.25, W / 1400));
      ctx.save(); ctx.globalAlpha = 0.5; ctx.translate(cx, cy); ctx.scale(s, s);
      ctx.strokeStyle = 'rgba(255,240,210,0.10)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-30, 0); ctx.quadraticCurveTo(-120, 8, -230, 30); ctx.stroke();   // wake
      ctx.beginPath(); ctx.moveTo(-34, -1); ctx.quadraticCurveTo(0, 12, 34, -1); ctx.quadraticCurveTo(0, 5, -34, -1); ctx.closePath();
      ctx.fillStyle = 'rgba(58,37,21,0.9)'; ctx.fill();                                              // hull
      ctx.fillStyle = 'rgba(233,104,28,0.95)'; ctx.fillRect(-2.4, -10, 5, 8);                        // orange shirt
      ctx.fillStyle = 'rgba(202,160,122,0.95)'; ctx.beginPath(); ctx.arc(0, -13, 2.6, 0, 6.283); ctx.fill();  // head
      const pad = Math.sin(tt * 2.5) * 0.5;
      ctx.strokeStyle = 'rgba(94,60,34,0.95)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(13 * Math.cos(pad + 0.4), -7 + 13 * Math.sin(pad + 0.4)); ctx.stroke();  // paddle
      ctx.restore();
    }
    raf = requestAnimationFrame(frame);
    function onVis() { if (document.hidden && raf) { cancelAnimationFrame(raf); raf = null; } else if (!document.hidden && !raf) { last = 0; t0 = null; raf = requestAnimationFrame(frame); } }
    document.addEventListener('visibilitychange', onVis);
    return () => { if (raf) cancelAnimationFrame(raf); if (ro) ro.disconnect(); else window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  return <canvas ref={cref} className="map-ambient" aria-hidden="true"></canvas>;
}

function CanadaMap({ communities, allCommunities, selectedId, onSelect, onHover, hoveredId, directionFilter, onDirectionFilter, elderMode }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const tileRef = useRef(null);
  const clusterRef = useRef(null);
  const markersRef = useRef(new Map());
  const bubbleLayerRef = useRef(null);
  const [tileKey, setTileKey] = useState('parchment');
  const [showWheel, setShowWheel] = useState(true);
  const [markerMode, setMarkerMode] = useState('direction');  // direction | coverage | population
  const [showBubbles, setShowBubbles] = useState(false);       // population-proportional circles
  const [search, setSearch] = useState('');
  const activeDir = directionFilter || null;
  const setActiveDir = (d) => onDirectionFilter && onDirectionFilter(d);
  const [tip, setTip] = useState(null);
  const [ready, setReady] = useState(false);
  const [hoverPanel, setHoverPanel] = useState(null);   // persistent info panel
  const [rulerMode, setRulerMode] = useState(false);    // measure-distance tool
  const [show3D, setShow3D] = useState(false);          // 3D globe overlay
  const [rulerPoints, setRulerPoints] = useState([]);   // [[lat,lng], [lat,lng]]
  const rulerLineRef = useRef(null);
  const rulerMarkersRef = useRef([]);

  // ============= INIT MAP =============
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (typeof L === 'undefined') {
      // Wait for Leaflet to load
      const checkInterval = setInterval(() => {
        if (typeof L !== 'undefined') {
          clearInterval(checkInterval);
          setReady(prev => !prev);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    const map = L.map(containerRef.current, {
      center: [54.5, -88.5],
      zoom: 5,
      minZoom: 3,
      maxZoom: 14,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: false,
      scrollWheelZoom: true,
      worldCopyJump: true,
    });
    mapRef.current = map;

    // Custom zoom in bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

    // Initial tile layer
    const tl = TILE_LAYERS[tileKey];
    tileRef.current = L.tileLayer(tl.url, { attribution: tl.attr, maxZoom: 18, subdomains: 'abc' }).addTo(map);
    map.getContainer().style.background = '#1a1612';
    setTimeout(() => applyTileFilter(tileKey), 50);

    // Cluster group with custom icon
    const cluster = L.markerClusterGroup({
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      animate: true,
      animateAddingMarkers: false,
      iconCreateFunction: (c) => {
        const count = c.getChildCount();
        const size = count < 5 ? 36 : count < 15 ? 44 : count < 40 ? 54 : 64;
        return L.divIcon({
          className: 'cluster-icon',
          html: `<div class="cluster-bubble" style="width:${size}px;height:${size}px"><span class="n">${count}</span></div>`,
          iconSize: [size, size],
        });
      },
    });
    clusterRef.current = cluster;
    map.addLayer(cluster);

    setReady(r => !r);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  function applyTileFilter(key) {
    const pane = mapRef.current?.getPane('tilePane');
    if (pane) pane.style.filter = TILE_LAYERS[key].filter;
  }

  // ============= TILE SWITCH =============
  useEffect(() => {
    if (!mapRef.current || !tileRef.current) return;
    const tl = TILE_LAYERS[tileKey];
    mapRef.current.removeLayer(tileRef.current);
    tileRef.current = L.tileLayer(tl.url, { attribution: tl.attr, maxZoom: 18, subdomains: 'abc' }).addTo(mapRef.current);
    applyTileFilter(tileKey);
  }, [tileKey]);

  // ============= AUTO-FIT to communities on first marker render =============
  const didFitRef = useRef(false);

  // ============= MARKERS =============
  useEffect(() => {
    if (!clusterRef.current || !mapRef.current) return;
    const cluster = clusterRef.current;
    cluster.clearLayers();
    markersRef.current.clear();

    const visibleIds = new Set(communities.map(c => c.id));
    const markers = [];

    allCommunities.forEach(c => {
      if (c.lat == null || c.lng == null) return;
      const isVisible = visibleIds.has(c.id);
      if (!isVisible) return;
      const dir = c.direction || 'AllDirections';
      const dirInfo = DIRECTION[dir];
      const dimmed = activeDir && dir !== activeDir;
      const opacity = dimmed ? 0.25 : 1;

      // Marker color depends on mode
      let coreColor, ringColor, glyphColor;
      if (markerMode === 'coverage') {
        // Color by completeness: red → amber → green
        const comp = c.completeness || 0;
        coreColor = comp > 0.75 ? '#3d6b40' : comp > 0.55 ? '#7a8a35' : comp > 0.35 ? '#d4a017' : comp > 0.15 ? '#b8351e' : '#5a4f40';
        ringColor = '#fbf6ec'; glyphColor = '#fbf6ec';
      } else if (markerMode === 'population') {
        // Color by population bucket
        const p = c.population || 0;
        coreColor = p > 10000 ? '#1a1612' : p > 5000 ? '#5a4f40' : p > 2000 ? '#b8351e' : p > 750 ? '#d4a017' : p > 0 ? '#a8b585' : '#cabd9c';
        ringColor = '#fbf6ec'; glyphColor = (p > 5000) ? '#fbf6ec' : '#15110d';
      } else {
        // direction (default)
        coreColor = dir==='North' ? '#fbf6ec' : dirInfo.color;
        ringColor = dir==='North' ? '#8a7c66' : '#fbf6ec';
        glyphColor = dir==='North' ? '#1a1612' : '#fbf6ec';
      }

      // Partner / health organizations always read as GREEN dots so they are
      // clearly distinct from the First Nations communities (every mode).
      if (c.orgType && c.orgType !== 'Community') {
        coreColor = '#3d6b40'; ringColor = '#fbf6ec'; glyphColor = '#fbf6ec';
      }

      const html = `
        <div class="marker-pin visible dir-${dir}" style="opacity:${opacity};animation-delay:${(markers.length % 30) * 0.02}s">
          <div class="pin-pulse" style="background:${dirInfo.color}"></div>
          <div class="pin-core" style="background:${coreColor};border-color:${ringColor}"></div>
          <span class="pin-mark" style="color:${glyphColor}">${c.mark || ''}</span>
        </div>`;
      const icon = L.divIcon({ className: 'community-icon', html, iconSize: [22, 22], iconAnchor: [11, 11] });
      const m = L.marker([c.lat, c.lng], { icon, opacity: 1, riseOnHover: true });

      m.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelect(c.id);
      });
      m.on('mouseover', () => {
        onHover && onHover(c.id);
        const point = mapRef.current.latLngToContainerPoint([c.lat, c.lng]);
        setTip({ id: c.id, x: point.x, y: point.y, community: c });
      });
      m.on('mouseout', () => {
        onHover && onHover(null);
        setTip(null);
      });

      markersRef.current.set(c.id, m);
      markers.push(m);
    });

    cluster.addLayers(markers);

    // Auto-fit once on first render with markers
    if (!didFitRef.current && markers.length) {
      didFitRef.current = true;
      const withCoords = allCommunities.filter(c => c.lat != null && c.lng != null);
      if (withCoords.length) {
        const bounds = L.latLngBounds(withCoords.map(c => [c.lat, c.lng]));
        setTimeout(() => mapRef.current && mapRef.current.fitBounds(bounds.pad(0.12), { animate: false }), 60);
      }
    }
  }, [communities, allCommunities, activeDir, markerMode]);

  // ============= RULER / MEASURE TOOL =============
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    // Clear previous ruler markers/line
    if (rulerLineRef.current) { map.removeLayer(rulerLineRef.current); rulerLineRef.current = null; }
    rulerMarkersRef.current.forEach(m => map.removeLayer(m));
    rulerMarkersRef.current = [];

    if (!rulerMode) {
      map.getContainer().style.cursor = '';
      return;
    }
    map.getContainer().style.cursor = 'crosshair';

    function onMapClick(e) {
      setRulerPoints(prev => {
        const next = prev.length >= 2 ? [[e.latlng.lat, e.latlng.lng]] : [...prev, [e.latlng.lat, e.latlng.lng]];
        return next;
      });
    }
    map.on('click', onMapClick);
    return () => {
      map.off('click', onMapClick);
      map.getContainer().style.cursor = '';
    };
  }, [rulerMode]);

  // Redraw ruler line + markers when points change
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (rulerLineRef.current) { map.removeLayer(rulerLineRef.current); rulerLineRef.current = null; }
    rulerMarkersRef.current.forEach(m => map.removeLayer(m));
    rulerMarkersRef.current = [];
    if (rulerPoints.length === 0) return;
    rulerPoints.forEach((p, i) => {
      const m = L.circleMarker(p, { radius: 6, color: '#d4a017', fillColor: '#d4a017', fillOpacity: 0.9, weight: 2 }).addTo(map);
      m.bindTooltip(String.fromCharCode(65 + i), { permanent: true, direction: 'top', className: 'ruler-tooltip' });
      rulerMarkersRef.current.push(m);
    });
    if (rulerPoints.length === 2) {
      const line = L.polyline(rulerPoints, { color: '#d4a017', weight: 2.5, dashArray: '6 4' }).addTo(map);
      rulerLineRef.current = line;
    }
  }, [rulerPoints]);

  // Compute distance for ruler
  const rulerDistance = useMemo(() => {
    if (rulerPoints.length !== 2) return null;
    const [lat1, lng1] = rulerPoints[0], [lat2, lng2] = rulerPoints[1];
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
    return Math.round(2 * R * Math.asin(Math.sqrt(a)));
  }, [rulerPoints]);

  useEffect(() => {
    if (!mapRef.current) return;
    // Remove old layer
    if (bubbleLayerRef.current) {
      mapRef.current.removeLayer(bubbleLayerRef.current);
      bubbleLayerRef.current = null;
    }
    if (!showBubbles) return;
    const group = L.layerGroup();
    const visibleIds = new Set(communities.map(c => c.id));
    communities.forEach(c => {
      if (c.lat == null || c.lng == null) return;
      if (!c.population || c.population <= 0) return;
      const r = Math.max(8, Math.min(40, Math.sqrt(c.population) * 0.5));
      const dir = c.direction || 'AllDirections';
      const col = DIRECTION[dir].color;
      const circle = L.circleMarker([c.lat, c.lng], {
        radius: r,
        fillColor: col,
        fillOpacity: 0.18,
        color: col,
        weight: 1.5,
        opacity: 0.6,
        interactive: false,
        pane: 'overlayPane',
      });
      group.addLayer(circle);
    });
    group.addTo(mapRef.current);
    bubbleLayerRef.current = group;
  }, [showBubbles, communities]);

  // ============= FLY TO SELECTED =============
  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const c = allCommunities.find(x => x.id === selectedId);
    if (!c || c.lat == null) return;
    mapRef.current.flyTo([c.lat, c.lng], Math.max(7, mapRef.current.getZoom()), { duration: 1.0 });
  }, [selectedId]);

  function setDir(d) {
    const next = activeDir === d ? null : d;
    setActiveDir(next);
    // Fit to direction extent
    if (next && mapRef.current) {
      const inDir = allCommunities.filter(c => (c.direction||'AllDirections') === next && c.lat != null);
      if (inDir.length) {
        const bounds = L.latLngBounds(inDir.map(c => [c.lat, c.lng]));
        mapRef.current.flyToBounds(bounds.pad(0.25), { duration: 0.9 });
      }
    } else if (mapRef.current) {
      mapRef.current.flyTo([54.5, -88.5], 5, { duration: 0.9 });
    }
  }

  function fitAll() {
    if (!mapRef.current) return;
    const withCoords = allCommunities.filter(c => c.lat != null);
    if (!withCoords.length) return;
    const bounds = L.latLngBounds(withCoords.map(c => [c.lat, c.lng]));
    mapRef.current.flyToBounds(bounds.pad(0.1), { duration: 0.8 });
  }

  // ============= SKY TOUR — a guided, cinematic fly-between =============
  const tourRef = useRef({ running:false, paused:false, idx:0, timer:null, list:[] });
  const [tourActive, setTourActive] = useState(false);
  const [tourPaused, setTourPaused] = useState(false);
  const [tourCommunity, setTourCommunity] = useState(null);
  const [tourPos, setTourPos] = useState({ i:0, n:0 });

  function _clearFocus() {
    markersRef.current.forEach(m => { const el = m.getElement && m.getElement(); if (el) el.classList.remove('tour-focus'); });
  }
  function _focusMarker(c) {
    _clearFocus();
    const m = c && markersRef.current.get(c.id);
    const el = m && m.getElement && m.getElement();
    if (el) el.classList.add('tour-focus');
  }
  function _flyTour(c) {
    if (!mapRef.current || c.lat == null) return;
    const z = 7.3 + (c.population ? Math.min(1.5, c.population / 8000) : 0);
    mapRef.current.flyTo([c.lat, c.lng], z, { duration: 2.0 });
  }
  function _showTourAt(i) {
    const list = tourRef.current.list;
    if (!list.length) return;
    const idx = ((i % list.length) + list.length) % list.length;
    tourRef.current.idx = idx;
    const c = list[idx];
    setTourCommunity(c);
    setTourPos({ i: idx + 1, n: list.length });
    _flyTour(c);
    setTimeout(() => _focusMarker(c), 650);
  }
  function _scheduleNext() {
    if (tourRef.current.timer) clearTimeout(tourRef.current.timer);
    tourRef.current.timer = setTimeout(() => {
      if (!tourRef.current.running || tourRef.current.paused) return;
      _showTourAt(tourRef.current.idx + 1);
      _scheduleNext();
    }, 5400);
  }
  function startTour() {
    const list = communities.filter(c => c.lat != null && c.lng != null);
    if (!list.length) return;
    tourRef.current.list = list;
    tourRef.current.running = true;
    tourRef.current.paused = false;
    setTourActive(true); setTourPaused(false);
    _showTourAt(0);
    _scheduleNext();
  }
  function stopTour() {
    if (tourRef.current.timer) clearTimeout(tourRef.current.timer);
    tourRef.current.running = false; tourRef.current.paused = false;
    setTourActive(false); setTourPaused(false); setTourCommunity(null);
    _clearFocus();
  }
  function tourTogglePause() {
    tourRef.current.paused = !tourRef.current.paused;
    setTourPaused(tourRef.current.paused);
    if (tourRef.current.paused) { if (tourRef.current.timer) clearTimeout(tourRef.current.timer); }
    else _scheduleNext();
  }
  function tourPrev() { _showTourAt(tourRef.current.idx - 1); if (tourRef.current.running && !tourRef.current.paused) _scheduleNext(); }
  function tourNext() { _showTourAt(tourRef.current.idx + 1); if (tourRef.current.running && !tourRef.current.paused) _scheduleNext(); }
  useEffect(() => () => { if (tourRef.current.timer) clearTimeout(tourRef.current.timer); }, []);

  // ============= HEATMAP =============
  const heatLayerRef = useRef(null);
  const [heatOn, setHeatOn] = useState(false);
  useEffect(() => {
    if (!mapRef.current) return;
    if (heatOn) {
      // Ensure leaflet.heat is loaded once
      if (!window.L || !window.L.heatLayer) {
        const s = document.createElement('script');
        s.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
        s.onload = () => { if (heatOn) addHeat(); };
        document.head.appendChild(s);
        return;
      }
      addHeat();
    } else if (heatLayerRef.current) {
      mapRef.current.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }
    function addHeat() {
      if (!mapRef.current) return;
      const pts = communities.filter(c => c.lat != null).map(c => {
        const w = Math.max(0.3, Math.min(1, (c.population || 500) / 5000));
        return [c.lat, c.lng, w];
      });
      if (heatLayerRef.current) mapRef.current.removeLayer(heatLayerRef.current);
      heatLayerRef.current = L.heatLayer(pts, {
        radius: 38, blur: 32, maxZoom: 10, max: 1,
        gradient: { 0.2:'#3d5a3d', 0.4:'#d4a017', 0.6:'#b8351e', 0.85:'#7a1f10', 1:'#1a1612' },
      }).addTo(mapRef.current);
    }
  }, [heatOn, communities]);

  const projected = allCommunities.filter(c => c.lat != null);
  const byDir = useMemo(() => {
    const g = { East: [], South: [], West: [], North: [], AllDirections: [] };
    projected.forEach(p => { const d = p.direction || 'AllDirections'; if (g[d]) g[d].push(p); });
    return g;
  }, [projected]);

  return (
    <div className={`map-wrap ${selectedId ? 'drawer-open' : ''}`}>
      <div ref={containerRef} className="leaflet-container-wrap"></div>
      <MapAmbient />

      <div className="map-overlay map-eyebrow">
        <span className="sub">Atlas · 01</span>
        <span className="title">Communities across Turtle Island</span>
        <span className="sub">{communities.length} of {allCommunities.length} shown · {projected.length} mapped</span>
      </div>

      {/* Tile layer switcher */}
      <div className="map-overlay tile-switch">
        <span className="ts-label">Basemap</span>
        {Object.entries(TILE_LAYERS).map(([k, v]) => (
          <button key={k} className={tileKey===k?'on':''} onClick={() => setTileKey(k)}>{v.name}</button>
        ))}
      </div>

      {/* Marker mode + extra overlays */}
      <div className="map-overlay marker-mode-switch">
        <span className="ts-label">Color markers by</span>
        <button className={markerMode==='direction'?'on':''} onClick={() => setMarkerMode('direction')}>Direction</button>
        <button className={markerMode==='coverage'?'on':''} onClick={() => setMarkerMode('coverage')}>Coverage</button>
        <button className={markerMode==='population'?'on':''} onClick={() => setMarkerMode('population')}>Population</button>
      </div>

      {/* Search box */}
      <MapSearch communities={allCommunities} onPick={(c) => {
        onSelect(c.id);
        if (mapRef.current && c.lat != null) {
          mapRef.current.flyTo([c.lat, c.lng], 9, { duration: 1.0 });
        }
      }} value={search} setValue={setSearch} />

      <button className="map-fit-all" onClick={fitAll} title="Fit all communities">⤢ Fit all</button>
      <button className="map-3d-btn" onClick={() => setShow3D(true)}
              title="Open the 3D satellite + terrain view of the territory">
        ◈ 3D View
      </button>
      {show3D && window.Map3D && (
        <window.Map3D all={allCommunities} onSelect={onSelect} onClose={() => setShow3D(false)} />
      )}
      <button className={`map-tour-btn ${tourActive?'on':''}`} onClick={() => tourActive ? stopTour() : startTour()} title="Sky tour: auto-fly between visible communities">
        {tourActive ? '■ Stop tour' : '✦ Sky tour'}
      </button>
      <button className={`map-heatmap-btn ${heatOn?'on':''}`} onClick={() => setHeatOn(h => !h)} title="Toggle density heatmap">
        {heatOn ? '◉ Heatmap' : '○ Heatmap'}
      </button>
      <button className={`map-bubbles-btn ${showBubbles?'on':''}`} onClick={() => setShowBubbles(b => !b)} title="Population-proportional circles overlay">
        {showBubbles ? '◉ Pop bubbles' : '○ Pop bubbles'}
      </button>
      <button className={`map-ruler-btn ${rulerMode?'on':''}`} onClick={() => { setRulerMode(r => !r); if (rulerMode) setRulerPoints([]); }} title="Measure distance between two points">
        {rulerMode ? '◉ Measure' : '○ Measure'}
      </button>
      {rulerDistance != null && (
        <div className="ruler-readout">
          <div className="rr-lab">A → B</div>
          <div className="rr-num">{rulerDistance.toLocaleString()}<span className="rr-unit">km</span></div>
          <button className="rr-clear" onClick={() => setRulerPoints([])}>Clear</button>
        </div>
      )}
      {tourCommunity && (
        <div className="tour-card" key={tourCommunity.id}>
          <div className="tc-top">
            <span className="tc-eyebrow">✦ Sky tour · {tourPos.i} / {tourPos.n}</span>
            <button className="tc-x" onClick={stopTour} title="End tour">✕</button>
          </div>
          <div className="tc-name">{tourCommunity.name.trim()}</div>
          <div className="tc-meta">
            <span className="tc-chip">{DIRECTION[tourCommunity.direction || 'AllDirections'].label} · {DIRECTION[tourCommunity.direction || 'AllDirections'].season}</span>
            {tourCommunity.orgType && tourCommunity.orgType !== 'Community' && <span className="tc-chip org">{tourCommunity.orgType}</span>}
            {tourCommunity.population ? <span className="tc-chip">{tourCommunity.population.toLocaleString()} members</span> : null}
          </div>
          <div className="tc-pillars">
            {[['hasPhysical', 'Physical', '#b8351e'], ['hasMental', 'Mental', '#5a4f40'], ['hasSpiritual', 'Spiritual', '#d4a017'], ['hasEmotional', 'Emotional', '#6b8d6b']].map(([k, lab, col]) => (
              <span key={k} className={`tc-pill ${tourCommunity[k] ? 'on' : 'off'}`}>
                <i style={{ background: tourCommunity[k] ? col : 'transparent', borderColor: col }}></i>{lab}
              </span>
            ))}
          </div>
          <div className="tc-cov"><div className="tc-cov-bar" style={{ width: `${Math.round((tourCommunity.completeness || 0) * 100)}%` }}></div></div>
          <div className="tc-cov-lab">{Math.round((tourCommunity.completeness || 0) * 100)}% of the record on file</div>
          <div className="tc-controls">
            <button onClick={tourPrev} title="Previous community">‹</button>
            <button onClick={tourTogglePause}>{tourPaused ? '▶ Play' : '❚❚ Pause'}</button>
            <button onClick={tourNext} title="Next community">›</button>
            <button className="tc-open" onClick={() => onSelect(tourCommunity.id)}>Open ↗</button>
          </div>
        </div>
      )}
      {!showWheel && (
        <button className="map-wheel-toggle" onClick={() => setShowWheel(true)} title="Show direction compass">
          ◉ Compass
        </button>
      )}
      {showWheel && <MedicineWheelOverlay activeDir={activeDir} setDir={setDir} onClose={() => setShowWheel(false)} />}

      <DirectionLegend activeDir={activeDir} setDir={setDir} byDir={byDir} />

      {tip && tip.community && (
        <div className="map-tooltip rich" style={{ left: tip.x, top: tip.y }}>
          <div className="mt-head">
            <div className="mt-mark" style={{background: DIRECTION[tip.community.direction || 'AllDirections'].color}}>
              {tip.community.mark || '◆'}
            </div>
            <div className="mt-headtext">
              <div className="name">{tip.community.name.trim()}</div>
              <div className="meta">
                {DIRECTION[tip.community.direction || 'AllDirections'].label.split(' · ')[0]}
                {tip.community.orgType !== 'Community' && ` · ${tip.community.orgType}`}
              </div>
            </div>
          </div>
          {(tip.community.population || tip.community.staff?.length || tip.community.completeness != null) && (
            <div className="mt-stats">
              {tip.community.population ? (
                <div className="mt-stat">
                  <div className="mt-stat-num">{tip.community.population.toLocaleString()}</div>
                  <div className="mt-stat-lab">members</div>
                </div>
              ) : null}
              {tip.community.staff?.length ? (
                <div className="mt-stat">
                  <div className="mt-stat-num">{tip.community.staff.length}</div>
                  <div className="mt-stat-lab">contacts</div>
                </div>
              ) : null}
              {tip.community.completeness != null ? (
                <div className="mt-stat">
                  <div className="mt-stat-num">{Math.round(tip.community.completeness*100)}<span style={{fontSize:11}}>%</span></div>
                  <div className="mt-stat-lab">documented</div>
                </div>
              ) : null}
            </div>
          )}
          <div className="mt-pillars">
            {[
              ['hasPhysical', '#b8351e', 'Physical'],
              ['hasMental',   '#3a5d8c', 'Mental'],
              ['hasSpiritual','#d4a017', 'Spiritual'],
              ['hasEmotional','#6b8d6b', 'Emotional'],
              ['hasYouth',    '#a08530', 'Youth'],
              ['hasSurvivors','#5a4f40', 'Survivors'],
            ].map(([k, color, lab]) => (
              <span key={k} className={`mt-pill ${tip.community[k]?'on':''}`}
                style={tip.community[k] ? {background:color, color:'#fbf6ec', borderColor:color} : null}
                title={tip.community[k] ? `${lab}: documented` : `${lab}: not documented`}>
                {lab}
              </span>
            ))}
          </div>
          <div className="hint">Click for full record →</div>
        </div>
      )}

      <div className="map-overlay map-counter">
        <span className="num">{communities.length}</span>
        <span>showing</span>
      </div>
    </div>
  );
}

// Direction-compass SVG overlay — sits in top-right of map, dismissable
function MedicineWheelOverlay({ activeDir, setDir, onClose }) {
  const dirs = [
    { key: 'East',  angle: 0,   label: 'East',  color: '#d4a017' },
    { key: 'South', angle: 90,  label: 'South', color: '#b8351e' },
    { key: 'West',  angle: 180, label: 'West',  color: '#1a1612' },
    { key: 'North', angle: 270, label: 'North', color: '#cabd9c' },
  ];
  const R = 60, cx = 70, cy = 70;
  function arc(start, end) {
    const sa = (start - 90) * Math.PI / 180;
    const ea = (end - 90) * Math.PI / 180;
    const x1 = cx + R * Math.cos(sa), y1 = cy + R * Math.sin(sa);
    const x2 = cx + R * Math.cos(ea), y2 = cy + R * Math.sin(ea);
    return `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`;
  }
  return (
    <div className="map-overlay medicine-wheel">
      <button className="mw-close" onClick={onClose} title="Hide compass">✕</button>
      <div className="mw-title">Direction Compass</div>
      <svg viewBox="0 0 140 140" width="140" height="140">
        <circle cx={cx} cy={cy} r={R+4} fill="#fbf6ec" stroke="#1a1612" strokeWidth="1.5" />
        {dirs.map(d => {
          const isOn = activeDir === d.key;
          const dim = activeDir && activeDir !== d.key;
          return (
            <path key={d.key} d={arc(d.angle, d.angle+90)}
              fill={d.color}
              opacity={dim ? 0.35 : (isOn ? 1 : 0.85)}
              stroke="#fbf6ec" strokeWidth="2"
              style={{cursor:'pointer', transition:'opacity .25s'}}
              onClick={() => setDir(d.key)}>
              <title>{d.label}</title>
            </path>
          );
        })}
        <circle cx={cx} cy={cy} r={12} fill="#fbf6ec" stroke="#1a1612" strokeWidth="1.5" />
        <line x1={cx-R-4} y1={cy} x2={cx+R+4} y2={cy} stroke="#1a1612" strokeWidth="0.8" opacity="0.5" />
        <line x1={cx} y1={cy-R-4} x2={cx} y2={cy+R+4} stroke="#1a1612" strokeWidth="0.8" opacity="0.5" />
        <text x={cx} y={12} textAnchor="middle" fontSize="9" fill="#1a1612" fontFamily="Newsreader" fontStyle="italic">N</text>
        <text x={cx} y={138} textAnchor="middle" fontSize="9" fill="#1a1612" fontFamily="Newsreader" fontStyle="italic">S</text>
        <text x={4} y={cy+3} textAnchor="start" fontSize="9" fill="#1a1612" fontFamily="Newsreader" fontStyle="italic">W</text>
        <text x={136} y={cy+3} textAnchor="end" fontSize="9" fill="#1a1612" fontFamily="Newsreader" fontStyle="italic">E</text>
      </svg>
      <div className="mw-caption">{activeDir ? `Filtering: ${activeDir}` : 'Click a direction to filter'}</div>
      {activeDir && <button className="mw-clear" onClick={() => setDir(activeDir)}>↻ Show all</button>}
    </div>
  );
}

function DirectionLegend({ activeDir, setDir, byDir }) {
  return (
    <div className="map-overlay direction-legend">
      <div className="legend-title">Four Directions</div>
      {[
        ['East', 'Spring · New beginnings'],
        ['South','Summer · Youth'],
        ['West', 'Fall · Adulthood'],
        ['North','Winter · Elders'],
        ['AllDirections', 'Bridge organizations'],
      ].map(([d, sub]) => {
        const info = DIRECTION[d];
        const count = (byDir[d]||[]).length;
        const isOn = activeDir === d;
        const isDim = activeDir && activeDir !== d;
        // Bridge/partner organizations render as green dots on the map — make
        // the legend swatch match so the colour is self-explanatory.
        const isOrgRow = d === 'AllDirections';
        const swatchColor = isOrgRow ? '#3d6b40' : info.color;
        const rowLabel = isOrgRow ? 'Partner / health orgs' : info.label.split(' · ')[0];
        return (
          <button
            key={d}
            onClick={() => setDir(d)}
            className={`dir-row ${isOn?'on':''}`}
            style={{ opacity: isDim ? 0.45 : 1 }}
          >
            <span className="dir-swatch" style={{
              background: swatchColor,
              border: d === 'North' ? '1px solid var(--ink-3)' : '1px solid transparent',
            }}></span>
            <div className="dir-text">
              <div className="dir-name">{rowLabel}</div>
              <div className="dir-sub">{sub}</div>
            </div>
            <span className="dir-count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

// ===========================================================================
// MapSearch — fuzzy substring lookup over names; shows up to 8 hits.
// ===========================================================================
function MapSearch({ communities, onPick, value, setValue }) {
  const [open, setOpen] = useState(false);
  const results = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    if (q.length < 2) return [];
    return communities
      .filter(c => c.name.toLowerCase().includes(q) || (c.regionGroup||'').toLowerCase().includes(q))
      .slice(0, 8);
  }, [value, communities]);
  return (
    <div className={`map-overlay map-search ${open?'open':''}`}>
      <div className="ms-row">
        <span className="ms-icon">⌕</span>
        <input
          type="text"
          placeholder="Search 200+ communities…"
          value={value}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Search communities"
        />
        {value && <button className="ms-clear" onClick={() => setValue('')} aria-label="Clear">✕</button>}
      </div>
      {open && results.length > 0 && (
        <div className="ms-results">
          {results.map(c => (
            <button key={c.id} className="ms-result" onMouseDown={() => { onPick(c); setOpen(false); }}>
              <span className="ms-mark" style={{background: (window.DIRECTION[c.direction||'AllDirections']||{}).color || '#5a4f40'}}></span>
              <div>
                <div className="ms-name">{c.name.trim()}</div>
                <div className="ms-meta">{c.regionGroup} · {c.direction}{c.population?` · ${c.population.toLocaleString()} ppl`:''}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Backward compat
window.regionColor = (c) => DIRECTION[c.direction || 'AllDirections'].color;
window.regionHex = (c) => DIRECTION[c.direction || 'AllDirections'].color;
window.REGION_HEX = {
  Pilot: '#d4a017', Algoma: '#d4a017', East: '#d4a017',
  South: '#b8351e', West: '#1a1612', North: '#cabd9c',
};
window.CanadaMap = CanadaMap;
