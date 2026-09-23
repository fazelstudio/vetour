/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  api.ts
 *  Host API surface for extensions organized by concern.
 *-----------------------------------------------------------------------------------------------*/

import type {
  AssetEntry,
  AssetType,
  InfoHotspot,
  NavigationHotspot,
  ProjectEntry,
  ResolvedTheme,
  Theme,
  TourProject,
  TourScene,
  ValidationResult,
} from './domain';
import type { Disposable, Event } from './disposable';

/**
Command bus access for executing and registering namespaced commands.
Core IDs stay stable; extension IDs must be namespaced.
*/
export interface CommandsNamespace {
  executeCommand<T = unknown>(id: string, payload?: unknown): Promise<T>;
  registerCommand(id: string, handler: (payload: never) => unknown): Disposable;
  getCommands(): Promise<string[]>;
}

/**
User-facing UI access.
Extensions never touch React or the DOM through this surface.
*/
export interface WindowNamespace {
  showInformationMessage(message: string): Promise<string>;
  showWarningMessage(message: string): Promise<string>;
  showErrorMessage(message: string): Promise<string>;
  getTheme(): Promise<Theme>;
  setTheme(theme: Theme): Promise<void>;
  getResolvedTheme(): Promise<ResolvedTheme>;
}

/**
Project document access with snapshots and lifecycle events.
Snapshots are deep copies; mutate through commands or `tour` methods.
*/
export interface WorkspaceNamespace {
  getProject(): Promise<TourProject | null>;
  validateProject(project: TourProject): Promise<ValidationResult>;
  getRecentProjects(): Promise<ProjectEntry[]>;
  onDidLoadProject: Event<TourProject>;
  onDidSaveProject: Event<TourProject>;
}

/**
Tour graph mutations with typed payloads over the command bus.
Every method maps one-to-one to a namespaced core command.
*/
export interface TourNamespace {
  addScene(scene: TourScene): Promise<void>;
  updateScene(sceneId: string, updates: Partial<TourScene>): Promise<void>;
  deleteScene(sceneId: string): Promise<void>;
  duplicateScene(sceneId: string): Promise<void>;
  activateScene(sceneId: string): Promise<void>;
  setStartScene(sceneId: string): Promise<void>;
  addInfoHotspot(sceneId: string, hotspot: InfoHotspot): Promise<void>;
  updateInfoHotspot(sceneId: string, hotspotId: string, updates: Partial<InfoHotspot>): Promise<void>;
  deleteInfoHotspot(sceneId: string, hotspotId: string): Promise<void>;
  addNavHotspot(sceneId: string, hotspot: NavigationHotspot): Promise<void>;
  updateNavHotspot(sceneId: string, hotspotId: string, updates: Partial<NavigationHotspot>): Promise<void>;
  deleteNavHotspot(sceneId: string, hotspotId: string): Promise<void>;
  addAsset(asset: AssetEntry): Promise<void>;
  removeAsset(assetId: string): Promise<void>;
  renameAsset(assetId: string, name: string): Promise<void>;
  undo(): Promise<void>;
  redo(): Promise<void>;
}

/**
Showcase window controls for the offline present flow.
*/
export interface PresentNamespace {
  open(): Promise<void>;
  enter(): Promise<void>;
  exit(): Promise<void>;
  onDidOpen: Event<void>;
  onDidClose: Event<void>;
}

/**
Media engine access for converters and optimizers.
Heavy work stays in the backend; the UI never blocks.
*/
export interface MediaNamespace {
  convert(input: {
    path: string;
    type: AssetType;
    id: string;
    fallbackName: string;
    fallbackSize: number;
  }): Promise<{ path: string; name: string; size: number }>;
  resolveDocumentHandler(extension: string): Promise<{ handler: 'core' | 'extension'; extensionId?: string } | null>;
}

/**
Installed extension metadata.
*/
export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
}

/**
Extension discovery access.
*/
export interface ExtensionsNamespace {
  all(): Promise<ExtensionInfo[]>;
  getExtension(id: string): Promise<ExtensionInfo | undefined>;
}

/**
Root API object handed to `activate`.
One namespace per concern.
*/
export interface ObsipanoAPI {
  commands: CommandsNamespace;
  window: WindowNamespace;
  workspace: WorkspaceNamespace;
  tour: TourNamespace;
  present: PresentNamespace;
  media: MediaNamespace;
  extensions: ExtensionsNamespace;
}

/*
Legacy Vetour-era alias kept for backward compatibility.
New code must use ObsipanoAPI.
*/
export type VetourAPI = ObsipanoAPI;
