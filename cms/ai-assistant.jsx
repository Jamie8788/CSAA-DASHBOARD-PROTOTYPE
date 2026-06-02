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
function AIAutofill({ toast }) {
  const [job, setJob] = useS_ai(null);
  const [groq, setGroq] = useS_ai('');
  const [savingKey, setSavingKey] = useS_ai(false);
  const timer = useR_ai(null);

  function poll() {
    API.ai.status().then((s) => {
      setJob(s);
      if (s.status === 'running' && !timer.current) {
        timer.current = setInterval(() => {
          API.ai.status().then((s2) => {
            setJob(s2);
            if (s2.status !== 'running') { clearInterval(timer.current); timer.current = null; }
          }).catch(() => {});
        }, 2000);
      }
    }).catch(() => {});
  }
  useE_ai(() => { poll(); return () => { if (timer.current) clearInterval(timer.current); }; }, []);

  async function run() {
    try { await API.ai.run(); toast.push('AI enrichment started.', 'success'); poll(); }
    catch (e) { toast.push(e.message, 'error'); }
  }
  async function saveKey() {
    setSavingKey(true);
    try {
      const r = await API.ai.setGroqKey(groq.trim());
      toast.push(r.llm_available ? 'Groq key saved — AI contact extraction is on.' : 'Key cleared.', 'success');
      setGroq(''); poll();
    } catch (e) { toast.push(e.message, 'error'); }
    finally { setSavingKey(false); }
  }

  const running = job && job.status === 'running';
  const pct = job && job.total ? Math.round((job.done / job.total) * 100) : 0;

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Auto-fill blank cells from the web</h3>
      <p className="small muted">
        This runs <strong>automatically every time you upload a sheet</strong>: for each
        community it looks up free sources (Wikipedia, Wikidata, the community's own
        website) and fills in blank Population, Link, Coordinates, Contacts and document
        cells — then marks every AI-filled value <span className="ai-tag">AI</span>
        (purple) so people know to verify. It never overwrites anything a human typed.
      </p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '14px 0' }}>
        <button className="btn" onClick={run} disabled={running}>
          {running ? 'Running…' : '⚙ Run AI auto-fill now'}
        </button>
        {job && job.llm_available && <span className="small" style={{ color: '#2e7d32' }}>● Groq AI connected</span>}
        {job && !job.llm_available && <span className="small muted">Groq not set (using free sources only)</span>}
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
          Check the dashboard, or export the sheet (purple = AI).
        </p>
      )}
      {job && job.status === 'error' && <p className="small" style={{ color: '#b8351e' }}>Error: {job.error}</p>}

      <hr style={{ margin: '18px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
      <h4 style={{ margin: '0 0 6px' }}>Optional: connect your free Groq key</h4>
      <p className="small muted" style={{ marginTop: 0 }}>
        With a free <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">Groq API key</a>,
        the assistant also reads each website and pulls out staff <em>names &amp; roles</em>
        (not just raw emails). Facts still come from the page — it can't invent them.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input type="password" value={groq} onChange={(e) => setGroq(e.target.value)}
               placeholder="gsk_…  (paste your Groq key)" style={{ flex: 1, minWidth: 240 }} />
        <button className="btn ghost" onClick={saveKey} disabled={savingKey || !groq.trim()}>
          {savingKey ? 'Saving…' : 'Save key'}
        </button>
      </div>
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
