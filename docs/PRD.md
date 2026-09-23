# Obsipano — Product Requirements Document (PRD)

## 1. Overview

Obsipano is a cross-platform desktop application for creating, editing, and
presenting immersive 360° virtual tours. Users import panoramic images,
connect scenes with navigation hotspots, enrich scenes with media hotspots,
and present the finished tour fullscreen — fully offline.

| Item             | Value                                                        |
|------------------|--------------------------------------------------------------|
| Product name     | Obsipano                                                     |
| App identifier   | `com.fazli.obsipano`                                         |
| Platforms        | Windows, macOS, Linux (Tauri 2 bundles)                      |
| Project files    | `.obsipano` (single-file, compressed, with embedded assets)  |
| Current version  | 1.x                                                          |

Related documents: `docs/ARCHITECTURE.md`, `docs/FILE-FORMAT.md`,
`docs/EXTENSIONS.md`, `docs/DEVELOPMENT.md`.

## 2. Goals and Non-Goals

### Goals

1. Let non-technical users build a multi-scene 360° tour from panoramic
   images without writing code.
2. Work fully offline for authoring and presenting; the network is only
   needed for the one-time optional FFmpeg download.
3. Keep a single-file project format (`.obsipano`) that is portable and
   resilient to corruption.
4. Provide a clean, distraction-free Present mode for client demos.
5. Stay extensible through the typed command registry, the `obsipano-sdk`
   package, contribution points, and official `.veix` plugin files.

### Non-Goals (current scope)

- Online publishing / hosting of tours (planned as a future Publish mode;
  see section 9).
- Collaborative multi-user editing.
- Built-in photo capture or panorama stitching.
- Mobile apps.

## 3. Target Users

- **Property agents and hospitality staff** showcasing spaces to clients.
- **Museum, education, and showroom teams** building self-guided tours.
- **Freelance creators** delivering tour files (`.obsipano`) to clients.

All personas share one expectation: open the app, build the tour, press
Present, and show it — without internet or technical setup.

## 4. Usage Modes

### 4.1 Edit mode (offline)

The default authoring workspace: panorama preview, scene cards, property
panel, asset library, navigation diagnostics, toolbar with New/Open/Save,
undo/redo, and entry to Present mode.

### 4.2 Present mode (offline)

A separate window (`/?mode=present`) rendering the same project data with
all editing UI hidden. Supports scene navigation, media overlays
(image, video, text, document, audio), keyboard navigation, and an
optional branded loading screen. Live-synced from the editor while open.

### 4.3 Publish mode (future)

Deploy a tour to Fazel Studio for a public URL. Not implemented yet.
The data model (`TourProject`) is designed to be serializable for this
future use without transformation of the core scene/hotspot structure.

## 5. Functional Requirements

### 5.1 Project lifecycle

- Create a new unsaved project (`Untitled`) and enter the editor directly;
  no save dialog at creation time.
- Open `.obsipano` files via file picker or the recent-projects list.
- Save to a chosen path (Save As for new projects, in-place afterwards);
  show dirty state (`*`) in the titlebar.
- Autosave modified projects on an interval when a saved path exists.
- On exit/navigation with unsaved changes, offer Cancel / Discard / Save.
- Lock the open project file against concurrent external edits and watch
  for external rename/delete events.
- Track recent projects locally with last-opened timestamps.

### 5.2 Scenes and panoramas

- Add a scene from an image asset; derive the scene name from the file.
- Edit scene name, description, and private editor notes.
- Reorder scenes (drag and drop), duplicate scenes, delete scenes.
- Designate exactly one start scene; visually badge it on scene cards.
- Resolve panoramas from local files, blob URLs (loaded `.obsipano`),
  `asset:` protocol URLs, or http(s); fall back gracefully with a
  validation warning when a panorama is missing.

### 5.3 Hotspots

- Place info hotspots by right-clicking the panorama (with confirm popup),
  drag placed markers to reposition, double-click to preview content.
- Hotspot actions: navigate to scene, show image, show video, show text
  (with alignment), play sound (click or autoplay), show document.
- Style hotspots: icon set, icon/text/background colors (solid or
  gradient), background opacity, border radius, custom fonts from assets.
- Navigation hotspots link scenes; info hotspots carry tooltip, content,
  and media references.
- Copy, paste, and duplicate selected hotspots across scenes.

### 5.4 Asset library

- Central upload point for images, audio, video, documents, and fonts.
  All files used elsewhere must come from Assets.
- Per-type count limits and per-file size limits with clear rejection
  messages; search and unused-only filter.
- Automatic processing on import: panoramas resized/encoded to WebP
  (Rust), WAV audio converted to MP3, large video compressed to
  H.264 1080p (FFmpeg). Originals are kept when conversion is
  unavailable.
- Preview assets in place; rename, replace (re-pointing all references),
  and delete (including scenes bound to the asset, with confirmation).

### 5.5 Navigation diagnostics

- Detect missing panoramas, links to non-existent scenes, duplicate scene
  IDs, and unreachable scenes from the start scene.
- Surface issues in the editor (scene overlay) without blocking work.

### 5.6 Present window

- Open a separate window sized relative to the screen, loading project
  data through the Rust present-data channel.
- Keyboard navigation (arrows between scenes, Escape to close layers).
- Media modals for image, video, document, and text; ambient audio player
  with autoplay markers; audio stops on scene change.
- Optional branded intro screen (logo + loading-screen image) when the
  project defines branding.

### 5.7 Media optimization (FFmpeg)

- Ship the installer without FFmpeg to keep downloads small.
- Offer one-time, resumable FFmpeg download from Settings with progress,
  cancellation, connection checks, and removal; the exact per-system
  package is shown upfront, and platforms without a published binary get a
  clear notice naming the missing file.
- Accept a user-provided FFmpeg binary ("Use local file") with automatic
  validation and installation; any file name works.
- Without FFmpeg the app remains fully usable with original files.

### 5.8 Settings and theming

- Themes: Light, Dark, Black, and System-following; applied before first
  paint to avoid flashes, persisted across launches.
- Language selection (currently English).
- Project metadata editing (description, category).

## 6. Data Model (summary)

Core persisted contract in `src/types/tour.ts`:

- `TourProject`: identity (`id`, `name`, `slug`), `category`, `branding`,
  `schemaVersion`, timestamps, `scenes`, `assets`, `defaultSceneId`.
- `TourScene`: `panorama`, `thumbnail`, `links` (navigation hotspots),
  `markers` (info hotspots), GPS, sphere correction, map/plan slots.
- `AssetEntry`: `id`, `name`, `path`, `type`, `size`, `addedAt`.
- Hotspots carry yaw/pitch positions plus a `data` bag for
  action, media references, alignment, autoplay, and style.

Full persistence rules live in `docs/FILE-FORMAT.md`.

## 7. Non-Functional Requirements

- **Offline-first:** every feature except the FFmpeg download works with
  no network access.
- **Responsiveness:** panorama processing and media conversion run in the
  Rust backend with progress events; the UI never blocks on conversion.
- **Robustness:** corrupted or truncated `.obsipano` files produce clear
  user-facing errors, never a silent broken state; unreadable assets are
  skipped at save with the project still writable.
- **Native integration:** custom titlebar with window controls, `.obsipano`
  file association, minimum window size enforced at 60% of the monitor.
- **Accessibility basics:** keyboard dismissal for menus/dialogs,
  labeled controls, visible focus states.

## 8. Acceptance Criteria (release checklist)

1. New project → import panoramas → link scenes → save → reopen: tour
   intact, start scene preserved.
2. All six hotspot actions render correctly in both Edit preview and
   Present window.
3. Present window works with the machine fully offline.
4. Corrupted `.obsipano` file shows a readable error; valid files nearby
   still open.
5. FFmpeg download can be cancelled, resumed, removed, and reinstalled.
6. `bun run check` and `bun run lint` pass on a clean tree.

## 9. Future Work (out of scope for this PRD version)

- Publish mode: deploy tours to Fazel Studio with public URLs, access
  tokens, and a web viewer.
- Gallery, compass, floor-plan/map plugins for the viewer, delivered as
  official `.veix` plugin files through the extension system.
- Tour-level templates and project search.
