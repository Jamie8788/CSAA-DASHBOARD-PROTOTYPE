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

const _J_DIR = {
  East:  { season: 'Spring · Ziigwan',   col: '#d4a017', guide: 'Maang turns the bow toward the sunrise. New programs are taking root here.' },
  South: { season: 'Summer · Niibin',    col: '#b8351e', guide: 'The water is warm and full of life. The youth are on the land here.' },
  West:  { season: 'Autumn · Dagwaagin', col: '#3a4658', guide: 'The light turns gold and low. This is the direction of healing and reflection.' },
  North: { season: 'Winter · Biboon',    col: '#8fa8a0', guide: 'The first stars are out. The elders keep the deep memory in the North.' },
  Central: { season: 'All seasons',      col: '#7c2f6b', guide: 'Maang circles — this one serves communities in every direction.' },
};

function JourneyOfCare({ all, onSelect }) {
  const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 8 stops: the two best-documented COMMUNITIES from each direction, E→S→W→N,
  // so the journey crosses a full day and a full year.
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

  const [idx, setIdx] = useState(-1);              // -1 = the landing shore
  const [phase, setPhase] = useState('intro');     // intro | paddling | arrived | done
  const [received, setReceived] = useState(false); // teaching accepted at this stop
  const [beads, setBeads] = useState([]);
  const canvasRef = useRef(null);
  const phaseRef = useRef('intro'); phaseRef.current = phase;
  const idxRef = useRef(idx); idxRef.current = idx;
  const padRef = useRef(0);                        // paddling progress 0..1
  const arriveRef = useRef(0);                     // shore slide-in 0..1
  const pendingIdxRef = useRef(0);

  const cur = idx >= 0 && idx < N ? stops[idx] : null;
  const truth = useMemo(() => (cur ? _journeyTruth(cur) : null), [cur]);
  const dirInfo = cur ? (_J_DIR[cur.direction || 'Central'] || _J_DIR.Central) : null;

  function beginJourney() { pendingIdxRef.current = 0; padRef.current = 0; arriveRef.current = 0; setReceived(false); setPhase('paddling'); }
  function paddleOn() {
    if (idx + 1 >= N) { setPhase('done'); return; }
    pendingIdxRef.current = idx + 1; padRef.current = 0; arriveRef.current = 0; setReceived(false); setPhase('paddling');
  }
  function restart() { setIdx(-1); setBeads([]); setReceived(false); setPhase('intro'); padRef.current = 0; arriveRef.current = 0; }
  function receive() {
    if (received || !cur) return;
    setBeads(b => [...b, { dir: cur.direction || 'Central', id: cur.id, name: cur.name.trim() }]);
    setReceived(true);
  }

  // ---------------- the animated scene ----------------
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf = null, last = 0, t0 = null;
    const DPR = Math.min(1.5, window.devicePixelRatio || 1);
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = Math.max(1, w * DPR); canvas.height = Math.max(1, h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    const ro = ('ResizeObserver' in window) ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(canvas);

    const lerp = (a, b, u) => a + (b - a) * u;
    const mixc = (c1, c2, u) => [Math.round(lerp(c1[0], c2[0], u)), Math.round(lerp(c1[1], c2[1], u)), Math.round(lerp(c1[2], c2[2], u))];
    // four-direction day cycle: dawn gold → summer noon → autumn dusk → winter night
    const SKY_T = [[236, 200, 130], [190, 214, 232], [226, 140, 96], [24, 26, 48]];
    const SKY_B = [[244, 224, 176], [226, 238, 244], [130, 92, 110], [52, 48, 84]];
    const WATER = [[176, 168, 120], [120, 168, 180], [110, 84, 96], [30, 34, 56]];

    function scene(time) {
      const W = canvas.clientWidth, H = canvas.clientHeight;
      const tt = (time - (t0 == null ? (t0 = time) : t0)) / 1000;
      // journey time 0..1 across all stops
      const jIdx = phaseRef.current === 'paddling' ? pendingIdxRef.current - 1 + padRef.current : Math.max(0, idxRef.current);
      const jt = N > 1 ? Math.max(0, Math.min(1, jIdx / (N - 1))) : 0;
      const seg = Math.min(2.999, jt * 3), si = Math.floor(seg), su = seg - si;
      const skyT = mixc(SKY_T[si], SKY_T[si + 1], su);
      const skyB = mixc(SKY_B[si], SKY_B[si + 1], su);
      const wat  = mixc(WATER[si], WATER[si + 1], su);
      const night = Math.max(0, (jt - 0.66) / 0.34);
      const hY = H * 0.56;

      // sky
      const g = ctx.createLinearGradient(0, 0, 0, hY);
      g.addColorStop(0, `rgb(${skyT.join(',')})`); g.addColorStop(1, `rgb(${skyB.join(',')})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, hY);
      // sun → moon across the journey
      const arc = Math.PI * (1 - jt * 0.92 - 0.04);
      const sx = W * (0.15 + 0.7 * jt), sy = hY * 0.72 - Math.sin(arc) * hY * 0.5;
      ctx.beginPath(); ctx.arc(sx, Math.max(24, sy), 20, 0, 6.283);
      ctx.fillStyle = night > 0.4 ? 'rgba(232,238,248,0.95)' : 'rgba(255,236,190,0.95)'; ctx.fill();
      // stars + aurora at night
      if (night > 0.05) {
        ctx.globalAlpha = night;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        for (let i = 0; i < 26; i++) {
          const stx = ((i * 137.5) % W), sty = ((i * 61.8) % (hY * 0.7));
          const tw = 0.5 + 0.5 * Math.sin(tt * 2 + i);
          ctx.globalAlpha = night * (0.3 + 0.5 * tw);
          ctx.fillRect(stx, sty, 1.6, 1.6);
        }
        for (let a2 = 0; a2 < 3; a2++) {
          ctx.globalAlpha = night * 0.16;
          ctx.strokeStyle = ['#7de0b8', '#9db8ff', '#d29bff'][a2]; ctx.lineWidth = 12;
          ctx.beginPath();
          for (let x = 0; x <= W; x += 24) {
            const y = 26 + a2 * 22 + Math.sin(x * 0.008 + tt * 0.5 + a2 * 2) * 14;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      // far hills + treeline (parallax drift while paddling)
      const drift = (jIdx * 900 + (phaseRef.current === 'paddling' ? tt * 30 : 0));
      ctx.fillStyle = `rgba(${Math.round(skyB[0] * 0.55)},${Math.round(skyB[1] * 0.55)},${Math.round(skyB[2] * 0.55)},1)`;
      ctx.beginPath(); ctx.moveTo(0, hY);
      for (let x = 0; x <= W; x += 12) ctx.lineTo(x, hY - 18 - Math.sin((x + drift * 0.3) * 0.006) * 12);
      ctx.lineTo(W, hY); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(24,28,22,0.85)';
      for (let x = -20; x <= W + 20; x += 26) {
        const xx = x - (drift % 26);
        const th = 14 + ((x * 7919) % 10);
        ctx.beginPath(); ctx.moveTo(xx - 7, hY); ctx.lineTo(xx, hY - th); ctx.lineTo(xx + 7, hY); ctx.closePath(); ctx.fill();
      }
      // water
      const wg = ctx.createLinearGradient(0, hY, 0, H);
      wg.addColorStop(0, `rgb(${wat.map(v => Math.min(255, v + 26)).join(',')})`);
      wg.addColorStop(1, `rgb(${wat.join(',')})`);
      ctx.fillStyle = wg; ctx.fillRect(0, hY, W, H - hY);
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const ly = hY + 14 + i * (H - hY) * 0.17;
        const lx = ((tt * 22 + i * 160) % (W + 240)) - 120;
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 60 + i * 16, ly); ctx.stroke();
      }
      // sun/moon glitter path on the water
      ctx.globalAlpha = 0.25; ctx.fillStyle = night > 0.4 ? '#cdd8ee' : '#ffe2a6';
      for (let i = 0; i < 8; i++) {
        const gy = hY + 8 + i * 9, gw = 46 - i * 4;
        ctx.fillRect(sx - gw / 2 + Math.sin(tt * 2 + i) * 5, gy, gw, 1.6);
      }
      ctx.globalAlpha = 1;

      // ---- the SHORE that greets the canoe (slides in when arriving) ----
      const at = arriveRef.current;
      if (at > 0.01) {
        const sxr = W - at * W * 0.34;                     // shore wedge from the right
        ctx.fillStyle = `rgb(${Math.round(44 + 14 * (1 - night))},${Math.round(66 + 20 * (1 - night))},${Math.round(38 + 10 * (1 - night))})`;
        ctx.beginPath();
        ctx.moveTo(W, H); ctx.lineTo(W, hY + 14);
        ctx.quadraticCurveTo(sxr + 60, hY + 18, sxr, hY + 44);
        ctx.lineTo(sxr - 22, H); ctx.closePath(); ctx.fill();
        // the lodge
        const lx2 = sxr + 62, ly2 = hY + 40;
        ctx.fillStyle = 'rgb(92,62,36)';
        ctx.beginPath(); ctx.moveTo(lx2 - 20, ly2); ctx.quadraticCurveTo(lx2, ly2 - 30, lx2 + 20, ly2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgb(40,26,14)';
        ctx.beginPath(); ctx.ellipse(lx2, ly2 - 3, 5, 7, 0, Math.PI, 2 * Math.PI); ctx.fill();
        // welcome fire with flicker + two greeters
        const fx2 = sxr + 22, fy2 = hY + 52;
        const fl2 = 0.8 + Math.sin(tt * 9) * 0.14 + Math.sin(tt * 21) * 0.06;
        const fg2 = ctx.createRadialGradient(fx2, fy2 - 4, 2, fx2, fy2 - 4, 34 * fl2);
        fg2.addColorStop(0, 'rgba(255,170,80,0.55)'); fg2.addColorStop(1, 'rgba(255,150,60,0)');
        ctx.fillStyle = fg2; ctx.fillRect(fx2 - 40, fy2 - 44, 80, 66);
        ctx.fillStyle = `rgba(255,${Math.round(150 + 60 * fl2)},60,0.95)`;
        ctx.beginPath(); ctx.moveTo(fx2 - 5, fy2); ctx.quadraticCurveTo(fx2, fy2 - 16 * fl2, fx2 + 5, fy2); ctx.closePath(); ctx.fill();
        for (const gdx of [-14, 12]) {
          const wave = Math.sin(tt * 3 + gdx) * 0.4;
          ctx.fillStyle = 'rgb(58,40,26)';
          ctx.beginPath(); ctx.ellipse(fx2 + gdx, fy2 - 9, 4, 7, 0, 0, 6.283); ctx.fill();
          ctx.beginPath(); ctx.arc(fx2 + gdx, fy2 - 19, 3.2, 0, 6.283); ctx.fill();
          ctx.strokeStyle = 'rgb(58,40,26)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(fx2 + gdx + 3, fy2 - 13);
          ctx.lineTo(fx2 + gdx + 7, fy2 - 20 - wave * 5); ctx.stroke();   // waving arm
        }
      }

      // ---- the CANOE (always) + Maang the loon guide ----
      const cx2 = W * 0.36, cy2 = hY + (H - hY) * 0.44 + Math.sin(tt * 1.1) * 2;
      const stroke2 = phaseRef.current === 'paddling' ? Math.sin(tt * 4) : Math.sin(tt * 0.8) * 0.2;
      // wake
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(cx2 - 44, cy2 + 6); ctx.lineTo(cx2 - 84, cy2 + 12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx2 - 44, cy2 + 6); ctx.lineTo(cx2 - 84, cy2 + 1); ctx.stroke();
      // hull — birchbark with the four-colour band
      ctx.fillStyle = 'rgb(214,178,128)';
      ctx.beginPath();
      ctx.moveTo(cx2 - 46, cy2); ctx.quadraticCurveTo(cx2, cy2 + 14, cx2 + 46, cy2);
      ctx.quadraticCurveTo(cx2 + 54, cy2 - 8, cx2 + 46, cy2 - 10);
      ctx.quadraticCurveTo(cx2, cy2 + 2, cx2 - 46, cy2 - 10);
      ctx.quadraticCurveTo(cx2 - 54, cy2 - 8, cx2 - 46, cy2);
      ctx.closePath(); ctx.fill();
      const bandCols = ['#d4a017', '#b8351e', '#1a1612', '#efe7d6'];
      for (let b2 = 0; b2 < 4; b2++) {
        ctx.fillStyle = bandCols[b2];
        ctx.fillRect(cx2 - 40 + b2 * 20, cy2 - 6, 20, 4);
      }
      // paddlers
      for (const [pdx, ph2] of [[-16, 0], [18, Math.PI * 0.5]]) {
        ctx.fillStyle = 'rgb(56,38,24)';
        ctx.beginPath(); ctx.ellipse(cx2 + pdx, cy2 - 16, 5, 8, 0, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.arc(cx2 + pdx, cy2 - 28, 4, 0, 6.283); ctx.fill();
        const pa = stroke2 * 0.5 + ph2 * 0.1;
        ctx.strokeStyle = 'rgb(110,76,40)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx2 + pdx + 4, cy2 - 20);
        ctx.lineTo(cx2 + pdx + 12 + Math.sin(pa) * 8, cy2 + 6 + Math.cos(pa) * 4); ctx.stroke();
      }
      // Maang the loon, gliding ahead of the bow
      const mgx2 = cx2 + 92 + Math.sin(tt * 0.7) * 6, mgy2 = cy2 + 4 + Math.sin(tt * 1.3) * 1.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mgx2 - 8, mgy2 + 2); ctx.lineTo(mgx2 - 26, mgy2 + 5); ctx.stroke();
      ctx.fillStyle = 'rgb(24,22,26)';
      ctx.beginPath(); ctx.ellipse(mgx2, mgy2, 9, 3, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgb(24,22,26)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(mgx2 + 6, mgy2 - 1); ctx.quadraticCurveTo(mgx2 + 9, mgy2 - 6, mgx2 + 9.5, mgy2 - 7.5); ctx.stroke();
      ctx.fillStyle = 'rgb(24,22,26)';
      ctx.beginPath(); ctx.ellipse(mgx2 + 10, mgy2 - 8, 2.2, 1.8, 0.2, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(230,234,232,0.9)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(mgx2 + 7, mgy2 - 4.5); ctx.lineTo(mgx2 + 9, mgy2 - 3.5); ctx.stroke();  // necklace

      // paddling progress + arrival easing
      if (phaseRef.current === 'paddling') {
        padRef.current = Math.min(1, padRef.current + (time - (last || time)) / 2400);
        if (padRef.current >= 1) { setIdx(pendingIdxRef.current); setPhase('arrived'); }
      }
      if (phaseRef.current === 'arrived' && arriveRef.current < 1) {
        arriveRef.current = Math.min(1, arriveRef.current + (time - (last || time)) / 700);
      }
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

        {phase === 'intro' && (
          <div className="j-card j-intro">
            <div className="j-eyebrow">The Journey of Care · {N} real communities</div>
            <h3>Step into the canoe.</h3>
            <p>
              Maang the loon will guide you through the four directions — sunrise to
              starlight. At every shore, a real community welcomes you to its fire and
              shares one true thing about how it cares for its people. Receive each
              teaching, and carry {N} beads home.
            </p>
            <button className="j-btn" onClick={beginJourney}>🛶 Begin the journey</button>
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
            {!received ? (
              <>
                <p className="j-invite">You are welcomed to the fire. Will you receive this community's teaching?</p>
                <div className="j-choices">
                  <button className="j-btn" onClick={receive}>🌿 Offer semaa &amp; listen</button>
                  <button className="j-btn ghost" onClick={receive}>🔥 Sit by the fire</button>
                </div>
              </>
            ) : (
              <>
                {truth && (
                  <blockquote className="j-truth">
                    “{truth.text}”
                    <cite>— {pillarLabel[truth.pillar] || truth.pillar}, from {cur.name.trim()}'s own records</cite>
                  </blockquote>
                )}
                <div className="j-choices">
                  <button className="j-btn ghost" onClick={() => onSelect && onSelect(cur.id)}>Open {cur.name.trim().split(' ')[0]}'s page ↗</button>
                  <button className="j-btn" onClick={paddleOn}>{idx + 1 >= N ? '✶ Complete the journey' : '🛶 Paddle on'}</button>
                </div>
              </>
            )}
          </div>
        )}

        {phase === 'done' && (
          <div className="j-card j-done">
            <div className="j-eyebrow">Mino Bimaadiziwin · The Good Life</div>
            <h3>You carried {beads.length} teachings through the four directions.</h3>
            <p>
              Every bead is a real community caring for its people — body, mind, spirit,
              and heart. This is what the atlas holds: {all.length} of these stories,
              waiting to be visited.
            </p>
            <div className="j-choices">
              <button className="j-btn" onClick={restart}>↻ Begin again</button>
            </div>
          </div>
        )}
      </div>

      {/* the beaded sash — one bead per teaching received */}
      <div className="j-sash" aria-label="Teachings received">
        {stops.map((sc, i) => {
          const done = beads.some(b => b.id === sc.id);
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
