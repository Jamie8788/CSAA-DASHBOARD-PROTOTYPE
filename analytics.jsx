/* global React */
// ============================================================================
// Analytics — written for community members, not analysts.
// Every card answers a plain-language question, every number traces back to
// real columns in the master sheet, every list is actionable.
// ============================================================================
const { useMemo, useState } = React;

const PILLAR_KEYS = [
  { key:'hasPhysical',  label:'physical health',  short:'Physical',  hex:'#b8351e' },
  { key:'hasMental',    label:'mental health',    short:'Mental',    hex:'#3a5d8c' },
  { key:'hasSpiritual', label:'spiritual / cultural', short:'Spiritual', hex:'#d4a017' },
  { key:'hasEmotional', label:'emotional wellness', short:'Emotional', hex:'#6b8d6b' },
  { key:'hasYouth',     label:'youth programming', short:'Youth',    hex:'#a08530' },
  { key:'hasSurvivors', label:'survivor support', short:'Survivors', hex:'#5a4f40' },
];

// ----------------------------------------------------------------------------
// 1. Plain-language headline
// ----------------------------------------------------------------------------
function PlainSnapshot({ all }) {
  const stats = useMemo(() => {
    const comms = all.filter(c => c.orgType === 'Community');
    const orgs = all.filter(c => c.orgType !== 'Community');
    const totalPop = all.reduce((s,c)=>s+(c.population||0),0);
    const withCoords = all.filter(c => c.lat != null && c.lng != null).length;
    const allFour = comms.filter(c => c.hasPhysical && c.hasMental && c.hasSpiritual && c.hasEmotional).length;
    const totalStaff = all.reduce((s,c) => s + (c.staff?.length || 0), 0);
    const dirCounts = ['East','South','West','North'].map(d => ({
      dir: d, count: comms.filter(c => c.direction === d).length
    }));
    const fullCoverage = Math.round(allFour / Math.max(1, comms.length) * 100);
    return { comms, orgs, totalPop, withCoords, allFour, totalStaff, dirCounts, fullCoverage };
  }, [all]);

  // Animated counters
  const nComms   = window.useCountUp(stats.comms.length, 1600);
  const nOrgs    = window.useCountUp(stats.orgs.length, 1600);
  const nPop     = window.useCountUp(stats.totalPop, 1800);
  const nStaff   = window.useCountUp(stats.totalStaff, 1600);
  const nFull    = window.useCountUp(stats.fullCoverage, 1700);
  const nAllFour = window.useCountUp(stats.allFour, 1700);
  const nWithCoords = window.useCountUp(stats.withCoords, 1600);
  const nE = window.useCountUp(stats.dirCounts.find(d=>d.dir==='East').count, 1500);
  const nS = window.useCountUp(stats.dirCounts.find(d=>d.dir==='South').count, 1500);
  const nW = window.useCountUp(stats.dirCounts.find(d=>d.dir==='West').count, 1500);
  const nN = window.useCountUp(stats.dirCounts.find(d=>d.dir==='North').count, 1500);
  const popDisplay = stats.totalPop >= 1000 ? Math.round(nPop/1000) + 'k' : nPop;

  return (
    <div className="stat-card span-12 plain-snap">
      <div className="ps-grid">
        <div className="ps-col">
          <div className="eyebrow">In plain English</div>
          <h2 className="ps-title">
            The atlas currently holds <strong>{nComms} communities</strong>{' '}
            and <strong>{nOrgs} partner organizations</strong>.
          </h2>
          <p className="ps-lede">
            Together they serve roughly <strong>{nPop.toLocaleString()} people</strong> across the four directions
            — <strong>{nE}</strong> in the East,
            {' '}<strong>{nS}</strong> in the South,
            {' '}<strong>{nW}</strong> in the West,
            and <strong>{nN}</strong> in the North.
            We have <strong>{nStaff}</strong> direct contacts on file and{' '}
            <strong>{nWithCoords}</strong> places located on the map.
          </p>
          <p className="ps-lede" style={{marginTop:8}}>
            Of those communities, <strong>{nAllFour}</strong> ({nFull}%)
            currently document care across <em>all four</em> of the physical, mental, spiritual, and emotional pillars.
            The rest have gaps that this atlas is here to help close.
          </p>
        </div>
        <div className="ps-numbers">
          <div className="ps-n">
            <div className="ps-n-num">{nComms}</div>
            <div className="ps-n-lab">Communities</div>
          </div>
          <div className="ps-n">
            <div className="ps-n-num">{popDisplay}</div>
            <div className="ps-n-lab">People served</div>
          </div>
          <div className="ps-n">
            <div className="ps-n-num">{nStaff}</div>
            <div className="ps-n-lab">Contacts on file</div>
          </div>
          <div className="ps-n">
            <div className="ps-n-num">{nFull}<span style={{fontSize:24}}>%</span></div>
            <div className="ps-n-lab">All 4 pillars in place</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 2. Pillar coverage — clean horizontal bars w/ explanation
// ----------------------------------------------------------------------------
function PillarCoverage({ all }) {
  const comms = all.filter(c => c.orgType === 'Community');
  const total = comms.length;
  const data = PILLAR_KEYS.map(p => {
    const has = comms.filter(c => c[p.key]).length;
    return { ...p, has, missing: total - has, pct: total ? has / total : 0 };
  });
  // Sort: best first
  data.sort((a,b) => b.pct - a.pct);

  const best = data[0];
  const worst = data[data.length - 1];

  return (
    <div className="stat-card span-12">
      <div className="eyebrow">What kinds of programming are documented?</div>
      <h3 className="stat-q">
        Out of <strong>{total}</strong> communities, this is how many have each kind of programming written down in the atlas.
      </h3>
      <p className="stat-explain">
        <strong>{best.short}</strong> programming is the most-documented ({best.has} of {total} communities){total === 0 ? '' : `, while ${worst.short.toLowerCase()} is the least (${worst.has} of ${total})`}.
        A lower bar doesn't necessarily mean the work isn't happening on the ground — it means it isn't in the master sheet yet,
        and is where the next round of outreach will have the most impact.
      </p>
      <div className="pillar-bars">
        {data.map(p => <PillarBarRow key={p.key} p={p} total={total} />)}
      </div>
    </div>
  );
}

function PillarBarRow({ p, total }) {
  const nHas = window.useCountUp(p.has, 1800);
  const nPct = window.useCountUp(Math.round(p.pct * 100), 1800);
  return (
    <div className="pb-row">
      <div className="pb-label">
        <span className="pb-dot" style={{background:p.hex}}></span>
        {p.short} programming
      </div>
      <div className="pb-track">
        <div className="pb-fill" style={{ width: (p.pct * 100) + '%', background: p.hex }}>
          {p.pct > 0.18 && (
            <span className="pb-fill-text">{nHas} communities</span>
          )}
        </div>
        {p.pct <= 0.18 && (
          <span className="pb-side-text">{nHas} communities</span>
        )}
      </div>
      <div className="pb-pct">{nPct}%</div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 3. Attention list — which communities need each pillar?
// ----------------------------------------------------------------------------
function AttentionList({ all, onSelect }) {
  const [activePillar, setActivePillar] = useState('hasMental');
  const comms = all.filter(c => c.orgType === 'Community');
  const needing = comms.filter(c => !c[activePillar])
    .sort((a,b) => (b.population||0) - (a.population||0));

  const pillarInfo = PILLAR_KEYS.find(p => p.key === activePillar);

  // Communities missing only 1 pillar — "quick wins"
  const quickWins = useMemo(() => {
    const fourKeys = ['hasPhysical','hasMental','hasSpiritual','hasEmotional'];
    return comms.filter(c => {
      const missing = fourKeys.filter(k => !c[k]);
      return missing.length === 1;
    }).map(c => ({
      ...c,
      missingPillar: ['hasPhysical','hasMental','hasSpiritual','hasEmotional']
        .filter(k => !c[k])
        .map(k => PILLAR_KEYS.find(p => p.key === k)?.short)[0],
    })).sort((a,b) => (b.population||0) - (a.population||0));
  }, [all]);

  return (
    <div className="stat-card span-12">
      <div className="eyebrow">Where to focus next</div>
      <h3 className="stat-q">Communities that need <strong>{pillarInfo.label}</strong> information added.</h3>
      <p className="stat-explain">
        These are communities the atlas tracks but doesn't yet have <strong>{pillarInfo.label}</strong> programming documented for.
        Tap any name to open its record and add what's known. Ranked by population (largest first), so a small amount of outreach reaches the most people.
      </p>

      <div className="att-pillar-pills">
        {PILLAR_KEYS.map(p => {
          const count = comms.filter(c => !c[p.key]).length;
          return (
            <button key={p.key}
              className={`att-pill ${activePillar===p.key?'on':''}`}
              onClick={() => setActivePillar(p.key)}>
              <span className="att-pill-dot" style={{background:p.hex}}></span>
              {p.short}
              <span className="att-pill-n">{count}</span>
            </button>
          );
        })}
      </div>

      {needing.length === 0 ? (
        <div className="att-empty">All tracked communities document {pillarInfo.label}. ✓</div>
      ) : (
        <div className="att-list">
          {needing.slice(0, 12).map(c => (
            <button key={c.id} className="att-row" onClick={() => onSelect(c.id)}>
              <span className="att-name">{c.name.trim()}</span>
              <span className="att-meta">
                {c.regionGroup} · {c.direction}
                {c.population ? ` · ${c.population.toLocaleString()} ppl` : ''}
              </span>
              <span className="att-arrow">→</span>
            </button>
          ))}
          {needing.length > 12 && (
            <div className="att-more">+ {needing.length - 12} more — filter the directory by missing this pillar to see all</div>
          )}
        </div>
      )}

      {quickWins.length > 0 && (
        <div className="att-quickwin">
          <div className="eyebrow" style={{marginBottom:8}}>Quick wins — missing only ONE of the four core pillars</div>
          <p className="stat-explain" style={{marginBottom:14}}>
            {quickWins.length} {quickWins.length === 1 ? 'community is' : 'communities are'} just one column away from having the full Mino Bimaadiziwin picture. Add what's known and the dataset becomes whole.
          </p>
          <div className="qw-grid">
            {quickWins.slice(0, 6).map(c => (
              <button key={c.id} className="qw-card" onClick={() => onSelect(c.id)}>
                <div className="qw-name">{c.name.trim()}</div>
                <div className="qw-need">needs <strong>{c.missingPillar}</strong></div>
                {c.population && <div className="qw-pop">{c.population.toLocaleString()} members</div>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// 4. Leaderboards — most-documented + most-staffed
// ----------------------------------------------------------------------------
function Leaderboards({ all, onSelect }) {
  const comms = all.filter(c => c.orgType === 'Community');

  const mostDocumented = [...comms]
    .sort((a,b) => b.completeness - a.completeness)
    .slice(0, 8);

  const mostStaffed = [...all]
    .filter(c => c.staff?.length)
    .sort((a,b) => (b.staff?.length||0) - (a.staff?.length||0))
    .slice(0, 8);

  const leastDocumented = [...comms]
    .filter(c => c.completeness < 0.4)
    .sort((a,b) => a.completeness - b.completeness)
    .slice(0, 8);

  return (
    <div className="stat-card span-12 leaderboards">
      <div className="eyebrow">How communities compare</div>
      <h3 className="stat-q">Three quick lists. Tap any name to open the record.</h3>

      <div className="lb-grid">
        <div className="lb-col">
          <div className="lb-head">
            <span className="lb-rank">✓</span>
            <span className="lb-title">Most thoroughly documented</span>
          </div>
          {mostDocumented.map((c, i) => (
            <button key={c.id} className="lb-row" onClick={() => onSelect(c.id)}>
              <span className="lb-rank">{String(i+1).padStart(2,'0')}</span>
              <span className="lb-name">{c.name.trim()}</span>
              <span className="lb-pct">{Math.round(c.completeness * 100)}%</span>
            </button>
          ))}
        </div>

        <div className="lb-col">
          <div className="lb-head">
            <span className="lb-rank">☎</span>
            <span className="lb-title">Most direct contacts on file</span>
          </div>
          {mostStaffed.map((c, i) => (
            <button key={c.id} className="lb-row" onClick={() => onSelect(c.id)}>
              <span className="lb-rank">{String(i+1).padStart(2,'0')}</span>
              <span className="lb-name">{c.name.trim()}</span>
              <span className="lb-pct">{c.staff.length}</span>
            </button>
          ))}
        </div>

        <div className="lb-col">
          <div className="lb-head">
            <span className="lb-rank">!</span>
            <span className="lb-title">Most-needing-attention</span>
          </div>
          {leastDocumented.length === 0 ? (
            <div className="lb-empty">Every community has at least 40% of its record filled in. ✓</div>
          ) : leastDocumented.map((c, i) => (
            <button key={c.id} className="lb-row" onClick={() => onSelect(c.id)}>
              <span className="lb-rank">{String(i+1).padStart(2,'0')}</span>
              <span className="lb-name">{c.name.trim()}</span>
              <span className="lb-pct">{Math.round(c.completeness * 100)}%</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 5. Service-gap matrix — region × pillar  (clickable)
// ----------------------------------------------------------------------------
function ServiceGapMatrix({ all, onCellClick }) {
  const data = useMemo(() => {
    const REGIONS = ['Pilot','Algoma','East','South','West','North','Partner'];
    const rows = REGIONS.map(r => {
      const inR = all.filter(c => c.regionGroup === r);
      if (!inR.length) return null;
      return {
        region: r,
        total: inR.length,
        cells: PILLAR_KEYS.slice(0, 4).map(p => {
          const has = inR.filter(c => c[p.key]).length;
          return { pillar: p, count: has, pct: has / inR.length };
        }),
      };
    }).filter(Boolean);
    return rows;
  }, [all]);

  if (!data.length) return null;

  return (
    <div className="stat-card span-12">
      <div className="eyebrow">Service-gap matrix · region × pillar</div>
      <h3 className="stat-q">Where the gaps live, region by region.</h3>
      <p className="stat-explain">
        Each cell answers: "Of all the communities in this region, what share document this kind of programming?"
        Darker red = better coverage. Light cells are gaps. <strong>Click any cell</strong> to filter the map and directory to exactly that slice.
      </p>
      <div className="sgmatrix">
        <div className="sg-head">
          <div className="sg-corner"></div>
          {PILLAR_KEYS.slice(0,4).map(p => (
            <div key={p.key} className="sg-col-head">
              <span className="sg-dot" style={{background:p.hex}}></span>{p.short}
            </div>
          ))}
        </div>
        {data.map(row => (
          <div key={row.region} className="sg-row">
            <div className="sg-row-head">
              <div className="sg-region">{row.region}</div>
              <div className="sg-region-n">n={row.total}</div>
            </div>
            {row.cells.map(c => {
              const alpha = 0.10 + c.pct * 0.85;
              const fg = c.pct > 0.55 ? '#fbf6ec' : '#15110d';
              return (
                <button key={c.pillar.key} className="sg-cell"
                  onClick={() => onCellClick && onCellClick(row.region, c.pillar.key)}
                  style={{background: `rgba(184,53,30,${alpha})`, color: fg}}
                  title={`${c.count}/${row.total} ${row.region} records with ${c.pillar.label}`}>
                  <span className="sg-pct">{Math.round(c.pct * 100)}<span style={{fontSize:11}}>%</span></span>
                  <span className="sg-n">{c.count}/{row.total}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 6. Direction comparison — bars
// ----------------------------------------------------------------------------
function DirectionRadar({ all }) {
  const DIRS = ['East','South','West','North'];
  const dirColors = { East:'#d4a017', South:'#b8351e', West:'#3a5d8c', North:'#5a4f40' };

  const data = useMemo(() => DIRS.map(d => {
    const inDir = all.filter(c => c.orgType === 'Community' && c.direction === d);
    return {
      dir: d, n: inDir.length,
      pillars: PILLAR_KEYS.slice(0,4).map(p => ({
        pillar: p,
        pct: inDir.length ? inDir.filter(c => c[p.key]).length / inDir.length : 0,
        n: inDir.filter(c => c[p.key]).length,
        of: inDir.length,
      })),
    };
  }), [all]);

  return (
    <div className="stat-card span-12">
      <div className="eyebrow">How the four directions compare</div>
      <h3 className="stat-q">Each direction's strengths and gaps, side by side.</h3>
      <p className="stat-explain">
        Each row is one direction. The longer the bar, the higher the share of communities in that direction documenting that pillar.
        A balanced row = whole-person care; a single long bar = work to do on the other pillars.
      </p>
      <div className="dir-compare">
        {data.map(d => (
          <div key={d.dir} className="dc-row">
            <div className="dc-header">
              <span className="dc-name" style={{color: dirColors[d.dir]}}>{d.dir}</span>
              <span className="dc-n">{d.n} communit{d.n===1?'y':'ies'}</span>
            </div>
            <div className="dc-bars">
              {d.pillars.map(p => (
                <div key={p.pillar.key} className="dc-bar">
                  <div className="dc-bar-track">
                    <div className="dc-bar-fill" style={{width: (p.pct*100)+'%', background: p.pillar.hex}}>
                      {p.pct > 0.25 && <span className="dc-bar-pct">{Math.round(p.pct*100)}%</span>}
                    </div>
                  </div>
                  <div className="dc-bar-lab">{p.pillar.short}<span className="dc-bar-of">{p.n}/{p.of}</span></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 7. Population / scale of communities — histogram + cumulative
// ----------------------------------------------------------------------------
function PopScale({ all }) {
  const comms = all.filter(c => c.orgType === 'Community' && c.population != null && c.population > 0);
  const buckets = [
    { label:'Under 250',  test:n=>n<250 },
    { label:'250 – 750',  test:n=>n>=250 && n<750 },
    { label:'750 – 2,000',test:n=>n>=750 && n<2000 },
    { label:'2k – 5k',    test:n=>n>=2000 && n<5000 },
    { label:'5k – 10k',   test:n=>n>=5000 && n<10000 },
    { label:'10k+',       test:n=>n>=10000 },
  ];
  const data = buckets.map(b => ({
    ...b,
    count: comms.filter(c => b.test(c.population)).length,
    people: comms.filter(c => b.test(c.population)).reduce((s,c)=>s+c.population,0),
  }));
  const max = Math.max(1, ...data.map(d => d.count));
  const totalPop = comms.reduce((s,c)=>s+c.population,0);

  return (
    <div className="stat-card span-12">
      <div className="eyebrow">How big are the communities the atlas serves?</div>
      <h3 className="stat-q">Most are small. A few are large. Together they hold {totalPop.toLocaleString()} members.</h3>
      <p className="stat-explain">
        Atlas planning has to work for both ends of this spectrum. A 200-member community needs a very different outreach approach than a 10,000-member one.
      </p>
      <div className="popscale-grid">
        {data.map((b,i) => (
          <div key={i} className="ps-box">
            <div className="ps-bar-wrap">
              <div className="ps-bar" style={{height: (b.count/max * 120) + 'px'}}></div>
            </div>
            <div className="ps-box-count">{b.count}</div>
            <div className="ps-box-lab">{b.label}</div>
            <div className="ps-box-meta">{b.people.toLocaleString()} ppl</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 8. Contacts histogram (kept, but plain language)
// ----------------------------------------------------------------------------
function StaffHistogram({ all }) {
  const data = useMemo(() => {
    const buckets = [
      { label:'0',     test:n=>n===0 },
      { label:'1',     test:n=>n===1 },
      { label:'2-3',   test:n=>n>=2 && n<=3 },
      { label:'4-6',   test:n=>n>=4 && n<=6 },
      { label:'7-10',  test:n=>n>=7 && n<=10 },
      { label:'11+',   test:n=>n>=11 },
    ];
    return buckets.map(b => ({
      label: b.label,
      count: all.filter(c => b.test(c.staff?.length || 0)).length,
    }));
  }, [all]);

  const max = Math.max(...data.map(d => d.count));
  const sorted = all.map(c => c.staff?.length || 0).sort((a,b) => a-b);
  const median = sorted.length ? (sorted.length % 2 ? sorted[Math.floor(sorted.length/2)] : (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2) : 0;
  const noContact = data[0].count;

  return (
    <div className="stat-card span-12">
      <div className="eyebrow">How reachable is each community?</div>
      <h3 className="stat-q">{noContact > 0 ? <><strong>{noContact}</strong> records have no direct contact yet. The median is <strong>{median}</strong>.</> : <>Every record has at least one direct contact. ✓</>}</h3>
      <p className="stat-explain">
        A "contact" here means a person with at least a name plus phone or email parsed from the master sheet. Empty bars are the most useful target for outreach.
      </p>
      <div className="hist-row">
        {data.map(d => (
          <div key={d.label} className="hist-col">
            <div className="hist-track">
              <div className="hist-bar" style={{height: max ? (d.count/max * 100)+'%' : 0, opacity: 0.5 + (d.count/max)*0.5}}>
                <div className="hist-num">{d.count}</div>
              </div>
            </div>
            <div className="hist-lab">{d.label}</div>
          </div>
        ))}
      </div>
      <div className="hist-foot">number of contacts → ; bar height = how many records fall in that bucket</div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 9. AGM presentation mode (unchanged from v1)
// ----------------------------------------------------------------------------
function AGMPresentation({ all, onClose }) {
  const slides = useMemo(() => {
    const comms = all.filter(c => c.orgType === 'Community');
    const orgs = all.length - comms.length;
    const pop = all.reduce((s,c) => s + (c.population||0), 0);
    const allFour = comms.filter(c => c.hasPhysical && c.hasMental && c.hasSpiritual && c.hasEmotional).length;
    const youth = comms.filter(c => c.hasYouth).length;
    const survivor = comms.filter(c => c.hasSurvivors).length;
    const staff = all.reduce((s,c) => s + (c.staff?.length || 0), 0);
    const dirs = ['East','South','West','North'].map(d => ({
      dir: d, count: comms.filter(c => c.direction === d).length,
      pop: comms.filter(c => c.direction === d).reduce((s,c)=>s+(c.population||0),0),
    }));
    return [
      {
        theme: 'south',
        kicker: 'Mino Bimaadiziwin · Community Services Atlas',
        title: 'A snapshot, for this gathering.',
        sub: 'Every figure below is pulled live from the master sheet — nothing is estimated.',
        rows: [
          { lab: 'Communities documented', num: comms.length },
          { lab: 'Partner organizations', num: orgs },
          { lab: 'People served (estimated)', num: pop.toLocaleString() },
          { lab: 'Direct contacts on file', num: staff },
        ],
      },
      {
        theme: 'east',
        kicker: 'Whole-person care',
        title: 'All four pillars in place.',
        sub: `Communities that document physical, mental, spiritual, AND emotional programming.`,
        big: `${allFour}`,
        bigSub: `of ${comms.length} communities · ${Math.round(allFour/comms.length*100)}%`,
        rows: [
          { lab: 'Communities with youth programming', num: youth },
          { lab: 'Communities with survivor support', num: survivor },
          { lab: 'Programming both youth + survivors', num: comms.filter(c => c.hasYouth && c.hasSurvivors).length },
        ],
      },
      {
        theme: 'north',
        kicker: 'By the four directions',
        title: 'How the work is distributed.',
        sub: 'Each direction holds a season, a medicine, and a stage of life.',
        rows: dirs.map(d => ({
          lab: `${d.dir} · ${d.count} communities`,
          num: d.pop ? d.pop.toLocaleString() + ' ppl' : '—',
        })),
      },
      {
        theme: 'west',
        kicker: 'Miigwech',
        title: 'One living atlas.',
        sub: 'Every direction, every season, held together — and updated the moment the master sheet changes.',
      },
    ];
  }, [all]);

  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const s = slides[i];

  // keyboard nav
  useEffect(() => {
    function k(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === ' ') setI(x => Math.min(slides.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI(x => Math.max(0, x - 1));
    }
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [slides.length, onClose]);

  // auto-play through the deck, stop at the end
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      setI(x => { if (x >= slides.length - 1) { setPlaying(false); return x; } return x + 1; });
    }, 6000);
    return () => clearTimeout(t);
  }, [playing, i, slides.length]);

  // Muted, deeper tones — the bright versions were too loud for a presentation.
  const AGM_THEMES = {
    east:  { a: '#9c7619', b: '#6b5011', glyph: '✺' },
    south: { a: '#8f3320', b: '#5e2114', glyph: '☀' },
    west:  { a: '#3a4658', b: '#232c39', glyph: '☾' },
    north: { a: '#4f6b51', b: '#324a34', glyph: '❄' },
  };
  const th = AGM_THEMES[s.theme] || AGM_THEMES.south;

  return (
    <div className="agm-overlay" role="dialog" aria-label="AGM presentation mode"
         style={{ background: `radial-gradient(135% 135% at 82% 6%, ${th.a} 0%, ${th.b} 38%, #100b08 104%)` }}>
      <div className="agm-glyph" aria-hidden="true">{th.glyph}</div>
      <div className="agm-slide" key={i}>
        <div className="agm-kicker">{s.kicker}</div>
        <h1 className="agm-title">{s.title}</h1>
        <p className="agm-sub">{s.sub}</p>
        {s.big && (
          <div className="agm-big">
            <div className="agm-big-num">{s.big}</div>
            {s.bigSub && <div className="agm-big-sub">{s.bigSub}</div>}
          </div>
        )}
        {s.rows && (
          <div className="agm-rows">
            {s.rows.map((r, ii) => (
              <div key={ii} className="agm-row">
                <span className="agm-row-lab">{r.lab}</span>
                <span className="agm-row-num">{typeof r.num === 'number' ? r.num.toLocaleString() : r.num}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="agm-foot">
        <button className="agm-btn" onClick={() => setI(i => Math.max(0, i-1))} disabled={i===0}>← Previous</button>
        <button className="agm-btn agm-play" onClick={() => setPlaying(p => !p)}
                title={playing ? 'Pause auto-play' : 'Play hands-free'}>
          {playing ? '⏸ Pause' : '▶ Auto-play'}
        </button>
        <div className="agm-dots">
          {slides.map((_, ii) => (
            <button key={ii} className={`agm-dot ${ii===i?'on':''}`} onClick={()=>setI(ii)} aria-label={`Slide ${ii+1}`}></button>
          ))}
        </div>
        <button className="agm-btn" onClick={() => setI(i => Math.min(slides.length-1, i+1))} disabled={i===slides.length-1}>Next →</button>
        <button className="agm-x" onClick={onClose} title="Exit (Esc)">✕ Exit</button>
      </div>
    </div>
  );
}

window.PlainSnapshot = PlainSnapshot;
window.PillarCoverage = PillarCoverage;
window.AttentionList = AttentionList;
window.Leaderboards = Leaderboards;
window.ServiceGapMatrix = ServiceGapMatrix;
window.DirectionRadar = DirectionRadar;
window.PopScale = PopScale;
window.StaffHistogram = StaffHistogram;
window.AGMPresentation = AGMPresentation;
// keep stub for any old references
window.PopVsDocScatter = () => null;
