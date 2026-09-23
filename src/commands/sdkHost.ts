/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  sdkHost.ts
 *  Host adapter implementing the SDK API over the command registry.
 *-----------------------------------------------------------------------------------------------*/

import { Disposable, type ExtensionContext as SdkContext, type ExtensionManifest as SdkManifest, type ObsipanoAPI } from 'obsipano-sdk';
import {
  executeCommand,
  listCommands,
  registerCommand,
  type CommandId,
} from './commandRegistry';
import {
  installExtension,
  listInstalledExtensions,
  onExtensionEvent,
  type ExtensionContributions,
  type ObsipanoExtension,
} from './extensionApi';
import { useProjectListStore } from '@/store/projectListStore';
import { command, registerCoreCommands } from './registerCoreCommands';

/* Build the namespaced API object handed to extension activate functions. */
export function createObsipanoApi(): ObsipanoAPI {
  // Core commands must exist before any extension call, independent of UI render order.
  registerCoreCommands();
  return {
    commands: {
      executeCommand: <T = unknown>(id: string, payload?: unknown): Promise<T> => {
        try {
          // Registration and capability checks stay inside the host registry.
          return Promise.resolve(executeCommand(id as CommandId, payload as never, { source: 'extension' }) as T);
        } catch (error) {
          return Promise.reject(error);
        }
      },
      registerCommand: (id: string, handler: (payload: never) => unknown) =>
        Disposable.from({
          dispose: registerCommand({
            id: id as CommandId,
            execute: handler as (payload: unknown) => unknown,
          }),
        }),
      getCommands: () => Promise.resolve(listCommands().map(String)),
    },
    window: {
      showInformationMessage: (message: string) =>
        Promise.resolve(command('ui.notify', { type: 'info', message }) as string),
      showWarningMessage: (message: string) =>
        Promise.resolve(command('ui.notify', { type: 'warning', message }) as string),
      showErrorMessage: (message: string) =>
        Promise.resolve(command('ui.notify', { type: 'danger', message }) as string),
      getTheme: () => Promise.resolve(command('ui.theme.get', undefined)),
      setTheme: (theme) => {
        command('ui.theme.set', theme);
        return Promise.resolve();
      },
      getResolvedTheme: () => Promise.resolve(command('ui.theme.resolved', undefined)),
    },
    workspace: {
      getProject: () => Promise.resolve(command('project.get-snapshot', undefined)),
      validateProject: (project) =>
        Promise.resolve(command('project.validation.validate', project)),
      getRecentProjects: () =>
        Promise.resolve([...useProjectListStore.getState().projects]),
      onDidLoadProject: (listener) => Disposable.from({
        dispose: onExtensionEvent('project:load', () => {
          void Promise.resolve(command('project.get-snapshot', undefined)).then((project) => {
            if (project) listener(project);
          });
        }),
      }),
      onDidSaveProject: (listener) => Disposable.from({
        dispose: onExtensionEvent('project:save', () => {
          void Promise.resolve(command('project.get-snapshot', undefined)).then((project) => {
            if (project) listener(project);
          });
        }),
      }),
    },
    tour: {
      addScene: (scene) => {
        command('scene.add', scene);
        return Promise.resolve();
      },
      updateScene: (sceneId, updates) => {
        command('scene.update', { sceneId, updates });
        return Promise.resolve();
      },
      deleteScene: (sceneId) => {
        command('scene.delete', sceneId);
        return Promise.resolve();
      },
      duplicateScene: (sceneId) => {
        command('scene.duplicate', sceneId);
        return Promise.resolve();
      },
      activateScene: (sceneId) => {
        command('scene.activate', sceneId);
        return Promise.resolve();
      },
      setStartScene: (sceneId) => {
        command('project.set-start-scene', { sceneId });
        return Promise.resolve();
      },
      addInfoHotspot: (sceneId, hotspot) => {
        command('hotspot.add-info', { sceneId, hotspot });
        return Promise.resolve();
      },
      updateInfoHotspot: (sceneId, hotspotId, updates) => {
        command('hotspot.update-info', { sceneId, hotspotId, updates });
        return Promise.resolve();
      },
      deleteInfoHotspot: (sceneId, hotspotId) => {
        command('hotspot.delete-info', { sceneId, hotspotId });
        return Promise.resolve();
      },
      addNavHotspot: (sceneId, hotspot) => {
        command('hotspot.add-nav', { sceneId, hotspot });
        return Promise.resolve();
      },
      updateNavHotspot: (sceneId, hotspotId, updates) => {
        command('hotspot.update-nav', { sceneId, hotspotId, updates });
        return Promise.resolve();
      },
      deleteNavHotspot: (sceneId, hotspotId) => {
        command('hotspot.delete-nav', { sceneId, hotspotId });
        return Promise.resolve();
      },
      addAsset: (asset) => {
        command('asset.add', asset);
        return Promise.resolve();
      },
      removeAsset: (assetId) => {
        command('asset.remove', assetId);
        return Promise.resolve();
      },
      renameAsset: (assetId, name) => {
        command('asset.rename', { assetId, name });
        return Promise.resolve();
      },
      undo: () => {
        command('project.undo', undefined);
        return Promise.resolve();
      },
      redo: () => {
        command('project.redo', undefined);
        return Promise.resolve();
      },
    },
    present: {
      open: () => Promise.resolve(command('present.open', undefined)).then(() => undefined),
      enter: () => {
        command('present.enter', undefined);
        return Promise.resolve();
      },
      exit: () => {
        command('present.exit', undefined);
        return Promise.resolve();
      },
      onDidOpen: (listener) => Disposable.from({
        dispose: onExtensionEvent('present:open', () => listener()),
      }),
      onDidClose: (listener) => Disposable.from({
        dispose: onExtensionEvent('present:close', () => listener()),
      }),
    },
    media: {
      convert: (input) => Promise.resolve(command('media.pipeline.convert', input)),
      resolveDocumentHandler: (extension) =>
        Promise.resolve(command('media.document.resolve-handler', { extension })),
    },
    extensions: {
      all: () => Promise.resolve(
        listInstalledExtensions().map((entry) => ({
          id: entry.id,
          name: entry.name,
          version: entry.version,
        })),
      ),
      getExtension: (id) => Promise.resolve(
        listInstalledExtensions()
          .filter((entry) => entry.id === id)
          .map((entry) => ({ id: entry.id, name: entry.name, version: entry.version }))[0],
      ),
    },
  };
}

/* Adapt an SDK manifest to the host installer without changing its semantics. */
export function installSdkExtension(manifest: SdkManifest): () => void {
  const api = createObsipanoApi();
  const context: SdkContext = { extensionId: manifest.id, subscriptions: [] };
  const extension: ObsipanoExtension = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    commands: (manifest.commands ?? []).map((item) => ({
      id: item.id as CommandId,
      execute: item.execute as (payload: unknown) => unknown,
      canExecute: item.canExecute as ((payload: unknown) => boolean) | undefined,
    })),
    contributions: manifest.contributions as ExtensionContributions | undefined,
    activate: () => manifest.activate?.(api, context),
    deactivate: () => {
      for (const item of context.subscriptions.splice(0)) {
        try {
          item.dispose();
        } catch (error) {
          console.error(`Extension "${manifest.id}" subscription teardown failed`, error);
        }
      }
      return manifest.deactivate?.();
    },
  };
  return installExtension(extension);
}

/*
Legacy Vetour-era alias kept for backward compatibility.
New code must use createObsipanoApi.
*/
export const createVetourApi = createObsipanoApi;
