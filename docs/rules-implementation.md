# Rules implementation

The supplied Commander CSV fixtures define 39 deck scenarios. Work proceeds in manifest order: fetch a deck's Oracle data, implement shared rules and actions, add real-card scenarios, run unit and UI checks, then proceed to the next deck. A fixture label is not a passing test.

The maintained [deck-by-deck checklist](commander-deck-checklist.md) contains focused acceptance criteria for all 39 decks and every card in each deck. Fetched decks include individual Oracle paragraphs, including separate split-card faces, and checked test evidence. Status is stored in `tests/fixtures/commander/checklist-progress.json`; regenerate the document with `npm.cmd run checklist`. Supplied coverage CSV statuses remain an unchanged baseline; the checklist is the maintained status. Decks remain incomplete until every action audit and final verification passes.

The active deck source is `commander_test_decks_color_fixes.csv`: 17 Nihil Spellbomb entries become Unlicensed Hearse, and Kenrith's Dockside Extortionist becomes Tireless Provisioner. All 39 decks retain their IDs, quantities, roles and 100-card totals. Previously verified actions remain checked; replacement-card Oracle, action and renderer audits remain pending. Earlier completion records are preserved in `checklist-progress.json` under `previous_revisions`.

Revision integration verified with **482 passing unit tests** and the Electron lobby workflow, including revised Niv-Mizzet, Zedruu and Kenrith picker contents. Premade generation, Oracle fetching and checklist generation share `scripts/deck-source.mjs`. `tests/deck-source.test.mjs` checks all 3,271 rows, all 39 lists and the exact 18 replacements. The copied fixture matches the supplied CSV byte-for-byte. Existing sessions require deck reimport to adopt the updated contents.

The user’s corrected `commander_test_decks_names_fixed.csv` was the prior active deck source. All 3,271 rows retain their original deck IDs, quantities and roles. Three names changed: Commander Sphere → Commander's Sphere; Hurkyll's Recall → Hurkyl's Recall; Lim-Dul's Vault → Lim-Dûl's Vault. Originals remain preserved. Existing Oracle cache records are reused by canonical name.

## Latest verified checkpoint

The 2026-10-15 exact Atraxa and Jace lists are stored separately in `tests/fixtures/playtest-decks/` (100 cards each, 95/98 distinct names). Current Scryfall Oracle data recognizes every name. The generated [exact-deck audit](playtest-deck-audit.md) inventories every paragraph and separates existing checked evidence from missing handlers and unverified behavior. It does not certify either whole deck or replace the manifest queue.

This audit fixed shared inherited-loyalty discovery (Kasmina, Nicol Bolas, transitive grants and cycle handling), token-creation events for Staff of the Storyteller, named Kobolds, variable-size token artwork, Fractal counter placement through shared replacements, flexible draw-and-return-to-library instructions (Jace/Brainsurge), and draw/life/proliferate sequencing (Tezzeret/Vraska). Tests verify live removal of grants, shared loyalty limits, event batching, no opponent token triggers, multiplayer responses/reconnect, private hand choices and library order. **1,083 unit tests pass**; exact-deck, token-import, planeswalker and multiplayer Electron checks pass. Remaining diagnostics include emblems, phasing, polymorph sequences, extra turns, conditional token effects and additional static/trigger rules. See the exact-deck report for each unchecked paragraph. The 39-deck completion count remains 10.

Token reserves now load with deck imports: exact related Scryfall token IDs plus Oracle scanning for named artifact/enchantment and creature-token descriptions. Metadata and high-resolution artwork cache locally by ID, distinguishing same-name colors/stats/abilities. Shared token creation covers spells, triggers, manual reserve copies, Treasure and removal-effect gifts; copies preserve their original permanent's art. Templates remain outside zones/deck counts, survive reset/save, and are removed from opponents' packets. New public copies carry exact IDs for local artwork restoration. Tamiyo's Notebook creation supports both the older wording and the current Book subtype; its reduction uses the existing shared cost rules. Unsupported effects still require manual resolution, and missing art produces an explicit warning/text fallback. Existing decks need reimport.

Verification: **1,073 unit tests pass**, including real Scryfall Notebook and green Elf Warrior fixtures, cache reuse, variant matching, resolution/response timing, independent copies, import/reset validation, and a two-client private-reserve/reconnect scenario. The isolated Electron token test passes the real importer/preload/cache path, reserve selection, copying, artwork and reload; the existing multiplayer Electron workflow also passes. Run `npm.cmd run test:ui:tokens`. This feature does not advance the 39-deck completion count or claim the remainder of Tamiyo/Atraxa is implemented.

Manual library transfers now default to the top without shuffling. The shared placement helper validates one-based positions before moving, preserves every other card's order, supports bottom placement and same-library reordering, and honors zone replacements. The Alt inspector exposes bottom and numbered placement. Rules-effect transfer ordering and explicit shuffle instructions retain their existing behavior. Verification: **1,065 unit tests pass**, including local/shared order and invalid-position cases; the full Electron workflow verifies pinned-hand drag to top, inspector bottom/second placement and Undo, and the two-client multiplayer workflow passes. The UI pointer helper scrolls inspector controls into view before clicking. Logs: `.qa/library-placement-unit.txt`, `.qa/library-placement-ui.txt`, `.qa/library-placement-network-ui.txt`.

Multiplayer library browsing now opens an explicit, owner-only manual search instead of rejecting every library click. Shared commands persist the search through reconnect, reveal library identities only to that seat, and move selected cards rather than normalizing all library moves into top-card draws. Finish with or without shuffling conceals the library again; phase advancement and manual-effect acknowledgment wait for completion. The manual resolution panel has a Search library button and releases its focus overlay while searching. Automated search choices retain their rules restrictions and now include a name filter that preserves selected-card order. Verification: **1,062 unit tests pass**; the two-client Electron test covers cast/response/manual tutor resolution, private browsing, filtering, and non-top-card drag; the Goreclaw workflow verifies Cultivate filtering and ordered placement. Logs: `.qa/library-search-unit.txt`, `.qa/library-search-network-ui.txt`, `.qa/library-search-effect-ui.txt`. Deck audit status remains unchanged.

Auto untap/draw is now a saved per-player preference. Hotseat selection updates the checkbox; shared clients can change only their own seat, including non-host players. Engine advancement and empty-phase skipping consult the active player after handoffs. Resets and seat-count changes preserve preferences; older hosted checkpoints migrate their table default to individual seats. Changing a preference does not advance a turn or resolve a pending choice. Verification: **1,060 unit tests pass**, plus hotseat (2/3/4 players) and two-window multiplayer Electron checks, including peer toggles, host isolation, authorization and reload persistence. Logs: `.qa/player-automatic-unit.txt`, `.qa/player-automatic-hotseat.txt`, `.qa/player-automatic-network.txt`. Deck audit status remains unchanged.

Responses now has an explicit per-seat selector for Prompt, Auto, and Pass all. Pass all ignores optional response availability and persists until changed, including save/reset/reconnect. It does not bypass pending resolution/entry choices, attack/block decisions, or main-phase plays. Shared authorization prevents changing another seat. Verification: **1,054 unit tests pass**, including 2/3/4-seat response scenarios and a three-client reconnect with a playable answer declined; mana, hotseat, and two-window multiplayer Electron workflows pass. The multiplayer reset test now confirms starting hands before reimporting, matching the earlier readiness change. Logs: `.qa/pass-all-unit.txt`, `.qa/pass-all-mana-ui.txt`, `.qa/pass-all-hotseat-ui.txt`, `.qa/pass-all-network-ui.txt`. Deck audit status remains unchanged.

Keyword presentation now follows the user-supplied 19-keyword reference, including ward, prowess, changeling and affinity. Other mechanics and keyword actions (including equip, cycling, compleated, scry and proliferate) no longer add footer badges, even when present in metadata or granted on the battlefield. This changes display only. Verification: all 9 keyword unit tests and the Electron keyword workflow pass (`tests/keyword-icons.test.mjs`, `tests/keyword-icons-ui.cjs`, `.qa/normal-keywords-ui.txt`). Earlier broader-vocabulary notes below are historical. Deck audit status is unchanged.

Cast-to-entry metadata now preserves chosen X, actual colors spent, and the Phyrexian portion of life payment separately from other life costs. Tamiyo and Vraska initialize reduced loyalty after resolution; blink/reanimation restores their printed loyalty, and changing control preserves their current counters. Supported exact-X entry clauses and sunburst use the casting record, which survives reload and three-client reconnect. A copied spell keeps X but has no mana spent for sunburst. Verification: **1,045 unit tests pass**, including 12 `tests/entry-casting.test.mjs` cases and a new real three-client test, plus the expanded `tests/counter-effects-ui.cjs` workflow. Logs: `.qa/entry-casting-all-unit.txt`, `.qa/entry-casting-ui.txt`. Rules references: [ONE release notes](https://magic.wizards.com/en/news/feature/phyrexia-all-will-be-one-release-notes) and [CR 707.10](https://media.wizards.com/2026/downloads/MagicCompRules%2020260619.pdf). This is a partial entry milestone: entering counters still bypass external counter replacements. Compleated reduction must join that replacement event so the affected player can order it against doubling/other changes; its checklist paragraph remains unchecked until those combinations and entry-trigger timing pass. No new deck was fetched; **10/39** remain complete.

Starting-hand correction: the Ready button now keeps, bottoms the required London cards, and confirms in one action. Fresh direct-table imports open verification when every seat has a deck; Reset game and the explicit Starting hands button reopen it after confirmation. Alt inspection now works in modal card choices and combat views, preserves the current choice, and keeps the preview above the modal while respecting private hands. Verification: **1,032 unit tests pass**; two-client/three-seat lobby and direct-table workflows, focused scry and combat, plus existing board/hand, keyword, mana and planeswalker Electron checks pass. The starting-hand Alt screenshot was visually reviewed (fixture artwork is deliberately blank). Evidence: `.qa/starting-focus-unit.txt`, `.qa/starting-focus-lobby.txt`, `.qa/starting-focus-spells.txt`, `.qa/starting-focus-board.txt`, `.qa/starting-focus-ui-trace.txt`, `.qa/starting-focus-keywords.txt`, `.qa/starting-focus-mana.txt`, `.qa/starting-focus-walker.txt`. This supersedes the earlier two-button Keep / Confirm ready flow.

Atraxa progress: Tekuthal's activation uses shared distributed counter-removal costs, validates eligible controlled permanents and exact quantities before payment, supports chosen mana / Phyrexian life payments, and places its indestructible counter only when the ability resolves. Costs survive countering; depleted loyalty donors die while the ability remains on the stack. Replacement choices, stale battlefield identities, authority and reconnect are covered. Evidence: 11 `tests/counter-costs.test.mjs` scenarios, `tests/counter-effects-ui.cjs`, and the real three-client scenario in `tests/network.test.mjs`; `.qa/tekuthal-ui.txt` and the 1,032-test run above. Only Tekuthal's activation paragraph is checked in this batch. Entry/damage counter paths and the remaining Atraxa families are still pending; completion remains **10/39**.

Opening hands now have host-configurable London, extra-free and unlimited-free house rules, round-based redraws, ordered London bottoming, and per-seat keep/ready confirmations. Shared reducers block gameplay until every seat is ready; reload and socket reconnect preserve choices without exposing private card IDs. Lobby resets restart opening hands, and turn announcements wait for readiness. Verification: **1,018 unit tests pass**, plus the two-window/three-seat lobby and turn-presentation Electron workflows. Evidence: `tests/opening-hand.test.mjs`, `tests/lobby.test.mjs`, `tests/lobby-ui.cjs`, `.qa/opening-all-unit.txt`, `.qa/opening-lobby-ui.txt`, `.qa/opening-turn-ui.txt`. The opening-hand screenshot was visually reviewed. Deck audit status remains unchanged.

Keyword presentation adds original SVG badges to visible card footers, with hover labels, overflow names and active-face/privacy checks. Battlefield queries reuse the shared continuous-keyword calculation; off-board previews exclude battlefield grants. Unmapped recognized keywords use a generic pictogram. Verification: **1,008 unit tests pass**, plus the new keyword Electron workflow and existing card-motion and board-interface workflows. The keyword screenshot was visually reviewed. This change does not advance deck audits or implement additional keyword rules.

Gameplay choices now use a transparent dialog over a dimmed/desaturated table, with selectable card previews for scry and other card choices. Combat uses one central overlay with per-seat attacker groups, card-based blocker assignments/removal, projected remaining toughness, and a fixed confirmation row above the hand dock. It no longer requires expanding the old combat panel or selecting blockers from dropdowns. Verification: **1,000 unit tests and all 30 registered Electron workflows pass**. The initial full run passed six workflows before the new scry-preview click test exposed a label association bug; after fixing it, the scry workflow and all 23 remaining workflows passed. Logs: `.qa/focus-all-unit.txt`, `.qa/focus-all-ui.txt`, `.qa/focus-spell-ui.txt`, `.qa/focus-remaining-ui.txt`. Screenshots of the combat overlay and scry focus were visually reviewed. Deck completion remains **10/39**, with Atraxa in progress.

Atraxa's loyalty-cost batch routes positive activation costs through the shared counter replacement plan before response priority, including mana-producing and granted loyalty abilities. Doubling Season alone does not modify costs; another replacement can make it applicable under CR 614.16. Choices persist through renderer reload and a three-client reconnect, and only the affected controller may submit them. Negative costs preserve zero loyalty so a depleted planeswalker leaves while its activated ability remains on the stack. Verification: **1,000 unit tests**, including 37 counter scenarios and 43 networking scenarios, plus counter/planeswalker/mana Electron workflows. Logs: `.qa/loyalty-cost-unit.txt`, `.qa/loyalty-cost-network.txt`, `.qa/loyalty-cost-ui.txt`. Entry/damage counters, removal costs and the remaining Atraxa action families still prevent completing the deck; the next deck has not been fetched.

Card presentation now animates tap/untap and rendered-face changes, including the double-faced card inspector action. A persistent, noninteractive tap-symbol badge appears on tapped battlefield cards beneath counters and stats. Animation progress survives ordinary table redraws; rapid tap reversals start at the current visual angle. Seat/session changes discard saved faces, and reduced motion applies state changes immediately. Verification: **987 unit tests**, the new `tests/card-motion-ui.cjs` workflow, and the existing mana and turn/draw multiplayer presentation workflows pass. The dedicated test checks face changes, redraw continuity, badge cleanup/persistence, rapid reversal, seat changes, reduced motion and reload. Logs: `.qa/card-motion-unit.txt`, `.qa/card-motion-ui.txt`, `.qa/card-motion-mana-ui.txt`, `.qa/card-motion-turn-ui.txt`. No deck audit status changes.

Available-mana highlights now combine each seat's floating pool with supported untapped land activations, including hand and command-zone spells and response-popup options. The preview uses shared payment, color-fixing, source-output and commander-tax rules; actual casting still requires paying from the real pool. One bounded search per seat/render avoids repeating the search for each card. Unknown production and sacrifice, exile, discard or counter activation costs require activating the source first. Verification: **987 unit tests pass**, including 12 new preview scenarios; the Electron mana workflow verifies highlighting, source funding inside the payment dialog and command-zone tax, and the cast-popup workflow passes for 2/3/4 seats. Logs: `.qa/available-mana-unit.txt`, `.qa/available-mana-ui.txt`, `.qa/available-mana-popup-ui.txt`. This interface addition does not complete another deck audit.

Interface addition: new turns display a nonblocking named announcement, and successful draws animate card backs from the library to the appropriate hand. Presentation reads public draw counts without publishing card identities or changing gameplay packets. Opening-hand setup, searches, ordinary transfers and session reloads do not replay draw flights. Reduced-motion preferences use a fade. Verification: **939 unit tests pass**, plus the turn-presentation, 2/3/4-seat hotseat and two-client multiplayer Electron workflows. This interface check does not advance any deck's rules audit.

**10 of 39 decks complete for their stated scenarios:** Goreclaw, Aurelia, Arahbo, Isshin, Fynn, Talrand, Mizzix, Kalamax, Niv-Mizzet and Kess, using the active color-fixed CSV. Kess's final deck gate passed **937 unit tests and all 27 then-current Electron workflows**. Atraxa is in progress. Historical checkpoints below describe earlier batches.

Atraxa's first counter batch has 25 focused scenarios, an Electron workflow, and a real three-client replacement-choice/reconnect regression. Shared plans cover Oracle counter placement, player counters, proliferate replacement counts, affected-player replacement order and Deepglow doubling. The complete entry/damage counter paths, counter-removal costs and remaining planeswalker action families remain pending; no additional deck is marked complete. Source references and scope are recorded in [the Oracle engine notes](oracle-engine.md).

Response mode is now **Prompt** or **Auto** per player. The controlled seat's tray edits only that player's preference, and each network client can change its own mode without host permission. Prompt retains its windows; Auto passes unavailable responses while preserving detected or uncertain actions. Legacy saves retain their prior behavior until a seat changes its setting. Modes survive reload, reconnect, reset and seat-count changes. Evidence: `tests/response-settings.test.mjs` and the mana, hotseat and multiplayer UI workflows.

Current batch verification: **975 unit tests pass**. All 28 previously registered Electron workflows pass after updating the hotseat bounce-land test to set each player's mode independently; the newly registered counter workflow also passes, for **29 passing Electron workflows** in total. Logs: `.qa/counter-and-responses-unit.txt`, `.qa/counter-and-responses-ui.txt`. No additional deck is marked complete by these partial Atraxa checks.

After Atraxa is fully verified, the requested next task is to take a break from the deck queue and refactor shared paths for efficiency and readability while preserving the gameplay interface. Section comments are already being added to the renderer, ability providers, action reducer and counter/Oracle modules; the broader refactor has not been claimed complete.

The revised first three decks include Unlicensed Hearse: single-graveyard target selection, linked exile characteristics, crew payment, temporary animation and sickness rules. Arahbo now includes every supplied card action: Cat attack/block/token triggers, exert and skipped untaps, Equipment/Aura searches and deployments, live attachment effects, temporary keyword removal, Umbra armor replacement choices, and response-gated Felidar Sovereign upkeep wins. Compound destruction spells remain on the stack during replacement choices and resume their later instructions exactly once. Multiplayer tests verify private choice ownership, convergence, game results and reset.

Evidence: `tests/vehicles.test.mjs`, `tests/arahbo.test.mjs`, `tests/arahbo-combat.test.mjs`, `tests/arahbo-utilities.test.mjs`, `tests/destruction.test.mjs`, the Vehicle and two Arahbo Electron workflows, and `tests/network.test.mjs`. The checklist records paragraph-level scope and remaining engine-wide limits. Deck 4, Isshin, now has its 87-card Oracle cache and 62 focused/audit scenarios. Shared attack-trigger multipliers, per-opponent grouping, growing token batches, myriad and end-of-combat exile, goad, life comparisons, once-per-turn trigger usage, foreign free-cast permissions, reflexive sacrifice/mode triggers and delegated/required blocking are implemented. The focused Electron workflow and two real-socket scenarios pass; all 20 Electron workflows pass. Latest unit checkpoint: **617 passing tests**. Isshin is complete for its stated scenarios; Fynn also now completes its 75-card Oracle audit in 51 focused/shared scenarios: deathtouch and poison event snapshots, independent proliferate continuations, two-role targets, creature-source damage/fight, Bloodrush from hand, modal activated abilities, Revolt, Delirium, equipment grants, spell-target triggers and poison/life/commander-damage losses. The Fynn Electron workflow and real three-client elimination/reset regression pass. Eliminated decks remain private and available for reset; Brawl and manual team formats retain their own loss rules. Talrand completes its 75-record audit in 63 focused/shared scenarios plus two real-client network scenarios. Mizzix now passes its 82-record card-action audit in 41 focused/shared scenarios: experience and reductions, X/multikicker/repeated-role targets, discard/buyback costs, temporary flashback, library/exile permissions, Mastery card-copy casting, storm history/copies and public search reveals. Trigger placement waits for the entire resolution, including later-created legal targets. Its focused renderer, two real three-client scenarios and the full 23-workflow regression pass. Kalamax completes its 87-record audit in 37 focused/shared scenarios, its Electron workflow and two real three-client scenarios: first-instant/tapped conditions, copy replacements, extra cast/copy triggers, delayed copies, sacrifice costs and resolution choices, temporary land plays, untap effects and public top-card free casts. All 816 unit tests and 24 Electron workflows pass. Niv-Mizzet completes its 82-record audit in 47 focused/shared scenarios: separate draw/damage/optional loops, draw and life replacements, soulbond, next-end-step returns, all Prismari/Izzet modes, fixed divided damage, secret numbers and saved miracle reveal/cost/continuation. Empty-library losses apply after resolution, while setup draws preserve miracle eligibility. Anonymous opponent-hand handles prevent tracking previously public identities. Its Electron workflow, two real three-client scenarios, the packet privacy regression and all 25 Electron workflows pass. Latest unit checkpoint: 866 tests. Kess also completes its audit below; Atraxa is next in manifest order.

Kess has now completed its scoped 87-record card-action audit in 67 focused/shared scenarios plus four real three-client scenarios. Shared families include source-specific graveyard permissions, tutors and threshold, simultaneous reanimation and graveyard Auras, turn-long play/exile effects, escape with separate delve payments, targeted printed-cost flashback, surveil followed by a non-targeted casting grant, optional typed graveyard targets and free casts, independently retargeted/ordered copies, additional life costs, global creature discounts and damage, destruction with mana-value life loss, and Dimir land entry/mana. The focused Electron flow passes. Current unit/network checkpoint: **937 passing tests**. All **27 Electron workflows pass**. The affected Kess and board workflows were rerun after fixing saved partial target-slot selection and same-graveyard replacement handling. Kess is complete for its stated scenarios, bringing the verified checkpoint to **10/39 decks**. After that gate passed, Atraxa was fetched: all 100 copies and 88 Oracle records are cached. Its counter-replacement/planeswalker action audit is in progress; Hapatra remains unfetched.

Talrand adds shared cast/copy events, X-aware tokens, cycling, transformations, stack-spell targets and counters, optional taxes, copy retargeting, ordered/private library choices, Fact or Fiction piles, delve costs, single kicker, overload, two-mode target groups, delayed upkeep draws, cumulative upkeep, temporary mana effects, attacker returns and private manifests. The renderer verifies these choices and persistence. Network tests verify three-client manifest concealment, fresh public handles, paid face-up authorization and public reveal/pile ownership. Common utility paragraphs reuse earlier evidence only for identical full Oracle text. Empty-library losses are implemented by the later Niv-Mizzet audit; the other engine-wide limits below remain open.

## Current work

- Combat: declarations, multiplayer targets/blocking, damage preview/application, common combat keywords, marked damage and cleanup, shared combat/death triggers, and common graveyard replacements. Real Aang fixture included. Unhandled triggered effects require manual acknowledgment.
- Session: confirmed deck-preserving reset and 2/3/4 active players with saved inactive decks. Local hotseat turn handoffs switch the controlled seat, pinned hand and focused view together; Undo restores the previous active seat. Other hands remain concealed until controlled. Hotseat remains available offline. Shared WebSocket tables lock each client to its assigned seat, validate commands in the host process and redact hidden information before transport; see [multiplayer](multiplayer.md).
- Automatic phase passing: every precombat main is an explicit human decision, even with an empty hand or after spending the last playable action. Empty upkeep/combat/postcombat phases still skip when appropriate. Normal draw/untap requirements, upkeep/end triggers, possible postcombat actions, blockers, damage verification and cleanup discards retain a stop. Twelve dedicated scenarios include two full rotations of 2/3/4 seats, many empty extra combats and protection against double-untapping skip-next-untap permanents. Manual stack placements retain a decision; paid casts use automatic response handling.
- Battlefield entry: shared live-condition evaluation covers basic land subtypes (including Dryad's additive types), land counts, Basic/legendary qualifiers, commander and opponent counts, unconditional tapped entries, and scoped global tapped-entry instructions. Entry counts exclude the entering permanent. Explicit tapped search instructions are carried into initialization, so accepting a shock-land payment cannot bypass them. Unknown conditions require a saved, explicit manual decision; complete layering and arbitrary replacement ordering remain unfinished. Fifteen entry scenarios cover these cases.
- Deck 1, Goreclaw, Terror of Qal Sisma: all 75 Oracle records cached (100 total cards); 86 deck scenarios pass and exercise every card name. Shared power-based cost reductions, cast/entry triggers, searches, optional choices, temporary bonuses, equipment, targeting, fight/destruction, mana modifiers and graveyard actions have scoped verification. That historical Oracle snapshot includes Nihil Spellbomb; the active CSV replaces it with Unlicensed Hearse, which still needs its own Oracle/action audit.
- Spell resolution: shared instruction programs now compose poison counters, draws, life changes, scry/order choices, X draws, damage, removal/follow-up effects and existing search/choice actions. Supported modes/targets are announced before payment and response priority, then targets are checked again on resolution. A spell stays on the stack through its resolution choices. Unknown effects require acknowledgment rather than only a log entry; recognized prefixes are not executed while discarding unknown suffixes. Twenty dedicated scenarios cover real Prologue/Inquiry Oracle text, Aurelia removal/modal spells, responses, countering, invalid targets, scry and continuations. See the [engine contract](oracle-engine.md).
- Extra phases: saved generic phase insertion follows newest-first ordering at a shared anchor. Extra combats use fresh declarations/blockers/damage while preserving turn, land plays, marked damage and retained mana. Ten scenarios verify Aurelia's first attack, Karlach's first combat, Relentless Assault, Aggravated Assault, countering, control/reentry identity, persistence and durations.
- Deck 2, Aurelia, the Warleader: all 82 Oracle records cached (100 total cards), including both halves of Response // Resurgence. Ten entry scenarios verify six tapped-entry cards, bounce-land choices/ownership, entry life gain, and Plains/Mountain entry and mana. Further spell/extra-combat scenarios verify its initial removal/modal spells and four combat sources above. Thirty additional cached-Oracle scenarios now cover exert, mentor/LKI, melee/battle cry, attack-created tokens and defender choices, live characteristics and grants, Moraug delayed untaps, Port Razer, Sun Titan, Reconnaissance, Tome counter costs, Esper Sentinel, entwine, commander-dependent modes, addendum, flashback, rebound, temporary exile play permissions, split-half casting and divided X damage. The new Aurelia action renderer verifies the corresponding controls. The scoped utility audit is complete: 33 combat/casting scenarios and 58 utility/audit scenarios accompany the previous entry and spell checks. Every card/paragraph is audited, all 11 Electron suites pass, and that revision was checked complete. The active color-fixed revision still needs Unlicensed Hearse verification.

## Controller input

Settings now includes local controller bindings, device selection, deadzone and pointer/camera speeds. Controller actions reuse existing gameplay controls, card drops and multiplayer authorization. Ten input scenarios and a simulated-gamepad Electron workflow verify mapping, capture, focus/disconnect handling, modal blocking, mana, inspection, placement and navigation. Physical hardware testing remains outstanding. See [controller setup](controller.md).

## Code organization

Local and multiplayer gameplay now share `game-actions.mjs`. Table, mana and combat controls dispatch one typed command instead of maintaining duplicate local callbacks and network operations. Multiplayer authorization remains separate and allows only explicit commands; local manual setup and resolution controls are preserved. Eleven regression scenarios cover command transactions, manual controls, private-seat permissions and imports. See [the action architecture](game-actions.md). This refactor adds no unchecked deck features.

## Verification

The existing 97 unit tests and all three existing Electron suites passed before these additions. Combat/session additions currently pass 16 dedicated unit scenarios and an isolated Electron workflow covering declaration, damage, Aang, cleanup, reset and player counts. Further checks are recorded as work proceeds.

The latest complete unit run passed **402 tests**, including 86 cached-Oracle Goreclaw scenarios, ten Aurelia entry scenarios, fifteen shared entry scenarios, twelve phase-flow scenarios, twenty spell-resolution scenarios and ten extra-combat scenarios. **All eleven Electron suites pass.** Three new isolated workflows verify hotseat/entry behavior, multi-instruction spells and reactions, and two complete Aurelia combats with saved phase state. They run with `test:ui:hotseat`, `test:ui:spells`, and `test:ui:aurelia`, and are included in `npm.cmd run test:ui`. The planeswalker regression also verifies that scry/X-draw resolution no longer leaves that workflow pending. The checklist distinguishes verified Oracle paragraphs from pending card actions. Multiplayer adds real 2/3/4-client transport checks and a two-window Electron workflow covering privacy, artwork, responses, combat and recovery. Network support does not mark any additional deck actions complete.

## Sources

- Supplied CSVs are preserved in `tests/fixtures/commander/`.
- Oracle metadata is cached per deck in `tests/fixtures/commander/oracle/` by `scripts/fetch-test-deck.mjs` through the existing serialized Scryfall client.
- [Foundations combat damage change](https://magic.wizards.com/en/news/feature/foundations-mechanics).
- [Avatar release notes, including Aang](https://magic.wizards.com/en/news/feature/avatar-the-last-airbender-release-notes).
- [Amonkhet release notes, exert and Combat Celebrant](https://magic.wizards.com/en/news/feature/amonkhet-release-notes-2017-04-14).
- [Zendikar Rising release notes, Moraug](https://magic.wizards.com/en/news/feature/zendikar-rising-release-notes-2020-09-10).
- [Modern Horizons 2 release notes, Esper Sentinel](https://magic.wizards.com/en/news/feature/modern-horizons-2-release-notes-2021-06-04).
- [Commander Legends release notes, Akroma?s Will](https://magic.wizards.com/en/news/feature/commander-legends-release-notes-2020-11-06).
- [New Capenna shield-counter rules](https://magic.wizards.com/en/news/feature/streets-new-capenna-release-notes-2022-04-20), used for Questing Beast’s damage-prevention interaction.

## Aurelia action verification

`tests/aurelia-combat.test.mjs` adds 30 real-card scenarios; `tests/aurelia-actions-ui.cjs` verifies exert selection, attack-token defenders, battle cry, rebound seat switching/free casting, divided X damage, split-half choice and entwine payment. Casting modes, targets, divisions and additional costs are announced before response priority. Flashback exiles on any stack exit; rebound is created only by a resolving hand cast and is consumed at the next upkeep. Temporary exile-play permission is bound to the owner, turn and zone-change identity. The shared reducer and host authorization use the same checks.

Aurelia now includes linked characteristics, combat-damage/activation history, mana-spending provenance, discard/counter costs, multikicker, token variants and optional simultaneous-trigger ordering before responses. Latest checkpoint: 402 unit tests and all 11 Electron suites pass. Its scoped checklist is complete. Deck 3, Arahbo, has 82 Oracle records cached; implementation remains pending while the requested combat overlay and direct-board targeting interface are built.

Deck queue checkpoint: **2 of 39 decks complete** for the stated scoped scenarios. Arahbo is fetched but unchecked. Full Magic layers, arbitrary replacements, every commander movement choice and unsupported later mechanics remain outside these completed scenario claims.

## Board interaction verification

Combat declarations now use attacker-card selection followed by a highlighted player or planeswalker. The combat overlay groups outgoing attackers for the attacking seat and shows each defending seat only its incoming groups. It sits above the pinned hand and supports selecting a blocker followed by an attacking card. Spell and ability targets use highlighted board cards/player badges, with actual card thumbnails for off-board targets. Cast announcements are public, bounded state events replicated through the existing packet protocol; local selection drafts stay private. Targeted loyalty abilities use the shared target/protection and resolution path. Marked damage changes the displayed toughness to red remaining toughness without changing base stats or creating a damage counter, and cleanup restores it.

The current interface checkpoint passes **411 unit tests and 13 Electron suites**, including two actual app processes with separate profiles, the two-client IPC/WebSocket gameplay regression, and direct-board combat/target/damage checks. The deck checklist remains **2/39 scoped decks complete**; Arahbo is cached and still awaits implementation. This interface update does not mark additional decks complete. See [same-computer multiplayer testing](multiplayer.md#testing-two-instances-on-one-computer) for launch commands and Host/Join steps.

## Responses from the cast popup

The announcement popup now embeds the shared priority controls and offers the controlling priority seat its legal response spells, mana sources, activated abilities and permitted instant-speed loyalty actions. Spell payment and board target selection reuse the existing dialogs and reducer. Opponent response options are never displayed; network clients see a waiting state while another seat has priority. Local hotseat controls can switch to the responding seat. Casting no longer forces open the stack sidebar. The popup follows the current top stack entry and restores the underlying spell when a response resolves, including after renderer reload. Trigger ordering and pending effect/target choices still gate priority through the same controls used by the stack.

Verification: **411 unit tests pass**, plus the focused cast-popup, board-interface and two-client multiplayer Electron workflows. `npm.cmd run test:ui:cast-popup` covers real pointer access, floating-mana funding, illegal sorcery filtering, spell and ability responses, 2/3/4-seat passing, resolution order and reload recovery. The multiplayer workflow responds and passes from each client's popup without opening the sidebar.

## Empty combat progression

Confirming zero attackers finishes the empty combat without blocker or damage controls, in local and shared play for 2/3/4 seats and both response modes. A declaration with no eligible creatures follows the same path. Unconfirmed eligible attackers remain a decision; required attackers cannot be declined. The transition enters end of combat before advancing, preserving pending stack/entry/effect choices, mana clearing, marked damage and the scheduled phase plan, including extra combats. Defender history prevents treating attackers later removed from combat as an empty declaration. Existing automatic progression beyond combat still applies when no later actions are available.

`tests/empty-combat.test.mjs` covers these cases through local and shared reducers; the board-interface Electron workflow confirms zero attackers through actual controls for 2/3/4 seats.


## Arahbo attachment batch and lobby work

Arahbo remains in progress. The attachment batch adds Aura announcement and targeting, Equipment links and costs, live attachment stats/keywords, illegal-Aura state-based actions, Rancor graveyard return, Cat static recipients, command-zone Eminence and optional Arahbo attack payments. Sram/Puresteel and optional Sigarda/Hammer/Kemba attachment triggers use the shared event and resolution pipeline. Evidence: 33 cases in `tests/arahbo.test.mjs` and the four-seat `tests/arahbo-ui.cjs` workflow; the batch passed 455 unit tests and all 15 then-current Electron suites. Umbra armor, tutors and remaining Cat abilities are still unchecked.

The requested launch/lobby work takes priority next. `lobby.mjs` supplies shared readiness, host options, advisory format checks and explicit host acknowledgment of deck warnings. `multiplayer/discovery.cjs` advertises waiting rooms on the LAN without card/deck data or authentication credentials. The UI reuses existing imports, casting, local game reducers and network clients. Generated menu art is stored locally with provenance in `assets/backgrounds/README.md`; animation can be paused. Two-Headed Giant remains manual for team-specific rules. See `tests/lobby.test.mjs`, `tests/discovery.test.mjs`, `tests/lobby-ui.cjs` and `docs/multiplayer.md`.

Final verification for this batch: **471 unit tests pass**. All 15 existing Electron workflows passed; the new launch/lobby workflow passed separately after correcting its assumption that it was the only room on the LAN. The focused workflow verifies two real clients, pasted invites, seat privacy, deck acknowledgment gates, motion preferences, all 39 picker entries, and three-seat local Standard/reset.

## Commander identity diagnostics

The Niv-Mizzet, Parun and Zedruu supplied lists were checked against Scryfall metadata for both commanders and Nihil Spellbomb. Both lists contain the Spellbomb, whose black identity is outside either commander's identity. The lists remain intact. Lobby diagnostics now name the offending card for its owner, with packet-level redaction for other seats. A missing commander or unavailable identity data no longer produces a false comparison to a colorless commander. Explicit colorless identity, combined partner identities and whole-card identity metadata remain distinct. Players can use **Recheck deck** to update saved reports without downloading or replacing their decks; readiness and host acknowledgment must then be renewed.

Verification: **479 unit tests pass**, including eight identity regression cases. `tests/color-identity-ui.cjs` passes using actual fetched metadata, two Electron clients, saved-report rechecks, private diagnostics and renderer reload. Only the three relevant identity records were fetched for this regression; the 39-deck action checklist was not advanced.
# Exact Atraxa/Jace playtest batch: turns, emblems and library replacement

The separate [exact-list audit](playtest-deck-audit.md) remains the source of card-by-card status for these two supplied lists. Neither entire deck is certified complete.

Implemented and tested in this batch:

- Extra turns preserve normal seating order, including nested extra turns and 2/3/4 seats. Teferi and Magistrate's Scepter resolve through the stack; paying Scepter's tap/counter cost does not grant a turn before resolution.
- Phasing preserves permanent identity, counters and attached cards, removes the creature from combat, phases it in before its controller's untap, and clears marked damage/turn-duration changes at cleanup. Saves, hidden face-down information, reset and player elimination preserve the appropriate state.
- Elspeth, Tamiyo and both Teferi emblems persist independently of their planeswalkers. Their tested buffs, drawing trigger and casting/loyalty permissions continue after the source leaves. Tamiyo's free casting is optional; paying the normal cost permits a nonzero X.
- An Offer You Can't Refuse creates Treasures for the spell's controller, including when the targeted spell cannot be countered. Illegal targets cause the spell to fizzle. Dovin's Veto resolves without treating its uncounterability as an unresolved instruction. Krosan Grip blocks spells/nonmana activations while allowing mana abilities.
- Elspeth's destruction threshold reads current power and uses shared shield, indestructible and death handling.
- Jace, Identity Echo, Proteus Staff, Mass Polymorph and Synthetic Destiny share reveal-and-replace handling. Public reveals expose only the inspected cards, survive reload, and show a confirmation screen. Remaining cards follow the specified random-bottom, chosen-bottom or shuffle instruction. Tokens count when exiled but cannot be found again in a library. Synthetic Destiny creates a separately respondable end-step trigger using the number originally exiled.
- Primevals' Glorious Rebirth checks the legendary-sorcery casting restriction and returns legendary permanent cards together; losing the qualifying permanent before resolution does not counter the spell.

Evidence: `tests/turn-effects.test.mjs`, `tests/playtest-spells.test.mjs`, `tests/polymorph.test.mjs`, and the exact-deck Electron screen checks. The broader unit and focused UI checks are recorded in the exact-list audit. The [Comprehensive Rules](https://media.wizards.com/2026/downloads/MagicCompRules%2020260619.pdf), especially 500.7, 514.2, 702.26 and 702.61, informed extra-turn ordering, phased-out cleanup and split second.


# Available-mana preview: nonland sources

Hand and command-zone affordability now considers immediate mana abilities on all permanent types, including mana rocks, mana creatures, enchantments, and self-sacrificing sources such as Treasures. The bounded search uses the same activation validation, production, modifiers, and payment helpers as actual play. Summoning sickness, haste, tap state, activation payments, commander tax, and spending restrictions apply. Each source contributes at most one activation in a preview branch; the preview never changes the live board or spends floating mana.

Branches track taps, self-sacrifice and simple self-counter costs, and re-read granted abilities after costs. Sacrificed artifacts no longer inflate later artifact-count mana output. Stack-based abilities, unknown output, combination allocations, untap loops, and costs requiring choices of other permanents/counters/cards remain conservative: activate those first to include their floating mana.

Verification: all **1,120 unit tests pass**, including 19 mana-preview cases. `tests/mana-ui.cjs` passes in Electron, including a board with no lands: Sol Ring and a mana creature highlight hand/command spells, a summoning-sick creature does not, and casting through the popup taps the selected sources and pays the spell normally.

## Rule 701 and supplied keyword-guide audit

The [keyword audit](keyword-audit.md) inventories all 70 requested Rule 701 actions and all 172 entries in the supplied Google document, including overlaps. It is **not complete**. Its checked entries describe tested scopes, not universal rules compliance. [Guide corrections](keyword-guide-corrections.md) record misleading explanations against the Comprehensive Rules effective September 25, 2026. The document is treated as coverage input, not as instructions or authoritative rules.

Investigate, Populate, Bolster, Adapt, Monstrosity and Support now use shared Oracle instructions, counter replacements, token creation, target validation and saved choice continuations. Populate and Bolster make non-targeted choices; Support announces optional targets before resolution. Monstrous status survives control changes and phasing but resets on zone changes. Conditional monstrous keyword grants are evaluated live instead of incorrectly granting abilities beforehand.

Counter-placement and keyword-action events feed the shared trigger system. Real Oracle regression cases cover Thraben Inspector, Growing Ranks, Growth-Chamber Guardian's optional named-card search, Fleecemane Lion, Dromoka, the Eternal, and Generous Patron. These cases do not certify all interactions involving those cards. Arbitrary Oracle wording, broader replacement interactions and variant-game systems remain open in the audit.

Verification: **1,142 unit and network tests pass**. The new `tests/keyword-actions-ui.cjs` Electron workflow verifies mandatory choices, reload continuation, token creation and Support's board targeting without premature effects. The existing keyword-icon UI workflow also passes. A real two-client network regression checks choice ownership, reconnection, resulting counters/tokens and hand privacy. `npm run audit:keywords` regenerates the checklist; source-string matches are review leads, never passing evidence. The testing-release workflow includes the new Electron check.

## Functional permanent token copies

Use a battlefield card's arrow menu → **Create token copy**, or the **Token** dialog's **Copy a battlefield permanent** group (including opponents' public permanents). Choose a quantity; the nonlegendary exception is opt-in for effects that specify it. Blank imported Copy markers are excluded from creation because their reminder text is not the copied permanent's rules. Existing blank markers can be removed and recreated from the actual source.

The shared copy definition preserves rules text, mana cost, printed characteristics and artwork, gives each token independent identity/state, and initializes entry counters normally. Copies can activate abilities, generate triggers and supply static effects through the normal engine. Counters, damage, tapping, temporary grants, commander status, Vehicle animation and linked exile counts are not copied. Face-down sources contribute public 2/2 characteristics without exposing their card; double-faced copies retain both faces and the source's current face. Copying an existing copy retains its copy-defined exceptions.

The Oracle compiler handles direct targeted token copies and the nonlegendary exception, plus exile-and-copy of an exact-X nonland permanent card from the controller's graveyard. Quantum Misalignment and Tamiyo, Compleated Sage have real-card regression cases. Memnarch's copied entry trigger creates Myr, and its attack draws use a shared count of controlled permanents of the printed type. Responses and target identity checks happen before these effects resolve.

This does not certify every copy effect: as-enters clones (Spark Double), temporary copies (Cursed Mirror), and other exceptions still require their own shared entry/duration handling. Retaining an ability's text does not implement an otherwise unsupported Oracle instruction. The [exact-list audit](playtest-deck-audit.md) records those remaining gaps.

Verification: **1,152 unit/network tests pass**, including copied activations, real-card triggers, invalidated/countered copy spells, hidden-card protection, double-faced tokens, independent copies and two-client reconnect. The token-catalog Electron workflow passes creation from a card menu, copied artwork, reload, activation and copying an opponent's permanent. The release workflow already runs that UI suite.

## Atraxa library choices and draw limits

Continued the manifest's eleventh deck using its existing Oracle fixture; no later deck was fetched. Narset's selection, Sorin's top-card ability and Experimental Augury share private inspection, constrained/optional selection, public reveal confirmation, hand movement and library remainder handling. Narset randomizes only the inspected remainder; Augury lets its controller order the remainder before proliferating. Sorin leaves a declined card on top and loses life only for a chosen card put into hand. These movements are not draws.

Narset's draw restriction applies separately to each opposing draw, including draws produced by replacement effects, and counts cards drawn earlier that turn. Blocked draws do not cause an empty-library loss. Optional draw choices exclude prohibited quantities; removing the provider immediately removes its restriction. These cases follow the [official War of the Spark release notes](https://magic.wizards.com/en/news/feature/war-spark-release-notes-2019-04-19) and CR 121.2b.

Verification: **1,159 unit/network tests pass**. New focused tests use the manifest's actual Narset, Sorin and Augury Oracle text. Two real clients verify response priority, private inspection, rejection of a foreign seat's choice, reconnect during reveal, and concealment after the card enters hand. The isolated Atraxa library Electron check verifies Narset/Sorin selection, decline, reveal confirmation, reload and life loss. Only these tested paragraph scopes were checked; Atraxa's overall card-action, complete deck UI and final regression gates remain open. Earlier copy and exact-list tests are retained separately; they do not certify the full deck.

## Atraxa delayed effects, library placement and poison

Teferi's draw schedules a separate next-end-step trigger. Its resolution offers a non-targeted choice of up to two lands, including opponents' lands. It survives source removal, can be countered, and does not trigger immediately when created during an end step. Numbered library insertion uses the card owner's library, preserves other cards' order, and puts the card on the bottom when too few cards remain to reach the printed position.

Vraska's poison ability computes the difference from nine on resolution and sends that addition through the shared counter replacement/prevention plan. It never simply overwrites poison: doubling can increase the result beyond nine, and a recipient's prohibition can stop the addition.

Oath's exile-and-return uses the same delayed trigger pipeline. The return tracks the exiled object's zone-change identity and owner, survives removal of Oath, and allows responses. It cannot return tokens or cards that left exile and came back. Returning creates a new permanent with fresh counters and ordinary entry triggers. Serialized references are validated in delayed effects, stack sources and pending contexts.

Verification: **1,170 unit/network tests pass**. Nine focused scenarios in `tests/atraxa-delayed.test.mjs` exercise these real Oracle paragraphs and edge cases. Two-client tests cover delayed untap and Oath owner-return through reconnect. The expanded Atraxa library Electron workflow verifies the delayed untap choice and persistence. Oath/Vraska-specific renderer scenarios remain pending, as do Atraxa's overall card-action, complete deck UI and final regression gates. No Hapatra Oracle data was fetched.


## Counter choices and library restrictions: Atraxa control batch

Ichormoon Gauntlet's noncreature-cast trigger now uses a serialized counter-kind choice on resolution. The announced target can be any legal permanent, including one without counters; only positive counter kinds still present are offered. A counterless target produces no addition. The ability controller chooses the kind, and normal counter replacement plans handle the addition, including affected-player ordering. Removing Gauntlet does not erase an already-stacked trigger. Source and target identities, response windows and saved continuations are exercised.

Ashiok's static restriction is a shared effect-controller search rule. It blocks a player's own resolving spells/abilities from causing that player to search while an opponent controls the provider. An effect controlled by a different player can still cause the search. A prohibited mandatory search still shuffles; an optional prohibited search offers only Decline and preserves order. Top-card look/reveal and manual tabletop library inspection remain available. Real Path to Exile wording and a multi-player search test distinguish the effect controller from the player making the current choice. This follows the [official War of the Spark release notes](https://magic.wizards.com/en/news/feature/war-spark-release-notes-2019-04-19).

The shared mill instruction moves existing top cards, never draws or causes an empty-library draw loss, and composes with subsequent instructions. Ashiok's mill and exile of every opponent's graveyard resolve without an intervening priority window. Static ?graveyard from anywhere? exile replacements now apply through the common zone-movement path, including milling. This batch does not certify arbitrary mill-trigger wording or all replacement combinations.

Sword of Truth and Justice's combat-damage trigger uses the existing nontargeted creature-counter choice followed by proliferate. The newly placed counter is available to proliferate, and proliferate still happens if no controlled creature remains. Its other paragraphs and dedicated renderer scenario remain separate checklist items.

Verification: **1,184 unit/network tests pass**. `tests/atraxa-control.test.mjs` contributes eleven focused cases; `tests/network.test.mjs` adds three-client Gauntlet ownership/reconnect and two-client Ashiok search/mill-exile scenarios. `tests/atraxa-library-ui.cjs` passes real focused buttons, saved counter selection and optional-search prohibition, alongside its earlier reveal/life-loss/delayed-untap flows. Paragraphs checked: Gauntlet [1], Ashiok [0,1], Sword [1]. The complete Atraxa gates remain open, with **10/39 decks complete** and Hapatra still unfetched.

## Turn-duration effects and loyalty history: Atraxa

The Chain Veil's end-step condition now reads player-level loyalty activation history. It persists after the activated planeswalker leaves or changes controller, counts a countered ability as activated, and rechecks the condition when the penalty resolves. Failed activation costs do not count. Its existing additional-activation permission has new real-card coverage for repeated resolutions, planeswalkers entering later, combination with Oath of Teferi, source removal and turn expiry. See the [official Magic 2015 release notes](https://magic.wizards.com/en/news/feature/magic-2015-core-set-release-notes-2014-07-07).

Tamiyo, Field Researcher's first ability uses the shared delayed-trigger registry with tracked permanent identities and an until-next-turn duration. It can watch either player's creatures, draws for the ability controller, survives Tamiyo leaving, and triggers once per watched creature per simultaneous damage event. Separate strike steps trigger separately; noncombat or prevented damage does not qualify. Phasing retains identity, while leaving and returning breaks the link. The registry expires these effects before their controller's next untap step, including extra turns. Her second ability accepts zero to two nonland targets, taps the surviving legal targets and uses the existing one-untap skip state. Untapping with a spell does not consume that skip. The timing follows the [official Innistrad Remastered release notes](https://magic.wizards.com/en/news/feature/innistrad-remastered-release-notes).

This exposed an abbreviated self-reference bug: current Teferi, Master of Time text says “Teferi.” Shared recipient matching now recognizes the name before a legendary card's comma while restricting the permission to its source permanent. Other Teferi planeswalkers do not inherit it.

Verification: **1,199 unit/network tests pass**, including twelve focused duration/history scenarios, two real-client combat/history reconnect scenarios, and a metadata guard for reused evidence. The new `npm.cmd run test:ui:atraxa-duration` Electron workflow passes two-target board selection, saved damage watches, drawing from an opponent creature's combat damage, tap/freeze persistence, and a Teferi response that cancels Chain Veil's end-step penalty. It is included in the UI suite and testing-release workflow. Paragraphs added: The Chain Veil [0,1], Tamiyo, Field Researcher [0,1], Teferi, Master of Time [0].

The Atraxa checklist also links 53 unchanged card records to earlier completed deck evidence, comparing complete Oracle text and rules characteristics. `tests/commander-evidence.test.mjs` rejects drift in those reused records; it is an evidence-integrity test, not a substitute for the linked gameplay tests. Remaining Atraxa-specific provider combinations, entry/damage counter integration, unresolved actions and full deck gates stay open. Completion remains **10/39 decks**.


## Atraxa activation costs and optional fight targets

Staff of Compleation now uses a shared ownership target restriction: a permanent you own remains eligible after an opponent takes control, while a borrowed permanent is excluded. Its existing activation pipeline is verified for all five printed abilities: life costs are paid before responses and are not refunded by countering; colored mana is immediate; proliferate, draw and the five-mana untap use the stack. Invalid colors, targets or insufficient life/mana do not pay costs. The untap cannot affect a source that left and returned.

Target groups can now have optional roles without losing their role indices. Smell Fear requires your creature but permits omitting the opponent's creature. Proliferation finishes before the fight uses current power, including newly added counters. If one announced target remains legal, proliferation still happens without a fight; if none remain legal, nothing resolves. Copies retain the original number of targets and enforce each role when retargeted. This follows the [official Modern Horizons 2 release notes](https://magic.wizards.com/en/news/feature/modern-horizons-2-release-notes-2021-06-04).

Verification: **1,209 unit/network tests pass**. `tests/atraxa-activations.test.mjs` adds eight focused behavioral cases, and two real-client tests verify response windows, ownership checks, saved proliferation/fight continuation, reconnect and private draws. `npm.cmd run test:ui:atraxa-activations` passes actual ownership highlights, Staff controls, selecting only the mandatory fight target, selecting both targets, and reload during proliferation. The workflow is included in the full UI suite and testing-release checks. Only Staff paragraphs [0-4] and Smell Fear [0,1] are checked here. Completion remains **10/39 decks**; Atraxa's remaining counter-provider interactions and complete deck gates are still open.


## Counter replacements before permanent spell entry

`entry-effects.mjs` stages an entering batch against the battlefield before any of its members move. Its serializable counter plan uses prospective characteristics, applies counter replacements in the affected controller's chosen order, and commits the entire batch before collecting entry/counter triggers. Incoming general replacement providers do not modify themselves or their simultaneous batch companions. A pending choice keeps cast cards on the stack and prevents priority, countering or unrelated actions until entry finishes. This follows CR 122.6, 614.12 and 616.1; compleated's interaction with other replacements is described in the [official Neon Dynasty release notes](https://magic.wizards.com/en/news/feature/kamigawa-neon-dynasty-release-notes-2022-02-09).

The live permanent-spell resolution path now uses this operation. Compleated is a selectable reduction in the counter plan instead of a reduction forced before all multipliers. Tests verify both orders for actual Tamiyo and Vraska, opposing Vorinclex (including zero loyalty and death), Doubling Season, Lae'zel, Winding Constrictor and Branching Evolution scope, X, sunburst, multikicker, additional entering counters, and simultaneous batch/APNAP choice behavior. Entry triggers see final counts; counter-placement triggers see a single final placement. No zero-counter event is manufactured. Save validation checks request identities and replacement plans; reset discards unresolved entry work.

Verification: **1,230 unit/network tests pass**, including twenty new entry tests and a three-client test with the second seat casting, foreign-choice rejection, private hands and reconnect during replacement selection. The new `npm.cmd run test:ui:entry-replacements` verifies both compleated/Season orders, responses, reload and displayed loyalty. The existing counter Electron regression also passes. The new workflow runs in the full UI suite and testing-release checks.

Scope remains explicit: only permanent spells currently enter through the staged production path. The batch helper is tested, but token/copy creation, reanimation, library deployment and direct transfers still need caller integration; variable entry-value choices and damage-counter replacements remain open. No broad replacement-provider paragraph is certified by this batch. Only Tamiyo, Compleated Sage [0] and Vraska, Betrayal's Sting [0] are newly checked. Atraxa remains in progress and the completed deck count is **10/39**.


## Token copies, token doubling and reanimation entry batches

Manual copies, direct Oracle copies, Tamiyo's exile-and-copy, Populate and ordinary token instructions now stage fresh tokens outside all zones until entering-counter choices finish. The saved request captures copiable values once and receives an independent identity; no ghost hand card appears during a choice. Entry, token-creation and counter events are collected after the whole batch commits. Subsequent instructions, including draws, wait for completion.

Token-count doubling recognizes shared Oracle wording, applies once per live controller-scoped provider, and is independent of each token's entering counters. Elspeth plus Doubling Season produces six Soldiers while a one-or-more token creation trigger fires once for the batch. Copied planeswalkers use printed starting loyalty, not the original's current counters. Counter-bearing zero-base tokens receive subsequent counters before state actions.

Reanimate, Victimize, Animate Dead and simultaneous legendary returns use the same saved entry operation. Victimize sacrifices before determining applicable replacements and returns its surviving targets together tapped. Reanimate's life loss waits for entry completion. Animate Dead attaches and records the returned object's identity before entry observers and state actions. A replacement provider returning in the same batch does not modify its companions.

Verification: **1,246 unit/network tests pass**. Fourteen focused entry-batch cases, two new real two-client reconnect/choice-ownership cases and the expanded entry Electron workflow pass. Existing token-catalog, Kess and keyword-action Electron checks also pass. Network tests execute a copied planeswalker's ability and verify private draws after reconnect. The checklist records Doubling Season's token paragraph and Tamiyo's exile-and-copy paragraph; **10/39 decks remain complete**, with Atraxa in progress.

Open integration includes legacy direct moves, library deployment, other return paths and Myriad's entry-counter handling. As-enters clones, temporary copy durations, unsupported copied Oracle instructions, variable entry choices and damage-counter replacements remain separate work. The token-count handler supports the tested doubling wording, not every token replacement pattern.


## Library deployment and delayed-return entry replacements

Searches, hand deployment, polymorph-style reveals, shuffle-and-reveal entry, Sun Titan-style returns and Oath of Teferi's delayed return now use the shared staged entry operation. Shuffling, remainder ordering, subsequent draws and trigger delivery wait for entering counter replacements. Polymorph hits enter as one batch; their revealed identities remain public during the choice while unrevealed library cards remain concealed. Saved remainder and reveal references are validated.

The batch also records tapped-entry conditions before committing any member. An incoming Forest or Dryad cannot make a simultaneously entering check land untapped. Existing Dryad plus an existing land can satisfy the condition. A tap-replacement provider entering in the same batch cannot change a companion shock land's forced-tapped payment state. These cases follow CR 614.4 and 614.12 in the cached September 25, 2026 Comprehensive Rules. The current life-payment and manual-entry dialogs still need to move fully before entry; preserving their condition is not completion of that separate timing work.

Verification: **1,259 unit/network tests pass**. Eleven focused cases in tests/entry-routes.test.mjs cover these paths, batches, fresh identities, triggers, saves and invalid continuations. Two new real-client scenarios verify private search/entry/shuffle/draw and owner-controlled Oath return choices across reconnect. The new Electron entry-routes workflow passes actual search selection, pending-entry reload, delayed-return response windows and public polymorph reveal followed by remainder ordering. Existing entry-replacement, playtest-deck and Atraxa-library Electron suites also pass. The new workflow is included in the full UI and testing-release commands.

The prior batch's Elspeth token paragraph is now recorded in the manifest checklist as well as the exact-list audit. No broad counter-provider paragraph or complete deck gate is closed by these scoped tests. Completion remains **10/39**, Atraxa remains active, and Hapatra has not been fetched. Legacy direct movement, Myriad entry counters, variable entry values, pre-entry life/manual choices and damage-counter replacement integration remain open.

## Myriad copy entries and last-known copiable values

Myriad now uses the shared staged-entry instruction instead of the immediate token path. Token-count replacements are applied once, each resulting token retains its chosen opponent, and additional tokens from doubling can separately attack that opponent or one of their planeswalkers. Defender choices happen before entry. Counter-replacement ordering then completes for the entire batch before any token enters; entry observers see the final counters and attacking state. Entering attacking does not declare an attack or generate further Myriad triggers.

The normal delayed end-of-combat trigger tracks every created token by battlefield identity and remains respondable/counterable. The source can leave before the Myriad trigger resolves. Copies retain supported rules text without copying source counters or temporary Vehicle animation. Trigger snapshots now preserve the underlying copiable values separately when current characteristics differ or both DFC faces are needed. A noncreature copy enters tapped and receives the delayed exile instruction without incorrectly entering combat.

Rules checked against [CR 702.116 and the Comprehensive Rules](https://magic.wizards.com/en/rules) and the official [Tarkir: Dragonstorm release notes](https://magic.wizards.com/en/news/feature/tarkir-dragonstorm-release-notes), including separate defender choices when a replacement creates multiple tokens for one opponent. The cached 2026-09-25 rules remain the fixture reference. No new deck's Oracle data was fetched.

Verification: **1,273 unit/network tests pass**. Six new scenarios in `tests/myriad-entry.test.mjs` cover three/four seats, simultaneous counter ordering, independent doubled defenders, saves, decline, source departure, response to delayed exile, copied animation and malformed saved requests. A real three-client test in `tests/network.test.mjs` covers response priority, rejected foreign choices, private hands and reconnect during staged entry. The expanded `tests/entry-routes-ui.cjs` exercises the actual defender/replacement controls across reload; Isshin, Vehicle and token-catalog Electron regressions also pass.

This closes the specifically listed Myriad entry-path gap, not the full counter-provider audit. Atraxa remains active at **10/39 completed decks**. Direct/tabletop entries, complete pre-entry variable/life/manual choices, damage-counter replacements and the other unchecked Atraxa paragraphs remain open. Hapatra is still unfetched.

## Land plays and corrective battlefield entries

Land plays, local manual resolution to the battlefield, corrective move commands and the direct move API now use the shared staged-entry operation. Counter replacements finish before the new permanent enters. The card stays in its originating zone while its controller chooses, and saved choices preserve its position, identity and remaining work. Playing a land reserves its land allowance once; it does not use the stack or allow another land play during the pending choice. Corrective placements do not consume that allowance. Moving an existing permanent across the mat or changing its controller preserves its battlefield identity and counters without firing entry triggers.

A manual effect can require players to move cards before acknowledging its completion. Such a placement now saves that acknowledgment across nested entry-replacement choices and restores it to the original effect controller. Entry triggers remain deferred until that controller confirms the manual effect. Automated resolution choices, including library searches and scry, cannot be overwritten by a new unrelated placement. The shared command settlement performs state-based actions before releasing deferred triggers.

Verification: **1,283 unit/network tests pass**, including eight new cases in `tests/manual-entry.test.mjs`. Two real two-client scenarios in `tests/network.test.mjs` verify land allowance, foreign-choice rejection, private hands, reconnect, restoration of a different manual-effect controller and subsequent private draws. The expanded entry-routes Electron workflow uses actual hand controls and a graveyard-to-battlefield drag, reloads during entry choices, and checks the remaining hand's land eligibility. All **40 Electron workflows pass**; the final direct-move wrapper also passes the complete unit suite and the entry-routes Electron check.

This closes the documented manual/tabletop and land-play entry-route gap. It does not close pre-entry variable-value, shock-life or manual-condition decisions: those legacy decisions still occur after entry and need a separate staged choice flow. As-enters cloning, temporary copying, damage-counter replacements and the other unchecked Atraxa paragraphs remain open. Broad counter-provider paragraphs remain unchecked. Raw `transfer` remains a mutation/setup primitive used inside the staged commit and test setup, not an alternative gameplay entry framework. Completion remains **10/39**; no Hapatra Oracle data was fetched.

## Numeric entry decisions, shock life and tapped conditions

New gameplay entries now pause outside the battlefield for required numeric values, supported life payments and unresolved tapped-entry conditions. The entire batch stays out while controllers decide in active-player order. Numeric quantities and effect-added counters are combined before counter-replacement ordering; chosen base stats and tapped state are installed before entry triggers observe the batch. Life payments update the paying controller once and are not replayed after reload or reconnect. Insufficient life disables payment; declining remains legal. Known forced-tapped instructions cannot be undone by paying life or confirming a different unresolved condition.

The framework saves prospective entries, original-zone identities, the choosing controller and the unfinished resolution. Staged tokens never appear in a temporary hand zone. Network commands cannot answer another controller's choice or substitute an unrelated card. Reset drops staged tokens. Search/reveal continuations still wait before shuffling or drawing. Mandatory pre-entry values cannot be deferred past the entry event. Older saved battlefield choices retain their compatibility flow.

Known cast X remains attached to the resolving spell. Noncast entries with X in their mana cost use zero; text-only undefined X still prompts rather than inheriting an unrelated cast's zero. Noncast sunburst supplies no spent colors. These cases follow [CR 107.3, 614.12a–b and 702.44](https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.txt), checked through the current official rules link. Existing early mana tests now give their hypothetical creatures explicit stats, and the tabletop UI uses an explicitly variable quantity rather than an uncast mana-cost X with an arbitrary chosen value.

Verification: **1,302 unit/network tests and all 41 Electron workflows pass**. Seventeen scenarios in `tests/pre-entry.test.mjs` include actual cached Breeding Pool, Hallowed Fountain, Godless Shrine, Overgrown Tomb, Temple Garden and Watery Grave clauses, pay/decline, fresh entries, batch affordability, replacement order, unknown stats, token resets, source identity and malformed saves. Two real two-client tests cover private staged token values and simultaneous shock entries with controller handoff and reconnect. `tests/pre-entry-ui.cjs` exercises mandatory fields, copied tokens, replacement order, life/condition dialogs and reload; the existing mana, hotseat and tabletop tests use the corrected timing. The focused UI command is also a release-workflow gate. Only the six exact-list shock-land entry paragraphs receive new checked evidence; the 39-deck Atraxa manifest has no such lands.

This is a scoped entry milestone. Additional nonnumeric choices/costs/reveals, letting a controller reorder independent outstanding entry decisions, as-enters cloning, temporary copy effects, damage-counter replacements and other unchecked Atraxa interactions remain open. Numeric quantities without an implemented Oracle calculation still use the requested manual prompt. Broad provider paragraphs and full deck gates remain unchecked. Completion remains **10/39** and Hapatra remains unfetched.


## Controller-selected entry order and shared copy layers

A controller can choose another independent pending entry decision they own,
including switching between numeric, life and tapped-condition dialogs. The
active controller's APNAP group remains in force. Separate tapped-state causes
compose correctly when a life payment and unresolved condition are answered in
either order; changing focus does not pay costs or move cards. These selections
survive reload and real three-client reconnect.

Optional as-enters copying now uses descriptors and the same staged entry
pipeline. The tested Spark Double and Cursed Mirror clauses choose actual
battlefield cards without targeting; shroud does not prohibit the choice, and
simultaneously incoming companions are ineligible. Copying occurs before that
object's remaining entry choices. The prospective copy gains the copied rules,
printed starting values and recognized exceptions before counter replacement
plans are built. Costs, counters, temporary animation and source status are not
copied. Sunburst reads colors spent on the resolving copy spell. Face-down
choices use only public creature characteristics and labels in both host and
projected client views.

Copy layers preserve the physical card underneath. Copied mana, loyalty and
entry-trigger abilities work through the existing shared readers. Spark's
nonlegendary exception is copiable; its additional entry counter is not. A later
copy effect supersedes the earlier entry-counter exception. Mirror's haste is
copiable, while its duration is not. Cleanup removes temporary layers without
reentering, untapping or clearing unrelated counters; an indefinite later layer
survives expiry of an earlier temporary layer. Zone changes and reset clear all
layers. Ordinary permanent copies get only the chosen DFC face, separately from
transforming token copies. The board picker requires a copy/no-copy decision and
supports switching to another independent pending entry decision.

Verification: **1,327 unit/network tests pass**. Sixteen cases in
`tests/entry-copy.test.mjs` include actual cached Spark Double and Cursed Mirror,
counter-provider order, inherited loyalty grants, copied mana/haste, response
windows, countered spells, source removal, malformed saves, DFC faces, chained
copies and casting colors. Atraxa's Tamiyo exile-and-copy creates a functioning
cloning token through this pipeline without a temporary hand card. A real
two-client test in `tests/network.test.mjs` verifies choice ownership, stale
incarnation rejection, reconnect, activation, further token copying, private hands
and expiry. All **42 Electron workflows passed**; the focused
`tests/entry-copy-ui.cjs` was rerun after the final concealed-card eligibility
and casting-payment corrections. The copy UI is also a release-workflow gate.

The exact-list audit now records Atraxa **102 PASS / 12 FAIL / 71 UNVERIFIED**
and Jace **83 PASS / 22 FAIL / 80 UNVERIFIED** paragraphs. Evidence reuse is
limited to identical Oracle text; these are scoped regression counts, not complete
card or deck certifications. The 39-deck completion count remains **10/39**, with
Atraxa active and Hapatra unfetched. Arbitrary external copy replacements, full
continuous-effect layering, additional copy exceptions and nonnumeric entry
costs/choices remain open. Damage-counter replacement integration, the remaining
provider/planeswalker/combat/land paragraphs and complete Atraxa gates still need
their own evidence. The next shared counter path to address is infect/wither/toxic
damage, which currently bypasses counter-replacement plans.

Rules: CR 614.12, 616.1c and 707.2/707.9, plus the official
[Spark Double notes](https://magic.wizards.com/en/news/feature/war-spark-release-notes-2019-04-19)
and [Cursed Mirror notes](https://media.wizards.com/2021/downloads/STX_Release_Notes/EN_MTGSTX_FAQ_04122021.pdf).


## Damage-counter pipeline and test.5 release checkpoint

Infect, wither and toxic now enter the shared counter-replacement framework.
A noncommuting choice stages all simultaneous results, including ordinary damage
and lifelink, until the affected player decides. The saved batch retains source
characteristics, recipient incarnation, combat step and spell continuation.
Damage amount remains independent from the number of replaced counters: poison
prohibitions and halving do not erase lifelink, commander damage or damage
triggers. Multiple toxic sources are separate placement events. Combat and
resolving-effect origins remain distinct for effect-only replacements; applying
another counter replacement can make one applicable under CR 614.16.

Seventeen new unit cases cover real Viral Drake, Ichor Rats and Bloated
Contaminator text; provider ownership, doubling, halving, toxic instances, poison
prohibitions, combat/noncombat differences, simultaneous damage, fights with
continuations, lifelink, state-based deaths, pending save validation and private
views. A real two-client checkpoint/reconnect test verifies foreign-choice and
replay rejection. The new Electron workflow verifies an uncertain preview stays
playable, affected-seat replacement controls, reload, atomic results and the
respondable Contaminator proliferate trigger.

The test.5 release checkpoint passes **1,345 unit/network tests**, all **43
Electron workflows**, the Windows installer/ZIP build, updater checksum
validation and the packaged-app smoke test. This
release includes all accumulated entry, copy and renderer changes since test.4.
The release workflow now runs the complete interface suite before publishing.

Completion remains **10/39**, with Atraxa active and Hapatra unfetched. This
closes the tested damage-counter path, not every damage prevention/replacement
case, numeric keyword, counter-provider paragraph or complete-deck gate. Full
continuous-effect layering, further nonnumeric entry choices and the remaining
unchecked planeswalker/combat/land interactions still need independent evidence.

Exact-list paragraph audit at this checkpoint: Atraxa **104 PASS / 12 FAIL / 69 UNVERIFIED**; Jace **83 PASS / 22 FAIL / 80 UNVERIFIED**. Only the tested Viral Drake/Ichor Rats infect paragraphs receive new checked evidence. Broader provider paragraphs remain open.


### Release CI follow-up

The test.5 tag passed all 1,345 CI unit/network tests but did not publish: the
expanded full interface gate caught a stale-pointer hit-test assumption in the
board workflow. The test now moves the real Chromium pointer, waits for actual
hit reachability, and reports the blocking element if reachability fails. It
still dispatches real pointer input and does not bypass the hit assertion. The
workflow passes locally at normal size and at 1000 by 760, the app's minimum
window size. The latter is now an additional release gate.

The failed tags are retained unchanged. Test.6 passed the pointer check, but CI
then exposed a lobby test assuming animations were enabled by default. The tests
now respect the host preference and explicitly exercise both motion modes. The
offscreen counter screenshot also waits for a painted frame rather than racing
the compositor after a hidden-window resize. Test.7 carries all accumulated
application changes and these test corrections; publication requires its complete
CI gate.

Local test.7 verification passed: 1,345 unit/network cases, all 43 interface
workflows under forced reduced motion, the minimum-window pointer check, Windows
installer/ZIP and updater checksum builds, runtime inventory, and the actual
packaged-app smoke test. GitHub publication remains gated by the same checks.
