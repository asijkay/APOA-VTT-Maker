# network

## Overview
Host-authoritative multiplayer over PeerJS. A GM-key holder claims room peer id `vtt-maker-room-<roomId>` and hosts; others join as clients. Everything received is validated, authorized, and per-viewer filtered before use.

## Interface
- `NetworkService.ts`: type `NetworkOptions {roomId, store, ephemeralStore, identity, gmKey}`, `RoleInfo`; class `NetworkService` (`init`, `broadcastEphemeral`, `destroy`; callbacks `onStatusChange`, `onRoleChange`, `onPlayersChange`, `onFogMemory`; fields `peer`, `isHost`, `connected`).
- `protocol.ts`: `COLLECTIONS`, `CollectionKey`, `EntityOf`, `SceneSettings`, `Delta`, `Viewer`, `EphemeralEvent`, `PlayerInfo`; `validateScene`, `validateDelta`, `validateEphemeral`, `validateCells`, `diffScenes`, `applyDelta`, `isEmptyDelta`, `authorizeDelta`, `isValidColor`, `isPlayerId`, `isSecret`, `isGmKey`, `isPlayerList`.
- `viewFilter.ts`: `ViewerMemory`, `createMemory`, `filterSceneForViewer(scene, viewer, memory)`.
- `identity.ts`: `Identity`, `StorageLike`; `loadIdentity`, `resolveGmKey`, `loadBindings`, `saveBindings`, `safeEqual`, `loadFog`, `saveFog`.
- `peerOptions.ts`: `parseIceServers(raw)`, `getPeerOptions(raw = VITE_ICE_SERVERS)`.

## Invariants
- [NetworkService.ts] Message flow: client HELLO, host WELCOME then SYNC, then DELTA both ways, FOG and PLAYERS host to client, EPHEMERAL either way (host stamps sender id).
- [NetworkService.ts:canHost] Only a holder of a GM key may host; players never claim a vacated room.
- [protocol.ts:authorizeDelta] GM deltas pass unchanged; players may only change x/y of tokens they own, clamped to the map and swept against walls via `moveCircleSwept`; everything else is dropped and flagged `trimmed`.
- [protocol.ts:MAX_ITEMS] Per-collection limits (floors 50000, walls 5000, doors 2000, lights 500, tokens 1000, windows 2000, images 200); ids max 64 chars.
- [protocol.ts:isPlayerId, isSecret] Player id is 8 hex chars; secret is 32 hex chars.
- [NetworkService.ts:RATE_BURST, RATE_PER_SEC, RATE_KICK_AFTER_DROPS] Per-connection token bucket (200 burst, 100/s); kick after 2000 drops.
- [viewFilter.ts:filterSceneForViewer] Players never receive secret (`hidden`) doors, other players' hidden tokens, or map layout outside owned-token vision or explored cells; GM gets the full scene.
- [identity.ts:safeEqual] Host remembers the first secret seen per player id and rejects mismatches.

## Side Effects
- [NetworkService.ts] Opens PeerJS connections (WebRTC, signalling server), timers for flush (30 ms), retry backoff (1s to 15s), hello and connect timeouts (10s), fog save (2s); subscribes to `SceneStore`.
- [identity.ts] Reads/writes localStorage keys `vtt-identity-v1`, `vtt-gmkey-v1:<room>`, `vtt-bindings-v1:<room>` and fog memory (errors swallowed).
- [peerOptions.ts] Reads `import.meta.env.VITE_ICE_SERVERS`.

## Verification
- Run: `npm test`
