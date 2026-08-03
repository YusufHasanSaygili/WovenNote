# Contributing to WovenNote

Thanks for helping improve WovenNote.

## Before opening a pull request

1. Open an issue for substantial features or architectural changes.
2. Keep each pull request focused on one problem.
3. Do not commit API keys, local databases, backups, logs, user media, or generated installers.
4. Add or update tests for behavior changes.
5. Run the full verification suite:

```powershell
npm ci
npm run format:check
npm run lint
npm run type-check
npm test
npm run build
```

For UI or packaged-app changes, also run `npm run test:smoke` where supported.

## Code expectations

- Keep TypeScript strict and avoid unnecessary `any` values.
- Preserve the Electron security boundary: the renderer must not access Node.js, the filesystem, SQLite, or raw IPC directly.
- Validate new IPC inputs and outputs and keep the preload API narrow.
- Never make real paid OpenAI requests in automated tests; use a fake transport.
- Keep user-facing errors clear and never expose raw stack traces or secrets.

By contributing, you agree that your contribution will be licensed under the MIT License.
