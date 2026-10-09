# Validation — public package 1.0.1

October 9, 2026. Tested locally on Linux with Node.js 24.19.0.

- The uploaded real track-sale email was rejected by v1.0.0 and is now parsed as the correct artist, title, username and $2.12 total. Raw email and private identifiers are excluded from all artifacts.
- All 15 automated tests pass, covering old and new layouts, HTML, literal artist matching, zero amounts, refunds, authentication failures and lookalike domains.
- A synthetic read-only IMAP server delivers a redacted modern track receipt; the integration test checks the emitted OBS event, duplicate suppression and exclusion of other artists.
- Original overlay preview checks remain applicable; no visual or animation code changed.
- Release archives preserve executable launcher permissions, include production dependencies only in the Mac archive, exclude credentials and receipts, and have verified checksums.

A fresh live purchase with this update running on the user's Mac has not yet been performed. v1.0.0 CI passed on GitHub; v1.0.1 CI is checked when pushed. No CPU benchmark is claimed.
