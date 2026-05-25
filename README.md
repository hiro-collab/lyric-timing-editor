# Lyric Timing Editor

Lyric Timing Editor is a browser-based tool for editing phrase-level lyric timing.

It loads local audio and UTF-8 lyric text in the browser, lets you stamp lyric phrases while listening, and exports JSON timing data. Audio files are not uploaded, bundled, analyzed, or saved into project/export JSON.

## Use

```powershell
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Build

```powershell
npm run build
```

The static build is written to `dist/` and is intended to work on GitHub Pages.

## Data

This editor writes two kinds of JSON:

- Work project JSON: editable draft data for this editor.
- Timing export JSON: completed timing data for use by another music/video system.

Timing values are stored as integer milliseconds in `startTimeMs` / `endTimeMs`.
The timing-only export does not include lyric text. Exports with lyric text and project JSON files may include copyrighted lyrics.

## Important Rights Note

Before publishing, distributing, uploading, or committing files that include lyric text, confirm the lyric rights and the destination terms. This repository intentionally does not include sample audio files, sample lyric files, or real-song timing data.

## Commands

```powershell
npm run dev
npm run typecheck
npm test
npm run build
```

## Current Scope

- Load local audio in the browser.
- Load lyric text from a file or pasted text.
- Parse lyrics in TextAlive-compatible mode or literal mode.
- Show current and next phrase.
- Stamp current/next phrase with buttons or keyboard shortcuts.
- Select, move, clear, and evenly place phrase timing markers.
- Save/load editor project JSON.
- Export timing-only or lyric-included JSON.
- Recover unsaved work with local IndexedDB autosave.
- Switch UI language between Japanese and English.

## Project Notes

See `docs/background.md` for the short project origin and `docs/handoff.md` for the temporary Codex handoff notes.
