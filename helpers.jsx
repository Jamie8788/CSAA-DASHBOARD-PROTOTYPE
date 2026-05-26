/* global React */
const { useState, useEffect, useMemo, useRef, createContext, useContext } = React;

// ============================================================================
// Data transform: raw extracted shape → enriched runtime shape used by UI
// ============================================================================

function NA(v) {
  if (v === null || v === undefined) return true;
  const s = String(v).trim().toLowerCase();
  // A field counts as N/A only if it's truly empty or a known placeholder.
  // Even single-character values (e.g. 'b' used as WIP scratch input) count
  // as filled — otherwise the team's test data vanishes from the dashboard.
  return ['missing information','needs review','duplicate record','no definite value','n/a','na','-',''].includes(s);
}

const PILLARS = [
  { key: 'physical',  label: 'Physical Health',   color: 'var(--p-physical)',  hex:'#b8351e', icon: '◐', dir: 'South',  medicine: '' },
  { key: 'mental',    label: 'Mental Health',     color: 'var(--p-mental)',    hex:'#1a1612', icon: '◍', dir: 'West',   medicine: '' },
  { key: 'spiritual', label: 'Spiritual Support', color: 'var(--p-spiritual)', hex:'#d4a017', icon: '✦', dir: 'East',   medicine: '' },
  { key: 'emotional', label: 'Emotional Support', color: 'var(--p-emotional)', hex:'#6b8d6b', icon: '♡', dir: 'North',  medicine: '' },
];
window.PILLARS = PILLARS;

const ORG_TYPES = ['Community','Health Authority','Indigenous Organization','Friendship Centre','Child & Family Services','Umbrella Organization','Other'];
window.ORG_TYPES = ORG_TYPES;

const DIRECTIONS = ['East','South','West','North','Central'];
window.DIRECTIONS = DIRECTIONS;

const DIRECTION = {
  East:    { label:'East',  color:'#d4a017', medicine:'', season:'Spring', stage:'New beginnings' },
  South:   { label:'South', color:'#b8351e', medicine:'', season:'Summer', stage:'Growth · the body' },
  West:    { label:'West',  color:'#1a1612', medicine:'', season:'Autumn', stage:'Reflection · the mind' },
  North:   { label:'North', color:'#f6f0e0', medicine:'', season:'Winter', stage:'Wisdom · the heart' },
  Central: { label:'Central', color:'#6b8d6b', medicine:'', season:'All seasons', stage:'Cross-community' },
};
window.DIRECTION = DIRECTION;

const REGION_KEYS = ['Pilot','Algoma','East','South','West','North','Partner'];
window.REGION_KEYS = REGION_KEYS;

const POP_BUCKETS = [
  { key: 'under500', label: '< 500', test: p => p != null && p < 500 },
  { key: 'mid',      label: '500–1.5k', test: p => p != null && p >= 500 && p < 1500 },
  { key: 'large',    label: '1.5–5k',   test: p => p != null && p >= 1500 && p < 5000 },
  { key: 'xlarge',   label: '5k+',      test: p => p != null && p >= 5000 },
];
window.POP_BUCKETS = POP_BUCKETS;

function popBucket(p) {
  if (p == null) return null;
  if (p < 500) return 'under500';
  if (p < 1500) return 'mid';
  if (p < 5000) return 'large';
  return 'xlarge';
}
window.popBucket = popBucket;

function pillarOn(c, key) { return c['has' + key[0].toUpperCase() + key.slice(1)]; }
window.pillarOn = pillarOn;

function autoLink(text) {
  if (!text) return text;
  const re = /(https?:\/\/[^\s)]+)/g;
  const parts = String(text).split(re);
  return parts.map((p, i) => re.test(p)
    ? <a key={i} href={p} target="_blank" rel="noopener noreferrer">{p.length > 50 ? p.slice(0, 50) + '…' : p}</a>
    : <span key={i}>{p}</span>);
}
window.autoLink = autoLink;

function highlight(text, q) {
  if (!text || !q || q.length < 2) return text;
  const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  const parts = String(text).split(re);
  return parts.map((p, i) => re.test(p) ? <mark key={i} className="search-hit">{p}</mark> : <span key={i}>{p}</span>);
}
window.highlight = highlight;
window.NA = NA;

// id from name (stable)
function slugify(s) {
  return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);
}

// region group from section
function regionGroup(section) {
  if (!section) return 'Partner';
  if (section === 'First 10 (Pilot)') return 'Pilot';
  if (section.startsWith('Algoma')) return 'Algoma';
  if (['East','South','West','North'].includes(section)) return section;
  return 'Partner';
}

// parse population string like "700" or "700 (on-reserve), 350 (off)"
function parsePop(str) {
  if (!str) return null;
  const m = String(str).replace(/,/g,'').match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

const ORG_MARK_LETTERS = (name) => {
  const words = name.replace(/[()]/g,'').split(/\s+/).filter(w => w.length > 1);
  return (words[0]?.[0] || '?').toUpperCase() + (words[1]?.[0] || words[0]?.[1] || '').toUpperCase();
};

// Transform raw record from sheet into runtime shape
function enrichRaw(raw, idx) {
  const id = slugify(raw.name) + '-' + idx;
  const pop = parsePop(raw.population);
  const populationNote = raw.populationNote;
  const region = regionGroup(raw.section);
  const dir = raw.direction || (region === 'Pilot' || region === 'Algoma' ? 'North' : (region === 'Partner' ? 'Central' : region));
  const link = raw.link;
  const isWebsite = link && /^https?:\/\//.test(link);
  // service flags
  const hasPhysical = !NA(raw.physical);
  const hasMental = !NA(raw.mental);
  const hasSpiritual = !NA(raw.spiritual);
  const hasEmotional = !NA(raw.emotional);
  const hasYouth = !NA(raw.youth);
  const hasSurvivors = !NA(raw.survivors);
  const hasContacts = !NA(raw.contact);
  // completeness
  const fields = [raw.physical, raw.mental, raw.spiritual, raw.emotional, raw.survivors, raw.youth, raw.connect, raw.contact, raw.strategicPlan];
  const filled = fields.filter(f => !NA(f)).length;
  const completeness = filled / fields.length;

  return {
    id, raw, // keep raw for export
    name: raw.name,
    section: raw.section,
    regionGroup: region,
    orgType: raw.type || 'Community',
    direction: dir,
    population: pop,
    popInfo: populationNote,
    website: isWebsite ? link : null,
    websiteNote: !isWebsite ? link : null,
    contacts: raw.contact,
    physical: raw.physical, mental: raw.mental, spiritual: raw.spiritual, emotional: raw.emotional,
    survivors: raw.survivors, youth: raw.youth, connect: raw.connect,
    strategicPlan: raw.strategicPlan, agm: raw.agm, financials: raw.financials,
    notes: raw.notes, links: raw.additionalLinks,
    hasPhysical, hasMental, hasSpiritual, hasEmotional, hasYouth, hasSurvivors, hasContacts,
    completeness,
    lat: raw.lat, lon: raw.lon, lng: raw.lon,
    staff: Array.isArray(raw.staff) ? raw.staff.map((s,i) => ({...s, _id: s._id || `${id}-s${i}-${Date.now()}`})) : [],
    departments: Array.isArray(raw.departments) ? raw.departments : [],
    mark: ORG_MARK_LETTERS(raw.name),
    motif: idx % 5,
    sourceRow: raw.sourceRow,
  };
}
window.enrichRaw = enrichRaw;

// Build the runtime list (called once)
function buildAll() {
  // CMS may have replaced the dataset via Excel upload
  let raw = window.COMMUNITIES || [];
  try {
    const replaced = JSON.parse(localStorage.getItem('mino-atlas-dataset-v3') || 'null');
    if (Array.isArray(replaced) && replaced.length) raw = replaced;
  } catch {}
  return raw.map((r, i) => enrichRaw(r, i));
}

// =============================================================================
// SHEETJS WORKBOOK PARSER — runs in browser when admin uploads an updated xlsx.
// Mirrors what tools/process_sheet.py does on the server.
// =============================================================================
function parseSheetWorkbook(wb) {
  if (typeof XLSX === 'undefined') throw new Error('SheetJS not loaded');
  const SHEET_NAMES = ['Master Sheet', wb.SheetNames[0]];
  let ws = null;
  for (const n of SHEET_NAMES) if (wb.Sheets[n]) { ws = wb.Sheets[n]; break; }
  if (!ws) throw new Error('No sheet found');
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const SECTION_NAMES = new Set([
    'first 10 (pilot)',
    'second project - environmental scan - local and regional communities',
    'algoma district first nation communities',
    'east','south','west','north',
    'indigenous health authorities','indigenous organizations','indigenous friendship centres',
    'child and family services','umbrella organizations',
    'nishnawbe aski nation','mushkegowuk council','james bay cree',
    'access open minds\n(esprits ouverts)','access open minds (esprits ouverts)'
  ]);
  function normName(s) {
    return String(s||'').toLowerCase().replace(/\s+/g,' ').replace(/[\s\(\)\/,'\-\.#]/g,'').replace(/firstnation(s)?/g,'fn').trim();
  }

  let curSection = '';
  const records = [];
  const dedup = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const A = String(r[0]||'').replace(/\s+/g,' ').trim();
    const B = String(r[1]||'').replace(/\s+/g,' ').trim();
    if (!A && !B) continue;
    if (A && (!B || B === '') && (SECTION_NAMES.has(A.toLowerCase()) || A.length < 80)) {
      curSection = A; continue;
    }
    if (B.toLowerCase() === 'duplicate record') continue;
    if (!A || A.length > 150) continue;

    const rec = {
      name: A, section: curSection, link: B,
      contact: String(r[2]||'').trim(),
      physical: String(r[3]||'').trim(),
      mental: String(r[4]||'').trim(),
      spiritual: String(r[5]||'').trim(),
      emotional: String(r[6]||'').trim(),
      survivors: String(r[7]||'').trim(),
      youth: String(r[8]||'').trim(),
      connect: String(r[9]||'').trim(),
      population: String(r[10]||'').trim(),
      populationNote: String(r[11]||'').trim(),
      additionalLinks: String(r[12]||'').trim(),
      strategicPlan: String(r[13]||'').trim(),
      agm: String(r[14]||'').trim(),
      financials: String(r[15]||'').trim(),
      notes: String(r[17]||'').trim(),
      sourceRow: i + 1,
    };

    // Section → orgType + direction
    const s = (rec.section||'').toLowerCase();
    if (s.includes('health authorit')) rec.type = 'Health Authority';
    else if (s.includes('friendship')) rec.type = 'Friendship Centre';
    else if (s.includes('child and family') || s.includes('child & family')) rec.type = 'Child & Family Services';
    else if (s.includes('umbrella')) rec.type = 'Umbrella Organization';
    else if (s.includes('organization') && !s.includes('umbrella')) rec.type = 'Indigenous Organization';
    else rec.type = 'Community';

    if (['East','South','West','North'].includes(rec.section)) rec.direction = rec.section;
    else if (s.includes('algoma') || s.includes('pilot')) rec.direction = 'North';
    else if (rec.type === 'Community') rec.direction = 'North';
    else rec.direction = 'Central';

    // Preserve lat/lon from previous record with same name if available
    const existingMatch = (window.COMMUNITIES || []).find(c => normName(c.name) === normName(rec.name));
    if (existingMatch) { rec.lat = existingMatch.lat; rec.lon = existingMatch.lon; }

    // Dedup by normalized name — merge non-empty fields
    const k = normName(rec.name);
    if (dedup.has(k)) {
      const ex = records[dedup.get(k)];
      for (const key of Object.keys(rec)) if (!ex[key] && rec[key]) ex[key] = rec[key];
    } else {
      dedup.set(k, records.length); records.push(rec);
    }
  }
  return records;
}
window.parseSheetWorkbook = parseSheetWorkbook;
window.buildAll = buildAll;

// ============================================================================
// REAL CMS — overrides applied LIVE on top of base data
// Persisted to localStorage. Supports: edit any field, add/remove/update staff,
// add/remove/update departments, add new community, delete community,
// import/export JSON.
// ============================================================================

const CMS_STORAGE_KEY = 'mino-atlas-cms-v3';
const CMS_PASSWORD = 'mino2025'; // shared admin password (community trust)
const ATLAS_TOKEN_KEY = 'atlas-cms-token';
const ATLAS_USER_KEY = 'atlas-cms-user';

// Try the backend for sign-in first (so admin uploads persist for everyone).
// Falls back to the legacy local-only password check if the backend is gone.
async function backendSignIn(username, password) {
  try {
    const form = new FormData();
    form.append('username', username);
    form.append('password', password);
    const res = await fetch('/api/auth/login', { method: 'POST', body: form, credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.access_token) {
      localStorage.setItem(ATLAS_TOKEN_KEY, data.access_token);
      localStorage.setItem(ATLAS_USER_KEY, JSON.stringify(data.user || {}));
      return data;
    }
  } catch (e) { /* offline — fall through */ }
  return null;
}

async function backendUploadXlsx(file) {
  const token = localStorage.getItem(ATLAS_TOKEN_KEY);
  if (!token) return { ok: false, error: 'Not authenticated to backend' };
  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/communities/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: fd,
      credentials: 'include',
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      return { ok: false, error: (detail && detail.detail) || res.statusText };
    }
    return { ok: true, body: await res.json() };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
window.backendUploadXlsx = backendUploadXlsx;

function loadCMS() {
  try { return JSON.parse(localStorage.getItem(CMS_STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
function saveCMS(state) {
  try { localStorage.setItem(CMS_STORAGE_KEY, JSON.stringify(state)); } catch {}
}

// CMS shape:
// {
//   fields: { [communityId]: { fieldName: newValue, ... } },
//   staff:  { [communityId]: [{_id, name, role, phone, email, dept}] },  // overrides ENTIRE list
//   depts:  { [communityId]: [{_id, name, phone, email, head, services}] },
//   added:  [enrichedCommunity, ...],   // new communities created in CMS
//   deleted: [communityId, ...]
// }

const CMSContext = createContext(null);

function CMSProvider({ children }) {
  const [cms, setCMS] = useState(() => {
    const s = loadCMS();
    return {
      fields: s.fields || {},
      staff: s.staff || {},
      depts: s.depts || {},
      added: s.added || [],
      deleted: s.deleted || [],
    };
  });
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('mino-admin') === '1');

  useEffect(() => { saveCMS(cms); }, [cms]);

  // Try backend first (username defaults to 'admin'), fall back to local password.
  // Returns true synchronously if the local password matches so the UI snaps in,
  // and the backend login runs in parallel to issue a token for uploads.
  function signIn(password, username = 'admin') {
    backendSignIn(username, password).then((ok) => {
      if (ok) {
        sessionStorage.setItem('mino-admin', '1');
        setIsAdmin(true);
      }
    });
    if (password === CMS_PASSWORD) {
      sessionStorage.setItem('mino-admin', '1');
      setIsAdmin(true);
      return true;
    }
    return false;
  }
  function signOut() {
    sessionStorage.removeItem('mino-admin');
    localStorage.removeItem(ATLAS_TOKEN_KEY);
    localStorage.removeItem(ATLAS_USER_KEY);
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(()=>{});
    setIsAdmin(false);
  }

  // ---- field edits ----
  function updateField(communityId, key, value) {
    setCMS(prev => ({
      ...prev,
      fields: {
        ...prev.fields,
        [communityId]: { ...(prev.fields[communityId] || {}), [key]: value }
      }
    }));
  }
  function revertField(communityId, key) {
    setCMS(prev => {
      const next = { ...(prev.fields[communityId] || {}) };
      delete next[key];
      const newFields = { ...prev.fields };
      if (Object.keys(next).length) newFields[communityId] = next;
      else delete newFields[communityId];
      return { ...prev, fields: newFields };
    });
  }

  // ---- staff CRUD ----
  function getStaff(communityId, baseStaff) {
    return cms.staff[communityId] !== undefined ? cms.staff[communityId] : baseStaff;
  }
  function setStaff(communityId, list) {
    setCMS(prev => ({ ...prev, staff: { ...prev.staff, [communityId]: list } }));
  }
  function addStaff(communityId, baseStaff, entry) {
    const current = cms.staff[communityId] !== undefined ? cms.staff[communityId] : [...baseStaff];
    const next = [...current, { ...entry, _id: `s-${Date.now()}-${Math.random().toString(36).slice(2,7)}` }];
    setStaff(communityId, next);
  }
  function updateStaff(communityId, baseStaff, sId, patch) {
    const current = cms.staff[communityId] !== undefined ? cms.staff[communityId] : [...baseStaff];
    setStaff(communityId, current.map(s => s._id === sId ? {...s, ...patch} : s));
  }
  function removeStaff(communityId, baseStaff, sId) {
    const current = cms.staff[communityId] !== undefined ? cms.staff[communityId] : [...baseStaff];
    setStaff(communityId, current.filter(s => s._id !== sId));
  }

  // ---- departments CRUD ----
  function getDepts(communityId, baseDepts) {
    return cms.depts[communityId] !== undefined ? cms.depts[communityId] : baseDepts;
  }
  function setDepts(communityId, list) {
    setCMS(prev => ({ ...prev, depts: { ...prev.depts, [communityId]: list } }));
  }
  function addDept(communityId, baseDepts, entry) {
    const current = cms.depts[communityId] !== undefined ? cms.depts[communityId] : [...(baseDepts||[])];
    setDepts(communityId, [...current, { ...entry, _id: `d-${Date.now()}-${Math.random().toString(36).slice(2,7)}` }]);
  }
  function updateDept(communityId, baseDepts, dId, patch) {
    const current = cms.depts[communityId] !== undefined ? cms.depts[communityId] : [...(baseDepts||[])];
    setDepts(communityId, current.map(d => d._id === dId ? {...d, ...patch} : d));
  }
  function removeDept(communityId, baseDepts, dId) {
    const current = cms.depts[communityId] !== undefined ? cms.depts[communityId] : [...(baseDepts||[])];
    setDepts(communityId, current.filter(d => d._id !== dId));
  }

  // ---- import / export / reset ----
  function exportJSON() {
    const json = JSON.stringify(cms, null, 2);
    const blob = new Blob([json], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `mino-atlas-cms-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function importJSON(json) {
    try {
      const obj = JSON.parse(json);
      setCMS({
        fields: obj.fields || {},
        staff: obj.staff || {},
        depts: obj.depts || {},
        added: obj.added || [],
        deleted: obj.deleted || [],
      });
      return true;
    } catch (e) { return false; }
  }
  function resetAll() {
    setCMS({ fields:{}, staff:{}, depts:{}, added:[], deleted:[] });
    try { localStorage.removeItem('mino-atlas-dataset-v3'); } catch {}
    setTimeout(()=>window.location.reload(), 100);
  }

  // Replace the entire dataset (from Excel upload). Bumps a counter so buildAll re-runs.
  function replaceDataset(records) {
    try { localStorage.setItem('mino-atlas-dataset-v3', JSON.stringify(records)); } catch (e) { console.error(e); }
    setCMS(prev => ({ ...prev, fields:{}, staff:{}, depts:{}, dataSource: Date.now() }));
    setTimeout(()=>window.location.reload(), 200);
  }
  function editCount() {
    return Object.keys(cms.fields).length
      + Object.values(cms.staff).reduce((a,l)=>a+l.length,0)
      + Object.values(cms.depts).reduce((a,l)=>a+l.length,0)
      + cms.added.length;
  }

  // ---- apply overrides to a community ----
  function applyOverrides(c) {
    const fieldOv = cms.fields[c.id] || {};
    const staffOv = cms.staff[c.id];
    const deptOv = cms.depts[c.id];
    const merged = { ...c, ...fieldOv };
    if (staffOv !== undefined) merged.staff = staffOv;
    if (deptOv !== undefined) merged.departments = deptOv;
    // refresh derived flags from possibly-edited values
    merged.hasPhysical = !NA(merged.physical);
    merged.hasMental = !NA(merged.mental);
    merged.hasSpiritual = !NA(merged.spiritual);
    merged.hasEmotional = !NA(merged.emotional);
    merged.hasYouth = !NA(merged.youth);
    merged.hasSurvivors = !NA(merged.survivors);
    return merged;
  }

  return (
    <CMSContext.Provider value={{
      isAdmin, signIn, signOut,
      cms,
      updateField, revertField,
      addStaff, updateStaff, removeStaff,
      addDept, updateDept, removeDept,
      exportJSON, importJSON, resetAll, editCount,
      applyOverrides,
      replaceDataset,
    }}>{children}</CMSContext.Provider>
  );
}
window.CMSProvider = CMSProvider;
window.useCMS = () => useContext(CMSContext);

// ============================================================================
// AdminToolbar — sign-in pill + status
// ============================================================================

function AdminToolbar() {
  const cms = window.useCMS();
  const [showLogin, setShowLogin] = useState(false);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const fileRef = useRef(null);

  function tryLogin() {
    if (cms.signIn(pw)) { setShowLogin(false); setPw(''); setErr(false); }
    else { setErr(true); setPw(''); }
  }

  function onImport(e) {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const ok = cms.importJSON(r.result);
      alert(ok ? 'Edits imported.' : 'Import failed — invalid JSON.');
    };
    r.readAsText(f);
  }

  // Import a fresh Excel sheet.
  // Preferred path: send to the backend so the new dataset persists for every
  // visitor and the analytics endpoints recompute against it.
  // Fallback: parse client-side and store in this browser only (legacy).
  async function onImportXLSX(e) {
    const f = e.target.files[0];
    if (!f) return;

    // 1) Try backend upload — this is the "state of the art" path the admin wants.
    const result = await window.backendUploadXlsx(f);
    if (result.ok) {
      const r = result.body || {};
      alert(`Master sheet uploaded.\n\n${r.records || '?'} records · dataset v${r.version || '?'}\n\nReloading so everyone sees the new data…`);
      setTimeout(() => window.location.reload(), 400);
      return;
    }
    console.warn('[atlas] Backend upload failed:', result.error);

    // 2) Fallback: parse in browser and store in localStorage (visible only here).
    if (typeof XLSX === 'undefined') {
      alert(
        'Backend not reachable and the in-browser Excel parser is still loading.\n\n'
        + 'Backend said: ' + (result.error || 'unknown') + '\n\nTry again in a moment.'
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type:'array' });
        const records = window.parseSheetWorkbook(wb);
        if (!records || !records.length) { alert('No records parsed from the sheet.'); return; }
        cms.replaceDataset(records);
        alert(
          `Backend unavailable — imported ${records.length} records LOCALLY only.\n\n`
          + 'Reason: ' + (result.error || 'no backend')
          + '\n\nStart the server and try again for the changes to be visible to everyone.'
        );
      } catch (err) {
        console.error(err);
        alert('Could not parse Excel file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(f);
  }

  if (!cms.isAdmin) {
    return (
      <div className="admin-toolbar">
        {showLogin ? (
          <div className="admin-login">
            <input
              type="password" placeholder="Editor password" value={pw}
              onChange={e=>{setPw(e.target.value); setErr(false);}}
              onKeyDown={e=>e.key==='Enter' && tryLogin()}
              autoFocus
              className={err?'err':''}
            />
            <button onClick={tryLogin}>Sign in</button>
            <button className="ghost" onClick={()=>{setShowLogin(false); setPw(''); setErr(false);}}>Cancel</button>
          </div>
        ) : (
          <button className="admin-pill" onClick={()=>setShowLogin(true)} title="Editor sign-in">
            <span className="dot"></span> Editor sign-in
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="admin-toolbar admin-active">
      <span className="admin-pill on">
        <span className="dot live"></span> Editor mode · {cms.editCount()} edit{cms.editCount()===1?'':'s'}
      </span>
      <label className="admin-action xlsx" title="Drop in an updated master sheet to replace ALL data">
         Upload Excel
        <input type="file" accept=".xlsx,.xls" hidden onChange={onImportXLSX} />
      </label>
      <button className="admin-action" onClick={cms.exportJSON} title="Download all edits as JSON">↓ Export edits</button>
      <button className="admin-action" onClick={()=>fileRef.current?.click()} title="Load previously exported edits">↑ Import edits</button>
      <input ref={fileRef} type="file" accept="application/json" hidden onChange={onImport} />
      <button className="admin-action" onClick={()=>{ if (confirm('Discard all your edits?')) cms.resetAll(); }} title="Discard all edits">⟲ Reset</button>
      <button className="admin-action" onClick={cms.signOut} title="Sign out">Sign out</button>
    </div>
  );
}
window.AdminToolbar = AdminToolbar;

// ============================================================================
// Top Banner — at-a-glance live status (no language placeholders)
// ============================================================================

const SEASONS = [
  { en:'Winter',  range:[11, 1], color:'#cabd9c', mood:'Time for stories, ceremony, deep rest.' },
  { en:'Spring',  range:[2, 4],  color:'#d4a017', mood:'New beginnings, renewal, fresh programs starting.' },
  { en:'Summer',  range:[5, 7],  color:'#b8351e', mood:'Growth, harvest, youth on the land.' },
  { en:'Autumn',  range:[8, 10], color:'#1a1612', mood:'Reflection, gathering, preparing for the cold months.' },
];
function currentSeason() {
  const m = new Date().getMonth();
  if (m === 11 || m <= 1) return SEASONS[0];
  if (m <= 4) return SEASONS[1];
  if (m <= 7) return SEASONS[2];
  return SEASONS[3];
}

const ROTATING_FACTS = [
  { kicker: 'Today',     line: data => `Showing ${data.totalCommunities} communities and ${data.totalOrgs} partner organizations.` },
  { kicker: 'Coverage',  line: data => `${data.allFour}/${data.totalCommunities} communities document all four service pillars.` },
  { kicker: 'Youth',     line: data => `${data.withYouth} communities have documented youth programming.` },
  { kicker: 'Survivors', line: data => `${data.withSurvivors} communities have documented survivor support.` },
  { kicker: 'Records',   line: data => `${data.totalStaff} direct contacts on file across the dataset.` },
];

function GreetingBanner() {
  const [i, setI] = useState(0);
  const all = useMemo(() => (typeof window.buildAll === 'function' ? window.buildAll() : []), []);

  const data = useMemo(() => {
    const comms = all.filter(c => c.orgType === 'Community');
    return {
      totalCommunities: comms.length,
      totalOrgs: all.length - comms.length,
      withYouth: all.filter(c => c.hasYouth).length,
      withSurvivors: all.filter(c => c.hasSurvivors).length,
      allFour: all.filter(c => c.hasPhysical && c.hasMental && c.hasSpiritual && c.hasEmotional).length,
      totalStaff: all.reduce((s,c) => s + (c.staff?.length || 0), 0),
    };
  }, [all]);

  useEffect(() => {
    const t = setInterval(() => setI(p => (p+1) % ROTATING_FACTS.length), 5500);
    return () => clearInterval(t);
  }, []);

  const fact = ROTATING_FACTS[i];
  const s = currentSeason();

  return (
    <div className="status-banner">
      <div className="banner-inner">
        <div className="banner-left">
          <span className="bl-kicker">{fact.kicker}</span>
          <span className="bl-line" key={i}>{fact.line(data)}</span>
        </div>
        <div className="banner-mid">
          <span className="bm-dot" style={{background:s.color, border: s.en==='Winter'?'1px solid var(--ink-3)':'none'}}></span>
          <span className="bm-season">{s.en}</span>
          <span className="bm-sep">·</span>
          <span className="bm-mood">{s.mood}</span>
        </div>
        <div className="banner-right">
          <span className="br-live"><span className="lpulse"></span> Live</span>
          <span className="br-ack">Honouring the original peoples of these lands.</span>
        </div>
      </div>
    </div>
  );
}
window.GreetingBanner = GreetingBanner;

// ============================================================================
// HowToUse ribbon — replaces the language-bearing teachings ribbon
// ============================================================================
const HOW_TO = [
  { icon:'⌖', title:'Find a community', body:'Search by name or filter by region, population, or programming. The map and directory stay in sync.' },
  { icon:'◐', title:'See what\u2019s working', body:'Each record lists physical, mental, spiritual, and emotional health services in the community\u2019s own words.' },
  { icon:'☎', title:'Reach the right person', body:'Direct phone, email, and department contacts are parsed from the master sheet for every record on file.' },
  { icon:'✎', title:'Editors keep it current', body:'Sign in as an editor to update any field, add staff, or replace the dataset with an updated Excel sheet.' },
];
function TeachingsRibbon() {
  return (
    <div className="teachings-ribbon">
      <div className="tr-inner">
        <div className="tr-eyebrow">How to use this atlas</div>
        <div className="tr-grid">
          {HOW_TO.map(t => (
            <div key={t.title} className="tr-cell" tabIndex={0}>
              <div className="tr-en" style={{fontSize:32, lineHeight:1}}>{t.icon}</div>
              <div className="tr-on" style={{marginTop:8}}>{t.title}</div>
              <div className="tr-desc">{t.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
window.TeachingsRibbon = TeachingsRibbon;

// ============================================================================
// EditableField — inline editor used in admin mode
// ============================================================================
function EditableField({ communityId, fieldKey, value, multiline = true, label, placeholder = '' }) {
  const cms = window.useCMS();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  useEffect(() => { setDraft(value || ''); }, [value]);
  const isOverridden = cms.cms.fields[communityId]?.[fieldKey] !== undefined;

  if (!cms.isAdmin) return null;

  if (!editing) {
    return (
      <div className="editable-row">
        <button className="edit-btn" onClick={()=>setEditing(true)} title={`Edit ${label}`}>
          ✎ Edit
        </button>
        {isOverridden && (
          <button className="edit-btn revert" onClick={()=>cms.revertField(communityId, fieldKey)} title="Revert to original">
            ⟲ Revert
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="edit-form">
      <div className="edit-label">{label}</div>
      {multiline
        ? <textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder={placeholder} rows={5} autoFocus />
        : <input type="text" value={draft} onChange={e=>setDraft(e.target.value)} placeholder={placeholder} autoFocus />
      }
      <div className="edit-actions">
        <button className="primary" onClick={()=>{ cms.updateField(communityId, fieldKey, draft); setEditing(false); }}>Save</button>
        <button onClick={()=>{ setDraft(value || ''); setEditing(false); }}>Cancel</button>
      </div>
    </div>
  );
}
window.EditableField = EditableField;

// ============================================================================
// Accessibility & theme — replaces the old "Elder mode" toggle.
// Stores prefs in localStorage so they persist.
// ============================================================================
const A11Y_KEY = 'mino-a11y-v1';
const DEFAULT_A11Y = { text: 'M', contrast: false, motion: true, theme: 'paper' };

function loadA11y() {
  try { return { ...DEFAULT_A11Y, ...JSON.parse(localStorage.getItem(A11Y_KEY) || '{}') }; }
  catch { return DEFAULT_A11Y; }
}

function AccessibilityPanel() {
  const [open, setOpen] = useState(false);
  const [pref, setPref] = useState(loadA11y);

  useEffect(() => {
    try { localStorage.setItem(A11Y_KEY, JSON.stringify(pref)); } catch {}
    const root = document.documentElement;
    root.setAttribute('data-text-size', pref.text);
    root.setAttribute('data-theme', pref.theme);
    root.classList.toggle('high-contrast', !!pref.contrast);
    root.classList.toggle('reduce-motion', !pref.motion);
  }, [pref]);

  function set(k, v) { setPref(p => ({ ...p, [k]: v })); }

  return (
    <>
      <button
        className={`a11y-pill ${open?'on':''}`}
        onClick={() => setOpen(o => !o)}
        title="Accessibility & appearance"
        aria-expanded={open}
      >
        <span className="a11y-glyph">Aa</span>
        <span className="a11y-label">Accessibility</span>
      </button>
      {open && (
        <div className="a11y-panel" role="dialog" aria-label="Accessibility settings">
          <div className="a11y-head">
            <div className="a11y-title">Accessibility &amp; appearance</div>
            <button className="a11y-x" onClick={() => setOpen(false)} title="Close">✕</button>
          </div>

          <div className="a11y-group">
            <div className="a11y-glabel">Text size</div>
            <div className="a11y-seg">
              {['S','M','L','XL'].map(s => (
                <button key={s} className={pref.text===s?'on':''} onClick={() => set('text', s)}>{s}</button>
              ))}
            </div>
            <div className="a11y-hint">Larger text helps everyone read comfortably.</div>
          </div>

          <div className="a11y-group">
            <div className="a11y-glabel">Theme</div>
            <div className="a11y-themes">
              {[
                { id:'paper',     name:'Paper',     swatches:['#f5ede0','#1a1612','#b8351e'] },
                { id:'dawn',      name:'Dawn',      swatches:['#fff4e6','#3a1d12','#d4a017'] },
                { id:'forest',    name:'Forest',    swatches:['#f0ecd9','#1d2e1d','#6b8d6b'] },
                { id:'midnight',  name:'Midnight',  swatches:['#171411','#f5ede0','#d4a017'] },
              ].map(t => (
                <button
                  key={t.id}
                  className={`a11y-theme ${pref.theme===t.id?'on':''}`}
                  onClick={() => set('theme', t.id)}
                  title={t.name}
                >
                  <span className="theme-stack">
                    {t.swatches.map((c,i) => <span key={i} style={{background:c}}></span>)}
                  </span>
                  <span className="theme-name">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="a11y-group">
            <div className="a11y-row">
              <label className="a11y-switch">
                <input type="checkbox" checked={pref.contrast} onChange={e => set('contrast', e.target.checked)} />
                <span className="sw"></span>
                <span className="lbl">High contrast</span>
              </label>
              <div className="a11y-hint">Sharper edges, stronger borders, ink-black text.</div>
            </div>
            <div className="a11y-row">
              <label className="a11y-switch">
                <input type="checkbox" checked={pref.motion} onChange={e => set('motion', e.target.checked)} />
                <span className="sw"></span>
                <span className="lbl">Allow motion</span>
              </label>
              <div className="a11y-hint">Turn off to pause animations and pulses.</div>
            </div>
          </div>

          <button className="a11y-reset" onClick={() => setPref(DEFAULT_A11Y)}>↺ Reset to defaults</button>
        </div>
      )}
    </>
  );
}
window.AccessibilityPanel = AccessibilityPanel;

// stable hex per direction
window.dirHex = function(c) {
  const d = c.direction || 'Central';
  return DIRECTION[d]?.color || '#6b8d6b';
};

// count-up — smoothly animates a number from 0 to `target` using requestAnimationFrame.
// Re-runs whenever target changes; uses an eased cubic curve for satisfying motion.
function useCountUp(target, duration = 1600) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target === 0) { setV(0); return; }
    let raf;
    let start = null;
    const from = 0, to = target;
    const ease = (t) => 1 - Math.pow(1 - t, 3); // cubic ease-out
    function step(ts) {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      const e = ease(t);
      const cur = from + (to - from) * e;
      // Round, but keep one decimal for small targets if needed; here we always integer-round
      setV(Math.round(cur));
      if (t < 1) raf = requestAnimationFrame(step);
      else setV(to);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

window.useCountUp = useCountUp;
