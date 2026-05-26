/* global React, API */
const { useState: useState_login } = React;

function LoginScreen({ onLogin }) {
  const [username, setU] = useState_login('admin');
  const [password, setP] = useState_login('');
  const [err, setErr] = useState_login('');
  const [busy, setBusy] = useState_login(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const data = await API.login(username, password);
      onLogin(data.user);
    } catch (e) {
      setErr(e.message || 'Login failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
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
        <p className="small muted" style={{ marginTop: 16 }}>
          Default credentials: <span className="mono">admin / mino2025</span>. Change them after first login.
        </p>
      </form>
    </div>
  );
}
window.LoginScreen = LoginScreen;
