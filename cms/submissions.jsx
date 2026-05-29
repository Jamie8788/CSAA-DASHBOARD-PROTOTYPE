/* global React, API */
const { useState: useS_s, useEffect: useE_s } = React;

function SubmissionsView() {
  const toast = window.useToast();
  const [data, setData] = useS_s({ items: [], summary: { total: 0, unread: 0 } });
  const [loading, setLoading] = useS_s(true);
  const [form, setForm] = useS_s('');
  const [opened, setOpened] = useS_s(null);

  async function load() {
    setLoading(true);
    try {
      const r = await API.submissions.list(form || null);
      setData(r);
    } catch (e) { toast.push('Load failed: ' + e.message, 'error'); }
    finally { setLoading(false); }
  }
  useE_s(() => { load(); }, [form]);

  async function open(s) {
    setOpened(s);
    if (!s.read_at) {
      try { await API.submissions.markRead(s.id); load(); } catch (e) {}
    }
  }
  async function remove(s) {
    if (!confirm(`Delete this submission to "${s.form_slug}"?`)) return;
    try { await API.submissions.remove(s.id); toast.push('Deleted.', 'success');
          setOpened(null); load(); }
    catch (e) { toast.push(e.message, 'error'); }
  }

  const forms = Array.from(new Set(data.items.map((s) => s.form_slug))).sort();

  return (
    <div>
      <h1>Form submissions</h1>
      <p className="subhead">
        Visitor inquiries from form blocks on the dashboard.
        <strong> {data.summary.total} total</strong> ·
        <strong> {data.summary.unread} unread</strong>.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row">
          <label>Filter by form</label>
          <select value={form} onChange={(e) => setForm(e.target.value)}>
            <option value="">All forms</option>
            {forms.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {loading ? <p className="muted">Loading…</p> :
        data.items.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <p className="muted">No submissions yet. Add a form block to the dashboard via Page Builder.</p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>Form</th><th>Received</th><th>Status</th><th>Preview</th><th></th></tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.id} className={!s.read_at ? 'unread' : ''}>
                  <td><span className="tag">{s.form_slug}</span></td>
                  <td className="small">{window.formatTime(s.received_at)}</td>
                  <td>{s.read_at ? <span className="muted small">read</span>
                                  : <strong className="small" style={{ color: 'var(--south)' }}>● unread</strong>}</td>
                  <td className="small">
                    {Object.entries(s.payload || {}).slice(0, 2).map(([k, v]) =>
                      <span key={k} style={{ marginRight: 12 }}>
                        <strong>{k}:</strong> {String(v).slice(0, 40)}
                      </span>
                    )}
                  </td>
                  <td className="right">
                    <button className="btn-link" onClick={() => open(s)}>view</button>&nbsp;·&nbsp;
                    <button className="btn-link" style={{ color: 'var(--danger)' }}
                            onClick={() => remove(s)}>delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      {opened && (
        <div className="edit-panel">
          <button className="close" onClick={() => setOpened(null)}>×</button>
          <h2 style={{ marginTop: 0 }}>Submission</h2>
          <p className="small muted">
            <strong>Form:</strong> {opened.form_slug} ·
            <strong> Received:</strong> {window.formatTime(opened.received_at)}
          </p>
          <dl>
            {Object.entries(opened.payload || {}).map(([k, v]) => (
              <React.Fragment key={k}>
                <dt>{k}</dt>
                <dd style={{ whiteSpace: 'pre-wrap' }}>{String(v)}</dd>
              </React.Fragment>
            ))}
          </dl>
          <p className="small muted" style={{ marginTop: 24 }}>
            IP: {opened.visitor_ip || '—'} · UA: {(opened.visitor_ua || '').slice(0, 80)}…
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn danger" onClick={() => remove(opened)}>Delete</button>
            <button className="btn ghost" onClick={() => setOpened(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
window.SubmissionsView = SubmissionsView;
