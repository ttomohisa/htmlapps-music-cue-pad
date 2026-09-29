# Music Cue Pad

[![GitHub Pages](https://github.com/ttomohisa/htmlapps-music-cue-pad/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/ttomohisa/htmlapps-music-cue-pad/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Single HTML](https://img.shields.io/badge/distribution-single%20HTML-0ea5e9)](https://ttomohisa.github.io/htmlapps-music-cue-pad/)

[日本語版 README](README.ja.md)

A fully local, single-HTML cue player for registering multiple audio files and triggering the track you need from large playback buttons. Selected audio stays in the browser and is not uploaded by the app.

## 🚀 Live demo

### [Open Music Cue Pad on GitHub Pages](https://ttomohisa.github.io/htmlapps-music-cue-pad/)

GitHub Pages delivers the initial HTML. After it loads, audio import, cue editing, playback, local saving, backup, and player export are processed locally on your device. The audio files you select are not uploaded by the app.

[![Music Cue Pad screenshot](assets/screenshot.png)](https://ttomohisa.github.io/htmlapps-music-cue-pad/)

## Features

- **Trigger registered audio immediately** — Add multiple audio files and play the track you need from large numbered buttons.
- **Set the exact playback range** — Adjust Start and End with a two-handle range bar, seek while previewing, or enter precise times such as `1:23.500`.
- **Tune each cue without editing the source file** — Set per-cue volume, Fade In, Fade Out, Loop, and an optional trigger key.
- **Reorder visually** — Drag cards to change the order while the insertion position and temporary numbering update on screen.
- **Stay focused during playback** — Switch to a playback-only view that hides editing controls, enlarges the buttons, shows remaining time, and can use Fullscreen / Keep Screen On where supported.
- **Control playback quickly** — Pause/Resume, Restart, Fade Stop, Stop, Master volume, per-cue shortcuts, and desktop keyboard controls are available.
- **Keep the board on this device** — Audio, cue settings, board name, and Master volume are saved in IndexedDB and restored on reload.
- **Move an editable board between devices** — Export and import `.bkcue` backups containing the board settings and audio assets.
- **Export one playback-only HTML file** — Embed the current audio and cue settings into a self-contained `.html` file for playback on another device without the editor.
- **Private, single-HTML operation** — No account, runtime CDN, analytics, telemetry, API, or remote font is required by the app.
- **Japanese / English UI** — Both languages are included in the same HTML.

## Quick start

### Use the web demo

Just [open the demo](https://ttomohisa.github.io/htmlapps-music-cue-pad/). No installation or account is required.

### Use the single HTML file

1. Download `music-cue-pad.html` from a release or use `dist/index.html` from this repository.
2. Open it in a current browser.
3. Add your audio files and start building the playback board.

### Build the self-contained file locally

1. Download or clone this repository.
2. Double-click `build-standalone.bat` on Windows.
3. Copy the generated `dist/index.html` or `dist/index.self-extract.html` wherever you need it.
4. Open the file later without installing Music Cue Pad.

The current app has no third-party runtime dependency. Python, Node.js, and a local web server are not required for normal use.

## Usage

1. Add one or more audio files with the file picker or Drag & Drop.
2. Each audio file becomes a numbered playback button. Press a button to play it; selecting another button switches playback to that cue.
3. Use **Edit cue** to change the display name and set Start / End. In the preview section, drag the two handles to adjust the playback range or type an exact time.
4. Set cue volume, Fade In, Fade Out, Loop, and an optional trigger key when needed.
5. Drag cards to reorder them. The temporary numbering and insertion position update while you drag.
6. Use the Master volume and bottom player for seeking, Pause/Resume, Fade Stop, or immediate Stop.
7. Use **Playback view** when you want only the large playback controls on screen. Remaining time is shown, and non-looping cues display an ending-soon notice during the final 10 seconds.
8. The board is saved automatically in the browser. Use the storage panel to review usage, request persistent storage where supported, retry a failed save, or delete all saved app data.
9. Use **Export & backup** to save a `.bkcue` file when you want to continue editing the board on another device.
10. Use **Export playback HTML** when you want a single playback-only `.html` file with the referenced audio embedded inside it.

Supported audio formats depend on the browser and operating system. The app accepts common browser audio formats including MP3, WAV, M4A/AAC, OGG/Opus, WebM audio, and FLAC where supported.

### Playback range

The cue editor provides two synchronized ways to define the playable range:

- Drag the Start / End handles in the playback-range bar.
- Enter an exact timestamp such as `0:42.500`.

Changing either control updates the other. End can also remain at the end of the source track. Loop repeats the configured Start → End range.

### Playback HTML export

Playback HTML export creates one self-contained file containing the required UI, JavaScript, cue metadata, and referenced audio bytes.

- Cue order, Start / End, cue volume, fades, Loop, trigger keys, and Master volume are carried over.
- The exported file is playback-only and does not include the board editor or IndexedDB board management.
- Above 100 MiB of source audio, the app asks for confirmation before creating the HTML.
- Above 250 MiB of source audio, single-HTML player export is blocked and `.bkcue` is recommended instead.

Use `.bkcue` when you want to continue editing. Use playback HTML when you want to hand off a prepared board for playback.

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| Assigned `0–9` / `A–Z` | Play the assigned cue |
| `Space` | Play / Pause |
| `R` | Restart the active cue from its Start point |
| `F` | Fade Stop |
| `Esc` | Stop immediately |
| `←` / `→` / `↑` / `↓` | Move focus between cue buttons |
| `Home` / `End` | Move focus to the first / last cue |

`R` and `F` are reserved and cannot be assigned as cue trigger keys. Shortcuts are ignored while typing in fields or using IME composition.

## Publish with GitHub Pages

The repository includes a workflow that builds the standalone HTML and deploys it to GitHub Pages.

1. Push the repository to GitHub as `htmlapps-music-cue-pad`.
2. Open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
3. Push to `main`, or manually run the Pages workflow from the Actions tab.
4. After a successful deployment, the app is available at `https://ttomohisa.github.io/htmlapps-music-cue-pad/`.

The deployed page still performs user-audio processing locally in the browser.

## Development and build layout

```text
.
├─ src/index.template.html       # Editable application source
├─ app.config.json               # App metadata and version
├─ dependencies.json             # Embedded dependency declaration
├─ assets/
│  ├─ favicon.svg                # Canonical app / favicon icon
│  ├─ screenshot.png
│  ├─ screenshot-en.png
│  └─ screenshot-mobile.png
├─ build-standalone.bat          # Windows build entry point
├─ build-standalone.ps1          # Standalone HTML builder
├─ scripts/check-repository.ps1  # Repository / release validation
├─ dist/index.html               # Generated readable single HTML
└─ dist/index.self-extract.html  # Generated gzip self-extract HTML
```

Do not edit generated files under `dist/` directly. Update `src/index.template.html` and rebuild.

### Build

On Windows:

```powershell
.\build-standalone.bat
```

Full repository validation:

```powershell
.\scripts\check-repository.ps1
```

After building, open both generated HTML variants and verify the main workflow with the network disconnected.

## Privacy and runtime network protection

Music Cue Pad is designed for fully local processing.

- Selected audio is read and played in the browser.
- The app does not upload selected audio to a server.
- Runtime CSP contains `connect-src 'none'`.
- There is no account, analytics, telemetry, or cloud storage in the app.
- Audio assets and board settings are stored in this browser's IndexedDB for the current origin.
- Clearing browser site data can remove the stored board.
- Persistent-storage permission reduces eviction risk where supported, but it is not a backup guarantee. Keep `.bkcue` backups for important boards.
- The GitHub Pages version requires the initial HTML request. Opening `dist/index.html` locally allows use without that initial network request.

## Limitations

- Actual audio codec support varies by browser and operating system.
- Screen Wake Lock and Fullscreen depend on browser support and may require a secure context or user gesture.
- Browser background playback behavior can change when the screen is locked or the tab is suspended by the operating system.
- The product contract accepts individual files up to 2 GiB, but practical memory/storage limits can be lower on mobile devices.
- Large boards consume IndexedDB quota and can take time to restore or back up.
- Playback HTML export embeds audio directly into the output, so file size grows with the source audio. It is intentionally blocked above 250 MiB of source audio.
- Clearing site data deletes the locally saved editable board unless you have a `.bkcue` backup.
- Music Cue Pad is a cue player, not a DAW or audio editor; it does not modify the original audio file.

## Dependencies

Music Cue Pad v1.0.0 has no third-party runtime library dependency. Playback, storage, ZIP backup, range controls, and HTML export use browser APIs and application code included in the standalone HTML.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for dependency notices.

## Contributing

Bug reports and feature proposals are welcome through GitHub Issues. See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidance.

## License

Copyright © 2026 ttomohisa

Licensed under the [MIT License](LICENSE).
