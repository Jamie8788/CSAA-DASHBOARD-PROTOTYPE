/* global React */
// ============================================================================
// COMMUNITY GAMES — calm, dignified games built for everyone, including
// Elders: no time pressure, no reflexes needed, large type, big targets.
// Every card, question, and fact is pulled live from the master sheet.
//
//   1. MemoryGame    — "Matching Pairs". Classic concentration: find the two
//                      cards that carry the same community. Each match
//                      reveals a real fact about that community.
//   2. TerritoryQuiz — "Know the Territory". Gentle multiple-choice questions
//                      generated from the sheet (regions, members, services).
// ============================================================================
const { useState, useMemo, useEffect, useRef } = React;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DIR_LABEL = { East: 'East · Spring', South: 'South · Summer', West: 'West · Autumn', North: 'North · Winter', Central: 'All Directions' };

// One human-readable fact per community, from real sheet content.
function factFor(c) {
  const facts = [];
  if (c.population) facts.push(`${c.name.trim()} has about ${c.population.toLocaleString()} members.`);
  const pillarsOn = window.PILLARS.filter(p => window.pillarOn(c, p.key));
  if (pillarsOn.length === 4) facts.push(`${c.name.trim()} documents all four pillars of care — physical, mental, spiritual and emotional.`);
  else if (pillarsOn.length) facts.push(`${c.name.trim()} documents ${pillarsOn.map(p => p.label.split(' ')[0].toLowerCase()).join(', ')} programming.`);
  if (c.hasYouth) facts.push(`${c.name.trim()} has youth programming on file.`);
  if (c.hasSurvivors) facts.push(`${c.name.trim()} documents support for survivors.`);
  if (c.staff && c.staff.length) facts.push(`${c.staff.length} direct contact${c.staff.length === 1 ? '' : 's'} are on file for ${c.name.trim()}.`);
  return facts.length ? facts[Math.floor(Math.random() * facts.length)] : `${c.name.trim()} is part of the atlas.`;
}

// ============================================================================
// 1. MEMORY — MATCHING PAIRS
// ============================================================================
function MemoryGame({ all, onSelect }) {
  const pool = useMemo(() => all.filter(c => c.orgType === 'Community'), [all]);
  const [pairCount, setPairCount] = useState(6);

  function deal(n) {
    const chosen = shuffle(pool).slice(0, n);
    return shuffle(chosen.flatMap(c => ([
      { uid: c.id + '-a', c }, { uid: c.id + '-b', c },
    ])));
  }

  const [cards, setCards] = useState(() => deal(pairCount));
  const [faceUp, setFaceUp] = useState([]);       // uids currently flipped
  const [matched, setMatched] = useState([]);     // community ids matched
  const [moves, setMoves] = useState(0);
  const [lastFact, setLastFact] = useState(null);
  const lockRef = useRef(false);

  function restart(n = pairCount) {
    setCards(deal(n)); setFaceUp([]); setMatched([]); setMoves(0); setLastFact(null);
    lockRef.current = false;
  }

  function flip(card) {
    if (lockRef.current) return;
    if (faceUp.includes(card.uid) || matched.includes(card.c.id)) return;
    const next = [...faceUp, card.uid];
    setFaceUp(next);
    if (next.length === 2) {
      setMoves(m => m + 1);
      const [u1, u2] = next;
      const c1 = cards.find(k => k.uid === u1).c;
      const c2 = cards.find(k => k.uid === u2).c;
      if (c1.id === c2.id) {
        // a match — celebrate gently and teach something true
        setMatched(m => [...m, c1.id]);
        setLastFact({ c: c1, text: factFor(c1) });
        setFaceUp([]);
      } else {
        lockRef.current = true;
        setTimeout(() => { setFaceUp([]); lockRef.current = false; }, 1400);
      }
    }
  }

  const done = cards.length > 0 && matched.length === cards.length / 2;

  return (
    <div className="game-pane memory-pane">
      <div className="game-head">
        <div>
          <div className="game-kicker">Matching pairs · no clock, no rush</div>
          <h3 className="game-title">Find each community's twin.</h3>
          <p className="game-sub">
            Turn over two cards at a time. When both cards show the same community, they stay open
            and you learn something true about that community — straight from the master sheet.
          </p>
        </div>
        <div className="game-score">
          <span className="gs-num">{matched.length}</span>
          <span className="gs-of">of {cards.length / 2} pairs · {moves} turns</span>
        </div>
      </div>

      <div className="memory-controls">
        <span className="mc-lab">Board size</span>
        {[6, 8, 10].map(n => (
          <button key={n} className={`mc-size ${pairCount === n ? 'on' : ''}`}
                  onClick={() => { setPairCount(n); restart(n); }}>
            {n} pairs
          </button>
        ))}
        <button className="mc-new" onClick={() => restart()}>↻ New cards</button>
      </div>

      <div className={`memory-grid pairs-${pairCount}`}>
        {cards.map(card => {
          const isUp = faceUp.includes(card.uid) || matched.includes(card.c.id);
          const isMatched = matched.includes(card.c.id);
          const hex = window.dirHex(card.c);
          return (
            <button key={card.uid}
              className={`memory-card ${isUp ? 'up' : ''} ${isMatched ? 'matched' : ''}`}
              onClick={() => flip(card)}
              aria-label={isUp ? card.c.name.trim() : 'Hidden card'}>
              <span className="mcard-inner">
                <span className="mcard-back">
                  <span className="mcard-pattern">✦</span>
                </span>
                <span className="mcard-face" style={{ '--dir': hex }}>
                  <span className="mcard-mark" style={{ background: hex }}>{card.c.mark}</span>
                  <span className="mcard-name">{card.c.name.trim().replace(/\s*\([^)]*\)/g, '')}</span>
                  <span className="mcard-region">{DIR_LABEL[card.c.direction] || card.c.regionGroup}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {lastFact && !done && (
        <div className="memory-fact" key={lastFact.c.id}>
          <span className="mf-badge">✓ Pair found</span>
          <span className="mf-text">{lastFact.text}</span>
          <button className="mf-open" onClick={() => onSelect(lastFact.c.id)}>Open record →</button>
        </div>
      )}

      {done && (
        <div className="memory-done">
          <div className="md-glyph">❋</div>
          <h4>All {cards.length / 2} pairs found in {moves} turns.</h4>
          <p>Every community you matched is real — open any record to learn more about its programs.</p>
          <button className="game-next" onClick={() => restart()}>Play again</button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 2. KNOW THE TERRITORY — gentle quiz
// ============================================================================
const POP_CHOICES = [
  { label: 'Fewer than 500 members', test: p => p < 500 },
  { label: '500 to 1,500 members', test: p => p >= 500 && p < 1500 },
  { label: '1,500 to 5,000 members', test: p => p >= 1500 && p < 5000 },
  { label: 'More than 5,000 members', test: p => p >= 5000 },
];

function buildQuestion(pool) {
  const kinds = [];
  const withDir = pool.filter(c => ['East', 'South', 'West', 'North'].includes(c.direction));
  const withPop = pool.filter(c => c.population);
  const allFour = pool.filter(c => c.hasPhysical && c.hasMental && c.hasSpiritual && c.hasEmotional);
  const notFour = pool.filter(c => !(c.hasPhysical && c.hasMental && c.hasSpiritual && c.hasEmotional));
  const withYouth = pool.filter(c => c.hasYouth);
  const noYouth = pool.filter(c => !c.hasYouth);

  if (withDir.length >= 4) kinds.push('direction');
  if (withPop.length >= 4) kinds.push('population');
  if (allFour.length >= 1 && notFour.length >= 3) kinds.push('fourPillars');
  if (withYouth.length >= 1 && noYouth.length >= 3) kinds.push('youth');
  if (!kinds.length) kinds.push('population');

  const kind = kinds[Math.floor(Math.random() * kinds.length)];

  if (kind === 'direction') {
    const c = withDir[Math.floor(Math.random() * withDir.length)];
    return {
      prompt: `Which direction of the territory is ${c.name.trim()} in?`,
      help: 'Each community sits in one of the four directions of the atlas.',
      options: shuffle(['East', 'South', 'West', 'North']).map(d => ({
        label: DIR_LABEL[d], correct: d === c.direction,
      })),
      about: c,
    };
  }
  if (kind === 'population') {
    const c = withPop[Math.floor(Math.random() * withPop.length)];
    return {
      prompt: `About how many members does ${c.name.trim()} have?`,
      help: 'Population figures come from each community’s own records.',
      options: POP_CHOICES.map(b => ({ label: b.label, correct: b.test(c.population) })),
      about: c,
      reveal: `${c.name.trim()} has about ${c.population.toLocaleString()} members.`,
    };
  }
  if (kind === 'fourPillars') {
    const right = allFour[Math.floor(Math.random() * allFour.length)];
    const wrong = shuffle(notFour).slice(0, 3);
    return {
      prompt: 'Which of these communities documents ALL FOUR pillars of care?',
      help: 'Physical, mental, spiritual and emotional — whole-person care.',
      options: shuffle([
        { label: right.name.trim(), correct: true },
        ...wrong.map(c => ({ label: c.name.trim(), correct: false })),
      ]),
      about: right,
    };
  }
  // youth
  const right = withYouth[Math.floor(Math.random() * withYouth.length)];
  const wrong = shuffle(noYouth).slice(0, 3);
  return {
    prompt: 'Which of these communities has youth programming on file?',
    help: 'Youth programming is one of the ways communities bridge generations.',
    options: shuffle([
      { label: right.name.trim(), correct: true },
      ...wrong.map(c => ({ label: c.name.trim(), correct: false })),
    ]),
    about: right,
  };
}

const ROUND_LENGTH = 8;
const PRAISE = ['Well done.', 'That’s right.', 'Good eye.', 'Exactly so.'];
const GENTLE = ['Good try — here’s the answer.', 'Almost — now you know.', 'A new thing learned.'];

function TerritoryQuiz({ all, onSelect }) {
  const pool = useMemo(() => all.filter(c => c.orgType === 'Community'), [all]);
  const [q, setQ] = useState(() => buildQuestion(pool));
  const [picked, setPicked] = useState(null);     // index picked
  const [score, setScore] = useState(0);
  const [asked, setAsked] = useState(0);
  const [doneRound, setDoneRound] = useState(false);

  function pick(i) {
    if (picked != null) return;
    setPicked(i);
    setAsked(a => a + 1);
    if (q.options[i].correct) setScore(s => s + 1);
  }
  function next() {
    if (asked >= ROUND_LENGTH) { setDoneRound(true); return; }
    setPicked(null);
    setQ(buildQuestion(pool));
  }
  function restart() {
    setScore(0); setAsked(0); setPicked(null); setDoneRound(false);
    setQ(buildQuestion(pool));
  }

  if (doneRound) {
    const pct = Math.round(score / ROUND_LENGTH * 100);
    const title = pct >= 90 ? 'A true knowledge keeper.'
      : pct >= 65 ? 'You know this territory well.'
      : pct >= 40 ? 'The territory is opening up to you.'
      : 'Every journey starts somewhere.';
    return (
      <div className="game-pane quiz-pane">
        <div className="quiz-final">
          <div className="qf-glyph">✦</div>
          <div className="qf-score">{score}<span className="qf-of">/{ROUND_LENGTH}</span></div>
          <h3>{title}</h3>
          <p>Every question came from the communities' own records. Browse the directory to keep learning.</p>
          <button className="game-next" onClick={restart}>Play another round</button>
        </div>
      </div>
    );
  }

  const answered = picked != null;
  const wasRight = answered && q.options[picked].correct;

  return (
    <div className="game-pane quiz-pane">
      <div className="game-head">
        <div>
          <div className="game-kicker">Know the territory · question {Math.min(asked + (answered ? 0 : 1), ROUND_LENGTH)} of {ROUND_LENGTH}</div>
          <h3 className="game-title">{q.prompt}</h3>
          <p className="game-sub">{q.help}</p>
        </div>
        <div className="game-score">
          <span className="gs-num">{score}</span>
          <span className="gs-of">right so far</span>
        </div>
      </div>

      <div className="quiz-progress">
        {Array.from({ length: ROUND_LENGTH }).map((_, i) => (
          <span key={i} className={`qp-dot ${i < asked ? 'done' : ''}`}></span>
        ))}
      </div>

      <div className="quiz-options">
        {q.options.map((o, i) => {
          const showRight = answered && o.correct;
          const showWrong = answered && picked === i && !o.correct;
          return (
            <button key={i}
              className={`quiz-option ${showRight ? 'correct' : ''} ${showWrong ? 'wrong' : ''}`}
              onClick={() => pick(i)} disabled={answered}>
              <span className="qo-letter">{String.fromCharCode(65 + i)}</span>
              <span className="qo-label">{o.label}</span>
              {showRight && <span className="qo-flag">✓</span>}
              {showWrong && <span className="qo-flag">✕</span>}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className={`quiz-after ${wasRight ? 'right' : 'learn'}`}>
          <div className="qa-line">
            <strong>{wasRight
              ? PRAISE[asked % PRAISE.length]
              : GENTLE[asked % GENTLE.length]}</strong>
            {q.reveal ? ` ${q.reveal}` : ''}
          </div>
          <div className="qa-actions">
            <button className="game-next" onClick={next}>
              {asked >= ROUND_LENGTH ? 'See result →' : 'Next question →'}
            </button>
            {q.about && <button className="game-link" onClick={() => onSelect(q.about.id)}>Open {q.about.name.trim().split('(')[0].trim()}</button>}
          </div>
        </div>
      )}
    </div>
  );
}

window.MemoryGame = MemoryGame;
window.TerritoryQuiz = TerritoryQuiz;
// Back-compat: anything still mounting JourneyGame gets the memory game.
window.JourneyGame = MemoryGame;
