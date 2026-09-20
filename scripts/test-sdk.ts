#!/usr/bin/env bun
/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  test-sdk.ts
 *  Headless functional test for the SDK package and its host adapter.
 *-----------------------------------------------------------------------------------------------*/

import { defineExtension, Disposable, Emitter, type VetourAPI } from 'vetour-sdk';
import { installSdkExtension, createVetourApi } from '../src/commands/sdkHost';
import { createPluginPackage, validatePluginPackage, PluginPackageError } from '../src/lib/pluginPackage';
import { executeCommand, listCommands } from '../src/commands/commandRegistry';
import { listMenuContributions, listValidationRules } from '../src/commands/extensionApi';
import { useTourStore } from '../src/store/useTourStore';

/* Minimal browser globals for headless execution outside Tauri. */
const storage = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, String(value));
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
};
(globalThis as Record<string, unknown>).document = {
  documentElement: {
    setAttribute: () => undefined,
    getAttribute: () => null,
    style: {},
  },
  querySelector: () => null,
};
(globalThis as Record<string, unknown>).window = {
  matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
};

let passed = 0;
let failed = 0;

function assert(name: string, condition: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  ok - ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL - ${name}`);
  }
}

async function section(name: string, fn: () => void | Promise<void>): Promise<void> {
  console.log(`[${name}]`);
  await fn();
}

/* Track host calls for lifecycle verification. */
const seen: string[] = [];
let activatedApi: VetourAPI | null = null;
let deactivated = false;

const manifest = defineExtension({
  id: 'sdk-test.demo',
  name: 'SDK Demo',
  version: '0.1.0',
  commands: [
    {
      id: 'sdk-test.ping',
      execute: ((payload: { echo?: string }) => `pong:${payload?.echo ?? ''}`) as never,
      canExecute: ((payload: { block?: boolean }) => payload?.block !== true) as never,
    },
  ],
  contributions: {
    menus: [{ id: 'sdk-test.menu', title: 'Demo', command: 'sdk-test.ping' }],
    validationRules: [
      {
        id: 'sdk-test.no-empty-name',
        validate: (project) => (project.scenes.some((scene) => !scene.name)
          ? [{ code: 'sdk-empty-name', message: 'A scene has no name.' }]
          : []),
      },
    ],
  },
  activate: (api, context) => {
    activatedApi = api;
    context.subscriptions.push(api.workspace.onDidSaveProject(() => {
      seen.push('saved');
    }));
  },
  deactivate: () => {
    deactivated = true;
  },
});

await section('sdk-standalone', () => {
  assert('defineExtension returns the manifest', manifest.id === 'sdk-test.demo');
  let tornDown = 0;
  const combined = Disposable.from(
    { dispose: () => { tornDown += 1; } },
    { dispose: () => { throw new Error('noisy'); } },
    { dispose: () => { tornDown += 1; } },
  );
  combined.dispose();
  assert('Disposable.from runs every teardown despite errors', tornDown === 2);
  const emitter = new Emitter<number>();
  const received: number[] = [];
  const sub = emitter.event((value) => received.push(value));
  emitter.fire(1);
  sub.dispose();
  emitter.fire(2);
  assert('Emitter fan-out and unsubscribe work', received.join(',') === '1');
});

await section('install-and-commands', async () => {
  const dispose = installSdkExtension(manifest);
  assert('activate receives the API', activatedApi !== null);
  assert('extension command is registered', listCommands().includes('sdk-test.ping' as never));
  const api = activatedApi as VetourAPI;
  const reply = await api.commands.executeCommand<string>('sdk-test.ping', { echo: 'hi' });
  assert('extension command executes through the bus', reply === 'pong:hi');
  let blocked = false;
  try {
    await api.commands.executeCommand('sdk-test.ping', { block: true });
  } catch {
    blocked = true;
  }
  assert('canExecute is enforced by the host', blocked);
  assert('menu contribution is listed', listMenuContributions().some((item) => item.id === 'sdk-test.menu'));
  const ids = await api.commands.getCommands();
  assert('getCommands lists core and extension IDs', ids.includes('scene.add') && ids.includes('sdk-test.ping'));
  assert('extensions.all sees the install', (await api.extensions.all()).some((item) => item.id === 'sdk-test.demo'));
  assert('extensions.getExtension resolves one entry', (await api.extensions.getExtension('sdk-test.demo'))?.name === 'SDK Demo');

  let duplicateRejected = false;
  try {
    installSdkExtension(defineExtension({ ...manifest, name: 'Copy' }));
  } catch {
    duplicateRejected = true;
  }
  assert('duplicate extension ID is rejected', duplicateRejected);
  void dispose;
  (globalThis as Record<string, unknown>).__sdkDispose = dispose;
});

await section('tour-namespace', async () => {
  const api = activatedApi as VetourAPI;
  await api.commands.executeCommand('project.new', {});
  await api.tour.addScene({
    id: 'scene_a', panorama: 'a.jpg', name: 'A', links: [], markers: [],
  });
  await api.tour.addScene({
    id: 'scene_b', panorama: 'b.jpg', name: '', links: [], markers: [],
  });
  let project = await api.workspace.getProject();
  assert('two scenes are stored', project?.scenes.length === 2);
  await api.tour.activateScene('scene_b');
  assert('scene activation sticks', useTourStore.getState().activeSceneId === 'scene_b');
  await api.tour.setStartScene('scene_b');
  project = await api.workspace.getProject();
  assert('start scene is stored', project?.defaultSceneId === 'scene_b');
  await api.tour.updateScene('scene_b', { name: 'B' });
  await api.tour.addInfoHotspot('scene_b', { id: 'hot_1', tooltip: 'Hi', data: { action: 'show_text' } });
  await api.tour.updateInfoHotspot('scene_b', 'hot_1', { tooltip: 'Hello' });
  await api.tour.addNavHotspot('scene_b', { id: 'nav_1', nodeId: 'scene_a', name: 'Back' });
  await api.tour.updateNavHotspot('scene_b', 'nav_1', { name: 'Go back' });
  project = await api.workspace.getProject();
  const sceneB = project?.scenes.find((scene) => scene.id === 'scene_b');
  assert('hotspot CRUD round-trips', sceneB?.markers[0]?.tooltip === 'Hello' && sceneB?.links[0]?.name === 'Go back');
  await api.tour.deleteNavHotspot('scene_b', 'nav_1');
  await api.tour.deleteInfoHotspot('scene_b', 'hot_1');
  project = await api.workspace.getProject();
  assert('hotspot deletes stick', (project?.scenes.find((s) => s.id === 'scene_b')?.markers.length ?? -1) === 0);
  await api.tour.duplicateScene('scene_a');
  project = await api.workspace.getProject();
  assert('scene duplication grows the graph', (project?.scenes.length ?? 0) === 3);
  await api.tour.undo();
  project = await api.workspace.getProject();
  assert('undo shrinks the graph', (project?.scenes.length ?? 0) === 2);
  await api.tour.redo();
  project = await api.workspace.getProject();
  assert('redo restores the graph', (project?.scenes.length ?? 0) === 3);
});

await section('assets-and-clipboard', async () => {
  const api = activatedApi as VetourAPI;
  await api.tour.addAsset({ id: 'asset_1', name: 'pic.png', path: 'pic.png', type: 'image', size: 10, addedAt: new Date().toISOString() });
  await api.tour.renameAsset('asset_1', 'photo.png');
  let project = await api.workspace.getProject();
  assert('asset add and rename stick', project?.assets[0]?.name === 'photo.png');
  await api.commands.executeCommand('asset.replace', { assetId: 'asset_1', replacement: { path: 'photo.webp', size: 5, name: 'photo.webp' } });
  await api.tour.removeAsset('asset_1');
  project = await api.workspace.getProject();
  assert('asset removal sticks', (project?.assets.length ?? -1) === 0);
  // Copy from the source scene while it is active, then paste elsewhere.
  await api.tour.activateScene('scene_a');
  await api.tour.addInfoHotspot('scene_a', { id: 'clip_1', tooltip: 'Clip' });
  await api.commands.executeCommand('selection.set-hotspot', 'clip_1');
  await api.commands.executeCommand('hotspot.copy', undefined);
  await api.tour.activateScene('scene_b');
  await api.commands.executeCommand('hotspot.paste', undefined);
  project = await api.workspace.getProject();
  assert('clipboard paste crosses scenes', (project?.scenes.find((s) => s.id === 'scene_b')?.markers.length ?? 0) === 1);
  await api.commands.executeCommand('selection.clear', undefined);
  assert('selection clear sticks', useTourStore.getState().selectedHotspotIds.length === 0);
});

await section('window-workspace-present-media', async () => {
  const api = activatedApi as VetourAPI;
  const toastId = await api.window.showInformationMessage('Hello');
  assert('notify returns a toast id', typeof toastId === 'string' && toastId.length > 0);
  await api.window.showWarningMessage('Careful');
  await api.window.showErrorMessage('Broken');
  assert('current theme reads stored preference', (await api.window.getTheme()) === 'system');
  await api.window.setTheme('dark');
  assert('theme set and resolve round-trip', (await api.window.getTheme()) === 'dark' && (await api.window.getResolvedTheme()) === 'dark');
  const validation = await api.workspace.validateProject((await api.workspace.getProject()) as never as Parameters<VetourAPI['workspace']['validateProject']>[0]);
  assert('named graph passes including extension rules', validation.valid);
  await api.tour.addScene({ id: 'scene_nameless', panorama: 'c.jpg', links: [], markers: [] });
  const flagged = await api.workspace.validateProject((await api.workspace.getProject()) as never as Parameters<VetourAPI['workspace']['validateProject']>[0]);
  assert('extension validation rule contributes issues', !flagged.valid && flagged.issues.some((issue) => issue.code === 'sdk-empty-name'));
  await api.tour.deleteScene('scene_nameless');
  assert('recent list reads without crashing', Array.isArray(await api.workspace.getRecentProjects()));
  let closed = 0;
  const sub = api.present.onDidClose(() => { closed += 1; });
  await api.present.exit();
  assert('present exit emits close', closed === 1);
  sub.dispose();
  await api.present.exit();
  assert('disposed listener stays silent', closed === 1);
  const handler = await api.media.resolveDocumentHandler('pdf');
  assert('core document handler resolves', handler?.handler === 'core');
  assert('unknown document handler is null', (await api.media.resolveDocumentHandler('zz9')) === null);
});

await section('plugin-package', () => {
  const official = validatePluginPackage(createPluginPackage({
    kind: 'vetour-extension',
    id: 'fazelstudio.demo',
    name: 'Demo',
    version: '0.1.0',
    publisher: 'fazelstudio',
  }));
  assert('official package round-trips', official.id === 'fazelstudio.demo');
  const badMagic = (code: string, bytes: Uint8Array) => {
    try {
      validatePluginPackage(bytes);
      return 'accepted';
    } catch (error) {
      return error instanceof PluginPackageError ? error.code : code;
    }
  };
  assert('non-plugin bytes are rejected', badMagic('', new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])) === 'bad-magic');
  const tampered = createPluginPackage({
    kind: 'vetour-extension', id: 'x.y', name: 'X', version: '0.1.0', publisher: 'someone',
  });
  assert('unofficial publisher is rejected', badMagic('', tampered) === 'untrusted-publisher');
  const future = createPluginPackage({
    kind: 'vetour-extension', id: 'fazelstudio.demo', name: 'Demo', version: '0.1.0', publisher: 'fazelstudio',
  }).slice();
  new DataView(future.buffer).setUint32(4, 999, true);
  assert('future format version is rejected', badMagic('', future) === 'unsupported-version');
  assert('truncated input is rejected', badMagic('', future.slice(0, 5)) === 'truncated');
});

await section('uninstall', async () => {
  const dispose = (globalThis as Record<string, unknown>).__sdkDispose as () => void;
  dispose();
  assert('deactivate ran on uninstall', deactivated);
  assert('extension command is unregistered', !listCommands().includes('sdk-test.ping' as never));
  assert('menu contribution is removed', !listMenuContributions().some((item) => item.id === 'sdk-test.menu'));
  assert('validation rule is removed', !listValidationRules().some((rule) => rule.id === 'sdk-test.no-empty-name'));
  let gone = false;
  try {
    executeCommand('sdk-test.ping' as never, undefined as never);
  } catch {
    gone = true;
  }
  assert('unregistered command throws', gone);
  const api = createVetourApi();
  assert('uninstalled extension disappears from list', !(await api.extensions.all()).some((item) => item.id === 'sdk-test.demo'));
});

console.log(`\nResult: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
