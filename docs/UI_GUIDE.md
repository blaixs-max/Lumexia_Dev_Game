# UI copy and terminology

Current copy standard: October 19, 2026. All player-facing menus, garage screens, race HUD, pause/results screens, loading errors, accessibility labels, and model credits use English. Use short, natural racing-game language. Keep **Classic Run**, **Double or Nothing**, and vehicle model names unchanged. Format numbers with `en-US` separators.

## Main Menu and race modes

The two primary Main Menu actions are **Start Race** and **Garage**. **Start Race** opens the centered **Choose Your Mode** dialog; opening it or selecting a mode does not start a race. The dialog's **Start Race** button confirms the selected mode and begins loading. Show **Loading…** while confirmation is in progress and a clear English error if starting fails.

**Classic Run** is an **Endless Drive**: “Chase your personal best through traffic.” **Double or Nothing** explains its target explicitly: “Reach Level 5: score ×2. Crash before Level 5: 0.” This affects the final score only; players keep all Gold earned during the race. Show **TARGET: LEVEL 5** before the target and **SCORE ×2** after reaching it. Results repeat both the score outcome and the unchanged Gold earnings.

Mode selection stays temporary until confirmed. **Back**, the close button, Esc, and clicking outside the dialog dismiss it without changing the last confirmed mode. Focus starts on the selected radio option; arrow keys change modes, and Tab stays inside the dialog. The background is inactive while the dialog is open. Dismissing restores focus to the Main Menu's **Start Race** button.

## Terms and units

| Term | Meaning and copy rule |
|---|---|
| **Score / Points** | Race points, separate from spending currency. |
| **Coins** | Road pickups. A coin awards **+100 POINTS · 1 COIN** during the run. |
| **Gold** | Garage spending balance. Completed races award **25 Gold per coin + 1 Gold per 10 m**. Show prices and shortfalls explicitly in Gold. |
| **Level** | Race progression; for example, **Level 5**. |
| **Stage** | A purchased part upgrade. **Stock** is Stage 0; each part has Stages 1–3. Do not call upgrades Levels. |
| **Top Speed** | Normal cruising speed in **game units**; not physical km/h. |
| **Nitro Speed** | Speed while using Nitro, also in **game units**. |
| **Acceleration / Handling** | Existing gameplay values, displayed as a **rating**. Do not imply 0–100 times, physical weight, or a drift mechanic. |
| **Nitro Capacity** | Total reserve in **units**. |
| **Nitro Recharge** | Reserve restored per second, displayed as **units/s**. |
| **Nitro %** | Current reserve as a percentage of the equipped car's capacity. |
| **Equipped / Equipped Car** | The car selected for the next race. **Race-ready** describes this state. |
| **Browsing** | The car currently displayed for inspection. Browsing does not equip it. |
| **Rocket Boost / Magnet** | Timed power-ups; show their remaining duration in seconds. |

## Garage actions and comparison

Place separate **Select** and **Purchase** buttons beneath the 3D car preview. **Purchase** changes ownership and deducts Gold without changing the equipped car. The player must then press **Select** to race with that car. Use **Selected / Race-ready** for the equipped car and **Owned / In your garage** for purchased cars. An unowned car cannot be selected. Explain insufficient Gold, the remaining shortfall, and action results in the adjacent live status message. After a successful purchase, focus the newly available **Select** button.

The **Performance** panel compares **Browsing** against **Equipped**. Use the six real stats above: Top Speed, Nitro Speed, Acceleration, Handling, Nitro Capacity, and Nitro Recharge. Include each car's own installed upgrades. Display both values and bars on the same fixed scale, whose maximum includes every car's fully upgraded build. A row's difference is browsing minus equipped: **+… better**, **−… lower**, or **Equal**. Summarize the better/lower/equal counts. Keep text, signs, and numeric values so color never carries the meaning alone. Comparing the equipped car to itself shows equal values.

Only the equipped, owned car can receive upgrades. **Stage N Upgrade** shows the Gold cost and installs the next stage immediately. Use explicit **Purchase first**, **Select car first**, **Maxed Out**, and insufficient-Gold states. Do not change the active race build by browsing or buying another car.

## HUD, pause, audio, and graphics

The HUD distinguishes Score, Level, Distance, Coins, Near Misses, Speed, Nitro, and timed power-ups. The Main Menu's **How to Play** section and countdown give input-specific instructions:

- Keyboard: hold **← / →** or **A / D** to steer; hold **Space** for Nitro. Nitro recharges over time.
- Touch: hold the left or right screen side to steer; hold the **NITRO** button to boost. Two fingers allow steering and boosting together.
- Press **Esc / P** to pause or resume, and **M** to toggle sound. Touch controls provide pause and sound buttons in the top-right corner.

Use **Resume**, **Restart Race**, **Garage**, and **Main Menu** in the pause dialog; use **Race Again** on results. Keep keyboard focus within the pause dialog and allow its content to scroll on short screens. Icon-only sound controls use **Mute sound** / **Unmute sound** accessible labels, with the current state reflected consistently.

Graphics choices are **Standard**, **Performance**, and **High**. The persisted `auto` value is labeled **Standard**; it selects its initial profile before the race. The selected profile and rendering quality stay fixed throughout the run: no FPS-driven quality reduction. Explain this in the Graphics control's hint.

## Saving, errors, and visual language

Normal play saves cars, upgrades, Gold, and personal bests on the current device. Use **Progress saved on this device.** and clear English fallback text when browser storage is unavailable; describe session-only progress where appropriate. Do not imply cloud synchronization. Loading and preview failures must expose readable English messages and relevant retry or Main Menu actions.

Shared SVG icons live in `src/components/UIIcon.jsx`. Keep their visual style consistent; visible labels and accessible names carry the meaning. Reuse the existing mode and equipment artwork. Use lime for the primary action, Gold coloring for prices, and explicit text for locked, insufficient-balance, and maximum-stage states.

## Browser verification and diagnostic fixtures

Verify the real Main Menu, mode dialog, Garage, HUD, pause, and results on desktop and narrow/short browser frames, including **320×700**, **390×700**, and **844×390**. Check English text wrapping, horizontal overflow, complete mode rules, visible actions, two-column car comparison, keyboard focus, dismissal paths, and touch instruction visibility. Confirm a real race displays the confirmed mode and a Double or Nothing result keeps its Gold even when the score is zero.

`tools/garage-check.html` is a separate local diagnostic entry. It replaces storage within that document with memory-only storage before game modules load, so it never reads or writes the normal browser save. Its visible **Reset Starter · 1,500 Gold** and **Maxed Build · 6,000 Gold** profiles support Purchase → Select → Upgrade and comparison checks. It is not the production entry.

`tools/mobile-controls-check.html` renders the production HUD and controls over a synthetic scene; its checks exercise responsive layout and simulated inputs. `artifacts/ui-review.html` provides browser-frame size controls. These fixtures and browser screenshots do not establish physical-phone behavior, native pointer capture, multitouch hardware behavior, or FPS performance.

Historical screenshots and reports remain historical evidence. Record current verification results in `docs/TASK.md` and `docs/PLAN.md`; do not present old test totals or synthetic fixture results as fresh acceptance of the English UI.
