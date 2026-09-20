/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  commandRegistry.ts
 *  Central command registry with typed command contracts and dispatch.
 *-----------------------------------------------------------------------------------------------*/

import type { AssetEntry, AssetType, InfoHotspot, NavigationHotspot, TourProject, TourScene } from '@/types/tour';
import type { ProjectEntry } from '@/types/projectEntry';
import type { ToastType } from '@/store/toastStore';
import type { ProjectValidationResult } from '@/lib/projectValidation';
import type { PluginManifest } from '@/lib/pluginPackage';
import type { FfmpegAssetInfo, FfmpegStatus } from '@/lib/ffmpeg';
import type { ResolvedTheme, Theme } from '@/lib/theme';

/**
The public command contract.
Extensions can augment this interface through TypeScript module augmentation.
Existing IDs are frozen for compatibility; new IDs follow the same namespaces.
*/
export interface CommandMap {
  'project.new': { payload: { name?: string }; result: void };
  'project.load': { payload: TourProject; result: void };
  'project.set': { payload: TourProject; result: void };
  'project.update': { payload: TourProject; result: void };
  'project.undo': { payload: void; result: void };
  'project.redo': { payload: void; result: void };
  'project.save': { payload: void; result: void | Promise<void> };
  'project.save-as': { payload: void; result: boolean | Promise<boolean> };
  'project.set-start-scene': { payload: { sceneId: string }; result: void };
  'project.set-saved-path': { payload: string | null; result: void };
  'project.set-dirty': { payload: boolean; result: void };
  'project.set-save-status': { payload: 'saved' | 'saving' | 'unsaved'; result: void };
  'project.get-snapshot': { payload: void; result: TourProject | null };
  'project.validation.validate': { payload: TourProject; result: ProjectValidationResult };
  'project.recent.load': { payload: void; result: void };
  'project.recent.add': { payload: ProjectEntry; result: void };
  'project.recent.remove': { payload: string; result: void };
  'project.recent.touch': { payload: string; result: void };
  'history.undo': { payload: void; result: void };
  'history.redo': { payload: void; result: void };
  'history.restore-snapshot': { payload: string; result: void };
  'scene.add': { payload: TourScene; result: void };
  'scene.update': { payload: { sceneId: string; updates: Partial<TourScene> }; result: void };
  'scene.delete': { payload: string; result: void };
  'scene.duplicate': { payload: string; result: string | void };
  'scene.reorder': { payload: { fromIndex: number; toIndex: number }; result: void };
  'scene.activate': { payload: string; result: void };
  'selection.set-hotspot': { payload: string | null; result: void };
  'selection.set-hotspots': { payload: string[]; result: void };
  'selection.clear': { payload: void; result: void };
  'hotspot.copy': { payload: void; result: void };
  'hotspot.paste': { payload: void; result: void };
  'hotspot.duplicate': { payload: void; result: void };
  'hotspot.add-info': { payload: { sceneId: string; hotspot: InfoHotspot }; result: void };
  'hotspot.update-info': { payload: { sceneId: string; hotspotId: string; updates: Partial<InfoHotspot> }; result: void };
  'hotspot.delete-info': { payload: { sceneId: string; hotspotId: string }; result: void };
  'hotspot.add-nav': { payload: { sceneId: string; hotspot: NavigationHotspot }; result: void };
  'hotspot.update-nav': { payload: { sceneId: string; hotspotId: string; updates: Partial<NavigationHotspot> }; result: void };
  'hotspot.delete-nav': { payload: { sceneId: string; hotspotId: string }; result: void };
  'asset.add': { payload: AssetEntry; result: void };
  'asset.remove': { payload: string; result: void };
  'asset.rename': { payload: { assetId: string; name: string }; result: void };
  'asset.replace': {
    payload: { assetId: string; replacement: Pick<AssetEntry, 'path' | 'size' | 'name'> };
    result: void;
  };
  'present.set-mode': { payload: boolean; result: void };
  'present.enter': { payload: void; result: void };
  'present.exit': { payload: void; result: void };
  'present.open': { payload: void; result: void | Promise<void> };
  'ui.set-project-loading': { payload: boolean; result: void };
  'ui.set-viewer-loading': { payload: boolean; result: void };
  'ui.notify': { payload: { type: ToastType; message: string }; result: string };
  'ui.dismiss-toast': { payload: string; result: void };
  'ui.clear-toasts': { payload: void; result: void };
  'media.document.resolve-handler': {
    payload: { extension: string };
    result: { handler: 'core' | 'extension'; extensionId?: string } | null;
  };
  'media.pipeline.convert': {
    payload: { path: string; type: AssetType; id: string; fallbackName: string; fallbackSize: number };
    result: { path: string; name: string; size: number } | Promise<{ path: string; name: string; size: number }>;
  };
  'ui.theme.get': { payload: void; result: Theme };
  'ui.theme.set': { payload: Theme; result: void };
  'ui.theme.resolved': { payload: void; result: ResolvedTheme };
  'media.engine.status': { payload: void; result: FfmpegStatus | Promise<FfmpegStatus> };
  'media.engine.asset-info': { payload: void; result: FfmpegAssetInfo | Promise<FfmpegAssetInfo> };
  'media.engine.check-connection': { payload: void; result: boolean | Promise<boolean> };
  'media.engine.download': { payload: void; result: FfmpegStatus | Promise<FfmpegStatus> };
  'media.engine.cancel-download': { payload: void; result: void | Promise<void> };
  'media.engine.delete': { payload: void; result: FfmpegStatus | Promise<FfmpegStatus> };
  'media.engine.import-local': { payload: { path: string }; result: FfmpegStatus | Promise<FfmpegStatus> };
  'plugin.validate-file': { payload: { path: string }; result: PluginManifest | Promise<PluginManifest> };
}

export type CommandId = keyof CommandMap;

export interface CommandContext {
  source?: string;
}

export interface CommandDefinition<TPayload = unknown, TResult = void> {
  id: CommandId;
  execute: (payload: TPayload, context?: CommandContext) => TResult | Promise<TResult>;
  canExecute?: (payload: TPayload, context?: CommandContext) => boolean;
}

const commands = new Map<CommandId, CommandDefinition<unknown, unknown>>();

export function registerCommand<TPayload, TResult>(definition: CommandDefinition<TPayload, TResult>): () => void {
  // Reject duplicate IDs so core and extension commands never silently overwrite each other.
  if (commands.has(definition.id)) {
    throw new Error(`Command "${definition.id}" is already registered.`);
  }
  commands.set(definition.id, definition as unknown as CommandDefinition<unknown, unknown>);
  return () => {
    // Only remove when the entry still belongs to this registration.
    if (commands.get(definition.id) === definition) {
      commands.delete(definition.id);
    }
  };
}

export function hasCommand(id: CommandId): boolean {
  return commands.has(id);
}

export function canExecuteCommand<TId extends CommandId>(
  id: TId,
  payload: CommandMap[TId]['payload'],
  context?: CommandContext,
): boolean {
  const command = commands.get(id);
  return !!command && (!command.canExecute || command.canExecute(payload, context));
}

export function executeCommand<TId extends CommandId>(
  id: TId,
  payload: CommandMap[TId]['payload'],
  context?: CommandContext,
): CommandMap[TId]['result'] | Promise<CommandMap[TId]['result']> {
  const command = commands.get(id);
  if (!command) throw new Error(`Command "${id}" is not registered.`);
  if (command.canExecute && !command.canExecute(payload, context)) {
    throw new Error(`Command "${id}" cannot be executed in the current context.`);
  }
  return command.execute(payload, context) as CommandMap[TId]['result'] | Promise<CommandMap[TId]['result']>;
}

export function listCommands(): CommandId[] {
  return [...commands.keys()];
}
