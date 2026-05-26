# Codex Thread Collaboration

This project can be worked on by multiple Codex threads. Keep the coordination lightweight until the work actually needs parallel branches or worktrees.

## Core Rules

- Check `git status -sb` before starting work.
- Read `docs/handoff.md` and the relevant spec document before editing.
- Do not overwrite or revert changes you did not make.
- Commit in small, reviewable units when a thread reaches a stable checkpoint.
- Do not push unless the user explicitly asks for it.
- Do not commit generated exports, audio files, real lyric files, or lyric-included project files unless rights have been confirmed.
- If another thread has uncommitted changes in files you need to edit, stop and coordinate before touching those files.

## Same Worktree Or Separate Worktree

Use the current checkout when:

- Only one thread is editing at a time.
- The next thread is doing review-only work.
- The work is limited to docs or narrow files that do not overlap.
- The user explicitly wants a simple handoff.

Create a separate Git worktree when:

- Two threads will edit at the same time.
- Two tasks both touch `src/main.ts`, `index.html`, export schema code, or shared docs.
- A thread needs risky or exploratory changes.
- A security review needs to test patches while feature work continues.

Recommended local layout:

```powershell
git worktree add _worktrees/security-review -b codex/security-review
git worktree add _worktrees/export-ui -b codex/export-ui
git worktree add _worktrees/songle-import -b codex/songle-import
```

The `_worktrees/` directory is local-only and should not be committed.

## Communication Contract

Use three handoff layers:

1. Git commit: stable checkpoint, exact file state.
2. `docs/handoff.md`: short current status and next-action notes.
3. `docs/thread-handoff-template.md`: copy/paste template for a new thread.

When a thread stops, leave enough information for the next thread to answer:

- What changed?
- Which files were touched?
- Which checks passed or failed?
- What should not be touched?
- Is push allowed, blocked, or pending review?

## Thread Start Checklist

Run or inspect:

```powershell
git status -sb
git log -3 --oneline
git remote -v
npm run typecheck
npm test
npm run build
```

For a review-only or security-only thread, the npm checks can be skipped until after the review target is understood.

Read:

- `README.md`
- `docs/local-development.md`
- `docs/handoff.md`
- `docs/design.md`
- `docs/export-formats.md`
- `docs/legal-and-safety.md`

## Thread End Checklist

Before stopping:

- Run the relevant checks, or state why they were not run.
- Update `docs/handoff.md` only if the next thread needs new coordination context.
- Commit only your intended files.
- Leave unrelated uncommitted changes untouched.
- Report whether the branch is clean, dirty, ahead, or pushed.

## Suggested Handoff Note

Use this short form in `docs/handoff.md` when a cross-thread handoff is needed:

```markdown
## Active Handoff - YYYY-MM-DD

- Owner/thread:
- Scope:
- Current branch/commit:
- Files intentionally touched:
- Files to avoid:
- Checks:
- Push status:
- Next request:
```

For longer notes, use `docs/thread-handoff-template.md`.
