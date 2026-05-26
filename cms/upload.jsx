/* global React, API */
const { useState: useState_up, useRef: useRef_up, useEffect: useEffect_up } = React;

function UploadView() {
  const toast = window.useToast();
  const [busy, setBusy] = useState_up(false);
  const [dragover, setDragover] = useState_up(false);
  const [versions, setVersions] = useState_up([]);
  const [audit, setAudit] = useState_up([]);
  const fileRef = useRef_up(null);

  async function refresh() {
    try {
      const [v, a] = await Promise.all([API.communities.versions(), API.audit(20)]);
      setVersions(v.versions || []);
      setAudit(a.events || []);
    } catch (e) { /* unauth handled by app */ }
  }

  useEffect_up(() => { refresh(); }, []);

  async function doUpload(file) {
    if (!file) return;
    setBusy(true);
    try {
      const res = await API.communities.upload(file);
      toast.push(`Uploaded ${file.name} — v${res.version}, ${res.records} records`, 'success');
      refresh();
    } catch (e) {
      toast.push('Upload failed: ' + e.message, 'error', 6000);
    } finally { setBusy(false); }
  }

  async function activate(v) {
    if (!confirm(`Activate dataset version ${v}? This will replace the live dataset.`)) return;
    try {
      await API.communities.activate(v);
      toast.push(`Activated v${v}`, 'success');
      refresh();
    } catch (e) { toast.push('Activate failed: ' + e.message, 'error'); }
  }

  return (
    <div>
      <h1>Upload data</h1>
      <p className="subhead">
        Drop your master Excel sheet (.xlsx, .xls, or .csv). The server parses it with the
        same rules as <span className="mono">tools/process_sheet.py</span> and republishes
        the dashboard live.
      </p>

      <div
        className={`dropzone${dragover ? ' dragover' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
        onDragLeave={() => setDragover(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragover(false);
          if (e.dataTransfer.files && e.dataTransfer.files[0]) doUpload(e.dataTransfer.files[0]);
        }}
        onClick={() => fileRef.current && fileRef.current.click()}
        role="button" tabIndex={0}
      >
        <div className="ico">{busy ? <window.Spinner size={28} /> : '⌹'}</div>
        <p style={{ fontWeight: 600, color: 'var(--ink)' }}>
          {busy ? 'Processing…' : 'Drop a file here — or click to choose'}
        </p>
        <p className="small">.xlsx, .xls, .csv up to 50 MB</p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden
               onChange={(e) => doUpload(e.target.files && e.target.files[0])} />
      </div>

      <h2 style={{ marginTop: 32 }}>Dataset versions</h2>
      <p className="subhead">Every upload is versioned. Activate any prior version to roll back instantly.</p>
      <table className="tbl">
        <thead>
          <tr>
            <th>v</th><th>File</th><th>Uploaded by</th><th>When</th>
            <th className="right">Records</th><th></th>
          </tr>
        </thead>
        <tbody>
          {versions.length === 0 && <tr><td colSpan="6" className="muted">No uploads yet.</td></tr>}
          {versions.map((v) => (
            <tr key={v.id}>
              <td className="mono">v{v.version}</td>
              <td>{v.source_filename || '—'}</td>
              <td>{v.uploaded_by || '—'}</td>
              <td>{window.formatTime(v.uploaded_at)}</td>
              <td className="right mono">{v.record_count}</td>
              <td className="right">
                {v.is_current
                  ? <span className="tag">current</span>
                  : <button className="btn-link" onClick={() => activate(v.version)}>activate</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32 }}>Recent activity</h2>
      <table className="tbl">
        <thead>
          <tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Detail</th></tr>
        </thead>
        <tbody>
          {audit.length === 0 && <tr><td colSpan="5" className="muted">No activity yet.</td></tr>}
          {audit.map((a) => (
            <tr key={a.id}>
              <td className="mono small">{window.formatTime(a.at)}</td>
              <td>{a.actor || 'system'}</td>
              <td className="mono small">{a.action}</td>
              <td className="small">{a.target || '—'}</td>
              <td className="small muted">{a.detail || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
window.UploadView = UploadView;
