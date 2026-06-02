/* global React, regionHex, PILLARS, POP_BUCKETS, popBucket, pillarOn, NA, useCountUp */
const { useState, useMemo, useEffect, useRef } = React;

function StatsView({ all, onSelect, setView, setRegions, setOrgTypes, setPillars }) {
  const [agmOpen, setAgmOpen] = useState(false);
  useEffect(() => {
    if (!agmOpen) return;
    function onKey(e) { if (e.key === 'Escape') setAgmOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [agmOpen]);

  // Compute lots of stats
  const totalCommunities = all.filter(c => c.orgType === 'Community').length;
  const totalOrgs = all.length - totalCommunities;
  const totalPop = all.reduce((s,c)=> s + (c.population||0), 0);
  const totalStaff = all.reduce((s,c)=> s + (c.staff?.length || 0), 0);

  const popCommunities = useCountUp(totalCommunities);
  const popOrgs = useCountUp(totalOrgs);
  const popPeople = useCountUp(Math.round(totalPop/1000));
  const popStaff = useCountUp(totalStaff);

  // Region distribution
  const regionDist = REGION_KEYS_LOCAL.map(r => ({
    name: r,
    count: all.filter(c => c.regionGroup === r).length,
    color: window.REGION_HEX[r] || '#5a4f40',
  })).filter(r => r.count > 0).sort((a,b) => b.count - a.count);
  const maxRegion = Math.max(...regionDist.map(r => r.count));

  // Pillar coverage
  const pillarCov = PILLARS.map(p => {
    const has = all.filter(c => c.orgType === 'Community' && pillarOn(c, p.key)).length;
    return { ...p, count: has, pct: has / totalCommunities };
  });

  // Population buckets
  const popDist = POP_BUCKETS.map(b => ({
    ...b,
    count: all.filter(c => b.test(c.population)).length,
  }));

  // Featured: most-documented communities
  const featured = [...all]
    .filter(c => c.orgType === 'Community' && c.completeness >= 0.85)
    .slice(0, 6);

  // Largest communities
  const largest = [...all]
    .filter(c => c.population && c.orgType === 'Community')
    .sort((a,b) => b.population - a.population)
    .slice(0, 8);

  // Communities with strongest youth + survivor support
  const wholeSupport = all.filter(c => c.hasYouth && c.hasSurvivors && c.orgType === 'Community');

  // Per-direction stories
  const directionStories = ['East','South','West','North'].map(dir => {
    const inDir = all.filter(c => c.direction === dir);
    const communities = inDir.filter(c => c.orgType === 'Community');
    const totalPpl = communities.reduce((s,c) => s + (c.population||0), 0);
    const pillarCounts = ['physical','mental','spiritual','emotional'].map(k => ({
      key: k, count: communities.filter(c => pillarOn(c, k)).length
    }));
    const topPillar = pillarCounts.sort((a,b) => b.count - a.count)[0];
    const quoteSource = communities.find(c => c.physical && c.physical.length > 60 && c.physical.length < 220)
      || communities.find(c => c.spiritual && c.spiritual.length > 60 && c.spiritual.length < 220)
      || communities.find(c => c.youth && c.youth.length > 60 && c.youth.length < 220);
    const quote = quoteSource ? (quoteSource.physical || quoteSource.spiritual || quoteSource.youth) : 'Programs span land-based, cultural, and intergenerational care.';
    const meta = window.DIRECTION ? window.DIRECTION[dir] : { color:'#000', label:dir, season:'', medicine:'' };
    return {
      dir, color: meta.color, season: meta.season,
      label: dir,
      communities: communities.length,
      orgs: inDir.length - communities.length,
      totalPpl, topPillar,
      quote: quote.length > 200 ? quote.slice(0, 200) + '…' : quote,
      sourceName: quoteSource ? quoteSource.name : '',
    };
  });

  return (
    <div style={{ background: 'var(--paper)' }}>
      {agmOpen && <window.AGMPresentation all={all} view="stats" onClose={() => setAgmOpen(false)} />}
      <div className="stats-grid">
        <div className="stat-card span-12" style={{padding:0, background:'var(--paper-2)', position:'relative'}}>
          <button className="agm-launch"
            onClick={() => setAgmOpen(true)}
            title="Open a fullscreen presentation snapshot — ideal for AGMs">
            ⛶ Open AGM presentation mode
          </button>
          <div style={{padding:'30px 30px 14px'}}>
            <div className="eyebrow">Four Directions</div>
            <h3 style={{fontFamily:'var(--serif)', fontSize:30, fontStyle:'italic', fontWeight:400, margin:'6px 0 4px', letterSpacing:'-0.01em'}}>The work, told four ways</h3>
            <p style={{fontFamily:'var(--serif)', fontSize:14, color:'var(--ink-3)', maxWidth:640, lineHeight:1.55, margin:0}}>
              The atlas groups communities into four directional regions, each holding a season. The numbers below are drawn directly from the master sheet — no estimates.
            </p>
          </div>
          <div className="dir-story-grid">
            {directionStories.map(s => (
              <div key={s.dir} className="dir-story" style={{'--story-color': s.color}}
                onClick={() => { setRegions(new Set()); window.scrollTo({top:0,behavior:'smooth'}); setView('map'); }}>
                <div className="dir-story-name">{s.label}</div>
                <div className="dir-story-eng">{s.season}</div>
                <div className="dir-story-stats">
                  <div className="dir-story-row"><span className="lab">Communities</span><span className="num">{s.communities}</span></div>
                  <div className="dir-story-row"><span className="lab">Partner orgs</span><span className="num">{s.orgs}</span></div>
                  <div className="dir-story-row"><span className="lab">People served</span><span className="num" style={{fontSize:18}}>{s.totalPpl ? s.totalPpl.toLocaleString() : '—'}</span></div>
                  <div className="dir-story-row"><span className="lab">{s.topPillar.key} care</span><span className="num" style={{fontSize:18}}>{s.topPillar.count} / {s.communities}</span></div>
                </div>
                <div className="dir-story-quote">{s.quote}
                  {s.sourceName && <div style={{fontFamily:'var(--mono)', fontSize:9.5, marginTop:8, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--ink-4)'}}>— {s.sourceName}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Big number cards */}
        <div className="stat-card span-3">
          <div className="eyebrow">Communities mapped</div>
          <div className="big clay">{popCommunities}</div>
          <div className="desc">First Nations across Canada documented in this atlas.</div>
        </div>
        <div className="stat-card span-3">
          <div className="eyebrow">Partner organizations</div>
          <div className="big">{popOrgs}</div>
          <div className="desc">Health authorities, friendship centres, councils, and CFS agencies.</div>
        </div>
        <div className="stat-card span-3">
          <div className="eyebrow">People served, est.</div>
          <div className="big forest">{popPeople}<span style={{fontSize:30, fontStyle:'normal', color:'var(--ink-3)'}}>k</span></div>
          <div className="desc">Total population across documented communities.</div>
        </div>
        <div className="stat-card span-3">
          <div className="eyebrow">Staff contacts</div>
          <div className="big">{popStaff}</div>
          <div className="desc">Direct phone, email, and role records on file.</div>
        </div>

        {/* === Plain-language analytics (community-readable) === */}
        <window.PlainSnapshot all={all} />
        <window.PillarCoverage all={all} />
        <window.AttentionList all={all} onSelect={onSelect} />
        <window.Leaderboards all={all} onSelect={onSelect} />
        <window.ServiceGapMatrix all={all} onCellClick={(region, pillar) => {
          setRegions(new Set([region]));
          setPillars(new Set([pillar]));
          setView('map');
        }} />
        <window.DirectionRadar all={all} />
        <window.PopScale all={all} />
        <window.StaffHistogram all={all} />

        {/* Region distribution */}
        <div className="stat-card span-6">
          <div className="eyebrow">By region</div>
          <h3 style={{fontFamily:'var(--serif)', fontSize:24, margin:'4px 0 14px', fontWeight:500}}>
            Where the work is happening
          </h3>
          <div>
            {regionDist.map(r => (
              <div key={r.name} className="bar-row" onClick={() => { setRegions(new Set([r.name])); setView('map'); }} style={{cursor:'pointer'}}>
                <div className="bar-label">{r.name}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: (r.count/maxRegion*100)+'%', background: r.color }}></div>
                </div>
                <div className="bar-num">{r.count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Whole-person care strip */}
        <div className="stat-card span-6">
          <div className="eyebrow">Whole-person care</div>
          <h3 style={{fontFamily:'var(--serif)', fontSize:22, margin:'4px 0 14px', fontWeight:500}}>
            Communities supporting both <em style={{color:'var(--clay)'}}>survivors</em> and <em style={{color:'var(--forest)'}}>youth</em>
          </h3>
          <p style={{fontFamily:'var(--serif)', fontSize:15, color:'var(--ink-2)', lineHeight:1.5, margin:'0 0 14px'}}>
            <strong style={{fontWeight:500}}>{wholeSupport.length}</strong> communities document programming for both residential school survivors and youth — connecting generations through ceremony, language, and land.
          </p>
          <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
            {wholeSupport.slice(0, 30).map(c => (
              <button key={c.id}
                onClick={() => onSelect(c.id)}
                style={{
                  fontFamily:'var(--mono)', fontSize:10, padding:'4px 9px',
                  border:'1px solid var(--line)', background:'var(--paper-card)',
                  color:'var(--ink-2)', textTransform:'uppercase', letterSpacing:'.1em',
                  borderRadius:999, cursor:'pointer'
                }}>
                {c.name.trim().split(/\s/).slice(0,3).join(' ')}
              </button>
            ))}
            {wholeSupport.length > 30 && <span style={{fontSize:11, color:'var(--ink-3)', alignSelf:'center'}}>+{wholeSupport.length - 30} more</span>}
          </div>
        </div>

        {/* Largest */}
        <div className="stat-card span-12">
          <div className="eyebrow">Largest communities by population</div>
          <h3 style={{fontFamily:'var(--serif)', fontSize:22, margin:'4px 0 14px', fontWeight:500}}>
            Where the people are
          </h3>
          <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'4px 32px'}}>
          {largest.map((c, i) => {
            const max = largest[0].population;
            return (
              <div key={c.id} onClick={() => onSelect(c.id)}
                style={{cursor:'pointer', display:'grid', gridTemplateColumns:'24px 1fr auto', gap:12, alignItems:'center', padding:'8px 0', borderBottom: '1px dashed var(--line)'}}>
                <div style={{fontFamily:'var(--mono)', fontSize:10, color:'var(--ink-4)'}}>{String(i+1).padStart(2,'0')}</div>
                <div>
                  <div style={{fontFamily:'var(--serif)', fontSize:15, color:'var(--ink)', lineHeight:1.2}}>{c.name.trim()}</div>
                  <div style={{position:'relative', height:4, background:'var(--paper-2)', marginTop:6, borderRadius:2}}>
                    <div style={{position:'absolute', inset:'0 auto 0 0', width: (c.population/max*100)+'%', background: regionHex(c), borderRadius:2}}></div>
                  </div>
                </div>
                <div style={{fontFamily:'var(--serif)', fontStyle:'italic', fontSize:18, color:'var(--ink)'}}>{c.population.toLocaleString()}</div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}

const REGION_KEYS_LOCAL = ['Pilot','Algoma District','East','South','West','North'];

window.StatsView = StatsView;
