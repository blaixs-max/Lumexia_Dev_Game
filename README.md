# Lumexia Racing Game — Development Edition

A 3D browser highway racer built with React, Three.js and Zustand. This repository is the **free practice development edition**: choose Classic Run or Double or Nothing, steer through traffic, collect power-ups and beat your best score on this device.

**Current mode: `DEV_MODE=true`.** Wallet, credit, price and backend adapters are mocked. The race does not spend credits, submit server scores or distribute rewards. No wallet or environment variables are required for local practice. Changing the flag alone does not restore production integrations.

Older production and deployment descriptions in the documentation are historical records. They do not describe the active behavior of this development repository.

## Current race revision — 18 October 2026: moving NPC traffic and continuous shadows

NPCs now move in the same world scale as the road, follow slower vehicles with braking, and perform signaled random adjacent-lane changes. Planned moves reserve both lanes before signaling; sequential reservations and following constraints keep a passing corridor open as traffic converges. Successful spawn intervals for levels 1–8 are 48 / 35 / 27 / 19 / 13 / 10 / 8 / 7 HUD metres, then capped; traffic remains limited to 12 vehicles. Collision footprints match the fitted model assets, and old/new NPC snapshots are matched by stable IDs.

Geometry-based sun/moon shadows cover approaching traffic with two 1024 maps in Performance or three 1536 maps in High, reaching 320/360 world units. Cascade transitions blend over at least eight world units, with a gradual far fade. Shared materials and shader hooks are restored when leaving the race.

Checks: **130 tests passed, 17 skipped**; lint, production build (654 modules) and QA build passed. Independent body-overlap and passing-lane checks cover 72 simulated minutes across levels, seeds and boost speeds. The real race fixture at level 8 completed eight changes in 20 seconds with zero NPC contacts; High daylight and Performance night had no shader, page or WebGL context errors. Normal race start, driving and return to the garage were also verified. [Traffic capture](artifacts/npc-live-level8.png), [near NPC shadow](artifacts/npc-shadow-near.png).

`/tools/route-check.html?simulation=live&level=8&seed=2026` runs the production NPC update without player crashes or persistent writes. Following, lane-change and shadow-approach presets support pause and fixed-step inspection. Release follows the existing GitHub pull-request checks → `main` → Vercel production workflow for `lumexia-dev-game.vercel.app`. Physical-phone shadow performance remains unmeasured. The following sections retain earlier acceptance records.

## Previous race revision — 17 October 2026: magnet and rocket pickups

The magnet and rocket now have distinct solid 3D models instead of a shared coin-shaped badge and cone. The magnet is a beveled red-and-blue horseshoe with silver pole caps and fasteners. The rocket has a pearl body, orange nose and swept fins, copper trim, a cyan window, an engine nozzle and three-dimensional exhaust. Both are original code-native Three.js models; this change adds no downloaded asset, image-generation dependency or external license.

Powerups gently turn and float while keeping their recognizable face visible. Their ground markers stay on the road; reduced-motion preference disables the turning and bobbing. Existing scene lighting is reused without extra lights. Pickup placement, collisions, collection effects and effect durations are unchanged.

Local checks: **89 tests passed, 17 skipped**; final lint and production build passed (648 modules). The real race QA fixture rendered two magnets, two rockets and one coin in both High and Performance, in daylight and at night, with no shader, page or WebGL context errors. High retained 31 shader programs across day/night; the Performance 512×512 shadow map was observed. Geometry checks found finite positions and normals: magnet 1,456 triangles / 6 model draws; rocket 3,680 triangles / 9 model draws, excluding shadows and ground markers. Resources are cached per instance and disposed on removal. See the [Performance daylight capture](artifacts/powerups-day.png) and [High night capture](artifacts/powerups-night.png).

The fixture's **Pickup layout → Magnet + rocket** preset is available at `/tools/route-check.html?pickups=powerups`; it also retains the vehicle, daylight and graphics controls. Physical-device performance remains unverified. The release combines these pickups with the shadow and traffic changes below. GitHub pull-request CI checks tests, lint and the build before merging; the existing Vercel integration deploys `main`.

## Previous local race revision — 17 October 2026: shadows and traffic

Race shadows now use the vehicle meshes and the existing directional sun/moon light. The circular player/traffic patches and idle underglow were removed. A tight shadow volume follows the player, so the silhouette follows the car and the day-cycle light direction. PCF soft shadow maps are enabled in every graphics mode: 512×512 in Performance and 1024×1024 in High. The shadow camera spans ±8 with near/far 1/80; the vehicle ground offset is −0.025 above the asphalt at −0.03. This reuses the existing single directional light.

Traffic now increases more noticeably with level. Target spacing between successful traffic spawns, in HUD metres:

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8+ |
|---|---|---|---|---|---|---|---|---|
| Spacing (m) | 29 | 22 | 17 | 13 | 10.5 | 9 | 8 | 7 |

An occupied spawn point is retried after 1.5 m. The passing-gap checks at cruise/nitro/rocket speeds, same-lane separation, bounded NPC speeds and 12-vehicle cap remain in place. Four seeded 60-second simulations produced 23 spawns at level 1, 39 at level 3 and 61–63 at level 5; mean approaching traffic was approximately 2.0, 3.6 and 5.5 vehicles respectively. These simulations remove vehicles after z = −20 to prevent collisions from ending the sample and disable pickups. They measure traffic progression, not real gameplay FPS or memory performance. Level 8 and level 80 tests verify the density limit; dense traffic matches at 30/60/144 render FPS.

Checks for that revision: **89 tests passed, 17 skipped**; lint and the production build passed (646 modules). Browser checks used the real race components in a QA fixture: Apex in Performance daylight and High night/sunset, plus Subaru in High daylight on a curved road. The 512/1024 shadow maps were observed with no shader, page or WebGL context errors. See the [Performance shadow capture](artifacts/physical-shadow-performance.png). Physical-phone performance remains unverified. This revision is included in the combined release. Earlier acceptance records below retain their original test counts and scope.

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
- **Powerup models:** `MagnetPickup.jsx` and `RocketPickup.jsx` supply original Three.js geometry to the race pickup renderer; the original coin model and gameplay rules are retained.
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

Earlier menu/model verification on 17 October 2026: **85 tests passed, 17 skipped**; lint and production build passed. Garage tests cover ownership, one-time car purchases, insufficient gold, save migration, paid upgrades, separate builds, malformed/unavailable storage, locked race tuning, actual gameplay effects and once-only end-of-run gold. A replacement regression covers all three original save IDs with pre-existing purchases and different equipped builds. All three final GLBs passed the custom offline geometry/resource checks and Khronos validation with zero errors and zero warnings.

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

External 3D asset contributions, including retained historical assets:

### CC-BY (Attribution required)
- **Subaru Impreza WRX STI 2004 Custom** by MAC ULT ARTS — Subaru WRX STI; CC BY 4.0.
- **BMW M3 E30** by Martin Trafas — BMW M3 E30; CC BY 4.0.
- **Nissan Z Proto** by Lexyc16 — Nissan Z Proto; CC BY 4.0.
  [Model sources, licenses and modifications](public/models/realistic/credits.html). The same contributions page is linked from the main menu and garage.

### Archived pickup assets (CC BY 3.0)

These older files are retained in the repository. The current race magnet and rocket use the original code-native models described above, rather than these external assets.

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

