# Exact playtest deck audit

Lists supplied on 2026-10-15. This report covers every non-empty Oracle paragraph in both exact lists, separately from the older 39-deck fixture. Current Oracle data came from Scryfall.

**Current verification:** 1,345 unit and network tests pass. All 43 Electron workflows, the Windows installer/ZIP build, updater checksum validation and the packaged-app smoke test pass. The real two-client damage reconnect test passes. The previous copy checkpoint passed all 42 workflows, with its focused copy UI rerun after privacy/payment corrections. Shared entry preparation now supports the tested Spark Double and Cursed Mirror copy clauses, per-controller choice ordering, numeric values, shock life and tapped conditions before counter replacements and simultaneous entry. Copy evidence includes working mana and loyalty abilities, entry triggers, chained effects, hidden face-down sources, saves, source removal and temporary-layer expiry. These totals include the wider engine suite; they are not a count of fully implemented cards. Full continuous-effect layering, external copy replacements, additional copy exceptions, nonnumeric entry costs/choices, additional damage replacement/prevention cases and other unchecked paragraphs remain open. No deck is certified fully working by this report.

**PASS (regression)** means identical Oracle text has checked behavioral evidence in the maintained deck audit and the full unit suite passed. **FAIL (manual resolution)** means the current resolution compiler has no complete handler. **UNVERIFIED** means more behavioral evidence is needed; a recognized handler alone is not a pass. Static effects, trigger conditions, target rules and interactions can still be missing even when an effect compiles. No deck is certified fully working by this report.

## Atraxa, Praetors' Voice

100 cards; 95 distinct names. Paragraphs: 104 regression passes, 12 manual-resolution failures, 69 unverified.

### 1 × Atraxa, Praetors' Voice

[Current Oracle text](https://scryfall.com/card/2xm/190/atraxa-praetors-voice?utm_source=api)

- [ ] **UNVERIFIED** Flying, vigilance, deathtouch, lifelink
- [ ] **UNVERIFIED** At the beginning of your end step, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.) — Effect handler: recognized.

### 1 × Adarkar Wastes

[Current Oracle text](https://scryfall.com/card/eoc/147/adarkar-wastes?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** {T}: Add {W} or {U}. This land deals 1 damage to you.

### 1 × An Offer You Can't Refuse

[Current Oracle text](https://scryfall.com/card/fdn/160/an-offer-you-cant-refuse?utm_source=api)

- [x] **PASS (regression)** Counter target noncreature spell. Its controller creates two Treasure tokens. (They're artifacts with "{T}, Sacrifice this token: Add one mana of any color.") Evidence: [tests/playtest-spells.test.mjs](../tests/playtest-spells.test.mjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Counter target noncreature spell. Its controller creates two Treasure tokens. (They're artifacts with "{T}, Sacrifice this token: Add one mana of any color.")

### 1 × Arcane Denial

[Current Oracle text](https://scryfall.com/card/msc/147/arcane-denial?utm_source=api)

- [x] **PASS (regression)** Counter target spell. Its controller may draw up to two cards at the beginning of the next turn's upkeep. Evidence: [tests/kess.test.mjs](../tests/kess.test.mjs), [tests/kess-ui.cjs](../tests/kess-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/mizzix.test.mjs](../tests/mizzix.test.mjs), [tests/kalamax.test.mjs](../tests/kalamax.test.mjs), [tests/niv-mizzet.test.mjs](../tests/niv-mizzet.test.mjs).
- [x] **PASS (regression)** You draw a card at the beginning of the next turn's upkeep. Evidence: [tests/kess.test.mjs](../tests/kess.test.mjs), [tests/kess-ui.cjs](../tests/kess-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/mizzix.test.mjs](../tests/mizzix.test.mjs), [tests/kalamax.test.mjs](../tests/kalamax.test.mjs), [tests/niv-mizzet.test.mjs](../tests/niv-mizzet.test.mjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Counter target spell. Its controller may draw up to two cards at the beginning of the next turn's upkeep. / You draw a card at the beginning of the next turn's upkeep.

### 1 × Arcane Signet

[Current Oracle text](https://scryfall.com/card/frc/20/arcane-signet?utm_source=api)

- [x] **PASS (regression)** {T}: Add one mana of any color in your commander's color identity. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Ashiok, Dream Render

[Current Oracle text](https://scryfall.com/card/war/228/ashiok-dream-render?utm_source=api)

- [x] **PASS (regression)** Spells and abilities your opponents control can't cause their controller to search their library. Evidence: [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs).
- [x] **PASS (regression)** −1: Target player mills four cards. Then exile each opponent's graveyard. — Effect handler: recognized. Evidence: [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs).

### 1 × Beast Within

[Current Oracle text](https://scryfall.com/card/msc/169/beast-within?utm_source=api)

- [x] **PASS (regression)** Destroy target permanent. Its controller creates a 3/3 green Beast creature token. Evidence: [tests/kalamax.test.mjs](../tests/kalamax.test.mjs), [tests/kalamax-ui.cjs](../tests/kalamax-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/mizzix.test.mjs](../tests/mizzix.test.mjs), [tests/talrand.test.mjs](../tests/talrand.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/arahbo-utilities.test.mjs](../tests/arahbo-utilities.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Destroy target permanent. Its controller creates a 3/3 green Beast creature token.

### 1 × Breeding Pool

[Current Oracle text](https://scryfall.com/card/trk/279/breeding-pool?utm_source=api)

- [ ] **UNVERIFIED** ({T}: Add {G} or {U}.)
- [x] **PASS (regression)** As this land enters, you may pay 2 life. If you don't, it enters tapped. Evidence: [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).

### 1 × Brokers Ascendancy

[Current Oracle text](https://scryfall.com/card/snc/170/brokers-ascendancy?utm_source=api)

- [ ] **UNVERIFIED** At the beginning of your end step, put a +1/+1 counter on each creature you control and a loyalty counter on each planeswalker you control. — Effect handler: missing.

### 1 × Brushland

[Current Oracle text](https://scryfall.com/card/bro/259/brushland?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** {T}: Add {G} or {W}. This land deals 1 damage to you.

### 1 × Burgeoning

[Current Oracle text](https://scryfall.com/card/c16/143/burgeoning?utm_source=api)

- [ ] **UNVERIFIED** Whenever an opponent plays a land, you may put a land card from your hand onto the battlefield. — Effect handler: recognized.

### 1 × Canopy Vista

[Current Oracle text](https://scryfall.com/card/msc/227/canopy-vista?utm_source=api)

- [ ] **UNVERIFIED** ({T}: Add {G} or {W}.)
- [ ] **UNVERIFIED** This land enters tapped unless you control two or more basic lands.

### 1 × Caves of Koilos

[Current Oracle text](https://scryfall.com/card/frc/66/caves-of-koilos?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** {T}: Add {W} or {B}. This land deals 1 damage to you.

### 1 × Chromatic Lantern

[Current Oracle text](https://scryfall.com/card/mbc/73/chromatic-lantern?utm_source=api)

- [ ] **UNVERIFIED** Lands you control have "{T}: Add one mana of any color."
- [x] **PASS (regression)** {T}: Add one mana of any color. Evidence: [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/goreclaw-ui.cjs](../tests/goreclaw-ui.cjs), [tests/combat.test.mjs](../tests/combat.test.mjs), [tests/phase-flow.test.mjs](../tests/phase-flow.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs).

### 1 × Command Tower

[Current Oracle text](https://scryfall.com/card/frc/22/command-tower?utm_source=api)

- [x] **PASS (regression)** {T}: Add one mana of any color in your commander's color identity. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Consecrated Sphinx

[Current Oracle text](https://scryfall.com/card/2x2/43/consecrated-sphinx?utm_source=api)

- [x] **PASS (regression)** Flying Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [x] **PASS (regression)** Whenever an opponent draws a card, you may draw two cards. — Effect handler: recognized. Evidence: [tests/niv-mizzet.test.mjs](../tests/niv-mizzet.test.mjs), [tests/niv-mizzet-ui.cjs](../tests/niv-mizzet-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/kalamax.test.mjs](../tests/kalamax.test.mjs), [tests/mizzix.test.mjs](../tests/mizzix.test.mjs), [tests/talrand.test.mjs](../tests/talrand.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/arahbo-utilities.test.mjs](../tests/arahbo-utilities.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs).

### 1 × Contagion Engine

[Current Oracle text](https://scryfall.com/card/som/145/contagion-engine?utm_source=api)

- [x] **PASS (regression)** When this artifact enters, put a -1/-1 counter on each creature target player controls. — Effect handler: recognized. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [x] **PASS (regression)** {4}, {T}: Proliferate twice. (Choose any number of permanents and/or players, then give each another counter of each kind already there. Then do it again.) — Effect handler: recognized. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Contentious Plan

[Current Oracle text](https://scryfall.com/card/war/46/contentious-plan?utm_source=api)

- [x] **PASS (regression)** Proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.) Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [x] **PASS (regression)** Draw a card. Evidence: [tests/kess.test.mjs](../tests/kess.test.mjs), [tests/kess-ui.cjs](../tests/kess-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/mizzix.test.mjs](../tests/mizzix.test.mjs), [tests/kalamax.test.mjs](../tests/kalamax.test.mjs), [tests/niv-mizzet.test.mjs](../tests/niv-mizzet.test.mjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.) / Draw a card.

### 1 × Crop Rotation

[Current Oracle text](https://scryfall.com/card/dmr/154/crop-rotation?utm_source=api)

- [x] **PASS (regression)** As an additional cost to cast this spell, sacrifice a land. Evidence: [tests/kalamax.test.mjs](../tests/kalamax.test.mjs), [tests/kalamax-ui.cjs](../tests/kalamax-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/mizzix.test.mjs](../tests/mizzix.test.mjs), [tests/talrand.test.mjs](../tests/talrand.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/arahbo-utilities.test.mjs](../tests/arahbo-utilities.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs).
- [ ] **UNVERIFIED** Search your library for a land card, put that card onto the battlefield, then shuffle.
- Resolution diagnostic: recognized; still requires behavior/target tests — Search your library for a land card, put that card onto the battlefield, then shuffle.

### 1 × Cultivate

[Current Oracle text](https://scryfall.com/card/msc/172/cultivate?utm_source=api)

- [x] **PASS (regression)** Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle. Evidence: [tests/kalamax.test.mjs](../tests/kalamax.test.mjs), [tests/kalamax-ui.cjs](../tests/kalamax-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/mizzix.test.mjs](../tests/mizzix.test.mjs), [tests/talrand.test.mjs](../tests/talrand.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/arahbo-utilities.test.mjs](../tests/arahbo-utilities.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.

### 1 × Cyclonic Rift

[Current Oracle text](https://scryfall.com/card/rvr/40/cyclonic-rift?utm_source=api)

- [x] **PASS (regression)** Return target nonland permanent you don't control to its owner's hand. Evidence: [tests/kess.test.mjs](../tests/kess.test.mjs), [tests/kess-ui.cjs](../tests/kess-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/mizzix.test.mjs](../tests/mizzix.test.mjs), [tests/kalamax.test.mjs](../tests/kalamax.test.mjs), [tests/niv-mizzet.test.mjs](../tests/niv-mizzet.test.mjs).
- [x] **PASS (regression)** Overload {6}{U} (You may cast this spell for its overload cost. If you do, change "target" in its text to "each.") Evidence: [tests/kess.test.mjs](../tests/kess.test.mjs), [tests/kess-ui.cjs](../tests/kess-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/mizzix.test.mjs](../tests/mizzix.test.mjs), [tests/kalamax.test.mjs](../tests/kalamax.test.mjs), [tests/niv-mizzet.test.mjs](../tests/niv-mizzet.test.mjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Return target nonland permanent you don't control to its owner's hand.
- Resolution diagnostic: recognized; still requires behavior/target tests — Return each nonland permanent you don't control to its owner's hand.

### 1 × Deathcap Glade

[Current Oracle text](https://scryfall.com/card/sos/253/deathcap-glade?utm_source=api)

- [ ] **UNVERIFIED** This land enters tapped unless you control two or more other lands.
- [ ] **UNVERIFIED** {T}: Add {B} or {G}.

### 1 × Deepglow Skate

[Current Oracle text](https://scryfall.com/card/eoc/70/deepglow-skate?utm_source=api)

- [ ] **UNVERIFIED** When this creature enters, double the number of each kind of counter on any number of target permanents. — Effect handler: recognized.

### 1 × Deserted Beach

[Current Oracle text](https://scryfall.com/card/fra/176/deserted-beach?utm_source=api)

- [ ] **UNVERIFIED** This land enters tapped unless you control two or more other lands.
- [ ] **UNVERIFIED** {T}: Add {W} or {U}.

### 1 × Displacer Kitten

[Current Oracle text](https://scryfall.com/card/clb/63/displacer-kitten?utm_source=api)

- [ ] **UNVERIFIED** Avoidance — Whenever you cast a noncreature spell, exile up to one target nonland permanent you control, then return that card to the battlefield under its owner's control. — Effect handler: missing.

### 1 × Dovin's Veto

[Current Oracle text](https://scryfall.com/card/war/193/dovins-veto?utm_source=api)

- [x] **PASS (regression)** This spell can't be countered. Evidence: [tests/playtest-spells.test.mjs](../tests/playtest-spells.test.mjs).
- [x] **PASS (regression)** Counter target noncreature spell. Evidence: [tests/playtest-spells.test.mjs](../tests/playtest-spells.test.mjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Counter target noncreature spell.

### 1 × Dreamroot Cascade

[Current Oracle text](https://scryfall.com/card/sos/254/dreamroot-cascade?utm_source=api)

- [ ] **UNVERIFIED** This land enters tapped unless you control two or more other lands.
- [ ] **UNVERIFIED** {T}: Add {G} or {U}.

### 1 × Drowned Catacomb

[Current Oracle text](https://scryfall.com/card/frc/69/drowned-catacomb?utm_source=api)

- [ ] **UNVERIFIED** This land enters tapped unless you control an Island or a Swamp.
- [x] **PASS (regression)** {T}: Add {U} or {B}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Dryad of the Ilysian Grove

[Current Oracle text](https://scryfall.com/card/cmm/891/dryad-of-the-ilysian-grove?utm_source=api)

- [ ] **UNVERIFIED** You may play an additional land on each of your turns.
- [ ] **UNVERIFIED** Lands you control are every basic land type in addition to their other types.

### 1 × Elspeth, Sun's Champion

[Current Oracle text](https://scryfall.com/card/frc/24/elspeth-suns-champion?utm_source=api)

- [x] **PASS (regression)** +1: Create three 1/1 white Soldier creature tokens. — Effect handler: recognized. Evidence: [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).
- [x] **PASS (regression)** −3: Destroy all creatures with power 4 or greater. — Effect handler: recognized. Evidence: [tests/playtest-spells.test.mjs](../tests/playtest-spells.test.mjs).
- [x] **PASS (regression)** −7: You get an emblem with "Creatures you control get +2/+2 and have flying." — Effect handler: recognized. Evidence: [tests/turn-effects.test.mjs](../tests/turn-effects.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).

### 1 × Everflowing Chalice

[Current Oracle text](https://scryfall.com/card/eoc/137/everflowing-chalice?utm_source=api)

- [x] **PASS (regression)** Multikicker {2} (You may pay an additional {2} any number of times as you cast this spell.) Evidence: [tests/isshin.test.mjs](../tests/isshin.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/isshin-ui.cjs](../tests/isshin-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/aurelia-utilities.test.mjs](../tests/aurelia-utilities.test.mjs), [tests/arahbo.test.mjs](../tests/arahbo.test.mjs), [tests/extra-combat.test.mjs](../tests/extra-combat.test.mjs).
- [x] **PASS (regression)** This artifact enters with a charge counter on it for each time it was kicked. Evidence: [tests/isshin.test.mjs](../tests/isshin.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/isshin-ui.cjs](../tests/isshin-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/aurelia-utilities.test.mjs](../tests/aurelia-utilities.test.mjs), [tests/arahbo.test.mjs](../tests/arahbo.test.mjs), [tests/extra-combat.test.mjs](../tests/extra-combat.test.mjs).
- [x] **PASS (regression)** {T}: Add {C} for each charge counter on this artifact. Evidence: [tests/isshin.test.mjs](../tests/isshin.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/isshin-ui.cjs](../tests/isshin-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/aurelia-utilities.test.mjs](../tests/aurelia-utilities.test.mjs), [tests/arahbo.test.mjs](../tests/arahbo.test.mjs), [tests/extra-combat.test.mjs](../tests/extra-combat.test.mjs).

### 1 × Evolution Sage

[Current Oracle text](https://scryfall.com/card/ecc/105/evolution-sage?utm_source=api)

- [x] **PASS (regression)** Landfall — Whenever a land you control enters, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.) — Effect handler: recognized. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Exotic Orchard

[Current Oracle text](https://scryfall.com/card/mbc/79/exotic-orchard?utm_source=api)

- [x] **PASS (regression)** {T}: Add one mana of any color that a land an opponent controls could produce. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Fabled Passage

[Current Oracle text](https://scryfall.com/card/frc/71/fabled-passage?utm_source=api)

- [ ] **FAIL (manual resolution)** {T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle. Then if you control four or more lands, untap that land. — Effect handler: missing.

### 1 × Farewell

[Current Oracle text](https://scryfall.com/card/mkc/64/farewell?utm_source=api)

- [ ] **FAIL (manual resolution)** Choose one or more —
- [ ] **FAIL (manual resolution)** • Exile all artifacts.
- [ ] **FAIL (manual resolution)** • Exile all creatures.
- [ ] **FAIL (manual resolution)** • Exile all enchantments.
- [ ] **FAIL (manual resolution)** • Exile all graveyards.
- Resolution diagnostic: **manual fallback** — Choose one or more — / • Exile all artifacts. / • Exile all creatures. / • Exile all enchantments. / • Exile all graveyards.

### 1 × Fellwar Stone

[Current Oracle text](https://scryfall.com/card/mbc/74/fellwar-stone?utm_source=api)

- [x] **PASS (regression)** {T}: Add one mana of any color that a land an opponent controls could produce. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Flux Channeler

[Current Oracle text](https://scryfall.com/card/cmm/847/flux-channeler?utm_source=api)

- [ ] **UNVERIFIED** Whenever you cast a noncreature spell, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.) — Effect handler: recognized.

### 4 × Forest

[Current Oracle text](https://scryfall.com/card/mdd/301/forest?utm_source=api)

- [x] **PASS (regression)** ({T}: Add {G}.) Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Generous Gift

[Current Oracle text](https://scryfall.com/card/msc/133/generous-gift?utm_source=api)

- [x] **PASS (regression)** Destroy target permanent. Its controller creates a 3/3 green Elephant creature token. Evidence: [tests/isshin.test.mjs](../tests/isshin.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/isshin-ui.cjs](../tests/isshin-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/aurelia-utilities.test.mjs](../tests/aurelia-utilities.test.mjs), [tests/arahbo.test.mjs](../tests/arahbo.test.mjs), [tests/extra-combat.test.mjs](../tests/extra-combat.test.mjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Destroy target permanent. Its controller creates a 3/3 green Elephant creature token.

### 1 × Godless Shrine

[Current Oracle text](https://scryfall.com/card/trk/285/godless-shrine?utm_source=api)

- [ ] **UNVERIFIED** ({T}: Add {W} or {B}.)
- [x] **PASS (regression)** As this land enters, you may pay 2 life. If you don't, it enters tapped. Evidence: [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).

### 1 × Golgari Signet

[Current Oracle text](https://scryfall.com/card/dsc/246/golgari-signet?utm_source=api)

- [ ] **UNVERIFIED** {1}, {T}: Add {B}{G}.

### 1 × Grateful Apparition

[Current Oracle text](https://scryfall.com/card/cmm/824/grateful-apparition?utm_source=api)

- [x] **PASS (regression)** Flying Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** Whenever this creature deals combat damage to a player or planeswalker, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.) — Effect handler: recognized.

### 1 × Hallowed Fountain

[Current Oracle text](https://scryfall.com/card/trk/286/hallowed-fountain?utm_source=api)

- [ ] **UNVERIFIED** ({T}: Add {W} or {U}.)
- [x] **PASS (regression)** As this land enters, you may pay 2 life. If you don't, it enters tapped. Evidence: [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).

### 1 × Hinterland Harbor

[Current Oracle text](https://scryfall.com/card/msc/250/hinterland-harbor?utm_source=api)

- [ ] **UNVERIFIED** This land enters tapped unless you control a Forest or an Island.
- [ ] **UNVERIFIED** {T}: Add {G} or {U}.

### 1 × Ichor Rats

[Current Oracle text](https://scryfall.com/card/som/67/ichor-rats?utm_source=api)

- [x] **PASS (regression)** Infect (This creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.) Evidence: [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).
- [ ] **UNVERIFIED** When this creature enters, each player gets a poison counter. — Effect handler: recognized.

### 1 × Ichormoon Gauntlet

[Current Oracle text](https://scryfall.com/card/one/56/ichormoon-gauntlet?utm_source=api)

- [ ] **UNVERIFIED** Planeswalkers you control have "[0]: Proliferate" and "[−12]: Take an extra turn after this one."
- [x] **PASS (regression)** Whenever you cast a noncreature spell, choose a counter on target permanent. Put an additional counter of that kind on that permanent. — Effect handler: recognized. Evidence: [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs).

### 1 × Inexorable Tide

[Current Oracle text](https://scryfall.com/card/mm2/49/inexorable-tide?utm_source=api)

- [ ] **UNVERIFIED** Whenever you cast a spell, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.) — Effect handler: recognized.

### 2 × Island

[Current Oracle text](https://scryfall.com/card/mdd/294/island?utm_source=api)

- [x] **PASS (regression)** ({T}: Add {U}.) Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Karn's Bastion

[Current Oracle text](https://scryfall.com/card/eoc/163/karns-bastion?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [x] **PASS (regression)** {4}, {T}: Proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.) — Effect handler: recognized. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Kasmina, Enigma Sage

[Current Oracle text](https://scryfall.com/card/stx/196/kasmina-enigma-sage?utm_source=api)

- [x] **PASS (regression)** Each other planeswalker you control has the loyalty abilities of Kasmina. Evidence: [tests/playtest-decks.test.mjs](../tests/playtest-decks.test.mjs), [tests/token-catalog.test.mjs](../tests/token-catalog.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).
- [ ] **UNVERIFIED** +2: Scry 1. — Effect handler: recognized.
- [x] **PASS (regression)** −X: Create a 0/0 green and blue Fractal creature token. Put X +1/+1 counters on it. — Effect handler: recognized. Evidence: [tests/playtest-decks.test.mjs](../tests/playtest-decks.test.mjs), [tests/token-catalog.test.mjs](../tests/token-catalog.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).
- [ ] **FAIL (manual resolution)** −8: Search your library for an instant or sorcery card that shares a color with this planeswalker, exile that card, then shuffle. You may cast that card without paying its mana cost. — Effect handler: missing.

### 1 × Kodama's Reach

[Current Oracle text](https://scryfall.com/card/ecc/113/kodamas-reach?utm_source=api)

- [x] **PASS (regression)** Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle. Evidence: [tests/kalamax.test.mjs](../tests/kalamax.test.mjs), [tests/kalamax-ui.cjs](../tests/kalamax-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/mizzix.test.mjs](../tests/mizzix.test.mjs), [tests/talrand.test.mjs](../tests/talrand.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/arahbo-utilities.test.mjs](../tests/arahbo-utilities.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.

### 1 × Krosan Grip

[Current Oracle text](https://scryfall.com/card/c21/198/krosan-grip?utm_source=api)

- [x] **PASS (regression)** Split second (As long as this spell is on the stack, players can't cast spells or activate abilities that aren't mana abilities.) Evidence: [tests/playtest-spells.test.mjs](../tests/playtest-spells.test.mjs).
- [x] **PASS (regression)** Destroy target artifact or enchantment. Evidence: [tests/playtest-spells.test.mjs](../tests/playtest-spells.test.mjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Destroy target artifact or enchantment.

### 1 × Lae'zel, Vlaakith's Champion

[Current Oracle text](https://scryfall.com/card/clb/29/laezel-vlaakiths-champion?utm_source=api)

- [ ] **UNVERIFIED** If you would put one or more counters on a creature or planeswalker you control or on yourself, put that many plus one of each of those kinds of counters on that permanent or player instead.
- [x] **PASS (regression)** Choose a Background (You can have a Background as a second commander.) Evidence: [tests/aurelia.test.mjs](../tests/aurelia.test.mjs), [tests/battlefield-entry.test.mjs](../tests/battlefield-entry.test.mjs), [tests/hotseat-ui.cjs](../tests/hotseat-ui.cjs), [tests/spell-resolution.test.mjs](../tests/spell-resolution.test.mjs), [tests/spell-resolution-ui.cjs](../tests/spell-resolution-ui.cjs), [tests/extra-combat.test.mjs](../tests/extra-combat.test.mjs), [tests/aurelia-ui.cjs](../tests/aurelia-ui.cjs), [tests/aurelia-combat.test.mjs](../tests/aurelia-combat.test.mjs), [tests/aurelia-actions-ui.cjs](../tests/aurelia-actions-ui.cjs), [tests/aurelia-utilities.test.mjs](../tests/aurelia-utilities.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs).

### 1 × Eladamri's Call

[Current Oracle text](https://scryfall.com/card/mh1/197/eladamris-call?utm_source=api)

- [ ] **FAIL (manual resolution)** Search your library for a creature card, reveal that card, put it into your hand, then shuffle.
- Resolution diagnostic: **manual fallback** — Search your library for a creature card, reveal that card, put it into your hand, then shuffle.

### 1 × Llanowar Wastes

[Current Oracle text](https://scryfall.com/card/soc/383/llanowar-wastes?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** {T}: Add {B} or {G}. This land deals 1 damage to you.

### 1 × Magistrate's Scepter

[Current Oracle text](https://scryfall.com/card/m19/238/magistrates-scepter?utm_source=api)

- [ ] **UNVERIFIED** {4}, {T}: Put a charge counter on this artifact. — Effect handler: recognized.
- [x] **PASS (regression)** {T}, Remove three charge counters from this artifact: Take an extra turn after this one. — Effect handler: recognized. Evidence: [tests/turn-effects.test.mjs](../tests/turn-effects.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).

### 1 × Narset, Parter of Veils

[Current Oracle text](https://scryfall.com/card/cmm/853/narset-parter-of-veils?utm_source=api)

- [x] **PASS (regression)** Each opponent can't draw more than one card each turn. Evidence: [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).
- [x] **PASS (regression)** −2: Look at the top four cards of your library. You may reveal a noncreature, nonland card from among them and put it into your hand. Put the rest on the bottom of your library in a random order. — Effect handler: recognized. Evidence: [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).

### 1 × Nyxbloom Ancient

[Current Oracle text](https://scryfall.com/card/thb/190/nyxbloom-ancient?utm_source=api)

- [x] **PASS (regression)** Trample Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [x] **PASS (regression)** If you tap a permanent for mana, it produces three times as much of that mana instead. Evidence: [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/goreclaw-ui.cjs](../tests/goreclaw-ui.cjs), [tests/combat.test.mjs](../tests/combat.test.mjs), [tests/phase-flow.test.mjs](../tests/phase-flow.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs).

### 1 × Oath of Kaya

[Current Oracle text](https://scryfall.com/card/war/209/oath-of-kaya?utm_source=api)

- [ ] **UNVERIFIED** When Oath of Kaya enters, it deals 3 damage to any target and you gain 3 life. — Effect handler: missing.
- [ ] **UNVERIFIED** Whenever an opponent attacks a planeswalker you control with one or more creatures, Oath of Kaya deals 2 damage to that player and you gain 2 life. — Effect handler: missing.

### 1 × Oath of Nissa

[Current Oracle text](https://scryfall.com/card/ogw/140/oath-of-nissa?utm_source=api)

- [ ] **UNVERIFIED** When Oath of Nissa enters, look at the top three cards of your library. You may reveal a creature, land, or planeswalker card from among them and put it into your hand. Put the rest on the bottom of your library in any order. — Effect handler: missing.
- [ ] **UNVERIFIED** You may spend mana as though it were mana of any color to cast planeswalker spells.

### 1 × Oath of Teferi

[Current Oracle text](https://scryfall.com/card/cmm/934/oath-of-teferi?utm_source=api)

- [x] **PASS (regression)** When Oath of Teferi enters, exile another target permanent you control. Return it to the battlefield under its owner's control at the beginning of the next end step. — Effect handler: recognized. Evidence: [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs).
- [ ] **UNVERIFIED** You may activate the loyalty abilities of planeswalkers you control twice each turn rather than only once.

### 1 × Overgrown Tomb

[Current Oracle text](https://scryfall.com/card/trk/289/overgrown-tomb?utm_source=api)

- [ ] **UNVERIFIED** ({T}: Add {B} or {G}.)
- [x] **PASS (regression)** As this land enters, you may pay 2 life. If you don't, it enters tapped. Evidence: [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).

### 1 × Path to Exile

[Current Oracle text](https://scryfall.com/card/frc/30/path-to-exile?utm_source=api)

- [x] **PASS (regression)** Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle. Evidence: [tests/isshin.test.mjs](../tests/isshin.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/isshin-ui.cjs](../tests/isshin-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/aurelia-utilities.test.mjs](../tests/aurelia-utilities.test.mjs), [tests/arahbo.test.mjs](../tests/arahbo.test.mjs), [tests/extra-combat.test.mjs](../tests/extra-combat.test.mjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.

### 2 × Plains

[Current Oracle text](https://scryfall.com/card/mdd/292/plains?utm_source=api)

- [x] **PASS (regression)** ({T}: Add {W}.) Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Prairie Stream

[Current Oracle text](https://scryfall.com/card/frc/79/prairie-stream?utm_source=api)

- [ ] **UNVERIFIED** ({T}: Add {W} or {U}.)
- [ ] **UNVERIFIED** This land enters tapped unless you control two or more basic lands.

### 1 × Prologue to Phyresis

[Current Oracle text](https://scryfall.com/card/one/65/prologue-to-phyresis?utm_source=api)

- [ ] **UNVERIFIED** Each opponent gets a poison counter.
- [x] **PASS (regression)** Draw a card. Evidence: [tests/kess.test.mjs](../tests/kess.test.mjs), [tests/kess-ui.cjs](../tests/kess-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/mizzix.test.mjs](../tests/mizzix.test.mjs), [tests/kalamax.test.mjs](../tests/kalamax.test.mjs), [tests/niv-mizzet.test.mjs](../tests/niv-mizzet.test.mjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Each opponent gets a poison counter. / Draw a card.

### 1 × Rampant Growth

[Current Oracle text](https://scryfall.com/card/tdc/265/rampant-growth?utm_source=api)

- [x] **PASS (regression)** Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle. Evidence: [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/goreclaw-ui.cjs](../tests/goreclaw-ui.cjs), [tests/combat.test.mjs](../tests/combat.test.mjs), [tests/phase-flow.test.mjs](../tests/phase-flow.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.

### 1 × Reflecting Pool

[Current Oracle text](https://scryfall.com/card/frc/23/reflecting-pool?utm_source=api)

- [ ] **UNVERIFIED** {T}: Add one mana of any type that a land you control could produce.

### 1 × Replicating Ring

[Current Oracle text](https://scryfall.com/card/moc/372/replicating-ring?utm_source=api)

- [x] **PASS (regression)** {T}: Add one mana of any color. Evidence: [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/goreclaw-ui.cjs](../tests/goreclaw-ui.cjs), [tests/combat.test.mjs](../tests/combat.test.mjs), [tests/phase-flow.test.mjs](../tests/phase-flow.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs).
- [ ] **UNVERIFIED** At the beginning of your upkeep, put a night counter on this artifact. Then if it has eight or more night counters on it, remove all of them and create eight colorless snow artifact tokens named Replicated Ring with "{T}: Add one mana of any color." — Effect handler: missing.

### 1 × Shalai, Voice of Plenty

[Current Oracle text](https://scryfall.com/card/tdc/130/shalai-voice-of-plenty?utm_source=api)

- [x] **PASS (regression)** Flying Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** You, planeswalkers you control, and other creatures you control have hexproof.
- [ ] **UNVERIFIED** {4}{G}{G}: Put a +1/+1 counter on each creature you control. — Effect handler: recognized.

### 1 × Shattered Sanctum

[Current Oracle text](https://scryfall.com/card/sos/260/shattered-sanctum?utm_source=api)

- [ ] **UNVERIFIED** This land enters tapped unless you control two or more other lands.
- [x] **PASS (regression)** {T}: Add {W} or {B}. Evidence: [tests/isshin.test.mjs](../tests/isshin.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/isshin-ui.cjs](../tests/isshin-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/aurelia-utilities.test.mjs](../tests/aurelia-utilities.test.mjs), [tests/arahbo.test.mjs](../tests/arahbo.test.mjs), [tests/extra-combat.test.mjs](../tests/extra-combat.test.mjs).

### 1 × Sol Ring

[Current Oracle text](https://scryfall.com/card/frc/21/sol-ring?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}{C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Sorin the Mirthless

[Current Oracle text](https://scryfall.com/card/vow/131/sorin-the-mirthless?utm_source=api)

- [x] **PASS (regression)** +1: Look at the top card of your library. You may reveal that card and put it into your hand. If you do, you lose life equal to its mana value. — Effect handler: recognized. Evidence: [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).
- [ ] **UNVERIFIED** −2: Create a 2/3 black Vampire creature token with flying and lifelink. — Effect handler: recognized.
- [ ] **UNVERIFIED** −7: Sorin deals 13 damage to any target. You gain 13 life. — Effect handler: recognized.

### 1 × Swamp

[Current Oracle text](https://scryfall.com/card/mdd/296/swamp?utm_source=api)

- [x] **PASS (regression)** ({T}: Add {B}.) Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Swords to Plowshares

[Current Oracle text](https://scryfall.com/card/frc/37/swords-to-plowshares?utm_source=api)

- [x] **PASS (regression)** Exile target creature. Its controller gains life equal to its power. Evidence: [tests/isshin.test.mjs](../tests/isshin.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/isshin-ui.cjs](../tests/isshin-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/aurelia-utilities.test.mjs](../tests/aurelia-utilities.test.mjs), [tests/arahbo.test.mjs](../tests/arahbo.test.mjs), [tests/extra-combat.test.mjs](../tests/extra-combat.test.mjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Exile target creature. Its controller gains life equal to its power.

### 1 × Tamiyo, Compleated Sage

[Current Oracle text](https://scryfall.com/card/neo/238/tamiyo-compleated-sage?utm_source=api)

- [x] **PASS (regression)** Compleated ({G/U/P} can be paid with {G}, {U}, or 2 life. If life was paid, this planeswalker enters with two fewer loyalty counters.) Evidence: [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).
- [ ] **FAIL (manual resolution)** +1: Tap up to one target artifact or creature. It doesn't untap during its controller's next untap step. — Effect handler: missing.
- [x] **PASS (regression)** −X: Exile target nonland permanent card with mana value X from your graveyard. Create a token that's a copy of that card. — Effect handler: recognized. Evidence: [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs).
- [x] **PASS (regression)** −7: Create Tamiyo's Notebook, a legendary colorless Book artifact token with "Spells you cast cost {2} less to cast" and "{T}: Draw a card." — Effect handler: recognized. Evidence: [tests/playtest-decks.test.mjs](../tests/playtest-decks.test.mjs), [tests/token-catalog.test.mjs](../tests/token-catalog.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).

### 1 × Tamiyo, Field Researcher

[Current Oracle text](https://scryfall.com/card/inr/249/tamiyo-field-researcher?utm_source=api)

- [x] **PASS (regression)** +1: Choose up to two target creatures. Until your next turn, whenever either of those creatures deals combat damage, you draw a card. — Effect handler: recognized. Evidence: [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).
- [x] **PASS (regression)** −2: Tap up to two target nonland permanents. They don't untap during their controller's next untap step. — Effect handler: recognized. Evidence: [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).
- [x] **PASS (regression)** −7: Draw three cards. You get an emblem with "You may cast spells from your hand without paying their mana costs." — Effect handler: recognized. Evidence: [tests/turn-effects.test.mjs](../tests/turn-effects.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).

### 1 × Teferi's Ageless Insight

[Current Oracle text](https://scryfall.com/card/mkc/119/teferis-ageless-insight?utm_source=api)

- [x] **PASS (regression)** If you would draw a card except the first one you draw in each of your draw steps, draw two cards instead. Evidence: [tests/niv-mizzet.test.mjs](../tests/niv-mizzet.test.mjs), [tests/niv-mizzet-ui.cjs](../tests/niv-mizzet-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/kalamax.test.mjs](../tests/kalamax.test.mjs), [tests/mizzix.test.mjs](../tests/mizzix.test.mjs), [tests/talrand.test.mjs](../tests/talrand.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/arahbo-utilities.test.mjs](../tests/arahbo-utilities.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs).

### 1 × Teferi, Hero of Dominaria

[Current Oracle text](https://scryfall.com/card/dom/207/teferi-hero-of-dominaria?utm_source=api)

- [x] **PASS (regression)** +1: Draw a card. At the beginning of the next end step, untap up to two lands. — Effect handler: recognized. Evidence: [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs).
- [x] **PASS (regression)** −3: Put target nonland permanent into its owner's library third from the top. — Effect handler: recognized. Evidence: [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs).
- [x] **PASS (regression)** −8: You get an emblem with "Whenever you draw a card, exile target permanent an opponent controls." — Effect handler: recognized. Evidence: [tests/turn-effects.test.mjs](../tests/turn-effects.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).

### 1 × Teferi, Master of Time

[Current Oracle text](https://scryfall.com/card/m21/75/teferi-master-of-time?utm_source=api)

- [x] **PASS (regression)** You may activate loyalty abilities of Teferi on any player's turn any time you could cast an instant. Evidence: [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).
- [ ] **UNVERIFIED** +1: Draw a card, then discard a card. — Effect handler: recognized.
- [x] **PASS (regression)** −3: Target creature you don't control phases out. (Treat it and anything attached to it as though they don't exist until its controller's next turn.) — Effect handler: recognized. Evidence: [tests/turn-effects.test.mjs](../tests/turn-effects.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).
- [x] **PASS (regression)** −10: Take two extra turns after this one. — Effect handler: recognized. Evidence: [tests/turn-effects.test.mjs](../tests/turn-effects.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).

### 1 × Teferi, Temporal Archmage

[Current Oracle text](https://scryfall.com/card/cmm/125/teferi-temporal-archmage?utm_source=api)

- [ ] **FAIL (manual resolution)** +1: Look at the top two cards of your library. Put one of them into your hand and the other on the bottom of your library. — Effect handler: missing.
- [ ] **FAIL (manual resolution)** −1: Untap up to four target permanents. — Effect handler: missing.
- [x] **PASS (regression)** −10: You get an emblem with "You may activate loyalty abilities of planeswalkers you control on any player's turn any time you could cast an instant." — Effect handler: recognized. Evidence: [tests/turn-effects.test.mjs](../tests/turn-effects.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).
- [ ] **UNVERIFIED** Teferi, Temporal Archmage can be your commander.

### 1 × Tekuthal, Inquiry Dominus

[Current Oracle text](https://scryfall.com/card/eoc/78/tekuthal-inquiry-dominus?utm_source=api)

- [x] **PASS (regression)** Flying Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** If you would proliferate, proliferate twice instead.
- [x] **PASS (regression)** {1}{U/P}{U/P}, Remove three counters from among other artifacts, creatures, and planeswalkers you control: Put an indestructible counter on Tekuthal. ({U/P} can be paid with either {U} or 2 life.) — Effect handler: recognized. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Temple Garden

[Current Oracle text](https://scryfall.com/card/trk/301/temple-garden?utm_source=api)

- [ ] **UNVERIFIED** ({T}: Add {G} or {W}.)
- [x] **PASS (regression)** As this land enters, you may pay 2 life. If you don't, it enters tapped. Evidence: [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).

### 1 × Tezzeret's Gambit

[Current Oracle text](https://scryfall.com/card/eoc/47/tezzerets-gambit?utm_source=api)

- [x] **PASS (regression)** ({U/P} can be paid with either {U} or 2 life.) Evidence: [tests/talrand.test.mjs](../tests/talrand.test.mjs), [tests/talrand-ui.cjs](../tests/talrand-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/arahbo-utilities.test.mjs](../tests/arahbo-utilities.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs).
- [x] **PASS (regression)** Draw two cards, then proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.) Evidence: [tests/playtest-decks.test.mjs](../tests/playtest-decks.test.mjs), [tests/token-catalog.test.mjs](../tests/token-catalog.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — ({U/P} can be paid with either {U} or 2 life.) / Draw two cards, then proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)

### 1 × The Chain Veil

[Current Oracle text](https://scryfall.com/card/cmm/943/the-chain-veil?utm_source=api)

- [x] **PASS (regression)** At the beginning of your end step, if you didn't activate a loyalty ability of a planeswalker this turn, you lose 2 life. — Effect handler: missing. Evidence: [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).
- [x] **PASS (regression)** {4}, {T}: For each planeswalker you control, you may activate one of its loyalty abilities once this turn as though none of its loyalty abilities have been activated this turn. — Effect handler: recognized. Evidence: [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).

### 1 × Thrummingbird

[Current Oracle text](https://scryfall.com/card/eoc/80/thrummingbird?utm_source=api)

- [x] **PASS (regression)** Flying Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [x] **PASS (regression)** Whenever this creature deals combat damage to a player, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.) — Effect handler: recognized. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Sword of Truth and Justice

[Current Oracle text](https://scryfall.com/card/mh1/229/sword-of-truth-and-justice?utm_source=api)

- [ ] **UNVERIFIED** Equipped creature gets +2/+2 and has protection from white and from blue.
- [x] **PASS (regression)** Whenever equipped creature deals combat damage to a player, put a +1/+1 counter on a creature you control, then proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.) — Effect handler: recognized. Evidence: [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs).
- [x] **PASS (regression)** Equip {2} Evidence: [tests/isshin.test.mjs](../tests/isshin.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/isshin-ui.cjs](../tests/isshin-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/aurelia-utilities.test.mjs](../tests/aurelia-utilities.test.mjs), [tests/arahbo.test.mjs](../tests/arahbo.test.mjs), [tests/extra-combat.test.mjs](../tests/extra-combat.test.mjs).

### 1 × Underground River

[Current Oracle text](https://scryfall.com/card/frc/87/underground-river?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** {T}: Add {U} or {B}. This land deals 1 damage to you.

### 1 × Viral Drake

[Current Oracle text](https://scryfall.com/card/nph/49/viral-drake?utm_source=api)

- [x] **PASS (regression)** Flying Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [x] **PASS (regression)** Infect (This creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.) Evidence: [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).
- [ ] **UNVERIFIED** {3}{U}: Proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.) — Effect handler: recognized.

### 1 × Vorinclex, Monstrous Raider

[Current Oracle text](https://scryfall.com/card/khm/199/vorinclex-monstrous-raider?utm_source=api)

- [ ] **UNVERIFIED** Trample, haste
- [ ] **UNVERIFIED** If you would put one or more counters on a permanent or player, put twice that many of each of those kinds of counters on that permanent or player instead.
- [ ] **UNVERIFIED** If an opponent would put one or more counters on a permanent or player, they put half that many of each of those kinds of counters on that permanent or player instead, rounded down.

### 1 × Vraska, Betrayal's Sting

[Current Oracle text](https://scryfall.com/card/ecc/88/vraska-betrayals-sting?utm_source=api)

- [x] **PASS (regression)** Compleated ({B/P} can be paid with {B} or 2 life. If life was paid, this planeswalker enters with two fewer loyalty counters.) Evidence: [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).
- [x] **PASS (regression)** 0: You draw a card and lose 1 life. Proliferate. — Effect handler: recognized. Evidence: [tests/playtest-decks.test.mjs](../tests/playtest-decks.test.mjs), [tests/token-catalog.test.mjs](../tests/token-catalog.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).
- [ ] **FAIL (manual resolution)** −2: Target creature becomes a Treasure artifact with "{T}, Sacrifice this artifact: Add one mana of any color" and loses all other card types and abilities. — Effect handler: missing.
- [x] **PASS (regression)** −9: If target player has fewer than nine poison counters, they get a number of poison counters equal to the difference. — Effect handler: recognized. Evidence: [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs).

### 1 × Watery Grave

[Current Oracle text](https://scryfall.com/card/trk/306/watery-grave?utm_source=api)

- [ ] **UNVERIFIED** ({T}: Add {U} or {B}.)
- [x] **PASS (regression)** As this land enters, you may pay 2 life. If you don't, it enters tapped. Evidence: [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).

### 1 × Woodland Cemetery

[Current Oracle text](https://scryfall.com/card/soc/424/woodland-cemetery?utm_source=api)

- [ ] **UNVERIFIED** This land enters tapped unless you control a Swamp or a Forest.
- [ ] **UNVERIFIED** {T}: Add {B} or {G}.

### 1 × Yavimaya Coast

[Current Oracle text](https://scryfall.com/card/soc/425/yavimaya-coast?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** {T}: Add {G} or {U}. This land deals 1 damage to you.

### 1 × Zagoth Triome

[Current Oracle text](https://scryfall.com/card/iko/259/zagoth-triome?utm_source=api)

- [ ] **UNVERIFIED** ({T}: Add {B}, {G}, or {U}.)
- [x] **PASS (regression)** This land enters tapped. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** Cycling {3} ({3}, Discard this card: Draw a card.)

## Jace, Multiverse Architect

100 cards; 98 distinct names. Paragraphs: 83 regression passes, 22 manual-resolution failures, 80 unverified.

### 1 × Jace, Multiverse Architect

[Current Oracle text](https://scryfall.com/card/frc/1/jace-multiverse-architect?utm_source=api)

- [ ] **UNVERIFIED** At the beginning of combat on each opponent's turn, they may pay {2}. If they don't, creatures they control can't attack Jaces you control this turn. — Effect handler: missing.
- [x] **PASS (regression)** +1: Draw two cards, then put a card from your hand on the bottom of your library. — Effect handler: recognized. Evidence: [tests/playtest-decks.test.mjs](../tests/playtest-decks.test.mjs), [tests/token-catalog.test.mjs](../tests/token-catalog.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).
- [x] **PASS (regression)** −3: Exile another target planeswalker or creature you control. Reveal cards from the top of your library until you reveal a creature or planeswalker card. Put that card onto the battlefield and the rest on the bottom of your library in a random order. — Effect handler: recognized. Evidence: [tests/polymorph.test.mjs](../tests/polymorph.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).
- [ ] **UNVERIFIED** Jace, Multiverse Architect can be your commander.

### 1 × Oath of Teferi

[Current Oracle text](https://scryfall.com/card/cmm/934/oath-of-teferi?utm_source=api)

- [x] **PASS (regression)** When Oath of Teferi enters, exile another target permanent you control. Return it to the battlefield under its owner's control at the beginning of the next end step. — Effect handler: recognized. Evidence: [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs).
- [ ] **UNVERIFIED** You may activate the loyalty abilities of planeswalkers you control twice each turn rather than only once.

### 1 × Synthetic Destiny

[Current Oracle text](https://scryfall.com/card/frc/45/synthetic-destiny?utm_source=api)

- [x] **PASS (regression)** Exile all creatures you control. At the beginning of the next end step, reveal cards from the top of your library until you reveal that many creature cards, put all creature cards revealed this way onto the battlefield, then shuffle the rest of the revealed cards into your library. Evidence: [tests/polymorph.test.mjs](../tests/polymorph.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Exile all creatures you control. At the beginning of the next end step, reveal cards from the top of your library until you reveal that many creature cards, put all creature cards revealed this way onto the battlefield, then shuffle the rest of the revealed cards into your library.

### 1 × Primevals' Glorious Rebirth

[Current Oracle text](https://scryfall.com/card/dmc/165/primevals-glorious-rebirth?utm_source=api)

- [x] **PASS (regression)** (You may cast a legendary sorcery only if you control a legendary creature or planeswalker.) Evidence: [tests/polymorph.test.mjs](../tests/polymorph.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).
- [x] **PASS (regression)** Return all legendary permanent cards from your graveyard to the battlefield. Evidence: [tests/polymorph.test.mjs](../tests/polymorph.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — (You may cast a legendary sorcery only if you control a legendary creature or planeswalker.) / Return all legendary permanent cards from your graveyard to the battlefield.

### 1 × Jin-Gitaxias, Progress Tyrant

[Current Oracle text](https://scryfall.com/card/neo/59/jin-gitaxias-progress-tyrant?utm_source=api)

- [ ] **UNVERIFIED** Whenever you cast an artifact, instant, or sorcery spell, copy that spell. You may choose new targets for the copy. This ability triggers only once each turn. (A copy of a permanent spell becomes a token.) — Effect handler: missing.
- [ ] **UNVERIFIED** Whenever an opponent casts an artifact, instant, or sorcery spell, counter that spell. This ability triggers only once each turn. — Effect handler: missing.

### 1 × Quantum Misalignment

[Current Oracle text](https://scryfall.com/card/msc/152/quantum-misalignment?utm_source=api)

- [x] **PASS (regression)** Create a token that's a copy of target creature you control, except it isn't legendary. Evidence: [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs).
- [x] **PASS (regression)** Rebound (If you cast this spell from your hand, exile it as it resolves. At the beginning of your next upkeep, you may cast this card from exile without paying its mana cost.) Evidence: [tests/aurelia.test.mjs](../tests/aurelia.test.mjs), [tests/battlefield-entry.test.mjs](../tests/battlefield-entry.test.mjs), [tests/hotseat-ui.cjs](../tests/hotseat-ui.cjs), [tests/spell-resolution.test.mjs](../tests/spell-resolution.test.mjs), [tests/spell-resolution-ui.cjs](../tests/spell-resolution-ui.cjs), [tests/extra-combat.test.mjs](../tests/extra-combat.test.mjs), [tests/aurelia-ui.cjs](../tests/aurelia-ui.cjs), [tests/aurelia-combat.test.mjs](../tests/aurelia-combat.test.mjs), [tests/aurelia-actions-ui.cjs](../tests/aurelia-actions-ui.cjs), [tests/aurelia-utilities.test.mjs](../tests/aurelia-utilities.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Create a token that's a copy of target creature you control, except it isn't legendary.

### 1 × Spark Double

[Current Oracle text](https://scryfall.com/card/rvr/62/spark-double?utm_source=api)

- [x] **PASS (regression)** You may have this creature enter as a copy of a creature or planeswalker you control, except it enters with an additional +1/+1 counter on it if it's a creature, it enters with an additional loyalty counter on it if it's a planeswalker, and it isn't legendary. Evidence: [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).

### 1 × Windcrag Siege

[Current Oracle text](https://scryfall.com/card/frc/52/windcrag-siege?utm_source=api)

- [ ] **UNVERIFIED** As this enchantment enters, choose Mardu or Jeskai.
- [ ] **UNVERIFIED** • Mardu — If a creature attacking causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.
- [ ] **UNVERIFIED** • Jeskai — At the beginning of your upkeep, create a 1/1 red Goblin creature token. It gains lifelink and haste until end of turn.

### 1 × Archon of Cruelty

[Current Oracle text](https://scryfall.com/card/frc/47/archon-of-cruelty?utm_source=api)

- [x] **PASS (regression)** Flying Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** Whenever this creature enters or attacks, target opponent sacrifices a creature or planeswalker of their choice, discards a card, and loses 3 life. You draw a card and gain 3 life. — Effect handler: missing.

### 1 × Brainstorm

[Current Oracle text](https://scryfall.com/card/frc/39/brainstorm?utm_source=api)

- [x] **PASS (regression)** Draw three cards, then put two cards from your hand on top of your library in any order. Evidence: [tests/kess.test.mjs](../tests/kess.test.mjs), [tests/kess-ui.cjs](../tests/kess-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/mizzix.test.mjs](../tests/mizzix.test.mjs), [tests/kalamax.test.mjs](../tests/kalamax.test.mjs), [tests/niv-mizzet.test.mjs](../tests/niv-mizzet.test.mjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Draw three cards, then put two cards from your hand on top of your library in any order.

### 1 × Brainsurge

[Current Oracle text](https://scryfall.com/card/frc/40/brainsurge?utm_source=api)

- [x] **PASS (regression)** Draw four cards, then put two cards from your hand on top of your library in any order. Evidence: [tests/playtest-decks.test.mjs](../tests/playtest-decks.test.mjs), [tests/token-catalog.test.mjs](../tests/token-catalog.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Draw four cards, then put two cards from your hand on top of your library in any order.

### 1 × Identity Echo

[Current Oracle text](https://scryfall.com/card/fra/87/identity-echo?utm_source=api)

- [x] **PASS (regression)** {3}{R}: Exile target creature or planeswalker you control. Reveal cards from the top of your library until you reveal a creature or planeswalker card. Put that card onto the battlefield and the rest on the bottom of your library in a random order. Activate only as a sorcery. — Effect handler: recognized. Evidence: [tests/polymorph.test.mjs](../tests/polymorph.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).

### 1 × Jace, the Mind Sculptor

[Current Oracle text](https://scryfall.com/card/2xm/56/jace-the-mind-sculptor?utm_source=api)

- [ ] **FAIL (manual resolution)** +2: Look at the top card of target player's library. You may put that card on the bottom of that player's library. — Effect handler: missing.
- [ ] **UNVERIFIED** 0: Draw three cards, then put two cards from your hand on top of your library in any order. — Effect handler: recognized.
- [ ] **UNVERIFIED** −1: Return target creature to its owner's hand. — Effect handler: recognized.
- [ ] **FAIL (manual resolution)** −12: Exile all cards from target player's library, then that player shuffles their hand into their library. — Effect handler: missing.

### 1 × Nicol Bolas, Dragon-God

[Current Oracle text](https://scryfall.com/card/rvr/205/nicol-bolas-dragon-god?utm_source=api)

- [x] **PASS (regression)** Nicol Bolas has all loyalty abilities of all other planeswalkers on the battlefield. Evidence: [tests/playtest-decks.test.mjs](../tests/playtest-decks.test.mjs), [tests/token-catalog.test.mjs](../tests/token-catalog.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).
- [ ] **FAIL (manual resolution)** +1: You draw a card. Each opponent exiles a card from their hand or a permanent they control. — Effect handler: missing.
- [ ] **UNVERIFIED** −3: Destroy target creature or planeswalker. — Effect handler: recognized.
- [ ] **FAIL (manual resolution)** −8: Each opponent who doesn't control a legendary creature or planeswalker loses the game. — Effect handler: missing.

### 1 × Sun Titan

[Current Oracle text](https://scryfall.com/card/soc/178/sun-titan?utm_source=api)

- [x] **PASS (regression)** Vigilance Evidence: [tests/isshin.test.mjs](../tests/isshin.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/isshin-ui.cjs](../tests/isshin-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/aurelia-utilities.test.mjs](../tests/aurelia-utilities.test.mjs), [tests/arahbo.test.mjs](../tests/arahbo.test.mjs), [tests/extra-combat.test.mjs](../tests/extra-combat.test.mjs).
- [x] **PASS (regression)** Whenever this creature enters or attacks, you may return target permanent card with mana value 3 or less from your graveyard to the battlefield. — Effect handler: recognized. Evidence: [tests/aurelia.test.mjs](../tests/aurelia.test.mjs), [tests/battlefield-entry.test.mjs](../tests/battlefield-entry.test.mjs), [tests/hotseat-ui.cjs](../tests/hotseat-ui.cjs), [tests/spell-resolution.test.mjs](../tests/spell-resolution.test.mjs), [tests/spell-resolution-ui.cjs](../tests/spell-resolution-ui.cjs), [tests/extra-combat.test.mjs](../tests/extra-combat.test.mjs), [tests/aurelia-ui.cjs](../tests/aurelia-ui.cjs), [tests/aurelia-combat.test.mjs](../tests/aurelia-combat.test.mjs), [tests/aurelia-actions-ui.cjs](../tests/aurelia-actions-ui.cjs), [tests/aurelia-utilities.test.mjs](../tests/aurelia-utilities.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs).

### 1 × Memnarch, the Warden

[Current Oracle text](https://scryfall.com/card/frc/15/memnarch-the-warden?utm_source=api)

- [x] **PASS (regression)** Indestructible Evidence: [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs).
- [x] **PASS (regression)** When Memnarch enters, create two 1/1 colorless Myr artifact creature tokens. — Effect handler: recognized. Evidence: [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs).
- [x] **PASS (regression)** Whenever Memnarch attacks, draw a card for each artifact you control. — Effect handler: recognized. Evidence: [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs).

### 1 × Nissa, Leyline Tamer

[Current Oracle text](https://scryfall.com/card/frc/2/nissa-leyline-tamer?utm_source=api)

- [ ] **UNVERIFIED** Deathtouch, vigilance
- [ ] **UNVERIFIED** Landfall — Whenever a land you control enters, draw a card. Then if this is the first time this ability has resolved this turn, reveal cards from the top of your library until you reveal a creature card. Put that card onto the battlefield and the rest on the bottom of your library in a random order. — Effect handler: missing.

### 1 × Occult Epiphany

[Current Oracle text](https://scryfall.com/card/frc/43/occult-epiphany?utm_source=api)

- [ ] **FAIL (manual resolution)** Draw X cards, then discard X cards. Create a 1/1 white Spirit creature token with flying for each card type among cards discarded this way.
- Resolution diagnostic: **manual fallback** — Draw X cards, then discard X cards. Create a 1/1 white Spirit creature token with flying for each card type among cards discarded this way.

### 1 × Staff of the Storyteller

[Current Oracle text](https://scryfall.com/card/frc/34/staff-of-the-storyteller?utm_source=api)

- [x] **PASS (regression)** When this artifact enters, create a 1/1 white Spirit creature token with flying. — Effect handler: recognized. Evidence: [tests/playtest-decks.test.mjs](../tests/playtest-decks.test.mjs), [tests/token-catalog.test.mjs](../tests/token-catalog.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).
- [x] **PASS (regression)** Whenever you create one or more creature tokens, put a story counter on this artifact. — Effect handler: recognized. Evidence: [tests/playtest-decks.test.mjs](../tests/playtest-decks.test.mjs), [tests/token-catalog.test.mjs](../tests/token-catalog.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).
- [ ] **UNVERIFIED** {W}, {T}, Remove a story counter from this artifact: Draw a card. — Effect handler: recognized.

### 1 × Nicol Bolas, Planeswalker

[Current Oracle text](https://scryfall.com/card/e01/85/nicol-bolas-planeswalker?utm_source=api)

- [ ] **UNVERIFIED** +3: Destroy target noncreature permanent. — Effect handler: recognized.
- [ ] **FAIL (manual resolution)** −2: Gain control of target creature. — Effect handler: missing.
- [ ] **FAIL (manual resolution)** −9: Nicol Bolas deals 7 damage to target player or planeswalker. That player or that planeswalker's controller discards seven cards, then sacrifices seven permanents of their choice. — Effect handler: missing.

### 1 × Teferi, Master of Time

[Current Oracle text](https://scryfall.com/card/m21/75/teferi-master-of-time?utm_source=api)

- [x] **PASS (regression)** You may activate loyalty abilities of Teferi on any player's turn any time you could cast an instant. Evidence: [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).
- [ ] **UNVERIFIED** +1: Draw a card, then discard a card. — Effect handler: recognized.
- [x] **PASS (regression)** −3: Target creature you don't control phases out. (Treat it and anything attached to it as though they don't exist until its controller's next turn.) — Effect handler: recognized. Evidence: [tests/turn-effects.test.mjs](../tests/turn-effects.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).
- [x] **PASS (regression)** −10: Take two extra turns after this one. — Effect handler: recognized. Evidence: [tests/turn-effects.test.mjs](../tests/turn-effects.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).

### 1 × Whirlwind of Thought

[Current Oracle text](https://scryfall.com/card/frc/51/whirlwind-of-thought?utm_source=api)

- [ ] **UNVERIFIED** Whenever you cast a noncreature spell, draw a card. — Effect handler: recognized.

### 1 × Deification

[Current Oracle text](https://scryfall.com/card/mat/2/deification?utm_source=api)

- [ ] **UNVERIFIED** As this enchantment enters, choose a planeswalker type.
- [ ] **UNVERIFIED** Planeswalkers you control of the chosen type have hexproof.
- [ ] **UNVERIFIED** As long as you control a creature, if damage dealt to a planeswalker you control of the chosen type would result in all loyalty counters on it being removed, instead all but one of those counters are removed.

### 1 × Flawless Maneuver

[Current Oracle text](https://scryfall.com/card/frc/25/flawless-maneuver?utm_source=api)

- [ ] **FAIL (manual resolution)** If you control a commander, you may cast this spell without paying its mana cost.
- [ ] **FAIL (manual resolution)** Creatures you control gain indestructible until end of turn.
- Resolution diagnostic: **manual fallback** — If you control a commander, you may cast this spell without paying its mana cost. / Creatures you control gain indestructible until end of turn.

### 1 × Grand Crescendo

[Current Oracle text](https://scryfall.com/card/frc/26/grand-crescendo?utm_source=api)

- [ ] **UNVERIFIED** Create X 1/1 green and white Citizen creature tokens. Creatures you control gain indestructible until end of turn.
- Resolution diagnostic: recognized; still requires behavior/target tests — Create X 1/1 green and white Citizen creature tokens. Creatures you control gain indestructible until end of turn.

### 1 × Serra's Emissary

[Current Oracle text](https://scryfall.com/card/frc/32/serras-emissary?utm_source=api)

- [x] **PASS (regression)** Flying Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** As this creature enters, choose a card type.
- [ ] **UNVERIFIED** You and creatures you control have protection from the chosen card type.

### 1 × Avacyn, Angel of Horror

[Current Oracle text](https://scryfall.com/card/frc/7/avacyn-angel-of-horror?utm_source=api)

- [x] **PASS (regression)** Flying, deathtouch Evidence: [tests/fynn.test.mjs](../tests/fynn.test.mjs), [tests/fynn-ui.cjs](../tests/fynn-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/arahbo.test.mjs](../tests/arahbo.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs).
- [ ] **UNVERIFIED** Whenever Avacyn or another nontoken creature you control dies, return that card to the battlefield under your control at the beginning of the next end step. — Effect handler: missing.

### 1 × Despark

[Current Oracle text](https://scryfall.com/card/frc/50/despark?utm_source=api)

- [ ] **FAIL (manual resolution)** Exile target permanent with mana value 4 or greater.
- Resolution diagnostic: **manual fallback** — Exile target permanent with mana value 4 or greater.

### 1 × Fatehold Charm

[Current Oracle text](https://scryfall.com/card/fra/132/fatehold-charm?utm_source=api)

- [x] **PASS (regression)** Choose one — Evidence: [tests/niv-mizzet.test.mjs](../tests/niv-mizzet.test.mjs), [tests/niv-mizzet-ui.cjs](../tests/niv-mizzet-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/kalamax.test.mjs](../tests/kalamax.test.mjs), [tests/mizzix.test.mjs](../tests/mizzix.test.mjs), [tests/talrand.test.mjs](../tests/talrand.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/arahbo-utilities.test.mjs](../tests/arahbo-utilities.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs).
- [ ] **FAIL (manual resolution)** • Draw a card. Empower Jace 2.
- [ ] **FAIL (manual resolution)** • Return target spell or creature to its owner's hand.
- [ ] **UNVERIFIED** • Creatures you control get +1/+2 until end of turn.
- Resolution diagnostic: **manual fallback** — Draw a card. Empower Jace 2.
- Resolution diagnostic: **manual fallback** — Return target spell or creature to its owner's hand.
- Resolution diagnostic: recognized; still requires behavior/target tests — Creatures you control get +1/+2 until end of turn.

### 1 × Martial Coup

[Current Oracle text](https://scryfall.com/card/frc/28/martial-coup?utm_source=api)

- [ ] **FAIL (manual resolution)** Create X 1/1 white Soldier creature tokens. If X is 5 or more, destroy all other creatures.
- Resolution diagnostic: **manual fallback** — Create X 1/1 white Soldier creature tokens. If X is 5 or more, destroy all other creatures.

### 1 × Ob Nixilis, the Ascended

[Current Oracle text](https://scryfall.com/card/frc/5/ob-nixilis-the-ascended?utm_source=api)

- [x] **PASS (regression)** Flying Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** When Ob Nixilis enters, destroy all tapped creatures your opponents control. You gain 1 life for each creature destroyed this way. — Effect handler: missing.
- [ ] **UNVERIFIED** At the beginning of each end step, if you gained life this turn, create a 4/4 white Angel creature token with flying. — Effect handler: missing.

### 1 × Path to Exile

[Current Oracle text](https://scryfall.com/card/frc/30/path-to-exile?utm_source=api)

- [x] **PASS (regression)** Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle. Evidence: [tests/isshin.test.mjs](../tests/isshin.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/isshin-ui.cjs](../tests/isshin-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/aurelia-utilities.test.mjs](../tests/aurelia-utilities.test.mjs), [tests/arahbo.test.mjs](../tests/arahbo.test.mjs), [tests/extra-combat.test.mjs](../tests/extra-combat.test.mjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.

### 1 × Proteus Staff

[Current Oracle text](https://scryfall.com/card/frc/59/proteus-staff?utm_source=api)

- [x] **PASS (regression)** {2}{U}, {T}: Put target creature on the bottom of its owner's library. That creature's controller reveals cards from the top of their library until they reveal a creature card. The player puts that card onto the battlefield and the rest on the bottom of their library in any order. Activate only as a sorcery. — Effect handler: recognized. Evidence: [tests/polymorph.test.mjs](../tests/polymorph.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).

### 1 × Rings of Brighthearth

[Current Oracle text](https://scryfall.com/card/cmr/335/rings-of-brighthearth?utm_source=api)

- [ ] **UNVERIFIED** Whenever you activate an ability, if it isn't a mana ability, you may pay {2}. If you do, copy that ability. You may choose new targets for the copy. — Effect handler: missing.

### 1 × Stroke of Midnight

[Current Oracle text](https://scryfall.com/card/frc/35/stroke-of-midnight?utm_source=api)

- [ ] **FAIL (manual resolution)** Destroy target nonland permanent. Its controller creates a 1/1 white Human creature token.
- Resolution diagnostic: **manual fallback** — Destroy target nonland permanent. Its controller creates a 1/1 white Human creature token.

### 1 × Sunfall

[Current Oracle text](https://scryfall.com/card/frc/36/sunfall?utm_source=api)

- [ ] **FAIL (manual resolution)** Exile all creatures. Incubate X, where X is the number of creatures exiled this way. (Create an Incubator token with X +1/+1 counters on it and "{2}: Transform this token." It transforms into a 0/0 Phyrexian artifact creature.) — Effect handler: missing.
- Resolution diagnostic: **manual fallback** — Exile all creatures. Incubate X, where X is the number of creatures exiled this way. (Create an Incubator token with X +1/+1 counters on it and "{2}: Transform this token." It transforms into a 0/0 Phyrexian artifact creature.)

### 1 × Swords to Plowshares

[Current Oracle text](https://scryfall.com/card/frc/37/swords-to-plowshares?utm_source=api)

- [x] **PASS (regression)** Exile target creature. Its controller gains life equal to its power. Evidence: [tests/isshin.test.mjs](../tests/isshin.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/isshin-ui.cjs](../tests/isshin-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/aurelia-utilities.test.mjs](../tests/aurelia-utilities.test.mjs), [tests/arahbo.test.mjs](../tests/arahbo.test.mjs), [tests/extra-combat.test.mjs](../tests/extra-combat.test.mjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Exile target creature. Its controller gains life equal to its power.

### 1 × White Sun's Twilight

[Current Oracle text](https://scryfall.com/card/frc/38/white-suns-twilight?utm_source=api)

- [ ] **FAIL (manual resolution)** You gain X life. Create X 1/1 colorless Phyrexian Mite artifact creature tokens with toxic 1 and "This token can't block." If X is 5 or more, destroy all other creatures. (Players dealt combat damage by a creature with toxic 1 also get a poison counter.)
- Resolution diagnostic: **manual fallback** — You gain X life. Create X 1/1 colorless Phyrexian Mite artifact creature tokens with toxic 1 and "This token can't block." If X is 5 or more, destroy all other creatures. (Players dealt combat damage by a creature with toxic 1 also get a poison counter.)

### 1 × Victimize

[Current Oracle text](https://scryfall.com/card/tdc/198/victimize?utm_source=api)

- [x] **PASS (regression)** Choose two target creature cards in your graveyard. Sacrifice a creature. If you do, return the chosen cards to the battlefield tapped. Evidence: [tests/kess.test.mjs](../tests/kess.test.mjs), [tests/kess-ui.cjs](../tests/kess-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/mizzix.test.mjs](../tests/mizzix.test.mjs), [tests/kalamax.test.mjs](../tests/kalamax.test.mjs), [tests/niv-mizzet.test.mjs](../tests/niv-mizzet.test.mjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Choose two target creature cards in your graveyard. Sacrifice a creature. If you do, return the chosen cards to the battlefield tapped.

### 1 × Mizzix's Mastery

[Current Oracle text](https://scryfall.com/card/otc/175/mizzixs-mastery?utm_source=api)

- [x] **PASS (regression)** Exile target card that's an instant or sorcery from your graveyard. For each card exiled this way, copy it, and you may cast the copy without paying its mana cost. Exile Mizzix's Mastery. Evidence: [tests/kess.test.mjs](../tests/kess.test.mjs), [tests/kess-ui.cjs](../tests/kess-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/mizzix.test.mjs](../tests/mizzix.test.mjs), [tests/kalamax.test.mjs](../tests/kalamax.test.mjs), [tests/niv-mizzet.test.mjs](../tests/niv-mizzet.test.mjs).
- [x] **PASS (regression)** Overload {5}{R}{R}{R} (You may cast this spell for its overload cost. If you do, change "target" in its text to "each.") Evidence: [tests/kess.test.mjs](../tests/kess.test.mjs), [tests/kess-ui.cjs](../tests/kess-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/mizzix.test.mjs](../tests/mizzix.test.mjs), [tests/kalamax.test.mjs](../tests/kalamax.test.mjs), [tests/niv-mizzet.test.mjs](../tests/niv-mizzet.test.mjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Exile target card that's an instant or sorcery from your graveyard. For each card exiled this way, copy it, and you may cast the copy without paying its mana cost. Exile Mizzix's Mastery.
- Resolution diagnostic: recognized; still requires behavior/target tests — Exile each card that's an instant or sorcery from your graveyard. For each card exiled this way, copy it, and you may cast the copy without paying its mana cost. Exile Mizzix's Mastery.

### 1 × Elesh Norn, Mother of Machines

[Current Oracle text](https://scryfall.com/card/one/10/elesh-norn-mother-of-machines?utm_source=api)

- [x] **PASS (regression)** Vigilance Evidence: [tests/isshin.test.mjs](../tests/isshin.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/isshin-ui.cjs](../tests/isshin-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/aurelia-utilities.test.mjs](../tests/aurelia-utilities.test.mjs), [tests/arahbo.test.mjs](../tests/arahbo.test.mjs), [tests/extra-combat.test.mjs](../tests/extra-combat.test.mjs).
- [ ] **UNVERIFIED** If a permanent entering causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.
- [ ] **UNVERIFIED** Permanents entering don't cause abilities of permanents your opponents control to trigger.

### 1 × Ichormoon Gauntlet

[Current Oracle text](https://scryfall.com/card/one/56/ichormoon-gauntlet?utm_source=api)

- [ ] **UNVERIFIED** Planeswalkers you control have "[0]: Proliferate" and "[−12]: Take an extra turn after this one."
- [x] **PASS (regression)** Whenever you cast a noncreature spell, choose a counter on target permanent. Put an additional counter of that kind on that permanent. — Effect handler: recognized. Evidence: [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs).

### 1 × Dreadhorde Invasion

[Current Oracle text](https://scryfall.com/card/frc/48/dreadhorde-invasion?utm_source=api)

- [ ] **UNVERIFIED** At the beginning of your upkeep, you lose 1 life and amass Zombies 1. (Put a +1/+1 counter on an Army you control. It's also a Zombie. If you don't control an Army, create a 0/0 black Zombie Army creature token first.) — Effect handler: missing.
- [ ] **UNVERIFIED** Whenever a Zombie token you control with power 6 or greater attacks, it gains lifelink until end of turn. — Effect handler: recognized.

### 1 × Elspeth, Sun's Champion

[Current Oracle text](https://scryfall.com/card/frc/24/elspeth-suns-champion?utm_source=api)

- [x] **PASS (regression)** +1: Create three 1/1 white Soldier creature tokens. — Effect handler: recognized. Evidence: [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).
- [x] **PASS (regression)** −3: Destroy all creatures with power 4 or greater. — Effect handler: recognized. Evidence: [tests/playtest-spells.test.mjs](../tests/playtest-spells.test.mjs).
- [x] **PASS (regression)** −7: You get an emblem with "Creatures you control get +2/+2 and have flying." — Effect handler: recognized. Evidence: [tests/turn-effects.test.mjs](../tests/turn-effects.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).

### 1 × Lingering Souls

[Current Oracle text](https://scryfall.com/card/frc/27/lingering-souls?utm_source=api)

- [ ] **UNVERIFIED** Create two 1/1 white Spirit creature tokens with flying.
- [ ] **UNVERIFIED** Flashback {1}{B} (You may cast this card from your graveyard for its flashback cost. Then exile it.)
- Resolution diagnostic: recognized; still requires behavior/target tests — Create two 1/1 white Spirit creature tokens with flying.

### 1 × Mass Polymorph

[Current Oracle text](https://scryfall.com/card/frc/42/mass-polymorph?utm_source=api)

- [x] **PASS (regression)** Exile all creatures you control, then reveal cards from the top of your library until you reveal that many creature cards. Put all creature cards revealed this way onto the battlefield, then shuffle the rest of the revealed cards into your library. Evidence: [tests/polymorph.test.mjs](../tests/polymorph.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).
- Resolution diagnostic: recognized; still requires behavior/target tests — Exile all creatures you control, then reveal cards from the top of your library until you reveal that many creature cards. Put all creature cards revealed this way onto the battlefield, then shuffle the rest of the revealed cards into your library.

### 1 × Overlord of the Mistmoors

[Current Oracle text](https://scryfall.com/card/frc/29/overlord-of-the-mistmoors?utm_source=api)

- [ ] **UNVERIFIED** Impending 4—{2}{W}{W} (If you cast this spell for its impending cost, it enters with four time counters and isn't a creature until the last is removed. At the beginning of your end step, remove a time counter from it.)
- [ ] **UNVERIFIED** Whenever this permanent enters or attacks, create two 2/1 white Insect creature tokens with flying. — Effect handler: recognized.

### 1 × Ovika, Enigma Goliath

[Current Oracle text](https://scryfall.com/card/fdn/663/ovika-enigma-goliath?utm_source=api)

- [x] **PASS (regression)** Flying Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** Ward—{3}, Pay 3 life.
- [ ] **UNVERIFIED** Whenever you cast a noncreature spell, create X 1/1 red Phyrexian Goblin creature tokens, where X is the mana value of that spell. They gain haste until end of turn. — Effect handler: missing.

### 1 × Secure the Wastes

[Current Oracle text](https://scryfall.com/card/frc/31/secure-the-wastes?utm_source=api)

- [ ] **UNVERIFIED** Create X 1/1 white Warrior creature tokens.
- Resolution diagnostic: recognized; still requires behavior/target tests — Create X 1/1 white Warrior creature tokens.

### 1 × Shark Typhoon

[Current Oracle text](https://scryfall.com/card/frc/44/shark-typhoon?utm_source=api)

- [x] **PASS (regression)** Whenever you cast a noncreature spell, create an X/X blue Shark creature token with flying, where X is that spell's mana value. — Effect handler: recognized. Evidence: [tests/talrand.test.mjs](../tests/talrand.test.mjs), [tests/talrand-ui.cjs](../tests/talrand-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/arahbo-utilities.test.mjs](../tests/arahbo-utilities.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs).
- [x] **PASS (regression)** Cycling {X}{1}{U} ({X}{1}{U}, Discard this card: Draw a card.) Evidence: [tests/talrand.test.mjs](../tests/talrand.test.mjs), [tests/talrand-ui.cjs](../tests/talrand-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/arahbo-utilities.test.mjs](../tests/arahbo-utilities.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs).
- [x] **PASS (regression)** When you cycle this card, create an X/X blue Shark creature token with flying. — Effect handler: recognized. Evidence: [tests/talrand.test.mjs](../tests/talrand.test.mjs), [tests/talrand-ui.cjs](../tests/talrand-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/arahbo-utilities.test.mjs](../tests/arahbo-utilities.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs).

### 1 × Skrelv's Hive

[Current Oracle text](https://scryfall.com/card/frc/33/skrelvs-hive?utm_source=api)

- [ ] **UNVERIFIED** At the beginning of your upkeep, you lose 1 life and create a 1/1 colorless Phyrexian Mite artifact creature token with toxic 1 and "This token can't block." — Effect handler: missing.
- [ ] **UNVERIFIED** Corrupted — As long as an opponent has three or more poison counters, creatures you control with toxic have lifelink.

### 1 × Hoarding Broodlord

[Current Oracle text](https://scryfall.com/card/mom/110/hoarding-broodlord?utm_source=api)

- [ ] **UNVERIFIED** Convoke
- [x] **PASS (regression)** Flying Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** When this creature enters, search your library for a card, exile it face down, then shuffle. For as long as that card remains exiled, you may play it. — Effect handler: missing.
- [ ] **UNVERIFIED** Spells you cast from exile have convoke.

### 1 × Scholar of the Lost Trove

[Current Oracle text](https://scryfall.com/card/jmp/14/scholar-of-the-lost-trove?utm_source=api)

- [x] **PASS (regression)** Flying Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** When this creature enters, you may cast target instant, sorcery, or artifact card from your graveyard without paying its mana cost. If an instant or sorcery spell cast this way would be put into your graveyard, exile it instead. — Effect handler: missing.

### 1 × Sol Ring

[Current Oracle text](https://scryfall.com/card/frc/21/sol-ring?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}{C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Arcane Signet

[Current Oracle text](https://scryfall.com/card/frc/20/arcane-signet?utm_source=api)

- [x] **PASS (regression)** {T}: Add one mana of any color in your commander's color identity. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Fellwar Stone

[Current Oracle text](https://scryfall.com/card/mbc/74/fellwar-stone?utm_source=api)

- [x] **PASS (regression)** {T}: Add one mana of any color that a land an opponent controls could produce. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Azorius Signet

[Current Oracle text](https://scryfall.com/card/frc/53/azorius-signet?utm_source=api)

- [ ] **UNVERIFIED** {1}, {T}: Add {W}{U}.

### 1 × Dimir Signet

[Current Oracle text](https://scryfall.com/card/frc/56/dimir-signet?utm_source=api)

- [ ] **UNVERIFIED** {1}, {T}: Add {U}{B}.

### 1 × Izzet Signet

[Current Oracle text](https://scryfall.com/card/frc/58/izzet-signet?utm_source=api)

- [ ] **UNVERIFIED** {1}, {T}: Add {U}{R}.

### 1 × Rakdos Signet

[Current Oracle text](https://scryfall.com/card/frc/60/rakdos-signet?utm_source=api)

- [ ] **UNVERIFIED** {1}, {T}: Add {B}{R}.

### 1 × Talisman of Creativity

[Current Oracle text](https://scryfall.com/card/frc/61/talisman-of-creativity?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** {T}: Add {U} or {R}. This artifact deals 1 damage to you.

### 1 × Talisman of Dominance

[Current Oracle text](https://scryfall.com/card/frc/62/talisman-of-dominance?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** {T}: Add {U} or {B}. This artifact deals 1 damage to you.

### 1 × Talisman of Indulgence

[Current Oracle text](https://scryfall.com/card/frc/63/talisman-of-indulgence?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [x] **PASS (regression)** {T}: Add {B} or {R}. This artifact deals 1 damage to you. Evidence: [tests/isshin.test.mjs](../tests/isshin.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/isshin-ui.cjs](../tests/isshin-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/aurelia-utilities.test.mjs](../tests/aurelia-utilities.test.mjs), [tests/arahbo.test.mjs](../tests/arahbo.test.mjs), [tests/extra-combat.test.mjs](../tests/extra-combat.test.mjs).

### 1 × Talisman of Progress

[Current Oracle text](https://scryfall.com/card/frc/64/talisman-of-progress?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** {T}: Add {W} or {U}. This artifact deals 1 damage to you.

### 1 × Chromatic Lantern

[Current Oracle text](https://scryfall.com/card/mbc/73/chromatic-lantern?utm_source=api)

- [ ] **UNVERIFIED** Lands you control have "{T}: Add one mana of any color."
- [x] **PASS (regression)** {T}: Add one mana of any color. Evidence: [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/goreclaw-ui.cjs](../tests/goreclaw-ui.cjs), [tests/combat.test.mjs](../tests/combat.test.mjs), [tests/phase-flow.test.mjs](../tests/phase-flow.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs).

### 1 × Cursed Mirror

[Current Oracle text](https://scryfall.com/card/frc/49/cursed-mirror?utm_source=api)

- [x] **PASS (regression)** {T}: Add {R}. Evidence: [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).
- [x] **PASS (regression)** As this artifact enters, you may have it become a copy of any creature on the battlefield until end of turn, except it has haste. Evidence: [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).

### 1 × Battlefield Forge

[Current Oracle text](https://scryfall.com/card/frc/65/battlefield-forge?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** {T}: Add {R} or {W}. This land deals 1 damage to you.

### 1 × Caves of Koilos

[Current Oracle text](https://scryfall.com/card/frc/66/caves-of-koilos?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** {T}: Add {W} or {B}. This land deals 1 damage to you.

### 1 × Clifftop Retreat

[Current Oracle text](https://scryfall.com/card/frc/67/clifftop-retreat?utm_source=api)

- [ ] **UNVERIFIED** This land enters tapped unless you control a Mountain or a Plains.
- [x] **PASS (regression)** {T}: Add {R} or {W}. Evidence: [tests/aurelia.test.mjs](../tests/aurelia.test.mjs), [tests/battlefield-entry.test.mjs](../tests/battlefield-entry.test.mjs), [tests/hotseat-ui.cjs](../tests/hotseat-ui.cjs), [tests/spell-resolution.test.mjs](../tests/spell-resolution.test.mjs), [tests/spell-resolution-ui.cjs](../tests/spell-resolution-ui.cjs), [tests/extra-combat.test.mjs](../tests/extra-combat.test.mjs), [tests/aurelia-ui.cjs](../tests/aurelia-ui.cjs), [tests/aurelia-combat.test.mjs](../tests/aurelia-combat.test.mjs), [tests/aurelia-actions-ui.cjs](../tests/aurelia-actions-ui.cjs), [tests/aurelia-utilities.test.mjs](../tests/aurelia-utilities.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs).

### 1 × Command Tower

[Current Oracle text](https://scryfall.com/card/frc/22/command-tower?utm_source=api)

- [x] **PASS (regression)** {T}: Add one mana of any color in your commander's color identity. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Drowned Catacomb

[Current Oracle text](https://scryfall.com/card/frc/69/drowned-catacomb?utm_source=api)

- [ ] **UNVERIFIED** This land enters tapped unless you control an Island or a Swamp.
- [x] **PASS (regression)** {T}: Add {U} or {B}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Exotic Orchard

[Current Oracle text](https://scryfall.com/card/mbc/79/exotic-orchard?utm_source=api)

- [x] **PASS (regression)** {T}: Add one mana of any color that a land an opponent controls could produce. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Fabled Passage

[Current Oracle text](https://scryfall.com/card/frc/71/fabled-passage?utm_source=api)

- [ ] **FAIL (manual resolution)** {T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle. Then if you control four or more lands, untap that land. — Effect handler: missing.

### 1 × Fetid Heath

[Current Oracle text](https://scryfall.com/card/frc/72/fetid-heath?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** {W/B}, {T}: Add {W}{W}, {W}{B}, or {B}{B}.

### 1 × Glacial Fortress

[Current Oracle text](https://scryfall.com/card/frc/73/glacial-fortress?utm_source=api)

- [ ] **UNVERIFIED** This land enters tapped unless you control a Plains or an Island.
- [ ] **UNVERIFIED** {T}: Add {W} or {U}.

### 3 × Island

[Current Oracle text](https://scryfall.com/card/mdd/294/island?utm_source=api)

- [x] **PASS (regression)** ({T}: Add {U}.) Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Isolated Chapel

[Current Oracle text](https://scryfall.com/card/frc/74/isolated-chapel?utm_source=api)

- [ ] **UNVERIFIED** This land enters tapped unless you control a Plains or a Swamp.
- [x] **PASS (regression)** {T}: Add {W} or {B}. Evidence: [tests/isshin.test.mjs](../tests/isshin.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/isshin-ui.cjs](../tests/isshin-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/aurelia-utilities.test.mjs](../tests/aurelia-utilities.test.mjs), [tests/arahbo.test.mjs](../tests/arahbo.test.mjs), [tests/extra-combat.test.mjs](../tests/extra-combat.test.mjs).

### 1 × Kher Keep

[Current Oracle text](https://scryfall.com/card/frc/75/kher-keep?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [x] **PASS (regression)** {1}{R}, {T}: Create a 0/1 red Kobold creature token named Kobolds of Kher Keep. — Effect handler: recognized. Evidence: [tests/playtest-decks.test.mjs](../tests/playtest-decks.test.mjs), [tests/token-catalog.test.mjs](../tests/token-catalog.test.mjs), [tests/playtest-decks-ui.cjs](../tests/playtest-decks-ui.cjs).

### 1 × Mystic Gate

[Current Oracle text](https://scryfall.com/card/frc/76/mystic-gate?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** {W/U}, {T}: Add {W}{W}, {W}{U}, or {U}{U}.

### 1 × Path of Ancestry

[Current Oracle text](https://scryfall.com/card/mbc/80/path-of-ancestry?utm_source=api)

- [x] **PASS (regression)** This land enters tapped. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [x] **PASS (regression)** {T}: Add one mana of any color in your commander's color identity. When that mana is spent to cast a creature spell that shares a creature type with your commander, scry 1. (Look at the top card of your library. You may put that card on the bottom.) Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Plains

[Current Oracle text](https://scryfall.com/card/mdd/292/plains?utm_source=api)

- [x] **PASS (regression)** ({T}: Add {W}.) Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Prairie Stream

[Current Oracle text](https://scryfall.com/card/frc/79/prairie-stream?utm_source=api)

- [ ] **UNVERIFIED** ({T}: Add {W} or {U}.)
- [ ] **UNVERIFIED** This land enters tapped unless you control two or more basic lands.

### 1 × Radiant Summit

[Current Oracle text](https://scryfall.com/card/frc/80/radiant-summit?utm_source=api)

- [ ] **UNVERIFIED** ({T}: Add {R} or {W}.)
- [ ] **UNVERIFIED** This land enters tapped unless you control two or more basic lands.

### 1 × Reflecting Pool

[Current Oracle text](https://scryfall.com/card/frc/23/reflecting-pool?utm_source=api)

- [ ] **UNVERIFIED** {T}: Add one mana of any type that a land you control could produce.

### 1 × Shivan Reef

[Current Oracle text](https://scryfall.com/card/frc/83/shivan-reef?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** {T}: Add {U} or {R}. This land deals 1 damage to you.

### 1 × Sokenzan, Crucible of Defiance

[Current Oracle text](https://scryfall.com/card/neo/276/sokenzan-crucible-of-defiance?utm_source=api)

- [x] **PASS (regression)** {T}: Add {R}. Evidence: [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs).
- [ ] **FAIL (manual resolution)** Channel — {3}{R}, Discard this card: Create two 1/1 colorless Spirit creature tokens. They gain haste until end of turn. This ability costs {1} less to activate for each legendary creature you control. — Effect handler: missing.

### 1 × Sulfur Falls

[Current Oracle text](https://scryfall.com/card/frc/84/sulfur-falls?utm_source=api)

- [ ] **UNVERIFIED** This land enters tapped unless you control an Island or a Mountain.
- [x] **PASS (regression)** {T}: Add {U} or {R}. Evidence: [tests/niv-mizzet.test.mjs](../tests/niv-mizzet.test.mjs), [tests/niv-mizzet-ui.cjs](../tests/niv-mizzet-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/kalamax.test.mjs](../tests/kalamax.test.mjs), [tests/mizzix.test.mjs](../tests/mizzix.test.mjs), [tests/talrand.test.mjs](../tests/talrand.test.mjs), [tests/goreclaw.test.mjs](../tests/goreclaw.test.mjs), [tests/arahbo-utilities.test.mjs](../tests/arahbo-utilities.test.mjs), [tests/isshin-utilities.test.mjs](../tests/isshin-utilities.test.mjs), [tests/vehicles.test.mjs](../tests/vehicles.test.mjs).

### 1 × Sulfurous Springs

[Current Oracle text](https://scryfall.com/card/frc/85/sulfurous-springs?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** {T}: Add {B} or {R}. This land deals 1 damage to you.

### 1 × Sunken Ruins

[Current Oracle text](https://scryfall.com/card/frc/86/sunken-ruins?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** {U/B}, {T}: Add {U}{U}, {U}{B}, or {B}{B}.

### 1 × Swamp

[Current Oracle text](https://scryfall.com/card/mdd/296/swamp?utm_source=api)

- [x] **PASS (regression)** ({T}: Add {B}.) Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Takenuma, Abandoned Mire

[Current Oracle text](https://scryfall.com/card/neo/278/takenuma-abandoned-mire?utm_source=api)

- [ ] **UNVERIFIED** {T}: Add {B}.
- [ ] **FAIL (manual resolution)** Channel — {3}{B}, Discard this card: Mill three cards, then return a creature or planeswalker card from your graveyard to your hand. This ability costs {1} less to activate for each legendary creature you control. — Effect handler: missing.

### 1 × Turbulent Shore

[Current Oracle text](https://scryfall.com/card/frc/17/turbulent-shore?utm_source=api)

- [ ] **UNVERIFIED** ({T}: Add {W} or {U}.)
- [ ] **UNVERIFIED** This land enters tapped unless your opponents control eight or more lands.

### 1 × Turbulent Wetlands

[Current Oracle text](https://scryfall.com/card/frc/18/turbulent-wetlands?utm_source=api)

- [ ] **UNVERIFIED** ({T}: Add {U} or {B}.)
- [ ] **UNVERIFIED** This land enters tapped unless your opponents control eight or more lands.

### 1 × Underground River

[Current Oracle text](https://scryfall.com/card/frc/87/underground-river?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **UNVERIFIED** {T}: Add {U} or {B}. This land deals 1 damage to you.

### 1 × Karn's Bastion

[Current Oracle text](https://scryfall.com/card/eoc/163/karns-bastion?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [x] **PASS (regression)** {4}, {T}: Proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.) — Effect handler: recognized. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).

### 1 × Academy Ruins

[Current Oracle text](https://scryfall.com/card/2xm/309/academy-ruins?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **FAIL (manual resolution)** {1}{U}, {T}: Put target artifact card from your graveyard on top of your library. — Effect handler: missing.

### 1 × Hall of Heliod's Generosity

[Current Oracle text](https://scryfall.com/card/dsc/283/hall-of-heliods-generosity?utm_source=api)

- [x] **PASS (regression)** {T}: Add {C}. Evidence: [tests/counter-effects.test.mjs](../tests/counter-effects.test.mjs), [tests/counter-effects-ui.cjs](../tests/counter-effects-ui.cjs), [tests/network.test.mjs](../tests/network.test.mjs), [tests/counter-costs.test.mjs](../tests/counter-costs.test.mjs), [tests/entry-casting.test.mjs](../tests/entry-casting.test.mjs), [tests/atraxa-library.test.mjs](../tests/atraxa-library.test.mjs), [tests/atraxa-library-ui.cjs](../tests/atraxa-library-ui.cjs), [tests/atraxa-delayed.test.mjs](../tests/atraxa-delayed.test.mjs), [tests/atraxa-control.test.mjs](../tests/atraxa-control.test.mjs), [tests/atraxa-duration.test.mjs](../tests/atraxa-duration.test.mjs), [tests/atraxa-duration-ui.cjs](../tests/atraxa-duration-ui.cjs), [tests/commander-evidence.test.mjs](../tests/commander-evidence.test.mjs), [tests/atraxa-activations.test.mjs](../tests/atraxa-activations.test.mjs), [tests/atraxa-activations-ui.cjs](../tests/atraxa-activations-ui.cjs), [tests/entry-replacements.test.mjs](../tests/entry-replacements.test.mjs), [tests/entry-replacements-ui.cjs](../tests/entry-replacements-ui.cjs), [tests/entry-batches.test.mjs](../tests/entry-batches.test.mjs), [tests/permanent-copy.test.mjs](../tests/permanent-copy.test.mjs), [tests/entry-routes.test.mjs](../tests/entry-routes.test.mjs), [tests/entry-routes-ui.cjs](../tests/entry-routes-ui.cjs), [tests/myriad-entry.test.mjs](../tests/myriad-entry.test.mjs), [tests/vehicles-ui.cjs](../tests/vehicles-ui.cjs), [tests/manual-entry.test.mjs](../tests/manual-entry.test.mjs), [tests/pre-entry.test.mjs](../tests/pre-entry.test.mjs), [tests/pre-entry-ui.cjs](../tests/pre-entry-ui.cjs), [tests/entry-copy.test.mjs](../tests/entry-copy.test.mjs), [tests/entry-copy-ui.cjs](../tests/entry-copy-ui.cjs), [tests/artwork-cache.test.mjs](../tests/artwork-cache.test.mjs), [tests/damage-counters.test.mjs](../tests/damage-counters.test.mjs), [tests/damage-counters-ui.cjs](../tests/damage-counters-ui.cjs).
- [ ] **FAIL (manual resolution)** {1}{W}, {T}: Put target enchantment card from your graveyard on top of your library. — Effect handler: missing.

### 1 × Eiganjo, Seat of the Empire

[Current Oracle text](https://scryfall.com/card/neo/268/eiganjo-seat-of-the-empire?utm_source=api)

- [ ] **UNVERIFIED** {T}: Add {W}.
- [ ] **FAIL (manual resolution)** Channel — {2}{W}, Discard this card: It deals 4 damage to target attacking or blocking creature. This ability costs {1} less to activate for each legendary creature you control. — Effect handler: missing.

