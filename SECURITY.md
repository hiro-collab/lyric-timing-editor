# Security Policy

## Supported Scope

Lyric Timing Editor is intended to be a static, local-browser tool. The current supported deployment model has no backend API, no server-side storage, no analytics, and no intentional external network requests.

Security-sensitive project boundaries:

- Audio files must stay local to the browser session and must not be saved into Project JSON or exports.
- Lyric text may be stored in Project JSON, lyric-included exports, WebVTT, LRC, and this browser's IndexedDB autosave draft.
- Project JSON and autosave data are untrusted input and must be size-limited, parsed as JSON, and normalized before use.
- Future network features require a separate privacy and security review before they are enabled.

## Reporting Vulnerabilities

If GitHub private vulnerability reporting is enabled for this repository, use it for sensitive reports. Otherwise, open a GitHub issue with a high-level description only and do not include secrets, copyrighted lyrics, private files, or exploit payloads that expose user data.

## Maintainer Checklist

- Keep `npm audit --audit-level=moderate`, typecheck, tests, and build passing in CI.
- Keep Dependabot enabled for npm and GitHub Actions updates.
- Do not commit `.env*`, local media files, lyric files, Project JSON containing lyrics, or lyric-included exports without an explicit rights and security review.
- Keep development and production deployments static unless a future review approves a backend.
