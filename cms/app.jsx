/* global React, API */
const { useState: useState_app, useEffect: useEffect_app } = React;

function CMSApp() {
  return (
    <window.ToastProvider>
      <CMSAppInner />
    </window.ToastProvider>
  );
}
window.CMSApp = CMSApp;

const NAV_GROUPS = [
  {
    title: 'Insights',
    items: [
      { key: 'analytics',   label: 'Analytics',         ico: '◐' },
      { key: 'ai',          label: 'AI Assistant',      ico: '✦' },
    ],
  },
  {
    title: 'Content',
    items: [
      { key: 'builder',     label: 'Page builder',      ico: '▦' },
      { key: 'communities', label: 'Communities',       ico: '☷' },
      { key: 'pages',       label: 'Pages & content',   ico: '☰' },
      { key: 'navigation',  label: 'Navigation',        ico: '⇆' },
      { key: 'story',       label: 'Story Map',         ico: '✦' },
      { key: 'media',       label: 'Media library',     ico: '🖼' },
    ],
  },
  {
    title: 'Data',
    items: [
      { key: 'upload',      label: 'Upload data',       ico: '⌹' },
      { key: 'submissions', label: 'Form submissions',  ico: '✉' },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { key: 'settings',    label: 'Site settings',     ico: '⚙' },
      { key: 'users',       label: 'Admin users',       ico: '✦' },
    ],
  },
];

function CMSAppInner() {
  const toast = window.useToast();
  const [me, setMe] = useState_app(null);
  const [loading, setLoading] = useState_app(true);
  const [view, setView] = useState_app(() => localStorage.getItem('cms-view') || 'analytics');
  const [collapsed, setCollapsed] = useState_app(() => localStorage.getItem('cms-sb-collapsed') === '1');
  const [openGroups, setOpenGroups] = useState_app(() => {
    try { return JSON.parse(localStorage.getItem('cms-sb-groups') || '{}'); }
    catch { return {}; }
  });

  useEffect_app(() => { localStorage.setItem('cms-view', view); }, [view]);
  useEffect_app(() => { localStorage.setItem('cms-sb-collapsed', collapsed ? '1' : '0'); }, [collapsed]);
  useEffect_app(() => { localStorage.setItem('cms-sb-groups', JSON.stringify(openGroups)); }, [openGroups]);

  useEffect_app(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!API.getToken()) {
          setLoading(false);
          return;
        }
        const u = await API.me();
        if (!cancelled) setMe(u);
      } catch (_e) {
        API.setToken('');
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="login-wrap"><window.Spinner size={28} /></div>;
  }

  if (!me) {
    return <window.LoginScreen onLogin={(u) => { setMe(u); setView('analytics'); }} />;
  }

  async function signOut() {
    await API.logout();
    setMe(null);
    toast.push('Signed out');
  }

  function toggleGroup(title) {
    setOpenGroups((s) => ({ ...s, [title]: !(s[title] !== false) }));
  }

  return (
    <div className={`cms-shell${collapsed ? ' collapsed' : ''}`}>
      <aside className="cms-sidebar">
        <div className="sidebar-top">
          <div className="brand">
            {!collapsed && <small>Mino Bimaadiziwin</small>}
            <span className="brand-title">{collapsed ? 'M.' : 'Community Atlas CMS'}</span>
          </div>
          <button className="collapse-btn"
                  title={collapsed ? 'Expand' : 'Collapse'}
                  onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        <nav>
          {NAV_GROUPS.map((g) => {
            const isOpen = openGroups[g.title] !== false;
            return (
              <div key={g.title} className="nav-group">
                {!collapsed && (
                  <button className="group-head" onClick={() => toggleGroup(g.title)}>
                    <span className="group-title">{g.title}</span>
                    <span className="group-caret">{isOpen ? '▾' : '▸'}</span>
                  </button>
                )}
                {(isOpen || collapsed) && g.items.map((n) => (
                  <button key={n.key}
                          className={view === n.key ? 'active' : ''}
                          onClick={() => setView(n.key)}
                          title={collapsed ? n.label : ''}>
                    <span className="ico">{n.ico}</span>
                    {!collapsed && <span>{n.label}</span>}
                  </button>
                ))}
              </div>
            );
          })}
          <div className="nav-group external">
            <a href="/" target="_blank" rel="noopener noreferrer">
              <button title="Open public dashboard">
                <span className="ico">→</span>
                {!collapsed && <span>Open dashboard ↗</span>}
              </button>
            </a>
          </div>
        </nav>

        <div className="spacer" />
        {!collapsed && (
          <div className="user-block">
            <div><strong>{me.username}</strong></div>
            <div className="role">{me.role}</div>
            <button className="signout" onClick={signOut}>Sign out</button>
          </div>
        )}
        {collapsed && (
          <button className="signout" onClick={signOut} title="Sign out"
                  style={{ width: 32, margin: '8px auto', padding: '6px 0' }}>⎋</button>
        )}
      </aside>
      <main className="cms-main">
        {view === 'analytics' && <window.AnalyticsView />}
        {view === 'ai' && <window.AIAssistantView />}
        {view === 'upload' && <window.UploadView />}
        {view === 'builder' && <window.BuilderView setView={setView} />}
        {view === 'communities' && <window.CommunitiesView />}
        {view === 'pages' && <window.PagesView />}
        {view === 'navigation' && <window.NavigationView />}
        {view === 'media' && <window.MediaView />}
        {view === 'story' && <window.StoryEditorView />}
        {view === 'submissions' && <window.SubmissionsView />}
        {view === 'settings' && <window.SettingsView />}
        {view === 'users' && <window.UsersView me={me} />}
      </main>
    </div>
  );
}
