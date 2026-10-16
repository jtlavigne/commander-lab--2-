# Testing releases

The Windows release includes a per-user installer and a ZIP containing the runnable app. Both use the same saved-data location as source builds. This is a prerelease channel while deck implementation is in progress.

## Build locally

Use Windows with Node.js 24. Run `npm ci`, `npm test`, the relevant Electron checks (including `npm run test:ui:updates`), then `npm run dist:win`. Output is in `release/` (excluded from Git). Move old release artifacts elsewhere before building another version. `SHA256SUMS.txt` covers the downloads and update metadata. The build checks that the update metadata matches the version and installer checksum.

Run the extracted `Commander Lab.exe` normally. For a second independent test seat, use `& '.\Commander Lab.exe' --profile=player2` in PowerShell. Both clients should run the same version. Close source builds if you want the installed app to use the default profile.

## Publish a prerelease

1. Update release notes and the deck audit without claiming unsupported interactions work.
2. Set the next version with `npm version 0.1.0-test.3 --no-git-tag-version` (choose an unused version).
3. Commit and push the tested changes, including package.json and package-lock.json.
4. Tag that commit with the matching version (`git tag v0.1.0-test.3`) and push the tag (`git push origin v0.1.0-test.3`).

The **Windows testing release** GitHub Actions workflow validates the version, runs unit and focused UI tests, builds both downloads, and publishes a GitHub prerelease with checksums, update YAML and installer blockmap. If any check fails, it does not publish. Never overwrite an existing tag or silently replace a tester's build; increment the version instead.

You can also run the workflow manually from GitHub Actions to download its build artifacts without publishing a release. Builds are unsigned until a signing identity is configured.

## In-app updates

Installed Windows builds have **Settings > App updates > Check for updates**. Testers explicitly download a newer release and confirm **Restart & install** after finishing their game. Checking does not download, and closing the app does not silently install a pending update. Saved decks, settings and cached artwork remain in the existing user-data folder.

The feed is fixed to `jtlavigne/commander-lab--2-` on GitHub. Continue using increasing `-test.N` versions for this testing channel. Include the generated `test.yml` and `.exe.blockmap` with the installer on every release; the workflow does this. Do not upload `builder-debug.yml` or `builder-effective-config.yaml` as update metadata. Source commits alone are not updates; a published versioned release is required. Testers using an older build without the button need to install an update-enabled setup.exe once. Source checkouts and ZIP builds show guidance instead of attempting an installer update.

Before first distribution, exercise an installed upgrade from one test version to the next on a test machine: check for updates, download, cancel the restart once, then confirm it, verify the new version, and confirm saved decks/settings remain. The automated tests use a simulated updater and verify packaged metadata; they do not publish a release or replace a real installed app.
