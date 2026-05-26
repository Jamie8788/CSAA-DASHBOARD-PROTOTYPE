/* global React, dirHex, DIRECTION, PILLARS, NA, autoLink, pillarOn, highlight */
const { useState, useEffect } = React;

function CommunityCard({ c, onClick, hovered, selected, onHover, compact, searchQuery, isPinned, onTogglePin }) {
  const hex = window.dirHex(c);
  const dir = c.direction || 'AllDirections';
  const onPillars = PILLARS.filter(p => pillarOn(c, p.key));
  const dirInfo = DIRECTION[dir];

  if (compact) {
    return (
      <article className={`card compact ${selected?'selected':''}`} onClick={onClick}
        onMouseEnter={() => onHover(c.id)} onMouseLeave={() => onHover(null)}
        style={{'--region-color': hex}}>
        <div className="card-header">
          <div className={`card-mark m${c.motif||0}`} style={{
            background: dir === 'North' ? '#fbf6ec' : hex,
            color: dir === 'North' ? '#1a1612' : 'var(--paper)',
            border: dir === 'North' ? '1px solid #8a7c66' : 'none',
          }}>
            <span>{c.mark}</span>
          </div>
          <div className="card-title-block">
            <h3 className="card-name">{searchQuery ? highlight(c.name.trim(), searchQuery) : c.name.trim()}</h3>
            <div className="card-meta">
              <span className="region" style={{color:hex}}>{dirInfo.label.split(' · ')[0]}</span>
              <span className="sep">·</span>
              <span>{c.regionGroup}</span>
              {c.population && <><span className="sep">·</span><span>{c.population.toLocaleString()} ppl</span></>}
              {c.orgType !== 'Community' && <><span className="sep">·</span><span>{c.orgType}</span></>}
            </div>
          </div>
          <div style={{display:'flex', gap:6, alignItems:'center'}}>
            {onPillars.map(p => (
              <span key={p.key} title={p.label} style={{width:6, height:6, borderRadius:'50%', background:p.hex}}></span>
            ))}
            <button className={`compare-pin ${isPinned?'on':''}`} onClick={(e) => { e.stopPropagation(); onTogglePin(c.id); }} title={isPinned?'Remove from compare':'Pin to compare'}
              style={{position:'static', marginLeft:8}}>
              {isPinned ? '✓' : '⊕'}
            </button>
          </div>
        </div>
      </article>
    );
  }

  const circ = 2 * Math.PI * 12;
  const dash = c.completeness * circ;

  return (
    <article className={`card ${selected?'selected':''}`} onClick={onClick}
      onMouseEnter={() => onHover(c.id)} onMouseLeave={() => onHover(null)}
      style={{'--region-color': hex}}>
      <button className={`compare-pin ${isPinned?'on':''}`} onClick={(e) => { e.stopPropagation(); onTogglePin(c.id); }} title={isPinned?'Remove from compare':'Pin to compare'}>
        {isPinned ? '✓' : '⊕'}
      </button>
      <div className="card-header">
        <div className={`card-mark m${c.motif||0}`} style={{
          background: dir === 'North' ? '#fbf6ec' : hex,
          color: dir === 'North' ? '#1a1612' : 'var(--paper)',
          border: dir === 'North' ? '1px solid #8a7c66' : 'none',
        }}>
          <span>{c.mark}</span>
        </div>
        <div className="card-title-block">
          <h3 className="card-name">{searchQuery ? highlight(c.name.trim(), searchQuery) : c.name.trim()}</h3>
          <div className="card-meta">
            <span style={{color:hex, fontWeight:500}}>{dirInfo.label.split(' · ')[0]}</span>
            <span className="sep">·</span>
            <span style={{color:'var(--ink-3)'}}>{c.regionGroup}</span>
            {c.orgType !== 'Community' && <><span className="sep">·</span><span>{c.orgType}</span></>}
          </div>
        </div>
      </div>
      <div className="card-body">
        <div className="card-pillars">
          {PILLARS.map(p => {
            const on = pillarOn(c, p.key);
            return (
              <div key={p.key} className={`pillar-chip ${p.key} ${on?'on':''}`}>
                <span style={{opacity: on?1:0.3}}>{p.icon}</span>
                <span>{p.label.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>
        <div className="card-tags">
          {c.hasYouth && <span className="tag youth">◇ Youth</span>}
          {c.hasSurvivors && <span className="tag survivor">◇ Survivors</span>}
          {c.staff && c.staff.length > 0 && <span className="tag contacts">☏ {c.staff.length} contact{c.staff.length>1?'s':''}</span>}
          {c.website && <span className="tag">↗ Website</span>}
          {c.hasStrategic && <span className="tag">▤ Strategic plan</span>}
        </div>
      </div>
      <div className="card-footer">
        <div className="card-pop">
          {c.population != null
            ? <><span className="v">{c.population.toLocaleString()}</span>people</>
            : <span style={{opacity:.55}}>Pop. not on file</span>}
        </div>
        <div className="completeness-ring" title={`${Math.round(c.completeness*100)}% documented`}>
          <svg viewBox="0 0 28 28">
            <circle className="track" cx="14" cy="14" r="12" fill="none" strokeWidth="2.5" />
            <circle className="arc" cx="14" cy="14" r="12" fill="none" strokeWidth="2.5"
              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
          </svg>
          <div className="label">{Math.round(c.completeness*100)}</div>
        </div>
      </div>
    </article>
  );
}

window.CommunityCard = CommunityCard;
