/* global React, API */
const { useState: useState_c, useEffect: useEffect_c, useMemo: useMemo_c } = React;

const PILLAR_FIELDS = [
  ['physical', 'Physical Health'],
  ['mental', 'Mental Health'],
  ['spiritual', 'Spiritual Support'],
  ['emotional', 'Emotional Support'],
  ['youth', 'Youth Programming'],
  ['survivors', 'Survivor Support'],
  ['connect', 'Connecting Generations'],
];

const SCALAR_FIELDS = [
  ['name', 'Name'],
  ['link', 'Website'],
  ['contact', 'Contact / Staff list'],
  ['population', 'Population'],
  ['populationNote', 'Population notes'],
  ['strategicPlan', 'Strategic plan'],
  ['agm', 'AGM / Annual report'],
  ['financials', 'Financials'],
  ['notes', 'Internal notes'],
];

function CommunitiesView() {
  const toast = window.useToast();
  const [data, setData] = useState_c({ records: [], count: 0 });
  const [loading, setLoading] = useState_c(true);
  const [q, setQ] = useState_c('');
  const [dir, setDir] = useState_c('');
  const [type, setType] = useState_c('');
  const [editing, setEditing] = useState_c(null);

  async function load() {
    setLoading(true);
    try {
      const res = await API.communities.list();
      setData(res);
    } catch (e) {
      toast.push('Failed to load: ' + e.message, 'error');
    } finally { setLoading(false); }
  }
  useEffect_c(() => { load(); }, []);

  const filtered = useMemo_c(() => {
    const qq = q.trim().toLowerCase();
    return (data.records || []).filter((r) => {
      if (dir && r.direction !== dir) return false;
      if (type && r.type !== type) return false;
      if (!qq) return true;
      const blob = [r.name, r.contact, r.physical, r.mental, r.spiritual,
                    r.emotional, r.notes, r.section].join(' ').toLowerCase();
      return blob.includes(qq);
    });
  }, [data, q, dir, type]);

  const allDirections = useMemo_c(() => {
    const s = new Set((data.records || []).map((r) => r.direction).filter(Boolean));
    return Array.from(s).sort();
  }, [data]);
  const allTypes = useMemo_c(() => {
    const s = new Set((data.records || []).map((r) => r.type).filter(Boolean));
    return Array.from(s).sort();
  }, [data]);

  async function saveEdit(community, fields) {
    try {
      await API.communities.edit(community.id, { fields });
      toast.push('Saved.', 'success');
      setEditing(null);
      load();
    } catch (e) { toast.push('Save failed: ' + e.message, 'error'); }
  }

  async function remove(community) {
    if (!confirm(`Delete "${community.name}"? This hides it from the dashboard but is reversible via DB.`)) return;
    try {
      await API.communities.remove(community.id);
      toast.push('Deleted.', 'success');
      load();
    } catch (e) { toast.push('Delete failed: ' + e.message, 'error'); }
  }

  return (
    <div>
      <h1>Communities</h1>
      <p className="subhead">
        {loading ? 'Loading…' : `${data.count} records · dataset v${data.datasetVersion}`}
        {data.datasetSource && <> · source <span className="mono">{data.datasetSource}</span></>}
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-grid">
          <div>
            <label>Search</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, contact, narrative…" />
          </div>
          <div>
            <label>Direction</label>
            <select value={dir} onChange={(e) => setDir(e.target.value)}>
              <option value="">All</option>
              {allDirections.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All</option>
              {allTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      <table className="tbl">
        <thead>
          <tr>
            <th>Name</th>
            <th>Direction</th>
            <th>Type</th>
            <th>Pillars</th>
            <th>Population</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => {
            const pillars = ['Physical','Mental','Spiritual','Emotional']
              .filter((k) => r['has' + k]);
            return (
              <tr key={r.id || r.name}>
                <td>
                  <strong>{r.name}</strong>
                  {r.section && <div className="small muted">{r.section}</div>}
                </td>
                <td>{r.direction && <span className={`tag dir-${r.direction}`}>{r.direction}</span>}</td>
                <td className="small">{r.type || '—'}</td>
                <td className="small mono">{pillars.join(' · ') || '—'}</td>
                <td className="small mono right">{r.population || '—'}</td>
                <td className="right">
                  <button className="btn-link" onClick={() => setEditing(r)}>edit</button>
                  &nbsp;·&nbsp;
                  <button className="btn-link" onClick={() => remove(r)} style={{ color: 'var(--danger)' }}>delete</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {editing && (
        <EditDrawer
          community={editing}
          onClose={() => setEditing(null)}
          onSave={(fields) => saveEdit(editing, fields)}
        />
      )}
    </div>
  );
}
window.CommunitiesView = CommunitiesView;

function EditDrawer({ community, onClose, onSave }) {
  const [draft, setDraft] = useState_c(() => {
    const out = {};
    [...SCALAR_FIELDS, ...PILLAR_FIELDS].forEach(([k]) => { out[k] = community[k] || ''; });
    out.direction = community.direction || '';
    out.type = community.type || '';
    out.lat = community.lat || '';
    out.lon = community.lon || '';
    return out;
  });

  function setF(k, v) { setDraft((d) => ({ ...d, [k]: v })); }

  function save() {
    const changed = {};
    [...SCALAR_FIELDS, ...PILLAR_FIELDS].forEach(([k]) => {
      if ((draft[k] || '') !== (community[k] || '')) changed[k] = draft[k];
    });
    ['direction', 'type'].forEach((k) => {
      if ((draft[k] || '') !== (community[k] || '')) changed[k] = draft[k];
    });
    ['lat', 'lon'].forEach((k) => {
      const cur = community[k] || '';
      const next = draft[k] === '' ? '' : Number(draft[k]);
      if (String(cur) !== String(next)) changed[k] = next === '' ? null : next;
    });
    onSave(changed);
  }

  return (
    <div className="edit-panel">
      <button className="close" onClick={onClose} aria-label="Close">×</button>
      <h2 style={{ marginTop: 0 }}>Edit · {community.name}</h2>
      <p className="small muted">Changes save to the audit log and apply on top of the dataset live.</p>

      <h3 className="muted small" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 24 }}>Identity</h3>
      <div className="form-grid">
        {SCALAR_FIELDS.slice(0, 3).map(([k, label]) => (
          <div className="form-row" key={k}>
            <label>{label}</label>
            {k === 'contact'
              ? <textarea value={draft[k]} onChange={(e) => setF(k, e.target.value)} />
              : <input value={draft[k]} onChange={(e) => setF(k, e.target.value)} />}
          </div>
        ))}
        <div className="form-row">
          <label>Direction</label>
          <select value={draft.direction} onChange={(e) => setF('direction', e.target.value)}>
            <option value="">—</option>
            {['East','South','West','North','Central'].map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Type</label>
          <input value={draft.type} onChange={(e) => setF('type', e.target.value)} />
        </div>
        <div className="form-row">
          <label>Latitude</label>
          <input type="number" step="any" value={draft.lat} onChange={(e) => setF('lat', e.target.value)} />
        </div>
        <div className="form-row">
          <label>Longitude</label>
          <input type="number" step="any" value={draft.lon} onChange={(e) => setF('lon', e.target.value)} />
        </div>
      </div>

      <h3 className="muted small" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 24 }}>Service pillars</h3>
      {PILLAR_FIELDS.map(([k, label]) => (
        <div className="form-row" key={k}>
          <label>{label}</label>
          <textarea value={draft[k]} onChange={(e) => setF(k, e.target.value)} />
        </div>
      ))}

      <h3 className="muted small" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 24 }}>Governance</h3>
      {SCALAR_FIELDS.slice(3).map(([k, label]) => (
        <div className="form-row" key={k}>
          <label>{label}</label>
          <textarea value={draft[k]} onChange={(e) => setF(k, e.target.value)} />
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <button className="btn" onClick={save}>Save changes</button>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
