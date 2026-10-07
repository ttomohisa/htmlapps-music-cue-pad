# APP_SPEC.md — Music Cue Pad

This file is the product contract for Music Cue Pad. User instructions override this file; otherwise this file defines the intended behavior and release scope.

## 1. Product identity

- **Name:** Music Cue Pad
- **Repository:** `ttomohisa/htmlapps-music-cue-pad`
- **Current stable version:** v1.0.1
- **Initial stable release:** v1.0.0
- **One-sentence purpose:** Register multiple local audio files and trigger the needed track immediately from large cue buttons.
- **Primary users:** Event operators, presenters, teachers, performers, coaches, creators, and anyone who needs to trigger prepared audio quickly.
- **Release artifacts:** `dist/index.html` and `dist/index.self-extract.html`

## 2. Product definition

Music Cue Pad is not a general music library player and is not a DAW. It is a **local cue player** for situations where the important action is “play this prepared audio now.”

The core interaction is:

```text
Add audio files
→ cue buttons are created
→ press a cue button
→ that audio starts
→ pause / resume / stop from the player bar
```

In v1.0.0 a cue can define start/end positions, volume, fades, looping, shortcut assignment, and Playback view behavior.

## 3. Browser Kitty fit

- Works entirely in the browser.
- No account or installation.
- User audio is not uploaded or transmitted by the app.
- No runtime CDN, API, analytics, telemetry, or remote font.
- Works from `file://` as well as static hosting.
- Desktop and smartphone are first-class.
- The app itself ships as a single HTML file.

## 4. Domain model

Separate audio assets from cues from the beginning.

### AudioAsset

- `id`
- `fileName`
- `mimeType`
- `size`
- `duration`
- local `File` / `Blob` reference
- object URL while the session is active
- load state (`loading`, `ready`, `error`)

### Cue

- `id`
- `assetId`
- `name`
- `order`
- v0.3 fields: `startTime`, `endTime`, `loop`
- v0.4 fields: `volume`, `fadeIn`, `fadeOut`
- v0.7 field: `shortcut`

One asset may be referenced by multiple cues in later versions without duplicating audio bytes.

## 5. Supported input

Target browser-native audio formats:

- MP3
- WAV
- M4A / AAC
- OGG / Opus
- WebM Audio
- FLAC where the browser supports it

The app does not transcode unsupported formats in v1.0.

Files may be selected through the file picker or Drag & Drop. Multiple selection is required.

### Size policy

- Maximum accepted individual input file size: **2 GiB**.
- No fixed cue-count limit in application logic.
- Test target for v1.0: at least 100 registered cues without UI failure.
- Browser/device storage and decode limits still apply and must be explained in help.

## 6. v0.1.0 functional scope — Basic Playback

v0.1.0 must implement:

- Latest htmlapps-template foundation.
- Japanese / English UI in one HTML.
- Multiple audio file selection.
- Drag & Drop.
- One Cue automatically created per accepted audio file.
- Cue name derived from the filename without its final extension.
- Metadata loading and duration display.
- Large responsive cue-button grid.
- One active cue at a time.
- Pressing a different cue stops the previous audio and starts the selected cue.
- Pressing the already-playing cue does not restart it unexpectedly.
- Player bar with current cue, progress, elapsed / total time, Pause / Resume, and Stop.
- Clear loading, ready, active, paused, ended, and failed states.
- Partial failure handling: valid files stay available when another file fails.
- Runtime object URL cleanup on page exit.
- No persistence of audio/cues yet; reload intentionally resets the v0.1.0 session.
- Language preference may be stored locally.
- In-app help must describe the actual v0.1.0 behavior and the lack of persistence.

### v0.1.0 non-goals

- Rename, delete, duplicate, or reorder cues.
- Cue start/end points.
- Per-cue volume, fade, loop.
- IndexedDB persistence.
- Live Mode.
- Keyboard cue shortcuts.
- Board backup/import.
- Player Export.

Those are staged later in the roadmap rather than hidden as unfinished UI.


## 6A. v0.2.0 functional scope — Cue Management

v0.2.0 adds cue management without changing the one-at-a-time playback model.

Required behavior:

- Rename a cue without changing its source filename.
- Duplicate a cue while reusing the same `AudioAsset`; audio bytes must not be duplicated.
- Delete a cue immediately with a visible Undo action instead of a pre-delete confirmation.
- Deleting the active cue stops playback and clears the active selection safely.
- Undo restores a deleted cue to its previous list position; if it had been active, it returns in a stopped state and does not autoplay.
- Reorder cues with Drag & Drop on desktop.
- Reordering uses the drag handle only. Do not show separate Move up / Move down buttons. The handle must work with pointer/touch input and focused unmodified ArrowUp / ArrowDown keys, and the UI must make the target order obvious with visible sequence numbers and a numbered placeholder.
- Focus the existing handle with Tab, then press ArrowUp / ArrowDown to move that cue one position without wrapping. Keep focus on that cue's handle and preserve its identity, asset, settings, current selection, and audio transport. Recompute manual Next from the new order.
- Ignore reorder keys during composition (including keyCode 229), repeat, modifier combinations, Live Mode, open dialogs, or a pending pointer drag. Cue-play arrow/Home/End focus navigation remains unchanged.
- Edge keys and pointer drops at the original position are true no-ops: no metadata write or replacement of an existing Delete Undo toast or its original six-second expiry.
- Escape cancels a pending pointer drag before release can commit it; existing immediate Stop remains available for a selected cue. Pointer cancellation leaves cue order unchanged.
- Drag hit-testing must be local to the pointer: moving through empty grid space must not select a distant card. During dragging, surrounding cards and their preview sequence numbers update to match the pending order.
- Reindex the `order` field after duplicate, delete/Undo, or reorder.
- Cue-management controls must be separate from the large playback button so edit actions cannot accidentally trigger audio.
- Long cue names must wrap safely and must not create horizontal scrolling at 320 CSS px.
- The rename dialog must support keyboard use, Escape/backdrop cancellation, focus on the name field, and Enter-to-save when valid.
- v0.2.0 remains session-only; reload still clears cues and audio.

### v0.2.0 non-goals

- Cue start/end points or loop.
- Per-cue/master volume or fades.
- IndexedDB persistence.
- Live Mode.
- Keyboard cue triggering.
- `.bkcue` backup/import.
- Single HTML Player Export.

## 6B. v0.3.0 functional scope — Cue Points

v0.3.0 turns each cue into a real playback range while keeping the v0.2.0 management model.

Required behavior:

- Each cue stores `startTime`, optional `endTime`, and `loop`.
- Newly imported cues start at `0`, play to the source end, and do not loop.
- The cue editor provides a source preview with a seek control.
- The Check position area also provides a two-handle playback-range bar. Dragging either handle updates Start/End, moves the preview position to that boundary, and stays synchronized with the precise time fields. The handles must not cross; dragging End to the source edge preserves the blank “to end” semantic.
- “Use current position” can set the preview position as Start or End.
- Start/End also accept typed time values such as `1:23.500`; End may be blank to mean source end.
- Save is blocked for invalid ranges: Start must be within the track, End must be after Start and within the track.
- The main player seeks only inside the cue range and displays elapsed / total time relative to that range.
- Stop resets to the cue Start, not source time zero.
- A cue with Loop enabled returns from its End to its Start and continues playing.
- Reaching a custom End without Loop creates the same visible Finished state as reaching the natural file end.
- Duplicating a cue copies its cue-point and loop settings while continuing to share the same `AudioAsset`.
- Editing an active cue safely clamps its current playback position into the newly saved range when necessary.
- v0.3.0 remains session-only.

### v0.3.0 non-goals

- Per-cue/master volume or fades.
- IndexedDB persistence.
- Live Mode.
- Keyboard cue triggering.
- `.bkcue` backup/import.
- Single HTML Player Export.


## 6C. v0.4.0 functional scope — Audio Control

v0.4.0 adds gain and fade behavior while preserving one-at-a-time playback and session-only state.

Required behavior:

- Each cue stores `volume` from 0.0 to 1.0, plus `fadeIn` and `fadeOut` durations in seconds.
- Newly imported cues default to 100% volume with no automatic fades.
- A session-wide Master volume multiplies the active cue volume and remains directly reachable above the cue list.
- The cue editor exposes cue volume plus useful fade presets: none, 0.5, 1, 2, 3, and 5 seconds.
- Fade-in starts at the cue Start; automatic fade-out approaches zero at the configured cue End / source end.
- Looping reapplies the fade shape on every pass through the cue range.
- Duplicating a cue copies volume/fade settings while continuing to share its `AudioAsset`.
- Fade Stop is a separate transport action from immediate Stop and fades the current output before returning the cue to its Start.
- Starting another cue, pausing, immediate Stop, deletion, error, or other state boundaries cancel stale fade work cleanly.
- Use Web Audio Gain nodes where supported; keep a browser-native volume fallback so playback does not fail solely because the Web Audio graph is unavailable.
- v0.4.0 remains session-only.

### v0.4.0 non-goals

- Crossfade between different cues.
- Automatic loudness normalization / LUFS analysis.
- IndexedDB persistence.
- Live Mode.
- Keyboard cue triggering.
- `.bkcue` backup/import.
- Single HTML Player Export.

## 6D. v0.5.0 functional scope — Local Persistence

v0.5.0 makes the working board survive reloads while keeping playback fully local.

Required behavior:

- Persist ready `AudioAsset` Blob data, cue metadata, board/schema metadata, and Master volume in IndexedDB.
- Restore saved assets and cues on startup before enabling new imports, recreating Blob URLs only for the current session.
- Restore cue order, names, Start/End, Loop, cue volume, Fade In/Out, and Master volume.
- Keep failed/unsupported imports out of the persisted board.
- Cue rename/edit, duplicate, delete/Undo, reorder, and Master volume changes update the persisted state automatically.
- Deleting the final cue that references an asset removes that now-orphaned stored Blob after the Undo window has expired.
- Show storage state, Storage API usage/quota estimate when available, and whether persistent storage has been granted.
- Provide a user-initiated “Protect saved data” action when `navigator.storage.persist()` is available.
- If IndexedDB is unavailable, keep the app usable for the current session and clearly state that the board will not survive reload.
- If a write fails, including quota exhaustion, keep the in-memory board playable, show a clear warning, and provide “Retry save” that writes a consistent snapshot.
- “Delete all” uses the canonical destructive confirmation dialog. If database clearing fails, do not wipe the in-memory board.
- v0.8.0 still has one local board, now with a persisted board name and portable `.bkcue` backup/import.

### v0.5.0 non-goals

- Multiple local boards.
- Board naming.
- `.bkcue` backup/import.
- Live Mode.
- Keyboard cue triggering.
- Single HTML Player Export.

## 6E. v0.6.0 functional scope — Live Mode / Mobile UX

v0.6.0 adds a dedicated performance state without changing the saved board model or one-at-a-time playback model.

Required behavior:

- Live Mode can be entered only when at least one ready cue exists.
- Entering Live Mode hides audio import, on-device storage management, build details, footer content, and all cue edit/duplicate/reorder/delete controls.
- Cue buttons become larger and remain the primary action. The fixed player keeps Pause / Resume / Fade Stop / immediate Stop available.
- The active cue shows cue-relative remaining time in the fixed player and on its Live Mode cue card.
- A playing non-looping cue shows an explicit `Ending soon` / `まもなく終了` state during its final 10 seconds. Looping cues do not show this warning.
- Leaving Live Mode requires an approximately one-second hold; an ordinary tap or short press must not exit Live Mode.
- Fullscreen is a user-initiated optional control and must degrade cleanly when the Fullscreen API is unavailable.
- Keep Screen On uses the Screen Wake Lock API only after explicit user action. It must degrade cleanly when unsupported, reacquire after visibility restoration when the user still requested it, and release when Live Mode ends.
- Live Mode itself is not persisted. Reload always starts in edit mode even though audio/cue data continues to restore from IndexedDB.
- Smartphone portrait layout must remain usable without horizontal scrolling at 320–390 CSS px. Live Mode may use a single cue column there to preserve large tap targets.
- Short landscape viewports may hide nonessential header/master-volume chrome and use a denser multi-column cue grid so the fixed player does not cover the actionable cue area.
- Fullscreen, Wake Lock, Live Mode, and remaining-time UI must not add runtime network access.

### v0.6.0 non-goals

- Keyboard cue triggering / shortcut assignment (v0.7.0).
- Multiple simultaneous cues or crossfade.
- `.bkcue` backup/import (implemented in v0.8.0).
- Single HTML Player Export (v1.0.0).

## 6F. v0.7.0 functional scope — Keyboard / Accessibility

v0.7.0 adds a deliberate keyboard control layer without changing one-at-a-time playback, local persistence, or Live Mode behavior.

Required behavior:

- Each cue may have one optional trigger key from `0–9` or `A–Z`.
- `R` and `F` are reserved for global playback actions and cannot be assigned to a cue.
- Duplicate cue creates the new cue without copying the source cue's shortcut, avoiding an immediate conflict.
- Shortcut assignments persist with cue metadata in IndexedDB and restore with the board.
- Assigning a key already used by another cue blocks Save and identifies the conflicting cue.
- Global controls when no text field/dialog is active: `Space` = Play/Pause selected cue, `R` = restart selected cue from Start, `F` = Fade Stop, `Escape` = immediate Stop.
- Pressing an assigned cue key triggers that cue using the same one-at-a-time playback rules as clicking its button.
- Global/cue shortcuts do not fire while typing in input/textarea/select/contenteditable controls, while a modal dialog is open, during IME composition, for modifier-key combinations, or for key-repeat events.
- Cue playback buttons support Arrow Left/Up for previous, Arrow Right/Down for next, `Home` for first, and `End` for last.
- Re-rendering cue state during playback preserves focus on the equivalent cue playback or management control when it still exists.
- Cue buttons expose `aria-pressed`, assigned trigger keys expose `aria-keyshortcuts`, playback status remains in a polite live region, and icon-only management controls retain accessible names.
- Visible focus remains clear and `prefers-reduced-motion` continues to suppress nonessential motion.
- The keyboard hint is visible in edit mode and translated in Japanese/English.

### v0.7.0 non-goals

- `.bkcue` backup/import (v0.8.0).
- Single HTML Player Export (v1.0.0).

## 6G. v0.8.0 functional scope — Backup / Transfer

- One persisted board name, editable in the backup panel.
- `.bkcue` is a standard ZIP container using store-only entries in v0.8.0.
- Archive layout is `manifest.json` plus referenced source audio under `audio/`.
- Internal audio entry names use `AudioAsset.id`, not the original filename, so duplicate source filenames cannot overwrite each other.
- Manifest `schemaVersion` is independent from `appVersion`. v0.8.0 reads schema version 1 only.
- Export calculates CRC32 for every entry locally and reports progress.
- Import validates ZIP directory/local-header bounds, manifest JSON, format identifier, schema version, asset metadata, referenced audio presence/size, entry CRC32, and cue time ranges before replacement confirmation.
- Import does not mutate the working board during validation.
- When IndexedDB is available, replacement audio/cues/settings are written in one readwrite transaction before the in-memory board is replaced. Failure keeps the current board unchanged.
- Import in a session-only browser still works for the current session, with the existing storage warning remaining visible.
- Backups contain the source audio bytes, so backup size is expected to be close to total referenced audio size plus small ZIP/manifest overhead.

### v0.8.0 non-goals

- Multiple named boards inside the app.
- Compressed ZIP entries; v0.8.0 writes and reads store-only `.bkcue` archives generated by Music Cue Pad.
- Single HTML Player Export (v1.0.0).
- MIDI or remote triggering.
- User-remappable global keys.

## 7. Playback behavior

- Use one primary `HTMLAudioElement` for playback.
- Do not decode entire long tracks into `AudioBuffer` merely to play them.
- Object URLs point to local `File` / `Blob` data.
- Audio is started only from a user gesture; do not autoplay on page load.
- A newly selected cue replaces the currently active cue.
- `play()` failures are handled as visible user-facing errors.
- Stop pauses playback, resets the playback position, and leaves the cue available for replay.
- Ended audio remains identified as the most recently selected cue, but the player state becomes ended.

### Manual Play next

- The bottom transport names the immediate next cue in current board order and offers a native Play next button in both the app and exported playback HTML.
- With no selected cue, Next starts the first cue. Selection changes synchronously, so rapid presses advance through successive cues while only the newest playback intent may complete.
- Stop, pause, and Finished retain the selection; Next advances from it. Reaching an end or looping never advances the board automatically.
- The final cue disables Next and shows End of board; no wrapping. An empty board has no available transport.
- If the immediate next cue is loading or failed, its name and unavailable reason remain visible and Next is disabled. No implicit skipping.
- Reorder, duplicate, rename, delete/Undo, and board import recompute from cue identity. Deleting the selected cue clears selection, so Next targets the first remaining cue. Undo restores that cue selected and stopped, cancelling any newer playback. Board replacement/reload starts unselected.
- Existing cue bounds, volume, fades, loops, and one-at-a-time audio remain authoritative. Stop, deletion, board replacement, and a newer selection cancel older metadata/play continuations.
- No extra shortcut is reserved; N remains assignable to a cue. Next supports native Tab, Enter, and Space activation.
- Labels and guidance are bilingual; narrow layouts keep Next and Stop reachable. No schema, persistence, dependency, or network change.

## 8. Error behavior

Never collapse multi-file import into all-or-nothing behavior.

Examples:

- Unsupported-looking files are rejected before cue creation.
- A browser decode/metadata error marks only that cue as failed.
- Files over 2 GiB are rejected.
- A concise summary is shown after bulk add, and failed item details remain visible on the cue card where relevant.

Technical exception text is not shown as the primary UI copy.

## 9. Privacy and network

- `connect-src 'none'` remains in the runtime CSP.
- No runtime network request.
- No cloud storage, tracking, or telemetry.
- User audio remains in the browser/device unless the user explicitly exports a file in a later version.
- “完全ローカル処理” may be shown because the runtime must not transmit user audio.

## 10. Persistence strategy

- v0.1.0–v0.4.0: session-only audio/cue state.
- v0.5.0: IndexedDB persistence for board metadata, cue metadata, audio Blob data, and Master volume.
- Audio Blob bytes are written when an asset is first accepted; ordinary cue edits and reordering update metadata without rewriting every stored audio Blob.
- A browser-storage failure must not break current-session playback. The UI must distinguish a saved board from a session-only/partially unsaved board and provide a retry path.
- Where supported, v0.5.0+ exposes a user-initiated persistent-storage request. It is a browser request, not a backup guarantee.
- Live Mode state is deliberately session-only and is never restored from IndexedDB; reload starts in edit mode.
- The storage panel reports the origin/site storage estimate when the Storage API exposes it.
- Reset is destructive, requires the canonical confirmation dialog, and clears persisted audio, cues, and app settings only after the database clear succeeds.
- Help must state that clearing browser site data can remove locally stored boards.

## 11. Export strategy

### Board backup (`.bkcue`) — v0.8.0

ZIP-based transfer container containing:

```text
manifest.json
audio/
  <asset-id>.<source-extension>
```

Manifest includes `schemaVersion` separately from `appVersion`, the board name, Master volume, cue metadata, and an asset table. v0.8.0 uses ZIP method 0 (stored / no compression) so large already-compressed audio is not needlessly recompressed and Blob bytes can be assembled without Base64 expansion. Export and import calculate/verify CRC32 locally. Invalid or unsupported backups must be rejected before the replacement confirmation and must leave the current board unchanged.

### Single HTML Player Export — implemented in v0.9.1 / required for v1.0.0

v0.9.1 implements the v1.0 commitment and must allow the current board to be exported as a **standalone player HTML** that contains the required cue metadata, UI, JavaScript, CSS, and selected audio bytes.

Requirements:

- Output opens directly from `file://` with no server.
- Output makes no runtime network request.
- Output is a playback-only artifact; editing the original board remains in Music Cue Pad.
- Cue names, ordering, start/end points, volume, fades, and loop settings are preserved.
- Output provides a responsive cue grid and safe Stop / Fade Stop controls.
- Audio is embedded in the HTML; recipients do not need separate audio files.
- Export filename is user-editable before export.
- Default base filename: `<board-name>-player` or `music-cue-pad-player` when the board has no usable name.
- Extension is always `.html` and is kept separate from the editable base-name field.
- Invalid filename characters are sanitized; empty names fall back safely.
- Show an estimated output size before export.
- Show a warning above **100 MiB** of source audio.
- Hard-stop Player Export above **250 MiB** of source audio because generation and opening become too memory-intensive on common browsers, especially smartphones. `.bkcue` remains the transfer format for larger boards.
- Export progress and failure states must be visible.
- A failed export must not mutate the working board.

The implementation may use Base64-encoded embedded audio because HTML is a text container, but the export pipeline must avoid unnecessary duplicate in-memory copies where practical.

## 12. Mobile UX

- Minimum supported layout width: 320 CSS px.
- No horizontal page scrolling.
- Cue buttons must have comfortable touch targets.
- Long filenames and cue names must wrap or truncate safely without widening the page.
- The active-player bar may be fixed to the bottom, but body padding must prevent content from being covered.
- v0.6.0 Live Mode should emphasize large cue buttons and hide editing controls.
- Landscape must remain usable.

## 13. Accessibility

- Native buttons for cues and player actions.
- Visible keyboard focus.
- State is not communicated by color alone.
- `aria-live` for meaningful playback/import status changes.
- Accessible names for icon-only buttons.
- Respect `prefers-reduced-motion`.
- v0.7.0 provides the full keyboard workflow: global playback keys, per-cue trigger keys, cue-grid navigation, focus preservation, and shortcut-related ARIA metadata.

## 14. Browser target

Primary:

- Current stable Chrome / Edge desktop and Android.
- Current stable Safari on iPhone/iPad and macOS.

Best effort:

- Current stable Firefox.

Direct `file://` opening is required.

## 15. Dependencies

v0.1.0–v0.4.0 use browser-native APIs only and add no third-party runtime dependency.

Future dependencies should be added only if they materially reduce implementation risk and must follow `dependencies.json` / lock-file rules.

## 16. Acceptance criteria

- `app.config.json` identifies Music Cue Pad v1.0.1.
- Source is based on the current provided htmlapps-template and preserves its build placeholders/contracts.
- At least 10 valid local audio files can be added in one selection.
- Each accepted file receives a visible cue button.
- Duration is shown after metadata is available.
- Pressing a cue starts that local audio.
- Pressing another cue switches playback without leaving the previous track audible.
- Pause / Resume and Stop work.
- Playback progress and elapsed / total time update.
- Unsupported/decode-failed files do not break valid cues.
- The interface works at 320–390 px without horizontal page scrolling.
- Japanese and English can be switched without reload. The header shows EN in Japanese and JA in English, with the target language named in a localized accessible label and tooltip; Help and the local-processing badge remain localized.
- `connect-src 'none'` remains present.
- No runtime external resource is introduced.
- Generated release HTML has no unresolved build placeholders.

### Additional v0.2.0 acceptance

- A cue can be renamed from its management controls and the active-player label updates with it.
- Duplicate inserts a new cue next to the original and reuses the original `assetId`.
- Delete removes a cue immediately and exposes Undo; Undo restores its prior relative position.
- Deleting the currently active cue stops playback without leaving hidden audio playing.
- Drag reordering works with mouse and touch from the dedicated handle; no separate up/down reorder buttons are shown.
- Desktop Drag & Drop and keyboard handle reorder work without triggering playback, seeking, changing volume, or changing selection. No-op and cancelled drags preserve Delete Undo and its expiry.
- Default builds refresh tracked `music-cue-pad.html` from the readable release. Explicit custom output paths do not overwrite that root artifact. Repository checks reject stale root releases before a build can repair them.
- Cue management remains usable at 320–390 px with no horizontal page scrolling.
- Long cue names do not break the card grid.
- Help copy describes v0.2.0 behavior and still states that reload clears the session.

### Additional v0.3.0 acceptance

- A ready cue can be edited to set Start, optional End, and Loop.
- The editor preview can play and seek the source without creating a second `AudioAsset`.
- “Use current position” fills Start or End from the preview position.
- Typed values accept seconds or colon time syntax with optional milliseconds, including `1:23.500`.
- Invalid Start/End combinations disable Save and show a user-facing validation message.
- Cue-card duration, progress, and range labels reflect the configured cue interval.
- Main-player seek is constrained to the cue interval and reports cue-relative elapsed/total time.
- Stop resets to Start; replay from Finished restarts at Start.
- Custom End produces Finished without allowing audio to continue past the cue.
- Loop restarts at Start after either a custom End or the natural source end.
- Duplicating a cue preserves Start/End/Loop while reusing the original `assetId`.
- v0.3.0 remains usable at 320–390 px without horizontal scrolling.

### Additional v0.4.0 acceptance

- Each cue can save volume plus Fade In / Fade Out settings, and duplicate preserves them.
- Master volume changes the whole output without rewriting per-cue settings.
- Fade In starts from cue Start; automatic Fade Out is relative to cue End / source end.
- Looping a cue reapplies the fade shape on each pass.
- Fade Stop is distinct from immediate Stop, fades the active output, then resets to cue Start.
- Switching cues, pausing, immediate Stop, deleting the active cue, or an audio error cancels stale manual fade work.
- Web Audio Gain nodes are used where available with a native volume fallback.
- v0.4.0 remains session-only and usable at 320–390 px without horizontal scrolling.

### Additional v0.6.0 acceptance

- Enter Live Mode and confirm import, storage, build information, footer, and cue management controls are unavailable while cue playback remains usable.
- Confirm a short press on the Live Mode exit control does not exit; a sustained hold does.
- Confirm remaining time updates while playing and the final-10-second warning appears only for non-looping cues.
- Confirm Fullscreen toggles when supported and unsupported environments remain usable.
- Confirm Keep Screen On is user initiated, reports unsupported/failure safely, and is released when Live Mode ends.
- At 320–390 px portrait width and short landscape heights, confirm no horizontal scrolling and that fixed playback controls do not hide the actionable cue area.

### Additional v0.5.0 acceptance

- After adding valid audio and waiting for save completion, reloading restores the same cue count and playable local audio.
- Cue names, order, Start/End, Loop, cue volume, Fade In/Out, and Master volume survive reload.
- Duplicated cues still share a single stored audio asset instead of duplicating Blob bytes.
- Delete persists immediately, Undo restores the cue, and an unreferenced asset is cleaned only after the Undo window.
- Storage usage/protection state is visible without exposing developer-only IndexedDB terminology as the main UI.
- A denied persistent-storage request does not disable ordinary local persistence.
- Simulated/real persistence write failure leaves the current session usable and exposes Retry save.
- Reset requires confirmation and clears the persisted board; cancelling leaves both memory and IndexedDB unchanged.
- Reload after Reset starts from the empty state.

### Additional v0.7.0 acceptance

- Assign `A` to one cue and confirm pressing `A` triggers it; assign `B` to another and confirm it switches playback cleanly.
- Attempt to assign the same key to a second cue and confirm Save is blocked with the conflicting cue identified.
- Confirm `R` and `F` cannot be assigned to cues.
- Confirm duplicating a shortcut-bearing cue produces a duplicate with no shortcut.
- Confirm `Space` pauses/resumes, `R` restarts at cue Start, `F` performs Fade Stop, and `Escape` performs immediate Stop.
- Confirm shortcuts do not fire while editing text, while a dialog is open, during IME composition, on modified key chords, or from key repeat.
- Confirm Arrow keys and Home/End move focus among cue playback buttons without starting audio.
- Start playback from a focused cue button and confirm focus remains on the equivalent cue button after state re-render.
- Confirm assigned cue buttons expose `aria-keyshortcuts`, playback buttons expose accurate `aria-pressed`, playback status uses a live status region, and visible focus remains clear.
- Confirm shortcut assignments survive reload together with the existing v0.5+ cue metadata.
- Confirm Japanese/English keyboard guidance and 320–390 px layouts remain usable without horizontal scrolling.

## 17. Version plan to v1.0.0

### v0.1.0 — Basic Playback

Multiple import, Drop, cue grid, one-at-a-time playback, progress, Pause/Resume, Stop, responsive bilingual UI, basic failure states.

### v0.2.0 — Cue Management

Rename, delete with Undo, duplicate, reorder, long-name handling, richer mobile editing UI, robust empty/partial-failure states.

### v0.3.0 — Cue Points

Start position, end position, current-position capture, time validation, interval playback, same-asset multi-cue references, loop.

### v0.4.0 — Audio Control

Per-cue Gain, master Gain, fade-in, automatic fade-out, manual Fade Stop, reliable audio-state cleanup.

### v0.5.0 — Local Persistence

IndexedDB asset/cue persistence, reload restore, storage estimate, persistent-storage request where appropriate, quota handling, safe Reset.

### v0.6.0 — Live Mode / Mobile UX

Live Mode, editing controls hidden, large cue layout, bottom player refinement, remaining time, near-end state, Fullscreen, Wake Lock, landscape refinement.

### v0.7.0 — Keyboard / Accessibility

Global playback shortcuts, per-cue shortcut assignment and conflict detection, improved keyboard navigation, ARIA/state review, reduced-motion and focus regression.

### v0.8.0 — Backup / Transfer

Board naming, `.bkcue` export/import, schema versioning, progress, corruption checks, transactional import / rollback, large-board handling.

### v0.9.1 — Release Candidate + Player Export / UX refresh

Implement the required **Single HTML Player Export** early enough for RC testing. Realign the header to the current htmlapps-template header contract while keeping app-specific meta copy and the Fully local processing badge. Replace native drag reorder with a visible insertion placeholder, live neighboring-card reflow, and a floating held-card representation. Redesign cue-editor form controls/grouping. Then run desktop/mobile/tablet, JA/EN, long names, 50–100 cue stress, long audio, all playback modes, persistence, backup, exported-player, CSP/network, standalone/self-extract, README/favicon/screenshots regression.

### v1.0.0 — Initial Stable

Fix RC issues only. Re-run complete release regression including small and near-limit exported players, direct-opening behavior, PC/mobile/JA/EN, persistence/backup, CSP/network, and standalone/self-extract. Update README, Japanese/English screenshots, favicon, versions, and release notes.

## 18. Post-v1.0 candidates

Not part of the v1.0 commitment:

- Advanced setlists (manual Play next is supported).
- Waveform cue editor.
- Crossfade between cues.
- Simultaneous multi-cue playback.
- MIDI triggering.
- Automatic loudness analysis/normalization.
- Multiple locally saved boards.
- Remote control / WebRTC.

## 19. In-app help contract

The upper-right help dialog must always describe the current released behavior, not future roadmap features. It must include:

- how to add and play audio,
- what Stop does,
- current persistence behavior,
- privacy/local-processing behavior,
- format/browser limitations,
- important data-loss risks once persistence is added.

The final help item and close control must remain reachable on narrow/short smartphone viewports.
