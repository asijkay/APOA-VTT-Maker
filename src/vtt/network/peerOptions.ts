import type { PeerJSOption } from 'peerjs';

/**
 * PeerJS options. By default PeerJS uses its public STUN servers, which fail for
 * players behind strict NAT or corporate firewalls. Those players need a TURN relay.
 *
 * Set VITE_ICE_SERVERS at build time to a JSON array of RTCIceServer objects, e.g.
 *   VITE_ICE_SERVERS='[{"urls":"stun:stun.l.google.com:19302"},
 *                      {"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]'
 * Note the credential ships in the client bundle, so use a time-limited/restricted one.
 */
export function parseIceServers(raw: string | undefined): RTCIceServer[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const ok = parsed.every(
      (s) => s && typeof s === 'object' && (typeof s.urls === 'string' || Array.isArray(s.urls)),
    );
    return ok ? (parsed as RTCIceServer[]) : null;
  } catch {
    return null;
  }
}

export function getPeerOptions(raw: string | undefined = import.meta.env.VITE_ICE_SERVERS): PeerJSOption {
  const iceServers = parseIceServers(raw);
  return iceServers ? { config: { iceServers } } : {};
}
