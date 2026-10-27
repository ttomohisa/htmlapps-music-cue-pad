# Shared UI 1.0.0

Fixed canonical JavaScript/CSS and hash lock are embedded at build time. No runtime dependency is added. Save backup (.bkcue), Restore backup, Save playback HTML and Apply settings distinguish transfer, playback output and editing. The editable board name controls the backup filename; the existing output filename controls HTML. Both outputs include the whole board and used source audio. Download started reports browser handoff.

The working area repeats the IndexedDB storage state with confirmed save time and keeps the existing retry/session-only warning and backup escape. Invalidated queued writes now always drain their accounting. Restore cancels pending volume/orphan timers, invalidates queued writes and waits for the active write before the existing atomic validated replacement. Export identity and filename are captured before awaits.

The existing confirmation and toast APIs remain authoritative. Confirmation translates while open, starts at Cancel and restores focus. Focus pauses Undo toast expiration; orphan audio stays retained while Undo is available. Delete saved board explicitly describes the audio/cues/volume and leaves language preferences intact.

Reset and restore now own an explicit board mutation lock through queue invalidation, active-write drain, the atomic storage transaction and in-memory replacement. All cue edit/import/reorder/Undo/volume/name entry points and persistence enqueue reject edits during that interval, and visible mutation controls are disabled. Late metadata import completion is generation-checked. Delivery failures for .bkcue and playback HTML remain in separate persistent translated recovery notices until that output succeeds; they never claim import/autosave failure.

Backup validation/unsupported-version and restore-storage failures have a third independent persistent translated recovery domain. The current board remains playable/exportable. Choosing a valid backup or fixing browser storage and retrying Restore backup is the explicit recovery; only a successful restore clears this notice.

Language resolves URL, shared key, legacy scalar, supported browser languages, then English. Startup never writes preference. Explicit switch writes the shared key; blocked storage shows the screen-only notice. Progress, confirmation and toast messages re-render without clearing work or stopping playback. Playback cue cards, drag handles and fullscreen/wake-lock selection styles remain domain controls; toolbar/export/management actions opt into shared variants.

Run the PowerShell syntax preflight, build, repository check and `node --test`. Native audio, IndexedDB reload/failure behavior, modal keyboard focus and mobile touch/layout acceptance remain human checks because no browser is permitted in this task.
