/* global React */
// ============================================================================
// WelcomeView — the friendly landing page users see first (instead of the map).
// Explains what the atlas is, shows live headline numbers, offers big "quick
// action" cards to every part of the dashboard, and a short how-to. Built to
// be calm and accessible: large type, big tap targets, motion that respects
// the reduce-motion setting.
// ============================================================================
const { useState: useS_w, useEffect: useE_w, useMemo: useM_w } = React;

function WelcomeView({ all, setView, heroCtx }) {
  const data = useM_w(() => {
    const list = Array.isArray(all) ? all : [];
    const comms = list.filter((c) => c.orgType === 'Community');
    return {
      communities: comms.length,
      orgs: list.length - comms.length,
      people: list.reduce((s, c) => s + (c.population || 0), 0),
      allFour: comms.filter((c) => c.hasPhysical && c.hasMental && c.hasSpiritual && c.hasEmotional).length,
    };
  }, [all]);

  const nComm = window.useCountUp(data.communities, 1500);
  const nOrg = window.useCountUp(data.orgs, 1500);
  const nPeople = window.useCountUp(data.people, 1800);

  const actions = [
    { view: 'map',       icon: '◉', title: 'Explore the Map',
      body: 'See every community and partner across the territory. Click any marker to open its full record.' },
    { view: 'list',      icon: '☷', title: 'Browse the Directory',
      body: 'A searchable list of all communities and organizations. Filter by region, services, or population.' },
    { view: 'story',     icon: '✦', title: 'Take the Guided Journey',
      body: 'A scrolling Story Map that walks you through the four directions, season by season.' },
    { view: 'stories',   icon: '❋', title: 'Stories & Games',
      body: 'Calm games and real quotes — learn the atlas by playing. Made for everyone, including Elders.' },
    { view: 'analytics', icon: '◐', title: 'See the Analytics',
      body: 'Honest, live numbers: service coverage, gaps still being gathered, and partner organizations.' },
    { view: 'coverage',  icon: '⌧', title: 'Coverage of the 85',
      body: 'Track every one of the 85 communities the project set out to document.' },
  ];

  const steps = [
    { n: '1', t: 'Pick where to start', d: 'Use the tabs at the top, or any of the cards below.' },
    { n: '2', t: 'Open a community', d: 'Click a map marker or a directory card to see everything on file — services, contacts, links.' },
    { n: '3', t: 'Adjust for comfort', d: 'The “Accessibility” button (top right) makes text larger, raises contrast, or pauses motion.' },
  ];

  return (
    <section className="welcome">
      <div className="welcome-hero">
        <div className="welcome-aura" aria-hidden="true"></div>
        <div className="welcome-hero-inner">
          <p className="welcome-eyebrow">Mino Bimaadiziwin · The Good Life</p>
          <h1 className="welcome-title">A living atlas of<br /><em>community care.</em></h1>
          <p className="welcome-lead">
            One place to find the physical, mental, spiritual, and emotional health
            programming across First Nations communities and partner organizations —
            in each community’s own words, kept current as the work grows.
          </p>
          <div className="welcome-stats">
            <div className="welcome-stat"><div className="ws-num">{nComm}</div><div className="ws-lab">Communities</div></div>
            <div className="welcome-stat"><div className="ws-num">{nOrg}</div><div className="ws-lab">Partner organizations</div></div>
            <div className="welcome-stat"><div className="ws-num">{nPeople.toLocaleString()}</div><div className="ws-lab">People served</div></div>
          </div>
          <div className="welcome-cta-row">
            <button className="welcome-cta" onClick={() => setView('map')}>◉ Explore the map</button>
            <button className="welcome-cta ghost" onClick={() => setView('story')}>✦ Take the guided journey</button>
          </div>
        </div>
      </div>

      <div className="welcome-section">
        <h2 className="welcome-h2">Where would you like to begin?</h2>
        <div className="welcome-actions">
          {actions.map((a, i) => (
            <button key={a.view} className="welcome-action" style={{ animationDelay: (0.06 * i) + 's' }}
                    onClick={() => setView(a.view)}>
              <span className="wa-icon" aria-hidden="true">{a.icon}</span>
              <span className="wa-title">{a.title}</span>
              <span className="wa-body">{a.body}</span>
              <span className="wa-go" aria-hidden="true">Open →</span>
            </button>
          ))}
        </div>
      </div>

      <div className="welcome-section welcome-howto">
        <h2 className="welcome-h2">How to find your way around</h2>
        <div className="welcome-steps">
          {steps.map((s) => (
            <div key={s.n} className="welcome-step">
              <div className="ws-n">{s.n}</div>
              <div className="ws-text"><div className="ws-t">{s.t}</div><div className="ws-d">{s.d}</div></div>
            </div>
          ))}
        </div>
        <p className="welcome-foot">
          Every figure and quote on this dashboard is pulled live from the project’s master sheet —
          nothing is invented. Honouring the original peoples of these lands.
        </p>
      </div>
    </section>
  );
}
window.WelcomeView = WelcomeView;
