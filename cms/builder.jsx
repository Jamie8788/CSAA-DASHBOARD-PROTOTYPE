/* global React, API */
/*
 * Page Builder — state-of-the-art CMS view.
 *
 *   Left  : section tree of the public dashboard. Each section shows its
 *           current state and links to the right editor (page, setting,
 *           nav item) so the admin sees the whole site at a glance.
 *   Right : live iframe of the public dashboard, sandboxed. Auto-refreshes
 *           on every CMS change via SSE — admin sees their edits land in
 *           real time, side-by-side.
 *
 * No drag-on-canvas (the dashboard is a SPA with complex React state),
 * but the tree is fully interactive: click a section → open the right
 * editor; hover → highlight; show/hide → toggles dashboard visibility
 * via the relevant setting or nav item.
 */
const { useState: useState_b, useEffect: useEffect_b, useRef: useRef_b,
        useMemo: useMemo_b, useCallback: useCallback_b } = React;

// Map of dashboard sections to which CMS entity (page / setting / nav) controls them.
const DASHBOARD_STRUCTURE = [
  {
    group: 'Header',
    sections: [
      { key: 'banner',  label: 'Status banner',
        description: 'The dark top strip with rotating facts and season.',
        controls: [{ kind: 'setting', key: 'site.title', label: 'Site title' }] },
      { key: 'hero',    label: 'Hero',
        description: 'Big editorial title, tagline, big stats (Communities / Partners / People).',
        controls: [
          { kind: 'setting', key: 'site.title',   label: 'Site title' },
          { kind: 'setting', key: 'site.tagline', label: 'Tagline / subtitle' },
          { kind: 'page',    key: 'intro',         label: 'Intro page content' },
        ] },
      { key: 'nav',     label: 'Top navigation strip',
        description: 'Map / Directory / Stories / Insights / Coverage tabs.',
        controls: [{ kind: 'nav', label: 'Reorder / rename / hide tabs' }] },
    ],
  },
  {
    group: 'Main content',
    sections: [
      { key: 'filter',  label: 'Filter rail (left)',
        description: 'Region, direction, service pillar, population filters.',
        controls: [{ kind: 'info', label: 'Auto-built from the master sheet' }] },
      { key: 'map',     label: 'Map view',
        description: 'Leaflet map with custom medicine-wheel markers, clusters, and the direction compass.',
        controls: [
          { kind: 'page', key: 'map-intro', label: 'Map view description' },
        ] },
      { key: 'directory', label: 'Directory cards',
        description: 'Grid of community cards under the map; sort by name / population / completeness.',
        controls: [
          { kind: 'page', key: 'directory-intro', label: 'Directory view description' },
        ] },
      { key: 'drawer',  label: 'Detail drawer',
        description: 'Right-hand panel that opens when a community is clicked. All editable per-record from the Communities tab.',
        controls: [{ kind: 'jump', view: 'communities', label: 'Edit community records' }] },
    ],
  },
  {
    group: 'Auxiliary views',
    sections: [
      { key: 'stories', label: 'Community Stories tab',
        description: 'Tab that surfaces real quotes from the master sheet.',
        controls: [
          { kind: 'setting', key: 'site.showStoriesView', label: 'Show / hide tab' },
        ] },
      { key: 'stats',   label: 'Insights & Stories tab',
        description: 'In-page analytics view.',
        controls: [
          { kind: 'setting', key: 'site.showAnalyticsView', label: 'Show / hide tab' },
        ] },
      { key: 'coverage',label: 'Coverage (85) tab',
        description: 'Cross-references the master sheet against the official 85-community list.',
        controls: [
          { kind: 'setting', key: 'site.showCoverageView', label: 'Show / hide tab' },
        ] },
      { key: 'journey', label: 'Journey Game',
        description: 'Sacred-direction journey mini-game.',
        controls: [
          { kind: 'setting', key: 'site.showJourneyGame', label: 'Show / hide tab' },
        ] },
    ],
  },
  {
    group: 'Footer / global',
    sections: [
      { key: 'acknowledge', label: 'Land acknowledgement',
        description: 'Honouring the original peoples — shown in headers and footer.',
        controls: [{ kind: 'page', key: 'acknowledgement', label: 'Acknowledgement copy' }] },
      { key: 'contact', label: 'Contact panel',
        description: 'Reach the project team.',
        controls: [{ kind: 'page', key: 'contact', label: 'Contact copy' }] },
      { key: 'theme', label: 'Theme & accent',
        description: 'Theme presets (paper / dawn / forest / midnight) and the accent color used across the site.',
        controls: [
          { kind: 'setting', key: 'site.theme',  label: 'Theme' },
          { kind: 'setting', key: 'site.accent', label: 'Accent color' },
        ] },
    ],
  },
];


function BuilderView({ setView }) {
  const toast = window.useToast();
  const iframeRef = useRef_b(null);
  const [reloadKey, setReloadKey] = useState_b(0);
  const [pages, setPages] = useState_b({});
  const [settings, setSettings] = useState_b({});
  const [nav, setNav] = useState_b([]);
  const [selectedKey, setSelectedKey] = useState_b(null);
  const [editTarget, setEditTarget] = useState_b(null);

  async function reloadCmsData() {
    try {
      const [p, s, n] = await Promise.all([
        API.pages.list(),
        API.settings.get(),
        API.nav.list('main'),
      ]);
      const pMap = {};
      (p.pages || []).forEach((x) => { pMap[x.slug] = x; });
      setPages(pMap);
      setSettings(s);
      setNav(n.items || []);
    } catch (e) { /* swallow — partial-render is fine */ }
  }

  function refreshPreview() {
    setReloadKey((k) => k + 1);
  }

  useEffect_b(() => { reloadCmsData(); }, []);

  // SSE: when something in the CMS changes, both reload the preview AND
  // re-fetch the relevant CMS data so the section tree stays in sync.
  useEffect_b(() => {
    function refresh() { reloadCmsData(); refreshPreview(); }
    const events = ['atlas:pages', 'atlas:settings', 'atlas:nav', 'atlas:dataset', 'atlas:community'];
    events.forEach((e) => window.addEventListener(e, refresh));
    return () => events.forEach((e) => window.removeEventListener(e, refresh));
  }, []);

  function handleControl(control) {
    if (control.kind === 'page') {
      setEditTarget({ kind: 'page', slug: control.key });
    } else if (control.kind === 'setting') {
      setEditTarget({ kind: 'setting', key: control.key });
    } else if (control.kind === 'nav') {
      setView && setView('navigation');
    } else if (control.kind === 'jump') {
      setView && setView(control.view);
    }
  }

  return (
    <div>
      <h1>Page builder</h1>
      <p className="subhead">
        See the entire public dashboard structure in one view. Click any section
        to jump to its editor; the live preview on the right updates instantly.
      </p>

      <div className="builder-grid">
        <div className="builder-tree card">
          {DASHBOARD_STRUCTURE.map((g) => (
            <div key={g.group} className="builder-group">
              <h3 className="builder-group-title">{g.group}</h3>
              {g.sections.map((sec) => (
                <SectionRow
                  key={sec.key}
                  section={sec}
                  selected={selectedKey === sec.key}
                  onSelect={() => setSelectedKey(sec.key)}
                  onControl={handleControl}
                  pages={pages}
                  settings={settings}
                  nav={nav}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="builder-preview">
          <div className="preview-toolbar">
            <span className="mono small muted">Live preview</span>
            <span className="spacer" />
            <button className="btn-link" onClick={refreshPreview}>↻ Refresh</button>
            <a href="/" target="_blank" rel="noopener noreferrer" className="btn-link">Open in new tab ↗</a>
          </div>
          <iframe
            ref={iframeRef}
            key={reloadKey}
            src={"/?_cms=" + reloadKey}
            title="Public dashboard preview"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        </div>
      </div>

      {editTarget && editTarget.kind === 'page' && (
        <InlinePageEditor
          slug={editTarget.slug}
          existing={pages[editTarget.slug]}
          onSaved={() => { setEditTarget(null); reloadCmsData(); }}
          onClose={() => setEditTarget(null)}
          toast={toast}
        />
      )}
      {editTarget && editTarget.kind === 'setting' && (
        <InlineSettingEditor
          settingKey={editTarget.key}
          value={settings[editTarget.key]}
          onSaved={() => { setEditTarget(null); reloadCmsData(); }}
          onClose={() => setEditTarget(null)}
          toast={toast}
        />
      )}
    </div>
  );
}
window.BuilderView = BuilderView;


function SectionRow({ section, selected, onSelect, onControl, pages, settings, nav }) {
  function badge(control) {
    if (control.kind === 'page') {
      const p = pages[control.key];
      if (!p) return <span className="badge missing">not set</span>;
      if (!p.visible) return <span className="badge hidden">hidden</span>;
      return <span className="badge ok">page · {p.title.slice(0, 24)}</span>;
    }
    if (control.kind === 'setting') {
      const v = settings[control.key];
      if (v == null || v === '') return <span className="badge missing">empty</span>;
      if (v === 'true') return <span className="badge ok">enabled</span>;
      if (v === 'false') return <span className="badge hidden">disabled</span>;
      return <span className="badge ok">{String(v).slice(0, 24)}</span>;
    }
    if (control.kind === 'nav') {
      const visible = nav.filter((n) => n.visible).length;
      return <span className="badge ok">{visible} tabs visible</span>;
    }
    return null;
  }

  return (
    <div
      className={`builder-section${selected ? ' selected' : ''}`}
      onClick={onSelect}
    >
      <div className="section-head">
        <strong>{section.label}</strong>
      </div>
      <p className="small muted" style={{ margin: '4px 0 8px' }}>
        {section.description}
      </p>
      <div className="section-controls">
        {section.controls.map((c, i) => (
          <button key={i}
                  className="control-row"
                  onClick={(e) => { e.stopPropagation(); onControl(c); }}>
            <span className="control-label">{c.label}</span>
            {badge(c)}
            <span className="control-arrow">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}


function InlinePageEditor({ slug, existing, onSaved, onClose, toast }) {
  const [title, setTitle] = useState_b(existing ? existing.title : '');
  const [body, setBody] = useState_b(existing ? existing.body : '');
  const [visible, setVisible] = useState_b(existing ? !!existing.visible : true);
  const [busy, setBusy] = useState_b(false);

  async function save() {
    setBusy(true);
    try {
      await API.pages.upsert(slug, { slug, title, body, visible });
      toast.push('Page saved.', 'success');
      onSaved();
    } catch (e) { toast.push('Save failed: ' + e.message, 'error'); }
    finally { setBusy(false); }
  }

  return (
    <div className="edit-panel">
      <button className="close" onClick={onClose}>×</button>
      <h2 style={{ marginTop: 0 }}>Edit page · {slug}</h2>
      <div className="form-row">
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </div>
      <div className="form-row">
        <label>Body</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 240 }} />
      </div>
      <div className="form-row">
        <label>
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
          &nbsp;<span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>Visible on dashboard</span>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" disabled={busy || !title} onClick={save}>
          {busy ? <window.Spinner /> : 'Save'}
        </button>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}


function InlineSettingEditor({ settingKey, value, onSaved, onClose, toast }) {
  const [v, setV] = useState_b(value == null ? '' : String(value));
  const [busy, setBusy] = useState_b(false);
  const isBool = v === 'true' || v === 'false';
  const isColor = settingKey.toLowerCase().includes('accent') || settingKey.toLowerCase().includes('color');

  async function save() {
    setBusy(true);
    try {
      await API.settings.update({ [settingKey]: v });
      toast.push('Setting saved.', 'success');
      onSaved();
    } catch (e) { toast.push('Save failed: ' + e.message, 'error'); }
    finally { setBusy(false); }
  }

  return (
    <div className="edit-panel">
      <button className="close" onClick={onClose}>×</button>
      <h2 style={{ marginTop: 0 }}>Edit setting</h2>
      <p className="mono small muted">{settingKey}</p>
      <div className="form-row" style={{ marginTop: 16 }}>
        <label>Value</label>
        {isBool ? (
          <select value={v} onChange={(e) => setV(e.target.value)}>
            <option value="true">enabled (true)</option>
            <option value="false">disabled (false)</option>
          </select>
        ) : isColor ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="color" value={v || '#b8351e'} onChange={(e) => setV(e.target.value)}
                   style={{ width: 60, padding: 0, height: 38 }} />
            <input value={v} onChange={(e) => setV(e.target.value)} />
          </div>
        ) : settingKey === 'site.theme' ? (
          <select value={v} onChange={(e) => setV(e.target.value)}>
            {['paper', 'dawn', 'forest', 'midnight'].map((o) => <option key={o}>{o}</option>)}
          </select>
        ) : (
          <textarea value={v} onChange={(e) => setV(e.target.value)} />
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" disabled={busy} onClick={save}>
          {busy ? <window.Spinner /> : 'Save'}
        </button>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
