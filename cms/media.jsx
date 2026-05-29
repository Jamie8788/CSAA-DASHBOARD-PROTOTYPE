/* global React, API */
const { useState: useS_m, useEffect: useE_m, useRef: useR_m } = React;

function MediaView() {
  const toast = window.useToast();
  const [items, setItems] = useS_m([]);
  const [loading, setLoading] = useS_m(true);
  const [busy, setBusy] = useS_m(false);
  const [filter, setFilter] = useS_m('');
  const fileRef = useR_m(null);

  async function load() {
    setLoading(true);
    try {
      const r = await API.media.list();
      setItems(r.items || []);
    } catch (e) { toast.push('Load failed: ' + e.message, 'error'); }
    finally { setLoading(false); }
  }
  useE_m(() => { load(); }, []);

  async function upload(files) {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      for (const f of files) {
        await API.media.upload(f);
      }
      toast.push(`Uploaded ${files.length} file${files.length === 1 ? '' : 's'}.`, 'success');
      load();
    } catch (e) { toast.push('Upload failed: ' + e.message, 'error'); }
    finally { setBusy(false); }
  }

  async function remove(id) {
    if (!confirm('Delete this file? Anywhere it is used (image blocks, OG image, etc.) will break.')) return;
    try { await API.media.remove(id); toast.push('Deleted.', 'success'); load(); }
    catch (e) { toast.push('Delete failed: ' + e.message, 'error'); }
  }

  function copyUrl(id) {
    const url = location.origin + API.media.url(id);
    navigator.clipboard?.writeText(url);
    toast.push(`Copied ${url}`, 'success', 2000);
  }

  const filtered = items.filter((m) =>
    !filter || (m.filename || '').toLowerCase().includes(filter.toLowerCase()));

  return (
    <div>
      <h1>Media library</h1>
      <p className="subhead">
        Upload images here once; reference them anywhere as
        <span className="mono small"> /api/media/&lt;id&gt; </span>. Limit 5 MB
        per file. Supported: JPEG, PNG, WebP, GIF, SVG, AVIF.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-grid">
          <div>
            <label>Filter by filename</label>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search…" />
          </div>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? <window.Spinner /> : '↑ Upload images'}
            </button>
            <input ref={fileRef} type="file" hidden multiple
                   accept="image/*"
                   onChange={(e) => upload(e.target.files)} />
          </div>
        </div>
      </div>

      {loading ? <p className="muted">Loading…</p> :
        filtered.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <p className="muted">No media yet. Click "Upload images" to add some.</p>
          </div>
        ) : (
          <div className="media-grid">
            {filtered.map((m) => (
              <div key={m.id} className="media-card">
                <div className="media-thumb">
                  <img src={API.media.url(m.id)} alt={m.alt_text || m.filename} loading="lazy" />
                </div>
                <div className="media-meta">
                  <strong>{m.filename}</strong>
                  <span className="muted small">
                    {m.mime_type} · {Math.round((m.size_bytes || 0) / 1024)} KB
                  </span>
                  <span className="muted small">{window.formatTime(m.uploaded_at)}</span>
                </div>
                <div className="media-actions">
                  <button className="btn-link" onClick={() => copyUrl(m.id)}>copy url</button>
                  <button className="btn-link" onClick={() => remove(m.id)} style={{ color: 'var(--danger)' }}>delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
window.MediaView = MediaView;
