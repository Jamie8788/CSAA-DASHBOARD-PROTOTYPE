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
  const [layouts, setLayouts] = useState_b({ header: [], footer: [] });
  const [editMode, setEditMode] = useState_b(true);
  const [device, setDevice] = useState_b('full');
  const [inspector, setInspector] = useState_b(null);   // { kind, key, value, rect }
  const saveTimerRef = useRef_b(null);

  async function reloadCmsData() {
    try {
      const [p, s, n, L] = await Promise.all([
        API.pages.list(), API.settings.get(), API.nav.list('main'),
        API.layouts.all(),
      ]);
      const pMap = {}; (p.pages || []).forEach((x) => { pMap[x.slug] = x; });
      setPages(pMap); setSettings(s); setNav(n.items || []);
      setLayouts({ header: L.header || [], footer: L.footer || [] });
    } catch (e) { /* swallow */ }
  }

  async function saveLayout(slot, blocks) {
    try {
      await API.layouts.save(slot, blocks);
      setLayouts((L) => ({ ...L, [slot]: blocks }));
    } catch (e) { toast.push('Layout save failed: ' + e.message, 'error'); }
  }

  function applyReorder(slot, fromId, toId, position) {
    const list = [...(layouts[slot] || [])];
    const fromIdx = list.findIndex((b) => b.id === fromId);
    const toIdx   = list.findIndex((b) => b.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [picked] = list.splice(fromIdx, 1);
    const insertAt = list.findIndex((b) => b.id === toId);
    list.splice(position === 'after' ? insertAt + 1 : insertAt, 0, picked);
    saveLayout(slot, list);
  }

  function applyHide(slot, id) {
    const list = (layouts[slot] || []).map((b) =>
      b.id === id ? { ...b, visible: false } : b);
    saveLayout(slot, list);
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
      } else if (msg.type === 'cms.reorder') {
        applyReorder(msg.slot, msg.from, msg.to, msg.position);
      } else if (msg.type === 'cms.hideSection') {
        applyHide(msg.slot, msg.id);
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

          <LayoutManager
            layouts={layouts}
            pages={pages}
            onChange={saveLayout}
            onResetSlot={async (slot) => {
              if (!confirm(`Reset ${slot} layout to defaults?`)) return;
              try {
                const r = await API.layouts.reset(slot);
                setLayouts((L) => ({ ...L, [slot]: r.blocks }));
                toast.push(`${slot} layout reset.`, 'success');
              } catch (e) { toast.push('Reset failed: ' + e.message, 'error'); }
            }}
          />
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


function LayoutManager({ layouts, pages, onChange, onResetSlot }) {
  const [addingSlot, setAddingSlot] = useState_b(null);
  const [newSlug, setNewSlug] = useState_b('');

  function move(slot, idx, delta) {
    const list = [...(layouts[slot] || [])];
    const j = idx + delta;
    if (j < 0 || j >= list.length) return;
    [list[idx], list[j]] = [list[j], list[idx]];
    onChange(slot, list);
  }
  function toggle(slot, id) {
    const list = (layouts[slot] || []).map((b) =>
      b.id === id ? { ...b, visible: !b.visible } : b);
    onChange(slot, list);
  }
  function remove(slot, id) {
    if (!confirm('Remove this block from the layout?')) return;
    const list = (layouts[slot] || []).filter((b) => b.id !== id);
    onChange(slot, list);
  }
  function addPage(slot) {
    if (!newSlug.trim()) return;
    const id = `${slot[0]}-p-${Date.now().toString(36)}`;
    const blocks = [...(layouts[slot] || []),
      { id, type: 'page', visible: true, props: { slug: newSlug.trim() } }];
    onChange(slot, blocks);
    setAddingSlot(null); setNewSlug('');
  }
  function addSpacer(slot, size) {
    const id = `${slot[0]}-sp-${Date.now().toString(36)}`;
    const blocks = [...(layouts[slot] || []),
      { id, type: 'spacer', visible: true, props: { size } }];
    onChange(slot, blocks);
  }

  function renderSlot(slot) {
    const list = layouts[slot] || [];
    return (
      <div className="builder-section" key={slot}>
        <h3 className="builder-group-title" style={{ marginTop: 0,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Layout · {slot}</span>
          <button className="btn-link" onClick={() => onResetSlot(slot)}>reset</button>
        </h3>
        <p className="small muted" style={{ margin: '0 0 8px' }}>
          {list.length} block{list.length === 1 ? '' : 's'} · drag the blue ⋮⋮ on the
          live preview, or use the arrows below.
        </p>
        <table className="tbl small" style={{ marginBottom: 8 }}>
          <tbody>
            {list.map((b, i) => (
              <tr key={b.id}>
                <td style={{ width: 60 }}>
                  <button className="btn-link" disabled={i === 0} onClick={() => move(slot, i, -1)}>↑</button>&nbsp;
                  <button className="btn-link" disabled={i === list.length - 1} onClick={() => move(slot, i, +1)}>↓</button>
                </td>
                <td>
                  <span className="mono small">{b.type}</span>
                  {b.props && b.props.slug && <span className="muted small"> · {b.props.slug}</span>}
                  {b.props && b.props.size && <span className="muted small"> · {b.props.size}</span>}
                </td>
                <td style={{ width: 80 }}>
                  <button className="btn-link" onClick={() => toggle(slot, b.id)}>
                    {b.visible ? 'hide' : 'show'}
                  </button>
                </td>
                <td style={{ width: 60 }}>
                  <button className="btn-link" style={{ color: 'var(--danger)' }}
                          onClick={() => remove(slot, b.id)}>remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {addingSlot === slot ? (
            <>
              <select value={newSlug} onChange={(e) => setNewSlug(e.target.value)} style={{ width: 'auto' }}>
                <option value="">Choose page…</option>
                {Object.keys(pages).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn" onClick={() => addPage(slot)} disabled={!newSlug}>Add</button>
              <button className="btn ghost" onClick={() => { setAddingSlot(null); setNewSlug(''); }}>Cancel</button>
            </>
          ) : (
            <>
              <button className="btn ghost" onClick={() => setAddingSlot(slot)}>+ Page block</button>
              <button className="btn ghost" onClick={() => addSpacer(slot, 'sm')}>+ Spacer (sm)</button>
              <button className="btn ghost" onClick={() => addSpacer(slot, 'md')}>+ Spacer (md)</button>
              <button className="btn ghost" onClick={() => addSpacer(slot, 'lg')}>+ Spacer (lg)</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <h3 className="builder-group-title" style={{ marginTop: 16 }}>Section layouts</h3>
      {renderSlot('header')}
      {renderSlot('footer')}
    </>
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
  const [tab, setTab] = useState_b('content');
  const isBool = value === 'true' || value === 'false';
  const isColor = (key || '').toLowerCase().includes('accent') || (key || '').toLowerCase().includes('color');
  const isTheme = key === 'site.theme';

  // Selector used by the styles backend.
  const styleSelector = `bind:${kind}:${key}`;

  // Local style state (loaded from server on open, edited locally, posted to
  // iframe live, debounced-saved to backend).
  const [styleProps, setStyleProps] = useState_b({});
  const [customCss, setCustomCss] = useState_b('');
  const [loadedStyle, setLoadedStyle] = useState_b(false);
  const styleSaveTimer = useRef_b(null);

  useEffect_b(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await API.styles.get(styleSelector);
        if (cancelled) return;
        setStyleProps(s.properties || {});
        setCustomCss(s.customCss || '');
      } catch (e) { /* swallow */ }
      finally { if (!cancelled) setLoadedStyle(true); }
    })();
    return () => { cancelled = true; };
  }, [styleSelector]);

  // Auto-focus the input on open
  useEffect_b(() => {
    if (ref.current) { ref.current.focus(); ref.current.select && ref.current.select(); }
  }, []);

  function previewStyleToIframe(props, css) {
    const iframe = document.querySelector('.builder-preview iframe');
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage({
      type: 'cms.stylePreview',
      selector: styleSelector,
      properties: props,
      customCss: css,
    }, '*');
  }
  function saveStyleDebounced(props, css) {
    if (styleSaveTimer.current) clearTimeout(styleSaveTimer.current);
    styleSaveTimer.current = setTimeout(() => {
      API.styles.save(styleSelector, props, css).catch(() => {});
    }, 800);
  }
  function updateStyle(patch) {
    const next = { ...styleProps, ...patch };
    Object.keys(next).forEach((k) => { if (next[k] === '' || next[k] == null) delete next[k]; });
    setStyleProps(next);
    previewStyleToIframe(next, customCss);
    saveStyleDebounced(next, customCss);
  }
  function updateCustomCss(v) {
    setCustomCss(v);
    previewStyleToIframe(styleProps, v);
    saveStyleDebounced(styleProps, v);
  }
  async function clearAllStyle() {
    if (!confirm('Reset all style overrides on this element?')) return;
    setStyleProps({}); setCustomCss('');
    const iframe = document.querySelector('.builder-preview iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'cms.styleClear', selector: styleSelector }, '*');
    }
    try { await API.styles.remove(styleSelector); } catch (e) {}
  }

  function contentField() {
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
    if (kind === 'page' || (kind === 'setting' && ((key || '').toLowerCase().includes('tagline') || key === 'site.heroSubtitleTrail'))) {
      return <textarea ref={ref} value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ minHeight: 160 }} />;
    }
    return <input ref={ref} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
  }

  return (
    <div className="inspector">
      <div className="inspector-head">
        <strong>{kind === 'page' ? '🗎 Page' : '⚙ Setting'}</strong>
        <span className="mono small muted" style={{ marginLeft: 8 }}>{key}</span>
        <span style={{ flex: 1 }} />
        <button className="btn-link" onClick={onClose}>Close ×</button>
      </div>

      <div className="inspector-tabs">
        <button className={`tab${tab === 'content' ? ' on' : ''}`} onClick={() => setTab('content')}>Content</button>
        <button className={`tab${tab === 'style'   ? ' on' : ''}`} onClick={() => setTab('style')}>Style</button>
        <button className={`tab${tab === 'css'     ? ' on' : ''}`} onClick={() => setTab('css')}>CSS</button>
      </div>

      {tab === 'content' && (
        <div className="inspector-body">
          <div className="form-row">{contentField()}</div>
          <p className="small muted" style={{ marginTop: 8 }}>
            Live preview as you type · auto-saves after 800 ms.
          </p>
        </div>
      )}

      {tab === 'style' && (
        <div className="inspector-body">
          <StyleEditor properties={styleProps} onChange={updateStyle} />
          <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
            <button className="btn ghost" onClick={clearAllStyle}>⟲ Reset element style</button>
          </div>
        </div>
      )}

      {tab === 'css' && (
        <div className="inspector-body">
          <p className="small muted" style={{ margin: '0 0 8px' }}>
            Custom CSS rules scoped to this element. Auto-saves after 800 ms.
            Targets: <span className="mono small">{styleSelector}</span>.
          </p>
          <textarea value={customCss} onChange={(e) => updateCustomCss(e.target.value)}
                    placeholder={'font-family: serif;\ntext-shadow: 0 1px 0 #fff;'}
                    style={{ minHeight: 180, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
        </div>
      )}
    </div>
  );
}


/* StyleEditor — grouped Typography / Spacing / Background / Border / Effects
 * pickers. Each control updates `properties` immediately via onChange.
 */
function StyleEditor({ properties, onChange }) {
  function set(k, v) { onChange({ [k]: v }); }
  function val(k, d = '') { return properties[k] != null ? properties[k] : d; }

  return (
    <div className="style-editor">
      <details open><summary>Typography</summary>
        <div className="style-grid">
          <Field label="Size"   ><UnitInput value={val('fontSize')} onChange={(v) => set('fontSize', v)} units={['px','rem','em','%']} /></Field>
          <Field label="Weight" >
            <select value={val('fontWeight')} onChange={(e) => set('fontWeight', e.target.value)}>
              <option value="">—</option>
              {['300','400','500','600','700','800'].map((w) => <option key={w}>{w}</option>)}
            </select>
          </Field>
          <Field label="Line"   ><UnitInput value={val('lineHeight')} onChange={(v) => set('lineHeight', v)} units={['','px','rem','%']} /></Field>
          <Field label="Letter" ><UnitInput value={val('letterSpacing')} onChange={(v) => set('letterSpacing', v)} units={['px','em']} /></Field>
          <Field label="Color"  ><ColorInput value={val('color')} onChange={(v) => set('color', v)} /></Field>
          <Field label="Align"  >
            <select value={val('textAlign')} onChange={(e) => set('textAlign', e.target.value)}>
              <option value="">—</option>
              {['left','center','right','justify'].map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Transform">
            <select value={val('textTransform')} onChange={(e) => set('textTransform', e.target.value)}>
              <option value="">—</option>
              {['none','uppercase','lowercase','capitalize'].map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Family">
            <input value={val('fontFamily')} onChange={(e) => set('fontFamily', e.target.value)} placeholder="Inter, serif…" />
          </Field>
        </div>
      </details>

      <details open><summary>Spacing</summary>
        <div className="style-grid">
          <Field label="M ↑"><UnitInput value={val('marginTop')}    onChange={(v) => set('marginTop', v)} /></Field>
          <Field label="M →"><UnitInput value={val('marginRight')}  onChange={(v) => set('marginRight', v)} /></Field>
          <Field label="M ↓"><UnitInput value={val('marginBottom')} onChange={(v) => set('marginBottom', v)} /></Field>
          <Field label="M ←"><UnitInput value={val('marginLeft')}   onChange={(v) => set('marginLeft', v)} /></Field>
          <Field label="P ↑"><UnitInput value={val('paddingTop')}    onChange={(v) => set('paddingTop', v)} /></Field>
          <Field label="P →"><UnitInput value={val('paddingRight')}  onChange={(v) => set('paddingRight', v)} /></Field>
          <Field label="P ↓"><UnitInput value={val('paddingBottom')} onChange={(v) => set('paddingBottom', v)} /></Field>
          <Field label="P ←"><UnitInput value={val('paddingLeft')}   onChange={(v) => set('paddingLeft', v)} /></Field>
        </div>
      </details>

      <details><summary>Background</summary>
        <div className="style-grid">
          <Field label="Color"  ><ColorInput value={val('backgroundColor')} onChange={(v) => set('backgroundColor', v)} /></Field>
          <Field label="Opacity"><UnitInput value={val('opacity')} onChange={(v) => set('opacity', v)} units={['']} placeholder="0–1" /></Field>
        </div>
      </details>

      <details><summary>Border</summary>
        <div className="style-grid">
          <Field label="Width" ><UnitInput value={val('borderWidth')} onChange={(v) => set('borderWidth', v)} /></Field>
          <Field label="Style" >
            <select value={val('borderStyle')} onChange={(e) => set('borderStyle', e.target.value)}>
              <option value="">—</option>
              {['none','solid','dashed','dotted'].map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Color" ><ColorInput value={val('borderColor')} onChange={(v) => set('borderColor', v)} /></Field>
          <Field label="Radius"><UnitInput value={val('borderRadius')} onChange={(v) => set('borderRadius', v)} /></Field>
        </div>
      </details>

      <details><summary>Effects</summary>
        <div className="style-grid">
          <Field label="Shadow"><input value={val('boxShadow')} onChange={(e) => set('boxShadow', e.target.value)} placeholder="0 2px 6px rgba(0,0,0,.1)" /></Field>
          <Field label="Transform"><input value={val('transform')} onChange={(e) => set('transform', e.target.value)} placeholder="rotate(0) scale(1)" /></Field>
        </div>
      </details>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="style-field">
      <span className="style-label">{label}</span>
      {children}
    </label>
  );
}

function UnitInput({ value, onChange, units = ['px','rem','em','%'], placeholder }) {
  // Parse "12px" → { n: '12', u: 'px' }
  const m = String(value || '').match(/^(-?\d*\.?\d*)\s*([a-z%]*)\s*$/i);
  const n = m ? m[1] : '';
  const u = m ? (m[2] || units[0]) : units[0];
  function setN(nn) { onChange(nn === '' ? '' : `${nn}${u}`); }
  function setU(uu) { onChange(n === '' ? '' : `${n}${uu}`); }
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      <input value={n} onChange={(e) => setN(e.target.value)} placeholder={placeholder || '0'}
             style={{ width: 60 }} />
      {units.length > 1 ? (
        <select value={u} onChange={(e) => setU(e.target.value)} style={{ width: 56 }}>
          {units.map((x) => <option key={x} value={x}>{x || '–'}</option>)}
        </select>
      ) : <span className="small muted" style={{ alignSelf: 'center', paddingLeft: 2 }}>{u}</span>}
    </span>
  );
}

function ColorInput({ value, onChange }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      <input type="color" value={value || '#000000'}
             onChange={(e) => onChange(e.target.value)}
             style={{ width: 32, height: 28, padding: 0, border: '1px solid var(--border)' }} />
      <input value={value || ''} onChange={(e) => onChange(e.target.value)}
             placeholder="—" style={{ width: 80 }} />
    </span>
  );
}
