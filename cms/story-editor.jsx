/* global React, API */
// CMS editor for the scrollytelling Story Map. Per-scene: title, subtitle,
// body, accent colour, and a full-bleed background image picked from the
// Media library. Saves to story.<key>.* settings; the dashboard re-reads
// live via the atlas:settings SSE event.
const { useState: useS_se, useEffect: useE_se } = React;

const STORY_SCENES = [
  { key: 'intro', label: 'Intro', kind: 'hero',
    dTitle: 'Walk the four directions.', dSub: 'Mino Bimaadiziwin · A guided journey',
    dBody: 'Scroll slowly — the map will carry you through each Sacred Direction, season by season.' },
  { key: 'East', label: 'East · Spring', kind: 'dir', dAccent: '#d4a017',
    dTitle: 'East', dSub: 'Spring · Ziigwan',
    dBody: 'In the east the sun rises and the year is reborn. These are the communities of renewal.' },
  { key: 'South', label: 'South · Summer', kind: 'dir', dAccent: '#b8351e',
    dTitle: 'South', dSub: 'Summer · Niibin',
    dBody: 'The south is warmth and growth, the season of the body and of youth.' },
  { key: 'West', label: 'West · Autumn', kind: 'dir', dAccent: '#1a1612',
    dTitle: 'West', dSub: 'Autumn · Dagwaagin',
    dBody: 'In the west the light softens and we turn inward — the season of the mind.' },
  { key: 'North', label: 'North · Winter', kind: 'dir', dAccent: '#6b8d6b',
    dTitle: 'North', dSub: 'Winter · Biboon',
    dBody: 'The north holds winter and wisdom — the elders, the ceremonies, the deep memory.' },
  { key: 'outro', label: 'Outro', kind: 'hero',
    dTitle: 'The whole circle.', dSub: '',
    dBody: 'Every direction, every season, held together in one living atlas.' },
];

function StoryEditorView() {
  const toast = window.useToast();
  const [settings, setSettings] = useS_se({});
  const [media, setMedia] = useS_se([]);
  const [loading, setLoading] = useS_se(true);
  const [picking, setPicking] = useS_se(null);   // scene key whose image we're choosing

  async function load() {
    setLoading(true);
    try {
      const [s, m] = await Promise.all([API.settings.get(), API.media.list().catch(() => ({ items: [] }))]);
      setSettings(s || {});
      setMedia((m && m.items) || []);
    } catch (e) { toast.push('Load failed: ' + e.message, 'error'); }
    finally { setLoading(false); }
  }
  useE_se(() => { load(); }, []);

  function val(scene, field, dflt) {
    const k = 'story.' + scene + '.' + field;
    return settings[k] != null && settings[k] !== '' ? settings[k] : (dflt || '');
  }
  function setLocal(scene, field, v) {
    setSettings((s) => ({ ...s, ['story.' + scene + '.' + field]: v }));
  }

  async function saveScene(scene) {
    const payload = {};
    ['title', 'subtitle', 'body', 'accent', 'image'].forEach((f) => {
      const k = 'story.' + scene.key + '.' + f;
      payload[k] = settings[k] != null ? settings[k] : '';
    });
    try {
      await API.settings.update(payload);
      toast.push(`Saved "${scene.label}".`, 'success');
    } catch (e) { toast.push('Save failed: ' + e.message, 'error'); }
  }

  function chooseImage(sceneKey, url) {
    setLocal(sceneKey, 'image', url);
    setPicking(null);
  }

  if (loading) return <div><h1>Story Map</h1><p className="muted">Loading…</p></div>;

  return (
    <div>
      <h1>Story Map editor</h1>
      <p className="subhead">
        Edit the scrollytelling Story Map — the guided journey through the four
        Sacred Directions. Set each scene's text and a full-bleed background
        image (upload images in <strong>Media library</strong> first). Leave an
        image empty to let the live map show through instead.
        <a href="/#v=story" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8 }}>Open Story Map ↗</a>
      </p>

      {STORY_SCENES.map((scene) => {
        const img = val(scene.key, 'image', '');
        return (
          <div className="card" key={scene.key} style={{ marginBottom: 16 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {scene.label}
              {scene.kind === 'dir' && (
                <span style={{ width: 14, height: 14, borderRadius: '50%',
                  background: val(scene.key, 'accent', scene.dAccent), display: 'inline-block' }} />
              )}
            </h3>
            <div className="grid-2">
              <div>
                <div className="form-row">
                  <label>{scene.kind === 'dir' ? 'Direction label' : 'Title'}</label>
                  <input value={val(scene.key, 'title', scene.dTitle)}
                         onChange={(e) => setLocal(scene.key, 'title', e.target.value)} />
                </div>
                <div className="form-row">
                  <label>{scene.kind === 'dir' ? 'Season / subtitle' : 'Eyebrow / subtitle'}</label>
                  <input value={val(scene.key, 'subtitle', scene.dSub)}
                         onChange={(e) => setLocal(scene.key, 'subtitle', e.target.value)} />
                </div>
                <div className="form-row">
                  <label>Body</label>
                  <textarea value={val(scene.key, 'body', scene.dBody)} rows={4}
                            onChange={(e) => setLocal(scene.key, 'body', e.target.value)} />
                </div>
                {scene.kind === 'dir' && (
                  <div className="form-row">
                    <label>Accent colour</label>
                    <span style={{ display: 'flex', gap: 8 }}>
                      <input type="color" value={val(scene.key, 'accent', scene.dAccent)}
                             onChange={(e) => setLocal(scene.key, 'accent', e.target.value)}
                             style={{ width: 48, height: 36, padding: 0 }} />
                      <input value={val(scene.key, 'accent', scene.dAccent)}
                             onChange={(e) => setLocal(scene.key, 'accent', e.target.value)}
                             style={{ flex: 1 }} />
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label>Background image</label>
                <div className="story-img-preview"
                     style={img ? { backgroundImage: `url("${img}")` } : null}>
                  {!img && <span className="muted small">No image — the map shows here.</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <button className="btn ghost" onClick={() => setPicking(scene.key)}>
                    {img ? 'Change image' : 'Pick from media'}
                  </button>
                  {img && (
                    <button className="btn ghost" onClick={() => setLocal(scene.key, 'image', '')}
                            style={{ color: 'var(--danger)' }}>Clear</button>
                  )}
                </div>
                {img && <p className="mono small muted" style={{ marginTop: 6, wordBreak: 'break-all' }}>{img}</p>}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => saveScene(scene)}>Save "{scene.label}"</button>
            </div>
          </div>
        );
      })}

      {picking && (
        <div className="edit-panel" style={{ width: 'min(640px, 100%)' }}>
          <button className="close" onClick={() => setPicking(null)}>×</button>
          <h2 style={{ marginTop: 0 }}>Choose an image</h2>
          <p className="small muted">
            Pick from the Media library. Upload new images under
            <strong> Content → Media library</strong>.
          </p>
          {media.length === 0 ? (
            <p className="muted">No media yet. Upload some first.</p>
          ) : (
            <div className="media-grid">
              {media.map((m) => (
                <button key={m.id} className="media-pick"
                        onClick={() => chooseImage(picking, API.media.url(m.id))}>
                  <div className="media-thumb"><img src={API.media.url(m.id)} alt={m.alt_text || m.filename} loading="lazy" /></div>
                  <div className="small" style={{ padding: '6px 8px' }}>{m.filename}</div>
                </button>
              ))}
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <button className="btn ghost" onClick={() => setPicking(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
window.StoryEditorView = StoryEditorView;
