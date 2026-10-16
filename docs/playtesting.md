# Playtesting Commander Lab

Commander Lab is an experimental Electron desktop app. Ten of the 39 supplied decks have passed their scoped verification checklists; other decks and unsupported Oracle instructions still need manual handling. See the [deck checklist](commander-deck-checklist.md) for current coverage.

## Install and start

For a packaged testing build, open [GitHub Releases](https://github.com/jtlavigne/commander-lab--2-/releases) and download the Windows **setup.exe**, or extract the Windows **ZIP** and run **Commander Lab.exe**. These builds include Electron; Node.js is not required. The window title shows the version to include in bug reports. Use the same version as the other players. Testing builds are unsigned, so Windows may ask you to confirm the publisher.

For future updates in an installed Windows build, open **Settings > App updates**, choose **Check for updates**, then **Download update**. Finish your game before confirming **Restart & install**. Your saved decks, settings and cached art are kept. If your current version has no update button, install a newer setup.exe once to get it. ZIP builds and source checkouts still update manually. Everyone should update to the same release before joining a room.

To run from source instead:

1. Install Node.js 24, including npm.
2. On the GitHub repository, choose **Code > Download ZIP** and extract it, or clone the repository with Git.
3. Open a terminal in the extracted folder containing `package.json`.
4. Run:

```powershell
npm.cmd ci
npm.cmd start
```

In other shells, use `npm ci` and `npm start`. Installation downloads Electron and the locked dependencies. Card imports need Internet access to fetch Scryfall data and artwork.

## Play with friends

1. Everyone installs the same version and connects to the same local network.
2. The host chooses **Multiplayer > Host a room**, selects the player count and rules, and opens the lobby.
3. Friends open **Multiplayer** and join the room, or paste the host's full invite if discovery does not find it.
4. Each player imports a deck and clicks **Ready** in the lobby. The host reviews any deck warnings and starts the game.
5. On the starting-hand screen, choose **Ready** or **Mulligan**. Gameplay starts after everyone confirms their hand.

Keep the host app open. If Windows asks, allow the app on the private network. Gameplay defaults to TCP port 32109; discovery uses UDP port 32110. GitHub distributes the app source; it does not host game rooms or provide Internet matchmaking. See [multiplayer setup and recovery](multiplayer.md) for connection details.

For a solo two-window test, run `npm.cmd start` in one terminal and `npm.cmd run start:player2` in another. Host in the first window and join in the second. For hotseat play, choose **Local** instead.

## Report a problem

Open a GitHub issue with:

- The version in the window title (and `git rev-parse --short HEAD` if cloned), operating system, and player count.
- Card names, phase, response mode, and the steps that reproduce the problem.
- What you expected and what happened, with a screenshot if useful.

Avoid attaching your Electron profile or multiplayer checkpoint directory: those include local state and reconnect credentials. Saved data and downloaded card art stay in Electron's user-data directory; `.qa/` contains local test artifacts and is excluded from Git.

## Update or contribute

Close the app before updating. For installed builds, download and run the new installer. For a portable ZIP, extract the new version into a separate folder. For a Git clone, run `git pull --ff-only` then `npm.cmd ci`. Saved games, settings and cached art are stored outside the install/source folder. Export a save before testing a new version. Updates are manual for now.

Before submitting a code change, run `npm.cmd test`. Relevant Electron checks are listed in `package.json`; `npm.cmd run test:ui:network` exercises two clients. Test profiles and screenshots stay under `.qa/`.
