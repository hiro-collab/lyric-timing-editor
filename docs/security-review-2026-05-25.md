# Security Review Record - 2026-05-25

This note records the security review work for Lyric Timing Editor so stakeholders can confirm whether the current posture is acceptable before publishing or broad reuse.

## Review Target

- Repository: `C:\Users\kawai\works\lyric-timing-editor`
- Current intended deployment: static GitHub Pages / local-browser tool
- Backend/API: none
- External network requests in app code: none found
- Secrets in app code: none found
- Data handled locally: audio files, lyric text, Project JSON, lyric-included exports, WebVTT, LRC, IndexedDB autosave drafts

## Reference Concerns Covered

The review was based on the security-oriented concerns in the shared article:

- Do not hard-code secrets or API keys.
- Treat all input, including local files and imported JSON, as untrusted.
- Do not expose internal/raw error messages to users.
- Do not use unsafe HTML injection for user-controlled text.
- Keep dependencies pinned and checked.
- Separate local/private working data from public repository artifacts.
- Make local data storage and deletion clear to users.
- Keep future network features behind a separate review.

## Findings Before Fixes

- Static architecture was already favorable: no backend, no auth/authorization surface, no cloud storage, no server-side secret handling.
- File inputs were too trusting: lyric text, audio files, and Project JSON did not have explicit size/type gates.
- Project JSON was parsed and cast as `LyricTimingProject` without runtime normalization.
- Autosave restored local IndexedDB data without the same normalization boundary as imported files.
- One helper used `innerHTML`, which should be avoided even if current values are numeric.
- Playback/autosave error messages could surface browser error details.
- Dependency monitoring existed through the lockfile, but CI did not run `npm audit` and Dependabot was not configured.
- Local autosave deletion was only available when the draft banner appeared, not as a persistent visible control.

## Implemented Mitigations

- Added runtime normalization for imported Project JSON and autosave drafts.
- Added size/type gates for lyric files, Project JSON files, and audio files.
- Added phrase/source size limits to reduce browser resource exhaustion risk.
- Normalized metadata fields, URL fields, slug values, timestamps, Songle references, and audio references.
- Removed `innerHTML` usage from the project view helper.
- Replaced raw playback/autosave error details with generic user-facing messages.
- Added a visible Clear Draft action for this browser's IndexedDB autosave draft.
- Added static page CSP and `referrer` meta policy in `index.html`.
- Added `.env*` to `.gitignore`.
- Added `SECURITY.md` and `PRIVACY.md`.
- Added `npm audit --audit-level=moderate` to the GitHub Pages workflow.
- Added Dependabot configuration for npm and GitHub Actions.
- Added tests for unsafe Project JSON normalization and rejection.

## Verification Performed

All checks passed after the security changes:

```powershell
npm run typecheck
npm test
npm run build
npm audit --audit-level=moderate
```

Result summary:

- TypeScript typecheck: passed
- Node tests: passed, 7 tests
- Vite production build: passed
- npm audit: passed, 0 vulnerabilities at `moderate` level or above

## Stakeholder Confirmation Needed

Before release or broad sharing, confirm these decisions:

- Is the current static-only/no-backend/no-analytics model approved?
- Is GitHub Pages the only approved deployment target for now?
- Should GitHub private vulnerability reporting be enabled, and who receives reports?
- Is the text in `SECURITY.md` and `PRIVACY.md` acceptable for external readers?
- Are the local file size limits acceptable for expected real usage?
- Are Project JSON and lyric-included exports allowed to remain user-managed files, with rights warnings instead of technical blocking?
- Should hosting add response security headers equivalent to or stricter than the meta CSP if deployed outside GitHub Pages?
- Are Dependabot PRs and `npm audit --audit-level=moderate` acceptable as the minimum dependency monitoring policy?
- Are future Songle/TextAlive lookup features blocked until a separate privacy/security review approves the exact request flow?

## Residual Risks

- Browser-local processing does not protect users from importing maliciously huge files beyond the configured limits; limits should be adjusted if real workflows need larger data.
- Meta CSP is useful for a static file but weaker than response headers. A host with configurable headers should set headers at the platform level.
- GitHub Pages availability and repository visibility are operational settings, not enforced in code.
- Local IndexedDB data can contain lyric text. Users must use Clear Draft or browser storage controls to remove it.
- Lyric rights compliance is not technically enforceable by this app. The app warns and documents the risk, but publication decisions remain a user/process responsibility.
- Any future external service lookup, analytics, auth, storage, or backend API changes the threat model and needs a new review.

## Suggested Approval Record

Use this checklist in the review meeting:

```markdown
## Security Review Approval - 2026-05-25

- Reviewers:
- Approved deployment target:
- Vulnerability report contact/path:
- Privacy text approved: yes/no
- Security policy approved: yes/no
- Dependency monitoring approved: yes/no
- Remaining blockers:
- Release/push allowed: yes/no
```
