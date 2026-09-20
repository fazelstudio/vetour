/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  registerCoreCommands.ts
 *  Registration of built-in project, scene, hotspot, asset, present, and UI commands.
 *-----------------------------------------------------------------------------------------------*/

import { executeCommand, registerCommand, type CommandId, type CommandMap } from './commandRegistry';
import { useTourStore } from '@/store/useTourStore';
import { useProjectListStore } from '@/store/projectListStore';
import { useToastStore } from '@/store/toastStore';
import { validateProject } from '@/lib/projectValidation';
import { validatePluginPackage } from '@/lib/pluginPackage';
import { isCoreDocumentExtension } from '@/lib/documentRenderers';
import { convertAsset, type ConversionInput } from '@/lib/mediaPipeline';
import {
  cancelFfmpegDownload,
  checkFfmpegConnection,
  deleteFfmpeg,
  downloadFfmpeg,
  getFfmpegAssetInfo,
  getFfmpegStatus,
  importLocalFfmpeg,
} from '@/lib/ffmpeg';
import { currentResolvedTheme, currentTheme, requestTheme, type Theme } from '@/lib/theme';
import { listValidationRules, listDocumentRenderers, emitExtensionEvent } from './extensionApi';
import {
  createAndLoadProject,
  saveCurrentProject,
  saveCurrentProjectAs,
} from '@/lib/projectLifecycle';
import { openPresentWindow } from '@/lib/presentWindow';
import type { AssetEntry, InfoHotspot, NavigationHotspot, TourProject, TourScene } from '@/types/tour';
import type { ProjectEntry } from '@/types/projectEntry';

let registered = false;

export function registerCoreCommands(): void {
  if (registered) return;
  registered = true;

  const tour = () => useTourStore.getState();
  const recent = () => useProjectListStore.getState();
  const toast = () => useToastStore.getState();

  // Project lifecycle.
  registerCommand({ id: 'project.new', execute: ({ name }: { name?: string }) => createAndLoadProject(name) });
  registerCommand({
    id: 'project.load',
    execute: (project: TourProject) => {
      tour().loadProject(project);
      emitExtensionEvent('project:load');
    },
  });
  registerCommand({ id: 'project.set', execute: (project: TourProject) => tour().setProject(project) });
  registerCommand({ id: 'project.update', execute: (project: TourProject) => tour().updateProject(project) });
  registerCommand({
    id: 'project.save',
    execute: async () => {
      await saveCurrentProject();
      emitExtensionEvent('project:save');
    },
  });
  registerCommand({
    id: 'project.save-as',
    execute: async () => {
      const saved = await saveCurrentProjectAs();
      if (saved) emitExtensionEvent('project:save');
      return saved;
    },
  });
  registerCommand({ id: 'project.set-start-scene', execute: ({ sceneId }: { sceneId: string }) => tour().setDefaultScene(sceneId) });
  registerCommand({ id: 'project.set-saved-path', execute: (path: string | null) => tour().setSavedPath(path) });
  registerCommand({ id: 'project.set-dirty', execute: (dirty: boolean) => tour().setUnsavedChanges(dirty) });
  registerCommand({ id: 'project.set-save-status', execute: (status: 'saved' | 'saving' | 'unsaved') => tour().setSaveStatus(status) });
  registerCommand({ id: 'project.get-snapshot', execute: () => tour().project });
  // Core validation plus any rules contributed by installed extensions.
  registerCommand({
    id: 'project.validation.validate',
    execute: (project: TourProject) => {
      const base = validateProject(project);
      const extra = listValidationRules().flatMap((rule) => {
        try {
          return rule.validate(project);
        } catch (e) {
          console.error(`Validation rule "${rule.id}" failed`, e);
          return [];
        }
      });
      const issues = [...base.issues, ...extra];
      return { valid: issues.length === 0, issues };
    },
  });

  // Recent projects.
  registerCommand({ id: 'project.recent.load', execute: () => recent().loadProjects() });
  registerCommand({ id: 'project.recent.add', execute: (entry: ProjectEntry) => recent().addProject(entry) });
  registerCommand({ id: 'project.recent.remove', execute: (id: string) => recent().removeProject(id) });
  registerCommand({ id: 'project.recent.touch', execute: (id: string) => recent().updateLastOpened(id) });

  // History, kept under both namespaces for compatibility.
  registerCommand({ id: 'project.undo', execute: () => tour().undo() });
  registerCommand({ id: 'project.redo', execute: () => tour().redo() });
  registerCommand({ id: 'history.undo', execute: () => tour().undo() });
  registerCommand({ id: 'history.redo', execute: () => tour().redo() });
  registerCommand({ id: 'history.restore-snapshot', execute: (snapshotId: string) => tour().restoreSnapshot(snapshotId) });

  // Scenes.
  registerCommand({ id: 'scene.add', execute: (scene: TourScene) => tour().addScene(scene) });
  registerCommand({ id: 'scene.update', execute: ({ sceneId, updates }: { sceneId: string; updates: Partial<TourScene> }) => tour().updateScene(sceneId, updates) });
  registerCommand({ id: 'scene.delete', execute: (sceneId: string) => tour().deleteScene(sceneId) });
  registerCommand({ id: 'scene.duplicate', execute: (sceneId: string) => tour().duplicateScene(sceneId) });
  registerCommand({ id: 'scene.reorder', execute: ({ fromIndex, toIndex }: { fromIndex: number; toIndex: number }) => tour().reorderScenes(fromIndex, toIndex) });
  registerCommand({ id: 'scene.activate', execute: (sceneId: string) => tour().setActiveScene(sceneId) });

  // Selection.
  registerCommand({ id: 'selection.set-hotspot', execute: (hotspotId: string | null) => tour().setSelectedHotspot(hotspotId) });
  registerCommand({ id: 'selection.set-hotspots', execute: (hotspotIds: string[]) => tour().setSelectedHotspots(hotspotIds) });
  registerCommand({ id: 'selection.clear', execute: () => tour().setSelectedHotspots([]) });

  // Hotspot clipboard.
  registerCommand({ id: 'hotspot.copy', execute: () => tour().copySelectedHotspots() });
  registerCommand({ id: 'hotspot.paste', execute: () => tour().pasteHotspots() });
  registerCommand({ id: 'hotspot.duplicate', execute: () => tour().duplicateSelectedHotspots() });

  // Hotspot CRUD per kind, the main hook for hotspot-type plugins.
  registerCommand({ id: 'hotspot.add-info', execute: ({ sceneId, hotspot }: { sceneId: string; hotspot: InfoHotspot }) => tour().addInfoHotspot(sceneId, hotspot) });
  registerCommand({ id: 'hotspot.update-info', execute: ({ sceneId, hotspotId, updates }: { sceneId: string; hotspotId: string; updates: Partial<InfoHotspot> }) => tour().updateInfoHotspot(sceneId, hotspotId, updates) });
  registerCommand({ id: 'hotspot.delete-info', execute: ({ sceneId, hotspotId }: { sceneId: string; hotspotId: string }) => tour().deleteInfoHotspot(sceneId, hotspotId) });
  registerCommand({ id: 'hotspot.add-nav', execute: ({ sceneId, hotspot }: { sceneId: string; hotspot: NavigationHotspot }) => tour().addNavHotspot(sceneId, hotspot) });
  registerCommand({ id: 'hotspot.update-nav', execute: ({ sceneId, hotspotId, updates }: { sceneId: string; hotspotId: string; updates: Partial<NavigationHotspot> }) => tour().updateNavHotspot(sceneId, hotspotId, updates) });
  registerCommand({ id: 'hotspot.delete-nav', execute: ({ sceneId, hotspotId }: { sceneId: string; hotspotId: string }) => tour().deleteNavHotspot(sceneId, hotspotId) });

  // Assets.
  registerCommand({ id: 'asset.add', execute: (asset: AssetEntry) => tour().addAsset(asset) });
  registerCommand({ id: 'asset.remove', execute: (assetId: string) => tour().removeAsset(assetId) });
  registerCommand({ id: 'asset.rename', execute: ({ assetId, name }: { assetId: string; name: string }) => tour().renameAsset(assetId, name) });
  registerCommand({ id: 'asset.replace', execute: ({ assetId, replacement }: { assetId: string; replacement: Pick<AssetEntry, 'path' | 'size' | 'name'> }) => tour().replaceAsset(assetId, replacement) });

  // Present mode, backed by the existing window helper.
  registerCommand({ id: 'present.set-mode', execute: (present: boolean) => tour().setPresentMode(present) });
  registerCommand({ id: 'present.enter', execute: () => tour().setPresentMode(true) });
  registerCommand({
    id: 'present.exit',
    execute: () => {
      tour().setPresentMode(false);
      emitExtensionEvent('present:close');
    },
  });
  registerCommand({
    id: 'present.open',
    execute: async () => {
      await openPresentWindow(tour().project, {
        onCreated: () => tour().setPresentMode(true),
        onDestroyed: () => tour().setPresentMode(false),
        onError: (message) => toast().addToast({ type: 'danger', message }),
      });
      emitExtensionEvent('present:open');
    },
  });

  // Transient UI state.
  registerCommand({ id: 'ui.set-project-loading', execute: (loading: boolean) => tour().setProjectLoading(loading) });
  registerCommand({ id: 'ui.set-viewer-loading', execute: (loading: boolean) => tour().setViewerLoading(loading) });
  registerCommand({ id: 'ui.notify', execute: ({ type, message }: { type: 'info' | 'success' | 'warning' | 'danger'; message: string }) => toast().addToast({ type, message }) });
  registerCommand({ id: 'ui.dismiss-toast', execute: (id: string) => toast().removeToast(id) });
  registerCommand({ id: 'ui.clear-toasts', execute: () => toast().clearToasts() });

  // Document handler resolution, core first then installed extensions.
  registerCommand({
    id: 'media.document.resolve-handler',
    execute: ({ extension }: { extension: string }) => {
      const normalized = extension.toLowerCase();
      if (isCoreDocumentExtension(normalized)) return { handler: 'core' as const };
      const claimed = listDocumentRenderers().find((renderer) =>
        renderer.extensions.some((item) => item.toLowerCase() === normalized),
      );
      if (claimed) return { handler: 'extension' as const, extensionId: claimed.extensionId };
      return null;
    },
  });

  // Theme preference shared with the React provider through storage and events.
  registerCommand({ id: 'ui.theme.get', execute: () => currentTheme() });
  registerCommand({ id: 'ui.theme.set', execute: (theme: Theme) => requestTheme(theme) });
  registerCommand({ id: 'ui.theme.resolved', execute: () => currentResolvedTheme() });

  // Backend media conversion without progress events, for extensions.
  registerCommand({
    id: 'media.pipeline.convert',
    execute: async (input: ConversionInput) => (await convertAsset(input)).result,
  });

  // Official-only plugin gate: read a .veix file and reject anything unofficial.
  registerCommand({
    id: 'plugin.validate-file',
    execute: async ({ path }: { path: string }) => {
      const { readFile } = await import('@tauri-apps/plugin-fs');
      return validatePluginPackage(await readFile(path));
    },
  });

  // FFmpeg engine lifecycle, backed by the Tauri sidecar manager.
  registerCommand({ id: 'media.engine.status', execute: () => getFfmpegStatus() });
  registerCommand({ id: 'media.engine.asset-info', execute: () => getFfmpegAssetInfo() });
  registerCommand({ id: 'media.engine.check-connection', execute: () => checkFfmpegConnection() });
  registerCommand({ id: 'media.engine.download', execute: () => downloadFfmpeg() });
  registerCommand({ id: 'media.engine.cancel-download', execute: () => cancelFfmpegDownload() });
  registerCommand({ id: 'media.engine.delete', execute: () => deleteFfmpeg() });
  registerCommand({ id: 'media.engine.import-local', execute: ({ path }: { path: string }) => importLocalFfmpeg(path) });
}

export function command<TId extends CommandId>(
  id: TId,
  payload: CommandMap[TId]['payload'],
): CommandMap[TId]['result'] | Promise<CommandMap[TId]['result']> {
  registerCoreCommands();
  return executeCommand(id, payload, { source: 'core' });
}
