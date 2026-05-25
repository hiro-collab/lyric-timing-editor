# Temporary Handoff Notes

This file is a short-lived handoff note for opening a fresh Codex thread on this standalone project. It can be reorganized later.

## Repository

- GitHub: `https://github.com/hiro-collab/lyric-timing-editor.git`
- Local path used for extraction: `C:\Users\kawai\works\lyric-timing-editor`
- Initial source: Music Effect branch `codex/lyric-timing-workbench`

## Current Commands

```powershell
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

## Public Repository Caution

Do not commit:

- audio files
- real lyric text files unless rights are confirmed
- editor project JSON containing copyrighted lyrics
- export JSON containing lyric text unless rights are confirmed

The repository currently has no explicit open-source license. Treat that as a pending decision before broader public reuse.

## GitHub Pages

The repository includes `.github/workflows/pages.yml`.

After pushing to GitHub, the repository may still need GitHub Pages configured to use GitHub Actions in repository settings.

## Next Likely Tasks

- Decide license.
- Confirm GitHub Pages deployment.
- Add schema documentation and maybe JSON Schema files.
- Add browser-level regression tests for layout and autosave.
- Add UI/help/docs synchronization tests for Project Details metadata field descriptions.
- Implement Project schema/storage rename:
  - Project JSON: `lyric-timing-editor.project.v1`
  - Autosave: `lyric-timing-editor.autosave.v1`
  - Export JSON: keep `music-effect.lyrics-timing.v2`
- Implement optional `slug` and `songle` metadata in Project and Music Effect v2 export.
- Implement Music Effect v2, WebVTT, and LRC exports as described in `docs/export-formats.md`.
- Implement Songle `song.json` import and explicit Songle metadata lookup with URL/file validation.
- Implement unmarked phrase autofill from the Validation panel.
- Add local draft deletion UI and privacy/help text.

See `docs/policy-questions.md` for the current decision checklist.
See `docs/export-formats.md` for the current export contract.
See `docs/legal-and-safety.md` for rights and local-data safety notes.
