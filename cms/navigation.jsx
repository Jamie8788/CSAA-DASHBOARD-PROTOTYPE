/* global React, API */
/*
 * NavigationView — manages the public dashboard's top nav strip.
 * Admin can reorder tabs, rename them, change icons, toggle visibility.
 * Saves emit a `nav.updated` SSE event so every open dashboard re-fetches.
 */
const { useState: useState_n, useEffect: useEffect_n } = React;

const KNOWN_VIEWS = [
  { view: 'map',      label: 'Map · Search',      icon: '◉' },
  { view: 'list',     label: 'Directory',         icon: '☷' },
  { view: 'stories',  label: 'Community Stories', icon: '❋' },
  { view: 'stats',    label: 'Insights & Stories',icon: '◭' },
  { view: 'coverage', label: 'Coverage (85)',     icon: '⌧' },
];

function NavigationView() {
  const toast = window.useToast();
  const [items, setItems] = useState_n([]);
  const [loading, setLoading] = useState_n(true);
  const [busy, setBusy] = useState_n(false);

  async function load() {
    setLoading(true);
    try {
      const r = await API.nav.list('main');
      setItems(r.items || []);
    } catch (e) {
      toast.push('Load failed: ' + e.message, 'error');
    } finally { setLoading(false); }
  }
  useEffect_n(() => { load(); }, []);

  function patch(idx, k, v) {
    setItems((xs) => xs.map((x, i) => i === idx ? { ...x, [k]: v } : x));
  }

  async function save(item) {
    setBusy(true);
    try {
      await API.nav.upsert(item);
      toast.push('Saved.', 'success');
      load();
    } catch (e) { toast.push('Save failed: ' + e.message, 'error'); }
    finally { setBusy(false); }
  }

  async function saveAll() {
    setBusy(true);
    try {
      for (const item of items) {
        await API.nav.upsert(item);
      }
      toast.push('All saved.', 'success');
      load();
    } catch (e) { toast.push('Save failed: ' + e.message, 'error'); }
    finally { setBusy(false); }
  }

  async function add(viewKey) {
    const known = KNOWN_VIEWS.find((v) => v.view === viewKey);
    const item = {
      slot: 'main',
      position: items.length,
      label: known ? known.label : viewKey,
      view: viewKey,
      icon: known ? known.icon : '•',
      visible: true,
    };
    await save(item);
  }

  async function remove(item) {
    if (!confirm(`Remove "${item.label}" tab from the dashboard?`)) return;
    try {
      await API.nav.remove(item.id);
      toast.push('Removed.', 'success');
      load();
    } catch (e) { toast.push('Remove failed: ' + e.message, 'error'); }
  }

  function move(idx, delta) {
    setItems((xs) => {
      const next = [...xs];
      const j = idx + delta;
      if (j < 0 || j >= next.length) return xs;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next.map((x, i) => ({ ...x, position: i }));
    });
  }

  if (loading) return <div><h1>Navigation</h1><p><window.Spinner /></p></div>;

  const used = new Set(items.map((i) => i.view));
  const available = KNOWN_VIEWS.filter((v) => !used.has(v.view));

  return (
    <div>
      <h1>Dashboard navigation</h1>
      <p className="subhead">
        Drag-free reordering, rename, change icons, toggle visibility. The
        public dashboard re-fetches automatically the moment you save.
      </p>

      <div className="card">
        <h3>Top nav strip</h3>
        <table className="tbl">
          <thead>
            <tr>
              <th>Order</th>
              <th>Icon</th>
              <th>Label</th>
              <th>View key</th>
              <th>Visible</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id || it.view}>
                <td style={{ width: 80 }}>
                  <button className="btn-link" disabled={idx === 0} onClick={() => move(idx, -1)}>↑</button>
                  &nbsp;
                  <button className="btn-link" disabled={idx === items.length - 1} onClick={() => move(idx, +1)}>↓</button>
                </td>
                <td style={{ width: 60 }}>
                  <input value={it.icon || ''} onChange={(e) => patch(idx, 'icon', e.target.value)}
                         style={{ width: 50, textAlign: 'center', fontFamily: 'var(--font-mono)' }} />
                </td>
                <td>
                  <input value={it.label} onChange={(e) => patch(idx, 'label', e.target.value)} />
                </td>
                <td style={{ width: 160 }}>
                  <input value={it.view} onChange={(e) => patch(idx, 'view', e.target.value)} className="mono small" />
                </td>
                <td style={{ width: 100 }}>
                  <input type="checkbox" checked={!!it.visible}
                         onChange={(e) => patch(idx, 'visible', e.target.checked)} />
                </td>
                <td className="right">
                  <button className="btn-link" onClick={() => save(it)}>save</button>
                  &nbsp;·&nbsp;
                  <button className="btn-link" onClick={() => remove(it)} style={{ color: 'var(--danger)' }}>remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button className="btn" disabled={busy} onClick={saveAll}>
            {busy ? <window.Spinner /> : 'Save all (incl. reorder)'}
          </button>
        </div>
      </div>

      {available.length > 0 && (
        <div className="card">
          <h3>Add a dashboard view</h3>
          <p className="small muted">Built-in views that aren't on the nav yet.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {available.map((v) => (
              <button key={v.view} className="btn ghost" onClick={() => add(v.view)}>
                <span className="mono">{v.icon}</span> {v.label}
                &nbsp;<span className="muted small">({v.view})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3>Pages & content the dashboard renders</h3>
        <p className="small muted">
          The dashboard reads the following content blocks from <span className="mono">Pages & content</span>.
          Edit them there; the dashboard refreshes live.
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {[
            ['intro', 'Hero subtitle / intro'],
            ['map-intro', 'Map view description'],
            ['directory-intro', 'Directory view description'],
            ['acknowledgement', 'Land acknowledgement'],
            ['contact', 'Contact panel'],
          ].map(([slug, label]) => (
            <li key={slug} style={{ padding: '6px 0', borderTop: '1px dotted var(--border)' }}>
              <span className="mono small muted">{slug}</span> &nbsp; {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
window.NavigationView = NavigationView;
