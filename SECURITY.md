# Security and privacy

Do not include Google passwords, app passwords, private OBS URLs, account addresses, full receipt bodies, buyer details, or unredacted screenshots in public issues.

For a vulnerability, use the repository's private vulnerability reporting feature if enabled. If it is unavailable, privately contact the repository owner before publishing reproduction details. For routine bugs, use a public issue with synthetic data.

The app uses Gmail IMAP with TLS and validates server certificates. Sale receipts require the expected sender and a passing Bandcamp DKIM stamp from Gmail. This check is intended for directly delivered Gmail receipts; mail forwarding and header rewriting are not assumed compatible.

App passwords grant access to the connected Gmail account. They are stored in macOS Keychain, not the repository, settings JSON, or logs. The `security` command is used locally for Keychain operations; an app password is briefly supplied to that local process during storage. Anyone with access to the connected Mac account may be able to access its saved credentials. Disconnecting removes this application's Keychain entry; revoke the app password in Google to invalidate it completely.

The HTTP service binds only to loopback, validates Host and Origin, and separates a random setup key from the random OBS viewer key. It serves only explicit static routes. User-supplied artist, title, and username values are displayed as text, not HTML. Google app passwords and raw receipt identifiers are never sent to the overlay.

Sensitive local files are under `~/Library/Application Support/Bandcamp OBS Alerts`. The launcher uses a private file umask. Email bodies are processed in memory. Only hashed receipt identifiers are persisted for deduplication. Logs omit Gmail protocol logging and credentials.

Supported public release: 1.0.x on macOS. Keep runtime and production dependencies updated, and verify their lockfile changes before making a new release.
