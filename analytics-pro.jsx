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
  // Filter set local to this view — the user can narrow analytics without
  // affecting the main map/list filters.
  const [localDir, setLocalDir]   = useStateAP('all');
  const [report, setReport]       = useStateAP(null);
  const [duplicates, setDup]      = useStateAP(null);
  const [comparison, setComp]     = useStateAP(null);
  const [facts, setFacts]         = useStateAP(null);
  const [loading, setLoading]     = useStateAP(true);

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
            Every number you see below is computed live from the team's current
            Excel sheet. Hover any card for plain-English context.
          </p>
        </div>
        <div className="ap-kpi-strip">
          <KPI value={ov.total} label="Communities & partners" sub="documented in the atlas" />
          <KPI value={ov.hasAllPillars} label="All 4 pillars" sub="physical + mental + spiritual + emotional"
               accent="south" />
          <KPI value={ov.populationTotal} label="People served"
               sub="across all documented communities" big />
          <KPI value={Math.round((ov.completenessScore || 0) * 100)} suffix="%"
               label="Average completeness" sub="fields filled in on each record" accent="east" />
        </div>
      </header>

      {/* ────────── Storytelling carousel ────────── */}
      {facts && facts.facts && <StoryCarousel facts={facts.facts} />}

      {/* ────────── Direction clock + pillar gauges ────────── */}
      <div className="ap-row two-col">
        <Panel title="Sacred Direction Clock"
               sub="The medicine wheel turns through every community in the atlas. Each spoke is a direction; the longer the spoke, the more communities documented in that direction.">
          <DirectionClock byDirection={ov.byDirection || {}} />
        </Panel>
        <Panel title="Pillar coverage at a glance"
               sub="A ring for each of the four service pillars. Filled = communities that document that pillar.">
          <PillarRings overview={ov} />
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
    </section>
  );
}
window.AnalyticsProView = AnalyticsProView;


// ============== components =============================================

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

function PillarRings({ overview }) {
  const pillars = [
    { k: 'physical',  label: 'Physical',  color: '#b8351e' },
    { k: 'mental',    label: 'Mental',    color: '#1a1612' },
    { k: 'spiritual', label: 'Spiritual', color: '#d4a017' },
    { k: 'emotional', label: 'Emotional', color: '#6b8d6b' },
  ];
  const total = overview.total || 1;
  return (
    <div className="ap-rings">
      {pillars.map((p) => {
        const n = (overview.pillarsCovered && overview.pillarsCovered[p.k]) || 0;
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
