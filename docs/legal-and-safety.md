# Legal And Safety Notes

Lyric Timing Editor is a local, file-based editor. It is not a replacement for TextAlive or Songle, and it does not grant rights to use lyrics, audio, videos, or Songle/TextAlive data.

## Local Processing

- Audio files are used only for browser playback.
- Audio binaries are not uploaded, bundled, analyzed, saved into Project JSON, or included in exports.
- Lyric text may be present in pasted source text, Project JSON, lyric-included exports, WebVTT, LRC, and local IndexedDB autosave.
- Timing-only Music Effect v2 export omits lyric text.

## Rights-Sensitive Files

Do not publish, distribute, upload, or commit the following unless rights and destination terms are confirmed:

- real audio files
- real lyric text files
- Project JSON containing copyrighted lyrics
- Music Effect v2 exports with `includesLyrics: true`
- WebVTT and LRC exports containing lyric text
- any derived file that reconstructs or republishes lyric text

Timing-only exports are safer for public repositories, but users should still confirm rights before combining timing data with lyric text or publishing related files.

## Songle

Songle metadata is optional. The editor can work without Songle.

When Songle support is used:

- Manual `song.json` import reads a local JSON file and extracts only known metadata fields.
- Direct metadata lookup, if enabled, must run only after the user presses a button.
- Direct lookup sends the entered Songle URL or source song URL to the Songle Widget API.
- The UI should link to the Songle API / Widget terms before direct lookup.
- Raw Songle `song.json` is not stored in Project JSON. Only selected reference metadata is stored.

Security rules for Songle JSON:

- Parse with `JSON.parse`.
- Never use `eval`, dynamic import, or HTML injection.
- Enforce a small file-size limit.
- Accept only expected field types.
- Store and display strings via input values or `textContent`, not `innerHTML`.
- Accept only `http:` and `https:` URLs for project metadata.

References:

- Songle Widget API: https://widget.songle.jp/docs/v1
- Songle API terms: https://api.songle.jp/terms_of_use.pdf

## TextAlive

TextAlive is a powerful lyric animation and timing environment. Lyric Timing Editor focuses on a narrower workflow: local phrase-level timing review, manual correction, and file export without uploading audio or lyrics.

The editor may use TextAlive-like concepts such as phrase/word/character timing in future formats, but it should not imply that TextAlive terms, permissions, or generated data are bypassed.

Reference:

- TextAlive App API terms: https://developer.textalive.jp/terms/

## GitHub Pages

GitHub Pages distribution should be treated as a static local-browser tool:

- No backend upload path.
- No analytics unless a future privacy review explicitly approves them.
- No sample audio, real lyric text, or real-song lyric-included timing data in the public repository.
- Synthetic demo text is acceptable when it is written for this editor and does not copy a real song.

## Local Data

Autosave uses browser IndexedDB and may contain lyric text. The app should expose a visible control to clear this browser's local draft data, and Help/Privacy text should explain what is stored.
