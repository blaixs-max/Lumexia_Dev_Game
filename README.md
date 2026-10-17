# Lumexia Racing Game — Development Edition

A 3D browser highway racer built with React, Three.js and Zustand. This repository is the **free practice development edition**: choose Classic Run or Double or Nothing, steer through traffic, collect power-ups and beat your best score on this device.

**Current mode: `DEV_MODE=true`.** Wallet, credit, price and backend adapters are mocked. The race does not spend credits, submit server scores or distribute rewards. No wallet or environment variables are required for local practice. Changing the flag alone does not restore production integrations.

Older production and deployment descriptions in the documentation are historical records. They do not describe the active behavior of this development repository.

## Play locally

The Turkish main menu has two primary actions: **Yarışa başla** (Start race) and **Garaj** (Garage). Start race opens a centered mode dialog; Classic Run and Double or Nothing cards appear there with their existing symbols and Turkish rules. Selecting a card only changes the draft choice. Confirm with **Yarışa başla** inside the dialog to start that mode, or dismiss it with **Geri dön**, close, Escape or the backdrop to keep the previous choice. The garage offers six playable vehicles: starter LX Sport, LX GT (1,250 gold), LX Apex (3,000), Subaru WRX STI (900), BMW M3 E30 (2,400), and Nissan Z Proto (4,800). The three new cars use realistic proportions and textured models, replacing the earlier stylized Kenney bodies. Each has different arcade driving stats and its own upgrades; these stats are game tuning, not manufacturer specifications. Inspecting a car previews it without changing the active vehicle; buy or select an owned car to use it for the next run. Existing purchases, builds, selected car and gold are preserved under the original save IDs.

The garage uses an industrial workshop scene with arrow navigation, performance bars and an equipment tray. Drag the vehicle to inspect it. **Ana menüye dön** returns to the main menu; purchases and selections save immediately. An expandable **Nasıl oynanır?** guide explains keyboard or touch controls on the main menu. Shared vector symbols and UI terminology are documented in [UI_GUIDE.md](docs/UI_GUIDE.md).

Each vehicle has different arcade tuning and a separate Engine / Handling / Nitro build (Stock through Stage 3). Upgrades cost local workshop gold and automatically install on the selected, owned vehicle. New saves start with 1,500 gold and only Sport owned; completed runs earn 25 gold per coin plus 1 per 10 metres. Purchases, ownership, builds and gold are saved on this device; real payments and online storage remain deferred. Save schema 3 preserves previously selected or tuned cars when migrating earlier garage saves.

Equipment cards use three Higgsfield-generated 3D-style images in `public/equipment/`; provenance and prompts are recorded beside them. The visible intake, brake/rail details and nitro tanks mounted on cars are separate lightweight Three.js meshes. They appear in the garage and race; the Higgsfield card images are not 3D model files.

```bash
npm ci
npm run dev       # http://localhost:5173
```

Tune your car in the garage, return to the main menu, then use **Yarışa başla** to choose and confirm a mode in the dialog. Graphics quality is available on both screens. Classic Run is endless. Double or Nothing awards twice the final score after reaching level 5; finishing earlier gives zero score. This rule does not affect earned workshop gold. Best scores are stored locally per mode.

| Input | Action |
|---|---|
| Left / Right arrows or A / D | Hold to steer |
| Space | Hold for nitro |
| Esc or P | Pause / resume |
| M | Toggle sound |
| Touch controls | Hold a direction and nitro together |

Switching away from the game pauses the run and releases held input. Pause and results screens provide separate Garage and Main Menu destinations. The arcade speed indicator is labeled **Oyun hızı / birim** (game speed / units), not calibrated km/h. Pickup notifications distinguish **puan** (score), **jeton** (collected coins) and **altın** (spendable garage balance).

Graphics options are Auto, Performance and High. Auto can reduce resolution and scene detail when needed. Sound and graphics preferences are saved locally when browser storage is available.

## Architecture

- **Frontend:** Vite + React 19, Three.js, React Three Fiber and Drei.
- **Simulation:** Zustand session state in `src/store.js`; fixed 120 Hz gameplay rules in `src/utils/gameplay.js`.
- **Scene:** `src/components/RaceScene.jsx` handles the highway, vehicles, camera, lighting and scenery. Repeated scenery uses shared geometry and instancing.
- **Interface:** `RealLauncherUI.jsx` provides the main menu; `GaragePage.jsx` and `GaragePanel.jsx` handle preview, ownership and upgrades. `VehicleShowroom.jsx` is shared between both screens. `RaceHUD.jsx`, `RaceControls.jsx` and `GameOverUI.jsx` handle telemetry, input and results.
- **Symbols:** `UIIcon.jsx` is the shared code-native SVG control set; generated mode emblems remain in `public/modes/` and equipment artwork in `public/equipment/`.
- **App lifecycle:** `src/App.jsx` connects the screens, lazy-loads the race scene and handles audio and scene loading errors.
- **Archived integration sources:** Supabase functions, migrations and production integration documentation remain in the repository. Enabling those services requires a separate validated integration effort.

The Sport garage preview uses `sport_car_compact.glb`, while its race model uses `sport_car_runtime.glb`. GT uses `Car 3/scene.gltf`; Apex uses `ferrari_runtime.glb`. The three replacement bodies use self-contained GLBs in `public/models/realistic/` for both the garage and race. Their model contributions are accessible through **Model katkıları** in both menu footers. Decoders are bundled in `public/draco/`. See `public/models/RUNTIME_MODELS.md` for model measurements. All player vehicles share the same normalized collision dimensions in this first garage release.

## Checks and build

```bash
npm test
npm run lint
npm run build       # output: dist/
npm run preview     # preview the build
node tools/check-realistic-cars.mjs
```

Local verification on 17 October 2026: **85 tests passed, 17 skipped**; lint and production build passed. Garage tests cover ownership, one-time car purchases, insufficient gold, save migration, paid upgrades, separate builds, malformed/unavailable storage, locked race tuning, actual gameplay effects and once-only end-of-run gold. A replacement regression covers all three original save IDs with pre-existing purchases and different equipped builds. All three final GLBs passed the custom offline geometry/resource checks and Khronos validation with zero errors and zero warnings.

The new mode dialog passed desktop, 320×700 and 844×390 browser checks, including keyboard selection, Tab containment, cancel/Escape/backdrop dismissal, focus restoration and Garage navigation. Confirming Double or Nothing produced the level-5 target in the race HUD; reopening the dialog retained that committed mode. Switching to Classic Run started a real run that reached Classic Run results. Both compact dialog views fit without horizontal overflow; the landscape dialog needed no internal scrolling.

Browser checks rendered all three replacements without errors, preserved an existing Subaru purchase/build/balance, and verified a fresh Subaru purchase → engine upgrade → reload → actual race → completed-run gold. At 320 px the six garage cards form two columns, long names wrap and the page has no horizontal overflow. The credits page and all three author/source/license entries were checked. See [garage preview](artifacts/realistic-nissan-garage.png), [race capture](artifacts/realistic-subaru-race.png), and [TASK.md](docs/TASK.md) for the acceptance record. Physical-device performance, long-run balance and every upgrade stage remain unverified. Production wallet/price tests remain skipped while this repository uses mock adapters; local checks do not validate production services.

Node 24 was used for local verification. In the constrained Windows environment, the build and tests succeeded with Vite's native configuration loader. If your environment also restricts installation scripts or configuration-loader subprocesses, these were the commands used:

```bash
npm ci --ignore-scripts
npm test -- --configLoader native
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
- **Subaru Impreza WRX STI 2004 Custom** by MAC ULT ARTS — Subaru WRX STI; CC BY 4.0.
- **BMW M3 E30** by Martin Trafas — BMW M3 E30; CC BY 4.0.
- **Nissan Z Proto** by Lexyc16 — Nissan Z Proto; CC BY 4.0.
  [Model sources, licenses and modifications](public/models/realistic/credits.html). The same contributions page is linked from the main menu and garage.
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

