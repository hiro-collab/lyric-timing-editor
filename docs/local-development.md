# Local Development And Laptop Migration

Use this guide when setting up the project on a new laptop or when confirming that a GitHub clone can support the same implementation workflow.

## Migration Readiness

- The GitHub remote is `https://github.com/hiro-collab/lyric-timing-editor.git`.
- The app is a static Vite and TypeScript browser app. It does not need a backend, database, cloud account, or environment variables for local development.
- The committed dependency lockfile is `package-lock.json`; use `npm ci` on a fresh clone for reproducible installs.
- The project targets Node.js 22 LTS for CI and GitHub Pages. Node.js 24 also satisfies the local engine range.
- Local-only folders such as `node_modules/`, `dist/`, and `_worktrees/` are ignored by Git.
- Local media, lyric files, project JSON, and lyric-included timing exports are ignored or treated as rights-sensitive working files. Do not use them as migration fixtures unless rights are confirmed.

## New Laptop Setup

Install these first:

- Git
- Node.js 22 LTS with npm 10 or newer
- A GitHub account with access to `hiro-collab/lyric-timing-editor`

Clone and install:

```powershell
git clone https://github.com/hiro-collab/lyric-timing-editor.git
cd lyric-timing-editor
npm ci
```

If you use a Node version manager, select the version from `.nvmrc` before installing:

```powershell
nvm install 22
nvm use 22
npm ci
```

Confirm the workspace:

```powershell
git status -sb
git remote -v
npm run check
```

`npm run check` runs TypeScript, unit tests, and the production build.

## Daily Development Workflow

Start the dev server:

```powershell
npm run dev
```

Open the local Vite URL printed in the terminal. The dev server binds to `127.0.0.1`.

Before moving work between PCs:

```powershell
git status -sb
npm run check
```

Then stage and commit only the intended source changes. Push only when the repository owner or current task has approved pushing:

```powershell
git add README.md docs/local-development.md
git commit -m "Describe the change"
git push
```

On the other laptop, update with:

```powershell
git pull --ff-only
npm ci
npm run check
```

Use `npm ci` after pulling changes to `package.json` or `package-lock.json`.

## Codex And Multi-PC Coordination

- Start each implementation session with `git status -sb`, `git log -3 --oneline`, and `git remote -v`.
- Read `README.md`, `docs/handoff.md`, and `docs/codex-collaboration.md` before editing.
- Keep work on one PC at a time unless you intentionally create separate branches or Git worktrees.
- Use branch names with the `codex/` prefix for Codex implementation work.
- If a worktree is dirty at session start, identify whether those changes belong to another thread or PC before editing the same files.
- Treat commits as the portable handoff point. Browser autosave, downloaded work project files, and local media are not transferred by Git.

## Rights-Sensitive Local Files

This repository intentionally avoids committing real audio, real lyric text, and lyric-included timing data. For smoke tests on a new laptop, use the built-in safe demo text instead of importing copyrighted lyrics.

Work Project JSON can include lyric text. Timing exports with lyric text, WebVTT, LRC, and lyric TXT files can also include copyrighted lyrics. Confirm rights before copying them between PCs, uploading them, or committing them.

## GitHub Pages

The deployment workflow is `.github/workflows/pages.yml`. It installs Node from `.nvmrc`, runs `npm ci`, `npm audit --audit-level=moderate`, `npm run typecheck`, `npm test`, and `npm run build`, then publishes `dist/`.

If Pages does not deploy after pushing to `main`, check the repository settings and confirm GitHub Pages is configured to use GitHub Actions.

## Troubleshooting

- `npm ci` reports an unsupported engine: switch to Node.js 22 LTS or Node.js 24.
- `npm ci` reports package lock mismatch: run `npm install` only on the PC intentionally updating dependencies, then commit both `package.json` and `package-lock.json`.
- The dev server port is busy: Vite will print the alternate local URL it selected.
- Git reports line-ending warnings on Windows: do not reformat unrelated files just to clear them; keep commits scoped to intentional content changes.
- Audio or lyric test files are missing after clone: this is expected. They are local working files and should not be committed unless rights and destination terms are confirmed.
