# Music Cue Pad Roadmap

Current implementation: **v1.0.0 — Stable**

The authoritative behavior contract is `APP_SPEC.md`. This file is the condensed development sequence.

| Version | Theme | Main deliverable |
| --- | --- | --- |
| v0.1.0 | Basic Playback | Import multiple audio files and trigger them from large cue buttons. |
| v0.2.0 | Cue Management | Rename, delete/Undo, duplicate, desktop drag reorder + touch/keyboard move controls. |
| v0.3.0 | Cue Points | Start/end positions, preview/seek, interval playback, loop, shared source assets. |
| v0.4.0 | Audio Control | Per-cue/master volume, fade-in/out, Fade Stop. |
| v0.5.0 | Local Persistence | IndexedDB restore, quota/storage handling, persistent-storage request, safe Reset. |
| v0.6.0 | Live Mode / Mobile | Live Mode, remaining time, Fullscreen, Wake Lock, mobile refinement. |
| v0.7.0 | Keyboard / Accessibility | Global playback keys, per-cue trigger keys, cue-grid navigation, focus/ARIA/reduced-motion regression. |
| v0.8.0 | Backup / Transfer | Board naming, `.bkcue` ZIP export/import, schema versioning, CRC validation, progress, transactional replacement. |
| **v0.9.1** | **Release Candidate + Player Export / UX refresh** | **Standalone playback HTML export, template-aligned header, live-reflow drag reorder, cue-editor polish, full regression.** |
| **v0.9.2** | **Release Candidate polish** | **Final icon/favicon and two-handle playback-range trimming in the cue preview, synchronized with time fields.** |
| **v1.0.0** | **Stable** | **Initial stable release after final regression, documentation, screenshot, standalone, backup, and Player Export checks.** |

## Player Export status

The v1.0 Player Export commitment is implemented in v0.9.1 so it receives a full RC cycle. The exported player is a self-contained `.html` file with the board audio and cue metadata embedded inside it. It opens without a server or runtime network dependency, is playback-only, uses an editable output filename, displays an approximate output size, confirms above 100 MiB source audio, and blocks export above 250 MiB in favor of `.bkcue`. v1.0.0 completes the initial stable release after the full release-candidate regression cycle.
