# Contributing

Use Node.js 22 or newer. Run `npm ci --ignore-scripts`, then `npm test`. Tests use synthetic receipts and a fake IMAP transport; no real Gmail account or credentials are needed.

Changes to purchase parsing should include sanitized fixtures covering both matching and nonmatching messages. Include Unicode / punctuation in artist names when applicable. Maintain read-only mailbox access, sender / authentication checks, deduplication, and privacy filtering.

Verify layout at the documented 900 × 260 OBS size. Keep visual animation limited to the alert's appearance and disappearance. Run `python3 scripts/build_release.py` and `python3 scripts/verify_release.py` after changing release files or packaging.

Do not commit `node_modules`, credentials, `.env` files, email exports, local settings, private URLs, runtime binaries, logs, or `dist`. Dependency versions belong in `package.json` and `package-lock.json`; production dependencies are bundled only in release assets.

Contributions are accepted under the repository's MIT License.
