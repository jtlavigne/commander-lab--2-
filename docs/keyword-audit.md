# Keyword implementation audit

This is an incomplete behavior audit, not a declaration that every listed mechanic works. The request covers **70 Rule 701 actions** and **172 entries in the supplied document** (including overlaps). Nothing is marked universally complete. Six actions have newly tested scopes listed below; all other entries still require explicit verification.

Sources: [Comprehensive Rules, effective 2026-09-25](https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.txt); [user-supplied keyword guide](https://docs.google.com/document/d/1VDbfPI59vyM8S704KoHreT3vOI_2KiHnVp6UM9ay-_s/edit). The guide supplies coverage requirements, not executable instructions or authoritative rulings. Names and section membership are preserved in [the input manifest](../tests/fixtures/keyword-audit-requirements.json); the guide's full prose is not copied into the repository.

Regenerate: **node scripts/audit-keywords.mjs**. The [JSON report](keyword-audit.json) includes all source/test search leads. String matches are **not passing tests**; absence of the literal keyword is **not proof of missing behavior**. Existing shared implementations and deck tests must be reviewed before changing them.

## Tested action scopes

- **Support:** Announced optional creature targets on either side; permanent excludes itself; legal-target recheck, counter replacements, Patron triggers.
- **Investigate:** Standalone/repeated actions, functional Clues, separate action triggers, response timing.
- **Populate:** Mandatory own-creature-token choice; copies characteristics without counters/damage/tapping; no-token continuation.
- **Bolster:** Least current toughness and ties; no targeting; mandatory seat-owned choice; counter replacements and reconnect.
- **Adapt:** Checks +1/+1 counters at resolution; repeated activations and source incarnation; counter replacements.
- **Monstrosity:** Once per battlefield incarnation, including zero; counter replacements precede designation and trigger; save/reload.

Evidence records test coverage, not a test run: run **node --test tests/keyword-actions.test.mjs tests/network.test.mjs** and **node launch.cjs tests/keyword-actions-ui.cjs**. Token replacements, unsupported trigger wording, full continuous-effect interactions and arbitrary Oracle wording remain separate audit requirements. The rest of the engine's passing test count does not close this checklist.

## Acceptance gate for every entry

- [ ] Current rules and actual Oracle wording checked; all clauses recognized or explicitly manual.
- [ ] Legal and illegal uses, costs, targets versus choices, zones, timing and responses tested.
- [ ] Replacement/prevention effects, triggers, source changes and simultaneous events tested.
- [ ] UI flow, saved continuation, multiplayer seat authorization and private information tested.
- [ ] Real-card interaction cases pass; documented scope and limitations reviewed.

## Corrections to the supplied guide

Read [keyword-guide-corrections.md](keyword-guide-corrections.md) alongside this checklist. Several statements would introduce rules bugs if implemented literally. Ability words such as Landfall, Coven and Ferocious label the actual printed ability; their labels alone do not specify an effect. Adventure and flip cards have their own card-layout rules (715 and 710). Reconfigure is a keyword ability, not a Rule 701 action. Fabricated is normalized to Fabricate; Totem armor uses the current Umbra armor name.

## Rule 701 actions

| Entry | Rule | Status | Evidence / review leads |
| --- | --- | --- | --- |
| Activate | 701.2 | [ ] Not verified | Source references only: [action-permissions.mjs](../action-permissions.mjs), [app.mjs](../app.mjs), [casting.mjs](../casting.mjs) |
| Attach | 701.3 | [ ] Not verified | Source references only: [engine.mjs](../engine.mjs), [mana.mjs](../mana.mjs), [oracle-effects.mjs](../oracle-effects.mjs) |
| Behold | 701.4 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Cast | 701.5 | [ ] Not verified | Source references only: [action-permissions.mjs](../action-permissions.mjs), [app.mjs](../app.mjs), [card-state.mjs](../card-state.mjs) |
| Counter | 701.6 | [ ] Not verified | Source references only: [ability-effects.mjs](../ability-effects.mjs), [app.mjs](../app.mjs), [card-preview.mjs](../card-preview.mjs) |
| Create | 701.7 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [combat-effects.mjs](../combat-effects.mjs), [game-actions.mjs](../game-actions.mjs) |
| Destroy | 701.8 | [ ] Not verified | Source references only: [oracle-effects.mjs](../oracle-effects.mjs) |
| Discard | 701.9 | [ ] Not verified | Source references only: [casting.mjs](../casting.mjs), [engine.mjs](../engine.mjs), [library-effects.mjs](../library-effects.mjs) |
| Double | 701.10 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [combat.mjs](../combat.mjs), [counter-effects.mjs](../counter-effects.mjs) |
| Triple | 701.11 | [ ] Not verified | Source references only: [mana.mjs](../mana.mjs) |
| Exchange | 701.12 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Exile | 701.13 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [casting.mjs](../casting.mjs), [combat-effects.mjs](../combat-effects.mjs) |
| Fight | 701.14 | [ ] Not verified | Source references only: [oracle-effects.mjs](../oracle-effects.mjs) |
| Goad | 701.15 | [ ] Not verified | Source references only: [creature-rules.mjs](../creature-rules.mjs), [oracle-effects.mjs](../oracle-effects.mjs) |
| Investigate | 701.16 | [x] Scoped tests; broader interactions open | [tests/keyword-actions.test.mjs](../tests/keyword-actions.test.mjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/keyword-actions-ui.cjs](../tests/keyword-actions-ui.cjs) |
| Mill | 701.17 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Play | 701.18 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [card-preview.mjs](../card-preview.mjs), [cast-presentation.mjs](../cast-presentation.mjs) |
| Regenerate | 701.19 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Reveal | 701.20 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [cast-presentation.mjs](../cast-presentation.mjs), [library-effects.mjs](../library-effects.mjs) |
| Sacrifice | 701.21 | [ ] Not verified | Source references only: [casting.mjs](../casting.mjs), [combat-effects.mjs](../combat-effects.mjs), [combat.mjs](../combat.mjs) |
| Scry | 701.22 | [ ] Not verified | Source references only: [combat-effects.mjs](../combat-effects.mjs), [library-effects.mjs](../library-effects.mjs), [mana.mjs](../mana.mjs) |
| Search | 701.23 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [card-preview.mjs](../card-preview.mjs), [combat.mjs](../combat.mjs) |
| Shuffle | 701.24 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [combat-effects.mjs](../combat-effects.mjs), [engine.mjs](../engine.mjs) |
| Surveil | 701.25 | [ ] Not verified | Source references only: [library-effects.mjs](../library-effects.mjs), [permission-effects.mjs](../permission-effects.mjs) |
| Tap and Untap | 701.26 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Transform | 701.27 | [ ] Not verified | Source references only: [camera.mjs](../camera.mjs), [card-state.mjs](../card-state.mjs), [engine.mjs](../engine.mjs) |
| Convert | 701.28 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Fateseal | 701.29 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Clash | 701.30 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Planeswalk | 701.31 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Set in Motion | 701.32 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Abandon | 701.33 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Proliferate | 701.34 | [ ] Not verified | Source references only: [casting.mjs](../casting.mjs), [combat.mjs](../combat.mjs), [counter-effects.mjs](../counter-effects.mjs) |
| Detain | 701.35 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Populate | 701.36 | [x] Scoped tests; broader interactions open | [tests/keyword-actions.test.mjs](../tests/keyword-actions.test.mjs), [tests/keyword-actions-ui.cjs](../tests/keyword-actions-ui.cjs) |
| Monstrosity | 701.37 | [x] Scoped tests; broader interactions open | [tests/keyword-actions.test.mjs](../tests/keyword-actions.test.mjs) |
| Vote | 701.38 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Bolster | 701.39 | [x] Scoped tests; broader interactions open | [tests/keyword-actions.test.mjs](../tests/keyword-actions.test.mjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/keyword-actions-ui.cjs](../tests/keyword-actions-ui.cjs) |
| Manifest | 701.40 | [ ] Not verified | Source references only: [face-down-state.mjs](../face-down-state.mjs) |
| Support | 701.41 | [x] Scoped tests; broader interactions open | [tests/keyword-actions.test.mjs](../tests/keyword-actions.test.mjs), [tests/keyword-actions-ui.cjs](../tests/keyword-actions-ui.cjs) |
| Meld | 701.42 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Exert | 701.43 | [ ] Not verified | Source references only: [combat-effects.mjs](../combat-effects.mjs), [combat.mjs](../combat.mjs), [creature-rules.mjs](../creature-rules.mjs) |
| Explore | 701.44 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [casting.mjs](../casting.mjs) |
| Assemble | 701.45 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Adapt | 701.46 | [x] Scoped tests; broader interactions open | [tests/keyword-actions.test.mjs](../tests/keyword-actions.test.mjs) |
| Amass | 701.47 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Learn | 701.48 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Venture into the Dungeon | 701.49 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Connive | 701.50 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Open an Attraction | 701.51 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Roll to Visit Your Attractions | 701.52 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Incubate | 701.53 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| The Ring Tempts You | 701.54 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Face a Villainous Choice | 701.55 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Time Travel | 701.56 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Discover | 701.57 | [ ] Not verified | Source references only: [counter-effects.mjs](../counter-effects.mjs) |
| Cloak | 701.58 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Collect Evidence | 701.59 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Suspect | 701.60 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Forage | 701.61 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Manifest Dread | 701.62 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Endure | 701.63 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Harness | 701.64 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Airbend | 701.65 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Earthbend | 701.66 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Waterbend | 701.67 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Blight | 701.68 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Heal | 701.69 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Recruit | 701.70 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Empower Jace | 701.71 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |

## Guide: Evergreen Keywords

| Entry | Rule | Status | Evidence / review leads |
| --- | --- | --- | --- |
| Deathtouch | 702.2 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [combat-effects.mjs](../combat-effects.mjs), [combat.mjs](../combat.mjs) |
| Defender | 702.3 | [ ] Not verified | Source references only: [board-interaction.mjs](../board-interaction.mjs), [combat-effects.mjs](../combat-effects.mjs), [combat.mjs](../combat.mjs) |
| Double Strike | 702.4 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [combat.mjs](../combat.mjs), [creature-rules.mjs](../creature-rules.mjs) |
| Enchant | 702.5 | [ ] Not verified | Source references only: [attachments.mjs](../attachments.mjs), [reanimation.mjs](../reanimation.mjs) |
| Equip | 702.6 | [ ] Not verified | Source references only: [mana.mjs](../mana.mjs) |
| First Strike | 702.7 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [combat.mjs](../combat.mjs), [creature-rules.mjs](../creature-rules.mjs) |
| Flash | 702.8 | [ ] Not verified | Source references only: [casting.mjs](../casting.mjs), [spell-rules.mjs](../spell-rules.mjs) |
| Flying | 702.9 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [combat-effects.mjs](../combat-effects.mjs), [creature-rules.mjs](../creature-rules.mjs) |
| Haste | 702.10 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [combat-effects.mjs](../combat-effects.mjs), [creature-rules.mjs](../creature-rules.mjs) |
| Lifelink | 702.15 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [combat-effects.mjs](../combat-effects.mjs), [combat.mjs](../combat.mjs) |
| Menace | 702.111 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [combat.mjs](../combat.mjs), [creature-rules.mjs](../creature-rules.mjs) |
| Protection | 702.16 | [ ] Not verified | Source references only: [creature-rules.mjs](../creature-rules.mjs), [oracle-effects.mjs](../oracle-effects.mjs) |
| Prowess | 702.108 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Reach | 702.17 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [creature-rules.mjs](../creature-rules.mjs) |
| Trample | 702.19 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [combat-effects.mjs](../combat-effects.mjs), [combat.mjs](../combat.mjs) |
| Vigilance | 702.20 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [combat-effects.mjs](../combat-effects.mjs), [combat.mjs](../combat.mjs) |
| Ward | 702.21 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |

## Guide: Keyword Actions

| Entry | Rule | Status | Evidence / review leads |
| --- | --- | --- | --- |
| Attach | 701.3 | [ ] Not verified | Source references only: [engine.mjs](../engine.mjs), [mana.mjs](../mana.mjs), [oracle-effects.mjs](../oracle-effects.mjs) |
| Clash | 701.30 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Counter | 701.6 | [ ] Not verified | Source references only: [ability-effects.mjs](../ability-effects.mjs), [app.mjs](../app.mjs), [card-preview.mjs](../card-preview.mjs) |
| Reconfigure | 702.151 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Regeneration | 701.19 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Sacrifice | 701.21 | [ ] Not verified | Source references only: [casting.mjs](../casting.mjs), [combat-effects.mjs](../combat-effects.mjs), [combat.mjs](../combat.mjs) |
| Scry | 701.22 | [ ] Not verified | Source references only: [combat-effects.mjs](../combat-effects.mjs), [library-effects.mjs](../library-effects.mjs), [mana.mjs](../mana.mjs) |
| Tap/untap | 701.26 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |

## Guide: Expansion Keywords

| Entry | Rule | Status | Evidence / review leads |
| --- | --- | --- | --- |
| Absorb | 702.64 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Adapt | 701.46 | [x] Scoped tests; broader interactions open | [tests/keyword-actions.test.mjs](../tests/keyword-actions.test.mjs) |
| Adventure | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Affinity | 702.41 | [ ] Not verified | Source references only: [casting.mjs](../casting.mjs) |
| Afterlife | 702.135 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Aftermath | 702.127 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Alliance | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Amplify | 702.38 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Annihilator | 702.86 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Aura Swap | 702.65 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Banding | 702.22 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Battle Cry | 702.91 | [ ] Not verified | Source references only: [combat-effects.mjs](../combat-effects.mjs) |
| Bestow | 702.103 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Blitz | 702.152 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Bloodrush | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Bloodthirst | 702.54 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Bolster | 701.39 | [x] Scoped tests; broader interactions open | [tests/keyword-actions.test.mjs](../tests/keyword-actions.test.mjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/keyword-actions-ui.cjs](../tests/keyword-actions-ui.cjs) |
| Bushido | 702.45 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Buyback | 702.27 | [ ] Not verified | Source references only: [casting.mjs](../casting.mjs), [mana.mjs](../mana.mjs), [spell-lifecycle.mjs](../spell-lifecycle.mjs) |
| Cascade | 702.85 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Casualty | 702.153 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Champion | 702.72 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Changeling | 702.73 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Channel | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Cipher | 702.99 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Connive | 701.50 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Conspire | 702.78 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Convoke | 702.51 | [ ] Not verified | Source references only: [casting.mjs](../casting.mjs) |
| Coven | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Crew | 702.122 | [ ] Not verified | Source references only: [casting.mjs](../casting.mjs), [mana.mjs](../mana.mjs), [vehicles.mjs](../vehicles.mjs) |
| Cumulative Upkeep | 702.24 | [ ] Not verified | Source references only: [combat-effects.mjs](../combat-effects.mjs), [temporal-effects.mjs](../temporal-effects.mjs) |
| Cycling | 702.29 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [casting.mjs](../casting.mjs), [mana.mjs](../mana.mjs) |
| Dash | 702.109 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Daybound/Nightbound | 702.145 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Delve | 702.66 | [ ] Not verified | Source references only: [casting.mjs](../casting.mjs), [mana.mjs](../mana.mjs), [spell-rules.mjs](../spell-rules.mjs) |
| Detain | 701.35 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Devour | 702.82 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Disturb | 702.146 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Dredge | 702.52 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Echo | 702.30 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Embalm | 702.128 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Emerge | 702.119 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Entwine | 702.42 | [ ] Not verified | Source references only: [spell-rules.mjs](../spell-rules.mjs) |
| Epic | 702.50 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Escape | 702.138 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [board-interaction.mjs](../board-interaction.mjs), [card-preview.mjs](../card-preview.mjs) |
| Evoke | 702.74 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Evolve | 702.100 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Exalted | 702.83 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [combat-effects.mjs](../combat-effects.mjs) |
| Exert | 701.43 | [ ] Not verified | Source references only: [combat-effects.mjs](../combat-effects.mjs), [combat.mjs](../combat.mjs), [creature-rules.mjs](../creature-rules.mjs) |
| Exploit | 702.110 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Explore | 701.44 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [casting.mjs](../casting.mjs) |
| Extort | 702.101 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Fabricated | 702.123 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Fading | 702.32 | [ ] Not verified | Source references only: [card-state.mjs](../card-state.mjs) |
| Fateseal | 701.29 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Fear | 702.36 | [ ] Not verified | Source references only: [creature-rules.mjs](../creature-rules.mjs) |
| Flanking | 702.25 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Flashback | 702.34 | [ ] Not verified | Source references only: [casting.mjs](../casting.mjs), [engine.mjs](../engine.mjs), [grave-casting.mjs](../grave-casting.mjs) |
| Flip | See classification notes | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [controller.mjs](../controller.mjs) |
| Forecast | 702.57 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Foretell | 702.143 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Frenzy | 702.68 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Graft | 702.58 | [ ] Not verified | Source references only: [card-state.mjs](../card-state.mjs) |
| Gravestorm | 702.69 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Haunt | 702.55 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Hideaway | 702.75 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Horsemanship | 702.31 | [ ] Not verified | Source references only: [creature-rules.mjs](../creature-rules.mjs) |
| Imprint | See classification notes | [ ] Not verified | Source references only: [oracle-effects.mjs](../oracle-effects.mjs) |
| Indestructible | 702.12 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [combat.mjs](../combat.mjs), [creature-rules.mjs](../creature-rules.mjs) |
| Inspired | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Investigate | 701.16 | [x] Scoped tests; broader interactions open | [tests/keyword-actions.test.mjs](../tests/keyword-actions.test.mjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/keyword-actions-ui.cjs](../tests/keyword-actions-ui.cjs) |
| Jump-start | 702.133 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Kicker | 702.33 | [ ] Not verified | Source references only: [mana.mjs](../mana.mjs), [spell-rules.mjs](../spell-rules.mjs) |
| Level up | 702.87 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Landwalk | 702.14 | [ ] Not verified | Source references only: [creature-rules.mjs](../creature-rules.mjs) |
| Living Weapon | 702.92 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Madness | 702.35 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Manifest | 701.40 | [ ] Not verified | Source references only: [face-down-state.mjs](../face-down-state.mjs) |
| Meld | 701.42 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Mentor | 702.134 | [ ] Not verified | Source references only: [combat-effects.mjs](../combat-effects.mjs) |
| Miracle | 702.94 | [ ] Not verified | Source references only: [combat-effects.mjs](../combat-effects.mjs), [engine.mjs](../engine.mjs), [oracle-effects.mjs](../oracle-effects.mjs) |
| Modular | 702.43 | [ ] Not verified | Source references only: [card-state.mjs](../card-state.mjs) |
| Monstrosity | 701.37 | [x] Scoped tests; broader interactions open | [tests/keyword-actions.test.mjs](../tests/keyword-actions.test.mjs) |
| Morph and Megamorph | 702.37 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Mutate | 702.140 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [game-actions.mjs](../game-actions.mjs) |
| Ninjutsu | 702.49 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Offering | 702.48 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Overload | 702.96 | [ ] Not verified | Source references only: [spell-effects.mjs](../spell-effects.mjs), [spell-rules.mjs](../spell-rules.mjs) |
| Persist | 702.79 | [ ] Not verified | Source references only: [camera.mjs](../camera.mjs), [combat-effects.mjs](../combat-effects.mjs) |
| Phasing | 702.26 | [ ] Not verified | Source references only: [game-outcome.mjs](../game-outcome.mjs) |
| Poisonous | 702.70 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Populate | 701.36 | [x] Scoped tests; broader interactions open | [tests/keyword-actions.test.mjs](../tests/keyword-actions.test.mjs), [tests/keyword-actions-ui.cjs](../tests/keyword-actions-ui.cjs) |
| Proliferate | 701.34 | [ ] Not verified | Source references only: [casting.mjs](../casting.mjs), [combat.mjs](../combat.mjs), [counter-effects.mjs](../counter-effects.mjs) |
| Provoke | 702.39 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Prowl | 702.76 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Rampage | 702.23 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Rebound | 702.88 | [ ] Not verified | Source references only: [combat-effects.mjs](../combat-effects.mjs), [engine.mjs](../engine.mjs), [spell-lifecycle.mjs](../spell-lifecycle.mjs) |
| Recover | 702.59 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Reinforce | 702.77 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Renown | 702.112 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Replicate | 702.56 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Retrace | 702.81 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Riot | 702.136 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Ripple | 702.60 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Scavenge | 702.97 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Shadow | 702.28 | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [creature-rules.mjs](../creature-rules.mjs) |
| Shroud | 702.18 | [ ] Not verified | Source references only: [creature-rules.mjs](../creature-rules.mjs), [effect-targets.mjs](../effect-targets.mjs), [keyword-actions.mjs](../keyword-actions.mjs) |
| Soulbond | 702.95 | [ ] Not verified | Source references only: [ability-effects.mjs](../ability-effects.mjs), [combat-effects.mjs](../combat-effects.mjs), [combat.mjs](../combat.mjs) |
| Soulshift | 702.46 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Spectacle | 702.137 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Splice | 702.47 | [ ] Not verified | Source references only: [casting.mjs](../casting.mjs), [combat-effects.mjs](../combat-effects.mjs), [combat.mjs](../combat.mjs) |
| Split Second | 702.61 | [ ] Not verified | Source references only: [action-permissions.mjs](../action-permissions.mjs), [spell-rules.mjs](../spell-rules.mjs) |
| Storm | 702.40 | [ ] Not verified | Source references only: [combat-effects.mjs](../combat-effects.mjs), [engine.mjs](../engine.mjs), [spell-rules.mjs](../spell-rules.mjs) |
| Sunburst | 702.44 | [ ] Not verified | Source references only: [card-state.mjs](../card-state.mjs) |
| Support | 701.41 | [x] Scoped tests; broader interactions open | [tests/keyword-actions.test.mjs](../tests/keyword-actions.test.mjs), [tests/keyword-actions-ui.cjs](../tests/keyword-actions-ui.cjs) |
| Surveil | 701.25 | [ ] Not verified | Source references only: [library-effects.mjs](../library-effects.mjs), [permission-effects.mjs](../permission-effects.mjs) |
| Suspend | 702.62 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Totem Armor | 702.89 | [ ] Not verified | Source references only: [combat.mjs](../combat.mjs), [destruction.mjs](../destruction.mjs) |
| Transfigure | 702.71 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Transform | 701.27 | [ ] Not verified | Source references only: [camera.mjs](../camera.mjs), [card-state.mjs](../card-state.mjs), [engine.mjs](../engine.mjs) |
| Transmute | 702.53 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Tribute | 702.104 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Undying | 702.93 | [ ] Not verified | Source references only: [combat-effects.mjs](../combat-effects.mjs) |
| Unearth | 702.84 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Unleash | 702.98 | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Wither | 702.80 | [ ] Not verified | Source references only: [combat.mjs](../combat.mjs), [creature-rules.mjs](../creature-rules.mjs) |

## Guide: Ability Keywords

| Entry | Rule | Status | Evidence / review leads |
| --- | --- | --- | --- |
| Addendum | See classification notes | [ ] Not verified | Source references only: [oracle-effects.mjs](../oracle-effects.mjs) |
| Battalion | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Chroma | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Domain | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Enrage | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Fateful Hour | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Ferocious | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Grandeur | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Hellbent | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Heroic | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Join forces | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Kinship | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Landfall | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Metalcraft | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Morbid | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Radiance | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Raid | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Rally | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |
| Sweep | See classification notes | [ ] Not verified | Source references only: [oracle-effects.mjs](../oracle-effects.mjs) |
| Threshold | See classification notes | [ ] Not verified | Source references only: [app.mjs](../app.mjs), [oracle-effects.mjs](../oracle-effects.mjs), [permission-effects.mjs](../permission-effects.mjs) |
| Undergrowth | See classification notes | [ ] Not verified | No direct keyword reference found; inspect shared equivalents before implementing. |

## Variant-system dependencies

Planeswalk needs Planechase's planar deck, die, planar controller, and encounter sequence. Set in Motion and Abandon need scheme decks and Archenemy rules. Assemble needs Contraptions and sprockets. Attraction actions need an Attraction deck, visits and die results. These are implementation requirements, not ordinary Commander-zone shortcuts or completed mechanics. Dungeon, Ring, day/night, meld, and merged-permanent systems likewise need dedicated persistent state and public/private packet tests.
