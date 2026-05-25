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

## Timing Model

- The canonical time unit is integer milliseconds.
- Editable project cues use `startTimeMs` / `endTimeMs`.
- Untimed phrases use `startTimeMs: null`.
- Export requires every phrase to have a start time.
- Missing end times are derived from the next phrase start time, or from project duration for the last phrase.

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
