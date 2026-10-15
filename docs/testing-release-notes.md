Windows x64 playtesting build. Download the **setup.exe** installer, or extract the **ZIP** and run **Commander Lab.exe**. Node.js is not required.

Everyone in a multiplayer room should use the same version (shown in the window title). Internet access is needed to import Scryfall card data and artwork. Hosting still uses the host's computer; this release does not provide a matchmaking server.

This update adds shared handling for extra turns, phasing, planeswalker emblems, An Offer You Can't Refuse, Dovin's Veto, split second, Elspeth's power-based board wipe, and the Jace/Identity Echo/Proteus Staff/Mass Polymorph/Synthetic Destiny reveal effects. Primevals' Glorious Rebirth now checks its casting restriction and returns legendary permanents. Public reveals have a confirmation screen and preserve library privacy across multiplayer and reloads.

**Neither deck is fully verified yet.** Unsupported effects may need manual handling. See `docs/playtest-deck-audit.md` for the card-by-card evidence and remaining gaps. This build includes 1,113 passing unit tests, plus focused deck, mana, planeswalker and multiplayer UI checks; that total is not a count of fully implemented card interactions.

This build is not code-signed. Windows may display an unknown-publisher warning. Download only from this repository's Releases page; SHA256SUMS.txt accompanies the downloads.

Close the app before updating. Decks, settings and cached art remain in your existing Commander Lab user-data folder. Keep your save exports before testing a new version; there is no automatic updater yet.

For a bug report, include the version, card names, phase, player count, response setting, and reproduction steps. Do not upload your entire application profile or reconnect credentials.
