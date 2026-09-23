# Obsipano Project File Format (`.obsipano`)

This document specifies the binary layout of Obsipano project files. The
reference implementation is `src/lib/obsipanoFile.ts`, with validation and
normalization in `src/lib/projectValidation.ts`.

Related documents: `docs/ARCHITECTURE.md`, `docs/PRD.md`.

## 1. Design Principles

1. A project is a **single portable file**: project JSON plus all
   referenced binary assets embedded together.
2. Readers must be **strict about structure** (magic bytes, section
   lengths, truncation checks) and produce clear, user-facing errors —
   never a silent broken state.
3. The JSON payload is validated (`invalid-project`, `duplicate-id`
   reject the file) and normalized (defaults for schema version,
   category, scene lists, and asset lists) before reaching the editor.
4. Unreadable assets are skipped at save time; the project itself
   remains writable.

## 2. Common Encoding Rules

- All integers are unsigned 32-bit little-endian (`u32LE`).
- All text (paths, JSON) is UTF-8 without a byte-order mark.
- The project JSON is compressed with gzip before being stored.

## 3. Version 1 (Legacy)

Version 1 stores gzip-compressed project JSON only, with no embedded
assets. Readers must still accept it for backward compatibility.

```text
offset  size      field
0       4 bytes   magic: 0x4F 0x42 0x00 0x01 ("OB" + 0x00 + 0x01)
4       rest      gzip-compressed TourProject JSON
```

Assets referenced by a v1 project resolve from their original filesystem
paths at load time. Readers must still accept the legacy Vetour magic
(`0x56 0x54`, "VT") for backward compatibility.

Assets referenced by a v1 project resolve from their original filesystem
paths at load time.

## 4. Version 2 (Current)

Version 2 embeds every referenced binary asset so the file is fully
portable.

```text
offset  size      field
0       4 bytes   magic: 0x4F 0x42 0x00 0x02 ("OB" + 0x00 + 0x02)
4       u32       fileCount (number of embedded assets)
...               fileCount asset entries (see below)
...       u32       jsonLength (bytes of the gzip section)
...       jsonLength bytes  gzip-compressed TourProject JSON
```

Each asset entry:

```text
u32       pathLength (bytes of the UTF-8 original path)
bytes     originalPath (UTF-8, e.g. an absolute filesystem path)
u32       dataLength (bytes of the raw file content)
bytes     fileData (raw bytes, stored uncompressed)
```

### 4.1 Which paths are embedded

At save time, the writer collects every scene panorama, thumbnail, marker
image, marker audio/video reference, and asset-library path that still
points at the filesystem (paths starting with `blob:` are skipped because
they already represent extracted content). Assets already extracted from a
previously loaded file are re-embedded from the in-memory byte cache;
otherwise each path is read from disk. Paths that cannot be read are
skipped.

### 4.2 Load behavior

1. Verify the file is at least 4 bytes; otherwise report corruption.
2. Match the magic bytes against v1 or v2; anything else is rejected as
   "not a valid Obsipano project file". Legacy Vetour ("VT") magic is
   accepted for backward compatibility.
3. For v2, revoke blob URLs from any previously loaded project, then read
   each asset entry with bounds checks at every step (path length, path
   bytes, data length, data bytes). Truncation at any point is a
   corruption error.
4. Write each embedded asset to a session directory under the OS temp
   folder (original path with separators replaced by `_`), expose it
   through the asset-protocol URL, and register the original-path to URL
   mapping in the blob caches.
5. Read the trailing gzip JSON section with the same bounds checks,
   decompress, parse, validate, and normalize it into a `TourProject`.

## 5. Project JSON (both versions)

The JSON payload is a `TourProject` as defined in `src/types/tour.ts`:
identity (`id`, `name`, `slug`), `category`, `branding`,
`schemaVersion`, timestamps, `scenes` (panorama, thumbnail, navigation
links, info-hotspot markers, GPS, sphere correction), `assets`, and
`defaultSceneId`. Unknown future fields must be preserved round-trip by
writers that do not understand them.

## 6. Compatibility Rules

- Readers must accept v1 and v2. Writers always produce v2.
- Never change magic bytes, integer width/endianness, or section order
  without bumping the version and documenting a migration here.
- Validation codes (`missing-panorama`, `broken-link`, `duplicate-id`,
  `invalid-project`) are part of the user-facing contract: diagnostics
  may gain new codes, but existing codes must keep their meaning.

## 7. Plugin Files (`.veix`)

Distributable plugins use a separate versioned container (magic `"VEIX"`,
format version, gzip manifest), specified by the reference implementation
in `src/lib/pluginPackage.ts`. The installer gate accepts only files that
pass `plugin.validate-file`; the `.obsipano` rules above do not apply to it.
