# Security Policy

## Supported version

Security fixes target the latest version on the default branch.

## Reporting a vulnerability

Do not publish sensitive vulnerability details in a public issue. Use the repository owner's private security reporting channel when available.

Include:

- Affected commit or version.
- Reproduction steps.
- Expected and actual behavior.
- Security impact.
- A minimal test file when file parsing is involved.

## Trust model

Music Cue Pad is a static browser application with no backend. Its primary protections are:

- No ordinary runtime CDN/API connection (`connect-src 'none'`).
- No analytics, telemetry, remote font, cloud storage, or silent update check.
- Selected audio remains local to the browser unless a future user-initiated export explicitly writes it into an output file.
- Third-party runtime packages are absent in v1.0.0. Any future dependency must be exact-version pinned, locked, reviewed, and embedded by the template pipeline.
- The readable and self-extracting releases remain single HTML files.

A generated HTML file is executable code. Distribute it through a trusted channel and verify hashes for high-trust workflows.

## Local audio input

Audio files are untrusted local input. The implementation should:

- Enforce the application-level 2 GiB per-file limit.
- Reject files that do not look like supported audio before creating a cue.
- Let the browser's media stack validate/decode the actual format.
- Keep malformed/decode-failed files isolated from valid cues.
- Avoid decoding entire long tracks into `AudioBuffer` merely for normal playback.
- Release Blob URLs and media resources when they are no longer needed.
- Never upload selected audio.

## Backup and playback HTML export

v0.9.1 treats `.bkcue` files as untrusted input. ZIP bounds, paths, manifest format/schema, asset references, sizes, CRC32 values, and cue ranges are validated before replacement confirmation. Imported paths cannot escape the archive root. IndexedDB replacement is transactional, and a failed validation/write leaves the working board unchanged.

Playback HTML export is user-initiated and writes selected local audio into a new self-contained executable HTML file. Cue names/metadata are serialized safely, runtime CSP keeps `connect-src 'none'`, and the exported player contains no remote asset/API dependency. The export does not mutate the current board. Generated HTML should be distributed only through a trusted channel because HTML is executable content.

## Dependency review

Before adding or upgrading a package:

- Confirm the package identity and exact version.
- Review the scheduled dependency Issue; never treat an available update as automatic approval.
- Review its license and required notices.
- Inspect the browser bundle and package scripts.
- Confirm every runtime support asset is embedded.
- Refresh the selected lock entry with the dependency scripts; never hand-edit a lock hash to bypass a mismatch.
- Rebuild with a clean cache.
- Test with the network disabled.
## Local persistence

Music Cue Pad v1.0.0 stores user-selected audio Blob data and cue/settings metadata, including optional local trigger-key assignments and the board name, in the browser's IndexedDB for this origin. The app does not transmit that stored data. Clearing site data can remove it. A user may ask a supporting browser for persistent storage, but that request does not constitute a backup guarantee. Reset clears the app's IndexedDB data only after explicit confirmation.


## Fullscreen / Wake Lock

Live Mode can request Fullscreen and Screen Wake Lock only after explicit user actions. These browser APIs do not upload audio or cue data. Unsupported or denied requests leave the cue player usable without those capabilities, and Wake Lock is released when Live Mode exits.
