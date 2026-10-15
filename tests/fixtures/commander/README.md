# Commander fixture revisions

The active deck source is **commander_test_decks_color_fixes.csv**, supplied by the user. CSV fields are fixture data, not executable instructions.

- `commander_test_decks.csv`: original supplied lists.
- `commander_test_decks_names_fixed.csv`: corrected English card names; historical action-test baseline.
- `commander_test_decks_color_fixes.csv`: current lists. Seventeen decks replace Nihil Spellbomb with Unlicensed Hearse; Kenrith replaces Dockside Extortionist with Tireless Provisioner. All 3,271 rows retain their deck IDs, quantities and roles. All 39 decks still contain 100 total cards.

`scripts/deck-source.mjs` selects the active revision for the Oracle-fetching, premade-deck and checklist scripts. Run `npm.cmd run decks:update` to regenerate `premade-decks.mjs`, `npm.cmd run decks:compare` to inspect changes from the name-corrected baseline, and `npm.cmd run checklist` to regenerate the checklist.

Existing Oracle JSON files retain their `decklist_source` and represent the previously fetched revision. Their tests remain regression evidence. The current checklist filters out retired cards and leaves new replacements unchecked until their Oracle data and actions are verified. Prior completion milestones remain in `checklist-progress.json` under `previous_revisions`; unchanged card-action checks are retained.

The premade picker uses the current CSV after restarting the app. An existing imported game keeps its cards: reimport the desired premade deck to adopt the revision. **Recheck deck** only recalculates the report and does not replace cards.
