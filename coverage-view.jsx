/* global React */
/*
 * CoverageView — surfaces real data from the multi-sheet master workbook:
 *   - 85-community canonical list × whether each appears in the master sheet
 *   - communities present in the master sheet that aren't on the official list
 *   - per-community annotations: Missing Information / Needs Review / Corrections
 *
 * Fed by /api/communities/coverage85 and /api/communities/annotations.
 */

const { useState: useState_cov, useEffect: useEffect_cov, useMemo: useMemo_cov } = React;

function CoverageView({ onSelect, setView }) {
  const [coverage, setCoverage] = useState_cov(null);
  const [annotations, setAnnotations] = useState_cov(null);
  const [filter, setFilter] = useState_cov('all'); // all | missing | covered
  const [q, setQ] = useState_cov('');

  async function load() {
    try {
      // Prefer the values the bridge pre-fetched.
      let c = window.ATLAS_COVERAGE85;
      if (!c) {
        const r = await fetch('/api/communities/coverage85');
        c = r.ok ? await r.json() : null;
      }
      setCoverage(c);
      const a = await fetch('/api/communities/annotations').then((r) => r.ok ? r.json() : null);
      setAnnotations(a);
    } catch (e) { /* offline — graceful empty */ }
  }
  useEffect_cov(() => { load(); }, []);

  // Re-load on SSE dataset.updated.
  useEffect_cov(() => {
    function h() { load(); }
    window.addEventListener('atlas:dataset', h);
    return () => window.removeEventListener('atlas:dataset', h);
  }, []);

  const items = useMemo_cov(() => {
    if (!coverage || !coverage.items) return [];
    const qq = q.trim().toLowerCase();
    return coverage.items.filter((c) => {
      if (filter === 'missing' && c.inMaster) return false;
      if (filter === 'covered' && !c.inMaster) return false;
      if (qq && !(c.name || '').toLowerCase().includes(qq)) return false;
      return true;
    });
  }, [coverage, filter, q]);

  if (!coverage) {
    return (
      <section className="coverage-view" style={{ padding: 32 }}>
        <h2 style={{ fontFamily: 'Newsreader, serif', fontWeight: 500 }}>Coverage of the 85 communities</h2>
        <p style={{ color: 'var(--ink-2, #6b5b46)' }}>
          Loading from backend… (this view needs the FastAPI server with a workbook uploaded).
        </p>
      </section>
    );
  }

  const s = coverage.summary || {};
  const totals = (annotations && annotations.totals) || {};

  return (
    <section className="coverage-view" style={{ padding: '24px 32px 80px', maxWidth: 1400, margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'Newsreader, serif', fontWeight: 500, margin: '0 0 4px', fontSize: 28 }}>
        Coverage of the 85 communities
      </h2>
      <p style={{ color: 'var(--ink-2, #6b5b46)', margin: '0 0 24px', fontSize: 14 }}>
        Cross-references the official supporting list against the master sheet, plus the
        Missing Information, Needs Review, and Correction tabs from the workbook.
      </p>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 24 }}>
        <KPI label="Official communities" value={s.total} />
        <KPI label="In master sheet" value={s.covered} sub={s.total ? `${Math.round(100 * s.covered / s.total)}% covered` : ''} />
        <KPI label="Not yet in master" value={s.missing} tone="warn" />
        <KPI label="Extra (in master, not on list)" value={(coverage.extras || []).length} />
        <KPI label="Missing-info entries" value={totals.missing || 0} />
        <KPI label="Needs-review entries" value={totals.review || 0} />
        <KPI label="Corrections logged" value={totals.corrections || 0} />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          placeholder="Search community…"
          value={q} onChange={(e) => setQ(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid var(--border, #d9cfba)',
                   borderRadius: 6, minWidth: 220, fontSize: 14 }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {[['all', 'All'], ['covered', 'In master'], ['missing', 'Missing']].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)}
              style={{
                padding: '6px 14px', border: '1px solid var(--ink, #1a1612)',
                background: filter === k ? 'var(--ink, #1a1612)' : 'transparent',
                color: filter === k ? 'white' : 'var(--ink, #1a1612)',
                borderRadius: 6, cursor: 'pointer', fontSize: 13,
              }}
            >{l}</button>
          ))}
        </div>
        <span style={{ color: 'var(--ink-2, #6b5b46)', fontSize: 13 }}>
          Showing {items.length} of {coverage.items.length}
        </span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--paper, #fbf7ec)',
                     border: '1px solid var(--border, #d9cfba)', borderRadius: 8, overflow: 'hidden', fontSize: 13 }}>
        <thead style={{ background: 'rgba(0,0,0,0.04)' }}>
          <tr>
            <th style={th()}>#</th>
            <th style={th()}>Community</th>
            <th style={th()}>Status</th>
            <th style={th()}>Direction</th>
            <th style={th()}>Annotations</th>
            <th style={th()}>Note</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.number || c.name}
                style={{ background: !c.inMaster ? 'rgba(184,53,30,0.05)' : 'transparent', borderTop: '1px solid var(--border, #d9cfba)' }}>
              <td style={td('mono')}>{c.number}</td>
              <td style={td()}>
                <strong>{c.name}</strong>
                {c.matchedName && c.matchedName !== c.name && (
                  <div style={{ fontSize: 11, color: 'var(--ink-2, #6b5b46)' }}>matched: {c.matchedName}</div>
                )}
              </td>
              <td style={td()}>
                {c.inMaster
                  ? <span style={pill('#6b8d6b')}>in master</span>
                  : <span style={pill('#b8351e')}>missing</span>}
              </td>
              <td style={td()}>{c.matchedDirection || '—'}</td>
              <td style={td('mono')}>{c.matchedAnnotations > 0 ? c.matchedAnnotations : '—'}</td>
              <td style={{ ...td(), fontSize: 11, color: 'var(--ink-2, #6b5b46)', maxWidth: 320 }}>
                {c.note || ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {(coverage.extras || []).length > 0 && (
        <>
          <h3 style={{ marginTop: 32, fontFamily: 'Newsreader, serif', fontSize: 18 }}>
            In the master sheet, NOT on the official list ({coverage.extras.length})
          </h3>
          <ul style={{ marginTop: 8 }}>
            {coverage.extras.map((e) => (
              <li key={e.name} style={{ marginBottom: 4 }}>
                <strong>{e.name}</strong>
                {e.region && <span style={{ color: 'var(--ink-2)', marginLeft: 8 }}>· {e.region}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {annotations && (annotations.missing || []).length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ fontFamily: 'Newsreader, serif', fontSize: 18 }}>
            Latest missing-information items
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--paper, #fbf7ec)',
                         border: '1px solid var(--border, #d9cfba)', borderRadius: 8, overflow: 'hidden', fontSize: 13, marginTop: 8 }}>
            <thead style={{ background: 'rgba(0,0,0,0.04)' }}>
              <tr>
                <th style={th()}>Community</th>
                <th style={th()}>Item</th>
                <th style={th()}>Status</th>
                <th style={th()}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {annotations.missing.slice(0, 30).map((a, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border, #d9cfba)' }}>
                  <td style={td()}><strong>{a.community}</strong></td>
                  <td style={td()}>{a.item}</td>
                  <td style={td()}><span style={pill('#d4a017')}>{a.status || 'missing'}</span></td>
                  <td style={{ ...td(), maxWidth: 480, fontSize: 12, color: 'var(--ink-2)' }}>
                    {(a.description || '').slice(0, 200)}{a.description && a.description.length > 200 ? '…' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function KPI({ label, value, sub, tone }) {
  return (
    <div style={{
      padding: 16,
      background: 'var(--paper, #fbf7ec)',
      border: '1px solid var(--border, #d9cfba)',
      borderRadius: 8,
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: tone === 'warn' ? '#b8351e' : 'inherit' }}>{value}</div>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: 'var(--ink-2, #6b5b46)', marginTop: 6, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function th() {
  return {
    textAlign: 'left', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: 'var(--ink-2, #6b5b46)', fontWeight: 600,
  };
}
function td(cls) {
  return {
    padding: '10px 14px', verticalAlign: 'top',
    fontFamily: cls === 'mono' ? 'JetBrains Mono, monospace' : 'inherit',
  };
}
function pill(color) {
  return {
    display: 'inline-block', padding: '2px 8px', fontSize: 11, borderRadius: 12,
    background: color, color: 'white', fontWeight: 500,
  };
}

window.CoverageView = CoverageView;
