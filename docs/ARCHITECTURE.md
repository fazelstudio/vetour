# Vetour Architecture

Vetour is a Tauri desktop application with a React frontend. The repository is
organized by responsibility rather than by implementation detail:

```text
src/
├── commands/       # Public application commands, extension boundary, SDK host
├── components/     # Feature screens and reusable UI components
├── contexts/       # React providers with app-wide UI concerns
├── lib/            # Infrastructure adapters and pure utilities
├── store/          # Zustand state containers and mutation orchestration
├── types/          # Shared domain contracts
├── constants.ts    # Stable cross-feature defaults and limits
├── icons.ts        # Hotspot icon SVG path map
└── App.tsx         # Frontend composition and window lifecycle

packages/vetour-sdk/  # Extension SDK (namespaced API, contributions, manifest)

src-tauri/src/
├── lib.rs              # Tauri bootstrap and command registration
├── main.rs             # Binary entry point
├── build.rs            # Tauri build script
├── image_processor.rs  # Panorama processing (resize, WebP)
├── media_processor.rs  # Audio/video conversion (FFmpeg)
├── ffmpeg_manager.rs   # FFmpeg sidecars (download, local import, platform assets)
└── file_lock.rs        # Exclusive project file locking
```

Related documents: `docs/PRD.md`, `docs/FILE-FORMAT.md`,
`docs/EXTENSIONS.md`, `docs/DEVELOPMENT.md`.

## Dependency direction

The intended dependency direction is:

```text
components -> commands -> store/domain logic -> lib/platform adapters
components -> types/constants
```

UI code should not implement project mutations itself. Mutations that change
project data belong in the store and should be exposed to UI and extensions
through `src/commands`. File dialogs, native windows, file watching, FFmpeg,
and project serialization belong in `src/lib` until a dedicated platform
adapter layer is introduced.

## Frontend boundaries

### `commands`

This is the stable public API for editor actions. `commandRegistry.ts` defines
the typed `CommandMap`, `registerCoreCommands.ts` binds commands to the core
store, `extensionApi.ts` provides extension lifecycle management, and
`sdkHost.ts` implements the `vetour-sdk` API over the same registries.
`index.ts` re-exports the modules as the public barrel. Core commands also
emit lifecycle events (`project:load`, `project:save`, `present:open`,
`present:close`) consumed by SDK event subscriptions.

New editor mutations should follow this sequence:

1. Add a typed entry to `CommandMap`.
2. Register the core implementation.
3. Call the command from UI code.
4. Add capability checks when the action is context-dependent.

Extensions should use commands instead of importing Zustand stores directly.
The command map is intentionally augmentable through TypeScript module
augmentation. See `docs/EXTENSIONS.md` for the extension contract.

### `components`

Components are grouped by user-facing feature (`Editor`, `Home`, `Present`,
and `Settings`). Shared primitives live in `components/ui` (`button`,
`dialog`, `Modal`, `GridCard`, `Select`, `Toast`, `Tooltip`, `ContextMenu`,
`ColorPickerMenu`, `input`, `label`, `scroll-area`). A feature component may
compose commands and selectors, but should not contain serialization or
native-platform logic.

- `Editor/` hosts the authoring workspace: `EditorLayout` (view tabs,
  autosave, exit handling), `Toolbar` (file actions, history, Present
  entry), `PanoramaPage` (viewer plus scene cards plus property panel),
  `PSVViewer` (Photo Sphere Viewer wrapper with markers and scene sync),
  `PropertyPanel` (scene and hotspot inspector), `AssetsView` (asset
  library), `NavigationGraph` (link diagnostics), and `SkeletonEditor`
  (loading placeholder).
- `Home/` hosts the landing screen with project creation, file opening,
  and the recent-projects list.
- `Present/` hosts the offline showcase window and the multi-format
  `DocumentRenderer`.
- `Settings/` hosts the settings modal and the FFmpeg download manager.

### `lib`

This folder contains reusable infrastructure and pure helpers. Keep
serialization (`vetourFile.ts`), validation (`projectValidation.ts`), media
integration (`panorama.ts`, `ffmpeg.ts`, `mediaPipeline.ts`,
`mediaSettings.ts`), project lifecycle (`projectLifecycle.ts`), navigation
analysis (`navigationAnalysis.ts`), hotspot rendering (`hotspotRender.ts`),
document formats (`documentRenderers.ts`), theming (`theme.ts`), plugin
packages (`pluginPackage.ts`), file locking (`fileLock.ts`), window
integration (`presentWindow.ts`), and file watching (`useFileWatch.ts`)
here. Prefer small focused modules over adding unrelated helpers to a
single file. `utils.ts` holds only the Tailwind class merge helper.

### `store`

Stores own reactive state and coordinate domain mutations. They are not a
general-purpose service locator. New state should be scoped to a feature or
domain when practical; the existing public store remains the compatibility
facade for the current application.

- `useTourStore` owns the active project, selection, save status, history
  (undo/redo/snapshots), and the hotspot clipboard.
- `projectListStore` owns the recent-projects list persisted to local
  storage.
- `toastStore` owns the bounded user-notification queue.

### `types`

Types describe persisted project data and public contracts. Avoid putting
runtime behavior here. When the model grows, split types by domain while
retaining a small public barrel for compatibility.

- `tour.ts`: `TourProject`, `TourScene`, `InfoHotspot`,
  `NavigationHotspot`, `AssetEntry`, branding, and GPS tuples.
- `projectEntry.ts`: the recent-project entry shown on the home screen.

### `contexts` and supporting modules

- `ThemeContext` provides Light/Dark/Black/System theming, backed by
  `src/lib/theme.ts` and synced with the pre-paint bootstrap script in
  `index.html` and the CSS variables in `src/index.css`.
- `constants.ts` holds IDs, storage keys, upload limits, window ratios,
  MIME types, and option lists shared across features.
- `App.tsx` composes providers, routes between Home/Editor/Present, and
  owns window lifecycle (reveal-on-paint, close interception, save flow).

## Backend (Tauri/Rust) boundaries

`src-tauri/src/lib.rs` bootstraps the application: it registers the
filesystem and dialog plugins, manages shared state (`FileLockState`,
`FfmpegState`, `PresentData`), enforces the minimum window size, and
exposes the Tauri command surface:

- Present-data channel: `store_present_data`, `get_present_data`,
  `clear_present_data`.
- Media pipeline: `process_panorama`, `convert_audio`, `convert_video`.
- FFmpeg lifecycle: `get_ffmpeg_status`, `get_ffmpeg_asset_info`,
  `check_ffmpeg_connection`, `download_ffmpeg`, `import_local_ffmpeg`,
  `cancel_ffmpeg_download`, `delete_ffmpeg`.
- File locking: `lock_project_file`, `unlock_project_file`.

Heavy work (image resizing, WebP encoding, FFmpeg conversion and download)
runs in the backend with progress events emitted to the frontend, so the
UI never blocks on media processing.

## Runtime flows

### Editing session

`HomePage` creates or opens a project, `useTourStore.loadProject` normalizes
it, and `EditorLayout` hosts the workspace with autosave. Every mutation
flows through the store via commands, marks the project dirty, and updates
the titlebar and exit guards in `App.tsx`. Shared save orchestration lives
in `src/lib/projectLifecycle.ts` behind `project.save` / `project.save-as`.

### Present window

`openPresentWindow` (`src/lib/presentWindow.ts`) serializes the project plus
the blob-URL asset map into Rust global state, opens a new webview at
`/?mode=present`, and `PresentWindow` hydrates from it. Subsequent editor
edits stream live over the `sync-present-data` event without changing the
viewer's current scene.

### Media import

`AssetsView` uploads a file, then delegates conversion to
`src/lib/mediaPipeline.ts`, which calls the backend (`process_panorama`
for images, `convert_audio`/`convert_video` via the managed FFmpeg
binary). Converted outputs replace the asset path while the original is
used as fallback when conversion is unavailable.

## Persistence boundary

`.vetour` serialization is isolated in `src/lib/vetourFile.ts`. The loader
must normalize older projects and validate references before the project
reaches the editor. The UI should report validation failures through
user-facing notifications rather than relying on console output. The binary
layout (magic bytes, asset section, compressed JSON) is specified in
`docs/FILE-FORMAT.md`.

## Safe refactoring rule

Prefer incremental moves with compatibility re-exports. A structural change
must preserve the `.vetour` file format and existing extension command IDs
unless a migration is explicitly added.
