# Code structure and refactoring boundaries

The app keeps gameplay data separate from renderer state and network transport.
The module boundaries below are the starting points for changes; generated deck
lists, Oracle fixtures, artwork and audit output should retain their source formats.

| Area | Responsibility |
| --- | --- |
| `engine.mjs` | Table construction, zone changes, turn boundaries and save validation. `beginNextTurn` shares turn setup between normal advancement and the end-turn command. |
| `game-actions.mjs` | Applies gameplay commands to a copy so rejected actions cannot partially change the game. |
| `multiplayer/` | Authorizes commands, projects seat-specific information and synchronizes accepted state. |
| `oracle-effects.mjs` | Compiles supported Oracle instructions, runs their programs and saves pending choices. Unsupported wording remains manual. |
| `effect-dispatch.mjs` | Routes specialized operations to their effect family and normalizes continuation results. |
| `*-effects.mjs`, `casting.mjs`, `combat.mjs`, `mana.mjs` | Shared rules for costs, targets, replacements, triggers and resolution. |
| `app.mjs`, `*-ui.mjs` | Renderer state, interaction and presentation; gameplay changes go through commands. |
| `ui-dom.mjs` | Shared text-safe element/button creation and module-relative stylesheets. Specialized controls own their event handling and busy state. |
| `main.cjs`, `preload.cjs`, `app-updates.cjs` | Desktop lifecycle, sandboxed IPC and user-confirmed release updates. |
| `scripts/`, `tests/`, `docs/` | Import/audit/build tooling, behavior checks and evidence of supported rules. |

## Adding effect operations

Keep each operation's existing serializable shape. Add it to its family's
operation list and implement its runner. The dispatcher creates its lookup once,
after module initialization, and rejects duplicate operation names. Families that
also advertise instructions handled by the central interpreter can return
`EFFECT_UNHANDLED` to let that interpreter continue.

`EFFECT_CONTINUE` means only the current instruction finished. `EFFECT_STOP`
means a pending choice or nested continuation owns the rest of the program;
running that remainder again would duplicate effects. The dispatcher adapts the
older copy and temporal runners to this contract. Response windows, deferred
triggers, ownership and source identity remain the responsibility of gameplay
modules, not the dispatcher or UI helpers.

## Checking changes

Run `npm test` for gameplay, validation and network tests. `npm run test:ui`
discovers `tests/*-ui.cjs` plus `tests/ui.cjs` and runs them sequentially in fresh
processes. The profile check starts its own Electron processes from Node; other
checks use `launch.cjs`. Existing focused `test:ui:*` commands remain available.

UI refactors should preserve selectors, text, accessibility attributes and action
dispatch. Turn refactors should preserve the order of cleanup, player handoff,
phasing, reset of per-turn allowances, automatic actions and combat/phase events.
