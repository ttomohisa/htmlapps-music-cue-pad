# Offline Verification — Music Cue Pad

## Readable standalone

1. Run `build-standalone.bat` on Windows.
2. Open `dist/index.html` directly with `file://`.
3. Open browser developer tools and clear the Network and Console panels.
4. Enable offline mode or disconnect networking.
5. Reload the local HTML.
6. Add at least two local audio files in different browser-supported formats.
7. Confirm every valid file becomes a cue after metadata is read.
8. Play one cue, then press a different cue and confirm only the new track remains audible.
9. Confirm Pause, Resume, Stop, elapsed time, total duration, and playback progress behave correctly.
10. Add one unsupported or malformed file together with valid audio and confirm valid cues remain usable.
11. Test Drag & Drop as well as the file picker.
12. Switch Japanese / English and confirm dynamic cue/player/import states follow the selected language.
13. Rename a cue to a long name and confirm the grid does not widen or create horizontal page scrolling.
14. Duplicate a cue and confirm the duplicate references the same source audio and plays correctly.
15. Delete a non-active cue and use Undo; confirm it returns to its prior list position.
16. Delete the currently active cue; confirm playback stops, then Undo and confirm it returns without autoplay.
17. Reorder playback buttons only by dragging the handle. Confirm desktop and touch layouts both show sequence numbers, the placeholder only reacts to nearby cards, and surrounding cards move into the previewed order.
18. Confirm the management controls remain keyboard reachable and do not trigger playback.
19. Edit a ready cue and set Start/End with typed values such as `0:01.000` / `0:02.500`; confirm Save rejects an End before Start.
20. In the editor, seek the preview and use “current position” for Start and End; confirm the saved values match.
21. Play the edited cue and confirm it starts at Start, stops at End, reports cue-relative time, and Stop returns to Start.
22. Enable Loop and confirm the custom interval repeats without playing past End.
23. Duplicate the ranged cue and confirm the duplicate preserves Start/End/Loop and still references the same audio asset.
24. Seek with the fixed player and confirm seeking stays inside the cue range.
25. At 320–390 px width, confirm there is no horizontal scrolling, the cue editor is fully reachable, and the fixed player does not hide the final cue when the page is scrolled.
26. Open the help dialog on a short smartphone viewport and confirm the final help item and close control remain reachable.
27. Confirm no external request appears and the Console has no application error.

## v0.5.0 Local Persistence checks

28. Wait until the storage panel reports the board as saved, then reload the page and confirm audio assets and cues return in the same order and remain playable.
29. Confirm cue names, Start/End, Loop, cue volume, Fade In/Out, and Master volume survive reload.
30. Duplicate a cue, reload, and confirm both cues still share one stored audio asset rather than duplicating the Blob.
31. Delete a middle cue, use Undo, reload, and confirm the prior order is preserved.
32. Delete one of two cues that share an audio asset and confirm the stored asset remains; delete the last reference, wait beyond the Undo window, and confirm the orphaned asset is removed.
33. If supported, request protected storage and confirm a denial does not prevent normal local persistence.
34. Simulate or reproduce a storage write failure/quota failure, confirm current-session playback still works, then use Retry save and confirm a consistent board can be stored.
35. Cancel Delete all and confirm both the current board and saved board remain unchanged. Confirm Delete all, reload, and confirm the board is empty.

## v0.6.0 Live Mode / Mobile checks

36. Enter Live Mode with ready cues and confirm import, storage management, build details, footer, and cue edit/reorder/delete controls are hidden.
37. Confirm cue playback, Pause / Resume, Fade Stop, immediate Stop, seek, and Master volume still behave correctly.
38. Confirm the active cue and fixed player show remaining cue-relative time.
39. Play a non-looping cue into its final 10 seconds and confirm `Ending soon` / `まもなく終了` appears; enable Loop and confirm the ending warning does not appear.
40. Press and release the Live Mode exit control before the hold completes and confirm Live Mode stays active; hold it for about one second and confirm editing returns.
41. If Fullscreen is supported, toggle it on and off from Live Mode. If unsupported, confirm the app remains usable and does not expose a broken action.
42. If Screen Wake Lock is supported, enable Keep Screen On, background/restore the page where practical, and confirm the requested lock can be reacquired; exit Live Mode and confirm the lock is released.
43. At 320, 375, and 390 px portrait widths, confirm no horizontal scrolling and that live controls have adequate touch targets.
44. On a short landscape smartphone viewport, confirm the cue grid remains actionable above the fixed player and no fixed UI overlaps the cue trigger area.
45. Switch Japanese / English before entering Live Mode and confirm all live controls, remaining time, and ending warning update naturally.
46. Confirm Live Mode is not restored after reload even though the saved board itself is restored.

## v0.7.0 Keyboard / Accessibility checks

47. Assign `A` to one cue and `B` to another; confirm each key triggers the expected cue and switching leaves only one cue audible.
48. Attempt to assign `A` to a second cue; confirm Save is disabled and the conflict names the existing cue. Confirm `R` and `F` are rejected as reserved.
49. Duplicate a shortcut-bearing cue and confirm the duplicate has no shortcut while the original keeps its assignment.
50. Confirm `Space` pauses/resumes the selected cue, `R` restarts from its Start, `F` performs Fade Stop, and `Escape` stops immediately.
51. Confirm keyboard commands do not fire from text/select fields, an open dialog, IME composition, Ctrl/Alt/Meta combinations, or key repeat.
52. Focus a cue playback button; use Arrow keys and Home/End to move between cues without starting playback.
53. Trigger playback from a focused cue button and confirm focus remains on that cue after playback-state re-render.
54. Inspect assigned cue buttons for `aria-keyshortcuts` and accurate `aria-pressed`; confirm playback status is announced through a polite status live region.
55. Enable reduced motion at OS/browser level and confirm nonessential transition/animation motion is suppressed.
56. Reload a saved board and confirm cue shortcut assignments restore with the other cue metadata.


## Self-extracting variant

1. Confirm the favicon and upper-left brand icon in `dist/index.html` use the same artwork from `assets/favicon.svg`.
2. Open `dist/index.self-extract.html` directly.
3. Confirm the loading screen disappears and Music Cue Pad v1.0.0 is restored.
4. Repeat the core playback and offline checks above.
5. Confirm the Console contains no decompression or CSP error.
6. Run `scripts/verify-self-extract.ps1`; it must verify the ASCII-only loader and byte-for-byte restoration of `dist/index.html`.

## Hosted copy

For GitHub Pages, the initial page request is expected. After the HTML has loaded, clear the Network panel, enable offline mode, and repeat the complete cue playback flow. No audio or user data should be transmitted by the app.

## Later-version additions

When the corresponding features land, extend this checklist rather than claiming they are already verified:

- v0.8.0: `.bkcue` backup and transactional restore (implemented).
- v0.9.1: Single HTML Player Export, editable filename, size estimate/warning/limit, template-aligned header, drag-reorder refresh, and cue-editor refresh (implemented).

## Audio Control regression checks

- Verify cue volume and Master volume multiply correctly.
- Verify fade-in starts from cue Start and automatic fade-out reaches silence at cue End.
- Verify Fade Stop stops and resets to cue Start.
- Verify switching cues, Pause, Stop, delete, and errors cancel stale fade state.
- Verify loop reapplies the configured fade shape on each pass.

## v0.8.0 Backup / Transfer checks

1. Add at least two audio files, including two files that may share the same visible filename if possible.
2. Give the board a name and export a `.bkcue` backup. Confirm the downloaded filename uses the board name.
3. Open the `.bkcue` with a normal ZIP utility and confirm it contains `manifest.json` plus `audio/<asset-id>...` entries.
4. Confirm `manifest.json` uses `format: music-cue-pad-board`, `schemaVersion: 1`, and records the board name, Master volume, assets, and cues.
5. Delete/reset the current board, import the backup, accept the replacement confirmation, and confirm cue count/order/settings and board name are restored.
6. Reload the app and confirm the imported board restores from IndexedDB.
7. Corrupt a copied `.bkcue` (for example, alter bytes inside an audio entry), try to import it, and confirm the app rejects it before replacement confirmation and leaves the current board unchanged.
8. Try a non-Music Cue Pad ZIP and a ZIP using a compression method other than store-only; confirm both are rejected without replacing the board.
9. During export/import of a large board, confirm progress remains visible and the page does not create horizontal scrolling at 320/375/390 px widths.
10. Confirm no HTTP/HTTPS request is made while exporting or importing.


## v0.9.1 Player Export / UX checks

1. Compare the app header with the current htmlapps-template: spacing, brand mark size, version badge, language/help controls, hover/active behavior, and sticky treatment must remain aligned. Confirm header meta is app-specific and the Fully local processing badge remains visible.
2. With at least three cues, grab the desktop reorder handle and confirm the source card visibly lifts, a dashed insertion target shows exactly where it will land, and neighboring cards shift while the pointer moves. Drop and confirm the new order persists.
3. Open Edit cue on desktop and 320/390 px mobile widths. Confirm grouped controls, text/time inputs, selects, help copy, scrolling, and sticky Cancel/Save actions remain readable with no horizontal overflow.
4. Export a playback HTML from at least three audio files. Confirm the filename is editable, the `.html` suffix is separate, an approximate output size is shown, and export progress is visible.
5. Open the exported HTML independently. Confirm the expected board title and cue count/order, cue Start/End behavior, per-cue/Master volume, Fade In/Out, Loop, trigger keys, seek, Pause, Fade Stop, and Stop.
6. Clear the Network panel before playback and confirm no HTTP/HTTPS request occurs; data/blob media access is local only.
7. Confirm source audio above 100 MiB asks before export, and above 250 MiB refuses single-HTML export and recommends `.bkcue`.
8. Simulate an export failure and confirm the working board remains unchanged.


## v0.9.2 Icon / playback range checks

- Confirm `assets/favicon.svg`, the header brand icon, the readable standalone favicon, self-extract favicon, and exported playback HTML all use the supplied Music Cue Pad SVG.
- Open cue edit and verify the two playback-range handles update Start / End time fields and the selected segment.
- Verify typed Start / End values update the handles, End at the track duration maps to “to end”, and handles cannot cross.
- Verify dragging either range handle moves preview position to the adjusted boundary.


## v1.0.0 Stable release checks

- Confirm the header and Help dialog show v1.0.0.
- Confirm the supplied favicon SVG matches the header icon and embedded favicon.
- Confirm playback-range handles stay synchronized with Start/End fields.
- Confirm drag reorder keeps visible numbering consistent before and after drop.
- Confirm `.bkcue` export/import round-trips an editable board without changing audio references.
- Confirm playback HTML export opens as a standalone playback-only board with no runtime network request.
- Confirm Japanese/English UI, desktop/mobile layouts, Playback view, keyboard controls, and error/empty states.
- Confirm `connect-src 'none'`, no remote runtime assets, and no unresolved build placeholders.
