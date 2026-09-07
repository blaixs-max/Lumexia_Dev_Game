# Lumexia Racing Game — Development Edition

A 3D browser highway racer built with React, Three.js and Zustand. This repository is the **free practice development edition**: choose Classic Run or Double or Nothing, steer through traffic, collect power-ups and beat your best score on this device.

**Current mode: `DEV_MODE=true`.** Wallet, credit, price and backend adapters are mocked. The race does not spend credits, submit server scores or distribute rewards. No wallet or environment variables are required for local practice. Changing the flag alone does not restore production integrations.

Older production and deployment descriptions in the documentation are historical records. They do not describe the active behavior of this development repository.

## Play locally

```bash
npm ci
npm run dev       # http://localhost:5173
```

Select a mode and graphics quality in the garage, then start a run. Classic Run is endless. Double or Nothing awards twice the final score after reaching level 5; finishing earlier gives zero. Best scores are stored locally per mode.

| Input | Action |
|---|---|
| Left / Right arrows or A / D | Hold to steer |
| Space | Hold for nitro |
| Esc or P | Pause / resume |
| M | Toggle sound |
| Touch controls | Hold a direction and nitro together |

Switching away from the game pauses the run and releases held input. The pause menu includes resume, restart and return to garage. The arcade speed indicator uses `PACE`, not a physical km/h calibration.

Graphics options are Auto, Performance and High. Auto can reduce resolution and scene detail when needed. Sound and graphics preferences are saved locally when browser storage is available.

## Architecture

- **Frontend:** Vite + React 19, Three.js, React Three Fiber and Drei.
- **Simulation:** Zustand session state in `src/store.js`; fixed 120 Hz gameplay rules in `src/utils/gameplay.js`.
- **Scene:** `src/components/RaceScene.jsx` handles the highway, vehicles, camera, lighting and scenery. Repeated scenery uses shared geometry and instancing.
- **Interface:** `RealLauncherUI.jsx`, `RaceHUD.jsx`, `RaceControls.jsx` and `GameOverUI.jsx` separate the garage, telemetry, input and results.
- **App lifecycle:** `src/App.jsx` connects the screens, lazy-loads the race scene and handles audio and scene loading errors.
- **Archived integration sources:** Supabase functions, migrations and production integration documentation remain in the repository. Enabling those services requires a separate validated integration effort.

The garage and race use `public/models/sport_car_compact.glb` with locally bundled decoders in `public/draco/`. The original `sport_car.glb` is preserved. Model download size is **30.39% smaller**, with the same 237,482 triangles. The texture memory estimate falls from 160 MiB to 48 MiB under an RGBA8 + full mip-chain assumption; this is not a measured device memory or FPS result.

## Checks and build

```bash
npm test
npm run lint
npm run build       # output: dist/
npm run preview     # preview the build
```

Local verification on 7 September 2026: **33 tests passed, 17 skipped**. The skipped tests cover production wallet/price behavior while this repository uses mock adapters. They are not evidence that production services work.

Node 24 was used for local verification. In the constrained Windows environment, the build succeeded with Vite's native configuration loader and tests used the runner loader. If your environment also restricts installation scripts or configuration-loader subprocesses, these were the commands used:

```bash
npm ci --ignore-scripts
npm test -- --configLoader runner
npm run build -- --configLoader native
```

Use the ordinary commands above in a normal development environment. The native loader requires a Node version capable of loading the configuration directly.

## Documentation

| Document | Purpose |
|---|---|
| [Quality review](docs/QUALITY_REVIEW.md) | Current changes, model metrics, reproduction steps and verification limits |
| [Development plan](docs/PLAN.md) | Current acceptance work followed by the preserved historical roadmap |
| [Task log](docs/TASK.md) | Current development entry followed by earlier work |
| [Project documentation](docs/PROJECT_DOCS.md) | Earlier architecture and integration reference; check against current code |
| [Integration reference](docs/INTEGRATION.md) | Historical production integration contract |
| [Project rules](CLAUDE.md) | Repository collaboration rules |

## CI and deployment context

The PR workflow runs tests, a build and lint on Node 20. The existing lint job uses `continue-on-error: true`. Supabase deployment workflows remain in the repository; their presence does not mean the practice game connects to production or that live services were validated in this change.

Real device sessions on Windows, Android and iPhone remain part of the acceptance plan. See the quality review for scope and known limits.

---


## Credits

Open-source 3D assets used in the game:

### CC-BY (Attribution required)
- **"Magnet"** by Poly by Google — [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/)
  ([source](https://poly.pizza/m/dD2RIIea6WR))
- **"Rocketship"** by Poly by Google — [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/)
  ([source](https://poly.pizza/m/8iKIYCyvh2k))

### CC0 (Public domain — no attribution required, listed for transparency)
- [**KayKit City Builder Bits**](https://kaylousberg.itch.io/city-builder-bits) by Kay Lousberg
- [**Quaternius Ultimate Stylized Nature**](https://quaternius.com/) by Quaternius
- [**Quaternius Farm Buildings**](https://quaternius.com/) by Quaternius

---

## License

Private. Contact: [@lumexia_project on X](https://x.com/lumexia_project).

