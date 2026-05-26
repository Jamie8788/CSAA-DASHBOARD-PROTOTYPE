/* global React, API */
const { useState: useState_p, useEffect: useEffect_p } = React;

function PagesView() {
  const toast = window.useToast();
  const [pages, setPages] = useState_p([]);
  const [loading, setLoading] = useState_p(true);
  const [editing, setEditing] = useState_p(null);
  const [creating, setCreating] = useState_p(false);

  async function load() {
    setLoading(true);
    try {
      const r = await API.pages.list();
      setPages(r.pages || []);
    } catch (e) { toast.push('Load failed: ' + e.message, 'error'); }
    finally { setLoading(false); }
  }
  useEffect_p(() => { load(); }, []);

  async function save(payload) {
    try {
      await API.pages.upsert(payload.slug, payload);
      toast.push('Page saved.', 'success');
      setEditing(null); setCreating(false);
      load();
    } catch (e) { toast.push('Save failed: ' + e.message, 'error'); }
  }

  async function remove(slug) {
    if (!confirm(`Delete page "${slug}"?`)) return;
    try {
      await API.pages.remove(slug);
      toast.push('Deleted.', 'success');
      load();
    } catch (e) { toast.push('Delete failed: ' + e.message, 'error'); }
  }

  if (loading) return <div><h1>Pages & content</h1><p><window.Spinner /></p></div>;

  return (
    <div>
      <h1>Pages & content blocks</h1>
      <p className="subhead">
        Editable text blocks shown on the public dashboard. The intro, land
        acknowledgement, contact panel, and any other narrative panels.
      </p>

      <div style={{ marginBottom: 16 }}>
        <button className="btn" onClick={() => setCreating(true)}>+ New page</button>
      </div>

      <table className="tbl">
        <thead>
          <tr>
            <th>Slug</th><th>Title</th><th>Visible</th><th>Updated</th><th>By</th><th></th>
          </tr>
        </thead>
        <tbody>
          {pages.length === 0 && <tr><td colSpan="6" className="muted">No pages yet.</td></tr>}
          {pages.map((p) => (
            <tr key={p.slug}>
              <td className="mono small">{p.slug}</td>
              <td><strong>{p.title}</strong>
                <div className="small muted">{(p.body || '').slice(0, 80)}…</div></td>
              <td><span className="tag">{p.visible ? 'visible' : 'hidden'}</span></td>
              <td className="small">{window.formatTime(p.updated_at)}</td>
              <td className="small">{p.updated_by || '—'}</td>
              <td className="right">
                <button className="btn-link" onClick={() => setEditing(p)}>edit</button>
                &nbsp;·&nbsp;
                <button className="btn-link" onClick={() => remove(p.slug)} style={{ color: 'var(--danger)' }}>delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {(editing || creating) && (
        <PageEditor
          page={editing}
          isNew={creating}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSave={save}
        />
      )}
    </div>
  );
}
window.PagesView = PagesView;

function PageEditor({ page, isNew, onClose, onSave }) {
  const [slug, setSlug] = useState_p(page ? page.slug : '');
  const [title, setTitle] = useState_p(page ? page.title : '');
  const [body, setBody] = useState_p(page ? page.body : '');
  const [visible, setVisible] = useState_p(page ? !!page.visible : true);

  return (
    <div className="edit-panel">
      <button className="close" onClick={onClose}>×</button>
      <h2 style={{ marginTop: 0 }}>{isNew ? 'New page' : `Edit: ${page.title}`}</h2>

      <div className="form-row">
        <label>Slug (URL identifier)</label>
        <input value={slug}
               onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
               disabled={!isNew}
               placeholder="e.g. intro" />
      </div>

      <div className="form-row">
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="form-row">
        <label>Body (Markdown / plain text)</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 280 }} />
      </div>

      <div className="form-row">
        <label>
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
          &nbsp;<span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>Visible on dashboard</span>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn"
                disabled={!slug || !title}
                onClick={() => onSave({ slug, title, body, visible })}>
          Save page
        </button>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
      </div>

      <p className="small muted" style={{ marginTop: 16 }}>
        The dashboard fetches <span className="mono">/api/pages?visible_only=true</span> on load
        and can render any page by its slug.
      </p>
    </div>
  );
}
