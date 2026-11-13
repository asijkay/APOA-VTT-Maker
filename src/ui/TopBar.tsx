import { useEffect, useRef, useState } from 'react';
import { Check, Crown, Ellipsis, Link as LinkIcon } from 'lucide-react';

export type StatusLevel = 'on' | 'warn' | 'off';

/** Turns the NetworkService status string into one pill: a colour and a few words. */
export function describeStatus(status: string, playerCount: number): { level: StatusLevel; text: string } {
  if (/^Host/.test(status)) return { level: 'on', text: `Host · ${playerCount} ${playerCount === 1 ? 'player' : 'players'}` };
  if (/^Connected/.test(status)) return { level: 'on', text: 'Connected to the GM' };
  if (/^Waiting for the GM/.test(status)) return { level: 'warn', text: 'Waiting for the GM' };
  if (/Retrying|Lost contact|Room exists|Initializing|Signalling|Host not found|Could not reach/.test(status)) {
    return { level: 'warn', text: /^Initializing/.test(status) ? 'Connecting…' : 'Reconnecting…' };
  }
  return { level: 'off', text: 'Offline' };
}

type Props = {
  roomId: string;
  status: string;
  playerCount: number;
  /** This browser holds the GM key (it can switch views, copy the GM link, edit). */
  canGM: boolean;
  viewMode: 'gm' | 'player';
  onViewMode: (mode: 'gm' | 'player') => void;
  /** Present only for the GM; undefined hides the GM link. */
  gmLink?: () => string;
  playerLink: () => string;
  identityId: string;
  version: string;

  onSave: () => void;
  onLoad: () => void;
  onClear: () => void;
  onDemo: (n: 1 | 2) => void;
  snapTokens: boolean;
  onSnapTokens: (v: boolean) => void;
  debugVision: boolean;
  onDebugVision: (v: boolean) => void;
  debugCollision: boolean;
  onDebugCollision: (v: boolean) => void;
};

function useCopied() {
  const [which, setWhich] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setWhich(key);
    } catch {
      // Clipboard blocked (insecure origin / permissions): fall back to a prompt the user can copy from.
      window.prompt('Copy this link:', text);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setWhich(null), 1800);
  };
  return { which, copy };
}

export default function TopBar(p: Props) {
  const { level, text } = describeStatus(p.status, p.playerCount);
  const { which, copy } = useCopied();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const editing = p.canGM && p.viewMode === 'gm';
  const close = (fn: () => void) => () => { setMenuOpen(false); fn(); };

  return (
    <header className={`panel topbar${editing ? '' : ' is-player'}`}>
      <div className="topbar-left">
        <svg className="brand-mark" viewBox="0 0 34 34" aria-hidden="true">
          <rect x="2" y="2" width="30" height="30" rx="7" fill="#0F172A" stroke="#2DD4BF" strokeWidth="1.6" />
          <path d="M11 24V10l5 8 5-8v14" fill="none" stroke="#2DD4BF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="brand">
          <span className="brand-name">{p.roomId}</span>
          <span className="brand-sub">room</span>
        </div>
        <span className="pill" role="status">
          <i className={`dot dot-${level}`} />
          {text}
        </span>
        {p.canGM && <span className="pill pill-gm">GM</span>}
      </div>

      {p.canGM && (
        <div className="seg" role="group" aria-label="View">
          <button type="button" className={p.viewMode === 'gm' ? 'is-active' : ''} aria-pressed={p.viewMode === 'gm'} onClick={() => p.onViewMode('gm')}>
            GM view
          </button>
          <button type="button" className={p.viewMode === 'player' ? 'is-active' : ''} aria-pressed={p.viewMode === 'player'} onClick={() => p.onViewMode('player')}>
            Player view
          </button>
        </div>
      )}

      <div className="topbar-right">
        {!p.canGM && (
          <span className="brand-sub">
            You are <b style={{ color: 'var(--white)', fontWeight: 600 }}>{p.identityId}</b>
          </span>
        )}

        <button type="button" className="btn btn-ghost" onClick={() => copy('player', p.playerLink())}>
          {which === 'player' ? <Check className="ic-s" aria-hidden="true" /> : <LinkIcon className="ic-s" aria-hidden="true" />}
          <span className="btn-label">{which === 'player' ? 'Copied' : p.canGM ? 'Player link' : 'Invite a friend'}</span>
        </button>

        {p.canGM && p.gmLink && (
          <button type="button" className="btn btn-ghost" title="Anyone with this link has full GM control" aria-label="Copy GM link" onClick={() => copy('gm', p.gmLink!())}>
            {which === 'gm' ? <Check className="ic-s" aria-hidden="true" /> : <Crown className="ic-s" aria-hidden="true" />}
            <span className="btn-label">{which === 'gm' ? 'Copied' : 'GM link'}</span>
          </button>
        )}

        {p.canGM && (
          <>
            <span className="divider-v hide-narrow" />
            <button type="button" className="btn hide-narrow" onClick={p.onSave}>Save</button>
            <button type="button" className="btn hide-narrow" onClick={p.onLoad}>Load</button>
          </>
        )}

        <div className="menu-anchor" ref={menuRef}>
          <button
            type="button"
            className="btn"
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <Ellipsis className="ic-s" aria-hidden="true" />
          </button>
          {menuOpen && (
            <div className="menu" role="menu">
              <div className="menu-label">View</div>
              <button type="button" role="menuitemcheckbox" aria-checked={p.snapTokens} className="menu-item" onClick={() => p.onSnapTokens(!p.snapTokens)}>
                Snap tokens to grid {p.snapTokens && <Check className="ic-s" aria-hidden="true" />}
              </button>
              <button type="button" role="menuitemcheckbox" aria-checked={p.debugVision} className="menu-item" onClick={() => p.onDebugVision(!p.debugVision)}>
                Debug vision {p.debugVision && <Check className="ic-s" aria-hidden="true" />}
              </button>
              <button type="button" role="menuitemcheckbox" aria-checked={p.debugCollision} className="menu-item" onClick={() => p.onDebugCollision(!p.debugCollision)}>
                Debug collision {p.debugCollision && <Check className="ic-s" aria-hidden="true" />}
              </button>

              {p.canGM && (
                <>
                  <div className="menu-sep" />
                  <div className="menu-label">Scene</div>
                  <button type="button" role="menuitem" className="menu-item" onClick={close(p.onSave)}>Save to file</button>
                  <button type="button" role="menuitem" className="menu-item" onClick={close(p.onLoad)}>Load from file</button>
                  <div className="menu-sep" />
                  <div className="menu-label">Load a demo map</div>
                  <button type="button" role="menuitem" className="menu-item" onClick={close(() => p.onDemo(1))}>Dungeon</button>
                  <button type="button" role="menuitem" className="menu-item" onClick={close(() => p.onDemo(2))}>Tavern</button>
                  <div className="menu-sep" />
                  <button type="button" role="menuitem" className="menu-item is-danger" onClick={close(p.onClear)}>Clear scene…</button>
                </>
              )}
              <div className="menu-version">v{p.version}</div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
