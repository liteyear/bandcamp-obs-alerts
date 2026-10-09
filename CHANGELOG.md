# Changelog

## 1.0.1 — 2026-10-09

- Fix missed purchases from Bandcamp’s artist-first digital item receipt format.
- Accept Gmail-verified DKIM signatures for the exact `email.bandcamp.com` domain.
- Handle currency symbols, tax-inclusive paid totals, and transaction completion footers.
- Add redacted track-sale regression tests and verify delivery through the IMAP-to-OBS event stream.

## 1.0.0 — 2026-10-08

- First neutral public package for macOS, Intel and Apple Silicon.
- Configurable artist name with literal Unicode-safe matching.
- Gmail sale receipt detection through IMAP IDLE with status checks and automatic reconnect.
- Transparent silent OBS alerts, queued purchases, duplicate suppression, and adjustable duration / username / amount display.
- Guided setup, Google app password links, macOS Keychain credential storage, private local controls, and stable OBS URLs.
- Separate end-user and source archives, checksums, MIT License, and automated tests.
