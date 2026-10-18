# Oracle engine contract

The 39 supplied deck lists define the implementation queue and acceptance cases. Their Scryfall Oracle records supply rules text and printed characteristics. Shared handlers implement recurring instructions; card names are fixture identities, not a dispatch table of special cases. The [deck checklist](commander-deck-checklist.md) records which paragraphs have actually been exercised. Downloaded Oracle text alone does not count as implementation.

## Playing and resolving a card

1. Check casting timing, the selected mode, legal targets and payable costs. Validate choices before changing mana or zones. Supported simple modal spells announce their mode now.
2. Pay costs and put the spell on the stack. Show its chosen mode and targets. Queue relevant cast triggers. No spell instruction happens merely because the card was cast.
3. Offer priority to each seat. Automatic response mode skips only seats without a detected available action; privacy mode gives every seat the same window. Responses resolve last-in-first-out.
4. On resolution, recheck targets, including battlefield incarnation, current control restrictions, hexproof/shroud and supported protection. All targets becoming illegal prevents the entire targeted spell from resolving.
5. Compile the supported effect text into an ordered instruction program. A compound program must be completely recognized. An unknown suffix must not be silently dropped after applying a recognized prefix.
6. Execute instructions in order. A choice pauses the same resolution and saves its context and remaining instructions. Players do not get priority between those instructions. Optional choices resume the later instructions even when declined.
7. Finish an instant/sorcery's instructions and move it to its owner's graveyard. A resolving spell remains on the stack while its choices are pending. Process supported state-based actions and resume priority. Permanents enter through shared initialization and then their entry triggers use the stack.

Unrecognized spell/ability effects require explicit manual resolution and acknowledgment. Unrecognized tapped-entry conditions similarly require a saved manual entry decision. These fallbacks remain necessary while the deck audit is incomplete.

## Decisions before battlefield entry

`entry-effects.mjs` prepares a simultaneous batch outside the battlefield. Required numeric starting values, supported life payments and manual tapped-entry conditions are stored as an `entry-choice` for the affected controller. The ordinary `entryValues`, `entryLife` and `entryTapped` commands can answer that pending decision even for a staged token that is not yet in any card zone. Network authorization permits only the choosing controller; the reducer checks the exact permanent and decision type.

The batch remains outside the battlefield until these decisions finish. Numeric quantities are then included in the counter-replacement plan. Chosen base stats and tapped state are installed before entry observers run. Life is paid once at the decision, so another payment in the same batch sees the updated life total. Saved decisions preserve paid costs and remaining work; reloading does not pay again. Prepared batch order is the current default within a controller's choices; letting that controller select a different outstanding decision order is still open.

Known X from a resolving spell is retained for its entry counters. For a noncast object with X in its mana cost, that X is zero; a text-only X without a defined value still asks for a value. A noncast sunburst entry uses no spent colors. Legacy saved battlefield choices remain readable, while new gameplay routes use pre-entry decisions. As-enters copying, additional nonnumeric choices and unsupported conditions still require their own behavior evidence.

## Spell-copy and permission additions (Kalamax audit)

`spell-copy-rules.mjs` evaluates copy-count replacements once per batch and additional permanent triggers at the event. Twinning Staff adds one copy per provider; Veyran adds independent cast/copy triggers, including its own. Neither causes copies to be cast. A zero-copy instruction stays zero. Card-copy permissions such as Mastery do not pass through spell-copy replacements.

Kalamax uses separate per-seat spell and instant history for every turn, plus a tapped intervening condition checked again on resolution. Departed sources retain their last-known tapped status; returning permanents are new objects. Doublecast and Bonus Round create saved, expiring delayed triggers. Fork's color exception is part of the copy's characteristics. Copies retain modes, X, paid additional costs and damage divisions, with independent target choices; an unchanged target may be retained even if it has become illegal.

Harrow's chosen land is a casting cost paid before response priority. Roiling Regrowth instead sacrifices during resolution and continues searching even if there is no land to sacrifice. Growth Spiral places a land without consuming a land play, while still using normal entry rules. Explore grants a temporary additional play. Rashmi reveals one card publicly and offers an immediate, permission-checked cast from the library; declining puts it into hand, and the rest of the library remains concealed. The shared reducer, saved-stack validator and network authorization all support that casting zone.

Evidence: `tests/kalamax.test.mjs` (37 focused/shared scenarios), `tests/kalamax-ui.cjs` and two three-client scenarios in `tests/network.test.mjs`. Official card-specific references: [Commander 2020 release notes](https://magic.wizards.com/en/news/feature/ikoria-lair-behemoths-and-commander-2020-edition-release-notes-2020-04-10), [Commander 2021 release notes](https://magic.wizards.com/en/news/feature/strixhaven-school-mages-and-commander-2021-edition-release-notes-2021-04-16), and [Kaladesh release notes](https://magic.wizards.com/en/news/feature/kaladesh-release-notes-2016-09-16).

## Draw events, miracle and simultaneous choices (Niv-Mizzet audit)

Actual draws generate one event per card, carrying the drawing seat without the private card definition. Cast triggers, draw-triggered damage and subsequent optional draws remain separate stack objects with response priority. Multi-card instructions finish before their triggers acquire targets. Archive, Insight and Reflection share replacement handling; a replacement applies once to each event and its descendants. Draw-step exceptions count actual cards, including cards created by another replacement. Life-gain multiplication shares a handler across spell effects and lifelink.

A first-card miracle prompt pauses the draw immediately. Declining keeps its identity private. Revealing publishes that card and creates a responseable trigger after the current resolution finishes. Its later cast uses a saved alternative-cost permission; declining, countering or losing that card ends the opportunity. Partially applied draw replacements and later instructions resume from saved work. Opening hands and reset draws use a separate setup path and do not consume first-draw eligibility. A failed draw marks a loss checked after resolution, preserving the eliminated player's private deck for reset.

Soulbond stores mutual permanent identities. Grants come from the current pair, and leaving, changing controller or ceasing to be a creature breaks it. Next-end-step death returns use tracked graveyard identity. Modal target roles remain separate through private choices; fixed divided damage is announced before payment. Secret numeric choices expose only submitted seats until everyone has chosen, then reveal all numbers and apply the tied high/low outcomes.

Evidence: `tests/niv-mizzet.test.mjs` (47 focused/shared scenarios), `tests/niv-mizzet-ui.cjs` and two real three-client network scenarios. The full checkpoint passes 866 unit tests and all 25 Electron workflows, including a final two-client interface recheck after anonymous hand handles were added. Rules references: [Ravnica Remastered release notes](https://magic.wizards.com/en/news/feature/ravnica-remastered-release-notes), [Avacyn Restored mechanics](https://magic.wizards.com/en/news/feature/avacyn-restored-mechanics), and [Commander Legends release notes](https://magic.wizards.com/en/news/feature/commander-legends-release-notes-2020-11-06).

## Current shared instruction families

| Family | Verified behavior | Evidence |
| --- | --- | --- |
| Poison, draw, life | Prologue to Phyresis; Infectious Inquiry; ordered effects, countering, responses, simple poison prevention | `tests/spell-resolution.test.mjs`, `tests/spell-resolution-ui.cjs` |
| Scry and X draws | Keep/bottom choices, explicit order of retained cards, continuation into a draw, chosen loyalty X | `tests/spell-resolution.test.mjs`, planeswalker and spell Electron suites |
| Targets and modes | Announced before payment/priority; legal kinds/controllers; incarnation and protection checks at resolution | `spell-effects.mjs`, `effect-targets.mjs`, spell tests |
| Removal and follow-up | Exile and current-power life gain; optional controller search; destruction and controller token; owner shuffle/reveal | Aurelia records in spell tests |
| Searches and movement | Duplicates, restrictions, tapped entry, ordered destinations, optional payment/choices, owned return destinations | Goreclaw, Aurelia and entry tests |
| Battlefield entry | Live land-type conditions, land/opponent counts, unconditional and supported global tapped replacements, shock payments | `tests/battlefield-entry.test.mjs`, hotseat Electron suite |
| Extra combat | Saved insertion order, new declarations, immediate untap effects, first-attack/first-combat restrictions, retained turn state | `tests/extra-combat.test.mjs`, `tests/aurelia-ui.cjs` |
| Combat and triggered effects | Common combat keywords, simultaneous damage, marked damage/cleanup, shared event matching and supported death destinations | Combat and Goreclaw tests |
| Cast/copy events and counters | Spell-type filters, X-aware token values, spell copies preserving modes/targets/divisions, counterspell target domains and optional taxes | `tests/talrand.test.mjs`, Talrand Electron workflow |
| Library and hand choices | Brainstorm ordering, surveil, Ponder, delve payments, private hand inspection, Fact or Fiction's public reveal/opponent split, Dig selection/bottom order | Talrand unit/UI and real-client network tests |
| Modal and alternate forms | Cryptic's two modes and distinct target groups, single kicker, overload's cost/untargeted scope, legal-form affordability | Talrand unit/UI tests |
| Delayed/upkeep instructions | Independent next-turn draw triggers, optional draw amounts, cumulative age/payment/sacrifice, Rhystic/Remora taxes, temporary Island mana bonuses | Talrand tests; common stack/priority machinery |
| Manifest | Public 2/2 characteristics, concealed printed metadata, combat/counters, paid face-up special action, no cast/entry event when turned up | Talrand unit/UI and three-client network tests |
| Casting permissions and costs | Chosen discard costs, buyback, temporary flashback options, normal/free exile plays, resolution-scoped hand/card-copy casts, additional-cost mana during offered casts | Mizzix unit/UI and three-client network tests |
| Storm and resolution frames | All-spell/own instant-sorcery histories, independent copies, last-known spell data, saved retargeting, deferred APNAP trigger placement and target choice after resolution | Mizzix and shared regression tests |
| Public reveals | Search results become public announcement data while other hand/library cards stay concealed | Mizzix renderer/network tests |

## Current checkpoint

The active color-fixed revisions of Goreclaw, Aurelia, Arahbo, Isshin, Fynn, Talrand, Mizzix, Kalamax and Niv-Mizzet have completed their scoped audits. **866 unit scenarios and all 25 Electron workflows pass.** New shared handlers cover linked exile and crew, Equipment/Aura searches and hand deployment, attack/block token placement, exert, temporary keyword loss, Umbra armor choices and an alternate-win result. Destruction replacement choices save the original program/context and resume before subsequent instructions; only the affected controller can submit the choice. Win instructions still use response priority and intervening-condition rechecks. See the checklist for exact paragraph evidence and limitations. Fynn adds two-role spell targets, creature-source fight/damage, announced activation modes/targets, hand-only discard costs, Revolt/Delirium conditions, spell-target events, shared player counters and repeated proliferate continuations. State-based actions wait until an instruction program finishes, including saved choices. Poison/life/individual Commander-damage losses remove owned cards without exposing private decks; surviving seats retain their turns and responses.

Attack events now create additional independent triggers from live providers, retain player/planeswalker defenders and group player-level events correctly. Myriad copies enter attacking without new declarations, and delayed exile uses battlefield incarnations. Reflexive sacrifice triggers announce their modes and targets before a separate priority window. Foreign free casts retain ownership while assigning the caster control; delegated blocking changes only blocker commands. Once-per-turn limits, goad expiration, live token amounts and intervening life comparisons use the same shared state and reducer in local and network play. Evidence: `tests/isshin.test.mjs`, `tests/isshin-utilities.test.mjs`, `tests/isshin-ui.cjs`, and real-socket network tests.

## Verification and remaining work

The historical eleven-workflow checkpoint passed **402 scenarios**. The latest full interface result is maintained in [rules implementation](rules-implementation.md).

Goreclaw retains its scoped verification. Aurelia?s scoped card-action audit is complete. Its verified paragraphs now include initial entry actions, several targeted/modal spells, and Aurelia/Karlach/Relentless Assault/Aggravated Assault combat scheduling. Thirty additional real-card scenarios and a new Electron workflow verify combat keywords/exert, attack-created tokens, Moraug delayed untaps, source restrictions, recursion/counter costs, tax choices, entwine and commander-dependent modes, addendum, World at War/rebound, Seize the Day/flashback, temporary exile play permissions, split spells and divided X damage. Utility-card actions and player-selected simultaneous-trigger ordering now have dedicated unit and renderer coverage. That historical checkpoint preceded the completed Arahbo, Isshin, Fynn and Talrand audits above.

This is not yet a complete Magic rules engine. Full continuous-effect layering and replacement ordering, all counter replacements, player targeting protections, commander replacement choices for every movement, arbitrary modal/additional costs, full control-effect reversion after a player leaves and many later-deck mechanics remain incomplete. Supplemental Prologue/Inquiry Oracle examples are cached separately from the sequential deck queue in `tests/fixtures/spell-resolution.json`; reproduce them with `node scripts/fetch-oracle-examples.mjs`. Gameplay tests use local fixtures without network requests.

Local hotseat lets one person play all 2/3/4 active seats. Shared tables now use typed WebSocket actions validated in the host process, with private per-seat views, revisioned patches, reconnects and durable checkpoints. Clients render locally and do not independently resolve shared rules. See [multiplayer architecture and limits](multiplayer.md).

## Rules references

The [official Comprehensive Rules](https://magic.wizards.com/en/rules) are the authority: 500.8 for additional phase ordering, 601.2 for announcing modes/targets/costs, 608.2 for target checks and ordered resolution, 614.12 for pre-entry replacement checks, and 701's scry action. Card-specific behavior comes from the cached Scryfall Oracle records and applicable official release notes. Tests document the supported scenarios rather than assuming that a successful parse proves all interactions.

Manifest behavior is checked against the [official Duskmourn mechanics description](https://magic.wizards.com/en/news/feature/duskmourn-house-of-horror-mechanics): colorless 2/2 characteristics and a paid creature-card face-up special action. Public instance handles are renewed when a noncommander leaves a concealed library as a manifest, preventing identity tracking from older public plays.

Storm and spell-copy behavior is checked against the [Dominaria Remastered release notes](https://magic.wizards.com/en/news/feature/dominaria-remastered-release-notes) and [Guilds of Ravnica release notes](https://www.magic.wizards.com/en/news/feature/guilds-ravnica-release-notes-2018-09-20). Experience counters follow the [Commander 2015 mechanics overview](https://magic.wizards.com/en/news/feature/commander-2015-mechanics-2015-11-02).


Kess adds shared graveyard-casting descriptors with provider/turn provenance, optional escape exile costs distinct from delve, and temporary play/exile rules. Flashback replaces every stack exit; Kess/Mission Briefing/Finale only replace a spell going to the caster's graveyard. A global Yawgmoth Will-style replacement also handles discard, mill, search and permanent deaths, while tokens remain eligible to die. Graveyard Auras track both the initial card and the returned battlefield incarnation; leaving the Aura creates a separate respondable sacrifice trigger. Reanimation batches defer entry events until every permanent is present.

Targeted printed-cost flashback reads the selected spell face at casting. Surveil completes before the subsequent non-targeted graveyard choice. Optional typed target groups can omit either role and can select one split card for two qualifying roles; a resolution offers that physical card only once. Free graveyard casts retain ordinary additional costs and require X zero. Copy batches preserve announcement data, permit independent retargets and allow mixed copies to be ordered before priority resumes. Copies do not create cast events. Additional life costs are paid before the spell receives responses; state-based actions follow completed casting.

Rules sources for these distinctions: [Modern Horizons Kess notes](https://magic.wizards.com/en/news/feature/modern-horizons-release-notes-2019-05-31), [Eternal Masters Aura notes](https://www.magic.wizards.com/en/news/feature/eternal-masters-release-notes-2016-06-02), [Theros Beyond Death escape notes](https://magic.wizards.com/en/news/feature/theros-beyond-death-release-notes-2020-01-10), and [War of the Spark Finale notes](https://magic.wizards.com/en/news/feature/war-spark-release-notes-2019-04-19).

Atraxa counter work is in progress. Oracle counter placement, poison/other player counters, proliferate and Deepglow-style doubling use serializable counter plans. Plans distinguish the placing actor from the affected player, preserve counter kinds, and let the affected seat order noncommuting replacements before committing a simultaneous batch. Repeated proliferates have separate selections and finish before subsequent instructions such as drawing. Choice ownership, reload and three-client reconnect are tested. Positive loyalty activation costs now use the same plans before response priority, with cost/effect distinctions retained. Negative costs preserve zero loyalty so the walker leaves while its ability stays on the stack. Entry counters, damage counter placement and removal costs remain unfinished; this batch does not complete the provider cards' full audits.

Counter replacement ordering, effect-versus-cost distinctions and proliferate follow rules 614.16, 616.1 and 701.34 in the [official Comprehensive Rules](https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.pdf). Evidence: `tests/counter-effects.test.mjs`, `tests/counter-effects-ui.cjs`, and the counter-replacement reconnect scenario in `tests/network.test.mjs`.

## As-enters copy preparation

`entry-copy.mjs` recognizes complete optional creature/planeswalker copy clauses,
including the tested nonlegendary/additional-counter and temporary-haste
exceptions. These are descriptors, not card-name branches. Copy selection is a
pre-entry replacement decision, made before the same object's other entry
decisions. It uses current battlefield objects without targeting, cannot choose
another incoming batch member, and validates the chosen battlefield incarnation.
The board picker permits an explicit no-copy decision and restores from saved
pending state. Controllers can choose another independent decision they own
through the existing entry-order control; APNAP ownership remains enforced.

`copy-state.mjs` stores ordered copy layers separately from the physical card.
Readers see the last layer's copiable characteristics, including printed text,
mana value, artwork and copy exceptions, without carrying counters, animation or
temporary grants from the original. Prospective entries are recalculated after
copying, then numeric/life/tapped choices and shared counter replacements finish
before the entire batch enters. Entry triggers observe the committed copy and
retain their normal response window. Copies of temporary copies inherit the
copied abilities, not the source effect's duration. Cleanup removes only temporary
layers; zone changes and reset remove all layers. Ordinary permanent copies have
the chosen DFC face only; transforming token-copy behavior remains separate.

Evidence: `tests/entry-copy.test.mjs`, `tests/entry-copy-ui.cjs` and the two-client
copy/reconnect/expiry scenario in `tests/network.test.mjs`. These exercise actual
cached Spark Double and Cursed Mirror text, copied planeswalker loyalty/grants,
counter providers, mana activation with haste, entry triggers, no-copy/countered
spells, source removal, hidden face-down sources, chained effects and saves.
Unknown copy wording is not compiled. This does not implement arbitrary external
copy replacements, full continuous-effect layering, all copy exceptions or all
nonnumeric as-enters choices. A chain is limited to 50 applied copy effects.
Rules references: CR 614.12, 616.1c and 707.2/707.9 in the official rules above,
[Spark Double release notes](https://magic.wizards.com/en/news/feature/war-spark-release-notes-2019-04-19)
and [Cursed Mirror release notes](https://media.wizards.com/2021/downloads/STX_Release_Notes/EN_MTGSTX_FAQ_04122021.pdf).


## Damage result counter replacements

`damage-effects.mjs` prepares damage packets and converts infect, wither and
combat toxic into counter events before committing results. Combat placements
retain their non-effect origin; noncombat damage from a resolving effect retains
that origin. A later replacement can make an initially non-effect placement
eligible for an effect-only replacement under CR 614.16. Each damage source has
its own placement event; halving multiple toxic-1 sources rounds each separately.
Numeric toxic instances add across printed abilities, supported continuous grants
and repeated temporary grants.

When order matters, a serializable counter choice holds the whole damage batch.
The affected player chooses; all ordinary damage, loyalty/defense removal,
lifelink, commander damage, counters and damage histories wait. Counter and
damage/death observers then see the complete committed event. Combat remembers
which damage step it was applying; spell continuations resume once without
repeating a fight, drawing early or replaying damage after reconnect. A preview
whose outcome depends on a replacement choice says so and still permits moving
to damage. This is not a preview range calculator or a complete damage
replacement/prevention/life-result rules layer.

Evidence: `tests/damage-counters.test.mjs`, `tests/damage-counters-ui.cjs` and the
affected-seat damage reconnect scenario in `tests/network.test.mjs`. Actual
Viral Drake, Ichor Rats, Bloated Contaminator and counter-provider Oracle text is
read from previously cached fixtures; no later manifest deck is fetched. Rules
references are CR 120.3?120.5, 614.16, 616 and 702.80/90/164, plus the official
[toxic release notes](https://magic.wizards.com/en/news/feature/phyrexia-all-will-be-one-release-notes).
