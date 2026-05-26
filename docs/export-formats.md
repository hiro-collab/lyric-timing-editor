# Export Formats

This document is the working contract for Lyric Timing Editor export files. It is intended to let downstream tools, especially Music Effect, start implementation before every UI detail is finished.

Status: draft target specification, 2026-05-25.

## Common Rules

- All exported text files use UTF-8 without BOM by default.
- Export files are treated as completed timing outputs. If any phrase has no start time, export is blocked.
- Incomplete work should be saved as a Lyric Timing Editor Project JSON instead.
- The editor may offer an explicit "fill unmarked phrases" edit action before export. That action updates the project and can be undone with Undo or Ctrl+Z.
- Exported notes are omitted. Working notes stay in Project JSON only.
- Real lyric text, audio files, and real-song lyric-included exports should not be committed or published without rights confirmation.
- Phrase ranges are contiguous. For phrase N, exported `endTimeMs` is normally phrase N+1 `startTimeMs`; the last phrase ends at `durationMs` when available.

## Music Effect v2 JSON

Music Effect v2 JSON is the primary machine-readable export for Music Effect / song-visual-effect.

```json
{
  "schema": "music-effect.lyrics-timing.v2",
  "slug": "igaku",
  "title": "Song Title",
  "artist": "Artist Name",
  "durationMs": 120340,
  "generatedAt": "2026-05-25T00:00:00.000Z",
  "sourceProjectSchema": "lyric-timing-editor.project.v1",
  "timeUnit": "ms",
  "includesLyrics": false,
  "rightsNotice": "This timing-only export does not include lyric text. Confirm rights before combining it with lyric text or publishing related files.",
  "songle": {
    "id": 2731526,
    "artistId": 325431,
    "url": "https://songle.jp/songs/www.nicovideo.jp%2Fwatch%2Fsm43436193",
    "permalink": "http://www.nicovideo.jp/watch/sm43436193",
    "code": "a415a786d",
    "createdAt": "2024-02-23T01:51:19+09:00",
    "updatedAt": "2025-06-09T16:44:16+09:00",
    "recognizedAt": "2024-02-23T08:50:29+09:00"
  },
  "phrases": [
    {
      "id": "phrase-0001",
      "index": 0,
      "startTimeMs": 1000,
      "endTimeMs": 4000,
      "sourceLine": 2
    }
  ]
}
```

### Fields

- `schema`: Always `music-effect.lyrics-timing.v2`.
- `slug`: Optional file/project ID. Use lowercase ASCII letters, numbers, and hyphens only, for example `igaku` or `shining-star`.
- `title`: Display song title.
- `artist`: Display artist name.
- `durationMs`: Song duration in integer milliseconds, or `null` if unknown.
- `generatedAt`: ISO 8601 export timestamp.
- `sourceProjectSchema`: Expected to be `lyric-timing-editor.project.v1`.
- `timeUnit`: Always `ms`.
- `includesLyrics`: `false` for timing-only export, `true` for lyric-included export.
- `rightsNotice`: Human-readable rights notice. The text differs for timing-only and lyric-included exports.
- `songle`: Optional Songle reference metadata. It may be omitted or `null`; downstream tools must not require it.
- `phrases`: Phrase timing array in lyric order.

### Phrase Fields

- `id`: Stable phrase ID from the editor, such as `phrase-0001`.
- `index`: Zero-based phrase index.
- `startTimeMs`: Required integer start time in milliseconds.
- `endTimeMs`: Required integer end time in milliseconds. It is derived by the exporter from the next phrase `startTimeMs`; for the final phrase it uses `durationMs` when available.
- `sourceLine`: Source text line number used to create the phrase.
- `text`: Included only when `includesLyrics` is `true`.
- `displayMode`: Optional. `blank` means the phrase is an intentional no-lyric display range, such as an intro, interlude, or outro.

### Timing-Only Export

Timing-only export omits lyric text:

```json
{
  "includesLyrics": false,
  "phrases": [
    {
      "id": "phrase-0001",
      "index": 0,
      "startTimeMs": 1000,
      "endTimeMs": 4000,
      "sourceLine": 2
    }
  ]
}
```

Downstream systems should join timing-only phrases with their own lyric lines by `index` or lyric order. This is the recommended format for public repositories when lyric rights are not confirmed.

"Timing-only" means lyric text is omitted. It does not mean timings are optional; every exported phrase still needs `startTimeMs` and `endTimeMs`. Save unfinished work as Project JSON, or use the editor's explicit fill action to create temporary evenly spaced timings before export.

### With-Lyrics Export

Lyric-included export includes phrase text:

```json
{
  "includesLyrics": true,
  "phrases": [
    {
      "id": "phrase-0001",
      "index": 0,
      "startTimeMs": 1000,
      "endTimeMs": 4000,
      "sourceLine": 2,
      "text": "Lyric line"
    }
  ]
}
```

This export requires lyric rights confirmation before publishing, distributing, uploading, or committing.

### Music Effect Import Notes

Music Effect currently uses seconds internally for `LyricCue`. A v2 importer should:

- Keep existing `music-effect.lyrics-timing.v1` support as legacy.
- Convert `startTimeMs` and `endTimeMs` to seconds when normalizing to internal cues.
- Treat phrase ranges as contiguous boundaries: phrase N `endTimeMs` should equal phrase N+1 `startTimeMs` in v2 exports.
- Use `phrases[].text` when `includesLyrics` is `true`.
- Join with song-pack lyric lines when `includesLyrics` is `false`.
- Treat `slug`, `songle`, and `sourceLine` as optional metadata for validation, diagnostics, or matching.
- Warn, but do not crash, when optional metadata is missing.
- Avoid depending on Lyric Timing Editor Project JSON.

## WebVTT

WebVTT export is for general web video and subtitle workflows.

Example:

```vtt
WEBVTT

NOTE
Generated by Lyric Timing Editor

phrase-0001
00:01.000 --> 00:04.000
Lyric line
```

Rules:

- WebVTT export requires lyric text and therefore shows rights confirmation every time.
- Cue identifiers are included and use the phrase ID.
- Cue start and end times are exported from the current timing data without adding or subtracting 1 ms.
- Cue text follows WebVTT text rules. Newlines may be preserved inside cue text.
- Markup escaping is user-configurable. The safe default escapes WebVTT-sensitive characters such as `&`, `<`, and `>`.
- Default file name: `<slug>.lyrics.vtt`, or `lyric-timing-editor.lyrics.vtt` when `slug` is empty.

## LRC

LRC export is for synchronized lyric player workflows.

Example:

```lrc
[ti:Song Title]
[ar:Artist Name]
[length:02:00.34]

[00:01.00]Lyric line
```

Rules:

- LRC export requires lyric text and therefore shows rights confirmation every time.
- Standard LRC timestamps use `[mm:ss.xx]` with 10 ms precision.
- Title, artist, and length tags are emitted only when values are available.
- If multiple phrases round to the same timestamp, keep separate lines in phrase order.
- LRC is line-oriented. Newlines inside a phrase are converted to spaces.
- Text normalization is user-configurable. The default keeps text close to the source while preserving valid one-line LRC output.
- Default file name: `<slug>.lyrics.lrc`, or `lyric-timing-editor.lyrics.lrc` when `slug` is empty.

## Planned Later Formats

These formats are useful, but are not first-pass targets:

- TextAlive-like JSON: phrase/word/character hierarchy with `startTime` and `endTime` in milliseconds.
- CSV or TSV: spreadsheet-friendly review and conversion format.
- SRT: broad subtitle-tool compatibility.
- Enhanced LRC: future option if word-level timing is added.
