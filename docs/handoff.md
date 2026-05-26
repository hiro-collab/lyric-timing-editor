# Temporary Handoff Notes

This file is a short-lived handoff note for opening a fresh Codex thread on this standalone project. It can be reorganized later.

For cross-thread coordination, see `docs/codex-collaboration.md`.
For a copy/paste starter prompt, see `docs/thread-handoff-template.md`.
For the current security review record, see `docs/security-review-2026-05-25.md`.

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

## Codex Thread Coordination

- Use the same worktree for sequential review or narrow docs-only work.
- Use a separate Git worktree for parallel implementation, overlapping file ownership, or risky exploratory changes.
- Keep `_worktrees/` local-only.
- Treat commits as stable handoff points.
- Do not push unless the user explicitly asks.
- If the worktree is dirty at thread start, identify whether the changes belong to another thread before editing.
- Current security review work can stay in this worktree because it is not expected to run in parallel with feature implementation.

## Music Effect Installer Coordination

Observed on 2026-05-27: a browser download such as `monitoring.lyric-timing-editor.work-project (4).json` can be selected in Music Effect's Lyrics Data Installer timing JSON field. The immediate failure is not the `(4)` suffix itself; it is that Work Project JSON uses `schema: "lyric-timing-editor.project.v1"` while the installer expects `schema: "music-effect.lyrics-timing.v2"`.

Lyric Timing Editor side mitigation:

- UI labels should say Work Project for editor save/load.
- Save status and README should remind users to use `Export` -> `Music Effect v2` for Music Effect.
- Music Effect v2 export should continue to prefer `slug` for stable filenames; Chrome's `(1)` download suffix should not matter when `slug` is present.

Recommended Music Effect side mitigation:

- Detect `schema: "lyric-timing-editor.project.v1"` on both client-side file selection and server-side install, then show a friendly message: this is a Work Project JSON; choose `Export` -> `Music Effect v2` in Lyric Timing Editor.
- On timing file input change, clear or mark the previous valid timing state as checking before async `file.text()` finishes, so a stale valid file cannot be submitted while a new invalid file is still being inspected.
- If a valid v2 export has no `slug` and the selected filename contains a browser duplicate suffix like ` (1)`, consider warning that the inferred install filename may be unstable and recommend entering the installer save name explicitly.

This is a compatible workflow/UI hardening item, not an export schema change.

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
