# Vetour Development Guide

Practical reference for building, verifying, and troubleshooting Vetour.
Product context lives in `docs/PRD.md`; structural rules live in
`docs/ARCHITECTURE.md` and `AGENTS.md`.

## 1. Prerequisites

- **Bun** 1.x (mandatory package manager — never npm/yarn/pnpm).
- **Rust** 1.85+ via [rustup](https://rustup.rs/).
- Tauri 2 system dependencies for your OS (see the
  [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)).

## 2. Setup

```bash
git clone https://github.com/fazelstudio/vetour.git
cd vetour
bun install
```

The `postinstall` hook downloads a local FFmpeg copy for development only
via `scripts/download-sidecar.ts`. It is not bundled into the installer;
end users install FFmpeg on demand from Settings.

## 3. Running the App

```bash
bun run dev          # Vite dev server only (browser preview)
bun run tauri dev    # full desktop app with hot-reload (port 1420)
```

The desktop window opens automatically once the Vite dev server is ready.
The main window starts hidden and reveals itself after the first themed
frame is painted.

## 4. Verification

Run these before submitting any change:

```bash
bun run check        # TypeScript type checking (app + vetour-sdk)
bun run lint         # ESLint over the frontend
bun run sdk:test     # Headless SDK functional tests (40+ assertions)
```

For Rust changes, from `src-tauri/`:

```bash
cargo fmt --check
cargo clippy
```

Manual checks worth doing for user-facing changes:

1. Create, edit, save, reopen a `.vetour` project.
2. Exercise every hotspot action in both Edit preview and Present mode.
3. Open the Present window while fully offline.

## 5. Scripts

| Command                    | Purpose                                            |
|----------------------------|----------------------------------------------------|
| `bun run dev`              | Start the Vite dev server only                     |
| `bun run build`            | Type-check and build the frontend (`tsc && vite build`) |
| `bun run check`            | Type-check without emitting output                 |
| `bun run lint`             | Lint all frontend sources                          |
| `bun run preview`          | Preview the production frontend build              |
| `bun run tauri dev`        | Run the desktop app in development mode            |
| `bun run tauri build`      | Build distributable packages                       |
| `bun run sidecar:download` | Re-download the local development FFmpeg binary    |
| `bun run sdk:test`         | Run the headless SDK functional tests              |

Build configuration: app identifier `com.fazli.vetour`, `.vetour` file
association, frontend served from the dev server on port 1420 in
development (see `src-tauri/tauri.conf.json` and `vite.config.ts`).

## 6. Project Conventions

- TypeScript strict mode; prefer `unknown` and type guards over `any`.
- State mutations go through the store and the typed command registry
  (`src/commands`); components never mutate project data directly.
- Colors come from `src/index.css` CSS variables; reusable values come
  from `src/constants.ts`; shared UI comes from `src/components/ui`.
- Every source file carries the license header; comments follow
  `AGENTS.md` section 4 (English, `//` single-line, `/* ... */`
  multi-line, `/** ... */` documentation, `{/* ... */}` in JSX).
- Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `style:`,
  `chore:`), present tense, first line under 72 characters.

## 7. Troubleshooting

- **Port 1420 busy:** `bun run tauri dev` requires the fixed dev port;
  stop the conflicting process instead of changing the port.
- **FFmpeg missing in dev:** run `bun run sidecar:download`; in the built
  app, install it from Settings > Media Optimization.
- **Present window shows stale data:** check the Rust present-data channel
  (`store_present_data` / `get_present_data`) and the
  `sync-present-data` event wiring in `presentWindow.ts`.
- **`.vetour` fails to open:** the loader reports corruption causes
  (truncated sections, gzip/JSON failures); validate the file layout
  against `docs/FILE-FORMAT.md` before changing the reader.
- **Theme flash on startup:** the pre-paint script in `index.html`,
  `ThemeContext` (backed by `src/lib/theme.ts`), and `src/index.css` must
  stay in sync (storage key, resolved values, background hexes).
