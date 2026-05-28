/* global React, API */
/*
 * Page Builder — visual, state-of-the-art CMS editor.
 *
 * Left column   : sitemap of dashboard sections + block palette.
 * Center column : live dashboard iframe with edit-mode overlay. Click any
 *                 outlined element to open the floating inspector. Toolbar
 *                 has Edit ↔ Preview toggle and Mobile / Tablet / Desktop /
 *                 Full responsive width toggles.
 * Right column  : floating inspector — appears when an element is selected
 *                 on the iframe. Edits update the iframe live (postMessage
 *                 preview) and auto-save to the backend after 800 ms of
 *                 idle typing.
 *
 * Postmessage protocol shared with cms-edit-mode.js (see that file).
 */
const { useState: useState_b, useEffect: useEffect_b, useRef: useRef_b,
        useMemo: useMemo_b, useCallback: useCallback_b } = React;


const DASHBOARD_STRUCTURE = [
  { group: 'Header', sections: [
    { key: 'banner',  label: 'Status banner',
      description: 'Top dark strip with rotating facts and the current season.',
      controls: [{ kind: 'setting', key: 'site.title', label: 'Site title' }] },
    { key: 'hero',    label: 'Hero',
      description: 'Big editorial title, tagline, stats (Communities / Partners / People).',
      controls: [
        { kind: 'setting', key: 'site.heroEyebrow', label: 'Eyebrow badge' },
        { kind: 'setting', key: 'site.heroTitle',   label: 'Hero title' },
        { kind: 'setting', key: 'site.heroSubtitleLead',  label: 'Tagline lead' },
        { kind: 'setting', key: 'site.heroSubtitleTrail', label: 'Tagline trail' },
        { kind: 'setting', key: 'site.statCommunitiesLabel', label: 'Stat: Communities' },
        { kind: 'setting', key: 'site.statPartnersLabel',    label: 'Stat: Partners' },
        { kind: 'setting', key: 'site.statPeopleLabel',      label: 'Stat: People' },
        { kind: 'page',    key: 'intro', label: 'Intro page' },
      ] },
    { key: 'nav',     label: 'Top navigation strip',
      description: 'Map / Directory / Stories / Insights / Coverage tabs.',
      controls: [{ kind: 'nav', label: 'Reorder / rename / hide tabs' }] },
  ]},
  { group: 'Main content', sections: [
    { key: 'filter',  label: 'Filter rail (left)',
      description: 'Region, direction, service pillar, population filters.',
      controls: [{ kind: 'info', label: 'Auto-built from the master sheet' }] },
    { key: 'map',     label: 'Map view',
      description: 'Leaflet map with custom markers, clusters, and direction compass.',
      controls: [{ kind: 'page', key: 'map-intro', label: 'Map view description' }] },
    { key: 'directory', label: 'Directory cards',
      description: 'Grid of community cards under the map.',
      controls: [{ kind: 'page', key: 'directory-intro', label: 'Directory description' }] },
    { key: 'drawer',  label: 'Detail drawer',
      description: 'Right-hand panel that opens when a community is clicked.',
      controls: [{ kind: 'jump', view: 'communities', label: 'Edit community records →' }] },
  ]},
  { group: 'Auxiliary views', sections: [
    { key: 'stories', label: 'Community Stories tab',
      description: 'Surfaces real quotes from the master sheet.',
      controls: [{ kind: 'setting', key: 'site.showStoriesView', label: 'Show / hide tab' }] },
    { key: 'stats',   label: 'Insights & Stories tab',
      description: 'In-page analytics view.',
      controls: [{ kind: 'setting', key: 'site.showAnalyticsView', label: 'Show / hide tab' }] },
    { key: 'coverage',label: 'Coverage (85) tab',
      description: 'Master sheet × official 85-community list.',
      controls: [{ kind: 'setting', key: 'site.showCoverageView', label: 'Show / hide tab' }] },
    { key: 'journey', label: 'Journey Game',
      description: 'Sacred-direction mini-game.',
      controls: [{ kind: 'setting', key: 'site.showJourneyGame', label: 'Show / hide tab' }] },
  ]},
  { group: 'Footer / global', sections: [
    { key: 'acknowledge', label: 'Land acknowledgement',
      description: 'Honouring the original peoples — in header and footer.',
      controls: [{ kind: 'page', key: 'acknowledgement', label: 'Acknowledgement copy' }] },
    { key: 'contact', label: 'Contact panel',
      description: 'Reach the project team.',
      controls: [{ kind: 'page', key: 'contact', label: 'Contact copy' }] },
    { key: 'theme', label: 'Theme & accent',
      description: 'Theme presets and the accent colour.',
      controls: [
        { kind: 'setting', key: 'site.theme',  label: 'Theme' },
        { kind: 'setting', key: 'site.accent', label: 'Accent colour' },
      ] },
  ]},
];

const DEVICE_WIDTHS = [
  { key: 'mobile',  label: '📱', width:  390, name: 'Mobile (390)' },
  { key: 'tablet',  label: '📲', width:  820, name: 'Tablet (820)' },
  { key: 'desktop', label: '💻', width: 1280, name: 'Desktop (1280)' },
  { key: 'full',    label: '⛶',  width: null, name: 'Full width' },
];


function BuilderView({ setView }) {
  const toast = window.useToast();
  const iframeRef = useRef_b(null);
  const [reloadKey, setReloadKey] = useState_b(0);
  const [pages, setPages] = useState_b({});
  const [settings, setSettings] = useState_b({});
  const [nav, setNav] = useState_b([]);
  const [editMode, setEditMode] = useState_b(true);
  const [device, setDevice] = useState_b('full');
  const [inspector, setInspector] = useState_b(null);   // { kind, key, value, rect }
  const saveTimerRef = useRef_b(null);

  async function reloadCmsData() {
    try {
      const [p, s, n] = await Promise.all([
        API.pages.list(), API.settings.get(), API.nav.list('main'),
      ]);
      const pMap = {}; (p.pages || []).forEach((x) => { pMap[x.slug] = x; });
      setPages(pMap); setSettings(s); setNav(n.items || []);
    } catch (e) { /* swallow */ }
  }

  function refreshPreview() { setReloadKey((k) => k + 1); }
  useEffect_b(() => { reloadCmsData(); }, []);

  // SSE: refresh data + preview when something changes.
  useEffect_b(() => {
    function refresh() { reloadCmsData(); }
    function reloadIframe() { refreshPreview(); }
    ['atlas:pages', 'atlas:settings', 'atlas:nav'].forEach((e) => window.addEventListener(e, refresh));
    ['atlas:dataset', 'atlas:community'].forEach((e) => window.addEventListener(e, reloadIframe));
    return () => {
      ['atlas:pages', 'atlas:settings', 'atlas:nav'].forEach((e) => window.removeEventListener(e, refresh));
      ['atlas:dataset', 'atlas:community'].forEach((e) => window.removeEventListener(e, reloadIframe));
    };
  }, []);

  // Receive postMessages from the iframe.
  useEffect_b(() => {
    function onMsg(e) {
      const msg = e.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'cms.ready') {
        // iframe loaded successfully
      } else if (msg.type === 'cms.select') {
        setInspector({ kind: msg.kind, key: msg.key, value: msg.value, rect: msg.rect });
      } else if (msg.type === 'cms.inlineSave') {
        saveValue(msg.kind, msg.key, msg.value, /*immediate*/ true);
      } else if (msg.type === 'cms.cancel') {
        setInspector(null);
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  function postToIframe(msg) {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage(msg, '*');
  }

  function handleControl(control) {
    if (control.kind === 'page') {
      const p = pages[control.key] || { slug: control.key, title: '', body: '', visible: true };
      setInspector({ kind: 'page', key: control.key, value: p.body, page: p });
      postToIframe({ type: 'cms.scrollTo', kind: 'page', key: control.key });
    } else if (control.kind === 'setting') {
      setInspector({ kind: 'setting', key: control.key, value: settings[control.key] });
      postToIframe({ type: 'cms.scrollTo', kind: 'setting', key: control.key });
    } else if (control.kind === 'nav') {
      setView && setView('navigation');
    } else if (control.kind === 'jump') {
      setView && setView(control.view);
    }
  }

  async function saveValue(kind, key, value, immediate) {
    // Debounced auto-save unless `immediate` is true (e.g. inline Ctrl+Enter).
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const doSave = async () => {
      try {
        if (kind === 'setting') {
          await API.settings.update({ [key]: value });
          setSettings((s) => ({ ...s, [key]: value }));
        } else if (kind === 'page') {
          const existing = pages[key] || { slug: key, title: key, body: '', visible: true };
          await API.pages.upsert(key, { ...existing, slug: key, body: value });
          setPages((p) => ({ ...p, [key]: { ...existing, body: value } }));
        }
      } catch (e) { toast.push('Save failed: ' + e.message, 'error'); }
    };
    if (immediate) { doSave(); }
    else { saveTimerRef.current = setTimeout(doSave, 800); }
  }

  function previewValue(kind, key, value) {
    postToIframe({ type: 'cms.preview', kind, key, value });
  }

  const previewWidth = DEVICE_WIDTHS.find((d) => d.key === device)?.width;
  const iframeSrc = editMode ? `/?_cms=edit&r=${reloadKey}` : `/?r=${reloadKey}`;

  return (
    <div>
      <h1>Page builder</h1>
      <p className="subhead">
        Click any outlined element in the live preview to edit it. Changes auto-save
        and broadcast to every open dashboard in real time.
      </p>

      <div className="builder-grid">
        <div className="builder-tree card">
          {DASHBOARD_STRUCTURE.map((g) => (
            <div key={g.group} className="builder-group">
              <h3 className="builder-group-title">{g.group}</h3>
              {g.sections.map((sec) => (
                <SectionRow key={sec.key} section={sec} onControl={handleControl}
                            pages={pages} settings={settings} nav={nav} />
              ))}
            </div>
          ))}

          <BlockPalette pages={pages} onAdd={async (slug, title) => {
            try {
              await API.pages.upsert(slug, { slug, title, body: '', visible: true });
              toast.push(`Added page "${slug}"`, 'success');
              reloadCmsData();
            } catch (e) { toast.push('Failed to add: ' + e.message, 'error'); }
          }} />
        </div>

        <div className="builder-preview">
          <div className="preview-toolbar">
            <span className="toggle-group">
              <button className={`tgl${editMode ? ' on' : ''}`} onClick={() => setEditMode(true)}>✎ Edit</button>
              <button className={`tgl${!editMode ? ' on' : ''}`} onClick={() => setEditMode(false)}>👁 Preview</button>
            </span>
            <span className="toggle-group" title="Responsive preview">
              {DEVICE_WIDTHS.map((d) => (
                <button key={d.key}
                        className={`tgl${device === d.key ? ' on' : ''}`}
                        title={d.name}
                        onClick={() => setDevice(d.key)}>{d.label}</button>
              ))}
            </span>
            <span style={{ flex: 1 }} />
            <button className="btn-link" onClick={refreshPreview}>↻ Refresh</button>
            <a href="/" target="_blank" rel="noopener noreferrer" className="btn-link">Open ↗</a>
          </div>
          <div className="preview-stage">
            <div className="iframe-shell"
                 style={previewWidth ? { width: previewWidth + 'px', margin: '0 auto' } : { width: '100%' }}>
              <iframe
                ref={iframeRef}
                key={reloadKey + ':' + editMode}
                src={iframeSrc}
                title="Public dashboard preview"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              />
            </div>
          </div>
        </div>
      </div>

      {inspector && (
        <Inspector
          inspector={inspector}
          pages={pages}
          settings={settings}
          onChange={(value) => {
            setInspector((i) => i ? { ...i, value } : null);
            previewValue(inspector.kind, inspector.key, value);
            saveValue(inspector.kind, inspector.key, value);
          }}
          onClose={() => setInspector(null)}
        />
      )}
    </div>
  );
}
window.BuilderView = BuilderView;


function SectionRow({ section, onControl, pages, settings, nav }) {
  function badge(c) {
    if (c.kind === 'page') {
      const p = pages[c.key];
      if (!p) return <span className="badge missing">not set</span>;
      if (!p.visible) return <span className="badge hidden">hidden</span>;
      return <span className="badge ok">{(p.title || '').slice(0, 24)}</span>;
    }
    if (c.kind === 'setting') {
      const v = settings[c.key];
      if (v == null || v === '') return <span className="badge missing">empty</span>;
      if (v === 'true') return <span className="badge ok">enabled</span>;
      if (v === 'false') return <span className="badge hidden">disabled</span>;
      return <span className="badge ok">{String(v).slice(0, 24)}</span>;
    }
    if (c.kind === 'nav') {
      const vis = nav.filter((n) => n.visible).length;
      return <span className="badge ok">{vis} tabs visible</span>;
    }
    return null;
  }
  return (
    <div className="builder-section">
      <div className="section-head"><strong>{section.label}</strong></div>
      <p className="small muted" style={{ margin: '4px 0 8px' }}>{section.description}</p>
      <div className="section-controls">
        {section.controls.map((c, i) => (
          <button key={i} className="control-row"
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


function BlockPalette({ pages, onAdd }) {
  const [slug, setSlug] = useState_b('');
  const [title, setTitle] = useState_b('');
  function commit() {
    const s = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-|-$/g, '');
    if (!s || !title) return;
    onAdd(s, title);
    setSlug(''); setTitle('');
  }
  return (
    <div className="builder-section">
      <h3 className="builder-group-title" style={{ marginTop: 0 }}>+ New page block</h3>
      <p className="small muted" style={{ margin: '0 0 8px' }}>
        Adds a new content block accessible by slug. Use it in the dashboard via
        <code> window.ATLAS_PAGES['slug'] </code> or as a CMS-bound element.
      </p>
      <div className="form-row">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Volunteer info)" />
      </div>
      <div className="form-row">
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug (e.g. volunteer-info)" className="mono small" />
      </div>
      <button className="btn" disabled={!slug || !title} onClick={commit}>+ Add page</button>
    </div>
  );
}


function Inspector({ inspector, pages, settings, onChange, onClose }) {
  const { kind, key, value } = inspector;
  const ref = useRef_b(null);
  const isBool = value === 'true' || value === 'false';
  const isColor = (key || '').toLowerCase().includes('accent') || (key || '').toLowerCase().includes('color');
  const isTheme = key === 'site.theme';

  // Auto-focus the input on open
  useEffect_b(() => {
    if (ref.current) { ref.current.focus(); ref.current.select && ref.current.select(); }
  }, []);

  function field() {
    if (isBool) {
      return (
        <select value={String(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="true">enabled (true)</option>
          <option value="false">disabled (false)</option>
        </select>
      );
    }
    if (isTheme) {
      return (
        <select value={String(value || 'paper')} onChange={(e) => onChange(e.target.value)}>
          {['paper', 'dawn', 'forest', 'midnight'].map((o) => <option key={o}>{o}</option>)}
        </select>
      );
    }
    if (isColor) {
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={ref} type="color" value={value || '#b8351e'}
                 onChange={(e) => onChange(e.target.value)}
                 style={{ width: 60, padding: 0, height: 38 }} />
          <input value={value || ''} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    }
    if (kind === 'page' || (kind === 'setting' && (key || '').toLowerCase().includes('tagline') || (kind === 'setting' && key === 'site.heroSubtitleTrail'))) {
      return <textarea ref={ref} value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ minHeight: 200 }} />;
    }
    return <input ref={ref} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
  }

  return (
    <div className="inspector">
      <div className="inspector-head">
        <strong>{kind === 'page' ? '🗎 Page' : '⚙ Setting'}</strong>
        <span className="mono small muted" style={{ marginLeft: 8 }}>{key}</span>
        <span style={{ flex: 1 }} />
        <span className="small muted" style={{ marginRight: 8 }}>Auto-saves</span>
        <button className="btn-link" onClick={onClose}>Close ×</button>
      </div>
      <div className="form-row">
        <label>Value</label>
        {field()}
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>
        Type to live-preview in the iframe. Auto-saves to backend 800 ms after you stop.
        Ctrl+S to save immediately.
      </p>
    </div>
  );
}
