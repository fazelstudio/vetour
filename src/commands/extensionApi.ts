/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  extensionApi.ts
 *  Extension installation API with contribution registries and lifecycle hooks.
 *-----------------------------------------------------------------------------------------------*/

import { registerCommand, type CommandDefinition } from './commandRegistry';
import type { ProjectValidationIssue } from '@/lib/projectValidation';
import type { TourProject } from '@/types/tour';

/* Contribution descriptors, kept data-first so future SDK tooling can list them. */
export interface MenuContribution {
  id: string;
  title: string;
  command: string;
  when?: string;
}

export interface PanelContribution {
  id: string;
  title: string;
  area: 'inspector' | 'sidebar' | 'settings' | 'present-overlay';
}

export interface HotspotRendererContribution {
  id: string;
  kind: 'info' | 'nav' | string;
  action?: string;
}

export interface DocumentRendererContribution {
  id: string;
  extensions: string[];
}

export interface ValidationRuleContribution {
  id: string;
  validate: (project: TourProject) => ProjectValidationIssue[];
}

export interface ExtensionContributions {
  menus?: MenuContribution[];
  panels?: PanelContribution[];
  hotspotRenderers?: HotspotRendererContribution[];
  documentRenderers?: DocumentRendererContribution[];
  validationRules?: ValidationRuleContribution[];
}

export type ExtensionLifecycleEvent =
  | 'project:load'
  | 'project:save'
  | 'present:open'
  | 'present:close';

export interface VetourExtension {
  id: string;
  name: string;
  version: string;
  commands?: CommandDefinition<unknown, unknown>[];
  contributions?: ExtensionContributions;
  activate?: () => void | Promise<void>;
  deactivate?: () => void | Promise<void>;
}

interface InstalledRecord {
  extension: VetourExtension;
  disposeCommands: (() => void)[];
  contributionIds: { kind: keyof ExtensionContributions; id: string }[];
}

const extensions = new Map<string, InstalledRecord>();
const menuContributions = new Map<string, MenuContribution & { extensionId: string }>();
const panelContributions = new Map<string, PanelContribution & { extensionId: string }>();
const hotspotRenderers = new Map<string, HotspotRendererContribution & { extensionId: string }>();
const documentRenderers = new Map<string, DocumentRendererContribution & { extensionId: string }>();
const validationRules = new Map<string, ValidationRuleContribution & { extensionId: string }>();
const lifecycleHandlers = new Map<ExtensionLifecycleEvent, Set<() => void>>();

// Subscribe to an extension lifecycle event, returns an unsubscribe function.
export function onExtensionEvent(event: ExtensionLifecycleEvent, handler: () => void): () => void {
  let handlers = lifecycleHandlers.get(event);
  if (!handlers) {
    handlers = new Set();
    lifecycleHandlers.set(event, handlers);
  }
  handlers.add(handler);
  return () => handlers?.delete(handler);
}

// Emit a lifecycle event to all subscribers, errors never break the emitter.
export function emitExtensionEvent(event: ExtensionLifecycleEvent): void {
  const handlers = lifecycleHandlers.get(event);
  if (!handlers) return;
  for (const handler of [...handlers]) {
    try {
      handler();
    } catch (e) {
      console.error(`Extension handler for "${event}" failed`, e);
    }
  }
}

function registerContributions(extensionId: string, contributions?: ExtensionContributions): { kind: keyof ExtensionContributions; id: string }[] {
  if (!contributions) return [];
  const registered: { kind: keyof ExtensionContributions; id: string }[] = [];
  const claim = (kind: keyof ExtensionContributions, id: string) => {
    if (registered.some((entry) => entry.kind === kind && entry.id === id)) {
      throw new Error(`Duplicate ${kind} contribution "${id}" in extension "${extensionId}".`);
    }
    registered.push({ kind, id });
  };
  for (const menu of contributions.menus ?? []) {
    if (menuContributions.has(menu.id)) throw new Error(`Menu "${menu.id}" is already registered.`);
    menuContributions.set(menu.id, { ...menu, extensionId });
    claim('menus', menu.id);
  }
  for (const panel of contributions.panels ?? []) {
    if (panelContributions.has(panel.id)) throw new Error(`Panel "${panel.id}" is already registered.`);
    panelContributions.set(panel.id, { ...panel, extensionId });
    claim('panels', panel.id);
  }
  for (const renderer of contributions.hotspotRenderers ?? []) {
    if (hotspotRenderers.has(renderer.id)) throw new Error(`Hotspot renderer "${renderer.id}" is already registered.`);
    hotspotRenderers.set(renderer.id, { ...renderer, extensionId });
    claim('hotspotRenderers', renderer.id);
  }
  for (const renderer of contributions.documentRenderers ?? []) {
    if (documentRenderers.has(renderer.id)) throw new Error(`Document renderer "${renderer.id}" is already registered.`);
    documentRenderers.set(renderer.id, { ...renderer, extensionId });
    claim('documentRenderers', renderer.id);
  }
  for (const rule of contributions.validationRules ?? []) {
    if (validationRules.has(rule.id)) throw new Error(`Validation rule "${rule.id}" is already registered.`);
    validationRules.set(rule.id, { ...rule, extensionId });
    claim('validationRules', rule.id);
  }
  return registered;
}

function unregisterContributions(entries: { kind: keyof ExtensionContributions; id: string }[]): void {
  for (const entry of entries) {
    if (entry.kind === 'menus') menuContributions.delete(entry.id);
    if (entry.kind === 'panels') panelContributions.delete(entry.id);
    if (entry.kind === 'hotspotRenderers') hotspotRenderers.delete(entry.id);
    if (entry.kind === 'documentRenderers') documentRenderers.delete(entry.id);
    if (entry.kind === 'validationRules') validationRules.delete(entry.id);
  }
}

export function installExtension(extension: VetourExtension): () => void {
  if (extensions.has(extension.id)) {
    throw new Error(`Extension "${extension.id}" is already installed.`);
  }
  // Register commands first so a collision aborts before contributions are claimed.
  const disposeCommands: (() => void)[] = [];
  let contributionIds: { kind: keyof ExtensionContributions; id: string }[] = [];
  try {
    for (const definition of extension.commands ?? []) {
      disposeCommands.push(registerCommand(definition));
    }
    contributionIds = registerContributions(extension.id, extension.contributions);
  } catch (e) {
    disposeCommands.forEach((dispose) => dispose());
    unregisterContributions(contributionIds);
    throw e;
  }
  extensions.set(extension.id, { extension, disposeCommands, contributionIds });
  try {
    extension.activate?.();
  } catch (e) {
    console.error(`Extension "${extension.id}" activate failed`, e);
  }
  return () => {
    const record = extensions.get(extension.id);
    if (!record) return;
    record.disposeCommands.forEach((dispose) => dispose());
    unregisterContributions(record.contributionIds);
    extensions.delete(extension.id);
    try {
      extension.deactivate?.();
    } catch (e) {
      console.error(`Extension "${extension.id}" deactivate failed`, e);
    }
  };
}

export function listInstalledExtensions(): VetourExtension[] {
  return [...extensions.values()].map((record) => record.extension);
}

export function listMenuContributions(): (MenuContribution & { extensionId: string })[] {
  return [...menuContributions.values()];
}

export function listPanelContributions(): (PanelContribution & { extensionId: string })[] {
  return [...panelContributions.values()];
}

export function listHotspotRenderers(): (HotspotRendererContribution & { extensionId: string })[] {
  return [...hotspotRenderers.values()];
}

export function listDocumentRenderers(): (DocumentRendererContribution & { extensionId: string })[] {
  return [...documentRenderers.values()];
}

export function listValidationRules(): (ValidationRuleContribution & { extensionId: string })[] {
  return [...validationRules.values()];
}
