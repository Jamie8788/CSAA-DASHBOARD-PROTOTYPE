/* global React, API */
const { useState: useState_s, useEffect: useEffect_s } = React;

const SETTING_GROUPS = [
  {
    title: 'Site identity',
    keys: [
      { key: 'site.title', label: 'Site title', type: 'text' },
      { key: 'site.tagline', label: 'Tagline / sub-title', type: 'textarea' },
      { key: 'site.accent', label: 'Accent colour (CSS)', type: 'color' },
      { key: 'site.theme', label: 'Default theme', type: 'select',
        options: ['paper', 'dawn', 'forest', 'midnight'] },
    ],
  },
  {
    title: 'Features',
    keys: [
      { key: 'site.showJourneyGame', label: 'Show Journey Game tab', type: 'bool' },
      { key: 'site.showStoriesView', label: 'Show Stories view', type: 'bool' },
      { key: 'site.showAnalyticsView', label: 'Show Analytics view', type: 'bool' },
      { key: 'site.elderModeDefault', label: 'Elder mode on by default', type: 'bool' },
    ],
  },
  {
    title: 'SEO & social',
    keys: [
      { key: 'site.metaDescription', label: 'Meta description (Google snippet)', type: 'textarea' },
      { key: 'site.metaKeywords',    label: 'Meta keywords (comma-separated)',   type: 'text' },
      { key: 'site.metaAuthor',      label: 'Author / project name',             type: 'text' },
      { key: 'site.ogImage',         label: 'OG / Twitter share image URL',      type: 'text' },
      { key: 'site.canonicalUrl',    label: 'Canonical site URL (https://…)',    type: 'text' },
      { key: 'site.twitterCard',     label: 'Twitter card type',                 type: 'select',
        options: ['summary', 'summary_large_image'] },
      { key: 'site.robotsAllow',     label: 'Allow search engines (robots.txt)', type: 'bool' },
    ],
  },
  {
    title: 'Admin',
    keys: [
      { key: 'admin.allowSelfSignup', label: 'Allow editor self-signup', type: 'bool' },
    ],
  },
];

function SettingsView() {
  const toast = window.useToast();
  const [values, setValues] = useState_s({});
  const [dirty, setDirty] = useState_s({});
  const [loading, setLoading] = useState_s(true);
  const [busy, setBusy] = useState_s(false);
  const [health, setHealth] = useState_s(null);

  async function load() {
    setLoading(true);
    try {
      const [v, h] = await Promise.all([API.settings.get(), API.health()]);
      setValues(v); setDirty({});
      setHealth(h);
    } catch (e) { toast.push('Load failed: ' + e.message, 'error'); }
    finally { setLoading(false); }
  }
  useEffect_s(() => { load(); }, []);

  async function resetAll() {
    if (!confirm('Reset ALL site settings back to defaults? Pages, communities, and admin accounts are not affected.')) return;
    setBusy(true);
    try {
      const next = await API.settings.reset();
      setValues(next); setDirty({});
      toast.push('Settings reset to defaults.', 'success');
    } catch (e) { toast.push('Reset failed: ' + e.message, 'error'); }
    finally { setBusy(false); }
  }

  function set(k, v) {
    setValues((vs) => ({ ...vs, [k]: v }));
    setDirty((d) => ({ ...d, [k]: true }));
  }

  async function save() {
    const changed = Object.keys(dirty).reduce((acc, k) => {
      acc[k] = values[k]; return acc;
    }, {});
    if (Object.keys(changed).length === 0) return;
    setBusy(true);
    try {
      const next = await API.settings.update(changed);
      setValues(next); setDirty({});
      toast.push('Settings saved.', 'success');
    } catch (e) { toast.push('Save failed: ' + e.message, 'error'); }
    finally { setBusy(false); }
  }

  if (loading) return <div><h1>Settings</h1><p className="subhead"><window.Spinner /> Loading…</p></div>;

  const dirtyCount = Object.keys(dirty).length;

  return (
    <div>
      <h1>Site settings</h1>
      <p className="subhead">
        Control how the public dashboard looks and behaves. Changes apply
        live on next page load.
      </p>

      {health && !health.persistent && (
        <div className="card" style={{ background: 'rgba(184,53,30,0.08)', borderColor: 'var(--danger)' }}>
          <h3 style={{ color: 'var(--danger)' }}>⚠ Data will NOT persist across redeploys</h3>
          <p className="small">
            The backend is using <strong>SQLite</strong> on Render's ephemeral disk. Every redeploy
            wipes uploads, edits, settings, pages, and admin user history.
          </p>
          <p className="small muted">
            To fix: in Render → <strong>Environment</strong> → set <code className="mono">DATABASE_URL</code> to
            your Supabase Session pooler connection string. Render redeploys
            and the next boot will use Postgres.
            Detected backend: <code className="mono">{health.backend}</code>.
          </p>
        </div>
      )}
      {health && health.persistent && (
        <div className="card" style={{ background: 'rgba(107,141,107,0.10)', borderColor: 'var(--good)' }}>
          <p className="small" style={{ margin: 0 }}>
            ✓ Backend: <code className="mono">{health.backend}</code> — your changes persist across redeploys.
          </p>
        </div>
      )}

      {SETTING_GROUPS.map((group) => (
        <div className="card" key={group.title}>
          <h3>{group.title}</h3>
          <div className="form-grid">
            {group.keys.map((field) => (
              <SettingField
                key={field.key}
                field={field}
                value={values[field.key] || ''}
                onChange={(v) => set(field.key, v)}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="card">
        <h3>Advanced — all settings</h3>
        <p className="small muted">Raw key/value editor for anything not in the groups above.</p>
        <table className="tbl">
          <thead><tr><th>Key</th><th>Value</th></tr></thead>
          <tbody>
            {Object.entries(values).map(([k, v]) => (
              <tr key={k}>
                <td className="mono small">{k}</td>
                <td><input value={v} onChange={(e) => set(k, e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ position: 'sticky', bottom: 16, marginTop: 24, display: 'flex', gap: 8 }}>
        <button className="btn" disabled={busy || dirtyCount === 0} onClick={save}>
          {busy ? <window.Spinner /> : `Save ${dirtyCount} change${dirtyCount === 1 ? '' : 's'}`}
        </button>
        <button className="btn ghost" disabled={busy} onClick={resetAll}
                title="Restore every site setting to its first-boot default">
          ⟲ Reset to defaults
        </button>
      </div>
    </div>
  );
}
window.SettingsView = SettingsView;

function SettingField({ field, value, onChange }) {
  switch (field.type) {
    case 'textarea':
      return (
        <div className="form-row">
          <label>{field.label}</label>
          <textarea value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case 'color':
      return (
        <div className="form-row">
          <label>{field.label}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="color" value={value || '#b8351e'} onChange={(e) => onChange(e.target.value)} style={{ width: 60, padding: 0, height: 38 }} />
            <input value={value} onChange={(e) => onChange(e.target.value)} />
          </div>
        </div>
      );
    case 'select':
      return (
        <div className="form-row">
          <label>{field.label}</label>
          <select value={value} onChange={(e) => onChange(e.target.value)}>
            {field.options.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
      );
    case 'bool':
      return (
        <div className="form-row">
          <label>{field.label}</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: 'var(--ink)' }}>
            <input type="checkbox" checked={value === 'true' || value === true}
                   onChange={(e) => onChange(e.target.checked ? 'true' : 'false')} />
            <span className="small muted">{value === 'true' ? 'enabled' : 'disabled'}</span>
          </label>
        </div>
      );
    default:
      return (
        <div className="form-row">
          <label>{field.label}</label>
          <input value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
  }
}
