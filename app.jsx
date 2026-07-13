/* global React */
const { useState, useMemo, useEffect } = React;

const REGION_KEYS = ['Pilot','Algoma','East','South','West','North','Partner'];
const DIR_KEYS = ['East','South','West','North','Central'];

function readURLState() {
  const p = new URLSearchParams(window.location.hash.slice(1));
  return {
    view: p.get('v') || 'welcome',
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
  const [agmOpen, setAgmOpen] = useState(false);
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
        // Token-aware + typo-tolerant so voice search / multi-word / misspelled
        // queries return matches instead of an empty list (see matchCommunity).
        if (window.matchCommunity ? !window.matchCommunity(c, q) : !(c.name + ' ' + (c.regionGroup||'') + ' ' + (c.physical||'') + ' ' + (c.mental||'') + ' ' + (c.spiritual||'') + ' ' + (c.emotional||'') + ' ' + (c.youth||'') + ' ' + (c.survivors||'') + ' ' + (c.contacts||'')).toLowerCase().includes(q)) return false;
      }
      if (regions.size > 0 && !regions.has(c.regionGroup)) return false;
      if (directions.size > 0 && !directions.has(c.direction || 'Central')) return false;
      if (orgTypes.size > 0 && !orgTypes.has(c.orgType)) return false;
      if (popBuckets.size > 0) {
        const b = window.popBucket(c.population);
        if (!b || !popBuckets.has(b)) return false;
      }
      if (pillars.size > 0) {
        // OR within the pillar facet (consistent with region / org-type):
        // show communities offering ANY selected pillar. Selecting more
        // pillars now visibly broadens the results instead of narrowing to
        // the handful that happen to offer all of them.
        let anyPillar = false;
        for (const p of pillars) { if (window.pillarOn(c, p)) { anyPillar = true; break; } }
        if (!anyPillar) return false;
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

  // Highlight search hits inside the drawer ONLY when the query is a service
  // term. If you searched a community's own NAME, don't paint that name yellow
  // all over its own profile — that just reads as noise.
  const drawerQuery = useMemo(() => {
    const q = search.trim();
    if (!q || !selected) return '';
    return selected.name.toLowerCase().includes(q.toLowerCase()) ? '' : q;
  }, [search, selected]);

  // LIVE facet counts ("million-dollar filters"): each count answers
  // "how many results would I get if I picked THIS value?", respecting every
  // OTHER active filter (a value's own facet is excluded so multi-select
  // within a facet stays additive). Zero-count options grey out in the rail.
  const counts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const passes = (c, skip) => {
      if (q) {
        if (window.matchCommunity ? !window.matchCommunity(c, q) : !(c.name + ' ' + (c.regionGroup || '')).toLowerCase().includes(q)) return false;
      }
      if (skip !== 'regions' && regions.size > 0 && !regions.has(c.regionGroup)) return false;
      if (skip !== 'dirs' && directions.size > 0 && !directions.has(c.direction || 'Central')) return false;
      if (skip !== 'orgs' && orgTypes.size > 0 && !orgTypes.has(c.orgType)) return false;
      if (skip !== 'pops' && popBuckets.size > 0) {
        const b = window.popBucket(c.population);
        if (!b || !popBuckets.has(b)) return false;
      }
      if (skip !== 'pillars' && pillars.size > 0) {
        let any = false;
        for (const p2 of pillars) { if (window.pillarOn(c, p2)) { any = true; break; } }
        if (!any) return false;
      }
      if (hasYouth && !c.hasYouth) return false;
      if (hasSurvivor && !c.hasSurvivors) return false;
      if (completeOnly && c.completeness < 0.7) return false;
      return true;
    };
    const r = {}, o = {}, p = {}, d = {}, pil = {};
    for (const c of all) {
      if (passes(c, 'regions')) r[c.regionGroup] = (r[c.regionGroup] || 0) + 1;
      if (passes(c, 'orgs')) o[c.orgType] = (o[c.orgType] || 0) + 1;
      if (passes(c, 'dirs')) { const dir = c.direction || 'Central'; d[dir] = (d[dir] || 0) + 1; }
      if (passes(c, 'pops')) { const b = window.popBucket(c.population); if (b) p[b] = (p[b] || 0) + 1; }
      if (passes(c, 'pillars')) { for (const pl of window.PILLARS) if (window.pillarOn(c, pl.key)) pil[pl.key] = (pil[pl.key] || 0) + 1; }
    }
    return { regions: r, orgs: o, pops: p, dirs: d, pillars: pil };
  }, [all, search, regions, directions, orgTypes, popBuckets, pillars, hasYouth, hasSurvivor, completeOnly]);

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

  // Re-render when the layout changes via SSE so admin reordering shows up live.
  const [, _setLayoutTick] = useState(0);
  useEffect(() => {
    function h() { _setLayoutTick((t) => t + 1); }
    window.addEventListener('atlas:layouts', h);
    return () => window.removeEventListener('atlas:layouts', h);
  }, []);

  const heroCtx = {
    totalCommunities, totalOrgs, grandPop,
    view, setView, filtered: filtered.length, all: all.length,
  };

  return (
    <div className={`app view-${view}`}>
      <BlockRenderer slot="header" blocks={DEFAULT_HEADER} ctx={heroCtx} />

      <BlockRenderer slot={`view.${view}.header`} blocks={[]} ctx={heroCtx} />

      {view === 'welcome' ? (
        <window.WelcomeView all={all} setView={setView} heroCtx={heroCtx} />
      ) : view === 'story' ? (
        <window.AtlasStoryView all={all} onSelect={setSelectedId} setView={setView} />
      ) : view === 'analytics' ? (
        <window.AnalyticsProView all={all} onSelect={setSelectedId} setView={setView} />
      ) : view === 'stats' ? (
        <window.StatsView all={all} onSelect={setSelectedId} setView={setView}
          setRegions={setRegions} setOrgTypes={setOrgTypes} setPillars={setPillars} />
      ) : view === 'stories' ? (
        <window.StoriesView all={all} onSelect={setSelectedId} />
      ) : view === 'coverage' ? (
        <window.CoverageView onSelect={setSelectedId} setView={setView} />
      ) : (
        <div className="main-grid">
          <FilterRail
            search={search} setSearch={setSearch} onPick={setSelectedId}
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

      <window.CommunityDrawer community={selected} onClose={() => setSelectedId(null)} searchQuery={drawerQuery} />

      {/* Presentation mode — available on every page */}
      {agmOpen && window.AGMPresentation && <window.AGMPresentation all={all} view={view} onClose={() => setAgmOpen(false)} />}
      {!selected && !agmOpen && (
        <button className="present-fab" onClick={() => setAgmOpen(true)}
                title="Present this page fullscreen — slides built from what you're viewing">
          ▶ Present this page
        </button>
      )}

      {shareToast && (
        <div className="share-toast">
          <span className="accent">↗</span>
          Link copied — paste anywhere to restore this view
        </div>
      )}
      {view === 'stats' && <window.TeachingsRibbon />}

      <BlockRenderer slot={`view.${view}.footer`} blocks={[]} ctx={heroCtx} />
      <BlockRenderer slot="footer" blocks={DEFAULT_FOOTER} ctx={heroCtx} />
    </div>
  );
}

function App() {
  return <window.CMSProvider><AppInner /></window.CMSProvider>;
}

function getSetting(key, fallback) {
  const s = window.ATLAS_SETTINGS || {};
  const v = s[key];
  // Fall back to default for null / undefined / empty / whitespace-only.
  if (v == null) return fallback;
  const trimmed = String(v).trim();
  return trimmed === '' ? fallback : v;
}


// ============================================================================
// BlockRenderer — renders a layout (header / footer) as a list of blocks.
// Block types: banner, admin-bar, a11y-panel, hero, page, spacer, html.
// Layout is driven by window.ATLAS_LAYOUTS[slot] (set by api-bridge.js).
// Each block is wrapped with data-cms-section="<slot>:<id>" so the edit
// overlay can target it for drag-and-drop reordering.
// ============================================================================

function PageBlock({ slug }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    function h() { setTick((t) => t + 1); }
    window.addEventListener('atlas:pages', h);
    return () => window.removeEventListener('atlas:pages', h);
  }, []);
  const pages = window.ATLAS_PAGES || {};
  const page = pages[slug];
  if (!page || !page.visible) return null;
  return (
    <section className="content-block page-block" data-cms-bind={`page:${slug}`}>
      {page.title && <h3 className="block-title">{page.title}</h3>}
      <div className="block-body">
        {(page.body || '').split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
      </div>
    </section>
  );
}

function SpacerBlock({ size = 'md' }) {
  const px = { sm: 16, md: 32, lg: 64 }[size] || 32;
  return <div className="content-spacer" style={{ height: px }} aria-hidden="true" />;
}

function HtmlBlock({ html }) {
  // Custom-HTML blocks are admin-authored. To keep XSS surface small we use
  // a sanitised passthrough (no <script> tags allowed) — see api-bridge.
  const safe = String(html || '').replace(/<\/?(script)[^>]*>/gi, '');
  return <div className="content-html" dangerouslySetInnerHTML={{ __html: safe }} />;
}

function TextBlock({ text, align, size }) {
  const cls = `content-text size-${size || 'md'} align-${align || 'left'}`;
  const lines = String(text || '').split(/\n{2,}/);
  return (
    <div className={cls}>
      {lines.map((p, i) => <p key={i}>{p}</p>)}
    </div>
  );
}

function HeadingBlock({ text, level, align }) {
  const Tag = `h${Math.min(6, Math.max(1, parseInt(level || 2, 10)))}`;
  return <Tag className={`content-heading align-${align || 'left'}`}>{text || ''}</Tag>;
}

function ImageBlock({ src, alt, width, caption, align }) {
  if (!src) return null;
  return (
    <figure className={`content-image align-${align || 'center'}`}>
      <img src={src} alt={alt || ''} style={width ? { maxWidth: width } : {}} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

function ButtonBlock({ text, href, variant, align }) {
  const cls = `content-button variant-${variant || 'primary'} align-${align || 'left'}`;
  return (
    <div className={cls}>
      <a href={href || '#'} className="btn-block"
         target={href && href.startsWith('http') ? '_blank' : undefined}
         rel="noopener noreferrer">
        {text || 'Click here'}
      </a>
    </div>
  );
}

function DividerBlock({ style, color }) {
  const dashed = style === 'dashed';
  return <hr className="content-divider"
    style={{ borderTop: `1px ${dashed ? 'dashed' : 'solid'} ${color || 'currentColor'}` }} />;
}

function EmbedBlock({ url, height, title }) {
  if (!url) return null;
  // Convert common URLs to embed format.
  let src = url;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (yt) src = `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) src = `https://player.vimeo.com/video/${vm[1]}`;
  return (
    <div className="content-embed">
      <iframe src={src} title={title || 'embed'} loading="lazy"
              style={{ width: '100%', height: (height || 360) + 'px', border: 0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen />
    </div>
  );
}

function FormBlock({ slug, title, fields, button, successMessage }) {
  const [state, setState] = useState({});
  const [busy, setBusy]   = useState(false);
  const [sent, setSent]   = useState(false);
  const [err, setErr]     = useState('');
  const formFields = Array.isArray(fields) ? fields : [
    { key: 'name',    label: 'Name',    type: 'text',     required: true  },
    { key: 'email',   label: 'Email',   type: 'email',    required: true  },
    { key: 'message', label: 'Message', type: 'textarea', required: true  },
  ];
  function set(k, v) { setState((s) => ({ ...s, [k]: v })); }
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form: slug || 'contact', fields: state }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        throw new Error((j && j.detail) || r.statusText);
      }
      setSent(true); setState({});
    } catch (e) { setErr(e.message || 'Submit failed'); }
    finally { setBusy(false); }
  }
  if (sent) {
    return (
      <section className="content-form sent">
        <p>✓ {successMessage || 'Thank you — your message has been received.'}</p>
      </section>
    );
  }
  return (
    <section className="content-form">
      {title && <h3 className="block-title">{title}</h3>}
      <form onSubmit={submit}>
        {formFields.map((f) => (
          <div className="form-row" key={f.key}>
            <label htmlFor={`f-${f.key}`}>{f.label}{f.required ? ' *' : ''}</label>
            {f.type === 'textarea' ? (
              <textarea id={`f-${f.key}`} required={f.required} value={state[f.key] || ''}
                        onChange={(e) => set(f.key, e.target.value)} rows={5} />
            ) : (
              <input id={`f-${f.key}`} type={f.type || 'text'} required={f.required}
                     value={state[f.key] || ''}
                     onChange={(e) => set(f.key, e.target.value)} />
            )}
          </div>
        ))}
        {err && <p className="form-err">{err}</p>}
        <button type="submit" className="btn-block" disabled={busy}>
          {busy ? 'Sending…' : (button || 'Send')}
        </button>
      </form>
    </section>
  );
}

function ColumnsBlock({ columns, gap, children, blocks, slot, ctx }) {
  // Column children are themselves blocks rendered via BlockRenderer.
  const n = parseInt(columns || 2, 10);
  const items = Array.isArray(blocks) ? blocks : [];
  return (
    <div className="content-columns" style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${n}, 1fr)`,
      gap: (gap || 16) + 'px',
    }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="column">
          {items[i] && <BlockRenderer slot={`${slot}-c${i}`} blocks={[items[i]]} ctx={ctx} />}
        </div>
      ))}
    </div>
  );
}

function BlockRenderer({ slot, blocks, ctx }) {
  const layouts = window.ATLAS_LAYOUTS || {};
  const list = (layouts[slot] && layouts[slot].length) ? layouts[slot] : (blocks || []);

  return (
    <>
      {list.filter((b) => b.visible !== false).map((b) => {
        const wrapAttrs = {
          'data-cms-section': `${slot}:${b.id}`,
          'data-cms-block-type': b.type,
          key: b.id,
        };
        switch (b.type) {
          case 'banner':
            return <div {...wrapAttrs}><window.GreetingBanner /></div>;
          case 'admin-bar':
            return <div {...wrapAttrs} className="admin-slot"><window.AdminToolbar /></div>;
          case 'a11y-panel':
            return <div {...wrapAttrs}><window.AccessibilityPanel /></div>;
          case 'hero':
            return <div {...wrapAttrs}><Hero {...ctx} /></div>;
          case 'page':
            return <div {...wrapAttrs}><PageBlock slug={(b.props || {}).slug || ''} /></div>;
          case 'spacer':
            return <div {...wrapAttrs}><SpacerBlock size={(b.props || {}).size} /></div>;
          case 'html':
            return <div {...wrapAttrs}><HtmlBlock html={(b.props || {}).html} /></div>;
          case 'text':
            return <div {...wrapAttrs}><TextBlock {...(b.props || {})} /></div>;
          case 'heading':
            return <div {...wrapAttrs}><HeadingBlock {...(b.props || {})} /></div>;
          case 'image':
            return <div {...wrapAttrs}><ImageBlock {...(b.props || {})} /></div>;
          case 'button':
            return <div {...wrapAttrs}><ButtonBlock {...(b.props || {})} /></div>;
          case 'divider':
            return <div {...wrapAttrs}><DividerBlock {...(b.props || {})} /></div>;
          case 'embed':
            return <div {...wrapAttrs}><EmbedBlock {...(b.props || {})} /></div>;
          case 'columns':
            return <div {...wrapAttrs}><ColumnsBlock {...(b.props || {})} slot={slot + '-' + b.id} ctx={ctx} /></div>;
          case 'form':
            return <div {...wrapAttrs}><FormBlock {...(b.props || {})} /></div>;
          default:
            return null;
        }
      })}
    </>
  );
}

// Default layouts when the API is unreachable (offline / standalone).
const DEFAULT_HEADER = [
  { id: 'h-banner', type: 'banner',     visible: true },
  { id: 'h-admin',  type: 'admin-bar',  visible: true },
  { id: 'h-a11y',   type: 'a11y-panel', visible: true },
  { id: 'h-hero',   type: 'hero',       visible: true },
];
const DEFAULT_FOOTER = [
  { id: 'f-ack',     type: 'page', visible: true, props: { slug: 'acknowledgement' } },
  { id: 'f-contact', type: 'page', visible: true, props: { slug: 'contact' } },
];

function Hero({ totalCommunities, totalOrgs, grandPop, view, setView, filtered, all }) {
  // Subscribe to live setting updates from the CMS via SSE.
  const [, setTick] = useState(0);
  useEffect(() => {
    function h() { setTick((t) => t + 1); }
    window.addEventListener('atlas:settings', h);
    return () => window.removeEventListener('atlas:settings', h);
  }, []);

  const eyebrowText = getSetting('site.heroEyebrow', 'Mino Bimaadiziwin');
  const heroTitle   = getSetting('site.heroTitle',   'A living atlas of community care.');
  const subLead     = getSetting('site.heroSubtitleLead',  'Find');
  const subTrail    = getSetting('site.heroSubtitleTrail',
    'programming across {communities} First Nations and {partners} partner organizations.')
      .replace('{communities}', totalCommunities)
      .replace('{partners}', totalOrgs);
  const lblCommunities = getSetting('site.statCommunitiesLabel', 'Communities');
  const lblPartners    = getSetting('site.statPartnersLabel',    'Partners');
  const lblPeople      = getSetting('site.statPeopleLabel',      'People');

  return (
    <header className="hero">
      <div className="hero-row">
        <div className="hero-brand">
          <div className="hero-eyebrow">
            <span className="badge" data-cms-bind="setting:site.heroEyebrow" data-cms-inline="1">{eyebrowText}</span>
            <span className="pulse"></span>
            <span>Living atlas · {new Date().toLocaleDateString('en-CA',{month:'short', year:'numeric'})}</span>
          </div>
          <h1 className="hero-title" data-cms-bind="setting:site.heroTitle" data-cms-inline="1">{heroTitle}</h1>
          <p className="hero-sub" data-cms-bind="setting:site.heroSubtitleTrail">
            <span data-cms-bind="setting:site.heroSubtitleLead" data-cms-inline="1">{subLead}</span> <span className="roll"><span>physical health</span><span>mental health</span><span>spiritual support</span><span>emotional support</span></span> {subTrail}
          </p>
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <div className="num"><span className="accent">{totalCommunities}</span></div>
            <div className="label" data-cms-bind="setting:site.statCommunitiesLabel" data-cms-inline="1">{lblCommunities}</div>
          </div>
          <div className="hero-stat">
            <div className="num">{totalOrgs}</div>
            <div className="label" data-cms-bind="setting:site.statPartnersLabel" data-cms-inline="1">{lblPartners}</div>
          </div>
          <div className="hero-stat">
            <div className="num">{Math.round(grandPop/1000)}<span style={{fontSize:22}}>k</span></div>
            <div className="label" data-cms-bind="setting:site.statPeopleLabel" data-cms-inline="1">{lblPeople}</div>
          </div>
        </div>
      </div>
      <NavStrip view={view} setView={setView} filtered={filtered} all={all} />
    </header>
  );
}

function NavStrip({ view, setView, filtered, all }) {
  const [items, setItems] = useState(() => window.ATLAS_NAV || null);
  const [, setTickSettings] = useState(0);
  useEffect(() => {
    function h() { setItems(window.ATLAS_NAV ? [...window.ATLAS_NAV] : null); }
    function s() { setTickSettings((t) => t + 1); }
    window.addEventListener('atlas:nav', h);
    window.addEventListener('atlas:settings', s);
    return () => {
      window.removeEventListener('atlas:nav', h);
      window.removeEventListener('atlas:settings', s);
    };
  }, []);
  // Fallback when backend not reachable
  const DEFAULT_NAV = [
    { view: 'map',       label: 'Map · Search',       icon: '◉' },
    { view: 'list',      label: 'Directory',          icon: '☷' },
    { view: 'story',     label: 'Story Map',          icon: '✦' },
    { view: 'stories',   label: 'Community Stories',  icon: '❋' },
    { view: 'analytics', label: 'Analytics',          icon: '◐' },
    { view: 'stats',     label: 'Insights & Stories', icon: '◭' },
    { view: 'coverage',  label: 'Coverage (85)',      icon: '⌧' },
  ];
  let navItems = items && items.length ? items : DEFAULT_NAV;
  // Honour the site.showXxxView settings — admins can hide views from CMS.
  const settings = window.ATLAS_SETTINGS || {};
  const VIEW_TOGGLES = {
    stories:  'site.showStoriesView',
    stats:    'site.showAnalyticsView',
    coverage: 'site.showCoverageView',
    analytics:'site.showAnalyticsView',
  };
  navItems = navItems.filter((n) => {
    const settingKey = VIEW_TOGGLES[n.view];
    if (!settingKey) return true;
    const v = settings[settingKey];
    return v == null || String(v).trim().toLowerCase() !== 'false';
  });
  // Always offer the Welcome/home tab first — it's the friendly landing page,
  // so it must appear even when the nav comes from the CMS/backend.
  if (!navItems.some((n) => n.view === 'welcome')) {
    navItems = [{ view: 'welcome', label: 'Welcome', icon: '⌂' }, ...navItems];
  }
  return (
    <div className="nav-strip">
      {navItems.map((n) => (
        <button key={n.view}
                className={`nav-tab ${view === n.view ? 'on' : ''}`}
                onClick={() => setView(n.view)}>
          {n.icon ? `${n.icon}  ` : ''}{n.label}
          {n.view === 'map' && filtered != null && <span className="count">{filtered}</span>}
          {n.view === 'list' && all != null && <span className="count">{all}</span>}
        </button>
      ))}
    </div>
  );
}

function FilterRail(props) {
  const { search, setSearch, onPick, regions, setRegions, directions, setDirections, orgTypes, setOrgTypes,
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
      <SmartSearch search={search} setSearch={setSearch} all={all} onPick={onPick} />

      <FilterGroup label="Region (Direction)" onClear={directions.size ? () => setDirections(new Set()) : null}>
        <div className="toggle-row">
          {DIR_KEYS.map(d => {
            const info = window.DIRECTION[d];
            return (
              <label key={d} className={`toggle ${directions.has(d)?'on':''} ${!counts.dirs[d] && !directions.has(d) ? 'dim' : ''}`} onClick={() => toggle(setDirections, directions, d)}>
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
            <button key={p.key} className={`chip ${pillars.has(p.key)?'on':''} ${!counts.pillars[p.key] && !pillars.has(p.key) ? 'dim' : ''}`} onClick={() => toggle(setPillars, pillars, p.key)}>
              <span className="chip-dot" style={{background: p.hex}}></span>
              {p.icon} {p.label.split(' ')[0]}<span className="ct">{counts.pillars[p.key] || 0}</span>
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Population" onClear={popBuckets.size ? () => setPopBuckets(new Set()) : null}>
        <div className="chips">
          {window.POP_BUCKETS.map(b => (
            <button key={b.key} className={`chip ${popBuckets.has(b.key)?'on':''} ${!counts.pops[b.key] && !popBuckets.has(b.key) ? 'dim' : ''}`} onClick={() => toggle(setPopBuckets, popBuckets, b.key)}>
              {b.label}<span className="ct">{counts.pops[b.key] || 0}</span>
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Sub-region" onClear={regions.size ? () => setRegions(new Set()) : null}>
        <div className="chips">
          {REGION_KEYS.map(r => (
            <button key={r} className={`chip ${regions.has(r)?'on':''} ${!counts.regions[r] && !regions.has(r) ? 'dim' : ''}`} onClick={() => toggle(setRegions, regions, r)}>
              {r}<span className="ct">{counts.regions[r] || 0}</span>
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Organization type" onClear={orgTypes.size ? () => setOrgTypes(new Set()) : null}>
        <div className="toggle-row">
          {(window.ORG_TYPES || []).map(o => (
            <label key={o} className={`toggle ${orgTypes.has(o)?'on':''} ${!counts.orgs[o] && !orgTypes.has(o) ? 'dim' : ''}`} onClick={() => toggle(setOrgTypes, orgTypes, o)}>
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

      <ContributeCard />
    </aside>
  );
}

// ---------------------------------------------------------------------------
// SmartSearch — typo-tolerant search box with a Google-style autocomplete
// dropdown, a "Did you mean …?" correction line, and (where the browser
// supports it) voice search so Elders can simply speak a community's name.
// ---------------------------------------------------------------------------
function SmartSearch({ search, setSearch, all, onPick }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const [listening, setListening] = useState(false);
  const boxRef = React.useRef(null);
  const q = search.trim();

  const { list, didYouMean } = useMemo(
    () => (window.searchSuggest ? window.searchSuggest(q, all, 8) : { list: [], didYouMean: null }),
    [q, all]
  );
  const showDrop = open && q.length >= 2 && list.length > 0;

  useEffect(() => {
    function onDoc(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function choose(c) {
    setSearch(c.name.trim());   // narrows the list to the picked community…
    if (onPick) onPick(c.id);   // …and opens its profile, like clicking a result
    setOpen(false);
    setHi(-1);
  }

  function onKey(e) {
    if (!showDrop) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, list.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, -1)); }
    else if (e.key === 'Enter') { if (hi >= 0 && list[hi]) { e.preventDefault(); choose(list[hi].c); } }
    else if (e.key === 'Escape') { setOpen(false); setHi(-1); }
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function startVoice() {
    if (!SR) return;
    let rec;
    try { rec = new SR(); } catch (e) { return; }
    rec.lang = 'en-CA'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (ev) => {
      const t = (ev.results[0][0].transcript || '').replace(/[.。\s]+$/, '').trim();
      if (t) { setSearch(t); setOpen(true); setHi(-1); }
    };
    try { rec.start(); } catch (e) { setListening(false); }
  }

  return (
    <div className="search-box smart-search" ref={boxRef}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-5-5" />
      </svg>
      <input
        type="text"
        placeholder="Search communities, services, contacts…"
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); setHi(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        role="combobox"
        aria-expanded={showDrop}
        aria-autocomplete="list"
      />
      {SR && (
        <button
          className={`voice-btn ${listening ? 'on' : ''}`}
          onClick={startVoice}
          title="Search by voice"
          aria-label="Search by voice"
        >{listening ? '● listening' : '🎤'}</button>
      )}
      {search && <button className="search-clear" onClick={() => { setSearch(''); setOpen(false); }}>✕</button>}

      {showDrop && (
        <div className="search-drop" role="listbox">
          {didYouMean && (
            <button className="did-you-mean" onClick={() => choose(didYouMean)}>
              Did you mean <strong>{didYouMean.name.trim()}</strong>?
            </button>
          )}
          {list.map((s, i) => (
            <button
              key={s.c.id}
              role="option"
              aria-selected={hi === i}
              className={`sugg ${hi === i ? 'hi' : ''}`}
              onMouseEnter={() => setHi(i)}
              onClick={() => choose(s.c)}
            >
              <span className="sugg-name">{window.highlight(s.c.name.trim(), q)}</span>
              <span className="sugg-meta">
                {s.c.orgType || 'Community'}{s.c.regionGroup ? ' · ' + s.c.regionGroup : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContributeCard — a quiet, Anishinaabe-styled button that opens a public
// correction form. The raw Google Forms URL is hidden behind the button; a
// clear disclaimer makes it plain that anything submitted becomes public.
// ---------------------------------------------------------------------------
function ContributeCard() {
  const [openNote, setOpenNote] = useState(false);
  const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScD4F_ea0sln3A9jrcmTh9G6KFl1cdTCzNscWxQeUNR5myKEQ/viewform';
  return (
    <div className="contribute">
      <button
        className={`contribute-btn ${openNote ? 'open' : ''}`}
        onClick={() => setOpenNote(v => !v)}
        aria-expanded={openNote}
      >
        <span className="contribute-medallion" aria-hidden="true">
          <span className="q-east"></span><span className="q-south"></span>
          <span className="q-west"></span><span className="q-north"></span>
        </span>
        <span className="contribute-label">Share a correction</span>
      </button>
      {openNote && (
        <div className="contribute-note">
          <p>
            Everything in this atlas is <strong>public information</strong>, gathered
            from published community and organization sources.
          </p>
          <p>
            If you'd like to offer a correction or addition, please know that
            <strong> anything you share may be shown publicly here</strong>. Miigwech —
            but please don't submit anything you'd rather keep private.
          </p>
          <a className="contribute-go" href={FORM_URL} target="_blank" rel="noopener noreferrer">
            Open the correction form ↗
          </a>
        </div>
      )}
    </div>
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
