# App

## Overview
Application shell. `App.tsx` mounts the client-side router and code-splits the heavy room page so the landing page does not load PixiJS and PeerJS.

## Interface
- `App.tsx`: `default export App()` renders `BrowserRouter` > `Suspense` (fallback text "Loading…") > `Routes`.
  - `/` renders `Home` (eager import).
  - `/room/:roomId` renders `Room` (loaded with `React.lazy`).
- Subdirectories:
  - [pages](./pages/EGM.md): `Home` and `Room` route components.

## Invariants
- `Room` must stay lazily imported; it pulls in PixiJS and PeerJS (most of the bundle) and `Home` must not depend on them.
- The room id is the `:roomId` path param; GM intent is carried only in query params handled by `Room`.

## Side Effects
- Uses the browser History API through `BrowserRouter`.
- Triggers a dynamic import chunk fetch when `/room/:roomId` is first visited.

## Verification
- Run: `npm test`
