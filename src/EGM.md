# src

## Overview

The application source. `main.tsx` is the browser entry point: it mounts the React tree (`app/`) that composes the UI components (`ui/`) over the PixiJS/PeerJS core (`vtt/`). React owns application chrome only; map objects are drawn by PixiJS inside `vtt/`.

## Interface

- `main.tsx`: mounts `<App />` inside `<StrictMode>` into the `#root` element via `createRoot`, and imports `index.css`.
- `vite-env.d.ts`: references `vite/client` types and declares the global constant `__APP_VERSION__: string`.
- `index.css`: global stylesheet that defines the design tokens (CSS custom properties such as `--midnight`, `--slate`, `--tosca`) and every UI and landing-page class.
- [`./app/EGM.md`](./app/EGM.md): application shell, router and route-level pages.
- [`./ui/EGM.md`](./ui/EGM.md): React UI components (top bar, toolbar, properties panel, players panel, zoom, viewport host).
- [`./vtt/EGM.md`](./vtt/EGM.md): engine, scene, renderers, editor tools, geometry, systems and network layers.

## Invariants

- `vite-env.d.ts`: `__APP_VERSION__` is a compile-time constant, replaced by Vite's `define` in the root `vite.config.ts` (from `package.json` `version`); it does not exist at runtime in non-Vite environments such as plain Node.
- `main.tsx`: the entry assumes `index.html` provides an element with id `root` (non-null assertion on `getElementById('root')`).
- `index.css`: components reference colours through the CSS variables defined here; the Pixi renderers use their own hex constants (kept in step by hand, not generated from the CSS).

## Side Effects

- `main.tsx`: renders into the DOM on module load, and `import './index.css'` applies global styles (including `overflow: hidden` on `html`, `body` and `#root`, which the landing page overrides with its own scroll container).

## Verification

- Run: `npm test`
