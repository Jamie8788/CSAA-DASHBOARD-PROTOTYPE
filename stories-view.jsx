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
  const [tab, setTab] = useState('journey');

  return (
    <div className="stories-view">
      <header className="stories-header">
        <div className="eyebrow">Community Stories & Games</div>
        <h2>Learn the atlas — by playing it.</h2>
        <p>Drive, paddle, and read your way through the territory. Every question and quote is pulled from the master sheet — nothing is invented.</p>
        <div className="stories-tabs">
          <button className={tab==='journey'?'on':''} onClick={()=>setTab('journey')}>✦ Miikana · The Path</button>
          <button className={tab==='match'?'on':''} onClick={()=>setTab('match')}>◆ Match the service</button>
          <button className={tab==='roulette'?'on':''} onClick={()=>setTab('roulette')}>◉ Discover roulette</button>
          <button className={tab==='quotes'?'on':''} onClick={()=>setTab('quotes')}>● Quote wall</button>
        </div>
      </header>

      {tab === 'journey' && <window.JourneyGame all={all} onSelect={onSelect} />}
      {tab === 'quotes' && <QuoteWall all={all} onSelect={onSelect} />}
      {tab === 'match' && <MatchGame all={all} onSelect={onSelect} />}
      {tab === 'roulette' && <RouletteGame all={all} onSelect={onSelect} />}
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
