/* global React, API */
const { useState: useState_login } = React;

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState_login('signin'); // signin | forgot
  const [username, setU] = useState_login('admin');
  const [password, setP] = useState_login('');
  const [err, setErr] = useState_login('');
  const [info, setInfo] = useState_login('');
  const [busy, setBusy] = useState_login(false);
  const [resetUrl, setResetUrl] = useState_login('');

  async function submitSignIn(e) {
    e.preventDefault();
    setBusy(true); setErr(''); setInfo('');
    try {
      const data = await API.login(username, password);
      onLogin(data.user);
    } catch (e) {
      setErr(e.message || 'Login failed');
    } finally { setBusy(false); }
  }

  async function submitForgot(e) {
    e.preventDefault();
    setBusy(true); setErr(''); setInfo(''); setResetUrl('');
    try {
      const r = await API.auth.requestReset(username);
      if (r.delivery === 'email') {
        setInfo('A reset link has been emailed to the address on file. Check your inbox.');
      } else if (r.resetUrl) {
        setResetUrl(r.resetUrl);
        setInfo('Email is not configured on this server — copy the link below to set a new password.');
      } else {
        setInfo('If that account exists, instructions have been sent.');
      }
    } catch (e) {
      setErr(e.message || 'Could not request reset');
    } finally { setBusy(false); }
  }

  if (mode === 'forgot') {
    return (
      <div className="login-wrap">
        <form className="login-card" onSubmit={submitForgot}>
          <h1>Forgot password</h1>
          <p className="sub">We'll generate a one-time reset link.</p>
          <div className="form-row">
            <label>Username</label>
            <input value={username} onChange={(e) => setU(e.target.value)} autoFocus required />
          </div>
          <button className="btn" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
            {busy ? <window.Spinner /> : 'Send reset link'}
          </button>
          <div className="err">{err}</div>
          {info && <p className="small" style={{ color: 'var(--good)', marginTop: 8 }}>{info}</p>}
          {resetUrl && (
            <div style={{ marginTop: 12, padding: 12, border: '1px dashed var(--border)',
                         borderRadius: 6, background: 'rgba(212,160,23,0.08)' }}>
              <p className="small muted" style={{ margin: '0 0 4px' }}>One-time reset link (valid 1 hour):</p>
              <a href={resetUrl} style={{ wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                {resetUrl}
              </a>
            </div>
          )}
          <p className="small muted" style={{ marginTop: 16 }}>
            <button type="button" className="btn-link" onClick={() => { setMode('signin'); setErr(''); setInfo(''); setResetUrl(''); }}>
              ← Back to sign in
            </button>
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submitSignIn}>
        <h1>Mino Bimaadiziwin · CMS</h1>
        <p className="sub">Sign in to manage the Community Services Atlas.</p>
        <div className="form-row">
          <label>Username</label>
          <input value={username} onChange={(e) => setU(e.target.value)} autoFocus required />
        </div>
        <div className="form-row">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setP(e.target.value)} required />
        </div>
        <button className="btn" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
          {busy ? <window.Spinner /> : 'Sign in'}
        </button>
        <div className="err">{err}</div>
        <p className="small" style={{ marginTop: 12, textAlign: 'right' }}>
          <button type="button" className="btn-link" onClick={() => setMode('forgot')}>
            Forgot password?
          </button>
        </p>
        <p className="small muted" style={{ marginTop: 8 }}>
          Default credentials: <span className="mono">admin / mino2025</span>. Change them after first login.
        </p>
      </form>
    </div>
  );
}
window.LoginScreen = LoginScreen;
