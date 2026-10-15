# Testing releases

The Windows release includes a per-user installer and a ZIP containing the runnable app. Both use the same saved-data location as source builds. This is a prerelease channel while deck implementation is in progress.

## Build locally

Use Windows with Node.js 24. Run `npm ci`, `npm test`, the relevant Electron checks, then `npm run dist:win`. Output is in `release/` (excluded from Git). Move old release artifacts elsewhere before building another version. `SHA256SUMS.txt` identifies the two downloads.

Run the extracted `Commander Lab.exe` normally. For a second independent test seat, use `& '.\Commander Lab.exe' --profile=player2` in PowerShell. Both clients should run the same version. Close source builds if you want the installed app to use the default profile.

## Publish a prerelease

1. Update release notes and the deck audit without claiming unsupported interactions work.
2. Set the next version with `npm version 0.1.0-test.2 --no-git-tag-version` (choose an unused version).
3. Commit and push the tested changes, including package.json and package-lock.json.
4. Tag that commit with the matching version (`git tag v0.1.0-test.2`) and push the tag (`git push origin v0.1.0-test.2`).

The **Windows testing release** GitHub Actions workflow validates the version, runs unit and focused UI tests, builds both downloads, and publishes a GitHub prerelease with checksums. If any check fails, it does not publish. Never overwrite an existing tag or silently replace a tester's build; increment the version instead.

You can also run the workflow manually from GitHub Actions to download its build artifacts without publishing a release. Builds are unsigned until a signing identity is configured. No automatic updates are installed; testers choose when to download a new version.
