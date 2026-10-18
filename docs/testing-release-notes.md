Commander Lab **0.1.0-test.8** for Windows x64. Download the **setup.exe** installer, or extract the **ZIP** and run **Commander Lab.exe**. Node.js is not required. Everyone in a multiplayer room should use this same version.

This release includes all accumulated changes since test.4:

- Permanent entry now stages the whole batch before anything enters. Starting values, life payments and unresolved tapped conditions finish before counter replacements and entry triggers. Controllers can choose the order of their independent decisions; choices survive reload and reconnect.
- Land plays, corrective placement, spell resolution, searches, reanimation, token copies and Myriad share that entry flow. Doubled attacking tokens retain their individual defender assignments. Manual-effect acknowledgments resume after nested entry decisions.
- Shared as-enters copying supports the tested Spark Double and Cursed Mirror clauses, including functioning copied abilities, planeswalker starting loyalty, nonlegendary exceptions, haste, source-face artwork and temporary-copy expiry. Tamiyo can create a token that itself makes a copy choice. Hidden face-down identities stay concealed.
- Infect, wither and toxic damage now use counter replacement plans. Affected players choose noncommuting replacements before simultaneous damage results commit. Lifelink, commander damage and damage triggers retain the damage amount actually dealt; saved combat choices do not replay it. Combat previews identify outcomes that depend on replacement choices.
- Planeswalker layout checks use a fixed offscreen viewport and cover standard and minimum window sizes without weakening alignment assertions.
- Interface checks explicitly cover reduced-motion preferences and capture hidden-window screenshots from painted frames.
- Pointer automation now moves and settles the real mouse before checking hit reachability; normal and minimum window sizes are covered.
- The main renderer was refactored into smaller entry-dialog and artwork-cache modules, with clearer render orchestration and documented boundaries.

Verified locally: **1,345 unit/network tests**, **43 Electron interface workflows** (including a full reduced-motion run), a minimum-window real-pointer check, Windows installer/ZIP builds, updater checksums and a smoke test of the packaged app. Detailed evidence and remaining card gaps are tracked in [the deck checklist](https://github.com/jtlavigne/commander-lab--2-/blob/main/docs/commander-deck-checklist.md) and [the exact-list audit](https://github.com/jtlavigne/commander-lab--2-/blob/main/docs/playtest-deck-audit.md).

**Deck implementation is still in progress: 10/39 manifest decks are complete, with Atraxa active. Neither exact Atraxa/Jace list is certified fully working.** Unsupported Oracle wording, full continuous-effect layering, additional replacement cases and unchecked interactions can still need manual handling.

Installed Windows builds can use **Settings > App updates > Check for updates**, then download and confirm **Restart & install**. Finish your game first: restarting disconnects multiplayer and ends rooms you host. Saved decks, settings and cached artwork stay in the existing user-data folder. ZIP/source builds update manually. Internet access is required for Scryfall imports; multiplayer hosting still uses the host computer.

This build is unsigned. The release includes **SHA256SUMS.txt**, **test.yml** and an installer blockmap for download verification and in-app updates.

For playtest reports, include the version, card names, phase, player count, response settings and steps to reproduce the problem.
