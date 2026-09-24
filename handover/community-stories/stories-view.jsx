/* global React */
// Community Stories — narrative scroller + interactive games.
const { useState, useMemo, useEffect, useRef } = React;

const DIR_INFO = [
  { key:'East',  name:'East',  col:'#d4a017', intro:'Stories of awakening — programs being born, ceremonies returning, the work of new beginnings.' },
  { key:'South', name:'South', col:'#b8351e', intro:'Stories of growth — youth programming, vitality, and the relationships that hold a community together.' },
  { key:'West',  name:'West',  col:'#1a1612', intro:'Stories of reflection — mental health work, healing from harm, walking the harder road.' },
  { key:'North', name:'North', col:'#cabd9c', intro:'Stories of wisdom — elders, ceremony, the deep memory the community carries forward.' },
];

function StoriesView({ all, onSelect }) {
  // Honour site.showJourneyGame setting. If admin disabled it, start on quotes.
  const settings = window.ATLAS_SETTINGS || {};
  const gamesEnabled = String(settings['site.showJourneyGame'] || 'true').toLowerCase() !== 'false';
  const [tab, setTab] = useState('journey');
  const [, force] = useState(0);
  useEffect(() => {
    function s() { force((t) => t + 1); }
    window.addEventListener('atlas:settings', s);
    return () => window.removeEventListener('atlas:settings', s);
  }, []);

  return (
    <div className="stories-view">
      <header className="stories-header">
        <div className="eyebrow">Community Stories</div>
        <h2>Paddle the territory. Meet the communities.</h2>
        <p>
          An animated journey through the four directions — every stop is a REAL
          community, and everything you hear at the fire is pulled straight from
          its own records. Nothing is invented.
        </p>
      </header>

      {/* The page IS the journey now — the old quiz/matching games are retired
          (their code remains below for easy restoration, just never rendered). */}
      <JourneyOfCare all={all} onSelect={onSelect} />
    </div>
  );
}
window.StoriesView = StoriesView;


// ============================================================================
// Quote Wall — the original quotes view, but without language headers
// ============================================================================
function QuoteWall({ all, onSelect }) {
  const buckets = useMemo(() => {
    const out = {};
    for (const d of DIR_INFO) {
      const inDir = all.filter(c => c.direction === d.key && c.orgType === 'Community');
      const scored = inDir.map(c => ({
        c,
        score: ['physical','mental','spiritual','emotional','survivors','youth','connect']
          .reduce((n,k) => n + ((c[k] && !window.NA(c[k])) ? String(c[k]).length : 0), 0),
      })).sort((a,b) => b.score - a.score);
      out[d.key] = scored.slice(0, 5).map(s => s.c);
    }
    return out;
  }, [all]);

  return (
    <>
      {DIR_INFO.map(d => {
        const list = buckets[d.key] || [];
        if (!list.length) return null;
        return (
          <section key={d.key} className="story-section" style={{'--dir':d.col}}>
            <div className="story-section-head">
              <div className="story-swatch" style={{background:d.col, border: d.key==='North'?'1px solid var(--ink-3)':'none'}}></div>
              <div>
                <div className="story-section-title">{d.name}</div>
              </div>
            </div>
            <p className="story-section-intro">{d.intro}</p>
            <div className="story-grid">
              {list.map(c => {
                const fields = ['physical','spiritual','youth','survivors','mental','emotional','connect'];
                let bestField = null, bestText = '';
                for (const f of fields) {
                  const v = c[f];
                  if (v && !window.NA(v) && String(v).length > bestText.length && String(v).length < 800) {
                    bestField = f; bestText = String(v);
                  }
                }
                if (!bestText) return null;
                const trimmed = bestText.length > 280 ? bestText.slice(0, 280).replace(/\s\S*$/,'') + '\u2026' : bestText;
                return (
                  <article key={c.id} className="story-card" onClick={() => onSelect(c.id)}>
                    <div className="sc-quote">"{trimmed}"</div>
                    <div className="sc-meta">
                      <span className="sc-name">{c.name.trim()}</span>
                      <span className="sc-tag">on {bestField === 'physical' ? 'physical health' :
                        bestField === 'spiritual' ? 'spiritual care' :
                        bestField === 'youth' ? 'youth programming' :
                        bestField === 'survivors' ? 'survivor support' :
                        bestField === 'mental' ? 'mental wellness' :
                        bestField === 'emotional' ? 'emotional support' : 'bridging generations'}</span>
                    </div>
                    <div className="sc-foot">
                      {c.population && <span>{c.population.toLocaleString()} members</span>}
                      <span className="sc-read">Read full record →</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}

// ============================================================================
// MATCH GAME — read a quote, guess which community wrote it
// ============================================================================
function MatchGame({ all, onSelect }) {
  const eligible = useMemo(
    () => all.filter(c => c.orgType === 'Community' && (['physical','spiritual','youth','survivors','mental','emotional']
      .some(f => c[f] && !window.NA(c[f]) && String(c[f]).length > 60))),
    [all]
  );

  const [round, setRound] = useState(() => makeRound(eligible));
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  function makeRound(pool) {
    if (!pool.length) return null;
    const target = pool[Math.floor(Math.random() * pool.length)];
    const FIELDS = ['physical','spiritual','youth','survivors','mental','emotional'];
    const richFields = FIELDS.filter(f => target[f] && !window.NA(target[f]) && String(target[f]).length > 60);
    const field = richFields[Math.floor(Math.random() * richFields.length)];
    const fullText = String(target[field]);
    const quote = fullText.length > 320 ? fullText.slice(0, 320).replace(/\s\S*$/,'') + '\u2026' : fullText;
    // Pick 3 distractors from same direction if possible, else from pool
    const pool2 = pool.filter(c => c.id !== target.id);
    const sameDir = pool2.filter(c => c.direction === target.direction);
    const distractors = (sameDir.length >= 3 ? sameDir : pool2)
      .sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [target, ...distractors].sort(() => Math.random() - 0.5);
    return { target, quote, field, options };
  }

  function pick(c) {
    if (picked) return;
    setPicked(c);
    setScore(s => ({ right: s.right + (c.id === round.target.id ? 1 : 0), total: s.total + 1 }));
  }
  function next() {
    setPicked(null);
    setRound(makeRound(eligible));
  }

  if (!round) {
    return <div className="game-empty">Not enough rich narratives in the dataset to play yet. Sign in and add content to enable this game.</div>;
  }
  const fieldLabel = {
    physical: 'physical health', spiritual: 'spiritual support', youth: 'youth programming',
    survivors: 'survivor support', mental: 'mental wellness', emotional: 'emotional support',
  }[round.field];

  return (
    <div className="game-pane">
      <div className="game-head">
        <div>
          <div className="game-kicker">Match the service to the community</div>
          <h3 className="game-title">Whose program is this?</h3>
          <p className="game-sub">Read the quote, then pick the community you think wrote it. Pulled directly from the master sheet — no made-up text.</p>
        </div>
        <div className="game-score">
          <span className="gs-num">{score.right}</span>
          <span className="gs-of">of {score.total}</span>
        </div>
      </div>
      <div className="game-quote-card">
        <div className="qc-eyebrow">On {fieldLabel}</div>
        <div className="qc-quote">"{round.quote}"</div>
      </div>
      <div className="game-options">
        {round.options.map(o => {
          const isCorrect = picked && o.id === round.target.id;
          const isWrong = picked && picked.id === o.id && o.id !== round.target.id;
          return (
            <button
              key={o.id}
              className={`game-option ${isCorrect?'correct':''} ${isWrong?'wrong':''}`}
              onClick={() => pick(o)}
              disabled={!!picked}
            >
              <span className="go-name">{o.name.trim()}</span>
              <span className="go-meta">{o.regionGroup}{o.population ? ` · ${o.population.toLocaleString()} members` : ''}</span>
              {isCorrect && <span className="go-flag">✓ Correct</span>}
              {isWrong && <span className="go-flag wrong">✕ Actually {round.target.name.trim()}</span>}
            </button>
          );
        })}
      </div>
      {picked && (
        <div className="game-after">
          <button className="game-next" onClick={next}>Next quote →</button>
          <button className="game-link" onClick={() => onSelect(round.target.id)}>Open full record</button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ROULETTE — random community, surprise-me discovery
// ============================================================================
function RouletteGame({ all, onSelect }) {
  const pool = useMemo(() => all.filter(c => c.orgType === 'Community'), [all]);
  const [pick, setPick] = useState(() => pool[Math.floor(Math.random() * pool.length)]);
  const [spinning, setSpinning] = useState(false);

  function spin() {
    setSpinning(true);
    let steps = 0;
    const total = 14;
    const iv = setInterval(() => {
      setPick(pool[Math.floor(Math.random() * pool.length)]);
      steps++;
      if (steps >= total) {
        clearInterval(iv);
        setSpinning(false);
      }
    }, 70);
  }

  if (!pick) return null;
  const hex = window.dirHex(pick);

  return (
    <div className="game-pane">
      <div className="game-head">
        <div>
          <div className="game-kicker">Surprise discovery</div>
          <h3 className="game-title">A community you might not know.</h3>
          <p className="game-sub">Spin the wheel to surface a random community from the atlas. Great for discovering work happening outside your usual region.</p>
        </div>
        <button className={`spin-btn ${spinning?'spinning':''}`} onClick={spin} disabled={spinning}>
          {spinning ? 'Spinning…' : '✦ Spin again'}
        </button>
      </div>
      <div
        className={`roulette-card ${spinning?'shake':''}`}
        style={{'--dir': hex, borderLeftColor: hex}}
        onClick={() => !spinning && onSelect(pick.id)}
      >
        <div className="rc-name">{pick.name.trim()}</div>
        <div className="rc-meta">
          <span>{pick.regionGroup}</span>
          {pick.population && <span>· {pick.population.toLocaleString()} members</span>}
          {pick.orgType !== 'Community' && <span>· {pick.orgType}</span>}
        </div>
        <div className="rc-pillars">
          {window.PILLARS.map(p => {
            const on = window.pillarOn(pick, p.key);
            return (
              <span key={p.key} className={`rc-pchip ${on?'on':''}`}>
                <span style={{color: on ? p.hex : 'var(--ink-4)'}}>{p.icon}</span> {p.label.split(' ')[0]}
              </span>
            );
          })}
        </div>
        {!spinning && pick.physical && !window.NA(pick.physical) && (
          <div className="rc-preview">
            "{String(pick.physical).slice(0, 200)}{String(pick.physical).length > 200 ? '\u2026' : ''}"
          </div>
        )}
        {!spinning && <div className="rc-cta">Open full record →</div>}
      </div>
    </div>
  );
}


// ============================================================================
// THE JOURNEY OF CARE — the Community Stories experience.
// An animated canoe journey through the four directions. Every stop is a REAL
// community; everything spoken at the fire comes from its own records. A loon
// (Maang — a leader clan) guides the canoe, Dora-style: the visitor is asked
// to take part at every stop, and each teaching adds a bead to their sash.
// ============================================================================

// one TRUE sentence from a community's own records (never invented)
function _journeyTruth(c) {
  for (const k of ['physical', 'mental', 'spiritual', 'emotional', 'youth', 'survivors']) {
    const v = c[k];
    if (!v) continue;
    if (window.fieldStatus && window.fieldStatus(c, k, v) !== 'ok') continue;
    const t = String(v).replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim();
    const m = t.match(/^.*?[.!?](?:\s|$)/);
    let out = (m ? m[0] : t).trim();
    if (out.length < 40) continue;
    if (out.length > 280) out = out.slice(0, 280).replace(/\s+\S*$/, '') + '…';
    return { text: out, pillar: k };
  }
  return null;
}

// pull a real sentence for ONE specific field (used by the journey's choices —
// each action reveals a DIFFERENT part of how the community cares).
function _fieldTruth(c, key) {
  const v = c[key];
  if (!v) return null;
  if (window.fieldStatus && window.fieldStatus(c, key, v) !== 'ok') return null;
  const t = String(v).replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim();
  const m = t.match(/^.*?[.!?](?:\s|$)/);
  let out = (m ? m[0] : t).trim();
  if (out.length < 30) return null;
  if (out.length > 240) out = out.slice(0, 240).replace(/\s+\S*$/, '') + '…';
  return out;
}

// THE SEVEN GRANDFATHER TEACHINGS (Niizhwaaswi Gagiikwewin) — the core
// Anishinaabe code of character, each carried by an animal teacher. Every shore
// on the journey is one teaching, so the trip is a walk through the teachings
// rather than a list of database rows.
// Sources: American Indian Health Service of Chicago; Seven Generations
// Education Institute; Ojibwe.net "Gifts of the Seven Grandfathers".
const _TEACHINGS = [
  { key: 'wisdom',   name: 'Nibwaakaawin',    en: 'Wisdom',   animal: 'Amik · Beaver',   line: 'To cherish knowledge is to know wisdom. The beaver uses its gift to build, and betters the whole lodge.' },
  { key: 'love',     name: "Zaagi'idiwin",    en: 'Love',     animal: 'Migizi · Eagle',   line: 'To know love is to know peace. The eagle flies highest and so carries the people closest to Creator.' },
  { key: 'respect',  name: 'Minaadendamowin', en: 'Respect',  animal: 'Mashkode-bizhiki · Buffalo', line: 'Honour all of Creation. The buffalo gives every part of itself so the people may live.' },
  { key: 'bravery',  name: "Aakode'ewin",     en: 'Bravery',  animal: 'Makwa · Bear',     line: 'Face what is hard with a good heart. The mother bear finds courage for her cubs.' },
  { key: 'honesty',  name: 'Gwayakwaadiziwin',en: 'Honesty',  animal: 'Gaag · Raven & Sabe', line: 'Walk through life with integrity. Sabe walks tall and honours the gifts each being was given.' },
  { key: 'humility', name: 'Dabaadendiziwin', en: 'Humility', animal: "Ma'iingan · Wolf", line: 'You are a sacred part of Creation — no greater, no lesser. The wolf lives for the pack.' },
  { key: 'truth',    name: 'Debwewin',        en: 'Truth',    animal: 'Mikinaak · Turtle',line: 'Know all of these things. The turtle carries the days on its back and was here from the beginning.' },
];

// the things you can DO at each fire — each is a distinct choice with its own
// outcome (a different real teaching), its own scene reaction, and its own
// token for your medicine pouch (Hassan: "every outcome should have a different
// action, like a sim game — not the same two buttons").
const _J_ACTIONS = [
  { key: 'spiritual', icon: '🌿', label: 'Offer semaa & listen', cite: 'a spiritual teaching', react: 'smoke', tcol: '#d4a017', tname: 'Spirit', tglyph: '✦' },
  { key: 'emotional', icon: '🔥', label: 'Sit by the fire',       cite: 'a story from the heart', react: 'ember', tcol: '#6b8d6b', tname: 'Heart', tglyph: '♡' },
  { key: 'physical',  icon: '🍲', label: 'Share the meal',        cite: 'how the body is kept well', react: 'feast', tcol: '#b8351e', tname: 'Body', tglyph: '◐' },
  { key: 'mental',    icon: '🚶', label: 'Walk with an elder',    cite: 'how the mind is steadied', react: 'walk', tcol: '#3a4658', tname: 'Mind', tglyph: '◍' },
  { key: 'youth',     icon: '🌾', label: 'Meet the youth',        cite: 'the youth on the land', react: 'youth', tcol: '#2f8f4f', tname: 'Youth', tglyph: '❃' },
];

const _J_DIR = {
  East:  { season: 'Spring · Ziigwan',   col: '#d4a017', guide: 'Maang turns the bow toward the sunrise. New programs are taking root here.' },
  South: { season: 'Summer · Niibin',    col: '#b8351e', guide: 'The water is warm and full of life. The youth are on the land here.' },
  West:  { season: 'Autumn · Dagwaagin', col: '#3a4658', guide: 'The light turns gold and low. This is the direction of healing and reflection.' },
  North: { season: 'Winter · Biboon',    col: '#8fa8a0', guide: 'The first stars are out. The elders keep the deep memory in the North.' },
  Central: { season: 'All seasons',      col: '#7c2f6b', guide: 'Maang circles — this one serves communities in every direction.' },
};

// ---- the journey soundscape: soft water, a slow heartbeat drum, and an
// occasional cedar-flute note. Started by the Begin click (a user gesture,
// so autoplay rules are satisfied); one tap mutes it. ----
function _makeJourneyAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  // water: looped brown noise through a low-pass
  const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0); let lastO = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; lastO = (lastO + 0.02 * w) / 1.02; d[i] = lastO * 3.5; }
  const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
  const ng = ctx.createGain(); ng.gain.value = 0.055;
  noise.connect(lp); lp.connect(ng); ng.connect(master); noise.start();
  // slow heartbeat drum
  const drumTimer = setInterval(() => {
    if (ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(58, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.45);
  }, 1500);
  // occasional cedar-flute note (soft pentatonic)
  const NOTES = [392, 440, 523.25, 587.33, 659.25];
  const fluteTimer = setInterval(() => {
    if (ctx.state !== 'running' || Math.random() < 0.35) return;
    const t = ctx.currentTime, f = NOTES[Math.floor(Math.random() * NOTES.length)];
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(f, t);
    o.frequency.linearRampToValueAtTime(f * 0.995, t + 1.4);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + 1.8);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 1.9);
  }, 5200);
  return {
    setMuted(m) { master.gain.value = m ? 0 : 0.5; },
    stop() { clearInterval(drumTimer); clearInterval(fluteTimer); try { noise.stop(); } catch (e) {} try { ctx.close(); } catch (e) {} },
  };
}

// the two ROUTES the paddler can choose between stops — the choice genuinely
// changes what the scene shows on the way (Hassan: "like a Unity game")
const _J_ROUTES = {
  shore: { label: '🌾 Follow the shoreline', desc: 'Stay close to the cattails and the wading heron.' },
  open:  { label: '🌊 Cross the open water', desc: 'Head through the mist where the big fish leap.' },
};

function JourneyOfCare({ all, onSelect }) {
  const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stops = useMemo(() => {
    const picks = [];
    for (const d of ['East', 'South', 'West', 'North']) {
      const pool = all
        .filter(c => (c.direction || 'Central') === d && _journeyTruth(c))
        .sort((a, b) => (b.completeness || 0) - (a.completeness || 0));
      picks.push(...pool.slice(0, 2));
    }
    return picks.length >= 4 ? picks : all.filter(c => _journeyTruth(c)).slice(0, 8);
  }, [all]);
  const N = stops.length;

  const [idx, setIdx] = useState(-1);
  const [phase, setPhase] = useState('intro');     // intro | choose | paddling | arrived | done
  const [explored, setExplored] = useState([]);    // action keys explored at the CURRENT stop
  const [pouch, setPouch] = useState([]);          // every token collected across the journey
  const [muted, setMuted] = useState(false);
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const phaseRef = useRef('intro'); phaseRef.current = phase;
  const idxRef = useRef(idx); idxRef.current = idx;
  const padRef = useRef(0);
  const arriveRef = useRef(0);
  const pendingIdxRef = useRef(0);
  const routeRef = useRef('shore');
  const sceneActionRef = useRef(null);             // which reaction the arrival scene should play
  const actionFxRef = useRef(0);                   // decays 1→0 after each choice

  const cur = idx >= 0 && idx < N ? stops[idx] : null;
  const teaching = idx >= 0 ? _TEACHINGS[idx % _TEACHINGS.length] : null;   // each shore carries one Grandfather Teaching
  const truth = useMemo(() => (cur ? _journeyTruth(cur) : null), [cur]);
  const dirInfo = cur ? (_J_DIR[cur.direction || 'Central'] || _J_DIR.Central) : null;

  function startAudio() { if (!audioRef.current) audioRef.current = _makeJourneyAudio(); }
  useEffect(() => () => { if (audioRef.current) audioRef.current.stop(); }, []);
  useEffect(() => { if (audioRef.current) audioRef.current.setMuted(muted); }, [muted]);

  function beginJourney() { startAudio(); pendingIdxRef.current = 0; routeRef.current = 'shore'; padRef.current = 0; arriveRef.current = 0; sceneActionRef.current = null; actionFxRef.current = 0; setExplored([]); setPhase('paddling'); }
  function paddleOn() { if (idx + 1 >= N) { setPhase('done'); return; } setPhase('choose'); }
  function chooseRoute(r) { routeRef.current = r; pendingIdxRef.current = idx + 1; padRef.current = 0; arriveRef.current = 0; sceneActionRef.current = null; actionFxRef.current = 0; setExplored([]); setPhase('paddling'); }
  function restart() { setIdx(-1); setPouch([]); setExplored([]); setPhase('intro'); padRef.current = 0; arriveRef.current = 0; }
  // each ACTION reveals a different real teaching, drops a token in the pouch,
  // and triggers its own reaction in the arrival scene
  function chooseAction(a) {
    if (!cur || explored.includes(a.key)) return;
    setExplored(e => [...e, a.key]);
    setPouch(p => [...p, { stopId: cur.id, key: a.key, glyph: a.tglyph, col: a.tcol, name: a.tname }]);
    sceneActionRef.current = a.react; actionFxRef.current = 1;
  }
  // the actions this community can actually offer (has real content for)
  const stopActions = useMemo(() => (cur ? _J_ACTIONS.map(a => ({ ...a, text: _fieldTruth(cur, a.key) })).filter(a => a.text) : []), [cur]);

  // ============================ THE SCENE ============================
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf = null, last = 0, t0 = null;
    const DPR = Math.min(1.5, window.devicePixelRatio || 1);
    function resize() {
      canvas.width = Math.max(1, canvas.clientWidth * DPR);
      canvas.height = Math.max(1, canvas.clientHeight * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    const ro = ('ResizeObserver' in window) ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(canvas);

    const lerp = (a, b, u) => a + (b - a) * u;
    const mixc = (c1, c2, u) => [Math.round(lerp(c1[0], c2[0], u)), Math.round(lerp(c1[1], c2[1], u)), Math.round(lerp(c1[2], c2[2], u))];
    const SKY_T = [[233, 195, 122], [176, 208, 230], [214, 126, 84], [18, 20, 42]];
    const SKY_B = [[246, 226, 176], [224, 238, 246], [244, 176, 118], [46, 42, 78]];
    const WATER = [[168, 162, 116], [110, 160, 176], [122, 88, 96], [26, 30, 52]];
    const HILL  = [[150, 138, 96],  [104, 138, 128], [110, 76, 74],  [22, 24, 40]];

    function scene(time) {
      const W = canvas.clientWidth, H = canvas.clientHeight;
      const tt = (time - (t0 == null ? (t0 = time) : t0)) / 1000;
      const jIdx = phaseRef.current === 'paddling' ? pendingIdxRef.current - 1 + padRef.current : Math.max(0, idxRef.current);
      const jt = N > 1 ? Math.max(0, Math.min(1, jIdx / (N - 1))) : 0;
      const seg = Math.min(2.999, jt * 3), si = Math.floor(seg), su = seg - si;
      const skyT = mixc(SKY_T[si], SKY_T[si + 1], su);
      const skyB = mixc(SKY_B[si], SKY_B[si + 1], su);
      const wat  = mixc(WATER[si], WATER[si + 1], su);
      const hil  = mixc(HILL[si], HILL[si + 1], su);
      const night = Math.max(0, (jt - 0.66) / 0.34);
      const hY = H * 0.52;
      const paddling = phaseRef.current === 'paddling';
      const drift = jIdx * 1100 + (paddling ? tt * 46 : 0);

      // ---- SKY ----
      const g = ctx.createLinearGradient(0, 0, 0, hY);
      g.addColorStop(0, `rgb(${skyT.join(',')})`); g.addColorStop(1, `rgb(${skyB.join(',')})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, hY);
      // drifting clouds (day)
      if (night < 0.5) {
        ctx.globalAlpha = (1 - night) * 0.5;
        for (let i = 0; i < 3; i++) {
          const cxc = ((tt * 5 + i * 420 - drift * 0.02) % (W + 320)) - 160;
          const cyc = 40 + i * 46;
          ctx.fillStyle = 'rgba(255,250,238,0.8)';
          ctx.beginPath();
          ctx.ellipse(cxc, cyc, 66, 13, 0, 0, 6.283);
          ctx.ellipse(cxc + 38, cyc + 5, 44, 10, 0, 0, 6.283);
          ctx.ellipse(cxc - 40, cyc + 6, 38, 9, 0, 0, 6.283);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      // sun → moon with a soft halo
      const arc = Math.PI * (1 - jt * 0.92 - 0.04);
      const sx = W * (0.14 + 0.72 * jt), sy = Math.max(30, hY * 0.78 - Math.sin(arc) * hY * 0.62);
      const halo = ctx.createRadialGradient(sx, sy, 4, sx, sy, 90);
      halo.addColorStop(0, night > 0.4 ? 'rgba(220,230,248,0.5)' : 'rgba(255,226,150,0.55)');
      halo.addColorStop(1, 'rgba(255,226,150,0)');
      ctx.fillStyle = halo; ctx.fillRect(sx - 95, sy - 95, 190, 190);
      ctx.beginPath(); ctx.arc(sx, sy, 24, 0, 6.283);
      ctx.fillStyle = night > 0.4 ? '#e8edf8' : '#ffedbe'; ctx.fill();
      if (night > 0.4) {                                         // moon craters
        ctx.fillStyle = 'rgba(190,200,220,0.6)';
        ctx.beginPath(); ctx.arc(sx - 7, sy - 4, 4, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + 6, sy + 6, 3, 0, 6.283); ctx.fill();
      }
      // birds by day, stars + aurora by night
      if (night < 0.4) {
        ctx.strokeStyle = 'rgba(40,34,26,0.7)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
          const bxx = ((tt * 14 + i * 210) % (W + 200)) - 100;
          const byy = 54 + i * 26 + Math.sin(tt + i) * 6;
          const fw2 = Math.sin(tt * 6 + i) * 4;
          ctx.beginPath(); ctx.moveTo(bxx - 6, byy - fw2 * 0.5); ctx.quadraticCurveTo(bxx, byy + fw2, bxx + 6, byy - fw2 * 0.5); ctx.stroke();
        }
      }
      if (night > 0.05) {
        for (let i = 0; i < 34; i++) {
          const stx = ((i * 137.5) % W), sty = ((i * 61.8) % (hY * 0.75));
          ctx.globalAlpha = night * (0.3 + 0.5 * (0.5 + 0.5 * Math.sin(tt * 2 + i)));
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fillRect(stx, sty, 1.7, 1.7);
        }
        for (let a2 = 0; a2 < 3; a2++) {
          ctx.globalAlpha = night * 0.15;
          ctx.strokeStyle = ['#7de0b8', '#9db8ff', '#d29bff'][a2]; ctx.lineWidth = 14;
          ctx.beginPath();
          for (let x = 0; x <= W; x += 24) {
            const y = 30 + a2 * 24 + Math.sin(x * 0.007 + tt * 0.5 + a2 * 2) * 16;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // ---- HILLS: two parallax layers ----
      ctx.fillStyle = `rgba(${hil.join(',')},0.55)`;
      ctx.beginPath(); ctx.moveTo(0, hY);
      for (let x = 0; x <= W; x += 14) ctx.lineTo(x, hY - 34 - Math.sin((x + drift * 0.18) * 0.004) * 20);
      ctx.lineTo(W, hY); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgb(${hil.join(',')})`;
      ctx.beginPath(); ctx.moveTo(0, hY);
      for (let x = 0; x <= W; x += 12) ctx.lineTo(x, hY - 16 - Math.sin((x + drift * 0.34) * 0.007) * 11);
      ctx.lineTo(W, hY); ctx.closePath(); ctx.fill();
      // treeline with varied trees + their reflection
      ctx.fillStyle = 'rgba(22,26,20,0.9)';
      for (let x = -30; x <= W + 30; x += 22) {
        const xx = x - (drift * 0.6 % 22);
        const th = 15 + ((x * 7919) % 13);
        ctx.beginPath(); ctx.moveTo(xx - 7, hY); ctx.lineTo(xx, hY - th); ctx.lineTo(xx + 7, hY); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = 'rgb(16,20,16)';
      for (let x = -30; x <= W + 30; x += 22) {
        const xx = x - (drift * 0.6 % 22);
        const th = (15 + ((x * 7919) % 13)) * 0.6;
        ctx.beginPath(); ctx.moveTo(xx - 6, hY); ctx.lineTo(xx, hY + th); ctx.lineTo(xx + 6, hY); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ---- WATER ----
      const wg = ctx.createLinearGradient(0, hY, 0, H);
      wg.addColorStop(0, `rgb(${wat.map(v => Math.min(255, v + 30)).join(',')})`);
      wg.addColorStop(1, `rgb(${wat.map(v => Math.max(0, v - 14)).join(',')})`);
      ctx.fillStyle = wg; ctx.fillRect(0, hY, W, H - hY);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        const ly = hY + 16 + i * (H - hY) * 0.13;
        const lx = ((tt * 26 + i * 170) % (W + 260)) - 130;
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 70 + i * 14, ly); ctx.stroke();
      }
      ctx.globalAlpha = 0.3; ctx.fillStyle = night > 0.4 ? '#cdd8ee' : '#ffe2a6';
      for (let i = 0; i < 10; i++) {
        const gy = hY + 8 + i * 10, gw = 56 - i * 4.6;
        ctx.fillRect(sx - gw / 2 + Math.sin(tt * 2 + i) * 6, gy, gw, 1.6);
      }
      ctx.globalAlpha = 1;
      // dawn mist over the water on the first leg
      if (jt < 0.22) {
        ctx.globalAlpha = (0.22 - jt) / 0.22 * 0.35;
        ctx.fillStyle = 'rgb(246,240,228)';
        for (let i = 0; i < 3; i++) {
          const mx2 = ((tt * 9 + i * 300) % (W + 300)) - 150;
          ctx.beginPath(); ctx.ellipse(mx2, hY + 40 + i * 26, 150, 13, 0, 0, 6.283); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // ---- ROUTE-SPECIFIC scenery while paddling (the choice matters) ----
      if (paddling) {
        if (routeRef.current === 'shore') {
          // the near shoreline slides by: cattail clumps + a wading heron
          const sxr = W - ((drift * 1.1) % (W + 420)) + 210;
          ctx.strokeStyle = 'rgba(70,96,44,0.95)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
          for (let k = 0; k < 5; k++) {
            const cx3 = sxr + k * 14, cy3 = H - 26;
            const sw5 = Math.sin(tt * 1.6 + k) * 3;
            ctx.beginPath(); ctx.moveTo(cx3, cy3 + 20); ctx.quadraticCurveTo(cx3 + sw5 * 0.5, cy3 - 6, cx3 + sw5, cy3 - 26); ctx.stroke();
            ctx.fillStyle = 'rgb(94,62,32)';
            ctx.beginPath(); ctx.ellipse(cx3 + sw5, cy3 - 30, 2.4, 7, 0, 0, 6.283); ctx.fill();
          }
          const hx4 = sxr - 90, hy4 = H - 34;
          if (hx4 > -60 && hx4 < W + 60) {                       // the heron
            ctx.strokeStyle = 'rgb(120,126,132)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(hx4, hy4); ctx.lineTo(hx4, hy4 + 22); ctx.stroke();
            ctx.fillStyle = 'rgb(140,148,155)';
            ctx.beginPath(); ctx.ellipse(hx4 + 2, hy4 - 8, 12, 7, -0.1, 0, 6.283); ctx.fill();
            ctx.strokeStyle = 'rgb(140,148,155)'; ctx.lineWidth = 2.6;
            ctx.beginPath(); ctx.moveTo(hx4 + 10, hy4 - 12); ctx.quadraticCurveTo(hx4 + 16, hy4 - 24, hx4 + 14, hy4 - 30); ctx.stroke();
            ctx.fillStyle = 'rgb(140,148,155)';
            ctx.beginPath(); ctx.arc(hx4 + 14, hy4 - 31, 3.4, 0, 6.283); ctx.fill();
            ctx.strokeStyle = 'rgb(190,160,80)'; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(hx4 + 17, hy4 - 31); ctx.lineTo(hx4 + 25, hy4 - 29); ctx.stroke();
          }
        } else {
          // open water: a distant island slides past + a big fish leaps
          const ix = W - ((drift * 0.5) % (W + 600)) + 300;
          ctx.fillStyle = `rgba(${hil.join(',')},0.8)`;
          ctx.beginPath(); ctx.ellipse(ix, hY - 4, 90, 16, 0, Math.PI, 2 * Math.PI); ctx.fill();
          ctx.fillStyle = 'rgba(22,26,20,0.85)';
          for (let k = -3; k <= 3; k++) {
            ctx.beginPath(); ctx.moveTo(ix + k * 18 - 6, hY - 8); ctx.lineTo(ix + k * 18, hY - 26 + Math.abs(k) * 3); ctx.lineTo(ix + k * 18 + 6, hY - 8); ctx.closePath(); ctx.fill();
          }
          const leapT = (tt % 4) / 4;
          if (leapT < 0.4) {
            const u2 = leapT / 0.4;
            const fx4 = W * 0.62 + u2 * 70, fy4 = hY + 70 - Math.sin(u2 * Math.PI) * 42;
            ctx.save(); ctx.translate(fx4, fy4); ctx.rotate(-0.8 + u2 * 1.6);
            ctx.fillStyle = 'rgba(196,206,208,0.95)';
            ctx.beginPath(); ctx.ellipse(0, 0, 12, 4.4, 0, 0, 6.283); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(-17, -5); ctx.lineTo(-15, 0); ctx.lineTo(-17, 5); ctx.closePath(); ctx.fill();
            ctx.restore();
            if (u2 > 0.85 || u2 < 0.1) {
              ctx.strokeStyle = 'rgba(240,246,240,0.6)'; ctx.lineWidth = 1.2;
              ctx.beginPath(); ctx.ellipse(W * 0.62 + (u2 > 0.5 ? 70 : 0), hY + 72, 14, 4, 0, 0, 6.283); ctx.stroke();
            }
          }
        }
      }

      // ---- ARRIVAL SHORE: dock, lodge with smoke, fire, three greeters ----
      const at = arriveRef.current;
      if (at > 0.01) {
        const ease = 1 - Math.pow(1 - at, 3);
        const sxr = W - ease * W * 0.4;
        ctx.fillStyle = `rgb(${Math.round(48 + 16 * (1 - night))},${Math.round(72 + 22 * (1 - night))},${Math.round(42 + 12 * (1 - night))})`;
        ctx.beginPath();
        ctx.moveTo(W, H); ctx.lineTo(W, hY + 8);
        ctx.quadraticCurveTo(sxr + 90, hY + 12, sxr + 20, hY + 42);
        ctx.quadraticCurveTo(sxr - 20, hY + 60, sxr - 34, H);
        ctx.closePath(); ctx.fill();
        // the dock: two posts + planks reaching toward the canoe
        const dx2 = sxr - 6, dy2 = hY + 74;
        ctx.strokeStyle = 'rgb(74,52,30)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(dx2 - 34, dy2 - 4); ctx.lineTo(dx2 - 34, dy2 + 18); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(dx2 + 2, dy2 - 4); ctx.lineTo(dx2 + 2, dy2 + 18); ctx.stroke();
        ctx.fillStyle = 'rgb(104,74,42)';
        ctx.fillRect(dx2 - 46, dy2 - 8, 60, 6);
        // the lodge + smoke
        const lx2 = sxr + 96, ly2 = hY + 46;
        ctx.fillStyle = 'rgb(96,64,38)';
        ctx.beginPath(); ctx.moveTo(lx2 - 26, ly2); ctx.quadraticCurveTo(lx2, ly2 - 38, lx2 + 26, ly2); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(60,40,22,0.8)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(lx2 - 14, ly2 - 6); ctx.quadraticCurveTo(lx2, ly2 - 30, lx2 + 14, ly2 - 6); ctx.stroke();
        ctx.fillStyle = 'rgb(38,24,12)';
        ctx.beginPath(); ctx.ellipse(lx2, ly2 - 2, 6, 9, 0, Math.PI, 2 * Math.PI); ctx.fill();
        for (let sp2 = 0; sp2 < 4; sp2++) {                       // smoke puffs
          const su2 = ((tt * 0.5 + sp2 * 0.25) % 1);
          ctx.globalAlpha = (1 - su2) * 0.4;
          ctx.fillStyle = 'rgb(226,220,208)';
          ctx.beginPath(); ctx.arc(lx2 + Math.sin(su2 * 5) * 7, ly2 - 40 - su2 * 34, 4 + su2 * 7, 0, 6.283); ctx.fill();
        }
        ctx.globalAlpha = 1;
        // the welcome fire + THREE greeters (one child)
        const fx2 = sxr + 34, fy2 = hY + 64;
        const fl2 = 0.8 + Math.sin(tt * 9) * 0.14 + Math.sin(tt * 21) * 0.06;
        const fg2 = ctx.createRadialGradient(fx2, fy2 - 5, 2, fx2, fy2 - 5, 44 * fl2);
        fg2.addColorStop(0, 'rgba(255,170,80,0.55)'); fg2.addColorStop(1, 'rgba(255,150,60,0)');
        ctx.fillStyle = fg2; ctx.fillRect(fx2 - 50, fy2 - 54, 100, 84);
        ctx.fillStyle = `rgba(255,${Math.round(150 + 60 * fl2)},60,0.95)`;
        ctx.beginPath(); ctx.moveTo(fx2 - 6, fy2); ctx.quadraticCurveTo(fx2, fy2 - 20 * fl2, fx2 + 6, fy2); ctx.closePath(); ctx.fill();
        // ---- PROPER PEOPLE (not stick figures): jointed limbs with knees and
        //   elbows, a shaped ribbon shirt with hem + sash, leggings, moccasins,
        //   hair with braids. `act` drives the pose: 'wave' | 'idle' | 'walk'. --
        const person = (px, py, s, dir, shirt, act, ph, opt) => {
          opt = opt || {};
          const skin = '#a3704a', hair = '#1a0e08', leg = '#6b4a2a';
          const H = 34 * s;                                        // full body height
          const hipY = py - H * 0.42, shoY = py - H * 0.80, headR = 4.6 * s;
          const headY = py - H * 0.90 - headR;
          const gait = act === 'walk' ? Math.sin(tt * 4 + ph) : 0;
          const bob = Math.abs(gait) * 0.8 * s + Math.sin(tt * 1.5 + ph) * 0.4 * s;
          const limb = (x0, y0, x1, y1, x2, y2, w, col) => {        // 2-segment jointed limb
            ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          };
          // legs: hip → knee (forward) → ankle, so they bend like real legs
          for (const sg of [-1, 1]) {
            const sw = gait * sg * 3.4 * s;
            const kx = px + sg * 1.7 * s + sw * 0.5, ky = hipY + H * 0.22 - bob;
            const ax = px + sg * 1.7 * s + sw,       ay = py - bob;
            limb(px + sg * 1.7 * s, hipY - bob, kx, ky, ax, ay, 3.1 * s, leg);
            ctx.fillStyle = '#2a1808';                              // moccasin
            ctx.beginPath(); ctx.ellipse(ax + sg * 0.4 * s, ay + 0.4 * s, 2 * s, 1 * s, 0, 0, 6.283); ctx.fill();
          }
          // torso: a tapered ribbon shirt, not an ellipse
          ctx.fillStyle = shirt;
          ctx.beginPath();
          ctx.moveTo(px - 4.3 * s, hipY - bob);
          ctx.lineTo(px - 3.6 * s, shoY - bob);
          ctx.quadraticCurveTo(px, shoY - bob - 1.3 * s, px + 3.6 * s, shoY - bob);
          ctx.lineTo(px + 4.3 * s, hipY - bob);
          ctx.quadraticCurveTo(px, hipY - bob + 0.9 * s, px - 4.3 * s, hipY - bob);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(245,232,200,0.92)';                 // chest ribbon
          ctx.fillRect(px - 3.8 * s, shoY - bob + 3 * s, 7.6 * s, 0.9 * s);
          ctx.fillStyle = opt.sash || '#d4a017';                    // hem band / sash
          ctx.fillRect(px - 4.2 * s, hipY - bob - 1.4 * s, 8.4 * s, 1.1 * s);
          // arms: shoulder → elbow → hand. The wave arm lifts and swings.
          const sy = shoY - bob + 1.4 * s;
          const w = act === 'wave' ? (Math.sin(tt * 4 + ph) * 0.5 + 0.5) : 0;
          for (const sg of [-1, 1]) {
            const isWave = act === 'wave' && sg === dir;
            let ex, ey, hx, hy;
            if (isWave) {                                            // raised, forearm waving
              ex = px + sg * 6 * s; ey = sy - 1 * s;
              hx = px + sg * (7.5 + w * 2.5) * s; hy = sy - (8 + w * 2) * s;
            } else if (act === 'walk') {
              const sw2 = -gait * sg * 2.4 * s;
              ex = px + sg * 4.6 * s + sw2 * 0.5; ey = sy + 3.4 * s;
              hx = px + sg * 4.2 * s + sw2;       hy = sy + 7.4 * s;
            } else {
              ex = px + sg * 4.8 * s; ey = sy + 3.6 * s;
              hx = px + sg * 4.2 * s; hy = sy + 7.6 * s;
            }
            limb(px + sg * 3.4 * s, sy, ex, ey, hx, hy, 2.4 * s, skin);
            ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hx, hy, 1.4 * s, 0, 6.283); ctx.fill();
          }
          // head + hair
          ctx.fillStyle = skin;
          ctx.beginPath(); ctx.arc(px, headY - bob, headR, 0, 6.283); ctx.fill();
          ctx.fillStyle = hair;
          ctx.beginPath(); ctx.arc(px, headY - bob - 0.5 * s, headR * 1.06, Math.PI + 0.22, 2 * Math.PI - 0.22); ctx.fill();
          if (opt.braid !== false) {                                 // braids down the back
            ctx.strokeStyle = hair; ctx.lineWidth = 1.7 * s; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(px - dir * headR * 0.7, headY - bob + headR * 0.35);
            ctx.quadraticCurveTo(px - dir * headR * 1.5, headY - bob + headR * 2.4, px - dir * headR * 1.2, headY - bob + headR * 4);
            ctx.stroke();
          }
          if (opt.band) {                                            // beaded headband
            ctx.fillStyle = opt.band;
            ctx.fillRect(px - headR, headY - bob - headR * 0.42, headR * 2, 1.5 * s);
          }
        };
        const greet = [[-34, 1.9, '#8a4a28', '#c93a1e'], [26, 1.85, '#3c5a80', '#d4a017'], [48, 1.2, '#a06a20', '#2f8f4f']];
        for (const [gdx, gs, gc, band] of greet) {
          person(fx2 + gdx, fy2 + 4, gs, gdx < 0 ? 1 : -1, gc, 'wave', gdx * 0.3, { band });
        }
        // ---- ACTION REACTION: each choice plays out differently at the fire ----
        const react = sceneActionRef.current, fxp = actionFxRef.current;
        if (react === 'smoke') {                                    // semaa offering: sweetgrass smoke rises
          for (let s = 0; s < 5; s++) { const su = ((tt * 0.4 + s * 0.2) % 1); ctx.globalAlpha = (1 - su) * 0.5; ctx.fillStyle = 'rgb(222,216,192)'; ctx.beginPath(); ctx.arc(fx2 + Math.sin(su * 6 + s) * 5, fy2 - 8 - su * 46, 2.4 + su * 4, 0, 6.283); ctx.fill(); }
          ctx.globalAlpha = 1;
        } else if (react === 'ember') {                            // fire story: a storyteller gestures + embers rise
          ctx.fillStyle = '#5a3a2a'; ctx.beginPath(); ctx.ellipse(fx2 - 20, fy2 - 10, 4.6, 8, 0, 0, 6.283); ctx.fill();
          ctx.fillStyle = 'rgb(122,84,52)'; ctx.beginPath(); ctx.arc(fx2 - 20, fy2 - 22, 3.6, 0, 6.283); ctx.fill();
          ctx.strokeStyle = '#5a3a2a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(fx2 - 17, fy2 - 15); ctx.lineTo(fx2 - 10, fy2 - 20 - Math.sin(tt * 2) * 4); ctx.stroke();
          for (let e = 0; e < 6; e++) { const eu = ((tt * 0.7 + e * 0.16) % 1); ctx.globalAlpha = (1 - eu) * 0.8; ctx.fillStyle = `rgb(255,${Math.round(150 + 70 * Math.sin(e))},60)`; ctx.beginPath(); ctx.arc(fx2 + Math.sin(eu * 8 + e) * 8, fy2 - eu * 40, 1.2, 0, 6.283); ctx.fill(); }
          ctx.globalAlpha = 1;
        } else if (react === 'feast') {                            // share the meal: a tripod pot + steam
          const px = fx2 + 22;
          ctx.strokeStyle = 'rgb(60,40,22)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(px - 6, fy2); ctx.lineTo(px, fy2 - 16); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(px + 6, fy2); ctx.lineTo(px, fy2 - 16); ctx.stroke();
          ctx.fillStyle = 'rgb(44,38,34)'; ctx.beginPath(); ctx.ellipse(px, fy2 - 6, 5, 3.4, 0, 0, Math.PI); ctx.fill(); ctx.fillRect(px - 5, fy2 - 7.5, 10, 2);
          for (let s = 0; s < 4; s++) { const su = ((tt * 0.5 + s * 0.25) % 1); ctx.globalAlpha = (1 - su) * 0.4; ctx.fillStyle = 'rgb(226,220,208)'; ctx.beginPath(); ctx.arc(px + Math.sin(su * 5) * 4, fy2 - 16 - su * 20, 2 + su * 3, 0, 6.283); ctx.fill(); }
          ctx.globalAlpha = 1;
        } else if (react === 'walk') {                             // walk with an elder: two figures stroll off
          for (let g = 0; g < 2; g++) { const wx = fx2 + 34 + g * 11 + Math.sin(tt * 0.6) * 4, wy = fy2 - 4 - g * 3; ctx.fillStyle = ['#3c5a80', '#8a4a28'][g]; ctx.beginPath(); ctx.ellipse(wx, wy - 8, 3.4, 6, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = 'rgb(122,84,52)'; ctx.beginPath(); ctx.arc(wx, wy - 16, 2.6, 0, 6.283); ctx.fill(); }
        } else if (react === 'youth') {                            // meet the youth: a young one carries a sprig
          const yx = fx2 - 26 - Math.sin(tt * 0.5) * 3, yy = fy2 + 2;
          ctx.fillStyle = '#2f8f4f'; ctx.beginPath(); ctx.ellipse(yx, yy - 8, 3.4, 6, 0, 0, 6.283); ctx.fill();
          ctx.fillStyle = 'rgb(122,84,52)'; ctx.beginPath(); ctx.arc(yx, yy - 16, 2.6, 0, 6.283); ctx.fill();
          ctx.strokeStyle = '#2f8f4f'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(yx - 4, yy - 10); ctx.lineTo(yx - 8, yy - 16); ctx.stroke();
          ctx.fillStyle = '#4fbf6f'; ctx.beginPath(); ctx.arc(yx - 8, yy - 17, 1.8, 0, 6.283); ctx.fill();
        }
        if (fxp > 0.02) {                                          // a bright ring pops out the moment you choose
          ctx.globalAlpha = fxp * 0.8; ctx.strokeStyle = 'rgba(255,240,190,0.9)'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(fx2, fy2 - 6, (1 - fxp) * 40 + 8, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1;
        }
      }

      // ---- THE CANOE (hero of the scene) + Maang ----
      const cx2 = W * 0.34, cy2 = hY + (H - hY) * 0.42 + Math.sin(tt * 1.1) * 2.4;
      const pitch = paddling ? Math.sin(tt * 2.2) * 0.02 : 0;
      const stroke2 = paddling ? Math.sin(tt * 3.4) : Math.sin(tt * 0.8) * 0.15;
      ctx.save(); ctx.translate(cx2, cy2); ctx.rotate(pitch);
      // wake
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-66, 8); ctx.lineTo(-126, 17); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-66, 8); ctx.lineTo(-126, 0); ctx.stroke();
      // reflection blot
      ctx.fillStyle = 'rgba(14,14,18,0.22)';
      ctx.beginPath(); ctx.ellipse(0, 14, 62, 6, 0, 0, 6.283); ctx.fill();
      // hull — birchbark, high curled stems, the four-colour band, visible ribs
      ctx.fillStyle = 'rgb(216,182,132)';
      ctx.beginPath();
      ctx.moveTo(-68, 0); ctx.quadraticCurveTo(0, 20, 68, 0);
      ctx.quadraticCurveTo(80, -12, 70, -16);
      ctx.quadraticCurveTo(0, 2, -70, -16);
      ctx.quadraticCurveTo(-80, -12, -68, 0);
      ctx.closePath(); ctx.fill();
      const bandCols = ['#d4a017', '#b8351e', '#1a1612', '#efe7d6'];
      for (let b2 = 0; b2 < 4; b2++) { ctx.fillStyle = bandCols[b2]; ctx.fillRect(-58 + b2 * 29, -9, 29, 6); }
      ctx.strokeStyle = 'rgba(140,104,62,0.55)'; ctx.lineWidth = 1;
      for (let r2 = -50; r2 <= 50; r2 += 12) {                   // ribs
        ctx.beginPath(); ctx.moveTo(r2, -2); ctx.quadraticCurveTo(r2 + 2, 8, r2 + 4, 12); ctx.stroke();
      }
      ctx.strokeStyle = 'rgb(120,86,48)'; ctx.lineWidth = 2;      // gunwale
      ctx.beginPath(); ctx.moveTo(-67, -2); ctx.quadraticCurveTo(0, 14, 67, -2); ctx.stroke();
      // two paddlers with headbands + ribbon shirts
      for (const [pdx, shirtC, ph2] of [[-24, '#b8351e', 0], [26, '#1f4e8f', Math.PI * 0.55]]) {
        ctx.fillStyle = shirtC;
        ctx.beginPath(); ctx.ellipse(pdx, -22, 7, 12, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgb(122,84,52)';
        ctx.beginPath(); ctx.arc(pdx, -39, 6, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgb(26,18,10)';                          // hair
        ctx.beginPath(); ctx.arc(pdx, -41, 6, Math.PI, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = '#c93a1e';                                // headband
        ctx.fillRect(pdx - 6, -42, 12, 2.4);
        const pa = stroke2 + ph2 * 0.2;
        ctx.strokeStyle = 'rgb(110,76,40)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(pdx + 6, -28);
        ctx.lineTo(pdx + 17 + Math.sin(pa) * 11, 10 + Math.cos(pa) * 6); ctx.stroke();
        ctx.fillStyle = 'rgb(110,76,40)';
        ctx.beginPath(); ctx.ellipse(pdx + 17 + Math.sin(pa) * 11, 12 + Math.cos(pa) * 6, 3.4, 6, 0.3, 0, 6.283); ctx.fill();
      }
      ctx.restore();
      // Maang the loon — bigger, glides ahead, dives every ~12s
      const dcyc = (tt % 12) / 12;
      let sink2 = 0;
      if (dcyc > 0.72 && dcyc < 0.79) sink2 = (dcyc - 0.72) / 0.07;
      else if (dcyc >= 0.79 && dcyc < 0.9) sink2 = 1;
      else if (dcyc >= 0.9) sink2 = 1 - (dcyc - 0.9) / 0.1;
      const mgx2 = cx2 + 150 + Math.sin(tt * 0.7) * 8, mgy2 = cy2 + 6 + Math.sin(tt * 1.3) * 2 + sink2 * 14;
      ctx.globalAlpha = 1 - sink2;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(mgx2 - 12, mgy2 + 3); ctx.lineTo(mgx2 - 38, mgy2 + 8); ctx.stroke();
      ctx.fillStyle = 'rgb(24,22,26)';
      ctx.beginPath(); ctx.ellipse(mgx2, mgy2, 14, 4.6, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(214,220,220,0.85)';                   // checker back
      for (let cb2 = 0; cb2 < 5; cb2++) { ctx.beginPath(); ctx.arc(mgx2 - 7 + cb2 * 3.4, mgy2 - 2.4, 0.8, 0, 6.283); ctx.fill(); }
      ctx.strokeStyle = 'rgb(24,22,26)'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(mgx2 + 9, mgy2 - 2); ctx.quadraticCurveTo(mgx2 + 13, mgy2 - 9, mgx2 + 14, mgy2 - 12); ctx.stroke();
      ctx.fillStyle = 'rgb(24,22,26)';
      ctx.beginPath(); ctx.ellipse(mgx2 + 15, mgy2 - 13, 3.4, 2.8, 0.2, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(230,234,232,0.9)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mgx2 + 10.5, mgy2 - 7); ctx.lineTo(mgx2 + 13.5, mgy2 - 5.5); ctx.stroke();
      ctx.strokeStyle = 'rgb(40,36,40)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(mgx2 + 18, mgy2 - 13.4); ctx.lineTo(mgx2 + 25, mgy2 - 12); ctx.stroke();
      ctx.fillStyle = 'rgb(190,40,30)';
      ctx.beginPath(); ctx.arc(mgx2 + 16, mgy2 - 14, 0.8, 0, 6.283); ctx.fill();
      ctx.globalAlpha = 1;
      if (sink2 > 0 && sink2 < 1) {                               // dive ring
        ctx.strokeStyle = 'rgba(235,242,238,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(mgx2, cy2 + 8, 10 + sink2 * 18, 3 + sink2 * 3, 0, 0, 6.283); ctx.stroke();
      }
      // fireflies near the shore at dusk
      if (night > 0.15 && night < 0.85) {
        ctx.fillStyle = 'rgba(255,224,120,0.8)';
        for (let i = 0; i < 5; i++) {
          const fxx = W * 0.72 + Math.sin(tt * 0.6 + i * 2) * 60 + i * 30;
          const fyy = hY + 60 + Math.cos(tt * 0.5 + i) * 22;
          ctx.globalAlpha = (night - 0.15) * (0.4 + 0.6 * Math.abs(Math.sin(tt * 2 + i * 3)));
          ctx.beginPath(); ctx.arc(fxx, fyy, 1.6, 0, 6.283); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // progress + easing
      if (phaseRef.current === 'paddling') {
        padRef.current = Math.min(1, padRef.current + (time - (last || time)) / 3000);
        if (padRef.current >= 1) { setIdx(pendingIdxRef.current); setPhase('arrived'); }
      }
      if (phaseRef.current === 'arrived' && arriveRef.current < 1) {
        arriveRef.current = Math.min(1, arriveRef.current + (time - (last || time)) / 800);
      }
      if (actionFxRef.current > 0) actionFxRef.current = Math.max(0, actionFxRef.current - (time - (last || time)) / 900);
      last = time;
    }

    if (reduce) { scene(performance.now()); return () => { if (ro) ro.disconnect(); }; }
    const frame = (time) => { raf = requestAnimationFrame(frame); scene(time); };
    raf = requestAnimationFrame(frame);
    return () => { if (raf) cancelAnimationFrame(raf); if (ro) ro.disconnect(); };
  }, [N, reduce]);

  const pillarLabel = { physical: 'Physical health', mental: 'Mental health', spiritual: 'Spiritual & cultural care', emotional: 'Emotional wellness', youth: 'Youth programming', survivors: 'Survivor support' };

  return (
    <div className="journey">
      <div className="journey-stage">
        <canvas ref={canvasRef} className="journey-canvas" aria-hidden="true"></canvas>
        {audioRef.current && (
          <button className="j-audio" onClick={() => setMuted(m => !m)} title={muted ? 'Sound on' : 'Sound off'}>
            {muted ? '🔇' : '🔊'}
          </button>
        )}

        {phase === 'intro' && (
          <div className="j-card j-intro">
            <div className="j-eyebrow">The Journey of Care · {N} real communities</div>
            <h3>Step into the canoe.</h3>
            <p>
              Maang the loon will guide you through the four directions — sunrise to
              starlight, with the water and the drum for company. At every shore a real
              community welcomes you to its fire and shares one true thing about how it
              cares for its people. Choose your own route between the stops.
            </p>
            <button className="j-btn" onClick={beginJourney}>🛶 Begin the journey</button>
          </div>
        )}

        {phase === 'choose' && (
          <div className="j-card j-choose">
            <div className="j-eyebrow">Choose your route to the next shore</div>
            <div className="j-routes">
              {Object.entries(_J_ROUTES).map(([key, r]) => (
                <button key={key} className="j-route" onClick={() => chooseRoute(key)}>
                  <b>{r.label}</b>
                  <span>{r.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'paddling' && (
          <div className="j-guide">
            {(_J_DIR[(stops[pendingIdxRef.current] || {}).direction || 'Central'] || _J_DIR.Central).guide}
          </div>
        )}

        {phase === 'arrived' && cur && (
          <div className="j-card j-stop">
            <div className="j-eyebrow" style={{ color: dirInfo.col }}>
              ● {(cur.direction || 'Central')} · {dirInfo.season} · Stop {idx + 1} of {N}
            </div>
            <h3>{cur.name.trim()}</h3>
            <div className="j-meta">
              {cur.population != null && <span><b>{cur.population.toLocaleString()}</b> people</span>}
              <span><b>{window.PILLARS.filter(pl => window.pillarOn(cur, pl.key)).length}</b>/4 pillars documented</span>
            </div>
            {teaching && (
              <div className="j-teaching" style={{ borderColor: dirInfo.col }}>
                <div className="j-teach-head">
                  <span className="j-teach-num">Grandfather Teaching {(idx % 7) + 1} of 7</span>
                  <b>{teaching.name}</b> <span className="j-teach-en">· {teaching.en}</span>
                </div>
                <div className="j-teach-animal">{teaching.animal}</div>
                <p className="j-teach-line">{teaching.line}</p>
              </div>
            )}
            <p className="j-invite">
              You are welcomed to the fire. What will you do here?
              {explored.length > 0 && <span className="j-gathered"> · {explored.length} gift{explored.length > 1 ? 's' : ''} received</span>}
            </p>
            {/* the teachings you've already unlocked at this stop, each cited by action */}
            {stopActions.filter(a => explored.includes(a.key)).map(a => (
              <blockquote key={a.key} className="j-truth" style={{ borderColor: a.tcol }}>
                <span className="j-truth-tag" style={{ color: a.tcol }}>{a.tglyph} {a.tname}</span>
                “{a.text}”
                <cite>— {a.cite}, from {cur.name.trim()}'s own records</cite>
              </blockquote>
            ))}
            {/* distinct actions still available at this fire */}
            {stopActions.some(a => !explored.includes(a.key)) && (
              <div className="j-actions">
                {stopActions.filter(a => !explored.includes(a.key)).map(a => (
                  <button key={a.key} className="j-action" style={{ '--tc': a.tcol }} onClick={() => chooseAction(a)}>
                    <span className="j-action-ic">{a.icon}</span>
                    <b>{a.label}</b>
                    <span className="j-action-sub">receive {a.cite}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="j-choices">
              {explored.length > 0 && <button className="j-btn ghost" onClick={() => onSelect && onSelect(cur.id)}>Open {cur.name.trim().split(' ')[0]}'s page ↗</button>}
              <button className={`j-btn ${explored.length ? '' : 'ghost'}`} onClick={paddleOn}>{idx + 1 >= N ? '✶ Complete the journey' : (explored.length ? '🛶 Paddle on' : '🛶 Paddle on without stopping')}</button>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="j-card j-done">
            <div className="j-eyebrow">Mino Bimaadiziwin · The Good Life</div>
            <h3>You gathered {pouch.length} gift{pouch.length === 1 ? '' : 's'} across the four directions.</h3>
            {pouch.length > 0 && (
              <div className="j-pouch-summary">
                {['Body', 'Mind', 'Spirit', 'Heart', 'Youth'].map(nm => {
                  const items = pouch.filter(p => p.name === nm); if (!items.length) return null;
                  return <span key={nm} className="j-tok" style={{ color: items[0].col, borderColor: items[0].col }}>{items[0].glyph} {nm} ×{items.length}</span>;
                })}
              </div>
            )}
            <p>
              Each gift is a real community caring for its people — body, mind, spirit,
              and heart. This is what the atlas holds: {all.length} of these stories,
              waiting to be visited.
            </p>
            <div className="j-choices">
              <button className="j-btn" onClick={restart}>↻ Begin again</button>
            </div>
          </div>
        )}
      </div>

      {/* the medicine pouch: every token gathered so far, filling as you go */}
      {pouch.length > 0 && (
        <div className="j-pouch" aria-label="Gifts gathered">
          {pouch.map((p, i) => (
            <span key={i} className="j-tok-dot" style={{ background: p.col, borderColor: p.col }} title={`${p.name} — a gift`}>{p.glyph}</span>
          ))}
        </div>
      )}

      <div className="j-sash" aria-label="Shores visited">
        {stops.map((sc, i) => {
          const done = pouch.some(b => b.stopId === sc.id);
          const col = (_J_DIR[sc.direction || 'Central'] || _J_DIR.Central).col;
          return (
            <span key={sc.id}
              className={`j-bead ${done ? 'on' : ''} ${i === idx ? 'here' : ''}`}
              style={done ? { background: col, borderColor: col } : {}}
              title={done ? sc.name.trim() : 'Not yet visited'}></span>
          );
        })}
      </div>
    </div>
  );
}
