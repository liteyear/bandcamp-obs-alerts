# Validation — public package 1.0.0

Prepared October 8, 2026. Tested locally on Linux with Node.js 24.19.0; macOS end-user launch needs a separate device check.

- All 11 automated tests pass. These cover plain-text and HTML receipts, exact configurable artist matching, accented and punctuated names, label greetings, another artist's receipt, nonpurchase messages, sender / DKIM checks, duplicate receipt handling, private control access, source keys, and a synthetic read-only IMAP connection.
- Chromium preview shows the configured artist and correct purchase wording at 900 × 260. The card has no content overflow. Username / amount toggles work, the alert disappears on time, and the browser reports no script errors.
- JavaScript syntax and Bash launcher syntax checks pass. The GitHub Actions YAML parses locally. GitHub Actions itself has not run yet because this package has not been published to a repository.
- The release builder uses explicit allowlists, separates bundled end-user dependencies from source, preserves launcher execution permissions, excludes local state / credentials, and emits verified SHA-256 checksums.

The artist-specific predecessor was reported working by its user on macOS. That does not substitute for a real purchase test of this configurable public package. New Gmail account layouts and receipt types need their own verification. No CPU benchmark is claimed.
