import { Link, useNavigate } from 'react-router-dom';
import { Crown, DoorClosed, Eye, Flame, Link as LinkIcon, MousePointer2 } from 'lucide-react';

const STEPS = [
  { t: 'Paint floor', d: 'Drag across the grid to lay down rooms.' },
  { t: 'Draw walls', d: 'They snap to the grid and block sight and movement.' },
  { t: 'Hang doors', d: 'Open or closed, they change what players can see.' },
  { t: 'Light it', d: 'Coloured lights that walls and doors cut off.' },
  { t: 'Place tokens, play', d: 'Players see only what their token sees.' },
];

const FEATURES = [
  { icon: Eye, t: 'Each player sees their own view', d: "A player is only sent the part of the map their token has seen. Rooms they haven't found stay off their screen, not just hidden behind fog." },
  { icon: DoorClosed, t: 'Doors, windows and secret doors', d: 'Slide a door along its wall, lock it, or hide it entirely. Windows let light and sight through but still stop a token.' },
  { icon: Flame, t: 'Day, night and torchlight', d: 'Set the ambient light for the whole map, then place coloured lights that spill through open doors and stop at walls.' },
  { icon: LinkIcon, t: 'Share a link, start playing', d: "Rooms run peer to peer in the browser. There is no server to rent and no account to make. The GM's tab hosts the game." },
  { icon: Crown, t: 'Tokens only move where they can walk', d: 'Players move their own tokens. Walls and closed doors stop them, and the host checks every move so nobody can cheat through a wall.' },
  { icon: MousePointer2, t: 'Edit while you play', d: 'Move a wall or add a torch mid-session. Everything updates for every player at once, and Ctrl+Z undoes it.' },
];

/** A small, hand-drawn sample map: the same look as the real game, with no image to download. */
function HeroMap() {
  return (
    <svg viewBox="0 0 560 470" role="img" aria-label="A small dungeon map with a lit room, a closed door and a token whose vision is cut off by walls">
      <defs>
        <pattern id="lp-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#1E293B" strokeWidth="1" /></pattern>
        <radialGradient id="lp-torch" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#FBBF24" stopOpacity=".5" /><stop offset=".55" stopColor="#FBBF24" stopOpacity=".16" /><stop offset="1" stopColor="#FBBF24" stopOpacity="0" /></radialGradient>
        <radialGradient id="lp-vis" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#2DD4BF" stopOpacity=".22" /><stop offset="1" stopColor="#2DD4BF" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="560" height="470" fill="#0B1120" />
      <rect width="560" height="470" fill="url(#lp-grid)" />
      <g fill="#1E293B"><rect x="60" y="80" width="240" height="200" /><rect x="300" y="160" width="120" height="40" /><rect x="400" y="100" width="120" height="200" /><rect x="130" y="280" width="80" height="120" /></g>
      <rect x="400" y="100" width="120" height="200" fill="#0B1120" opacity=".55" />
      <circle cx="110" cy="130" r="120" fill="url(#lp-torch)" />
      <path d="M200 190 L300 120 L300 160 L420 160 L420 200 L300 200 L300 250 L290 280 L120 280 L70 230 Z" fill="url(#lp-vis)" />
      <g stroke="#FFFFFF" strokeWidth="5" strokeLinecap="square" fill="none">
        <path d="M60 80H300V160M300 200V280H210M130 280H60V80" />
        <path d="M300 160H420V100H520V300H420V200H300" />
        <path d="M130 280V400H210V280" />
      </g>
      <rect x="296" y="160" width="8" height="40" fill="#0F172A" stroke="#2DD4BF" strokeWidth="1.5" />
      <circle cx="110" cy="130" r="6" fill="#FBBF24" /><circle cx="110" cy="130" r="10" fill="none" stroke="#FBBF24" strokeOpacity=".6" />
      <circle cx="200" cy="190" r="17" fill="#2DD4BF" stroke="#0F172A" strokeWidth="3" />
      <text x="200" y="196" textAnchor="middle" fontFamily="Cormorant Garamond,serif" fontWeight="700" fontSize="18" fill="#0F172A">R</text>
      <circle cx="262" cy="232" r="15" fill="#CBD5E1" stroke="#0F172A" strokeWidth="3" />
      <text x="262" y="238" textAnchor="middle" fontFamily="Cormorant Garamond,serif" fontWeight="700" fontSize="16" fill="#0F172A">M</text>
      <text x="200" y="224" textAnchor="middle" fontFamily="Inter,sans-serif" fontSize="11" fontWeight="600" fill="#FFFFFF">Rowan</text>
    </svg>
  );
}

export default function Home() {
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    // A short random room id; the creator opens it as GM.
    const roomId = Math.random().toString(36).substring(2, 9);
    navigate(`/room/${roomId}?role=gm`);
  };

  return (
    <div className="lp">
      <header className="lp-wrap lp-head">
        <Link className="lp-brand" to="/" aria-label="APOA VTT Maker home">
          <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><rect x="2" y="2" width="30" height="30" rx="7" fill="#1E293B" stroke="#2DD4BF" strokeWidth="1.6" /><path d="M11 24V10l5 8 5-8v14" fill="none" stroke="#2DD4BF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>APOA VTT Maker</span>
        </Link>
        <nav className="lp-nav">
          <a className="lp-nav-link" href="#how">How it works</a>
          <a className="lp-nav-link" href="#features">Features</a>
          <button type="button" className="lp-btn lp-btn-ghost lp-btn-sm" onClick={handleCreateRoom}>Open a room</button>
        </nav>
      </header>

      <main>
        <section className="lp-wrap lp-row lp-hero">
          <div className="lp-hero-copy">
            <div className="lp-eyebrow">Virtual tabletop · prototype</div>
            <h1 className="display lp-h1">Your map is an interactive game.</h1>
            <p className="lp-lead">Draw a wall and it blocks sight. Hang a door and it opens. Light a torch and the dark pulls back. Build the dungeon and run it in the same place, with no export step in between.</p>
            <div className="lp-cta-row">
              <button type="button" className="lp-btn lp-btn-primary" onClick={handleCreateRoom}>
                <Flame size={22} strokeWidth={1.7} aria-hidden="true" />
                Create a room
              </button>
              <a className="lp-btn lp-btn-ghost" href="#how">See how it works</a>
            </div>
            <p className="lp-note">No account. Players join with a link, straight from your browser.</p>
          </div>
          <div className="lp-hero-art">
            <div className="lp-map-frame"><HeroMap /></div>
            <div className="lp-chips">
              <span className="lp-chip">Closed door blocks sight</span>
              <span className="lp-chip">Explored rooms are remembered</span>
            </div>
          </div>
        </section>

        <section id="how" className="lp-band">
          <div className="lp-wrap">
            <div className="lp-eyebrow">One tool, one flow</div>
            <h2 className="display lp-h2">Build it, light it, play it. No export in between.</h2>
            <p className="lp-sub">Other tools make you draw a map, export a picture, then redraw every wall and door in a second app. Here the map is the game.</p>
            <ol className="lp-steps">
              {STEPS.map((s, i) => (
                <li key={s.t} className={`lp-card lp-step${i === STEPS.length - 1 ? ' is-last' : ''}`}>
                  <div className="lp-step-n">{String(i + 1).padStart(2, '0')}</div>
                  <div className="lp-step-t">{s.t}</div>
                  <p className="lp-step-d">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="lp-wrap lp-features">
          <div className="lp-eyebrow">Made for the table</div>
          <h2 className="display lp-h2">The GM decides. The map expresses it.</h2>
          <div className="lp-grid">
            {FEATURES.map(({ icon: Icon, t, d }) => (
              <article key={t} className="lp-card lp-feature">
                <Icon strokeWidth={1.6} aria-hidden="true" />
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-wrap lp-final">
          <div className="lp-final-card">
            <h2 className="display">Pull up a chair.</h2>
            <p>Make a room, copy the player link, and send it to your table.</p>
            <button type="button" className="lp-btn lp-btn-primary" onClick={handleCreateRoom}>Create a room</button>
          </div>
        </section>
      </main>

      <footer className="lp-wrap lp-foot">
        <span>APOA VTT Maker · prototype v{__APP_VERSION__}</span>
        <span>Runs in your browser. Nothing is stored on a server.</span>
      </footer>
    </div>
  );
}
