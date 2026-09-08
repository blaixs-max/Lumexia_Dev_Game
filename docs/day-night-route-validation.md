# Day/night cycle and curved route validation

Validated locally on 2026-09-08. The run starts with 300 seconds of daylight, followed by 45 seconds of sunset, 180 seconds of night and 45 seconds of sunrise. Pause freezes the run clock; restart resets it. The repeating route contains broad S bends and a 150-render-metre tunnel. Render distance remains `totalDistance * 5`, distinct from the HUD distance.

## Automated checks

- ESLint passed.
- Vitest: 62 passed; 17 production-adapter integration tests remain skipped in mock mode.
- Production build passed. The existing large Three.js vendor chunk warning remains; no dependency changes were needed.
- Boundary tests cover the clock, route wrapping, repeated deformation from immutable geometry, tunnel transitions and curved visibility bounds.

Commands: `npm run lint`, `npm test -- --configLoader native`, `npm run build -- --configLoader native`. The native config loader is used by the local Windows test environment; CI uses the repository's ordinary npm scripts on Linux.

## Visual and long-run diagnostics

Views checked at 1280×720, 844×390 and 390×844: daylight, sunset, night tunnel, sunrise and return to daylight. The speed and nitro gauges remain at the sides. Headlights activate inside the tunnel during daylight.

The separate diagnostic entry uses the actual RaceScene and HUD with physics updates and score submission disabled. A 20× clock and 70 render m/s route replay advanced from 570 to 4030.77 seconds, exceeding six full clock cycles. Route distance reached 12963.23 render metres and repeatedly crossed the 1800-metre seam. Shader programs stayed at 31 (initial/maximum/final); the scene retained five real lights and one shadow source. No shader errors, page errors or context loss were observed. Final counts were 237 geometries and 53 textures.

To reproduce the diagnostic entry:

1. `npx vite build --config tools/route-check.config.js --configLoader native`
2. `node tools/route-check-server.cjs 5179`
3. Open `http://127.0.0.1:5179/` and use the phase, route, replay and clock controls. This server binds only to loopback and serves the generated sibling `route-check` output and the project's public assets. The diagnostic entry is excluded from the normal production bundle.

These checks do not establish 60 FPS, physical-phone multitouch/thermal acceptance or a complete production race/backend integration test. The earlier `night-validation.json` records a different, night-only test scope and is retained as historical evidence. Real Android/iPhone long-run profiling remains outstanding.
