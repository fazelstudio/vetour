# AGENTS.md — Working Rules for AI Agents in the Obsipano Project

This file is mandatory guidance for every AI agent working in this repository.
Follow all rules below in order. Never make assumptions on high-impact
architecture decisions — stop and ask the developer instead.

## 1. Project Overview

**Obsipano** is a cross-platform desktop application for creating and
presenting immersive 360° virtual tours.

| Layer            | Technology                                                              |
|------------------|-------------------------------------------------------------------------|
| Desktop shell    | Tauri 2 (Rust)                                                          |
| Frontend         | React 19, TypeScript (strict), Vite                                     |
| Styling          | Tailwind CSS 4, Radix UI, Framer Motion                                 |
| State            | Zustand                                                                 |
| Panorama         | Photo Sphere Viewer (core, markers-plugin, virtual-tour-plugin)         |
| Package manager  | **Bun** (mandatory — never use npm/yarn/pnpm)                           |

Usage modes: **Edit** (authoring tours, offline), **Present** (fullscreen
showcase, offline), and **Publish** (future plan — see `docs/PRD.md`).
Do not confuse Obsipano with **Fazel Studio**, which is the developer's
separately hosted website.

## 2. Allowed Commands

All package-manager commands must use Bun:

```bash
bun install          # install dependencies
bun run dev          # Vite dev server only
bun run tauri dev    # full desktop app (hot-reload, port 1420)
bun run check        # type checking (tsc --noEmit)
bun run lint         # ESLint
bun run build        # production frontend build
bun run tauri build  # distributable package
```

Rust rules:

- Format with `rustfmt`, check with `cargo clippy` before submitting.
- Never change Tauri command IDs or the `.obsipano` file format without an
  explicit migration (see `docs/ARCHITECTURE.md` and `docs/FILE-FORMAT.md`).

## 3. External Library Documentation (Context7)

Before writing code that involves an external package — Photo Sphere Viewer
and its plugins, Tauri API, Radix UI, Tailwind, Zustand, or Rust crates —
fetch the latest documentation via Context7 first. Never rely solely on the
model's built-in knowledge, since package versions may have changed
significantly. This applies every time you work with such a library's API,
not just once.

## 4. Comment Standards (Mandatory)

All code comments must be written in clear, easy-to-understand **English**:
capital letter at the start of each sentence, period at the end.

### 4.1 File header

Every file that supports comments must start with the following header
(adjust `FileName.ext` and its short description):

```ts
/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  FileName.ext
 *  Short description of the file in English.
 *-----------------------------------------------------------------------------------------------*/
```

Per-language variants:

- TOML (`Cargo.toml`): same shape with a `#` prefix instead of `*`.
- HTML (`index.html`): same shape inside `<!-- ... -->`.
- JSON (`tauri.conf.json`, `capabilities/*.json`): **no header**,
  because JSON does not support comments.

### 4.2 Single-line comments

Use `//` (or `///` for Rust doc-comments):

```ts
// Suppress the browser default context menu everywhere.
```

```rust
/// Returns (local file name, release asset name) for the current platform.
```

### 4.3 Multi-line comments

Use a `/* ... */` block without a `*` prefix on each line:

```
/*
First line of the explanation.
Second line of the explanation.
*/
```

### 4.4 Documentation comments

Use a `/** ... */` block:

```
/**
The public command contract.
Extensions can augment this interface through TypeScript module augmentation.
*/
```

### 4.5 JSX comments

Inside JSX/TSX markup, the `{/* ... */}` wrapper is mandatory due to
syntax — not a style choice. Its content still follows the English rules:

```tsx
{/* Left: preview and scene cards. */}
```

### 4.6 Prohibitions

- No comments in any language other than English.
- No informal first-person comments (`User said...`, `I'll...`).
- No stacking many `//` lines for one long explanation — use a
  `/* ... */` block instead.
- Never delete a legitimate `// eslint-disable-next-line ...` just to
  silence lint; if the line is a valid exception, leave it as is.
- Never rewrite comments in bulk with a script/sed. Edit files one by one
  with the edit tool to avoid mistakes.

## 5. Architecture Constraints

Intended dependency direction:

```text
components -> commands -> store/domain logic -> lib/platform adapters
components -> types/constants
```

- Project data mutations belong to the **store** (`src/store`) and are
  exposed to the UI and extensions through **commands** (`src/commands`).
  New UI code must not call Zustand mutation methods directly — register a
  new command in `CommandMap` (`commandRegistry.ts`), then register it in
  `registerCoreCommands.ts`.
- Native integrations (file dialogs, windows, file watching, FFmpeg,
  `.obsipano` serialization) belong in `src/lib`. Never put platform logic
  in components.
- Persisted data contracts belong in `src/types`. Never put runtime
  behavior in types files.
- Reusable values belong in `src/constants.ts`; colors belong in
  `src/index.css` (CSS variables). Never hardcode duplicated colors or
  values in components.
- Modals, grid cards, buttons, inputs, context menus: use the reusable
  components in `src/components/ui`. Never rebuild the same visual
  structure at each call site.

Reference documents: `docs/ARCHITECTURE.md`, `docs/EXTENSIONS.md`,
`docs/FILE-FORMAT.md`, `docs/PRD.md`, `docs/DEVELOPMENT.md`.

## 6. Mandatory Workflow

1. **Read before changing.** Inspect the relevant files directly before
   producing output. Never claim something is verified without evidence.
2. **One task at a time.** Track progress clearly; finish verification
   before moving on.
3. **Minimal, targeted edits.** Prefer editing existing files over creating
   new ones. Never create new documentation files unless asked.
4. **Handle comments one by one**, never via bulk scripts (see 4.6).
5. **Verify every solution** by execution whenever possible:
   `bun run check` and `bun run lint` for frontend changes;
   `cargo clippy` for Rust changes. Report the results, including any
   finding that overturns an earlier interpretation.
6. **Protect public formats and IDs.** Changes to the `.obsipano` format or
   extension command IDs must include migration/compatibility handling.
7. **Never auto-save/commit/push** unless the user explicitly asks.
   The user controls when to save and commit.

## 7. Communication Language

- Code, comments, and technical documents: **English**.
- Conversation with the user: follow the user's language (usually Indonesian).
- Stay objective and evidence-based; politely correct the user when their
  belief conflicts with findings in the codebase.
