/* global React */
/*
 * State-of-the-art Analytics view for the public dashboard.
 *
 * Eight panels driven entirely by the live master sheet (via the FastAPI
 * /api/analytics/* endpoints). All animations are pure SVG/CSS — no chart
 * library. Plain-English language so an elder reading this immediately
 * understands what the numbers mean.
 *
 *   1. Hero KPI strip          (animated count-up counters)
 *   2. Storytelling cards      (rotating plain-language facts)
 *   3. Sacred Direction Clock  (medicine-wheel ring with live counts)
 *   4. Pillar coverage gauges  (animated radial rings per pillar)
 *   5. Coverage heat-map       (direction × pillar grid)
 *   6. Service overlap finder  (TF-IDF duplicate detection)
 *   7. Region comparison       (side-by-side bars)
 *   8. Ask-the-atlas chatbot   (free TF-IDF retrieval; no paid AI)
 */

const { useState: useStateAP, useEffect: useEffectAP,
        useMemo: useMemoAP, useRef: useRefAP,
        useCallback: useCallbackAP } = React;


// ---------- generic animated count-up hook ----------
function useCountTo(target, durationMs = 900) {
  const [v, setV] = useStateAP(0);
  const startRef = useRefAP(null);
  const fromRef  = useRefAP(0);
  useEffectAP(() => {
    fromRef.current = v;
    startRef.current = null;
    let raf;
    function tick(t) {
      if (startRef.current == null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);  // easeOutCubic
      setV(Math.round(fromRef.current + (target - fromRef.current) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => raf && cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return v;
}


function AnalyticsProView({ all, onSelect, setView }) {
  // Analytics-wide filters: every panel honors these.
  const [filters, setFilters] = useStateAP({
    dir: 'all', type: 'all', pop: 'all', pillars: new Set(),
  });
  const [report, setReport]       = useStateAP(null);
  const [duplicates, setDup]      = useStateAP(null);
  const [comparison, setComp]     = useStateAP(null);
  const [facts, setFacts]         = useStateAP(null);
  const [loading, setLoading]     = useStateAP(true);
  const [presentMode, setPresent] = useStateAP(false);
  const [spotlightName, setSpotName] = useStateAP(null);
  const [compareNames, setCompareNames] = useStateAP({ a: '', b: '' });
  const [gapsTarget, setGapsTarget] = useStateAP('');

  // Apply filters to the in-memory community list so KPIs/charts react.
  const filteredAll = useMemoAP(() => {
    if (!Array.isArray(all)) return [];
    return all.filter((c) => {
      if (filters.dir !== 'all' && c.direction !== filters.dir) return false;
      if (filters.type !== 'all' && c.orgType !== filters.type) return false;
      if (filters.pop !== 'all') {
        const b = window.popBucket && window.popBucket(c.population);
        if (b !== filters.pop) return false;
      }
      if (filters.pillars.size > 0) {
        for (const p of filters.pillars) {
          if (!c['has' + p[0].toUpperCase() + p.slice(1)]) return false;
        }
      }
      return true;
    });
  }, [all, filters]);

  // Pull every analytic in parallel so the dashboard paints fast.
  useEffectAP(() => {
    let alive = true;
    async function load() {
      const get = (p) => fetch(p).then((r) => r.ok ? r.json() : null).catch(() => null);
      const [f, d, c, fa] = await Promise.all([
        get('/api/analytics/full'),
        get('/api/analytics/duplicates?min_similarity=0.55'),
        get('/api/analytics/compare'),
        get('/api/analytics/facts'),
      ]);
      if (!alive) return;
      setReport(f); setDup(d); setComp(c); setFacts(fa); setLoading(false);
    }
    load();
    function refresh() { load(); }
    window.addEventListener('atlas:dataset', refresh);
    return () => { alive = false; window.removeEventListener('atlas:dataset', refresh); };
  }, []);

  if (loading) {
    return (
      <section className="ap-shell">
        <header className="ap-hero">
          <div className="ap-hero-text">
            <p className="ap-eyebrow">Live analytics</p>
            <h2 className="ap-title">Reading the master sheet…</h2>
            <p className="ap-sub">Computing duplicate detection, coverage, and the medicine-wheel clock.</p>
          </div>
        </header>
      </section>
    );
  }

  const ov = (report && report.overview) || {};
  const cov = (report && report.coverageMatrix) || { matrix: {}, directions: [], pillars: [] };
  const kw  = (report && report.keywords && report.keywords.perPillar) || {};
  const cl  = (report && report.clusters) || { clusters: [] };

  return (
    <section className="ap-shell">

      {/* ────────── Hero with animated KPI counters ────────── */}
      <header className="ap-hero">
        <div className="ap-hero-text">
          <p className="ap-eyebrow">Live · powered by the master sheet</p>
          <h2 className="ap-title">What does the data tell us?</h2>
          <p className="ap-sub">
            Every number below is computed live from the team's master sheet.
            Use the filter bar to focus the whole page on one region, org type,
            population size, or pillar.
          </p>
          <div className="ap-hero-actions">
            <button className="ap-cta" onClick={() => setPresent(true)}>
              ▶ Open presentation mode
            </button>
            <button className="ap-cta ghost" onClick={() => {
              window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }}>
              💬 Ask the atlas
            </button>
          </div>
        </div>
        <div className="ap-kpi-strip">
          <KPI value={(filteredAll && filteredAll.length) || ov.total} label="Communities shown"
               sub={filteredAll.length !== (ov.total || 0) ? `filtered from ${ov.total}` : 'in the atlas'} />
          <KPI value={filteredAll.filter(c => c.hasPhysical && c.hasMental && c.hasSpiritual && c.hasEmotional).length}
               label="All 4 pillars" sub="physical + mental + spiritual + emotional" accent="south" />
          <KPI value={filteredAll.reduce((s, c) => s + (c.population || 0), 0)} label="People served"
               sub="in the current filter" big />
          <KPI value={Math.round((ov.completenessScore || 0) * 100)} suffix="%"
               label="Avg completeness" sub="fields filled per record" accent="east" />
        </div>
      </header>

      {/* ────────── Filter bar (sticky) ────────── */}
      <AnalyticsFilters all={all} filters={filters} setFilters={setFilters}
                        filteredCount={filteredAll.length} totalCount={(all || []).length} />

      {/* ────────── Storytelling carousel ────────── */}
      {facts && facts.facts && <StoryCarousel facts={facts.facts} />}

      {/* ────────── Honest data-quality panel ────────── */}
      <Panel title="Gap tracker — the tracking tabs, as live analytics"
             sub="Every row on the workbook's 'Missing Information', 'Needs Review', and 'Correction sheet' tabs becomes data here: which fields are open, where on the territory, how the work is trending month by month, and which communities to reach out to next. Open fields show as 'will be updated soon' across the atlas.">
        <DataQualityPanel all={all} onPick={(id) => onSelect && onSelect(id)} />
      </Panel>

      {/* ────────── Spotlight + Gap Analyzer ────────── */}
      <div className="ap-row two-col">
        <Panel title="Community spotlight"
               sub="Pick any community to see a deep dive — every documented field, pillar by pillar, plus what's still missing on file.">
          <CommunitySpotlight all={all} value={spotlightName} onChange={setSpotName} onPick={(n) => {
            const hit = (all || []).find((c) => c.name === n);
            if (hit && onSelect) onSelect(hit.id);
          }} />
        </Panel>
        <Panel title="Service gap analyzer"
               sub="Compares a community against the 5 most similar ones in the sheet (by service narrative). Surfaces concrete programs the peers have but this one doesn't.">
          <ServiceGapAnalyzer all={all} value={gapsTarget} onChange={setGapsTarget} onPick={(n) => {
            const hit = (all || []).find((c) => c.name === n);
            if (hit && onSelect) onSelect(hit.id);
          }} />
        </Panel>
      </div>

      {/* ────────── Direction clock + pillar gauges ────────── */}
      <div className="ap-row two-col">
        <Panel title="Sacred Direction Clock"
               sub="The medicine wheel turns through every community in the atlas. Each spoke is a direction; the longer the spoke, the more communities documented in that direction.">
          <DirectionClock byDirection={ov.byDirection || {}} />
        </Panel>
        <Panel title="Pillar coverage at a glance"
               sub="A ring for each of the four service pillars, counting First Nations communities only (partner organizations are excluded so the numbers stay honest). A pillar counts only when real program text is on file.">
          <PillarRings overview={ov} all={filteredAll} />
        </Panel>
      </div>

      {/* ────────── Coverage matrix ────────── */}
      <Panel title="Coverage map — direction × pillar"
             sub="Reads left to right by direction, top to bottom by pillar. Darker means stronger documented coverage. White cells are blind spots worth investigating.">
        <CoverageMatrix matrix={cov.matrix} directions={cov.directions} pillars={cov.pillars} />
      </Panel>

      {/* ────────── Duplicate / overlap finder ────────── */}
      <Panel title="Service overlaps the team should know about"
             sub="When two communities describe a service in very similar words, it's worth checking — they may share a partner, copy from the same source, or could collaborate. The list below is automatic and based only on the sheet's own wording.">
        <DuplicatePanel duplicates={duplicates} />
      </Panel>

      {/* ────────── Compare any two communities ────────── */}
      <Panel title="Compare two communities, side by side"
             sub="Pick any two communities from the list. The table fills in instantly with each pillar, optional fields (AGM, strategic plan, financials), staff count, and a green/red dot for whether the row is documented. Useful for peer-learning, story-telling, and gap analysis.">
        <CompareTwo all={all} value={compareNames} onChange={setCompareNames} />
      </Panel>

      {/* ────────── Region comparison ────────── */}
      <Panel title="Side-by-side direction comparison"
             sub="How many communities, how many people, and how thoroughly each pillar is covered — direction by direction. Long bar means well-documented.">
        <RegionCompare comparison={comparison} />
      </Panel>

      {/* ────────── Keywords + clusters ────────── */}
      <div className="ap-row two-col">
        <Panel title="What words show up in each pillar?"
               sub="TF-IDF surfaces the terms that distinguish each pillar's narrative. Bigger = the word appears more often in that pillar than the others.">
          <KeywordCloud byPillar={kw} />
        </Panel>
        <Panel title="Communities grouped by service profile"
               sub="An unsupervised algorithm (K-means) groups communities with similar service mixes. Use this to find peer communities for collaboration.">
          <ClusterPanel clusters={cl.clusters || []} onPick={(name) => {
            const hit = (all || []).find((c) => c.name === name);
            if (hit && onSelect) onSelect(hit.id);
          }} />
        </Panel>
      </div>

      {/* ────────── Ask the atlas ────────── */}
      <Panel title="Ask the atlas"
             sub="Type a plain-English question — 'who supports survivors?' or 'diabetes programs' — and the atlas finds the most relevant community records. It only answers from the sheet, never makes things up, and always cites where the answer comes from.">
        <AskTheAtlas onPick={(name) => {
          const hit = (all || []).find((c) => c.name === name);
          if (hit && onSelect) onSelect(hit.id);
        }} />
      </Panel>

      <p className="ap-footer-note">
        All numbers and snippets above are computed live from the most-recent master sheet.
        When the team uploads a new version through the CMS, this page refreshes automatically.
      </p>

      {presentMode && window.AGMPresentation && (
        <window.AGMPresentation all={all} view="analytics" onClose={() => setPresent(false)} />
      )}
    </section>
  );
}
window.AnalyticsProView = AnalyticsProView;


// ============== components =============================================

// ---- GAP TRACKER — full analytics over the workbook's own tracking tabs ----
// Missing Information / Needs Review / Correction sheet rows, matched to
// their communities, become first-class analytics: by field, by direction,
// over time, by status, and per community.

function gapItemLabel(item) {
  const s = String(item || '').toLowerCase();
  if (/agm|annual general/.test(s)) return 'AGM / Annual report';
  if (/strategic/.test(s)) return 'Strategic plan';
  if (/financ/.test(s)) return 'Financial statements';
  if (/physical/.test(s)) return 'Physical health';
  if (/mental/.test(s)) return 'Mental health';
  if (/spiritual/.test(s)) return 'Spiritual support';
  if (/emotional/.test(s)) return 'Emotional support';
  if (/connect/.test(s)) return 'Connect survivors ↔ youth';
  if (/survivor/.test(s)) return 'Survivor support';
  if (/youth/.test(s)) return 'Youth support';
  if (/population/.test(s)) return 'Population';
  if (/contact/.test(s)) return 'Contact information';
  if (/additional link/.test(s)) return 'Additional links';
  if (/link|website/.test(s)) return 'Website link';
  return 'Other fields';
}

function gapStatusLabel(status) {
  const s = String(status || '').toLowerCase().trim();
  if (!s) return null;
  if (/not found/.test(s)) return 'Not found yet';
  if (/partial/.test(s)) return 'Partially found';
  if (/old/.test(s)) return 'Outdated version found';
  return 'Other';
}

const GAP_KIND_META = {
  missing:    { label: 'Being gathered',     color: '#a87f12', soft: 'rgba(212,160,23,.16)' },
  review:     { label: 'Under review',       color: '#3a5d8c', soft: 'rgba(58,93,140,.14)' },
  correction: { label: 'Corrections applied', color: '#3d6b40', soft: 'rgba(107,141,107,.16)' },
};

function useGapData(all) {
  return useMemoAP(() => {
    const comms = (all || []).filter((c) => c.orgType === 'Community');
    const rows = [];
    comms.forEach((c) => (c.annotations || []).forEach((a) => rows.push({ ...a, c })));

    // by canonical field, per kind
    const byField = {};
    rows.forEach((r) => {
      const f = gapItemLabel(r.item);
      byField[f] = byField[f] || { field: f, missing: 0, review: 0, correction: 0 };
      byField[f][r.kind] = (byField[f][r.kind] || 0) + 1;
    });
    const fields = Object.values(byField);
    const fieldsOpen = [...fields].sort((a, b) => (b.missing + b.review) - (a.missing + a.review))
      .filter((f) => f.missing + f.review > 0);
    const fieldsFixed = [...fields].sort((a, b) => b.correction - a.correction)
      .filter((f) => f.correction > 0).slice(0, 8);

    // by direction
    const byDir = {};
    ['East', 'South', 'West', 'North'].forEach((d) => { byDir[d] = { dir: d, missing: 0, review: 0, correction: 0, comms: 0 }; });
    comms.forEach((c) => {
      const d = byDir[c.direction]; if (!d) return;
      d.comms += 1;
      d.missing += c.missingCount || 0;
      d.review += c.reviewCount || 0;
      d.correction += c.correctionCount || 0;
    });

    // by month, per kind
    const byMonth = {};
    rows.forEach((r) => {
      const m = String(r.date || '').slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(m)) return;
      byMonth[m] = byMonth[m] || { month: m, missing: 0, review: 0, correction: 0 };
      byMonth[m][r.kind] += 1;
    });
    const months = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)).slice(-8);

    // status mix for open items
    const statuses = {};
    rows.filter((r) => r.kind !== 'correction').forEach((r) => {
      const s = gapStatusLabel(r.status); if (!s) return;
      statuses[s] = (statuses[s] || 0) + 1;
    });

    // per community
    const perCommunity = comms
      .map((c) => ({ c, missing: c.missingCount || 0, review: c.reviewCount || 0,
                     correction: c.correctionCount || 0, open: (c.missingCount || 0) + (c.reviewCount || 0) }))
      .sort((a, b) => b.open - a.open || b.correction - a.correction);

    const totals = {
      missing: comms.reduce((s, c) => s + (c.missingCount || 0), 0),
      review: comms.reduce((s, c) => s + (c.reviewCount || 0), 0),
      correction: comms.reduce((s, c) => s + (c.correctionCount || 0), 0),
      clean: comms.filter((c) => !(c.missingCount || 0) && !(c.reviewCount || 0)).length,
      comms: comms.length,
    };
    return { fieldsOpen, fieldsFixed, byDir, months, statuses, perCommunity, totals };
  }, [all]);
}

function DataQualityPanel({ all, onPick }) {
  const g = useGapData(all);
  const [tableQ, setTableQ] = useStateAP('');
  const [showAll, setShowAll] = useStateAP(false);
  const t = g.totals;
  const resolved = t.correction + t.missing + t.review > 0
    ? Math.round(t.correction / (t.correction + t.missing + t.review) * 100) : 0;

  const tableRows = g.perCommunity.filter(({ c }) =>
    !tableQ || c.name.toLowerCase().includes(tableQ.toLowerCase()));
  const visibleRows = showAll ? tableRows : tableRows.slice(0, 12);

  return (
    <div className="dq-wrap">
      {/* KPI strip */}
      <div className="dq-stats">
        <div className="dq-stat">
          <div className="dq-num" style={{ color: '#a87f12' }}>{t.missing}</div>
          <div className="dq-lab">fields being gathered</div>
          <div className="dq-sub">not publicly available yet — will be updated soon</div>
        </div>
        <div className="dq-stat">
          <div className="dq-num" style={{ color: '#3a5d8c' }}>{t.review}</div>
          <div className="dq-lab">fields under review</div>
          <div className="dq-sub">found, but being verified before publishing</div>
        </div>
        <div className="dq-stat">
          <div className="dq-num" style={{ color: '#3d6b40' }}>{t.correction}</div>
          <div className="dq-lab">corrections applied</div>
          <div className="dq-sub">fields already improved by the team's review</div>
        </div>
        <div className="dq-stat">
          <div className="dq-num">{resolved}<span style={{ fontSize: 20 }}>%</span></div>
          <div className="dq-lab">of all tracked items resolved</div>
          <div className="dq-sub">{t.clean} of {t.comms} communities have no open flags</div>
        </div>
      </div>

      {/* WHICH FIELDS are open */}
      <div className="gap-block">
        <div className="gap-block-title">Which fields are still open — by type</div>
        <div className="gap-block-sub">Amber = information being gathered · blue = found but under review. Straight from the workbook's tracking tabs.</div>
        <div className="gap-bars">
          {g.fieldsOpen.map((f) => {
            const max = Math.max(1, ...g.fieldsOpen.map((x) => x.missing + x.review));
            return (
              <div key={f.field} className="gap-bar-row">
                <span className="gap-bar-lab">{f.field}</span>
                <div className="gap-bar-track">
                  {f.missing > 0 && <div className="gap-bar-seg" style={{ width: `${f.missing / max * 100}%`, background: GAP_KIND_META.missing.color }} title={`${f.missing} being gathered`}></div>}
                  {f.review > 0 && <div className="gap-bar-seg" style={{ width: `${f.review / max * 100}%`, background: GAP_KIND_META.review.color }} title={`${f.review} under review`}></div>}
                </div>
                <span className="gap-bar-num">{f.missing + f.review}</span>
              </div>
            );
          })}
          {!g.fieldsOpen.length && <p className="ap-empty">No open items — the sheet is fully confirmed. 🎉</p>}
        </div>
      </div>

      <div className="gap-two">
        {/* WORK DONE: corrections by field */}
        <div className="gap-block">
          <div className="gap-block-title">Where the team has already fixed the most</div>
          <div className="gap-block-sub">Corrections applied per field — proof the sheet is alive.</div>
          <div className="gap-bars">
            {g.fieldsFixed.map((f) => {
              const max = Math.max(1, ...g.fieldsFixed.map((x) => x.correction));
              return (
                <div key={f.field} className="gap-bar-row">
                  <span className="gap-bar-lab">{f.field}</span>
                  <div className="gap-bar-track">
                    <div className="gap-bar-seg" style={{ width: `${f.correction / max * 100}%`, background: GAP_KIND_META.correction.color }}></div>
                  </div>
                  <span className="gap-bar-num">{f.correction}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* BY DIRECTION */}
        <div className="gap-block">
          <div className="gap-block-title">Open items by direction</div>
          <div className="gap-block-sub">Where outreach effort is most needed on the territory.</div>
          <div className="gap-dirs">
            {Object.values(g.byDir).map((d) => {
              const open = d.missing + d.review;
              const max = Math.max(1, ...Object.values(g.byDir).map((x) => x.missing + x.review));
              const dirColor = { East: '#d4a017', South: '#b8351e', West: '#3a4658', North: '#8a7c66' }[d.dir];
              return (
                <div key={d.dir} className="gap-dir">
                  <div className="gap-dir-track">
                    <div className="gap-dir-fill" style={{ height: `${open / max * 100}%`, background: dirColor }}></div>
                  </div>
                  <div className="gap-dir-num">{open}</div>
                  <div className="gap-dir-lab">{d.dir}</div>
                  <div className="gap-dir-sub">{d.comms} comm.</div>
                </div>
              );
            })}
          </div>
          {Object.keys(g.statuses).length > 0 && (
            <div className="gap-status-mix">
              {Object.entries(g.statuses).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
                <span key={s} className="gap-status-chip">{s} <strong>{n}</strong></span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ACTIVITY OVER TIME */}
      {g.months.length > 1 && (
        <div className="gap-block">
          <div className="gap-block-title">Tracking activity over time</div>
          <div className="gap-block-sub">Each row has its own scale — what matters is the shape: gathering and review items logged, and corrections flowing in.</div>
          <div className="gap-timeline">
            {['missing', 'review', 'correction'].map((kind) => {
              const meta = GAP_KIND_META[kind];
              const max = Math.max(1, ...g.months.map((m) => m[kind]));
              return (
                <div key={kind} className="gap-tl-row">
                  <span className="gap-tl-lab" style={{ color: meta.color }}>{meta.label}</span>
                  <div className="gap-tl-cells">
                    {g.months.map((m) => (
                      <div key={m.month} className="gap-tl-cell" title={`${m.month}: ${m[kind]}`}>
                        <div className="gap-tl-bar" style={{ height: `${Math.max(4, m[kind] / max * 100)}%`, background: meta.color, opacity: m[kind] ? 1 : .15 }}></div>
                        <span className="gap-tl-n">{m[kind] || ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="gap-tl-months">
              <span className="gap-tl-lab"></span>
              <div className="gap-tl-cells">
                {g.months.map((m) => <span key={m.month} className="gap-tl-month">{m.month.slice(2).replace('-', '/')}</span>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PER-COMMUNITY TABLE */}
      <div className="gap-block">
        <div className="gap-block-title">Every community, every open item</div>
        <div className="gap-block-sub">Sorted by open items — the top of this list is the outreach to-do list. Click a row to open the record.</div>
        <input className="gap-table-search" type="text" placeholder="Find a community…"
               value={tableQ} onChange={(e) => setTableQ(e.target.value)} />
        <div className="gap-table">
          <div className="gap-tr gap-th">
            <span>Community</span><span>Gathering</span><span>Review</span><span>Fixed</span><span>Documented</span>
          </div>
          {visibleRows.map(({ c, missing, review, correction }) => (
            <button key={c.id} className="gap-tr" onClick={() => onPick(c.id)}>
              <span className="gap-td-name">{c.name.trim().split('(')[0].trim()}</span>
              <span className="gap-td-n" style={missing ? { color: '#a87f12', fontWeight: 700 } : { opacity: .35 }}>{missing}</span>
              <span className="gap-td-n" style={review ? { color: '#3a5d8c', fontWeight: 700 } : { opacity: .35 }}>{review}</span>
              <span className="gap-td-n" style={correction ? { color: '#3d6b40' } : { opacity: .35 }}>{correction}</span>
              <span className="gap-td-bar"><span style={{ width: `${Math.round((c.completeness || 0) * 100)}%` }}></span></span>
            </button>
          ))}
        </div>
        {tableRows.length > 12 && (
          <button className="gap-table-more" onClick={() => setShowAll((s) => !s)}>
            {showAll ? '— Show fewer' : `+ Show all ${tableRows.length} communities`}
          </button>
        )}
      </div>

      <p className="dq-note">
        How this is computed: every row on the workbook's “Missing Information”, “Needs Review”,
        and “Correction sheet” tabs is matched to its community by name, classified by field type
        and date, and counted live. Nothing here is estimated.
      </p>
    </div>
  );
}


function KPI({ value, suffix, label, sub, accent, big }) {
  const animated = useCountTo(Number.isFinite(value) ? value : 0);
  return (
    <div className={`ap-kpi${accent ? ' accent-' + accent : ''}${big ? ' big' : ''}`}>
      <div className="ap-kpi-num">
        {animated.toLocaleString()}{suffix || ''}
      </div>
      <div className="ap-kpi-label">{label}</div>
      <div className="ap-kpi-sub">{sub}</div>
    </div>
  );
}

function Panel({ title, sub, children }) {
  return (
    <section className="ap-panel">
      <h3 className="ap-panel-title">{title}</h3>
      {sub && <p className="ap-panel-sub">{sub}</p>}
      <div className="ap-panel-body">{children}</div>
    </section>
  );
}

function StoryCarousel({ facts }) {
  const [i, setI] = useStateAP(0);
  useEffectAP(() => {
    const t = setInterval(() => setI((p) => (p + 1) % facts.length), 5500);
    return () => clearInterval(t);
  }, [facts.length]);
  if (!facts.length) return null;
  const f = facts[i];
  return (
    <div className="ap-story">
      <span className="ap-story-kicker">{f.kicker}</span>
      <span key={i} className="ap-story-text">{f.fact}</span>
      <span className="ap-story-dots">
        {facts.map((_, j) => <span key={j} className={j === i ? 'on' : ''} />)}
      </span>
    </div>
  );
}

function DirectionClock({ byDirection }) {
  const order = ['East', 'South', 'West', 'North', 'Central'];
  const colors = { East: '#d4a017', South: '#b8351e', West: '#1a1612', North: '#cabd9c', Central: '#6b8d6b' };
  const entries = order.map((d) => ({ d, n: Number(byDirection[d] || 0) }))
                       .filter((x) => x.n > 0);
  const total = entries.reduce((s, x) => s + x.n, 0) || 1;
  const max = Math.max(...entries.map((x) => x.n), 1);

  // 5 spokes at 72° each, longest = 130px from centre.
  const cx = 150, cy = 150;
  return (
    <div className="ap-clock-wrap">
      <svg viewBox="0 0 300 300" className="ap-clock">
        <defs>
          <radialGradient id="apClockBg">
            <stop offset="0%"  stopColor="rgba(0,0,0,0.04)" />
            <stop offset="80%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r="135" fill="url(#apClockBg)" />
        {/* rings */}
        {[40, 80, 120].map((r) => (
          <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeDasharray="2 4" />
        ))}
        {entries.map((x, i) => {
          const angle = (i / entries.length) * Math.PI * 2 - Math.PI / 2;
          const len = 30 + (x.n / max) * 100;
          const x2 = cx + Math.cos(angle) * len;
          const y2 = cy + Math.sin(angle) * len;
          return (
            <g key={x.d}>
              <line x1={cx} y1={cy} x2={x2} y2={y2}
                    stroke={colors[x.d] || '#5a4f40'} strokeWidth="14" strokeLinecap="round"
                    style={{ transformOrigin: `${cx}px ${cy}px`, animation: `ap-clock-grow 900ms ${i * 80}ms ease both` }} />
              <circle cx={x2} cy={y2} r="22" fill={colors[x.d] || '#5a4f40'} />
              <text x={x2} y={y2 + 4} textAnchor="middle" fontSize="16" fontWeight="700" fill="#fff">{x.n}</text>
              <text x={cx + Math.cos(angle) * (len + 36)}
                    y={cy + Math.sin(angle) * (len + 36) + 4}
                    textAnchor="middle" fontSize="11"
                    fontFamily="JetBrains Mono, monospace" fill="var(--ink-2)">
                {x.d.toUpperCase()}
              </text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r="28" fill="var(--paper)" stroke="rgba(0,0,0,0.1)" />
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--ink)">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="8"
              fontFamily="JetBrains Mono, monospace" fill="var(--ink-3)" letterSpacing="0.05em">TOTAL</text>
      </svg>
    </div>
  );
}

function PillarRings({ overview, all }) {
  const pillars = [
    { k: 'physical',  label: 'Physical',  color: '#b8351e' },
    { k: 'mental',    label: 'Mental',    color: '#1a1612' },
    { k: 'spiritual', label: 'Spiritual', color: '#d4a017' },
    { k: 'emotional', label: 'Emotional', color: '#6b8d6b' },
  ];
  // Count COMMUNITIES only — partner organizations would inflate these rings.
  const comms = Array.isArray(all) ? all.filter((c) => c.orgType === 'Community') : [];
  const useLocal = comms.length > 0;
  const total = useLocal ? comms.length : (overview.total || 1);
  return (
    <div className="ap-rings">
      {pillars.map((p) => {
        const n = useLocal
          ? comms.filter((c) => c['has' + p.k[0].toUpperCase() + p.k.slice(1)]).length
          : ((overview.pillarsCovered && overview.pillarsCovered[p.k]) || 0);
        const pct = n / total;
        return <Ring key={p.k} pct={pct} count={n} of={total} label={p.label} color={p.color} />;
      })}
    </div>
  );
}

function Ring({ pct, count, of, label, color }) {
  const animated = useCountTo(count);
  const r = 36, c = 2 * Math.PI * r;
  return (
    <div className="ap-ring">
      <svg viewBox="0 0 100 100" width="100" height="100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9"
                strokeLinecap="round" transform="rotate(-90 50 50)"
                style={{
                  strokeDasharray: `${c}`,
                  strokeDashoffset: `${c * (1 - pct)}`,
                  transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)',
                }} />
        <text x="50" y="56" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--ink)">{animated}</text>
      </svg>
      <div className="ap-ring-label" style={{ color }}>{label}</div>
      <div className="ap-ring-of">{Math.round(pct * 100)}% of {of}</div>
    </div>
  );
}

function CoverageMatrix({ matrix, directions, pillars }) {
  if (!directions || !directions.length) return <p className="ap-empty">No data.</p>;
  return (
    <div className="ap-cov-wrap">
      <table className="ap-cov">
        <thead>
          <tr><th></th>{pillars.map((p) => <th key={p}>{p}</th>)}</tr>
        </thead>
        <tbody>
          {directions.map((d) => (
            <tr key={d}>
              <th>{d}</th>
              {pillars.map((p) => {
                const v = (matrix[d] || {})[p] || 0;
                return (
                  <td key={p} style={{
                    background: `rgba(184,53,30,${0.08 + v * 0.7})`,
                    color: v > 0.55 ? 'white' : 'inherit',
                  }}>
                    <strong>{Math.round(v * 100)}%</strong>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DuplicatePanel({ duplicates }) {
  const [pillar, setPillar] = useStateAP('survivors');
  if (!duplicates) return <p className="ap-empty">Loading…</p>;
  const totals = duplicates.summary || {};
  const list = (duplicates.perPillar || {})[pillar] || [];
  return (
    <div>
      <div className="ap-dup-tabs">
        {Object.entries(duplicates.perPillar || {}).map(([k, v]) => (
          <button key={k} className={`ap-pill${pillar === k ? ' on' : ''}`}
                  onClick={() => setPillar(k)}>
            {k} <span className="ap-pill-n">{v.length}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="ap-empty">No service overlaps detected for this pillar at the current similarity threshold.</p>
      ) : (
        <ul className="ap-dup-list">
          {list.slice(0, 8).map((p, i) => (
            <li key={i}>
              <div className="ap-dup-bar" style={{ width: (p.similarity * 100) + '%' }} />
              <div className="ap-dup-meta">
                <span className="ap-dup-score">{Math.round(p.similarity * 100)}%</span>
                <span className="ap-dup-pair">
                  <strong>{p.communityA}</strong>
                  <span className="muted"> · {p.directionA || '—'}</span>
                  <span className="ap-dup-vs">↔</span>
                  <strong>{p.communityB}</strong>
                  <span className="muted"> · {p.directionB || '—'}</span>
                </span>
              </div>
              <details>
                <summary>Read both snippets</summary>
                <div className="ap-dup-snip">
                  <p><strong>{p.communityA}:</strong> {p.snippetA}</p>
                  <p><strong>{p.communityB}:</strong> {p.snippetB}</p>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      <p className="ap-fine">
        Total similar pairs detected: <strong>{totals.totalPairs || 0}</strong> · cross-direction overlaps:
        <strong> {totals.crossDirection || 0}</strong>. Higher % means more identical wording.
      </p>
    </div>
  );
}

function RegionCompare({ comparison }) {
  if (!comparison || !comparison.metrics || !comparison.metrics.length) return <p className="ap-empty">No data.</p>;
  const m = comparison.metrics;
  const maxComm = Math.max(...m.map((x) => x.communities), 1);
  const maxPop  = Math.max(...m.map((x) => x.totalPop), 1);
  return (
    <div className="ap-compare">
      {m.map((row) => (
        <div key={row.direction} className="ap-cmp-row">
          <div className="ap-cmp-name">{row.direction}</div>
          <div className="ap-cmp-bars">
            <BarLine label="communities" value={row.communities} max={maxComm} color="#b8351e" />
            <BarLine label="people"     value={row.totalPop}    max={maxPop}  color="#1a1612" format="num" />
            <BarLine label="avg pillars (of 4)" value={row.pillarsAvg} max={4} color="#6b8d6b" format="float" />
            <div className="ap-cmp-pillchips">
              {[['phy', row.physical], ['mnt', row.mental], ['spi', row.spiritual],
                ['emo', row.emotional], ['yth', row.youth], ['svr', row.survivors]].map(([k, v]) => (
                <span key={k} className="ap-pillchip">{k} <strong>{v}</strong></span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BarLine({ label, value, max, color, format }) {
  const pct = Math.min(100, (value / max) * 100);
  const shown = format === 'num' ? Math.round(value).toLocaleString()
              : format === 'float' ? Number(value).toFixed(1)
              : value;
  return (
    <div className="ap-bar-line">
      <span className="ap-bar-label">{label}</span>
      <span className="ap-bar-track">
        <span className="ap-bar-fill" style={{ width: pct + '%', background: color }} />
      </span>
      <span className="ap-bar-value">{shown}</span>
    </div>
  );
}

function KeywordCloud({ byPillar }) {
  const pillars = ['physical', 'mental', 'spiritual', 'emotional'];
  const colors = { physical: '#b8351e', mental: '#1a1612', spiritual: '#d4a017', emotional: '#6b8d6b' };
  return (
    <div className="ap-kw">
      {pillars.map((p) => (
        <div key={p} className="ap-kw-col">
          <h4 style={{ color: colors[p] }}>{p}</h4>
          <ul>
            {(byPillar[p] || []).slice(0, 14).map((t) => (
              <li key={t.term} style={{ fontSize: 11 + Math.min(18, t.score * 80) + 'px' }}>
                {t.term}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ClusterPanel({ clusters, onPick }) {
  if (!clusters.length) return <p className="ap-empty">No clusters yet.</p>;
  return (
    <ul className="ap-clusters">
      {clusters.map((c) => (
        <li key={c.id}>
          <div className="ap-cluster-head">
            <strong>Cluster {c.id + 1}</strong>
            <span className="muted">{c.size} communities</span>
          </div>
          <div className="ap-cluster-profile">
            {Object.entries(c.profile)
              .filter(([k]) => k.startsWith('has') && !k.includes('Connect'))
              .map(([k, v]) => (
                <span key={k} className="ap-pill" style={{
                  background: v > 0.6 ? 'rgba(184,53,30,0.18)' : 'rgba(0,0,0,0.05)',
                }}>
                  {k.replace('has','').toLowerCase()} {Math.round(v * 100)}%
                </span>
            ))}
          </div>
          <div className="ap-cluster-sample">
            {c.sample.slice(0, 4).map((n) => (
              <button key={n} className="ap-link" onClick={() => onPick && onPick(n)}>{n}</button>
            ))}
            {c.sample.length > 4 && <span className="muted">+ {c.sample.length - 4} more</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─────────── new components ────────────────────────────────────────────

function AnalyticsFilters({ all, filters, setFilters, filteredCount, totalCount }) {
  const directions = ['East', 'South', 'West', 'North', 'Central'];
  const orgTypes = useMemoAP(() => {
    const s = new Set((all || []).map((c) => c.orgType).filter(Boolean));
    return Array.from(s);
  }, [all]);
  const pops = [
    { key: 'under500', label: '<500' },
    { key: 'mid', label: '500–1.5k' },
    { key: 'large', label: '1.5–5k' },
    { key: 'xlarge', label: '5k+' },
  ];
  const pillars = ['physical', 'mental', 'spiritual', 'emotional'];

  function togglePillar(p) {
    setFilters((f) => {
      const next = new Set(f.pillars);
      if (next.has(p)) next.delete(p); else next.add(p);
      return { ...f, pillars: next };
    });
  }
  function clearAll() {
    setFilters({ dir: 'all', type: 'all', pop: 'all', pillars: new Set() });
  }
  const anyActive = filters.dir !== 'all' || filters.type !== 'all'
                  || filters.pop !== 'all' || filters.pillars.size > 0;

  return (
    <div className="ap-filters">
      <div className="ap-filters-row">
        <div className="ap-filter-group">
          <label>Direction</label>
          <select value={filters.dir} onChange={(e) => setFilters((f) => ({ ...f, dir: e.target.value }))}>
            <option value="all">All</option>
            {directions.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="ap-filter-group">
          <label>Organisation type</label>
          <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
            <option value="all">All</option>
            {orgTypes.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="ap-filter-group">
          <label>Population</label>
          <select value={filters.pop} onChange={(e) => setFilters((f) => ({ ...f, pop: e.target.value }))}>
            <option value="all">Any</option>
            {pops.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>
        <div className="ap-filter-group ap-filter-pillars">
          <label>Must include pillars</label>
          <div className="ap-pillar-toggles">
            {pillars.map((p) => (
              <button key={p}
                      className={`ap-pill${filters.pillars.has(p) ? ' on' : ''}`}
                      onClick={() => togglePillar(p)}>{p}</button>
            ))}
          </div>
        </div>
        <div className="ap-filter-meta">
          <span className="ap-filter-count">
            <strong>{filteredCount}</strong> of {totalCount}
          </span>
          {anyActive && (
            <button className="ap-link" onClick={clearAll}>clear filters</button>
          )}
        </div>
      </div>
    </div>
  );
}

function CommunityPicker({ all, value, onChange, placeholder }) {
  const [open, setOpen] = useStateAP(false);
  const [q, setQ] = useStateAP('');
  const items = useMemoAP(() => {
    const arr = (all || []).map((c) => c.name).filter(Boolean).sort();
    const qq = q.trim().toLowerCase();
    return qq ? arr.filter((n) => n.toLowerCase().includes(qq)) : arr;
  }, [all, q]);
  return (
    <div className="ap-picker">
      <input
        value={open ? q : (value || '')}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder={placeholder || 'Search a community…'}
      />
      {open && items.length > 0 && (
        <ul className="ap-picker-list">
          {items.map((n) => (
            <li key={n}>
              <button onMouseDown={(e) => { e.preventDefault(); onChange(n); setQ(''); setOpen(false); }}>
                {n}
              </button>
            </li>
          ))}
          <li className="ap-picker-count">
            <span>{items.length} of {(all || []).length} communities</span>
          </li>
        </ul>
      )}
    </div>
  );
}

function CommunitySpotlight({ all, value, onChange, onPick }) {
  const [data, setData] = useStateAP(null);
  const [loading, setLoading] = useStateAP(false);

  useEffectAP(() => {
    if (!value) { setData(null); return; }
    let alive = true;
    setLoading(true);
    fetch('/api/analytics/spotlight?name=' + encodeURIComponent(value))
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [value]);

  return (
    <div className="ap-spotlight">
      <CommunityPicker all={all} value={value} onChange={onChange}
                       placeholder="Pick a community to spotlight…" />
      {loading && <p className="ap-empty">Loading deep dive…</p>}
      {!loading && !data && (
        <p className="ap-empty">Start typing a community name above to see its full record.</p>
      )}
      {data && data.name && (
        <div className="ap-spot-body">
          <div className="ap-spot-head">
            <h4>{data.name}</h4>
            <span className={`ap-pill ap-dir-${data.direction}`}>{data.direction}</span>
            <span className="ap-pill">{data.type}</span>
            {data.population && <span className="ap-pill">pop. {data.population}</span>}
            <button className="ap-link" onClick={() => onPick && onPick(data.name)}>
              open full drawer ↗
            </button>
          </div>
          <div className="ap-spot-pillars">
            {data.pillars.map((p) => (
              <div key={p.key} className={`ap-spot-pillar${p.documented ? ' on' : ''}`}>
                <div className="ap-spot-pillar-head">
                  <strong>{p.label}</strong>
                  <span className={`ap-dot ${p.documented ? 'on' : 'off'}`} />
                </div>
                {p.documented && <p className="ap-spot-preview">{p.preview}…</p>}
                {p.documented && <span className="muted small">{p.wordCount} words on file</span>}
                {!p.documented && <span className="muted small">Not documented</span>}
              </div>
            ))}
          </div>
          {(data.youth || data.survivors || data.connect) && (
            <details className="ap-spot-extra">
              <summary>Additional programs</summary>
              {data.youth && <p><strong>Youth:</strong> {data.youth}</p>}
              {data.survivors && <p><strong>Survivors:</strong> {data.survivors}</p>}
              {data.connect && <p><strong>Connecting generations:</strong> {data.connect}</p>}
            </details>
          )}
          <div className="ap-spot-meta">
            <span><strong>{data.staffCount}</strong> contacts on file</span>
            {data.strategicPlan && <span>· strategic plan ✓</span>}
            {data.agm && <span>· AGM ✓</span>}
            {data.financials && <span>· financials ✓</span>}
            {data.link && <a href={data.link} target="_blank" rel="noopener noreferrer">website ↗</a>}
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceGapAnalyzer({ all, value, onChange, onPick }) {
  const [data, setData] = useStateAP(null);
  const [loading, setLoading] = useStateAP(false);

  useEffectAP(() => {
    if (!value) { setData(null); return; }
    let alive = true;
    setLoading(true);
    fetch('/api/analytics/gaps_for?name=' + encodeURIComponent(value))
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [value]);

  return (
    <div>
      <CommunityPicker all={all} value={value} onChange={onChange}
                       placeholder="Pick a community to analyze gaps for…" />
      {loading && <p className="ap-empty">Finding peer communities…</p>}
      {!loading && !data && (
        <p className="ap-empty">Pick a community to see what its closest peers offer that it doesn't.</p>
      )}
      {data && data.gaps && (
        <>
          {data.peers && data.peers.length > 0 && (
            <div className="ap-gap-peers">
              <span className="muted small">Closest peers in the sheet:</span>
              {data.peers.slice(0, 5).map((p) => (
                <button key={p.name} className="ap-pill ap-link-like"
                        onClick={() => onPick && onPick(p.name)}>
                  {p.name} <span className="ap-pill-n">{Math.round(p.score * 100)}%</span>
                </button>
              ))}
            </div>
          )}
          {data.gaps.length === 0 ? (
            <p className="ap-empty">
              {data.target} appears to document everything its peers do. Great coverage on file!
            </p>
          ) : (
            <ul className="ap-gaps">
              {data.gaps.map((g, i) => (
                <li key={i} className={`ap-gap sev-${g.severity}`}>
                  <div className="ap-gap-head">
                    <strong>{g.label}</strong>
                    <span className="ap-pill">{g.peerCount} peer{g.peerCount === 1 ? '' : 's'} offer this</span>
                  </div>
                  <div className="ap-gap-peers-list">
                    Peers documenting it: {g.peers.map((n, j) => (
                      <button key={j} className="ap-link" onClick={() => onPick && onPick(n)}>
                        {n}{j < g.peers.length - 1 ? ', ' : ''}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function CompareTwo({ all, value, onChange }) {
  function set(k, v) { onChange({ ...value, [k]: v }); }
  const a = (all || []).find((c) => c.name === value.a);
  const b = (all || []).find((c) => c.name === value.b);

  const rows = [
    { k: 'direction',  label: 'Direction' },
    { k: 'orgType',    label: 'Type' },
    { k: 'population', label: 'Population', fmt: (v) => v ? Number(v).toLocaleString() : '—' },
    { k: 'hasPhysical',label: 'Physical health programming', dot: true },
    { k: 'hasMental',  label: 'Mental health programming',   dot: true },
    { k: 'hasSpiritual',label:'Spiritual support',           dot: true },
    { k: 'hasEmotional',label:'Emotional support',           dot: true },
    { k: 'hasYouth',    label:'Youth programming',           dot: true },
    { k: 'hasSurvivors',label:'Survivor support',            dot: true },
    { k: 'strategicPlan', label: 'Strategic plan', truthy: true },
    { k: 'agm',         label: 'AGM / annual report', truthy: true },
    { k: 'financials',  label: 'Financial statements', truthy: true },
  ];

  function cell(c, row) {
    if (!c) return <span className="muted">—</span>;
    const v = c[row.k];
    if (row.dot) return <span className={`ap-dot ${v ? 'on' : 'off'}`} />;
    if (row.truthy) {
      const filled = !!(v && String(v).trim() && !['missing information', 'needs review', 'n/a'].includes(String(v).trim().toLowerCase()));
      return <span className={`ap-dot ${filled ? 'on' : 'off'}`} />;
    }
    if (row.fmt) return row.fmt(v);
    return v || <span className="muted">—</span>;
  }

  function score(c) {
    if (!c) return 0;
    return ['Physical','Mental','Spiritual','Emotional','Youth','Survivors']
      .filter((p) => c['has' + p]).length;
  }

  return (
    <div className="ap-compare2">
      <div className="ap-compare2-pickers">
        <div>
          <label className="ap-cmp-lbl">Community A</label>
          <CommunityPicker all={all} value={value.a} onChange={(n) => set('a', n)} placeholder="Pick community A…" />
        </div>
        <div className="ap-vs">vs</div>
        <div>
          <label className="ap-cmp-lbl">Community B</label>
          <CommunityPicker all={all} value={value.b} onChange={(n) => set('b', n)} placeholder="Pick community B…" />
        </div>
      </div>

      {(a || b) && (
        <table className="ap-compare2-tbl">
          <thead>
            <tr>
              <th></th>
              <th>{a ? a.name : <span className="muted">(pick one)</span>}</th>
              <th>{b ? b.name : <span className="muted">(pick one)</span>}</th>
            </tr>
            <tr>
              <th className="ap-cmp-meta">Documented pillars</th>
              <td className="ap-cmp-score">{score(a)}/6</td>
              <td className="ap-cmp-score">{score(b)}/6</td>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.k}>
                <th>{row.label}</th>
                <td>{cell(a, row)}</td>
                <td>{cell(b, row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Each slide carries a "theme" — a Sacred-Direction colour pair used to paint
// a full-bleed gradient behind the card, so the deck feels alive and cultural.
const PRES_THEMES = {
  east:  { a: '#e8b948', b: '#d4a017', ink: '#3a2c08', glyph: '✺' },
  south: { a: '#d94f33', b: '#b8351e', ink: '#fff', glyph: '☀' },
  west:  { a: '#3a342c', b: '#1a1612', ink: '#fff', glyph: '☾' },
  north: { a: '#8fb08f', b: '#6b8d6b', ink: '#15240f', glyph: '❄' },
};
const PRES_CYCLE = ['south', 'east', 'north', 'west'];

function PresentationMode({ overview, facts, comparison, duplicates, report, onClose }) {
  const slides = useMemoAP(() => {
    const out = [];
    out.push({
      title: 'Mino Bimaadiziwin Atlas',
      sub: 'Live data from the master sheet',
      big: overview.total || 0, bigLabel: 'communities documented',
      theme: 'south',
    });
    out.push({
      title: 'Service pillar coverage',
      sub: 'How many communities document each pillar',
      grid: ['physical', 'mental', 'spiritual', 'emotional'].map((p) => ({
        label: p, value: (overview.pillarsCovered && overview.pillarsCovered[p]) || 0,
      })),
      theme: 'east',
    });
    if (facts) {
      facts.forEach((f, n) => out.push({ title: f.kicker, sub: '', big: f.fact, bigLabel: '',
        theme: PRES_CYCLE[n % PRES_CYCLE.length] }));
    }
    if (comparison && comparison.metrics) {
      out.push({
        title: 'By direction',
        sub: 'Communities documented in each Sacred Direction',
        grid: comparison.metrics.map((m) => ({ label: m.direction, value: m.communities })),
        theme: 'north',
      });
    }
    if (duplicates && duplicates.summary) {
      out.push({
        title: 'Service overlaps detected',
        sub: 'High-similarity wording across communities',
        big: duplicates.summary.totalPairs || 0,
        bigLabel: 'similar service descriptions on file',
        theme: 'west',
      });
    }
    out.push({
      title: 'Miigwech',
      sub: 'One living atlas — every direction, every season.',
      theme: 'east', closing: true,
    });
    // give any slide without an explicit theme one from the cycle
    return out.map((sl, n) => ({ ...sl, theme: sl.theme || PRES_CYCLE[n % PRES_CYCLE.length] }));
  }, [overview, facts, comparison, duplicates]);

  const [i, setI] = useStateAP(0);
  const [playing, setPlaying] = useStateAP(false);

  useEffectAP(() => {
    function k(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === ' ') setI((x) => Math.min(slides.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    }
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [slides.length, onClose]);

  // auto-advance when playing; stop at the last slide
  useEffectAP(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      setI((x) => { if (x >= slides.length - 1) { setPlaying(false); return x; } return x + 1; });
    }, 5000);
    return () => clearTimeout(t);
  }, [playing, i, slides.length]);

  if (!slides.length) return null;
  const s = slides[i];
  const th = PRES_THEMES[s.theme] || PRES_THEMES.south;
  const bg = `radial-gradient(120% 120% at 80% 0%, ${th.a} 0%, ${th.b} 55%, #0d0a07 130%)`;

  return (
    <div className="ap-presentation" style={{ background: bg }}
         onClick={(e) => { if (e.target.classList.contains('ap-presentation')) onClose(); }}>
      <div className="ap-pres-glyph" aria-hidden="true">{th.glyph}</div>
      <div className="ap-pres-card" key={i} style={{ borderTop: `5px solid ${th.b}` }}>
        <p className="ap-pres-eyebrow">slide {i + 1} of {slides.length} · {s.theme}</p>
        <h3 className="ap-pres-title" style={{ color: th.b }}>{s.title}</h3>
        {s.sub && <p className="ap-pres-sub">{s.sub}</p>}
        {s.big != null && (
          <div className="ap-pres-big">
            <span className="ap-pres-big-num" style={{ color: th.b }}>{typeof s.big === 'number' ? s.big.toLocaleString() : s.big}</span>
            {s.bigLabel && <span className="ap-pres-big-label">{s.bigLabel}</span>}
          </div>
        )}
        {s.grid && (
          <div className="ap-pres-grid">
            {s.grid.map((g) => (
              <div key={g.label} className="ap-pres-cell">
                <span className="ap-pres-cell-num" style={{ color: th.b }}>{Number(g.value).toLocaleString()}</span>
                <span className="ap-pres-cell-lbl">{g.label}</span>
              </div>
            ))}
          </div>
        )}
        <div className="ap-pres-controls">
          <button onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>◀</button>
          <button className="ap-pres-play" onClick={() => setPlaying((p) => !p)}
                  title={playing ? 'Pause auto-play' : 'Auto-play the deck'}>
            {playing ? '⏸' : '▶'}
          </button>
          <span className="ap-pres-progress">
            {slides.map((_, j) => <span key={j} className={j === i ? 'on' : ''} onClick={() => setI(j)} />)}
          </span>
          <button onClick={() => setI((x) => Math.min(slides.length - 1, x + 1))} disabled={i === slides.length - 1}>▶</button>
          <button onClick={onClose} className="ap-pres-close">✕ close</button>
        </div>
      </div>
    </div>
  );
}


function AskTheAtlas({ onPick }) {
  const [q, setQ] = useStateAP('');
  const [thinking, setThinking] = useStateAP(false);
  const [convo, setConvo] = useStateAP([
    { role: 'bot', text: "Hi — I only know what the master sheet says. Ask me about programs, services, communities, or quote a topic and I'll find what's documented." },
  ]);
  const inputRef = useRefAP(null);

  async function ask() {
    const query = q.trim();
    if (!query) return;
    setConvo((c) => [...c, { role: 'user', text: query }]);
    setQ('');
    setThinking(true);
    try {
      const r = await fetch('/api/analytics/search?q=' + encodeURIComponent(query) + '&limit=6');
      const data = r.ok ? await r.json() : { answer: 'I had trouble searching just now. Please try again.', results: [] };
      setConvo((c) => [...c, { role: 'bot', text: data.answer || '(no answer)', results: data.results || [] }]);
    } catch (e) {
      setConvo((c) => [...c, { role: 'bot', text: 'Network hiccup — please try again.' }]);
    } finally {
      setThinking(false);
      setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
    }
  }
  function suggested(s) { setQ(s); setTimeout(ask, 50); }

  return (
    <div className="ap-chat">
      <div className="ap-chat-window">
        {convo.map((m, i) => (
          <div key={i} className={`ap-msg ${m.role}`}>
            <div className="ap-msg-bubble">
              <p>{m.text}</p>
              {m.results && m.results.length > 0 && (
                <ul className="ap-chat-results">
                  {m.results.map((r) => (
                    <li key={r.id || r.name}>
                      <button className="ap-link" onClick={() => onPick && onPick(r.name)}>
                        {r.name}
                      </button>
                      <span className="muted small"> · {r.direction || '—'}</span>
                      <div className="ap-snip">{r.snippet}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="ap-msg bot"><div className="ap-msg-bubble thinking">Reading the sheet… <span className="ap-typing" /></div></div>
        )}
      </div>
      <div className="ap-chat-input">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder="Ask anything about the communities…"
        />
        <button className="ap-send" onClick={ask} disabled={!q.trim() || thinking}>Ask</button>
      </div>
      <div className="ap-chat-suggested">
        {['Who supports survivors?', 'Diabetes programs', 'Youth mental health', 'Traditional medicine'].map((s) => (
          <button key={s} onClick={() => suggested(s)}>{s}</button>
        ))}
      </div>
      <p className="ap-fine">
        This assistant uses pure retrieval — it only quotes the sheet, never makes things up, and always cites where the answer came from.
      </p>
    </div>
  );
}
