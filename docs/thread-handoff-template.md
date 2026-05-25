# Thread Handoff Template

Copy this into a new Codex thread or into `docs/handoff.md` when a task needs a clear handoff.

```text
You are working on Lyric Timing Editor.

Repository:
- Local: C:\Users\kawai\works\lyric-timing-editor
- GitHub: https://github.com/hiro-collab/lyric-timing-editor

Read first:
- README.md
- docs/handoff.md
- docs/codex-collaboration.md
- docs/design.md
- docs/export-formats.md
- docs/legal-and-safety.md

Coordination rules:
- Run `git status -sb` before editing.
- Do not overwrite or revert changes from another thread.
- Do not push unless the user explicitly asks.
- If the worktree is dirty, identify whether the dirty files belong to another thread before editing.
- Do not commit audio, real lyrics, lyric-included project files, or generated exports unless rights are confirmed.

Current assignment:
- Goal:
- Files likely in scope:
- Files to avoid:
- Known risks:
- Expected checks:
  - npm run typecheck
  - npm test
  - npm run build

When done:
- Summarize changed files.
- Report checks.
- Say whether you committed.
- Say whether push is still blocked or allowed.
```

