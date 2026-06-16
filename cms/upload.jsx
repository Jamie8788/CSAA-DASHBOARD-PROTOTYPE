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

  const [gsId, setGsId] = useState_up('');
  const [gsKey, setGsKey] = useState_up('');
  const [gsBusy, setGsBusy] = useState_up(false);
  async function syncGsheet() {
    setGsBusy(true);
    try {
      const res = await API.communities.syncGsheet(gsId.trim(), gsKey.trim());
      toast.push(`Synced from Google Sheet — v${res.version}, ${res.records} records, ${res.fieldLinks} links`, 'success', 6000);
      refresh();
    } catch (e) {
      toast.push('Google Sheet sync failed: ' + e.message, 'error', 7000);
    } finally { setGsBusy(false); }
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

      <div className="gsheet-sync">
        <h2 style={{ marginTop: 32 }}>Sync from Google Sheet <span className="tag" style={{verticalAlign:'middle'}}>keeps every link</span></h2>
        <p className="subhead">
          Reads the live Google Sheet through the Sheets API. Unlike .xlsx upload, this keeps
          <strong> every in-cell link</strong> (Excel export drops all but the first link in a cell).
          Share the Sheet as “anyone with the link can view”, create a Google API key, and paste both below.
          They’re saved, so next time just click Sync.
        </p>
        <div className="gsheet-row">
          <input type="text" placeholder="Google Sheet URL or ID" value={gsId}
                 onChange={(e) => setGsId(e.target.value)} className="gsheet-input" />
          <input type="password" placeholder="Google API key (saved securely)" value={gsKey}
                 onChange={(e) => setGsKey(e.target.value)} className="gsheet-input" />
          <button className="btn" onClick={syncGsheet} disabled={gsBusy}>
            {gsBusy ? <window.Spinner size={16} /> : '↻ Sync now'}
          </button>
        </div>
        <p className="small muted">Leave the key blank to reuse a previously saved key or one set via the GOOGLE_SHEETS_API_KEY env var.</p>
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
