# Pending Policy Questions

These decisions should be settled before presenting Lyric Timing Editor as a broadly reusable public project.

## License

- Which license should the standalone editor use: MIT, Apache-2.0, GPL-family, or no open-source license for now?
- Who should be listed as the copyright holder?
- Should generated timing JSON have any license guidance, or is it always user-owned data outside the code license?

## Security

- Should GitHub private vulnerability reporting be enabled for this repository?
- What contact path should be shown for vulnerability reports?
- Is the intended deployment only static GitHub Pages, or should any future hosted service be allowed?

## Privacy

- The repository includes `PRIVACY.md` for the current local-browser/no-upload model. Who should approve future privacy changes?
- Autosave uses browser IndexedDB and may contain pasted lyric text. The app exposes a visible Clear Draft action; should any additional browser storage be cleared if future preferences are added?
- Should analytics be explicitly prohibited unless a later privacy review approves them?

## Sample Data

- Should the repository include only synthetic text samples, or are public-domain / rights-cleared lyric samples acceptable after provenance is documented?
- Should sample audio remain absent, or should the app generate a local metronome / tone track in-browser for timing practice?
- Should exported sample JSON be committed if it contains only synthetic text and synthetic timing?

## Schema Compatibility

- Should project and autosave schema names move from the original Music Effect prototype names to editor-owned names?
- Should the timing export schema stay `music-effect.lyrics-timing.v2` for downstream compatibility, or get a new editor-owned schema plus migration support?
