# Design Notes

## Purpose

Lyric Timing Editor is a standalone browser tool for creating lyric timing JSON.

It should not depend on Music Effect player DOM, Launch Manager, song packs, or any specific visual performance system. Downstream systems should receive exported JSON files rather than call into this editor.

## Boundaries

- Audio is local browser input only.
- Audio binaries, local absolute paths, and audio hashes are not saved.
- Project JSON may include lyric text and should be treated as private working data unless rights are confirmed.
- Timing-only export should omit lyric text.
- Export with lyrics should show a rights confirmation before download.
- Autosave uses local IndexedDB and may include lyric text, but does not include audio files.
- Lyric Timing Editor Project JSON is an editor-owned work file. Downstream systems should consume timing exports, not project files.
- Songle metadata is optional reference metadata. The editor must still work when it is absent or `null`.

## Timing Model

- The canonical time unit is integer milliseconds.
- Editable project cues use `startTimeMs` / `endTimeMs`.
- Untimed phrases use `startTimeMs: null`.
- Export requires every phrase to have a start time.
- `startTimeMs` is the canonical editable phrase boundary.
- `endTimeMs` in exports is a derived contiguous boundary: phrase N ends at phrase N+1 `startTimeMs`.
- The final phrase ends at `durationMs` when available. If neither duration nor a valid explicit final `endTimeMs` is available, the exporter uses a short fallback duration so draft exports can still be inspected.
- Project JSON may still contain explicit `endTimeMs` for compatibility with imported or older data, but downstream systems should treat exported `endTimeMs` as the normalized boundary.

## Schemas

- Project JSON uses `lyric-timing-editor.project.v1`.
- Autosave uses `lyric-timing-editor.autosave.v1` in the `lyric-timing-editor` IndexedDB database.
- Music Effect timing export uses `music-effect.lyrics-timing.v2`.
- Older Music Effect prototype names are not preserved for new project/autosave data.

## Project Metadata

- `title` and `artist` are display metadata.
- `slug` is an optional editable file/downstream ID. It accepts lowercase ASCII letters, numbers, and hyphens only.
- `durationMs` is optional integer milliseconds. The UI should preview the value as `mm:ss.mmm`.
- `songUrl` is the source video or song URL.
- `songleUrl` is the Songle registration URL.
- `textAliveUrl` is an optional TextAlive reference URL.
- `songle` stores optional Songle reference metadata such as `id`, `artistId`, `url`, `permalink`, `code`, `createdAt`, `updatedAt`, and `recognizedAt`. Raw Songle `song.json` is not stored.
- Project Details should show short Japanese/English help for each field, with a detailed-help toggle available.

## Lyric Parser

The MVP edit unit is one lyric text line as one phrase.

Parser modes:

- `textalive`: leading `#` is a comment line, blank lines become section breaks, and leading `\#` escapes a hash lyric.
- `literal`: leading `#` is ordinary lyric text.

Phrase IDs are stable generated IDs such as `phrase-0001`. Source line numbers are kept so the editor can show where each phrase came from.

## UI Priorities

1. The current lyric phrase is the main display.
2. The next lyric phrase is visible beside it, like a next target.
3. Playback and timing controls are directly below the lyric display.
4. The sequence bar provides the timing map and selection/edit operations.
5. The phrase table gives a compact overview of nearby and selected phrases.

The visual identity should stay green-led, distinct from Songle's magenta and TextAlive's blue.

## Export Priorities

The first export targets are:

1. Music Effect v2 JSON, including timing-only and lyric-included variants.
2. WebVTT for general web/subtitle workflows.
3. LRC for synchronized lyric player workflows.

See `docs/export-formats.md` for the detailed export contract.

## Safety And Rights

- Timing-only export is recommended for public repositories.
- Lyric-included exports, WebVTT, and LRC require rights confirmation every time.
- Project save requires a lyric-rights reminder only once per browser session when lyric text is present.
- Songle direct metadata lookup must be triggered by an explicit user action and should show a Songle API terms notice.
- Imported Songle `song.json` is parsed as JSON only. The app should extract known fields, ignore unknown fields, reject oversized files, and never execute imported content.
