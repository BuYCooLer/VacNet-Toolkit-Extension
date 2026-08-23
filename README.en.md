<h1 align="center">
  <br>
  <img src="public/icon.png" alt="VACNET Toolkit" width="96">
  <br>
  VACNET Toolkit Extension
  <br>
</h1>

<p align="center">
  <b>Extends the functionality of the CS2 VACNet labeling portal<br>into a full-fledged analytics tool.</b>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/License-GPL%203.0-blue?style=flat-square"></a>
</p>

<p align="center">
  <sub>⚠️ <b>Notice:</b> This project is maintained on a voluntary basis and is officially distributed <b>only</b> in this repository. The author is <a href="https://github.com/MartinDawgor"><b>MartinDawgor</b></a>. Copying and forking are allowed provided that the original GPL license is kept and clear attribution with a link to this repository is included. Plagiarism or publishing under a different name is strictly prohibited. <br>Contact the author: <b><a href="https://t.me/GeniusShitPost"><b>Telegram</b></a> | <a href="https://steamcommunity.com/id/Chumzes/"><b>Steam</b></a></b></sub>
</p>

<div align="right"><a href="README.md">🇷🇺 Русский</a></div>

---

This extension removes the restrictions set by the VacNet site, replaces the player and page preloading, adds a verdict panel with keyboard shortcuts, detects duplicate clips, localizes the interface, and keeps a full history of viewed verdicts, while also adding several tweaks for ease of use.

<img src="https://github.com/user-attachments/assets/09926958-2f86-4576-a794-7df56f07ec3d" alt="Main view: player and verdict panel" width="100%">

<p align="center">
  <img src="https://github.com/user-attachments/assets/737b0a4a-b2d1-40c6-b6f1-7c266fd195c2" alt="History dashboard with match cards" width="40%">
  <img src="https://github.com/user-attachments/assets/8b5f0dc0-e3d6-41cb-b7d5-34b07403fe05" alt="History details" width="40%">
</p>

---

## Features

### 🎬 Removal of restrictions

Playback starts from the beginning of the replay. The graded clip window is marked on the seek bar, and the flagged moment is highlighted with a red trigger marker. Valve's timer that clamps playback to the 12-second window and snaps it back on seek is intercepted via `setInterval`/`setTimeout` and disabled, verdicts are submitted instantly without confirmation, and clips are preloaded without refreshing the page.

### 🎮 Modern video player

The portal's default Video.js player is replaced with [Plyr](https://plyr.io/) — a lightweight media player with a clean interface. Speeds from 0.25× to 4×, frame stepping (`←`/`→`), 2× zoom toggle (`Z`), persistent volume. A countdown overlay appears before the flagged moment, and at the trigger point, a clear indicator shows exactly what VacNet reacted to.

### ⚖️ Verdict panel

Four categories — Aim Assist, Wall Hack, Auto Bhop, Bot — each with **Yes** / **Uncertain** / **No**, color-coded and keyboard-driveable. Submitting a verdict **does not reload the page**: the next clip is fetched in the background, preserving playback position and fullscreen. On failure, the extension falls back to standard portal navigation.

### 🔁 Clip deduplication

Clips are identified by the unique VOD ID of the video + clip creation date + timestamp range. When the portal re-serves the same moment under a new task ID, the extension recognizes it as an exact duplicate, shows your previous verdicts, and optionally auto-applies them for quick confirmation.

### 📊 History & metrics

Every labeled clip is saved in `browser.storage.local`. The dashboard has two views:

- **History** — entries grouped by match, showing clip ranges, task IDs, deduplication status, and per-verdict breakdown.
- **Metrics** — live data for the current clip: task ID, video ID, WebM URL, clip range, event time, match date, identity status, and Plyr runtime info.

Import and export history as JSON.

### 🌍 Localization

Ships with English and Russian locales. The portal's own interface text — questions, buttons, labels, instructions — is translated in real time via a DOM mutation observer with no page reload.

### 🔒 Privacy & safety

The investigator's nickname is hidden by default. All preferences (stretch video, pinned controls, volume, auto-apply duplicates) are stored locally. Every page transition is validated — form actions are verified against the allowed domain, HTML attributes are sanitized, `javascript:` URLs are removed, and heavy and broken Valve algorithms are muted.

---

## What it fixes

The portal works, but has genuine issues:

| Issue | What the extension does |
| --- | --- |
| Playback clamped to ~12s | Intercepts Valve's timers and removes the clamp, enabling full replay seeking |
| No speeds above 1× | Plyr provides 0.25×–4× and frame stepping |
| Clip details dialog is broken | The portal binds a modal to a non-existent element — the extension reads metadata directly |
| Submit reloads the page | The form is posted in background; the next clip is swapped in without losing state |
| Fixed layout wastes screen space | Video and verdict panel have fixed sizes — the extension uses a responsive flex layout |
| "Submitting…" indicator never clears | The extension manages submission state directly |

---

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / Pause |
| `R` | Restart from clip start |
| `Z` | Toggle 2× zoom |
| `← →` | Step backward / forward one frame |
| `Enter` | Submit verdict |
| `Esc` | Close dashboard |

> All hotkeys are physical-key based (`event.code`), so they work correctly on non-US keyboard layouts.

---

## Install

### Chrome, Edge, Brave, Opera

1. Download the latest release zip from [Releases](https://github.com/MartinDawgor/VacNet-Toolkit-Extension/releases).
2. Open `chrome://extensions`, enable **Developer mode**.
3. Drag the zip onto the page.

### Firefox

1. Download the Firefox release zip from [Releases](https://github.com/MartinDawgor/VacNet-Toolkit-Extension/releases).
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on** and select the zip.

> **Note:** the extension uses a content script running in the page's `MAIN` world to intercept Valve's playback timers. **Firefox 128+** is required; Chrome has no extra requirement.

---

## Privacy

- **`storage`** — keeps your labeling history and preferences in `browser.storage.local`.
- **`https://www.counter-strike.net/*`** — the only host permission. The extension does not run anywhere else.

No analytics, no telemetry, no remote code. The only network request the extension makes is posting your verdict to `counter-strike.net` when you confirm it — the same submission the portal would have made itself. Nothing is sent to the developer or any third party.

Your history never leaves the browser unless you explicitly export it as JSON.

---

## Disclaimer

This extension is a quality-of-life layer over the labeling portal. It **does not label clips for you**, does not auto-submit verdicts, and does not automate any part of the review process.

Every answer is one you pick. Submitting requires a deliberate press. A recalled verdict from a previously seen clip is filled in for you to confirm or change — never sent on its own. There is no bulk labeling, no auto-advance, and no scripted answering.

Investigators are advised not to stream, record, or share these clips, so there is no frame export, clip download, or sharing feature. The investigator's nickname is hidden by default.

---

<p align="center">
  Counter-Strike, Counter-Strike 2 and VACNet are trademarks of Valve Corporation.<br>
  This project is not affiliated with Valve, and is distributed on a voluntary basis.
</p>
