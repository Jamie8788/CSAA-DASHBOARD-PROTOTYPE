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

function CMSAppInner() {
  const toast = window.useToast();
  const [me, setMe] = useState_app(null);
  const [loading, setLoading] = useState_app(true);
  const [view, setView] = useState_app('analytics');

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

  const NAV = [
    { key: 'analytics', label: 'Analytics', ico: '◐' },
    { key: 'upload', label: 'Upload data', ico: '⌹' },
    { key: 'communities', label: 'Communities', ico: '☷' },
    { key: 'users', label: 'Admin users', ico: '✦' },
    { key: 'site', label: 'Open dashboard ↗', ico: '→', external: '/' },
  ];

  return (
    <div className="cms-shell">
      <aside className="cms-sidebar">
        <div className="brand">
          <small>Mino Bimaadiziwin</small>
          Community Atlas CMS
        </div>
        <nav>
          {NAV.map((n) => n.external
            ? <a key={n.key} href={n.external} target="_blank" rel="noopener noreferrer">
                <button><span className="ico">{n.ico}</span>{n.label}</button>
              </a>
            : (
              <button key={n.key}
                      className={view === n.key ? 'active' : ''}
                      onClick={() => setView(n.key)}>
                <span className="ico">{n.ico}</span>{n.label}
              </button>
            ))}
        </nav>
        <div className="spacer" />
        <div className="user-block">
          <div><strong>{me.username}</strong></div>
          <div className="role">{me.role}</div>
          <button className="signout" onClick={signOut}>Sign out</button>
        </div>
      </aside>
      <main className="cms-main">
        {view === 'analytics' && <window.AnalyticsView />}
        {view === 'upload' && <window.UploadView />}
        {view === 'communities' && <window.CommunitiesView />}
        {view === 'users' && <window.UsersView me={me} />}
      </main>
    </div>
  );
}
