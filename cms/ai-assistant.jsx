/* global React, API */
// CMS AI Assistant: a live chat that answers ONLY from the master sheet (free,
// no external API, never invents), a per-community "AI data check" that pulls
// population / official website / coordinates / scraped contacts & documents
// from free sources with sources + confidence, and an Excel export of the
// current corrected data. AI-pulled values are clearly marked.
const { useState: useS_ai, useEffect: useE_ai, useRef: useR_ai } = React;

function AIAssistantView() {
  const toast = window.useToast();
  const [tab, setTab] = useS_ai('chat');
  return (
    <div>
      <h1>AI Assistant</h1>
      <p className="subhead">
        A free helper that works only from your data — it never invents answers.
        Ask questions, run an AI data check on a community, or export the
        corrected sheet. AI-pulled values are always shown with their source so
        a person can verify before trusting them.
      </p>
      <div className="ai-tabs">
        <button className={tab === 'autofill' ? 'on' : ''} onClick={() => setTab('autofill')}>⚙ Auto-fill sheet</button>
        <button className={tab === 'chat' ? 'on' : ''} onClick={() => setTab('chat')}>💬 Ask the atlas</button>
        <button className={tab === 'check' ? 'on' : ''} onClick={() => setTab('check')}>🔎 AI data check</button>
        <button className={tab === 'export' ? 'on' : ''} onClick={() => setTab('export')}>⬇ Export sheet</button>
      </div>
      {tab === 'autofill' && <AIAutofill toast={toast} />}
      {tab === 'chat' && <AIChat toast={toast} />}
      {tab === 'check' && <AIDataCheck toast={toast} />}
      {tab === 'export' && <AIExport toast={toast} />}
    </div>
  );
}

// ---- auto-fill the whole sheet from the web (runs on upload, or on demand) ----
const PREVIEW_COLS = [
  { key: 'population', label: 'Population' },
  { key: 'link', label: 'Link' },
  { key: 'coords', label: 'Coordinates' },
  { key: 'contact', label: 'Contact' },
  { key: 'strategicPlan', label: 'Strategic Plan' },
  { key: 'agm', label: 'AGM' },
  { key: 'financials', label: 'Financials' },
];

function AIAutofill({ toast }) {
  const [job, setJob] = useS_ai(null);
  const timer = useR_ai(null);
  const [rows, setRows] = useS_ai(null);
  const [page, setPage] = useS_ai(0);
  const [onlyAI, setOnlyAI] = useS_ai(false);
  const PER = 20;

  function loadPreview() {
    API.communities.list()
      .then((d) => setRows((d && d.records) || []))
      .catch(() => {});
  }
  function poll() {
    API.ai.status().then((s) => {
      setJob(s);
      if (s.status === 'running' && !timer.current) {
        timer.current = setInterval(() => {
          API.ai.status().then((s2) => {
            setJob(s2);
            if (s2.status !== 'running') {
              clearInterval(timer.current); timer.current = null;
              loadPreview();   // refresh once it finishes
            }
          }).catch(() => {});
        }, 2000);
      }
    }).catch(() => {});
  }
  useE_ai(() => { poll(); loadPreview(); return () => { if (timer.current) clearInterval(timer.current); }; }, []);

  async function run() {
    try { await API.ai.run(); toast.push('AI enrichment started.', 'success'); poll(); }
    catch (e) { toast.push(e.message, 'error'); }
  }

  const running = job && job.status === 'running';
  const pct = job && job.total ? Math.round((job.done / job.total) * 100) : 0;

  // build preview rows (only real communities; optionally only AI-touched)
  const all = (rows || []).filter((r) => r.name && (r.orgType === 'Community' || (r._ai && Object.keys(r._ai).length)));
  const filtered = onlyAI ? all.filter((r) => r._ai && Object.keys(r._ai).length) : all;
  const aiCells = all.reduce((n, r) => n + (r._ai ? Object.keys(r._ai).filter((k) => k !== 'lon').length : 0), 0);
  const pages = Math.max(1, Math.ceil(filtered.length / PER));
  const pageRows = filtered.slice(page * PER, page * PER + PER);

  function cellVal(r, key) {
    if (key === 'coords') {
      const lng = r.lng != null ? r.lng : r.lon;
      return r.lat != null && lng != null ? `${r.lat}, ${lng}` : '';
    }
    return r[key];
  }
  function isAI(r, key) {
    if (!r._ai) return false;
    if (key === 'coords') return !!(r._ai.lat || r._ai.lng);
    return !!r._ai[key];
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Auto-fill blank cells from the web</h3>
      <p className="small muted">
        Runs <strong>automatically every time you upload a sheet</strong>: for each community
        it looks up free sources (Wikipedia, Wikidata, the community's own website) and fills
        blank Population, Link, Coordinates, Contacts and document cells — marking every
        AI-filled value <span className="ai-tag">AI</span> (purple) so people know to verify.
        It never overwrites anything a human typed.
      </p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '14px 0' }}>
        <button className="btn" onClick={run} disabled={running}>
          {running ? 'Running…' : '⚙ Run AI auto-fill now'}
        </button>
        {job && job.llm_available
          ? <span className="small" style={{ color: '#2e7d32' }}>● Groq AI connected (key set on the server)</span>
          : <span className="small muted">Groq not set — using free sources only. Add a GROQ_API_KEY env var on Render to enable it.</span>}
      </div>

      {running && (
        <div style={{ margin: '10px 0' }}>
          <div className="ai-progress"><div style={{ width: pct + '%' }} /></div>
          <div className="small muted">{job.done} / {job.total} communities… {pct}%</div>
        </div>
      )}
      {job && job.status === 'done' && job.result && (
        <p className="small" style={{ color: '#2e7d32' }}>
          ✓ Done — filled {job.result.fields_filled} cells across {job.result.communities_filled} communities.
        </p>
      )}
      {job && job.status === 'error' && <p className="small" style={{ color: '#b8351e' }}>Error: {job.error}</p>}

      {/* ---- live preview of the filled sheet ---- */}
      <div className="ai-prev-head">
        <h4 style={{ margin: 0 }}>Preview {rows ? `· ${filtered.length} communities` : ''}</h4>
        <div className="ai-prev-tools">
          <span className="ai-prev-chip"><span className="ai-dot" /> {aiCells} AI-filled cells</span>
          <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyAI} onChange={(e) => { setOnlyAI(e.target.checked); setPage(0); }} />
            Only AI-filled
          </label>
          <button className="btn ghost" onClick={() => API.ai.downloadXlsx().then(() => toast.push('Downloaded.', 'success')).catch((e) => toast.push(e.message, 'error'))}>
            ⬇ Export
          </button>
        </div>
      </div>

      {!rows && <p className="muted small">Loading preview…</p>}
      {rows && (
        <>
          <div className="ai-prev-wrap">
            <table className="ai-prev">
              <thead>
                <tr>
                  <th className="sticky-l">Community</th>
                  {PREVIEW_COLS.map((c) => <th key={c.key}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={i}>
                    <td className="sticky-l"><strong>{r.name}</strong><div className="ai-prev-dir">{r.direction || ''}</div></td>
                    {PREVIEW_COLS.map((c) => {
                      const v = cellVal(r, c.key);
                      const ai = isAI(r, c.key);
                      return (
                        <td key={c.key} className={ai ? 'ai-cell' : (v ? '' : 'blank')}
                            title={ai ? 'AI-filled — verify' : ''}>
                          {ai && <span className="ai-mini">AI</span>}
                          {v ? String(v).slice(0, 80) : <span className="muted">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="ai-prev-pager">
              <button className="btn ghost" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>← Prev</button>
              <span className="small muted">Page {page + 1} of {pages}</span>
              <button className="btn ghost" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>Next →</button>
            </div>
          )}
          <p className="small muted" style={{ marginTop: 10 }}>
            Purple cells with <span className="ai-tag">AI</span> were filled from the web and should be verified.
            Plain cells are your own data. Export to get the colour-coded Excel.
          </p>
        </>
      )}
    </div>
  );
}

// ---- live chat (TF-IDF retrieval over the sheet; free, cites communities) ----
function AIChat({ toast }) {
  const [q, setQ] = useS_ai('');
  const [busy, setBusy] = useS_ai(false);
  const [convo, setConvo] = useS_ai([
    { role: 'bot', text: "Hi — I only know what the master sheet says. Ask me things like \"who supports survivors?\", \"diabetes programs\", or \"communities in the North\", and I'll find the records and cite them." },
  ]);
  const endRef = useR_ai(null);
  useE_ai(() => { endRef.current && endRef.current.scrollIntoView({ behavior: 'smooth' }); }, [convo]);

  async function send() {
    const question = q.trim();
    if (!question || busy) return;
    setConvo((c) => [...c, { role: 'me', text: question }]);
    setQ(''); setBusy(true);
    try {
      const r = await API.ai.ask(question);
      const hits = (r && r.results) || [];
      if (!hits.length) {
        setConvo((c) => [...c, { role: 'bot', text: "I couldn't find anything about that in the sheet. Try different words, or it may simply not be documented yet." }]);
      } else {
        setConvo((c) => [...c, { role: 'bot', hits }]);
      }
    } catch (e) {
      setConvo((c) => [...c, { role: 'bot', text: 'Search failed: ' + e.message }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="card ai-chat">
      <div className="ai-stream">
        {convo.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role}`}>
            {m.text && <div className="ai-bubble">{m.text}</div>}
            {m.hits && (
              <div className="ai-bubble">
                <div className="small muted" style={{ marginBottom: 6 }}>From the master sheet:</div>
                {m.hits.map((h, j) => (
                  <div key={j} className="ai-hit">
                    <strong>{h.name}</strong>{h.direction ? ` · ${h.direction}` : ''}
                    {h.snippet && <div className="small">{h.snippet}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="ai-input">
        <input value={q} onChange={(e) => setQ(e.target.value)}
               onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
               placeholder="Ask about programs, services, communities…" />
        <button className="btn" onClick={send} disabled={busy}>{busy ? '…' : 'Ask'}</button>
      </div>
    </div>
  );
}

// ---- per-community AI data check (free web lookup + scrape) ----
function AIDataCheck({ toast }) {
  const [list, setList] = useS_ai([]);
  const [name, setName] = useS_ai('');
  const [busy, setBusy] = useS_ai(false);
  const [res, setRes] = useS_ai(null);

  useE_ai(() => {
    API.communities.list()
      .then((d) => setList(((d && d.records) || []).map((r) => r.name).filter(Boolean).sort()))
      .catch(() => {});
  }, []);

  async function run() {
    if (!name || busy) return;
    setBusy(true); setRes(null);
    try {
      const r = await API.ai.enrich(name);
      setRes(r.suggestions || []);
    } catch (e) {
      toast.push('Check failed: ' + e.message, 'error');
    } finally { setBusy(false); }
  }

  const confColor = { High: '#2e7d32', Medium: '#b8851b', Low: '#b8351e' };

  return (
    <div className="card">
      <p className="small muted" style={{ marginTop: 0 }}>
        Pick a community and the assistant checks free, authoritative sources
        (Wikipedia, Wikidata, and the community's own website) for population,
        official link, map coordinates, contacts and documents. Each result
        shows its source and confidence — copy the good ones into the record.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input list="ai-comm-list" value={name} onChange={(e) => setName(e.target.value)}
               placeholder="Type or pick a community…" style={{ flex: 1, minWidth: 240 }} />
        <datalist id="ai-comm-list">
          {list.map((n) => <option key={n} value={n} />)}
        </datalist>
        <button className="btn" onClick={run} disabled={busy || !name}>
          {busy ? 'Checking…' : '🔎 Run AI check'}
        </button>
      </div>

      {busy && <p className="muted" style={{ marginTop: 14 }}>Looking up free sources & scraping the official site… (a few seconds)</p>}

      {res && res.length > 0 && (
        <table className="ai-results" style={{ marginTop: 16 }}>
          <thead><tr><th>Field</th><th>Suggested value</th><th>Confidence</th><th>Source</th><th>Note</th></tr></thead>
          <tbody>
            {res.map((s, i) => (
              <tr key={i}>
                <td><span className="ai-tag">AI</span> {s.field}</td>
                <td style={{ wordBreak: 'break-word', maxWidth: 280 }}>{s.suggested || '—'}</td>
                <td><span style={{ color: confColor[s.confidence] || '#555', fontWeight: 600 }}>{s.confidence}</span></td>
                <td>{s.source ? <a href={s.source} target="_blank" rel="noopener noreferrer">verify ↗</a> : '—'}</td>
                <td className="small muted" style={{ maxWidth: 260 }}>{s.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {res && res.length === 0 && <p className="muted" style={{ marginTop: 14 }}>No confident matches found — verify by hand.</p>}
    </div>
  );
}

// ---- export current corrected dataset ----
function AIExport({ toast }) {
  const [busy, setBusy] = useS_ai(false);
  async function go() {
    setBusy(true);
    try { await API.ai.downloadXlsx(); toast.push('Downloaded.', 'success'); }
    catch (e) { toast.push('Export failed: ' + e.message, 'error'); }
    finally { setBusy(false); }
  }
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Download the corrected sheet</h3>
      <p className="small muted">
        Exports the current data — including everything corrected through the
        CMS and the coordinates filled in for the map — as an Excel workbook.
      </p>
      <button className="btn" onClick={go} disabled={busy}>{busy ? 'Preparing…' : '⬇ Download Excel (.xlsx)'}</button>
      <p className="small muted" style={{ marginTop: 16 }}>
        For a full AI pass over <em>all</em> communities at once (writing an "AI
        Suggestions" tab with the AI colour into a copy of your master file), run
        <code> python tools/enrich_master_sheet.py</code> on the computer that
        has the sheet — that batch job is too slow to run live here.
      </p>
    </div>
  );
}

window.AIAssistantView = AIAssistantView;
