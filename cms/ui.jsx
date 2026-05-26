/* Shared UI primitives: ToastProvider, useToast, Spinner. */
const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } = React;

const ToastCtx = createContext({ push: () => {} });
window.useToast = () => useContext(ToastCtx);

function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, tone = 'info', ttl = 3200) => {
    const id = Math.random().toString(36).slice(2);
    setItems((xs) => [...xs, { id, message, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), ttl);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="toast-wrap">
        {items.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.message}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}
window.ToastProvider = ToastProvider;

function Spinner({ size = 16 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: '2px solid currentColor', borderTopColor: 'transparent',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
      verticalAlign: 'middle',
    }} />
  );
}
window.Spinner = Spinner;

// Inject spinner keyframes once
if (!document.getElementById('cms-anim')) {
  const s = document.createElement('style');
  s.id = 'cms-anim';
  s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(s);
}

function formatTime(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts * 1000).toLocaleString();
  } catch { return String(ts); }
}
window.formatTime = formatTime;

function classNames(...xs) {
  return xs.filter(Boolean).join(' ');
}
window.classNames = classNames;
