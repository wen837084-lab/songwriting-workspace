# Songwriting Workspace

Local-first songwriting project management built with Next.js App Router, TypeScript, Tailwind CSS, and browser localStorage.

PHASE 1 includes only workspace-level Song Project management and a minimal project page. Songwriting features begin in later phases.

## Commands

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm desktop:build
pnpm desktop:build:msi
pnpm desktop:build:windows
```

Open [http://localhost:3000](http://localhost:3000) after starting the development server.

`pnpm desktop:build` creates the unsigned release `.exe` and primary NSIS setup. `pnpm desktop:build:msi`
creates the optional MSI, while `pnpm desktop:build:windows` creates both installer formats. On Windows they use
`C:\Users\Public\SongwritingWorkspaceBuild` for native build output so WiX remains compatible when the
repository path contains Unicode characters.

Desktop storage behavior and the Web-to-Desktop migration decision are recorded in
[`docs/DESKTOP_STORAGE_VERIFICATION.md`](docs/DESKTOP_STORAGE_VERIFICATION.md).

Windows release artifacts, NSIS/MSI commands, lifecycle verification, and the deferred signing plan are recorded in
[`docs/DESKTOP_WINDOWS_PACKAGING.md`](docs/DESKTOP_WINDOWS_PACKAGING.md).

Desktop AI uses a remote HTTPS backend; API keys are never bundled into Tauri. Set
`NEXT_PUBLIC_AI_COACH_ENDPOINT` while running `pnpm desktop:build` to enable it. Without that
variable, the desktop app remains fully usable and AI Coach shows its offline fallback. Deployment,
CORS/CSP, rate-limit, timeout, and redacted-log requirements are recorded in
[`docs/DESKTOP_AI_ARCHITECTURE.md`](docs/DESKTOP_AI_ARCHITECTURE.md).
