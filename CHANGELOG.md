# Changelog

## v1.0.0 — 2026-09-29

### Stable release
- Promoted Music Cue Pad to the initial stable release after the v0.9.x release-candidate cycle.
- Finalized the app version, bilingual help, release metadata, README files, screenshots, and standalone artifacts.
- Kept Single HTML Player Export as a stable feature, including embedded audio, cue ranges, volume/fades/loop settings, shortcuts, and Master volume.
- Kept `.bkcue` backup/import as the editable-board transfer format with validation before replacement.
- Finalized the supplied Music Cue Pad SVG as the canonical favicon and header icon across the app, self-extract build, and exported playback HTML.
- Finalized the two-handle playback-range control synchronized with precise Start/End time fields.
- Reconfirmed the local-only runtime contract with `connect-src 'none'` and no third-party runtime dependency.

## v0.9.2

- Adopted the supplied Music Cue Pad SVG as the canonical `assets/favicon.svg`, header brand icon, standalone favicon, self-extract favicon, and exported playback-player icon/favicon.
- Added a two-handle playback-range bar to **Check position**, allowing Start and End to be adjusted directly while previewing audio.
- Playback-range handles, precise Start/End text fields, selection duration, and preview position now stay synchronized.
- Prevented Start/End handles from crossing; dragging End to the track edge preserves the “to end” semantic.

## v0.9.1

- Simplified reordering to drag-and-drop only and added visible sequence numbers to playback cards.
- Reworked drag hit-testing to avoid distant targets across grid gaps, with smoother card reflow and touch dragging from the handle.
- Renamed user-facing Live Mode to clearer Playback view / 再生専用表示 wording.
- Reduced mobile clutter by hiding desktop keyboard hints on small screens.

## [0.9.0] - 2026-09-29

### Added
- Playback-only Single HTML Player Export with referenced audio embedded directly into the generated file.
- Editable playback-HTML filename with a separate `.html` suffix, local size estimate, progress, 100 MiB confirmation threshold, and 250 MiB hard limit with `.bkcue` fallback guidance.
- Standalone exported-player support for cue order, Start/End, per-cue volume, Fade In/Out, Loop, trigger keys, Master volume, seek, Pause, Fade Stop, and Stop.
- Custom pointer-based desktop reorder with a visible insertion placeholder, floating held-card preview, and live reflow animation of neighboring cue cards.

### Changed
- Realigned the header CSS/interaction details to the current `htmlapps-template`; header meta now describes this app as `キュー再生・本番モード` / `Cue playback · Live mode`, while the Fully local processing badge remains unchanged.
- Redesigned the cue editor with grouped setting cards, larger refined inputs/selects, stronger focus treatment, and a sticky action footer.
- Renamed the backup area to Export & backup / 持ち出し・バックアップ to distinguish editable `.bkcue` transfer from playback-only HTML handoff.
- v1.0.0 is now reserved for RC fixes and final release regression instead of landing Player Export for the first time.

### Fixed
- Reorder persistence now writes the complete cue order after pointer drag.
- Playback HTML generation avoids literal nested `</script>` sequences in the app source, preserving strict CSP parsing of the main single HTML.

## [0.8.0] - 2026-09-29

### Added
- Board naming persisted alongside existing local settings.
- `.bkcue` backup export as a standard store-only ZIP containing `manifest.json` and referenced audio assets.
- Local CRC32 calculation with visible progress while preparing large backups.
- `.bkcue` import validation for ZIP structure, schema version, audio references, entry CRC values, and cue ranges.
- Destructive replacement confirmation only after the imported backup has passed validation.

### Changed
- Backup imports write the complete replacement snapshot to IndexedDB in one transaction before switching the in-memory board, so validation or storage failure leaves the current board unchanged.
- Internal backup audio paths use asset IDs, preventing collisions when source filenames are identical.
- README files, specification, roadmap, security notes, and offline verification instructions now describe v0.8.0 backup behavior.

## [0.7.0] - 2026-09-27

### Added
- Optional per-cue trigger keys from `0–9` / `A–Z`, persisted with cue metadata.
- Duplicate-key validation that identifies the conflicting cue; `R` and `F` are reserved for global controls.
- Global keyboard controls: `Space` Play/Pause, `R` Restart, `F` Fade Stop, and `Escape` Stop.
- Arrow-key plus Home/End navigation between cue playback buttons.
- `aria-keyshortcuts`, cue `aria-pressed`, and explicit live playback status semantics.

### Changed
- Cue duplication now intentionally clears the shortcut on the new cue to avoid immediate conflicts.
- Cue-grid re-rendering preserves focus on the equivalent playback or management control when possible.
- Keyboard shortcuts are suppressed while typing, while a dialog is open, during IME composition, for modified key combinations, and for key-repeat events.
- Japanese/English keyboard guidance, README files, specification, roadmap, and offline verification checklist now describe v0.7.0 behavior.

## [0.6.0] - 2026-09-27

### Added
- Dedicated Live Mode that hides import, storage, build information, and cue management controls while enlarging playback targets.
- Cue-relative remaining-time display in the fixed player and active Live Mode cue card.
- Explicit final-10-second “Ending soon” state for non-looping cues.
- User-initiated Fullscreen control in Live Mode where supported.
- User-initiated Screen Wake Lock control with visibility reacquisition and release on Live Mode exit where supported.
- Hold-to-exit interaction to reduce accidental returns to edit mode.

### Changed
- Refined smartphone portrait and short-landscape layouts so fixed playback UI does not create horizontal scrolling or obscure the actionable cue area.
- Live Mode intentionally starts disabled after reload; persisted audio/cue data still restores normally.
- Help, README files, specification, and verification checklist now describe Live Mode behavior and browser capability fallbacks.

## [0.5.0] - 2026-09-27

### Added
- IndexedDB persistence for audio Blob assets, cue metadata, board/schema metadata, and Master volume.
- Startup restore before new imports are enabled.
- On-device storage panel with site usage/quota estimate where available.
- User-initiated persistent-storage request using the Storage API when supported.
- Retry Save flow for quota or other persistence write failures.
- Destructive confirmed Reset that clears saved audio, cues, and app settings.

### Changed
- Cue edits, duplication, deletion/Undo, ordering, and Master volume now save automatically.
- Orphaned audio assets are cleaned after the Undo window instead of being deleted immediately.
- Help and privacy/storage copy now explain local persistence and site-data deletion risk.

## v0.4.0 — Audio Control

- Added per-cue volume controls and session-wide Master volume.
- Added configurable fade-in and automatic fade-out presets per cue.
- Added a separate manual Fade Stop transport action with safe cancellation when playback state changes.
- Added Web Audio GainNode output control with a native volume fallback.
- Cue duplication now preserves volume and fade settings while still sharing source audio bytes.
- Updated cue cards, bilingual help, README files, and release screenshots for the new audio controls.

## 0.3.0 - Cue Points - 2026-09-27

- Added per-cue Start, optional End, and Loop settings while keeping audio assets shared.
- Added an in-editor source preview with seek, current-position capture, and millisecond time entry.
- Added cue-range validation so invalid or inverted ranges cannot be saved.
- Added main-player seeking constrained to the selected cue range.
- Updated elapsed/total time and cue-card progress to use cue-relative timing.
- Stop and replay now return to the cue Start instead of source time zero.
- Added range looping for both custom End points and the natural end of the source file.
- Updated Japanese/English help and release docs while keeping v0.3.0 session-only.

## 0.2.0 - Cue Management - 2026-09-27

- Added a separate management area under every cue so editing actions cannot accidentally start playback.
- Added cue rename with a keyboard-friendly dialog and long-name-safe layout.
- Added cue duplication while reusing the same `AudioAsset` instead of copying audio bytes.
- Added immediate cue deletion with Undo; deleting the active cue stops playback safely and Undo restores it stopped.
- Added desktop Drag & Drop reordering plus explicit Move up / Move down controls for touch and keyboard use.
- Reindex cue order after every duplicate, delete/Undo, and reorder operation.
- Updated Japanese/English help and documentation for the v0.2.0 session-only behavior.
- Kept the v1.0.0 Single HTML Player Export commitment unchanged.

## 0.1.0 - Basic Playback - 2026-09-27

- Started Music Cue Pad from the current Browser Kitty single-HTML app template.
- Added multi-file audio selection and Drag & Drop.
- Added an AudioAsset/Cue split so later versions can create multiple cues from one source file without duplicating audio bytes.
- Added responsive cue buttons with loading, ready, playing, paused, stopped, ended, and failed states.
- Added one-at-a-time playback switching, Pause / Resume, Stop, progress, elapsed time, and duration.
- Added partial import failure handling and a 2 GiB per-file application limit.
- Added Japanese / English UI, real in-app help, and mobile-safe fixed player layout.
- Kept runtime network access blocked with `connect-src 'none'` and added no third-party runtime dependency.
- Defined the staged roadmap to v1.0.0, including Single HTML Player Export as a required v1.0 feature.

