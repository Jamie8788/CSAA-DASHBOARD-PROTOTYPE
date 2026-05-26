/* global React, API */
const { useState: useState_u, useEffect: useEffect_u } = React;

function UsersView({ me }) {
  const toast = window.useToast();
  const [list, setList] = useState_u([]);
  const [busy, setBusy] = useState_u(false);
  const [form, setForm] = useState_u({ username: '', password: '', role: 'admin', email: '' });
  const [pwReset, setPwReset] = useState_u({ user: '', password: '' });
  const [lastResetLink, setLastResetLink] = useState_u('');

  async function load() {
    try {
      const r = await API.users.list();
      setList(r.users || []);
    } catch (e) { toast.push('Failed to load: ' + e.message, 'error'); }
  }
  useEffect_u(() => { load(); }, []);

  async function create() {
    if (!form.username || !form.password) {
      toast.push('Username and password required', 'error'); return;
    }
    setBusy(true);
    try {
      await API.users.create(form);
      toast.push('User created', 'success');
      setForm({ username: '', password: '', role: 'admin', email: '' });
      load();
    } catch (e) { toast.push(e.message, 'error'); }
    finally { setBusy(false); }
  }

  async function remove(u) {
    if (!confirm(`Delete user "${u}"?`)) return;
    try { await API.users.remove(u); toast.push('Deleted', 'success'); load(); }
    catch (e) { toast.push(e.message, 'error'); }
  }

  async function changePw() {
    if (!pwReset.user || !pwReset.password) return;
    try {
      await API.users.password(pwReset.user, pwReset.password);
      toast.push(`Password updated for ${pwReset.user}`, 'success');
      setPwReset({ user: '', password: '' });
    } catch (e) { toast.push(e.message, 'error'); }
  }

  async function setEmail(username, email) {
    try {
      await API.auth.setEmail(username, email);
      toast.push('Email updated', 'success');
      load();
    } catch (e) { toast.push(e.message, 'error'); }
  }

  async function sendResetLink(username) {
    setLastResetLink('');
    try {
      const r = await API.auth.requestReset(username);
      if (r.delivery === 'email') {
        toast.push(`Reset link emailed to ${username}`, 'success');
      } else if (r.resetUrl) {
        setLastResetLink(r.resetUrl);
        toast.push('Reset link generated — copy below and share with the user', 'success');
      }
    } catch (e) { toast.push(e.message, 'error'); }
  }

  return (
    <div>
      <h1>Admin users</h1>
      <p className="subhead">
        Manage who can sign in to the CMS. You are signed in as <strong>{me && me.username}</strong>.
        Add an email so password-reset links can be sent automatically (requires SMTP env vars).
      </p>

      {lastResetLink && (
        <div className="card" style={{ background: 'rgba(212,160,23,0.08)', borderColor: 'var(--warn)' }}>
          <h3>One-time reset link</h3>
          <p className="small muted">Send this to the user. It expires in 1 hour and can be used once.</p>
          <a href={lastResetLink} target="_blank" rel="noopener noreferrer"
             style={{ wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            {lastResetLink}
          </a>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <h3>Create user</h3>
          <div className="form-row">
            <label>Username</label>
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Email (optional)</label>
            <input type="email" value={form.email}
                   onChange={(e) => setForm({ ...form, email: e.target.value })}
                   placeholder="for password reset emails" />
          </div>
          <div className="form-row">
            <label>Password</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="admin">admin</option>
              <option value="editor">editor</option>
            </select>
          </div>
          <button className="btn" disabled={busy} onClick={create}>{busy ? <window.Spinner /> : 'Create user'}</button>
        </div>

        <div className="card">
          <h3>Reset password directly</h3>
          <p className="small muted">For when you want to set a password without sending a link.</p>
          <div className="form-row">
            <label>Username</label>
            <select value={pwReset.user} onChange={(e) => setPwReset({ ...pwReset, user: e.target.value })}>
              <option value="">Choose…</option>
              {list.map((u) => <option key={u.username}>{u.username}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>New password</label>
            <input type="password" value={pwReset.password} onChange={(e) => setPwReset({ ...pwReset, password: e.target.value })} />
          </div>
          <button className="btn" onClick={changePw}>Set password</button>
        </div>
      </div>

      <h2 style={{ marginTop: 32 }}>All users</h2>
      <table className="tbl">
        <thead>
          <tr><th>Username</th><th>Email</th><th>Role</th><th>Created</th><th>Last login</th><th></th></tr>
        </thead>
        <tbody>
          {list.map((u) => (
            <tr key={u.username}>
              <td><strong>{u.username}</strong></td>
              <td>
                <EmailCell username={u.username} email={u.email || ''} onSave={setEmail} />
              </td>
              <td className="small"><span className="tag">{u.role}</span></td>
              <td className="small">{window.formatTime(u.created_at)}</td>
              <td className="small">{window.formatTime(u.last_login)}</td>
              <td className="right">
                <button className="btn-link" onClick={() => sendResetLink(u.username)}>send reset link</button>
                {me && u.username !== me.username && (
                  <>&nbsp;·&nbsp;
                  <button className="btn-link" onClick={() => remove(u.username)} style={{ color: 'var(--danger)' }}>delete</button></>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
window.UsersView = UsersView;

function EmailCell({ username, email, onSave }) {
  const [v, setV] = useState_u(email);
  const [editing, setEditing] = useState_u(false);
  if (!editing) {
    return (
      <span className="small">
        {v || <span className="muted">—</span>}
        <button className="btn-link" style={{ marginLeft: 8 }} onClick={() => setEditing(true)}>edit</button>
      </span>
    );
  }
  return (
    <span style={{ display: 'flex', gap: 4 }}>
      <input type="email" value={v} onChange={(e) => setV(e.target.value)} style={{ flex: 1 }} />
      <button className="btn-link" onClick={() => { onSave(username, v); setEditing(false); }}>save</button>
      <button className="btn-link" onClick={() => { setV(email); setEditing(false); }}>cancel</button>
    </span>
  );
}
