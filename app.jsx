/* global React */
const { useState, useMemo, useEffect } = React;

const REGION_KEYS = ['Pilot','Algoma','East','South','West','North','Partner'];
const DIR_KEYS = ['East','South','West','North','Central'];

function readURLState() {
  const p = new URLSearchParams(window.location.hash.slice(1));
  return {
    view: p.get('v') || 'map',
    search: p.get('q') || '',
    regions: new Set((p.get('r') || '').split(',').filter(Boolean)),
    orgTypes: new Set((p.get('o') || '').split(',').filter(Boolean)),
    popBuckets: new Set((p.get('p') || '').split(',').filter(Boolean)),
    pillars: new Set((p.get('s') || '').split(',').filter(Boolean)),
    directions: new Set((p.get('d') || '').split(',').filter(Boolean)),
    hasYouth: p.get('y') === '1',
    hasSurvivor: p.get('sv') === '1',
    completeOnly: p.get('c') === '1',
    selectedId: p.get('id') || null,
  };
}
function writeURLState(state) {
  const p = new URLSearchParams();
  if (state.view && state.view !== 'map') p.set('v', state.view);
  if (state.search) p.set('q', state.search);
  if (state.regions.size) p.set('r', [...state.regions].join(','));
  if (state.orgTypes.size) p.set('o', [...state.orgTypes].join(','));
  if (state.popBuckets.size) p.set('p', [...state.popBuckets].join(','));
  if (state.pillars.size) p.set('s', [...state.pillars].join(','));
  if (state.directions.size) p.set('d', [...state.directions].join(','));
  if (state.hasYouth) p.set('y', '1');
  if (state.hasSurvivor) p.set('sv', '1');
  if (state.completeOnly) p.set('c', '1');
  if (state.selectedId) p.set('id', state.selectedId);
  const str = p.toString();
  const newHash = str ? '#' + str : '';
  if (window.location.hash !== newHash) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search + newHash);
  }
}

function AppInner() {
  const cms = window.useCMS();
  // Imported data takes precedence over baked-in COMMUNITIES
  const baseAll = useMemo(() => window.buildAll(), [cms.cms.dataSource]);
  const all = useMemo(() => baseAll.map(c => cms.applyOverrides(c)), [baseAll, cms.cms]);
  const initial = readURLState();
  const [view, setView] = useState(initial.view);
  const [search, setSearch] = useState(initial.search);
  const [regions, setRegions] = useState(initial.regions);
  const [orgTypes, setOrgTypes] = useState(initial.orgTypes);
  const [popBuckets, setPopBuckets] = useState(initial.popBuckets);
  const [pillars, setPillars] = useState(initial.pillars);
  const [directions, setDirections] = useState(initial.directions);
  const [hasYouth, setHasYouth] = useState(initial.hasYouth);
  const [hasSurvivor, setHasSurvivor] = useState(initial.hasSurvivor);
  const [completeOnly, setCompleteOnly] = useState(initial.completeOnly);
  const [sortBy, setSortBy] = useState('name');
  const [selectedId, setSelectedId] = useState(initial.selectedId);
  const [hoveredId, setHoveredId] = useState(null);
  const [listMode, setListMode] = useState('grid');
  const [shareToast, setShareToast] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      writeURLState({ view, search, regions, orgTypes, popBuckets, pillars, directions, hasYouth, hasSurvivor, completeOnly, selectedId });
    });
    return () => cancelAnimationFrame(id);
  }, [view, search, regions, orgTypes, popBuckets, pillars, directions, hasYouth, hasSurvivor, completeOnly, selectedId]);

  function toggleSet(setter, current, key) {
    const next = new Set(current);
    next.has(key) ? next.delete(key) : next.add(key);
    setter(next);
  }

  // Map → app: clicking a wheel direction sets the directions filter
  function setDirectionFilter(d) {
    if (!d) { setDirections(new Set()); return; }
    setDirections(new Set([d]));
  }
  const activeDirectionForMap = directions.size === 1 ? [...directions][0] : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = all.filter(c => {
      if (q) {
        const hay = (c.name + ' ' + (c.regionGroup||'') + ' ' + (c.physical||'') + ' ' + (c.mental||'') + ' ' + (c.spiritual||'') + ' ' + (c.emotional||'') + ' ' + (c.youth||'') + ' ' + (c.survivors||'') + ' ' + (c.contacts||'')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (regions.size > 0 && !regions.has(c.regionGroup)) return false;
      if (directions.size > 0 && !directions.has(c.direction || 'Central')) return false;
      if (orgTypes.size > 0 && !orgTypes.has(c.orgType)) return false;
      if (popBuckets.size > 0) {
        const b = window.popBucket(c.population);
        if (!b || !popBuckets.has(b)) return false;
      }
      if (pillars.size > 0) {
        for (const p of pillars) if (!window.pillarOn(c, p)) return false;
      }
      if (hasYouth && !c.hasYouth) return false;
      if (hasSurvivor && !c.hasSurvivors) return false;
      if (completeOnly && c.completeness < 0.7) return false;
      return true;
    });
    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.trim().localeCompare(b.name.trim());
      if (sortBy === 'pop') return (b.population || 0) - (a.population || 0);
      if (sortBy === 'complete') return b.completeness - a.completeness;
      return 0;
    });
    return list;
  }, [all, search, regions, directions, orgTypes, popBuckets, pillars, hasYouth, hasSurvivor, completeOnly, sortBy]);

  const selected = useMemo(() => all.find(c => c.id === selectedId), [all, selectedId]);

  const counts = useMemo(() => {
    const r = {}, o = {}, p = {}, d = {};
    all.forEach(c => {
      r[c.regionGroup] = (r[c.regionGroup] || 0) + 1;
      o[c.orgType] = (o[c.orgType] || 0) + 1;
      const dir = c.direction || 'Central';
      d[dir] = (d[dir] || 0) + 1;
    });
    window.POP_BUCKETS.forEach(b => { p[b.key] = all.filter(c => b.test(c.population)).length; });
    return { regions: r, orgs: o, pops: p, dirs: d };
  }, [all]);

  const totalPop = useMemo(() => filtered.reduce((s, c) => s + (c.population || 0), 0), [filtered]);
  const anyFilters = search || regions.size || directions.size || orgTypes.size || popBuckets.size || pillars.size || hasYouth || hasSurvivor || completeOnly;
  function clearAll() {
    setSearch(''); setRegions(new Set()); setDirections(new Set()); setOrgTypes(new Set()); setPopBuckets(new Set());
    setPillars(new Set()); setHasYouth(false); setHasSurvivor(false); setCompleteOnly(false);
  }

  function shareLink() {
    const url = window.location.href;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setShareToast(true);
        setTimeout(() => setShareToast(false), 2200);
      });
    }
  }

  const totalCommunities = all.filter(c => c.orgType === 'Community').length;
  const totalOrgs = all.length - totalCommunities;
  const grandPop = all.reduce((s,c) => s + (c.population||0), 0);

  return (
    <div className="app">
      <window.GreetingBanner />
      <div className="admin-slot"><window.AdminToolbar /></div>
      <window.AccessibilityPanel />
      <Hero totalCommunities={totalCommunities} totalOrgs={totalOrgs} grandPop={grandPop} view={view} setView={setView} filtered={filtered.length} all={all.length} />

      {view === 'stats' ? (
        <window.StatsView all={all} onSelect={setSelectedId} setView={setView}
          setRegions={setRegions} setOrgTypes={setOrgTypes} setPillars={setPillars} />
      ) : view === 'stories' ? (
        <window.StoriesView all={all} onSelect={setSelectedId} />
      ) : view === 'coverage' ? (
        <window.CoverageView onSelect={setSelectedId} setView={setView} />
      ) : (
        <div className="main-grid">
          <FilterRail
            search={search} setSearch={setSearch}
            regions={regions} setRegions={setRegions}
            directions={directions} setDirections={setDirections}
            orgTypes={orgTypes} setOrgTypes={setOrgTypes}
            popBuckets={popBuckets} setPopBuckets={setPopBuckets}
            pillars={pillars} setPillars={setPillars}
            hasYouth={hasYouth} setHasYouth={setHasYouth}
            hasSurvivor={hasSurvivor} setHasSurvivor={setHasSurvivor}
            completeOnly={completeOnly} setCompleteOnly={setCompleteOnly}
            counts={counts} all={all} toggle={toggleSet}
            anyFilters={anyFilters} clearAll={clearAll}
            shareLink={shareLink}
          />
          <main className="content">
            {view === 'map' && (
              <window.CanadaMap
                communities={filtered} allCommunities={all}
                selectedId={selectedId} onSelect={setSelectedId}
                onHover={setHoveredId} hoveredId={hoveredId}
                directionFilter={activeDirectionForMap}
                onDirectionFilter={setDirectionFilter}
              />
            )}
            <div className="list-wrap">
              <div className="list-head">
                <div className="list-count">
                  Showing <span className="num">{filtered.length}</span> of {all.length}
                  {totalPop > 0 && <span className="pop">≈ {totalPop.toLocaleString()} PEOPLE</span>}
                </div>
                <div className="list-controls">
                  <span>Sort:</span>
                  <button className={`sort-btn ${sortBy==='name'?'on':''}`} onClick={() => setSortBy('name')}>A–Z</button>
                  <button className={`sort-btn ${sortBy==='pop'?'on':''}`} onClick={() => setSortBy('pop')}>Population</button>
                  <button className={`sort-btn ${sortBy==='complete'?'on':''}`} onClick={() => setSortBy('complete')}>Documented</button>
                  <div className="view-toggle">
                    <button className={listMode==='grid'?'on':''} onClick={() => setListMode('grid')}>Grid</button>
                    <button className={listMode==='compact'?'on':''} onClick={() => setListMode('compact')}>List</button>
                  </div>
                </div>
              </div>
              <div className={`list ${listMode==='compact'?'compact':''}`}>
                {filtered.length === 0 && (
                  <div className="empty">
                    No communities match these filters.
                    <button onClick={clearAll}>Clear filters</button>
                  </div>
                )}
                {filtered.map(c => (
                  <window.CommunityCard key={c.id} c={c}
                    hovered={hoveredId === c.id} selected={selectedId === c.id}
                    onClick={() => setSelectedId(c.id)} onHover={setHoveredId}
                    compact={listMode === 'compact'}
                    searchQuery={search.trim()}
                    isPinned={false}
                    onTogglePin={()=>{}}
                  />
                ))}
              </div>
            </div>
          </main>
        </div>
      )}

      <window.CommunityDrawer community={selected} onClose={() => setSelectedId(null)} searchQuery={search.trim()} />

      {shareToast && (
        <div className="share-toast">
          <span className="accent">↗</span>
          Link copied — paste anywhere to restore this view
        </div>
      )}
      {view === 'stats' && <window.TeachingsRibbon />}
    </div>
  );
}

function App() {
  return <window.CMSProvider><AppInner /></window.CMSProvider>;
}

function Hero({ totalCommunities, totalOrgs, grandPop, view, setView, filtered, all }) {
  return (
    <header className="hero">
      <div className="hero-row">
        <div className="hero-brand">
          <div className="hero-eyebrow">
            <span className="badge">Mino Bimaadiziwin</span>
            <span className="pulse"></span>
            <span>Living atlas · {new Date().toLocaleDateString('en-CA',{month:'short', year:'numeric'})}</span>
          </div>
          <h1 className="hero-title">A living atlas of <span className="em">community care</span>.</h1>
          <p className="hero-sub">
            Find <span className="roll"><span>physical health</span><span>mental health</span><span>spiritual support</span><span>emotional support</span></span> programming across {totalCommunities} First Nations and {totalOrgs} partner organizations.
          </p>
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <div className="num"><span className="accent">{totalCommunities}</span></div>
            <div className="label">Communities</div>
          </div>
          <div className="hero-stat">
            <div className="num">{totalOrgs}</div>
            <div className="label">Partners</div>
          </div>
          <div className="hero-stat">
            <div className="num">{Math.round(grandPop/1000)}<span style={{fontSize:22}}>k</span></div>
            <div className="label">People</div>
          </div>
        </div>
      </div>
      <div className="nav-strip">
        <button className={`nav-tab ${view==='map'?'on':''}`} onClick={() => setView('map')}>
          ◉  Map · Search <span className="count">{filtered}</span>
        </button>
        <button className={`nav-tab ${view==='list'?'on':''}`} onClick={() => setView('list')}>
          ☷  Directory <span className="count">{all}</span>
        </button>
        <button className={`nav-tab ${view==='stories'?'on':''}`} onClick={() => setView('stories')}>
          ❋  Community Stories
        </button>
        <button className={`nav-tab ${view==='stats'?'on':''}`} onClick={() => setView('stats')}>
          ◭  Insights & Stories
        </button>
        <button className={`nav-tab ${view==='coverage'?'on':''}`} onClick={() => setView('coverage')}>
          ⌧  Coverage (85)
        </button>
      </div>
    </header>
  );
}

function FilterRail(props) {
  const { search, setSearch, regions, setRegions, directions, setDirections, orgTypes, setOrgTypes,
    popBuckets, setPopBuckets, pillars, setPillars,
    hasYouth, setHasYouth, hasSurvivor, setHasSurvivor,
    completeOnly, setCompleteOnly, counts, all, toggle, anyFilters, clearAll, shareLink } = props;

  const dirLabels = {
    East: 'East · Spring', South: 'South · Summer',
    West: 'West · Autumn', North: 'North · Winter',
    Central: 'Central · Cross-region',
  };

  return (
    <aside className="rail">
      <div className="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-5-5" />
        </svg>
        <input type="text" placeholder="Search communities, services, contacts…" value={search} onChange={e => setSearch(e.target.value)} />
        {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
      </div>

      <FilterGroup label="Region (Direction)" onClear={directions.size ? () => setDirections(new Set()) : null}>
        <div className="toggle-row">
          {DIR_KEYS.map(d => {
            const info = window.DIRECTION[d];
            return (
              <label key={d} className={`toggle ${directions.has(d)?'on':''}`} onClick={() => toggle(setDirections, directions, d)}>
                <span className="toggle-mark" style={{borderLeft:`3px solid ${info.color}`}}></span>
                <span>{dirLabels[d]}</span>
                <span className="toggle-count">{counts.dirs[d] || 0}</span>
              </label>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup label="Service pillar" onClear={pillars.size ? () => setPillars(new Set()) : null}>
        <div className="chips">
          {window.PILLARS.map(p => (
            <button key={p.key} className={`chip ${pillars.has(p.key)?'on':''}`} onClick={() => toggle(setPillars, pillars, p.key)}>
              <span className="chip-dot" style={{background: p.hex}}></span>
              {p.icon} {p.label.split(' ')[0]}
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Population" onClear={popBuckets.size ? () => setPopBuckets(new Set()) : null}>
        <div className="chips">
          {window.POP_BUCKETS.map(b => (
            <button key={b.key} className={`chip ${popBuckets.has(b.key)?'on':''}`} onClick={() => toggle(setPopBuckets, popBuckets, b.key)}>
              {b.label}<span className="ct">{counts.pops[b.key]}</span>
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Sub-region" onClear={regions.size ? () => setRegions(new Set()) : null}>
        <div className="chips">
          {REGION_KEYS.filter(r => counts.regions[r]).map(r => (
            <button key={r} className={`chip ${regions.has(r)?'on':''}`} onClick={() => toggle(setRegions, regions, r)}>
              {r}<span className="ct">{counts.regions[r] || 0}</span>
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Organization type" onClear={orgTypes.size ? () => setOrgTypes(new Set()) : null}>
        <div className="toggle-row">
          {(window.ORG_TYPES || []).filter(o => counts.orgs[o]).map(o => (
            <label key={o} className={`toggle ${orgTypes.has(o)?'on':''}`} onClick={() => toggle(setOrgTypes, orgTypes, o)}>
              <span className="toggle-mark"></span>
              <span>{o}</span>
              <span className="toggle-count">{counts.orgs[o] || 0}</span>
            </label>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Programming">
        <div className="toggle-row">
          <label className={`toggle ${hasYouth?'on':''}`} onClick={() => setHasYouth(!hasYouth)}>
            <span className="toggle-mark"></span><span>Has youth programming</span>
            <span className="toggle-count">{all.filter(c=>c.hasYouth).length}</span>
          </label>
          <label className={`toggle ${hasSurvivor?'on':''}`} onClick={() => setHasSurvivor(!hasSurvivor)}>
            <span className="toggle-mark"></span><span>Has survivor support</span>
            <span className="toggle-count">{all.filter(c=>c.hasSurvivors).length}</span>
          </label>
          <label className={`toggle ${completeOnly?'on':''}`} onClick={() => setCompleteOnly(!completeOnly)}>
            <span className="toggle-mark"></span><span>Substantially documented</span>
            <span className="toggle-count">{all.filter(c=>c.completeness>=0.7).length}</span>
          </label>
        </div>
      </FilterGroup>

      {anyFilters && <button className="clear-btn" onClick={clearAll}>✕ Clear all filters</button>}
      <button className="share-btn" onClick={shareLink} title="Copy a link to this filtered view">
        ↗ Share this view
      </button>
    </aside>
  );
}

function FilterGroup({ label, onClear, children }) {
  return (
    <div className="filter-group">
      <div className="filter-label">
        <span>{label}</span>
        {onClear && <button className="clear" onClick={onClear}>clear</button>}
      </div>
      {children}
    </div>
  );
}

window.App = App;
