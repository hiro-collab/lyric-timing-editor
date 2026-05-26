# Lyric Timing Editor

Lyric Timing Editor is a browser-based tool for editing phrase-level lyric timing.

It loads local audio and UTF-8 lyric text in the browser, lets you stamp lyric phrases while listening, and exports JSON timing data. Audio files are not uploaded, bundled, analyzed, or saved into project/export JSON.

The app also includes a small synthetic demo text button so the editor can be smoke-tested without real lyrics.

## Use

Hosted static app:

https://hiro-collab.github.io/lyric-timing-editor/

The hosted page runs in your browser. Local audio and lyric files are not uploaded by this app.

Local development:

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

- Work project JSON: editable draft data for this editor. This is for resuming work in Lyric Timing Editor, not for Music Effect import.
- Timing export JSON: completed timing data for use by another music/video system.

Timing values are stored as integer milliseconds. `startTimeMs` is the editable phrase boundary. Exported `endTimeMs` is derived from the next phrase `startTimeMs`; for the last phrase it is derived from `durationMs` when available.
The timing-only export does not include lyric text. Exports with lyric text and project JSON files may include copyrighted lyrics.

Export targets:

- Music Effect v2 JSON: the primary JSON handoff format, with timing-only and lyric-included variants.
- WebVTT: a general web/subtitle export that includes lyric text.
- LRC: a synchronized lyric player export that includes lyric text.
- Lyric TXT: the current edited lyric text only, saved separately from Work Project JSON.

See `docs/export-formats.md` for details.
See `SECURITY.md` and `PRIVACY.md` for the static local-browser security and privacy boundaries.

On browsers that support the File System Access API, Work Project Save and Lyric TXT Save let you choose a local file and then overwrite the same file on later saves in the same browser session. Other browsers fall back to a normal download.

For Music Effect or the Lyrics Data Installer, use `Export` -> `Music Effect v2`. Do not use Work Project JSON there; its schema is `lyric-timing-editor.project.v1`.

## Important Rights Note

Before publishing, distributing, uploading, or committing files that include lyric text, confirm the lyric rights and the destination terms. This repository intentionally does not include sample audio files, sample lyric files, or real-song timing data.

Use the built-in safe demo text for testing when rights-cleared lyrics are not available. It is synthetic text written for this editor, not copied from a song.

## License

No open-source license has been selected yet. Treat reuse outside this repository as pending until a `LICENSE` file is added.

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
- Parse lyrics in TextAlive-compatible mode or literal mode. Each non-empty lyric text line becomes one phrase, so line breaks split lyrics.
- Add `[blank]`, `[no lyrics]`, `[歌詞なし]`, or `[無表示]` as a source line when an intro, interlude, or outro should clear the lyric display.
- Insert `[blank]` from the lyric text editor, including before or after the current phrase while preserving matched timings where possible.
- Search and replace plain text inside the lyric text editor before applying it to the project.
- Save the edited lyric text as a standalone UTF-8 `.txt` file from the lyric controls.
- Show current and next phrase.
- Stamp current/next phrase with buttons or keyboard shortcuts.
- Select, move, clear, and evenly place phrase timing markers.
- Save/load editor Work Project JSON.
- Export timing-only or lyric-included JSON.
- Recover unsaved work with local IndexedDB autosave.
- Switch UI language between Japanese and English.

## Project Notes

See `docs/background.md` for the short project origin and `docs/handoff.md` for the temporary Codex handoff notes.
See `docs/policy-questions.md` for the pending license, security, privacy, and sample-data decisions.
See `docs/legal-and-safety.md` for rights, Songle/TextAlive, and local-data safety notes.
