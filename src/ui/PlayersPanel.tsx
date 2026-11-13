import type { Token } from '@/vtt/scene/SceneTypes';
import type { PlayerInfo } from '@/vtt/network/protocol';

type Props = {
  /** Everyone the host reports as connected. May include this browser (a joined GM). */
  players: PlayerInfo[];
  selfId: string;
  tokens: readonly Token[];
};

/** A player has no name of their own, so call them by the token they own, else by the start of their id. */
function displayName(id: string, owned: Token[]): string {
  return owned.find((t) => t.name?.trim())?.name?.trim() ?? `Player ${id.slice(0, 4)}`;
}

export default function PlayersPanel({ players, selfId, tokens }: Props) {
  const others = players.filter((p) => p.id !== selfId);
  const online = others.length + 1;

  return (
    <section className="panel players-panel" aria-label="Players">
      <div className="players-head">
        <span className="label">Players</span>
        <span className="panel-sub">{online} online</span>
      </div>

      <div className="player-row">
        <span className="avatar is-gm" aria-hidden="true">G</span>
        <div className="player-info">
          <div className="player-name">You</div>
          <div className="player-meta">GM · {selfId}</div>
        </div>
        <i className="dot dot-on" title="Online" />
      </div>

      {others.map((p) => {
        const owned = tokens.filter((t) => t.ownerId === p.id);
        const name = displayName(p.id, owned);
        return (
          <div className="player-row" key={p.id}>
            <span className={`avatar${p.isGM ? ' is-gm' : ''}`} aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
            <div className="player-info">
              <div className="player-name">{name}</div>
              <div className="player-meta">
                {p.id} · {p.isGM ? 'GM' : owned.length === 0 ? 'no token yet' : `owns ${owned.length} ${owned.length === 1 ? 'token' : 'tokens'}`}
              </div>
            </div>
            <i className="dot dot-on" title="Online" />
          </div>
        );
      })}

      {others.length === 0 && (
        <p className="panel-sub">Nobody else is here yet. Copy the player link and send it to your table.</p>
      )}
    </section>
  );
}

/** Player view: your own token, so you always know which one is yours. */
export function MeCard({ selfId, tokens }: { selfId: string; tokens: readonly Token[] }) {
  const mine = tokens.filter((t) => t.ownerId === selfId);
  const first = mine[0];
  const name = first?.name?.trim() || (first ? 'Your token' : 'No token yet');
  return (
    <section className="panel me-card" aria-label="Your token">
      <span className="me-avatar" aria-hidden="true">{first ? name.charAt(0).toUpperCase() : '?'}</span>
      <div>
        <div className="me-name">{name}</div>
        <div className="me-hint">
          {first ? 'Drag your token to move it' : <>Ask the GM to give you one. Your ID is <b>{selfId}</b></>}
        </div>
      </div>
    </section>
  );
}
