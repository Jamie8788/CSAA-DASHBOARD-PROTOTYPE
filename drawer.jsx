/* global React */
const { useState, useEffect, useMemo } = React;

function CommunityDrawer({ community, onClose, searchQuery }) {
  const cms = window.useCMS();
  const [tab, setTab] = useState('overview');
  useEffect(() => { setTab('overview'); }, [community?.id]);
  useEffect(() => {
    function esc(e){ if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const open = !!community;
  if (!community) {
    return <>
      <div className="drawer-backdrop" onClick={onClose}></div>
      <aside className="drawer" aria-hidden="true"></aside>
    </>;
  }
  const c = community;
  const hex = window.dirHex(c);
  const dir = c.direction || 'Central';
  const dirInfo = window.DIRECTION[dir];
  const staff = c.staff || [];
  const depts = c.departments || [];

  return (
    <>
      <div className={`drawer-backdrop ${open?'open':''}`} onClick={onClose}></div>
      <aside className={`drawer ${open?'open':''}`} style={{'--region-color':hex}}>
        <button className="drawer-close" onClick={onClose} title="Close (Esc)">✕</button>
        <header className="drawer-hero">
          <div className="drawer-eyebrow">
            <span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:hex, border: dir==='North'?'1px solid var(--ink-3)':'none'}}></span>
            <span style={{color:'var(--ink-2)', fontWeight:500}}>{dirInfo.label}</span>
            <span style={{opacity:.5}}>·</span>
            <span>{dirInfo.season}</span>
          </div>
          <div className="drawer-mark-row">
            <div className={`drawer-mark m${c.motif||0} card-mark`} style={{
              background: dir === 'North' ? '#fbf6ec' : hex,
              color: dir === 'North' ? '#1a1612' : 'var(--paper)',
              border: dir === 'North' ? '1px solid #8a7c66' : 'none',
            }}>
              <span>{c.mark}</span>
            </div>
            <div style={{flex:1, minWidth:0}}>
              <h2 className="drawer-title">{c.name.trim()}</h2>
              <div style={{fontFamily:'var(--mono)', fontSize:10, textTransform:'uppercase', letterSpacing:'.14em', color:'var(--ink-3)', marginTop:8}}>
                {c.regionGroup} · {c.orgType}
                {c.sourceRow && <span style={{marginLeft:10,opacity:.5}}>· sheet row {c.sourceRow}</span>}
              </div>
            </div>
          </div>
          <div className="drawer-meta-row">
            {c.population != null && <span><span className="pop-big">{c.population.toLocaleString()}</span> people</span>}
            {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer">Website ↗</a>}
            {staff.length > 0 && <span>{staff.length} staff on file</span>}
            {depts.length > 0 && <span>{depts.length} departments</span>}
            <span>{Math.round(c.completeness*100)}% documented</span>
          </div>
          <div className="pillar-strip">
            {window.PILLARS.map(p => {
              const on = window.pillarOn(c, p.key);
              return (
                <div key={p.key} className={`pillar-cell ${p.key} ${on?'on':''}`}>
                  <div className="ico">{p.icon}</div>
                  <div className="lab">{p.label.split(' ')[0]}</div>
                </div>
              );
            })}
          </div>
        </header>

        <div className="drawer-tabs">
          <button className={`drawer-tab ${tab==='overview'?'on':''}`} onClick={() => setTab('overview')}>Overview</button>
          <button className={`drawer-tab ${tab==='services'?'on':''}`} onClick={() => setTab('services')}>Services
            <span className="badge">{window.PILLARS.filter(p=>window.pillarOn(c,p.key)).length}</span>
          </button>
          <button className={`drawer-tab ${tab==='people'?'on':''}`} onClick={() => setTab('people')}>People & Youth</button>
          <button className={`drawer-tab ${tab==='contact'?'on':''}`} onClick={() => setTab('contact')}>Contact
            {(staff.length+depts.length) > 0 && <span className="badge">{staff.length+depts.length}</span>}
          </button>
        </div>

        <div className="drawer-body">
          {tab==='overview' && <OverviewTab c={c} dirInfo={dirInfo} setTab={setTab} />}
          {tab==='services' && <ServicesTab c={c} searchQuery={searchQuery} />}
          {tab==='people' && <PeopleTab c={c} searchQuery={searchQuery} />}
          {tab==='contact' && <ContactTab c={c} />}
        </div>
      </aside>
    </>
  );
}

// FieldLink — the source link captured from the Excel hyperlink behind a
// field's text (e.g. "Click here" → the real plan PDF). Shown clearly at the
// end of the field: bold label + host, opens in a new tab.
const FIELD_LINK_LABEL = {
  strategicPlan: 'Open the strategic plan',
  agm: 'Open the AGM / annual report',
  financials: 'Open the financial statement',
  connect: 'Open the source',
  links: 'Open link',
  physical: 'Source for this programming',
  mental: 'Source for this programming',
  spiritual: 'Source for this programming',
  emotional: 'Source for this programming',
  survivors: 'Source for this support',
  youth: 'Source for this programming',
};
function FieldLinkOne({ url, label }) {
  if (!url) return null;
  let host = url;
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
  const isPdf = /\.pdf(\?|#|$)/i.test(url);
  return (
    <a className="field-link" href={url} target="_blank" rel="noopener noreferrer">
      <span className="fl-icon">{isPdf ? '⤓' : '↗'}</span>
      <span className="fl-text">{label || 'Open source'}</span>
      <span className="fl-host">{isPdf ? 'PDF · ' : ''}{host}</span>
    </a>
  );
}
// A field can carry SEVERAL source links — render them all, numbered when >1.
function FieldLink({ url, urls, label }) {
  const list = (urls && urls.length) ? urls : (url ? [url] : []);
  if (!list.length) return null;
  if (list.length === 1) return <FieldLinkOne url={list[0]} label={label} />;
  return (
    <div className="field-links-group">
      {list.map((u, i) => (
        <FieldLinkOne key={i} url={u} label={`${label || 'Source'} ${i + 1}`} />
      ))}
    </div>
  );
}
// Always return an array of URLs for a field (values may be string or array).
function fieldLinksFor(c, key) {
  const v = c && c.fieldLinks && c.fieldLinks[key];
  if (!v) return [];
  return Array.isArray(v) ? v.filter(Boolean) : [v];
}
function fieldLinkFor(c, key) {
  const a = fieldLinksFor(c, key);
  return a.length ? a[0] : null;
}

// ── Pending-field display rules (EASILY REVERSIBLE) ───────────────────────
// To revert: set PENDING_UNIFY = false (brings back separate "Coming soon" vs
// "Under review"), and/or PENDING_HIDE_NOTES = false (shows team notes again).
//
//  • PENDING_UNIFY: any field whose sheet value is "Missing Information" OR
//    "Needs Review" is shown to users as ONE simple "Under review" state.
//  • PENDING_HIDE_NOTES: for those same fields, the internal team notes
//    (and the links inside them) are hidden from public users.
const PENDING_UNIFY = true;
const PENDING_HIDE_NOTES = true;
const UNIFIED_PENDING_COPY = {
  badge: 'Under review',
  title: 'This information is being reviewed.',
  body: 'The team is reviewing this and it will be updated soon.',
};

// PendingNotice — friendly card shown instead of raw "Missing Information" /
// "Needs Review" placeholder text.
function PendingNotice({ status, c, fieldKey }) {
  // Unify missing + review into one "under review" presentation for users.
  const unified = PENDING_UNIFY && (status === 'missing' || status === 'review');
  const copy = unified ? UNIFIED_PENDING_COPY
                       : (window.PENDING_COPY[status] || window.PENDING_COPY.empty);
  // When a field says "Missing Information" / "Needs Review", its internal
  // team notes + note-links are hidden from public users.
  const restricted = PENDING_HIDE_NOTES && (status === 'missing' || status === 'review');
  const anns = (c && fieldKey) ? window.fieldAnnotations(c, fieldKey) : [];
  const note = anns.find(a => a.kind === (status === 'review' ? 'review' : 'missing'));
  const when = note && note.date ? String(note.date).slice(0, 10) : null;
  const hasNote = !restricted && note && note.description && String(note.description).trim();
  const noteLinks = (!restricted && note && Array.isArray(note.links)) ? note.links : [];
  // The raw team note can be long / inconsistently formatted, so keep it tucked
  // away behind a toggle by default — the link(s) the team found stay visible.
  const [showNote, setShowNote] = useState(false);
  return (
    <div className={`pending-notice pn-${unified ? 'review' : status}`}>
      <div className="pn-top">
        <span className="pn-badge">{copy.badge}</span>
        {when && !restricted && <span className="pn-date">checked {when}</span>}
      </div>
      <div className="pn-title">{copy.title}</div>
      <div className="pn-body">{copy.body}</div>
      {noteLinks.length > 0 && (
        <div className="pn-links">
          {noteLinks.slice(0, 6).map((u, i) => (
            <FieldLinkOne key={i} url={u} label={noteLinks.length > 1 ? `What the team found ${i + 1}` : 'What the team found'} />
          ))}
        </div>
      )}
      {hasNote && (
        <div className="pn-note-wrap">
          <button className="pn-note-toggle" onClick={() => setShowNote(s => !s)} aria-expanded={showNote}>
            <span className="pn-note-chevron">{showNote ? '▾' : '▸'}</span>
            {showNote ? 'Hide team note' : 'Read the team’s note'}
          </button>
          {showNote && (
            <div className="pn-note">
              {window.autoLink(String(note.description).slice(0, 600))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, swatch, children, value, eyebrow, searchQuery, communityId, fieldKey, anchor, community }) {
  const status = window.fieldStatus(community, fieldKey, value);
  const empty = status !== 'ok' && !children;
  return (
    <div className="section" data-section={anchor || undefined}>
      {(swatch || eyebrow) && (
        <div className="section-eyebrow">
          {swatch && <span className="swatch" style={{background:swatch}}></span>}
          <span>{eyebrow || 'Section'}</span>
        </div>
      )}
      <h3 className="section-title">{title}</h3>
      {empty
        ? <PendingNotice status={status} c={community} fieldKey={fieldKey} />
        : status === 'ok' && value && <div className="section-body">{searchQuery ? window.highlight(value, searchQuery) : window.autoLink(value)}</div>}
      {status === 'ok' && <FieldLink urls={fieldLinksFor(community, fieldKey)} label={FIELD_LINK_LABEL[fieldKey]} />}
      {children}
      {communityId && fieldKey && <window.EditableField communityId={communityId} fieldKey={fieldKey} value={value} label={title} />}
    </div>
  );
}

function OverviewTab({ c, dirInfo, setTab }) {
  const pillars = window.PILLARS;
  const activeCount = pillars.filter(p => window.pillarOn(c, p.key)).length;
  const pct = Math.round((c.completeness || 0) * 100);

  // Animated counts for the overview hero
  const nPop = window.useCountUp(c.population || 0, 1700);
  const nStaff = window.useCountUp((c.staff || []).length, 1400);
  const nDepts = window.useCountUp((c.departments || []).length, 1400);
  const nPct = window.useCountUp(pct, 1600);
  const nPillars = window.useCountUp(activeCount, 1400);

  const dirColors = {
    East:  ['#d4a017', 'Spring'],
    South: ['#b8351e', 'Summer'],
    West:  ['#3a5d8c', 'Autumn'],
    North: ['#1a1612', 'Winter'],
    Central:['#6b8d6b','Year-round'],
  };
  const [dotColor, season] = dirColors[c.direction || 'Central'] || dirColors.Central;

  // Find which fields have content, for the "what's on file" grid.
  // Each entry knows how to jump to where the user can SEE / EDIT it.
  const PILLAR_KEYS = new Set(['physical','mental','spiritual','emotional','youth','survivors']);
  const fileChecks = [
    { k:'physical',      label:'Physical health programming', tab:'services' },
    { k:'mental',        label:'Mental health programming',   tab:'services' },
    { k:'spiritual',     label:'Spiritual / cultural support',tab:'services' },
    { k:'emotional',     label:'Emotional wellness',          tab:'services' },
    { k:'youth',         label:'Youth programming',           tab:'people' },
    { k:'survivors',     label:'Survivor support',            tab:'people' },
    { k:'connect',       label:'Bridge survivors ↔ youth',    tab:'overview', section: 'sec-connect' },
    { k:'strategicPlan', label:'Strategic plan',              tab:'overview', section: 'sec-strategicPlan' },
    { k:'agm',           label:'AGM / Annual report',         tab:'overview', section: 'sec-agm' },
    { k:'financials',    label:'Financial statements',        tab:'overview', section: 'sec-financials' },
    { k:'website',       label:'Public website',              tab:'contact' },
    { k:'lat',           label:'Located on the map',          tab:null },
  ];
  const has = fileChecks.map(f => ({ ...f, on: !window.NA(c[f.k]) }));
  const onCount = has.filter(h => h.on).length;

  function handleCheckClick(item) {
    if (!item.on) return;
    if (item.tab && setTab) setTab(item.tab);
    // Scroll the target into view next paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // For Services tab: scroll to that pillar card
        if (PILLAR_KEYS.has(item.k)) {
          const target = document.querySelector(`.pillar-card[data-pillar="${item.k}"]`);
          if (target) {
            const body = document.querySelector('.drawer-body');
            if (body) {
              const rect = target.getBoundingClientRect();
              const bodyRect = body.getBoundingClientRect();
              body.scrollTop += rect.top - bodyRect.top - 20;
            }
            target.classList.add('pc-flash');
            setTimeout(() => target.classList.remove('pc-flash'), 1400);
          }
        }
        // For Overview sections: scroll to the named section
        else if (item.section) {
          const target = document.querySelector(`[data-section="${item.section}"]`);
          if (target) {
            const body = document.querySelector('.drawer-body');
            if (body) {
              const rect = target.getBoundingClientRect();
              const bodyRect = body.getBoundingClientRect();
              body.scrollTop += rect.top - bodyRect.top - 20;
            }
            target.classList.add('pc-flash');
            setTimeout(() => target.classList.remove('pc-flash'), 1400);
          }
        }
      });
    });
  }

  return (
    <>
      {/* Hero dashboard card */}
      <div className="overview-dash">
        <div className="od-banner">
          <div className="od-banner-glow" style={{background: dotColor}}></div>
          <div className="od-banner-text">
            <div className="od-eyebrow">
              <span style={{
                display:'inline-block', width:8, height:8, borderRadius:'50%',
                background:dotColor, marginRight:6,
                boxShadow:`0 0 0 0 ${dotColor}`,
                animation:'odPulse 1.8s ease-in-out infinite'
              }}></span>
              {c.regionGroup} · {c.direction || 'Central'} · {season}
            </div>
            <h3 className="od-title">
              {c.orgType === 'Community'
                ? <>A community in the <em>{c.regionGroup}</em> region of the atlas.</>
                : <>A <em>{c.orgType.toLowerCase()}</em> serving multiple communities.</>}
            </h3>
          </div>
        </div>

        <div className="od-metrics">
          <div className="od-metric primary">
            <div className="od-metric-n">{nPop ? nPop.toLocaleString() : '—'}</div>
            <div className="od-metric-l">members</div>
          </div>
          <div className="od-metric">
            <div className="od-metric-n">{nPillars}<span className="od-metric-of">/4</span></div>
            <div className="od-metric-l">service pillars</div>
          </div>
          <div className="od-metric">
            <div className="od-metric-n">{nStaff}</div>
            <div className="od-metric-l">contacts</div>
          </div>
          <div className="od-metric">
            <div className="od-metric-n">{nDepts}</div>
            <div className="od-metric-l">departments</div>
          </div>
          <div className="od-metric accent">
            <div className="od-metric-n">{nPct}<span style={{fontSize:14}}>%</span></div>
            <div className="od-metric-l">documented</div>
            <div className="od-metric-bar">
              <div className="od-metric-bar-fill" style={{ width: pct + '%', background: dotColor }}></div>
            </div>
          </div>
        </div>

        {/* What we know — grid */}
        <div className="od-checks">
          <div className="od-checks-head">
            <div className="eyebrow">On file for this community</div>
            <div className="od-checks-summary">
              <strong>{onCount}</strong> of <strong>{has.length}</strong> data points filled in
            </div>
          </div>
          <div className="od-check-grid">
            {has.map((h, i) => (
              <button
                key={h.k}
                className={`od-check ${h.on?'on':'off'}`}
                style={{animationDelay: (0.04 * i) + 's'}}
                onClick={() => handleCheckClick(h)}
                disabled={!h.on}
                title={h.on ? `Jump to ${h.label}` : `${h.label} — not yet on file`}>
                <span className="od-check-mark">{h.on ? '✓' : '○'}</span>
                <span className="od-check-lab">{h.label}</span>
                {h.on && <span className="od-check-arrow">→</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Population context */}
        {!window.NA(c.popInfo) && (
          <div className="od-callout">
            <div className="od-callout-mark">i</div>
            <div>
              <div className="eyebrow">Population context</div>
              <div className="od-callout-body">
                {window.autoLink(c.popInfo)}
              </div>
            </div>
          </div>
        )}
        <window.EditableField community={c} communityId={c.id} fieldKey="popInfo" value={c.popInfo} label="Population notes" />
      </div>

      {/* Existing detail sections — kept for content fidelity */}
      <Section eyebrow="Bridge" title="Connecting survivors and youth" value={c.connect} community={c} communityId={c.id} fieldKey="connect" anchor="sec-connect" />
      <Section eyebrow="Strategy" title="Strategic plan" value={c.strategicPlan} community={c} communityId={c.id} fieldKey="strategicPlan" anchor="sec-strategicPlan" />
      <Section eyebrow="Governance" title="Annual General Meeting" value={c.agm} community={c} communityId={c.id} fieldKey="agm" anchor="sec-agm" />
      <Section eyebrow="Governance" title="Financial statements" value={c.financials} community={c} communityId={c.id} fieldKey="financials" anchor="sec-financials" />
      <Section eyebrow="Resources" title="Additional links" value={c.links} community={c} communityId={c.id} fieldKey="links" anchor="sec-links" />

      {!window.NA(c.notes) && (
        <div className="section">
          <div className="section-eyebrow"><span>Notes</span></div>
          <h3 className="section-title">Project notes</h3>
          <div className="section-body" style={{fontSize:12.5, fontStyle:'italic', color:'var(--ink-3)'}}>{c.notes}</div>
          <window.EditableField community={c} communityId={c.id} fieldKey="notes" value={c.notes} label="Project notes" />
        </div>
      )}
    </>
  );
}

function ServicesTab({ c, searchQuery }) {
  const pillars = window.PILLARS;
  const activeCount = pillars.filter(p => window.pillarOn(c, p.key)).length;
  const pct = Math.round(activeCount / pillars.length * 100);

  // Extra ad-hoc stats parsed from this community
  const fieldStats = useMemo(() => {
    const all = [c.physical, c.mental, c.spiritual, c.emotional, c.youth, c.survivors, c.connect].filter(Boolean);
    const totalWords = all.join(' ').split(/\s+/).filter(Boolean).length;
    const totalLinks = all.reduce((s, t) => s + (t.match(/https?:\/\//g) || []).length, 0);
    const totalSentences = all.reduce((s, t) => s + ((t.match(/[.!?](?:\s|$)/g) || []).length || 1), 0);
    return { totalWords, totalLinks, totalSentences };
  }, [c]);

  const nActive = window.useCountUp(activeCount, 1400);
  const nPct = window.useCountUp(pct, 1500);
  const nWords = window.useCountUp(fieldStats.totalWords, 1600);
  const nLinks = window.useCountUp(fieldStats.totalLinks, 1400);

  return (
    <div className="services-tab">
      {/* DASHBOARD HEADER */}
      <div className="services-header v2">
        <div className="sh-top">
          <div className="eyebrow">Services dashboard</div>
          <h3 className="sh-title">
            {activeCount === 4 ? 'Whole-person care documented.'
              : activeCount === 0 ? 'No service programming on file yet.'
              : activeCount === 1 ? 'One pillar documented so far.'
              : `${activeCount} of 4 pillars documented.`}
          </h3>
        </div>

        <div className="sh-metrics">
          <div className="sh-ring-wrap">
            <svg viewBox="0 0 100 100" className="sh-ring-svg">
              <circle cx="50" cy="50" r="44" fill="none" stroke="var(--paper-3)" strokeWidth="6" />
              <circle cx="50" cy="50" r="44" fill="none" stroke="var(--clay, #b8351e)" strokeWidth="6"
                strokeDasharray={`${pct * 2.7646} 276.46`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dasharray 1.8s cubic-bezier(.2,.7,.3,1)' }}
              />
            </svg>
            <div className="sh-ring-inner">
              <div className="sh-ring-num">{nActive}<span className="sh-ring-of">/{pillars.length}</span></div>
              <div className="sh-ring-lab">pillars</div>
            </div>
          </div>

          <div className="sh-stat-grid">
            <div className="sh-mini">
              <div className="sh-mini-n">{nPct}<span style={{fontSize:13}}>%</span></div>
              <div className="sh-mini-l">coverage</div>
            </div>
            <div className="sh-mini">
              <div className="sh-mini-n">{nWords}</div>
              <div className="sh-mini-l">words on file</div>
            </div>
            <div className="sh-mini">
              <div className="sh-mini-n">{nLinks}</div>
              <div className="sh-mini-l">source links</div>
            </div>
            <div className="sh-mini">
              <div className="sh-mini-n">{c.staff?.length || 0}</div>
              <div className="sh-mini-l">direct contacts</div>
            </div>
          </div>
        </div>

        <div className="sh-chips">
          {pillars.map(p => {
            const on = window.pillarOn(c, p.key);
            return (
              <span key={p.key} className={`sh-chip ${on?'on':''}`}
                style={on ? { background: p.hex, color: '#fbf6ec', borderColor: p.hex } : null}>
                <span className="sh-chip-icon">{on ? '✓' : '○'}</span>
                {p.label.split(' ')[0]}
              </span>
            );
          })}
        </div>
      </div>

      {/* PILLAR CARDS */}
      {pillars.map(p => {
        const value = c[p.key];
        const on = window.pillarOn(c, p.key);
        return <PillarServiceCard key={p.key} pillar={p} value={value} on={on} c={c} searchQuery={searchQuery} />;
      })}
    </div>
  );
}

function PillarServiceCard({ pillar, value, on, c, searchQuery }) {
  const [open, setOpen] = useState(true);

  // Extract links + word count for the meta line, but DO NOT drop any text.
  // Also surface structured contact info (phone, email, bare domains) as
  // quick-action chips above the narrative.
  const meta = useMemo(() => {
    if (!value) return { links: [], emails: [], phones: [], wordCount: 0, paragraphs: [] };
    const linkMatches = Array.from(value.matchAll(/(https?:\/\/[^\s)\]]+)/gi)).map(m => m[1]);
    // Bare domains like northwesthealthline.ca → prefixed for the chip row
    const bareMatches = Array.from(value.matchAll(
      /\b(?:www\.)?[a-z0-9][a-z0-9-]{1,62}(?:\.[a-z0-9-]{1,62})+\.(?:ca|com|org|net|edu|gov|io|co|info|us|uk|dev|app|health|care)(?:\/[^\s)\]]*)?/gi
    )).map(m => m[0]).filter(d => !linkMatches.some(l => l.includes(d)));
    const links = [...new Set([...linkMatches, ...bareMatches.map(d => 'https://' + d.replace(/^www\./i, 'www.'))])];
    const emails = [...new Set(Array.from(value.matchAll(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/g)).map(m => m[0]))];
    const phones = [...new Set(Array.from(value.matchAll(
      /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?:\s*(?:ext\.?|x)\s*\d+)?/gi
    )).map(m => m[0].trim()))];
    const wordCount = value.replace(/https?:\/\/\S+/g, ' ').split(/\s+/).filter(Boolean).length;
    const byBlankLine = value.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    const paragraphs = byBlankLine.length > 1 ? byBlankLine : [value.trim()];
    return { links, emails, phones, wordCount, paragraphs };
  }, [value]);

  if (!on) {
    return (
      <div className={`pillar-card ${pillar.key} pc-missing`} data-pillar={pillar.key}>
        <div className="pc-stripe" style={{background: pillar.hex}}></div>
        <div className="pc-body">
          <div className="pc-head">
            <div className="pc-icon" style={{borderColor: pillar.hex, color: pillar.hex}}>{pillar.icon}</div>
            <div className="pc-titles">
              <h3 className="pc-title">{pillar.label}</h3>
              <div className="pc-meta">{
                (window.fieldStatus(c, pillar.key, value) === 'missing' || window.fieldStatus(c, pillar.key, value) === 'review')
                  ? 'Being reviewed — update coming soon'
                  : 'No programming on file yet'
              }</div>
            </div>
            <span className={`pc-status off pcs-${(window.fieldStatus(c, pillar.key, value) === 'missing' || window.fieldStatus(c, pillar.key, value) === 'review') ? 'review' : window.fieldStatus(c, pillar.key, value)}`}>
              {(window.fieldStatus(c, pillar.key, value) === 'missing' || window.fieldStatus(c, pillar.key, value) === 'review')
                ? 'Under review'
                : (window.PENDING_COPY[window.fieldStatus(c, pillar.key, value)] || window.PENDING_COPY.empty).badge}
            </span>
          </div>
          <PendingNotice status={window.fieldStatus(c, pillar.key, value)} c={c} fieldKey={pillar.key} />
          <window.EditableField community={c} communityId={c.id} fieldKey={pillar.key} value={value} label={pillar.label} />
        </div>
      </div>
    );
  }

  // Render the COMPLETE text — never drop content.
  const display = searchQuery ? window.highlight(value, searchQuery) : window.autoLink(value);

  return (
    <div className={`pillar-card ${pillar.key} pc-active`} data-pillar={pillar.key}>
      <div className="pc-stripe" style={{background: pillar.hex}}></div>
      <div className="pc-body">
        <div className="pc-head">
          <div className="pc-icon active" style={{background: pillar.hex, color: '#fbf6ec'}}>{pillar.icon}</div>
          <div className="pc-titles">
            <h3 className="pc-title">{pillar.label}</h3>
            <div className="pc-meta">
              {meta.wordCount} words on file
              {meta.paragraphs.length > 1 && ` · ${meta.paragraphs.length} paragraphs`}
              {meta.links.length > 0 && ` · ${meta.links.length} link${meta.links.length===1?'':'s'}`}
            </div>
          </div>
          <button className="pc-status on" onClick={() => setOpen(o => !o)} aria-expanded={open}>
            {open ? '— Collapse' : '+ Expand'}
          </button>
        </div>

        {open && (
          <>
            {(meta.phones.length + meta.emails.length + meta.links.length) > 0 && (
              <div className="pc-quickbar">
                {meta.phones.slice(0, 6).map((p, i) => (
                  <a key={'p' + i} className="pc-chip pc-chip-phone"
                     href={'tel:' + p.replace(/[^\d+]/g, '')}>
                    <span className="pc-chip-icon">☎</span>{p}
                  </a>
                ))}
                {meta.emails.slice(0, 6).map((e, i) => (
                  <a key={'e' + i} className="pc-chip pc-chip-email"
                     href={'mailto:' + e}>
                    <span className="pc-chip-icon">✉</span>{e}
                  </a>
                ))}
                {meta.links.slice(0, 6).map((url, i) => {
                  let host = url; try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
                  return (
                    <a key={'u' + i} className="pc-chip pc-chip-link"
                       href={url} target="_blank" rel="noopener noreferrer">
                      <span className="pc-chip-icon">↗</span>{host}
                    </a>
                  );
                })}
              </div>
            )}
            <div className="pc-fullbody" style={{ borderLeftColor: pillar.hex }}>
              {display}
            </div>

            {(() => {
              const srcs = fieldLinksFor(c, pillar.key).filter(src =>
                !meta.links.some(u => u === src || u.replace(/\/$/,'') === src.replace(/\/$/,'')));
              return srcs.length ? <FieldLink urls={srcs} label={FIELD_LINK_LABEL[pillar.key]} /> : null;
            })()}

            {meta.links.length > 0 && (
              <div className="pc-links">
                <div className="pc-links-lab">Source links</div>
                <div className="pc-links-row">
                  {meta.links.map((url, i) => {
                    let host = url; try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
                    return (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="pc-link">
                        <span className="pc-link-icon">↗</span>{host}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        <window.EditableField community={c} communityId={c.id} fieldKey={pillar.key} value={value} label={pillar.label} />
      </div>
    </div>
  );
}

function PeopleTab({ c, searchQuery }) {
  return (
    <>
      <Section eyebrow="Survivors" title="How are survivors supported?" value={c.survivors} searchQuery={searchQuery} community={c} communityId={c.id} fieldKey="survivors" />
      <Section eyebrow="Youth" title="How are youth supported?" value={c.youth} searchQuery={searchQuery} community={c} communityId={c.id} fieldKey="youth" />
      <Section eyebrow="Bridge" title="Connecting survivors and youth" value={c.connect} searchQuery={searchQuery} community={c} communityId={c.id} fieldKey="connect" />
    </>
  );
}

// ============================================================================
// CONTACT TAB — full real CMS for staff and departments
// ============================================================================
function ContactTab({ c }) {
  const cms = window.useCMS();
  const staff = c.staff || [];
  const depts = c.departments || [];
  const [addingStaff, setAddingStaff] = useState(false);
  const [addingDept, setAddingDept] = useState(false);

  return (
    <>
      {/* DEPARTMENTS */}
      <div className="section">
        <div className="section-eyebrow"><span>Departments</span></div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
          <h3 className="section-title">{depts.length === 0 ? 'No departments on file' : `${depts.length} ${depts.length===1?'department':'departments'}`}</h3>
          {cms.isAdmin && !addingDept && (
            <button className="add-btn" onClick={()=>setAddingDept(true)}>+ Add department</button>
          )}
        </div>
        {addingDept && (
          <DeptForm
            onSave={(entry)=>{ cms.addDept(c.id, depts, entry); setAddingDept(false); }}
            onCancel={()=>setAddingDept(false)}
          />
        )}
        {depts.length === 0 && !addingDept
          ? <div className="empty-section">No departments captured. {cms.isAdmin ? 'Add one above.' : 'Sign in as editor to add.'}</div>
          : (
            <div className="dept-grid">
              {depts.map(d => (
                <DeptCard key={d._id} dept={d} community={c} hex={window.dirHex(c)} />
              ))}
            </div>
          )
        }
      </div>

      {/* STAFF / DIRECT CONTACTS */}
      <div className="section">
        <div className="section-eyebrow"><span>Direct contacts</span></div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
          <h3 className="section-title">{staff.length > 0 ? `${staff.length} ${staff.length===1?'person':'people'} on file` : 'No staff on file'}</h3>
          {cms.isAdmin && !addingStaff && (
            <button className="add-btn" onClick={()=>setAddingStaff(true)}>+ Add person</button>
          )}
        </div>
        {addingStaff && (
          <StaffForm
            onSave={(entry)=>{ cms.addStaff(c.id, staff, entry); setAddingStaff(false); }}
            onCancel={()=>setAddingStaff(false)}
          />
        )}
        {staff.length === 0 && !addingStaff
          ? <PendingNotice status={window.fieldStatus(c, 'contacts')} c={c} fieldKey="contacts" />
          : (
            <div className="staff-grid">
              {staff.map(s => (
                <StaffCard key={s._id} s={s} community={c} hex={window.dirHex(c)} />
              ))}
            </div>
          )
        }
      </div>

      {/* RAW SHEET TEXT */}
      {!window.NA(c.contacts) && (
        <div className="section">
          <div className="section-eyebrow"><span>Original contact text (from sheet)</span></div>
          <h3 className="section-title">As recorded</h3>
          <div style={{whiteSpace:'pre-wrap', fontSize:12.5, lineHeight:1.7, fontFamily:'var(--mono)', background:'var(--paper-2)', padding:'14px 16px', borderLeft:`2px solid ${window.dirHex(c)}`, color:'var(--ink-2)'}}>
            {window.autoLink(c.contacts)}
          </div>
          <window.EditableField community={c} communityId={c.id} fieldKey="contacts" value={c.contacts} label="Original contact block" />
        </div>
      )}

      {c.website && (
        <div className="section">
          <div className="section-eyebrow"><span>Website</span></div>
          <h3 className="section-title">Official website</h3>
          <div className="section-body"><a href={c.website} target="_blank" rel="noopener noreferrer">{c.website} ↗</a></div>
          <window.EditableField community={c} communityId={c.id} fieldKey="website" value={c.website} label="Website" multiline={false} />
        </div>
      )}
    </>
  );
}

// ----- Staff card with edit/remove -----
function StaffCard({ s, community, hex }) {
  const cms = window.useCMS();
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <div className="staff-card edit-mode" style={{borderLeftColor: hex}}>
        <StaffForm
          initial={s}
          onSave={(patch)=>{ cms.updateStaff(community.id, community.staff, s._id, patch); setEditing(false); }}
          onCancel={()=>setEditing(false)}
          onDelete={()=>{ if (confirm('Delete this contact?')) cms.removeStaff(community.id, community.staff, s._id); }}
        />
      </div>
    );
  }
  return (
    <div className="staff-card" style={{borderLeftColor: hex}}>
      {s.name && <div className="name">{s.name}</div>}
      {s.role && <div className="role">{s.role}</div>}
      {s.dept && <div className="role" style={{color:'var(--ink-3)',fontSize:11}}>{s.dept}</div>}
      {s.phone && (
        <div className="contact-line">
          <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z"/>
          </svg>
          <a href={`tel:${s.phone.replace(/\D/g,'')}`}>{s.phone}</a>
          {s.ext && <span className="ext">ext {s.ext}</span>}
        </div>
      )}
      {s.email && (
        <div className="contact-line">
          <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <path d="M22 6l-10 7L2 6"/>
          </svg>
          <a href={`mailto:${s.email}`}>{s.email}</a>
        </div>
      )}
      {s.fax && (
        <div className="contact-line">
          <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>
          </svg>
          <span>Fax {s.fax}</span>
        </div>
      )}
      {s.link && (
        <div className="contact-line">
          <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          <a href={s.link} target="_blank" rel="noopener noreferrer">
            {(() => { try { return new URL(s.link).hostname.replace(/^www\./,''); } catch { return s.link; } })()} ↗
          </a>
        </div>
      )}
      {cms.isAdmin && (
        <div className="staff-actions">
          <button className="edit-btn" onClick={()=>setEditing(true)}>✎ Edit</button>
          <button className="edit-btn danger" onClick={()=>{ if (confirm('Delete this contact?')) cms.removeStaff(community.id, community.staff, s._id); }}>✕ Remove</button>
        </div>
      )}
    </div>
  );
}

function StaffForm({ initial = {}, onSave, onCancel, onDelete }) {
  const [name, setName] = useState(initial.name || '');
  const [role, setRole] = useState(initial.role || '');
  const [dept, setDept] = useState(initial.dept || '');
  const [phone, setPhone] = useState(initial.phone || '');
  const [email, setEmail] = useState(initial.email || '');
  return (
    <div className="edit-form staff-form">
      <div className="form-row">
        <div><label>Name</label><input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" autoFocus /></div>
        <div><label>Role / Title</label><input type="text" value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g. Health Director" /></div>
      </div>
      <div className="form-row">
        <div><label>Department</label><input type="text" value={dept} onChange={e=>setDept(e.target.value)} placeholder="e.g. Health & Wellness" /></div>
      </div>
      <div className="form-row">
        <div><label>Phone</label><input type="text" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(XXX) XXX-XXXX" /></div>
        <div><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@band.ca" /></div>
      </div>
      <div className="edit-actions">
        <button className="primary" onClick={()=>onSave({ name, role, dept, phone, email })}>Save contact</button>
        <button onClick={onCancel}>Cancel</button>
        {onDelete && <button className="danger" onClick={onDelete}>Delete</button>}
      </div>
    </div>
  );
}

// ----- Department card with edit/remove -----
function DeptCard({ dept, community, hex }) {
  const cms = window.useCMS();
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <div className="dept-card edit-mode" style={{borderLeftColor: hex}}>
        <DeptForm
          initial={dept}
          onSave={(patch)=>{ cms.updateDept(community.id, community.departments, dept._id, patch); setEditing(false); }}
          onCancel={()=>setEditing(false)}
          onDelete={()=>{ if (confirm('Delete this department?')) cms.removeDept(community.id, community.departments, dept._id); }}
        />
      </div>
    );
  }
  return (
    <div className="dept-card" style={{borderLeftColor: hex}}>
      <div className="dept-name">{dept.name || 'Untitled department'}</div>
      {dept.head && <div className="dept-head">Lead: <strong>{dept.head}</strong></div>}
      {dept.services && <div className="dept-services">{dept.services}</div>}
      <div className="dept-contact-row">
        {dept.phone && <a href={`tel:${dept.phone.replace(/\D/g,'')}`}>☎ {dept.phone}</a>}
        {dept.email && <a href={`mailto:${dept.email}`}>✉ {dept.email}</a>}
        {dept.address && <span className="dept-addr">📍 {dept.address}</span>}
      </div>
      {cms.isAdmin && (
        <div className="staff-actions">
          <button className="edit-btn" onClick={()=>setEditing(true)}>✎ Edit</button>
          <button className="edit-btn danger" onClick={()=>{ if (confirm('Delete this department?')) cms.removeDept(community.id, community.departments, dept._id); }}>✕ Remove</button>
        </div>
      )}
    </div>
  );
}

function DeptForm({ initial = {}, onSave, onCancel, onDelete }) {
  const [name, setName] = useState(initial.name || '');
  const [head, setHead] = useState(initial.head || '');
  const [phone, setPhone] = useState(initial.phone || '');
  const [email, setEmail] = useState(initial.email || '');
  const [address, setAddress] = useState(initial.address || '');
  const [services, setServices] = useState(initial.services || '');
  return (
    <div className="edit-form dept-form">
      <div className="form-row">
        <div style={{flex:2}}><label>Department name</label><input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Health & Wellness Department" autoFocus /></div>
        <div><label>Lead / Director</label><input type="text" value={head} onChange={e=>setHead(e.target.value)} placeholder="Person in charge" /></div>
      </div>
      <div className="form-row">
        <div><label>Phone</label><input type="text" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(XXX) XXX-XXXX" /></div>
        <div><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="dept@band.ca" /></div>
      </div>
      <div className="form-row">
        <div style={{flex:2}}><label>Address</label><input type="text" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Street, city, postal code" /></div>
      </div>
      <div className="form-row">
        <div style={{flex:1}}><label>Services & programs</label><textarea value={services} onChange={e=>setServices(e.target.value)} rows={3} placeholder="What this department offers, programs run, hours, etc." /></div>
      </div>
      <div className="edit-actions">
        <button className="primary" onClick={()=>onSave({ name, head, phone, email, address, services })}>Save department</button>
        <button onClick={onCancel}>Cancel</button>
        {onDelete && <button className="danger" onClick={onDelete}>Delete</button>}
      </div>
    </div>
  );
}

window.CommunityDrawer = CommunityDrawer;
