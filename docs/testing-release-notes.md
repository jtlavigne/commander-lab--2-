Commander Lab **0.1.0-test.3** for Windows x64. Download the **setup.exe** installer, or extract the **ZIP** and run **Commander Lab.exe**. Node.js is not required.

Everyone in a multiplayer room should use the same version (shown in the window title). Internet access is needed to import Scryfall card data and artwork. Hosting still uses the host's computer; this release does not provide a matchmaking server.

This update adds in-app updates, permanent/token copying that retains supported abilities, and playable-card mana previews using artifacts, creatures and other supported sources. It expands shared Atraxa ability handling and battlefield-entry counter replacements, including choices that pause resolution correctly through library searches, delayed returns and polymorph effects. New keyword-action audits distinguish tested behavior from remaining implementation work. Saved choices and multiplayer privacy are covered by focused regression tests.

**Neither deck is fully verified yet.** Unsupported effects may need manual handling. See `docs/playtest-deck-audit.md` for the card-by-card evidence and remaining gaps. Automated unit tests and focused deck, mana, planeswalker and multiplayer UI checks cover the verified scenarios; passing tests are not a count of fully implemented card interactions.

This build is not code-signed. Windows may display an unknown-publisher warning. Download only from this repository's Releases page; SHA256SUMS.txt accompanies the downloads.

Installed Windows builds now offer **Settings > App updates > Check for updates**. Download a newer published testing release, then use **Restart & install** when finished playing. Restarting disconnects multiplayer and ends rooms you host. Downloads never install automatically on exit. Decks, settings and cached art remain in your existing Commander Lab user-data folder. Keep your save exports before testing a new version. Older builds need this installer once to get the button; ZIP and source builds still update manually.

For a bug report, include the version, card names, phase, player count, response setting, and reproduction steps. Do not upload your entire application profile or reconnect credentials.
