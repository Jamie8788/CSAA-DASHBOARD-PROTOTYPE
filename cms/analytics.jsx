/* global React, API, Recharts */
const { useState: useState_a, useEffect: useEffect_a, useMemo: useMemo_a } = React;

const PILLAR_COLORS = {
  physical: '#b8351e', mental: '#1a1612',
  spiritual: '#d4a017', emotional: '#6b8d6b',
};

function KPI({ label, value, sub }) {
  return (
    <div className="card kpi">
      <div className="num">{value}</div>
      <div className="lbl">{label}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

function AnalyticsView() {
  const toast = window.useToast();
  const [report, setReport] = useState_a(null);
  const [loading, setLoading] = useState_a(true);
  const [k, setK] = useState_a(5);

  async function load() {
    setLoading(true);
    try {
      const r = await API.analytics.full();
      setReport(r);
    } catch (e) { toast.push('Analytics failed: ' + e.message, 'error'); }
    finally { setLoading(false); }
  }

  useEffect_a(() => { load(); }, []);

  async function reCluster() {
    try {
      const r = await API.analytics.clusters(k);
      setReport((prev) => ({ ...prev, clusters: r }));
    } catch (e) { toast.push(e.message, 'error'); }
  }

  if (loading || !report) {
    return <div><h1>Analytics</h1><p className="subhead"><window.Spinner /> Crunching numbers…</p></div>;
  }

  const ov = report.overview || {};

  return (
    <div>
      <h1>Analytics</h1>
      <p className="subhead">
        State-of-the-art Python analytics (pandas + scikit-learn) over the live dataset.
        Total records: <strong>{ov.total || 0}</strong>.
      </p>

      <div className="row">
        <KPI label="Communities" value={ov.total || 0} sub="in the current dataset" />
        <KPI label="With any pillar" value={ov.hasAnyPillar || 0}
             sub={ov.total ? `${Math.round(100 * ov.hasAnyPillar / ov.total)}% coverage` : ''} />
        <KPI label="All 4 pillars" value={ov.hasAllPillars || 0}
             sub={ov.total ? `${Math.round(100 * ov.hasAllPillars / ov.total)}% full coverage` : ''} />
        <KPI label="Has contact" value={ov.hasContact || 0}
             sub={ov.total ? `${Math.round(100 * ov.hasContact / ov.total)}%` : ''} />
        <KPI label="Geo-located" value={ov.hasGeo || 0}
             sub={ov.total ? `${Math.round(100 * ov.hasGeo / ov.total)}% on map` : ''} />
        <KPI label="Completeness" value={(ov.completenessScore || 0).toFixed(2)}
             sub="0–1 score across all narrative fields" />
      </div>

      <PillarChart report={report} />

      <div className="grid-2" style={{ marginTop: 16 }}>
        <DirectionChart report={report} />
        <CoverageMatrix report={report} />
      </div>

      <PopulationChart report={report} />

      <div className="grid-2" style={{ marginTop: 16 }}>
        <ClusterPanel report={report} k={k} onChangeK={setK} onRecluster={reCluster} />
        <GapsPanel report={report} />
      </div>

      <KeywordsPanel report={report} />
      <QualityPanel report={report} />
    </div>
  );
}
window.AnalyticsView = AnalyticsView;

function PillarChart({ report }) {
  const pillars = report.overview && report.overview.pillarsCovered || {};
  const data = Object.entries(pillars).map(([key, count]) => ({ key, count }));
  const total = report.overview && report.overview.total || 0;
  const R = window.Recharts || {};
  if (!R.BarChart) {
    return (
      <div className="chart-box" style={{ marginTop: 16 }}>
        <h4>Service pillar coverage</h4>
        <table className="tbl">
          <thead><tr><th>Pillar</th><th className="right">Coverage</th><th className="right">% of total</th></tr></thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key}>
                <td style={{ textTransform: 'capitalize' }}>{d.key}</td>
                <td className="right mono">{d.count}</td>
                <td className="right mono">{total ? Math.round(100 * d.count / total) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="chart-box" style={{ marginTop: 16 }}>
      <h4>Service pillar coverage</h4>
      <R.ResponsiveContainer width="100%" height={240}>
        <R.BarChart data={data}>
          <R.CartesianGrid strokeDasharray="3 3" stroke="#e8dfc8" />
          <R.XAxis dataKey="key" />
          <R.YAxis />
          <R.Tooltip />
          <R.Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => <R.Cell key={i} fill={PILLAR_COLORS[d.key] || '#1a1612'} />)}
          </R.Bar>
        </R.BarChart>
      </R.ResponsiveContainer>
    </div>
  );
}

function DirectionChart({ report }) {
  const byDir = report.overview && report.overview.byDirection || {};
  const data = Object.entries(byDir).map(([name, value]) => ({ name, value }));
  const colors = ['#d4a017', '#b8351e', '#1a1612', '#6b8d6b', '#888'];
  const R = window.Recharts || {};
  if (!R.PieChart) {
    return (
      <div className="chart-box">
        <h4>Communities by direction</h4>
        <table className="tbl">
          <tbody>{data.map((d) => <tr key={d.name}><td>{d.name || 'Unknown'}</td><td className="right mono">{d.value}</td></tr>)}</tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="chart-box">
      <h4>Communities by direction</h4>
      <R.ResponsiveContainer width="100%" height={240}>
        <R.PieChart>
          <R.Pie data={data} dataKey="value" nameKey="name" outerRadius={80} label>
            {data.map((d, i) => <R.Cell key={i} fill={colors[i % colors.length]} />)}
          </R.Pie>
          <R.Tooltip />
          <R.Legend />
        </R.PieChart>
      </R.ResponsiveContainer>
    </div>
  );
}

function CoverageMatrix({ report }) {
  const cov = report.coverageMatrix || { matrix: {}, directions: [], pillars: [] };
  return (
    <div className="chart-box">
      <h4>Coverage heat-map (direction × pillar)</h4>
      <table className="tbl small">
        <thead>
          <tr><th></th>{cov.pillars.map((p) => <th key={p} style={{ textTransform: 'capitalize' }}>{p}</th>)}</tr>
        </thead>
        <tbody>
          {cov.directions.map((d) => (
            <tr key={d}>
              <td><strong>{d}</strong></td>
              {cov.pillars.map((p) => {
                const v = cov.matrix[d] ? cov.matrix[d][p] : 0;
                const bg = `rgba(184,53,30,${Math.min(0.8, v)})`;
                const fg = v > 0.5 ? 'white' : 'inherit';
                return (
                  <td key={p} className="right mono" style={{ background: bg, color: fg }}>
                    {Math.round((v || 0) * 100)}%
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

function PopulationChart({ report }) {
  const pop = report.population || { buckets: [], percentiles: {} };
  const R = window.Recharts || {};
  return (
    <div className="chart-box" style={{ marginTop: 16 }}>
      <h4>Population distribution</h4>
      {pop.buckets.length === 0
        ? <p className="muted small">No population data available.</p>
        : R.BarChart
          ? (
            <R.ResponsiveContainer width="100%" height={220}>
              <R.BarChart data={pop.buckets}>
                <R.CartesianGrid strokeDasharray="3 3" stroke="#e8dfc8" />
                <R.XAxis dataKey="label" />
                <R.YAxis />
                <R.Tooltip />
                <R.Bar dataKey="count" fill="#1a1612" radius={[4, 4, 0, 0]} />
              </R.BarChart>
            </R.ResponsiveContainer>
          )
          : (
            <table className="tbl small">
              <tbody>{pop.buckets.map((b) => <tr key={b.label}><td>{b.label}</td><td className="right mono">{b.count}</td></tr>)}</tbody>
            </table>
          )
      }
      <p className="small muted" style={{ marginTop: 8 }}>
        median <span className="mono">{Math.round(pop.percentiles.p50 || 0)}</span>,
        90th <span className="mono">{Math.round(pop.percentiles.p90 || 0)}</span>,
        min/max <span className="mono">{Math.round(pop.min || 0)}–{Math.round(pop.max || 0)}</span>
      </p>
    </div>
  );
}

function ClusterPanel({ report, k, onChangeK, onRecluster }) {
  const cl = report.clusters || { clusters: [], k: 0 };
  return (
    <div className="card">
      <h3>K-means service-profile clusters</h3>
      <p className="small muted">Groups communities by their pillar / programming fingerprint. {cl.k} clusters fitted.</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <label className="small" style={{ margin: 0 }}>k =</label>
        <input type="number" min="2" max="12" value={k} onChange={(e) => onChangeK(Number(e.target.value))} style={{ width: 80 }} />
        <button className="btn ghost" onClick={onRecluster}>Re-cluster</button>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {cl.clusters.map((c) => (
          <li key={c.id} style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
            <strong>Cluster {c.id + 1}</strong> · {c.size} communities
            <div className="small muted">
              {Object.entries(c.profile).map(([k, v]) =>
                <span key={k} style={{ marginRight: 8 }}>
                  <span className="mono">{k.replace('has','').toLowerCase()}</span>: {(v * 100).toFixed(0)}%
                </span>)}
            </div>
            <div className="small">Examples: {c.sample.slice(0, 4).join(', ')}{c.sample.length > 4 ? '…' : ''}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GapsPanel({ report }) {
  const gaps = report.gaps && report.gaps.items || [];
  return (
    <div className="card">
      <h3>Top service gaps</h3>
      <p className="small muted">Communities missing the most pillars — start outreach here.</p>
      <table className="tbl">
        <thead>
          <tr><th>Community</th><th>Direction</th><th>Missing</th></tr>
        </thead>
        <tbody>
          {gaps.slice(0, 10).map((g) => (
            <tr key={g.id || g.name} className={g.gapCount >= 3 ? 'gap-high' : ''}>
              <td><strong>{g.name}</strong></td>
              <td><span className={`tag dir-${g.direction}`}>{g.direction}</span></td>
              <td className="small mono">{g.missingPillars.join(', ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeywordsPanel({ report }) {
  const kw = report.keywords && report.keywords.perPillar || {};
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>TF-IDF distinguishing keywords per pillar</h3>
      <p className="small muted">The terms that stand out in each pillar's narrative across the dataset.</p>
      <div className="row">
        {Object.entries(kw).map(([k, terms]) => (
          <div key={k} className="chart-box">
            <h4 style={{ color: PILLAR_COLORS[k] || 'inherit' }}>{k}</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {terms.slice(0, 12).map((t) => (
                <li key={t.term} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dotted var(--border)' }}>
                  <span>{t.term}</span>
                  <span className="mono small muted">{t.score.toFixed(3)}</span>
                </li>
              ))}
              {terms.length === 0 && <li className="muted small">Not enough text for TF-IDF.</li>}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function QualityPanel({ report }) {
  const q = report.quality || { items: [], averageScore: 0 };
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>Data quality score</h3>
      <p className="small muted">
        Average completeness <strong>{(q.averageScore * 100).toFixed(0)}%</strong> ·
        median <strong>{(q.medianScore * 100).toFixed(0)}%</strong>.
      </p>
      <details>
        <summary className="btn-link">Show per-record completeness</summary>
        <table className="tbl" style={{ marginTop: 12 }}>
          <thead>
            <tr><th>Community</th><th>Direction</th><th>Type</th><th className="right">Completeness</th></tr>
          </thead>
          <tbody>
            {q.items.slice(0, 60).map((r) => (
              <tr key={r.id || r.name}>
                <td><strong>{r.name}</strong></td>
                <td>{r.direction && <span className={`tag dir-${r.direction}`}>{r.direction}</span>}</td>
                <td className="small">{r.type}</td>
                <td className="right mono">
                  <span style={{
                    display: 'inline-block', width: 60,
                    background: `linear-gradient(to right, var(--good) ${r.completeness * 100}%, transparent ${r.completeness * 100}%)`,
                    border: '1px solid var(--border)', borderRadius: 4,
                    padding: '0 4px', textAlign: 'right',
                  }}>
                    {(r.completeness * 100).toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
