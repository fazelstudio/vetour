<div align="center">
  <img src="src-tauri/icons/icon.png" alt="Vetour" width="80" height="80" />
  <h1>Vetour</h1>
  <p><strong>Virtual Tour Creator — Desktop App</strong></p>
  <p>
    <a href="#features">Features</a> •
    <a href="#prerequisites">Prerequisites</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#building">Building</a> •
    <a href="#project-structure">Structure</a> •
    <a href="#contributing">Contributing</a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
    <img src="https://img.shields.io/badge/React-19-61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Tauri-2-FFC131" alt="Tauri" />
    <img src="https://img.shields.io/badge/Rust-1.85+-DEA584" alt="Rust" />
  </p>
</div>

---

**Vetour** is a cross-platform desktop application for creating, editing, and presenting immersive 360° virtual tours. Built with [Tauri 2](https://v2.tauri.app/), [React 19](https://react.dev/), and [Photo Sphere Viewer](https://photo-sphere-viewer.js.org/), it offers a smooth, native experience for crafting interactive walkthroughs from panoramic images.

## Features

- **360° Panorama Viewer** — Full-screen panorama exploration with smooth navigation.
- **Hotspots & Links** — Add clickable info markers and navigation links between scenes.
- **Interactive Markers** — Rich hotspot actions: show images, videos, text, or play audio.
- **Virtual Tour Mode** — Seamlessly connect scenes into a guided walkthrough.
- **Asset Manager** — Import and manage images, audio, video, and documents.
- **Present Mode** — Separate full-screen presentation window with a clean interface.
- **Project File (.vetour)** — Save and load projects in a custom file format with compression.
- **Multi-Resolution Processing** — Automatic panorama resizing (low, medium, high) to WebP.
- **Media Conversion** — Automatic audio/video conversion for optimized playback.
- **File Locking** — Safe concurrent access to project files across windows.
- **Drag & Drop Hotspots** — Reposition markers by dragging in the viewer.
- **Theme Support** — Light, dark, and black themes.
- **Command Architecture** — Every editor action runs through a typed
  command registry consumed by the UI and by extensions.
- **Extension SDK** — Namespaced `vetour-sdk` API (`commands`, `window`,
  `workspace`, `tour`, `present`, `media`, `extensions`) with contribution
  points (menus, panels, hotspot/document renderers, validation rules).
- **Official Plugin Files (.veix)** — Versioned, validated plugin packages;
  only official publisher files pass the installer gate.
- **Project Diagnostics** — Detect missing panoramas, broken links, duplicate
  scene IDs, and unreachable scenes.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Bun** 1.x (mandatory package manager — never npm/yarn/pnpm)
- **Rust** 1.85+ (via [rustup](https://rustup.rs/))
- **System dependencies** for [Tauri 2](https://v2.tauri.app/start/prerequisites/)

## Getting Started

```bash
# Clone the repository
git clone https://github.com/fazelstudio/vetour.git
cd vetour

# Install JavaScript dependencies (downloads a local FFmpeg copy for development only)
bun install

# Run the app in development mode
bun run tauri dev
```

The app will launch with hot-reload enabled. The Tauri window will open automatically once the Vite dev server is ready on port 1420.

### Media Optimization (FFmpeg)

The installer ships **without** FFmpeg to keep downloads small. Users can install it on demand:

1. Open **Settings > Media Optimization**.
2. Select **Download FFmpeg** (one-time download, about 25–80 MB depending on the system) or **Use local file…** to reuse an FFmpeg binary already on your device (any file name works; it is validated and copied automatically).
3. The exact download package for your system is shown upfront (Windows x64/ARM64, macOS Intel, Linux x64/ARM64). Platforms without a published binary yet show a clear notice instead — macOS ARM users should use a local file for now.
4. Progress is shown in Settings. If the connection drops, select Download again to resume.
5. It can be removed at any time from the same screen. Without it, original audio/video files are used as-is.

For development, `bun install` downloads a local FFmpeg copy via the `postinstall` hook (not bundled into the installer). Binaries are fetched from the `ffmpeg-sidecar-v1` GitHub Release, with canonical sources as fallback.

### Available Scripts

| Command                  | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `bun run dev`            | Start Vite dev server only                      |
| `bun run build`          | Build the frontend for production               |
| `bun run tauri dev`      | Run the full Tauri desktop app in dev mode      |
| `bun run tauri build`    | Build the desktop app for distribution          |
| `bun run check`          | Run TypeScript type checking (app + SDK)      |
| `bun run lint`           | Run ESLint on all source files                  |
| `bun run sidecar:download` | Download a local FFmpeg copy for development |
| `bun run sdk:test`       | Run the headless SDK functional tests           |

## Building

To create a distributable package for your platform:

```bash
bun run tauri build
```

The output binaries will be placed in `src-tauri/target/release/bundle/`.

### Build Configuration

- **Identifier**: `com.fazli.vetour`
- **File Association**: `.vetour` — virtual tour project files
- **Supported Targets**: Windows (NSIS installer), macOS (.dmg), Linux (.deb, .AppImage)

## Tech Stack

| Layer              | Technology                                                                           |
| ------------------ | ------------------------------------------------------------------------------------ |
| Desktop Shell      | [Tauri 2](https://v2.tauri.app/)                                                      |
| Frontend           | [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)          |
| Styling            | [Tailwind CSS 4](https://tailwindcss.com/)                                            |
| State Management   | [Zustand](https://github.com/pmndrs/zustand)                                          |
| UI Components      | [Radix UI](https://www.radix-ui.com/), [Framer Motion](https://www.framer.com/motion/) |
| Panorama Rendering | [Photo Sphere Viewer](https://photo-sphere-viewer.js.org/)                            |
| Image Processing   | [image crate](https://crates.io/crates/image) (Rust)                                  |
| Packaging          | [Bun](https://bun.sh/)                                                                |

## Project Structure

```
vetour/
├── src/                      # Frontend source (React + TypeScript)
│   ├── commands/              # Typed command API, extension boundary, SDK host adapter
│   ├── components/            # Feature screens and shared UI primitives
│   │   ├── Editor/           # Main editor (panorama, hotspots, assets)
│   │   ├── Home/             # Home screen and project list
│   │   ├── Present/          # Presentation mode (separate window)
│   │   ├── Settings/         # Settings modal
│   │   └── ui/               # Shared UI primitives
│   ├── contexts/              # React providers
│   ├── lib/                   # Persistence, validation, media, and platform helpers
│   ├── store/                 # Zustand state and mutation orchestration
│   ├── types/                 # Persisted project and public contracts
│   └── constants.ts           # Shared defaults and limits
├── packages/vetour-sdk/      # Extension SDK (published to npmjs + GitHub Packages)
├── scripts/                  # Dev scripts (sidecar download, SDK publish/test)
├── src-tauri/                # Tauri backend (Rust)
│   ├── src/
│   │   ├── lib.rs            # App entry point and command registration
│   │   ├── image_processor.rs # Panorama processing (resize, WebP)
│   │   ├── media_processor.rs # Audio/video conversion (FFmpeg)
│   │   ├── ffmpeg_manager.rs  # FFmpeg sidecars (download, local import, assets)
│   │   └── file_lock.rs      # File locking for project files
│   ├── Cargo.toml
│   └── tauri.conf.json       # Tauri configuration
├── package.json              # Bun monorepo root (workspaces)
├── tsconfig.json
└── vite.config.ts
```

The design rationale and dependency boundaries are documented in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Extension authors should start
with [docs/EXTENSIONS.md](docs/EXTENSIONS.md).

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Photo Sphere Viewer](https://photo-sphere-viewer.js.org/) for the excellent panorama rendering library.
- [Tauri](https://tauri.app/) for the lightweight, secure desktop runtime.
- All contributors and users who support this project.

---

<p align="center">
  Created by <a href="https://github.com/fazelstudio">Zulfazli (fazelstudio)</a>
</p>
