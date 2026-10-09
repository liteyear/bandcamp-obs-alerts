# Publishing a public release

Suggested repository name: **bandcamp-obs-alerts**.

1. Create the repository under your GitHub account, with a public visibility setting when you are ready to release.
2. Extract the **source ZIP** and put the contents of its `bandcamp-obs-alerts` folder in the repository root. Do not upload the end-user ZIP's `node_modules` folder into the repository.
3. Commit the source, docs, screenshot, tests, lockfile, MIT License, and CI workflow. No placeholder GitHub username needs to be replaced for the app to work.
4. Run `npm ci --ignore-scripts`, `npm test`, `python3 scripts/build_release.py`, and `python3 scripts/verify_release.py`. CI performs these checks too.
5. On GitHub, create a release with tag **v1.0.0**, title **Bandcamp OBS Alerts v1.0.0**, and the text from `docs/RELEASE_NOTES.md`.
6. Attach `bandcamp-obs-alerts-mac-v1.0.0.zip` and `SHA256SUMS.txt` from `dist`. The separately supplied source ZIP is optional because GitHub also provides source downloads.
7. Verify that the published README preview renders and that the release asset downloads and starts on a Mac. Enable private vulnerability reporting if available in the repository settings.

Suggested repository description:

> Free local Bandcamp purchase alerts for OBS on macOS. Configurable artist matching, Gmail receipt detection, transparent overlays, and a simple launcher.

Suggested topics: `obs`, `bandcamp`, `streaming`, `macos`, `stream-alerts`, `open-source`.

This package is prepared for publication. These instructions do not imply that a GitHub repository or release has already been created.
