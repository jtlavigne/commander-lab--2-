# Multiplayer tables

Commander Lab supports shared 2-, 3- and 4-player tables over WebSockets. Each desktop renders its own board and loads artwork from its own cache. The host's Electron main process runs the authoritative rules engine; clients send actions and receive seat-specific game updates.

## Playing together

The launch menu now provides the primary setup flow:

1. On the host computer choose **Multiplayer → Host a room**, name the room, choose 2–4 players and a rules preset, then **Open lobby**.
2. Friends on the same network open **Multiplayer** and join the discovered room. They can also paste the full invite from the host's lobby. A bare room code is resolved through LAN discovery; if discovery is blocked, paste the host address as well.
3. Each player uses **Choose / import deck** for their own seat: paste a list, load a text file, or select one of the 39 supplied fixtures. First imports download Oracle data and artwork; later imports use the local cache.
4. Each player selects **Ready**. Only the host can change options or acknowledge deck warnings. Reimporting a deck clears that seat's readiness and acknowledgment; changing host options clears all readiness and acknowledgments.
5. The host selects **Start game** after all players are connected and ready. Starting resets the game while retaining imported decks and applies the preset's life total. Room discovery stops advertising the room once play starts.

LAN discovery uses UDP multicast/broadcast on **32110**; gameplay uses the selected TCP port (default **32109**). Allow the app on Windows' private network when prompted. Networks with client isolation can prevent both discovery and direct connections. No public Internet lobby service or deployment is required. Full invites include the host address and a room code, never a seat credential. The existing in-table **Multiplayer** dialog remains available for reconnecting, resuming a hosted checkpoint, and directly sharing an already prepared table.

For two instances on one computer, launch `npm.cmd start` and `npm.cmd run start:player2`. Create a two-player room in the first and discover/join it in the second. Local artwork, camera, controls and dock preferences remain separate. Mana lots belong to individual players; priority follows one shared turn order, and a network player cannot pass on someone else's behalf.

Preset deck checks are advisory and use cached Scryfall data. Two-Headed Giant is explicitly a **manual team preset**: shared life, simultaneous team turns and team combat are not automated. Official references: [Commander](https://magic.wizards.com/en/formats/commander), [Brawl](https://magic.wizards.com/en/formats/brawl), [Standard Brawl rules](https://media.wizards.com/2025/downloads/MagicCompRules%2020250919.pdf), [Two-Headed Giant](https://magic.wizards.com/en/formats/two-headed-giant).

**Color identity diagnostics:** your own lobby seat lists the offending card and its identity alongside the commander's combined identity. These card names are omitted from other players' packets and lobby labels. **Recheck deck** recalculates a saved report without reimporting; it clears that seat's readiness and acknowledgment so the revised report can be reviewed. Missing commander selection or missing identity metadata is reported separately from a known color mismatch. Whole-card Scryfall identity includes both faces and colored ability costs, ignores reminder text, and treats an explicit empty identity as colorless. The earlier Niv-Mizzet and Zedruu lists contained Nihil Spellbomb; the active `commander_test_decks_color_fixes.csv` replaces it with Unlicensed Hearse. Reimport those premade decks to replace old imported copies. Recheck updates diagnostics for the cards already imported; it does not change a deck's contents. The host can still acknowledge deliberate deviations for playtesting.

### Advanced: share the current table

1. Restart the updated app with `npm.cmd start`. On the host, choose the player count and prepare the table.
2. Open **Multiplayer → Host current table**. The default listening port is **32109**. The host controls Player 1.
3. Share the displayed **Invite address** and **Room code** with the other players. On their computers, open **Multiplayer**, enter both, choose an available seat and click **Join table**. The host must be reachable at that address.
4. Each player controls their own hand and battlefield. Seat navigation still moves the camera; it does not reveal another hand or change your assigned seat. Players can import their own decks after joining when no stack or combat decision is pending.
5. Cast, activate and pass priority normally. Spells and abilities resolve through the shared response system. Attackers, blockers, damage, counters, positions, mana and turn changes are synchronized. Camera position, dock size, cached images and printing alignment stay local.

Each player controls their own response mode and automatic untap/draw setting. These preferences survive reconnects and game resets. The host can perform a confirmed deck-preserving **Reset game**, and release another seat from the Multiplayer panel. Releasing a seat revokes its credential so a replacement player can join. Shared Undo permits the last action's player or the host to undo it; the host keeps up to 30 shared actions in memory.

## Testing two instances on one computer

Open two terminals in the project directory. In the first, run:

```powershell
npm.cmd start
```

In the second, run:

```powershell
npm.cmd run start:player2
```

The second command uses a separate desktop profile, with independent saved games, settings, artwork cache and multiplayer credentials. Starting the same profile twice brings its existing window forward. Close and restart any older app window to load updated code.

1. In the first window, choose **2 players**, then **Multiplayer > Host current table**. Leave the port at **32109**.
2. Copy the displayed **Room code**. In the second window, open **Multiplayer**, enter **ws://127.0.0.1:32109** as the address, paste the room code, choose **Player 2**, and click **Join table**.
3. Import a deck for each seat from its own window. The host controls Player 1 and the second window controls Player 2. Each window should show its own hand and concealed opponent cards.
4. Try playing a land, tapping for mana, casting a spell, responding from the other window, and declaring attackers/blockers. Accepted changes should appear in both windows; camera movement and dock resizing stay independent. For predictable response checks, each client can choose **Responses: Prompt**. **Responses: Auto** skips only that player's unavailable windows; changing it does not alter other seats.

For three or four local clients, use more terminals with `npm.cmd start -- --profile=player3` and `npm.cmd start -- --profile=player4`, prepare the matching player count on the host, and join the corresponding seats. Profile names accept 1-32 letters, digits, underscores or hyphens.

`node tests/launch-profiles-ui.cjs` checks two actual desktop processes, independent local storage and duplicate-profile locking. `npm.cmd run test:ui:network` checks gameplay through two isolated Electron sessions using real IPC and WebSockets.

## Connections and recovery

The host app must remain open. Temporary disconnections reconnect automatically with backoff. New commands freeze until the connection is synchronized. An action whose acknowledgment was lost is retried using its original ID; accepted actions are not applied twice. Unsent queued actions are cancelled on connection loss so they do not execute unexpectedly later.

Accepted game changes and action receipts are checkpointed before acknowledgment under the host's Electron user-data directory, in `multiplayer/rooms/`. After restarting the host, choose **Resume hosted table**. Other players can use **Reconnect previous table** from the same desktop profile. Credentials are stored by the main process and are not exposed to the renderer or included in the room code. Undo history does not survive a host restart.

**Leave table** restores the desktop's previous local hotseat table. It does not turn a redacted multiplayer snapshot into a local full-information game. Hosted checkpoints remain available for recovery.

The displayed addresses are local network addresses. Internet play requires a reachable host, for example through an existing private network or a configured relay/reverse proxy. The client accepts `ws://` and `wss://`; the bundled listener uses `ws://`. Public matchmaking, automatic NAT traversal, bundled TLS setup and automatic host migration are not implemented.

## Packet and consistency contract

Protocol version 1 uses JSON messages:

| Packet | Purpose |
| --- | --- |
| `join` / `welcome` | Join a room, reserve a seat or resume a credential |
| `snapshot` | Install a complete authorized view with revision, definitions and checksum |
| `action` | Request a typed action with unique ID and expected base revision |
| `update` | Apply revision-to-revision state patches and new card definitions |
| `ack` / `reject` | Report a committed action or a rejected request |
| `resync` | Recover from a revision gap or checksum mismatch |
| `presence` | Update connected/reserved seat indicators |

Local and shared play use the same browser-safe gameplay reducer in `game-actions.mjs`; the network adapter adds authorization and public summaries. See [action architecture](game-actions.md). Only the host changes canonical state. Room commands are serialized, validated against the assigned seat and reduced through the existing game engine. Clients cannot upload replacement game snapshots or arbitrary state patches. Invalid actions leave canonical state unchanged. Conflicting stale actions are rejected and refreshed; independent relative life adjustments and same-incarnation battlefield position/counter changes can safely merge. Reset and Undo create revision barriers against older commands.

Card definitions use content hashes and are sent separately from instance state. A normal position change sends coordinates rather than repeating Oracle text or image data. Artwork bytes and local filesystem/cache paths are excluded from game packets. Clients download missing public/own artwork through the existing cache. Revealing a card adds its definition when needed.

The transport bounds frame size, pending commands, message rate and buffered output. Heartbeats detect broken sockets. Checksums detect divergent views; they are consistency checks, not cryptographic authentication of an untrusted host. Atomic checkpoint replacement and persisted recent receipts protect accepted actions across restarts. Receipt history is bounded to the latest 256 accepted actions per seat.

## Private information and permissions

Opponents' hands are redacted before packets are generated. Concealed library entries use positional placeholders rather than stable card IDs, preventing clients from following a previously known card through a shuffle. Legal searches reveal the searching player's library to that player; scry reveals only the inspected cards. Another player's pending choice sends a waiting marker. Opponents' face-down battlefield cards also omit identity. The network log contains public action summaries rather than the engine's potentially private raw log.

Command authorization rejects moving another player's hand, editing their player statistics, taking their choices or advancing their turn. Rules-generated effects can still affect other players normally. Explicit manual corrections remain part of this playtester; the host necessarily possesses the full canonical game and is trusted. Each player's **Responses: Prompt** remains available to avoid availability-based hints from that player's response prompts. Clients can change their own Prompt/Auto mode without host permission; commands cannot change another seat's preference. Preferences survive reconnect and host reset.

## Scaling and verification

The server module supports independent rooms with separate queues, credentials and checkpoints. The desktop currently hosts one table, and the game engine supports 2–4 active seats. Dedicated public hosting, distributed room placement, host migration and large-scale load testing remain future work. The existing rules coverage and manual fallbacks are unchanged; multiplayer does not imply that every Oracle instruction is automated.

`npm.cmd run test:network` exercises real 2/3/4-client sockets, private views, compact updates, conflicting/concurrent commands, reconnects, lost acknowledgments, checkpoint restart/failure, seat release and room isolation. `npm.cmd run test:ui:network` runs two isolated Electron windows through IPC, private hands, local artwork, casting/responses, poison/draw, combat, reload/turn handoff, confirmed reset, failed-join recovery and deck reimport. Both are included in the full test commands.

Implementation: `multiplayer/protocol.mjs`, `actions.mjs`, `server.mjs`, `client.cjs`, `electron.cjs`, and `network-ui.mjs`. The transport uses the [ws project](https://github.com/websockets/ws).

Destruction-replacement choices use the same authoritative pending-choice contract: other seats receive a waiting marker, and the affected controller chooses an attached armor Aura. The host resumes the paused compound spell exactly once and publishes the resulting patch. Alternate-win results are authoritative shared state; further game actions stop until a host-confirmed reset. Real-socket regressions cover both paths, including response passing and all-client convergence.

Resolution-scoped foreign casting uses the exact exiled card and zone-change identity. The permitted caster becomes the spell controller while its original owner still receives it in the graveyard. Delegated blocking changes only assignment/confirmation permissions for affected defenders; it grants no hand access, tapping or other card actions. Both paths have real-client authorization and convergence regressions.

Resolution-scoped casting also supports selected hand cards and temporary card copies. The host checks the exact card/zone, free-cost restrictions, additional costs, modes and targets before accepting a cast. Saved resolution frames defer cast/entry triggers until the enclosing effect finishes; card-copy choices and queued triggers survive a reconnect. Private library looks reveal only the inspected cards to their controller, while explicit search reveals travel as public announcement data. Real three-client Mizzix scenarios verify authorization, concealment, ordering and convergence.

Player elimination removes owned objects from the public table, skips that seat for priority/turn handoffs, and rejects its gameplay commands. Private archived cards remain only on the host for deck-preserving reset; they are omitted entirely from every projected snapshot. A real three-client regression verifies two independent proliferate choices, elimination after the resolution completes, private packets, skipped seats and reset. Control-effect reversion beyond the currently modeled battlefield control still awaits the control-deck audit.

### Kalamax copy batches and public top-card permissions

Copy batches persist each retarget choice and defer copy-trigger placement until the whole resolution finishes. Reconnecting during that choice restores the same batch. Simultaneous triggers still require their controller to confirm their order. Rashmi sends only the revealed top card to every client; unrevealed library cards retain concealed handles. Its controller alone may cast that exact card from the library, and only while the saved permission is pending. Casting returns the remaining library to concealment and resumes normal response priority. Three-client socket scenarios exercise both flows in `tests/network.test.mjs`.

### Secret choices and miracle draws

The host retains secret numeric submissions in the canonical checkpoint. Player views expose submitted seats, while omitting earlier players' values, until all numbers are revealed together. The first-card miracle prompt uses a generic public label and sends the card definition only to its owner. Choosing to reveal publishes that one card; the respondable trigger and alternative-cost cast then use ordinary shared priority. Draw-replacement work and the enclosing instruction continuation survive reload and reconnect. Two three-client socket scenarios in `tests/network.test.mjs` cover secret submissions and a peer-controlled miracle cast.

Concealed opponent hands use anonymous position handles, rather than canonical card instance IDs. This prevents a previously public card from being identified when it later returns through a shuffled library. Owners retain their real hand IDs; explicit hand-inspection permissions still reveal the inspected cards. Packet and real-renderer tests cover both privacy and noninteractive opponent hands.


Kess regression coverage uses three real clients for escape payments, private surveil/graveyard choices, source-specific versus granted casting permissions, temporary graveyard land plays and exile replacements, free-cast continuations, copy retarget/order choices, and reanimation Aura control/ownership/leave triggers. Reconnects retain the current choice and resulting stack. Non-choosing clients receive a remote-choice placeholder; private library cards remain hidden. Manual movement of the returned creature follows its current controller, while its later sacrifice returns it to its actual owner's graveyard.
