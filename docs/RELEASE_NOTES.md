Fixes missed real Bandcamp purchase alerts in v1.0.0.

Bandcamp sends more than one receipt layout. v1.0.1 accepts artist-first digital track/album receipts, dollar-prefixed paid totals, transaction footers, and Gmail-verified `email.bandcamp.com` DKIM signatures. Existing album receipts remain supported.

Download **bandcamp-obs-alerts-mac-v1.0.1.zip**, unzip it, and launch **Start Bandcamp Alerts.command**.

**Updating:** open the existing control page and click **Quit alert helper** first. Then launch from the new extracted folder. Your saved Gmail connection, preferences, and OBS URL are preserved. The launcher reuses a running helper, so quitting the old version is required.

Verified against a supplied real track-sale email and 15 automated tests, including read-only IMAP arrival, deduplication, and delivery to the OBS event stream. Private receipt details are not included in this release. A new live purchase on the updated Mac remains to be verified.

The amount shown is the total charged, including tax when present. Gmail app passwords are required; macOS 11+, Intel and Apple Silicon supported. The package is unsigned and not notarized.

Source and SHA-256 checksums are attached. See README for setup and receipt limitations.
