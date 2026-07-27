/* global React */
/*
 * THE FOUR DIRECTIONS — a living medicine wheel over the real territory.
 *
 * Community members told us plainly: this dashboard is not the place to be
 * taught about the painful past — they already carry it. So this page is
 * PRESENT TENSE and celebratory. It walks the four directions the way the
 * teachings do, and at each one the map flies to that direction's actual
 * communities, the season changes around you, and the real programming those
 * nations run today is right there to open.
 *
 * Everything on screen is live from the atlas. Nothing is invented, nothing is
 * retold on anyone's behalf, and no community's teachings are put in its mouth.
 */

const { useState: useS7, useEffect: useE7, useRef: useR7, useMemo: useM7 } = React;

const _DIRS = [
  {
    key: 'East', label: 'East', season: 'Spring', stage: 'New beginnings',
    accent: '#d4a017', deep: '#8c6614', soft: '#f7e6b0',
    line: 'The sun comes up here. This is the direction of beginnings — new programs taking root, babies and young families, the first light on the water.',
    geo: { c: [46.6, -80.4], z: 5.4 }, weather: 'buds',
  },
  {
    key: 'South', label: 'South', season: 'Summer', stage: 'Growth · the body',
    accent: '#b8351e', deep: '#7a1f10', soft: '#f2c0b2',
    line: 'The sun is highest here. This is the direction of growth and of the body — being out on the land, feeding people well, moving, playing, healing.',
    geo: { c: [44.6, -79.4], z: 5.6 }, weather: 'sun',
  },
  {
    key: 'West', label: 'West', season: 'Autumn', stage: 'Reflection · the mind',
    accent: '#5c6b8a', deep: '#33405c', soft: '#c9d2e4',
    line: 'The sun goes down here. This is the direction of reflection and of the mind — counselling, quiet work, the harder roads walked alongside someone.',
    geo: { c: [50.2, -95.0], z: 4.4 }, weather: 'leaves',
  },
  {
    key: 'North', label: 'North', season: 'Winter', stage: 'Wisdom · the heart',
    accent: '#7fa8a0', deep: '#4a6f68', soft: '#dcece8',
    line: 'The cold comes from here, and so does wisdom. This is the direction of the elders and of the heart — memory, language, ceremony, the long view.',
    geo: { c: [52.6, -86.0], z: 4.6 }, weather: 'snow',
  },
];

const _PILL = [
  { k: 'physical', label: 'Physical' }, { k: 'mental', label: 'Mental' },
  { k: 'spiritual', label: 'Spiritual' }, { k: 'emotional', label: 'Emotional' },
];

function _real(v) {
  const s = String(v == null ? '' : v).trim();
  return !!s && !['missing information', 'needs review', 'n/a', 'no definite value', 'tbd', '-'].includes(s.toLowerCase());
}
function _has(c, k) { return _real(c[k]) || !!c['has' + k.charAt(0).toUpperCase() + k.slice(1)]; }

// one true sentence a community wrote about its own work
function _voice(c) {
  for (const k of ['spiritual', 'emotional', 'physical', 'mental', 'youth']) {
    if (!_real(c[k])) continue;
    const t = String(c[k]).replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim();
    const m = t.match(/^.*?[.!?](?:\s|$)/);
    let out = (m ? m[0] : t).trim();
    if (out.length < 40) continue;
    if (out.length > 210) out = out.slice(0, 210).replace(/\s+\S*$/, '') + '…';
    return { text: out, pillar: k };
  }
  return null;
}

function SevenFiresView({ all, setView, onSelect }) {
  const [dir, setDir] = useS7(0);
  const reduce = typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cur = _DIRS[dir];

  // ---- live data for the active direction ----
  const groups = useM7(() => {
    const g = {};
    _DIRS.forEach(d => { g[d.key] = []; });
    (all || []).forEach(c => { const k = c.direction; if (g[k]) g[k].push(c); });
    return g;
  }, [all]);
  const here = groups[cur.key] || [];
  const stats = useM7(() => {
    const people = here.reduce((s, c) => s + (Number(c.population) || 0), 0);
    const byPillar = {};
    _PILL.forEach(p => { byPillar[p.k] = here.filter(c => _has(c, p.k)).length; });
    return {
      n: here.length, people,
      byPillar,
      youth: here.filter(c => _has(c, 'youth')).length,
      allFour: here.filter(c => _PILL.every(p => _has(c, p.k))).length,
    };
  }, [here]);
  const voices = useM7(() => here.map(c => ({ c, v: _voice(c) })).filter(x => x.v).slice(0, 3), [here]);

  // ---- the map flies to this direction's real communities ----
  const mapElRef = useR7(null), mapRef = useR7(null), layerRef = useR7(null);
  useE7(() => {
    let poll = null, cancelled = false;
    function build() {
      const map = window.L.map(mapElRef.current, {
        center: cur.geo.c, zoom: cur.geo.z, zoomControl: false, attributionControl: true,
        scrollWheelZoom: false, dragging: false, doubleClickZoom: false, boxZoom: false,
        keyboard: false, touchZoom: false,
      });
      map.attributionControl.setPrefix('');
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        { attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 18 }).addTo(map);
      layerRef.current = window.L.layerGroup().addTo(map);
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 60);
    }
    function init() {
      if (cancelled || mapRef.current || !mapElRef.current) return true;
      if (!window.L) return false;
      build(); return true;
    }
    if (!init()) poll = setInterval(() => { if (init() && poll) { clearInterval(poll); poll = null; } }, 250);
    return () => {
      cancelled = true; if (poll) clearInterval(poll);
      try { if (mapRef.current) mapRef.current.remove(); } catch (e) {}
      mapRef.current = null;
    };
  }, []);

  useE7(() => {
    const map = mapRef.current, lyr = layerRef.current;
    if (!map || !lyr) return;
    lyr.clearLayers();
    const pts = [];
    here.forEach(c => {
      if (c.lat == null || c.lng == null) return;
      pts.push([c.lat, c.lng]);
      const m = window.L.circleMarker([c.lat, c.lng], {
        radius: 7, color: '#fff', weight: 1.6, fillColor: cur.accent, fillOpacity: 0.95, opacity: 0.95,
      }).addTo(lyr);
      m.bindTooltip(String(c.name || '').trim(), { direction: 'top', offset: [0, -8] });
      m.on('click', () => onSelect && onSelect(c.id));
    });
    try {
      if (pts.length) map.flyToBounds(window.L.latLngBounds(pts).pad(0.25), { duration: 1.8 });
      else map.flyTo(cur.geo.c, cur.geo.z, { duration: 1.8 });
    } catch (e) {}
  }, [dir, here, cur, onSelect]);

  // ---- the season falls over the map ----
  const canvasRef = useR7(null);
  const dirRef = useR7(0); dirRef.current = dir;
  useE7(() => {
    const canvas = canvasRef.current; if (!canvas || reduce) return;
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
    const P = Array.from({ length: 120 }, () => ({
      x: Math.random(), y: Math.random(), s: Math.random() * 0.7 + 0.4,
      sp: Math.random() * 0.5 + 0.4, dr: Math.random() * 6.3, r: Math.random() * 6.3,
    }));
    function frame(time) {
      raf = requestAnimationFrame(frame);
      const tt = (time - (t0 == null ? (t0 = time) : t0)) / 1000;
      const d = _DIRS[dirRef.current], w = d.weather;
      ctx.clearRect(0, 0, W, H);
      // a soft seasonal wash so the map still reads underneath
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, d.accent + '22'); g.addColorStop(1, d.accent + '08');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        let x = p.x * W, y = 0;
        if (w === 'snow') {
          y = ((p.y + tt * 0.035 * p.sp) % 1) * H;
          x = p.x * W + Math.sin(tt * 0.7 + p.dr) * 22;
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath(); ctx.arc(x, y, 2.2 * p.s, 0, 6.283); ctx.fill();
        } else if (w === 'leaves') {
          y = ((p.y + tt * 0.05 * p.sp) % 1) * H;
          x = p.x * W + Math.sin(tt * 1.1 + p.dr) * 38;
          ctx.save(); ctx.translate(x, y); ctx.rotate(tt * 1.4 + p.r);
          ctx.fillStyle = ['#c46a2a', '#a8452a', '#d99a3a', '#8a5a3a'][i % 4];
          ctx.beginPath(); ctx.ellipse(0, 0, 6 * p.s, 3 * p.s, 0, 0, 6.283); ctx.fill();
          ctx.restore();
        } else if (w === 'buds') {
          y = ((1 - ((p.y + tt * 0.04 * p.sp) % 1)) * H);
          x = p.x * W + Math.sin(tt * 0.8 + p.dr) * 16;
          ctx.fillStyle = ['rgba(212,160,23,0.85)', 'rgba(150,190,110,0.85)', 'rgba(240,214,140,0.85)'][i % 3];
          ctx.beginPath(); ctx.ellipse(x, y, 3.4 * p.s, 4.6 * p.s, Math.sin(tt + p.r) * 0.4, 0, 6.283); ctx.fill();
        } else {                                   // summer: warm motes rising in the light
          y = ((1 - ((p.y + tt * 0.03 * p.sp) % 1)) * H);
          x = p.x * W + Math.sin(tt * 0.6 + p.dr) * 26;
          ctx.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(tt * 1.5 + p.r));
          ctx.fillStyle = '#ffd98a';
          ctx.beginPath(); ctx.arc(x, y, 2.6 * p.s, 0, 6.283); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }
    raf = requestAnimationFrame(frame);
    return () => { if (raf) cancelAnimationFrame(raf); if (ro) ro.disconnect(); };
  }, [reduce]);

  const maxPillar = Math.max(1, ...Object.values(stats.byPillar));

  return (
    <div className="fd-wrap" style={{ '--ac': cur.accent, '--deep': cur.deep, '--soft': cur.soft }}>
      <div className="fd-stage">
        <div ref={mapElRef} className="fd-map" />
        <canvas ref={canvasRef} className="fd-weather" />

        {/* the medicine wheel — click a quadrant to travel */}
        <div className="fd-wheel" role="tablist" aria-label="The four directions">
          <svg viewBox="0 0 200 200" className="fd-wheel-svg">
            {_DIRS.map((d, i) => {
              const a0 = (-135 + i * 90) * Math.PI / 180, a1 = (-45 + i * 90) * Math.PI / 180;
              const x0 = 100 + Math.cos(a0) * 92, y0 = 100 + Math.sin(a0) * 92;
              const x1 = 100 + Math.cos(a1) * 92, y1 = 100 + Math.sin(a1) * 92;
              return (
                <path key={d.key} d={`M100 100 L${x0} ${y0} A92 92 0 0 1 ${x1} ${y1} Z`}
                      fill={d.accent} opacity={dir === i ? 1 : 0.34}
                      className={`fd-quad ${dir === i ? 'on' : ''}`}
                      onClick={() => setDir(i)} role="tab" aria-selected={dir === i}
                      tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setDir(i)}>
                  <title>{d.label} · {d.season}</title>
                </path>
              );
            })}
            <circle cx="100" cy="100" r="30" fill="rgba(18,16,12,.85)" />
            <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2.5" />
            <line x1="8" y1="100" x2="192" y2="100" stroke="rgba(255,255,255,.5)" strokeWidth="2.5" />
            <line x1="100" y1="8" x2="100" y2="192" stroke="rgba(255,255,255,.5)" strokeWidth="2.5" />
            <text x="100" y="106" textAnchor="middle" className="fd-wheel-mid">{cur.label}</text>
          </svg>
          <div className="fd-wheel-cap">Tap a direction</div>
        </div>

        {/* the panel for the direction you're standing in */}
        <div className="fd-panel" key={cur.key}>
          <div className="fd-eyebrow">{cur.season} · {cur.stage}</div>
          <h2>{cur.label}</h2>
          <p className="fd-line">{cur.line}</p>

          <div className="fd-stats">
            <div><b>{stats.n}</b><span>communities &amp; partners</span></div>
            {stats.people > 0 && <div><b>{stats.people.toLocaleString()}</b><span>people served</span></div>}
            <div><b>{stats.allFour}</b><span>document all four pillars</span></div>
            <div><b>{stats.youth}</b><span>with youth on the land</span></div>
          </div>

          <div className="fd-bars">
            {_PILL.map(p => (
              <div key={p.k} className="fd-bar">
                <span className="fd-bar-l">{p.label}</span>
                <span className="fd-bar-t"><i style={{ width: `${(stats.byPillar[p.k] / maxPillar) * 100}%` }} /></span>
                <span className="fd-bar-n">{stats.byPillar[p.k]}</span>
              </div>
            ))}
          </div>

          {voices.length > 0 && (
            <div className="fd-voices">
              <div className="fd-voices-h">In their own words</div>
              {voices.map(({ c, v }) => (
                <blockquote key={c.id} className="fd-voice">
                  “{v.text}”
                  <cite onClick={() => onSelect && onSelect(c.id)}>— {String(c.name).trim()} ↗</cite>
                </blockquote>
              ))}
            </div>
          )}

          <div className="fd-chips">
            {here.slice(0, 14).map(c => (
              <button key={c.id} className="fd-chip" onClick={() => onSelect && onSelect(c.id)}>
                {String(c.name).trim()}
              </button>
            ))}
            {here.length > 14 && <span className="fd-more">+{here.length - 14} more</span>}
          </div>

          <div className="fd-cta">
            <button className="fd-btn" onClick={() => setDir((dir + 1) % _DIRS.length)}>
              Walk on to {_DIRS[(dir + 1) % _DIRS.length].label} →
            </button>
            <button className="fd-btn ghost" onClick={() => setView && setView('directory')}>Open the directory</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.SevenFiresView = SevenFiresView;
