# Leap Valley repair notes

Branch `fix/gameplay-and-mobile-polish` at commit `14effac`, with local gameplay and mobile polish repairs. Original Pip sprites, three levels, honey double jump, and leaf glide remain. Physics constants were not retuned. No raster assets were edited.

## Final behavior

- The 16:9 game canvas stays undistorted and centered. Landscape menus stay on the stage (that layout already fit). Portrait title is split: brand copy and Start/route/Settings live in the shell around the illustration, not inside the 16:9 clip. Pause/settings/death/clear/win on portrait are a shell-level card using available height, with comfortable control sizes. Touch overlay (landscape) and dock (portrait) are unchanged.
- Touch UI is shown for `pointer: coarse`, `any-pointer: coarse`, or a narrow viewport (width < 720 or height < 520), so phone rotation does not drop the controls. Controls stay mounted for pause/death/clear/win so the layout does not jump. Pointer cancel, lost capture, blur, and unmount clear held touch state.
- Window resize / orientation change while playing pauses once. Initial layout / ResizeObserver does not pause.
- Checkpoint rollback restores score, coins, bank, pickups (full dynamic state), grid, enemies (including `vy` / `phase`), and mover phases. Objects spawned after the snapshot are discarded. Lives are not restored from the snapshot: net life awards since the snapshot are removed, deaths stay spent. Full-level retry uses the same award accounting. Box rewards use a monotonic id instead of `Date.now()`.
- `coinTotal` counts map coins and `?` boxes (level 1 = 36).
- Ground enemies apply `y += vy * dt` before collision, land on soil, and only edge-turn while grounded.
- `boot()` after `destroy()` is ignored (React StrictMode). Pause uses the post-toggle phase so pausing does not simulate an extra step. Checkpoints arm only after enemy/hazard lethality in the same step; overlapping pickups and the goal are also skipped. Hitstop still latches a queued jump into the buffer so it is not dropped.
- Glide draws a ginkgo canopy above Pip (body proportions and hitbox unchanged). Secret leaf is its own leaf icon. Honey shield is a thin amber ring. Soil has a lighter per-tile grass top with world-aligned fill. Canvas respects `prefers-reduced-motion`. Title copy for saved progress is “回到第N关”, not a checkpoint continue.

## Tests actually run

- `npm test` — 20 passed (compile via `tsc` to `/tmp/leap-valley-tests`; Node 20 compatible)
- `npm run typecheck` — pass
- `npm run build` — pass (`dist/assets/index-dnfEkWRv.js`)
- `/tmp/leap-valley-independent-qa.mjs` — 9/9 passed
- `/tmp/leap-valley-lethal-checkpoint-qa.mjs` — `{dead:true,checkpoint:false,snapshotChanged:false,lives:2}`

Covered: input latch at 30/60/120/144Hz, single death debit, once-only box, coin totals for 3 levels, checkpoint pickup rollback, life-award farming, death arithmetic, manual retry lives, enemy gravity landing, overlapping same-step death vs checkpoint/pickup/goal, hitstop jump buffer, boot cancel, pause phase.

## Known limitations

- Coordinator visually checked desktop 1280×720; 390×844 portrait title/settings/pause/death/retry; 667×375 landscape pause and gameplay; 844×390 gameplay canvas/HUD/touch. Portrait clipping is fixed and the canvas stays undistorted and centered.
- Full three-level manual playthrough and real iPhone hardware were not verified. Do not treat this as a complete device or end-to-end play QA.
- Glide canopy and secret-leaf drawing code was reviewed; there is not full in-game visual coverage of every art state.
- Save data still stores last level only; there is no durable mid-level checkpoint.
- Title fonts still load from Google Fonts when the network is available; gameplay does not depend on that.

## Changed files

- `package.json`
- `tsconfig.test.json` (new)
- `scripts/run-tests.mjs` (new)
- `src/components/game-view.tsx`
- `src/styles.css`
- `src/game/game.ts`
- `src/game/sim.ts`
- `src/game/render.ts`
- `src/game/lifecycle.ts` (new)
- `src/game/motion.ts` (new)
- `src/game/gameplay.test.ts` (new)
- `src/game/input.test.ts` (new)
- `src/game/lifecycle.test.ts` (new)
- `REPAIR_NOTES.md` (new)

## Validation result

| Command | Result |
| --- | --- |
| `npm test` | 20 passed, 0 failed |
| `npm run typecheck` | pass |
| `npm run build` | pass (`dist/assets/index-dnfEkWRv.js`) |
| independent QA harness | 9/9 passed |
| lethal checkpoint harness | checkpoint false, snapshot unchanged, lives 2 |
| coordinator browser QA | passed for scoped viewports above |

This repair was published to `origin/main` after coordinator QA passed.
