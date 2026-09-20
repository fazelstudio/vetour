# Extension Development

Vetour extensions are built around the command registry so they can add
capabilities without coupling themselves to React components or Zustand
internals.

## SDK package

The `vetour-sdk` workspace package (`packages/vetour-sdk`) is the typed
entry point for extensions, published as `vetour-sdk` on npmjs and as
`@fazelstudio/vetour-sdk` on GitHub Packages. Its API is organized by
namespace: one `activate`
function receives namespaced hosts (`commands`, `window`, `workspace`,
`tour`, `present`, `media`, `extensions`) plus a context that collects
disposables for unload.

```ts
import { defineExtension } from 'vetour-sdk';

export default defineExtension({
  id: 'publisher.feature',
  name: 'Feature',
  version: '0.1.0',
  activate: async (api, context) => {
    context.subscriptions.push(
      api.workspace.onDidSaveProject((project) => {
        void api.window.showInformationMessage(`Saved ${project.scenes.length} scenes.`);
      }),
    );
  },
});
```

The host implements this surface in `src/commands/sdkHost.ts` over the same
registries below, so SDK extensions and registry-level extensions share
semantics. Install SDK manifests with `installSdkExtension()`.

## Command contract

Core commands are declared in `src/commands/commandRegistry.ts`. An extension
may add its command contract through module augmentation:

```ts
declare module '@/commands/commandRegistry' {
  interface CommandMap {
    'example.toggle-grid': {
      payload: { enabled: boolean };
      result: void;
    };
  }
}
```

The extension then registers its implementation and returns the disposer from
`installExtension`. Command IDs should be namespaced (`publisher.feature`) to
avoid collisions.

## Extension rules

- Do not import `useTourStore` from an extension.
- Use commands for project mutations.
- Keep command payloads serializable.
- Validate external data before writing it into a project.
- Dispose registrations when the extension is unloaded.
- Do not assume a specific React component tree or DOM structure.
- Add user-facing error handling for expected failures.

## Current lifecycle

`installExtension()` rejects duplicate IDs, registers the extension commands,
and returns a function that unregisters them. `installSdkExtension()` wraps
the same installer for SDK manifests and disposes context subscriptions on
unload. Core commands emit lifecycle events (`project:load`, `project:save`,
`present:open`, `present:close`) which SDK events subscribe to. The current
API is intentionally small; permissions and dynamic package discovery can be
added without changing the core editor/store boundary.

## Plugin file

Distributable plugins ship as `.veix` files (never `.vtr`, which belongs to
an unrelated scientific format). The container is validated by
`src/lib/pluginPackage.ts` before anything is installed: wrong magic bytes,
truncation, unsupported versions, broken manifests, and unofficial publishers
are all rejected with a dedicated error code. The future installer surface
accepts only files that pass `plugin.validate-file`.
