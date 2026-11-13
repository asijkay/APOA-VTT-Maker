# VTT MAKER (APOA VTT Maker) Blueprint

## System Overview

A browser-based virtual tabletop where the map you draw is the game you play. One Vite + React + TypeScript app renders the map with PixiJS (floors, walls, doors, windows, lights, tokens, fog) and shares it between players over PeerJS/WebRTC with no application backend. The first browser holding the GM key becomes the host and is authoritative: clients send deltas that the host validates and authorizes, and each player is only sent the part of the map they may see.

Entry point: `index.html` loads `src/main.tsx`. Routes are `/` (landing page) and `/room/:roomId` (the app), see [`./src/EGM.md`](./src/EGM.md). Deployed as a static single-page app (`vercel.json` rewrites every path to `/index.html`).

## Local Interface & Invariants

- `vite.config.ts`: the `@` import alias resolves to `./src`; `define` injects `__APP_VERSION__` from `package.json`; `build.rollupOptions.output.manualChunks` splits `pixi.js` and `peerjs` into their own chunks; the dev server listens on host `true`, port `5173`; Vitest excludes `tests/e2e/**`.
- `eslint.config.js`: flat config for `**/*.{ts,tsx}` using `@eslint/js` and `typescript-eslint` recommended rules plus `react-hooks/rules-of-hooks` (error) and `react-hooks/exhaustive-deps` (warn); `@typescript-eslint/no-explicit-any` is a warning and unused variables are errors unless prefixed `_`; ignores `dist`, `playwright-report`, `test-results`, `node_modules`.
- `playwright.config.ts`: end-to-end tests live in `./tests/e2e`, run on Chromium against `http://localhost:5173`, starting `npm run dev` unless a server is already running (not in CI).
- Side effects of these files: Vite reads `package.json` at config load; Playwright can start a dev server process.

## Subdirectories & System Boundaries

- `src`: [`./src/EGM.md`](./src/EGM.md) - all application code: entry point and global styles, `app/` (router and pages), `ui/` (React components), `vtt/` (engine, scene, renderers, editor, geometry, systems, network).

`tests/` (one Playwright spec), `public/` (a favicon) and `.github/workflows/` (CI) contain no application source and have no contracts. Unit tests live in `src/__tests__/` and are excluded from documentation.

## Global Invariants

- Layering: the pure layers `vtt/geometry`, `vtt/systems` and `vtt/scene` import no renderer, engine, editor, network or UI code, and nothing under `vtt/` imports `ui/` or `app/`. (Checked with the TypeScript compiler API over runtime imports; there is no automated test for it.)
- React renders UI chrome only; map objects are PixiJS display objects, never React elements.
- The host's scene is the single source of truth. Every client change passes `validateDelta` and `authorizeDelta` in `vtt/network/protocol.ts`; players may only move tokens they own, and only to a position the token could walk to.
- GM rights require the room's secret key, which is carried only by the GM link; the player link never includes it.
- A player is never sent secret doors, tokens outside their vision, or map layout they have neither seen nor are currently seeing.

## Global Side Effects

- Browser `localStorage`: scene autosave `vtt-scene-v1[:<room>]`, player identity `vtt-identity-v1`, GM key `vtt-gmkey-v1:<room>`, player bindings `vtt-bindings-v1:<room>`, fog memory `vtt-fog-v1:<room>`.
- Network: WebRTC data connections coordinated through the public PeerJS cloud signalling server; optional TURN/STUN servers via the build-time `VITE_ICE_SERVERS` variable.
- Fonts: `index.html` loads Cormorant Garamond and Inter from Google Fonts, with system-font fallbacks in the CSS.
- File I/O: the user can export the scene to a JSON file and import one.

## System Verification

- Run: `npm test` (`vitest run`)
- Also: `npm run typecheck`, `npm run lint`, `npm run build`. CI (`.github/workflows/ci.yml`) runs typecheck, lint, test and build.
