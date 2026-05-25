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
- Add security/privacy notes.
- Confirm GitHub Pages deployment.
- Decide whether schema/storage keys should remain compatible with the original Music Effect prototype names or move to new editor-owned names.
- Add schema documentation and maybe JSON Schema files.
- Add browser-level regression tests for layout and autosave.
