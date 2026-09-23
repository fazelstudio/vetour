/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  contributions.ts
 *  Static contribution points an extension can declare in its manifest.
 *-----------------------------------------------------------------------------------------------*/

import type { TourProject, ValidationIssue } from './domain';

/**
A menu entry bound to a command by ID.
Stays data-first without DOM coupling.
*/
export interface MenuContribution {
  id: string;
  title: string;
  command: string;
  when?: string;
}

/**
A panel slot the host can surface in the named area.
Rendering stays host-owned; extensions only claim placement.
*/
export interface PanelContribution {
  id: string;
  title: string;
  area: 'inspector' | 'sidebar' | 'settings' | 'present-overlay';
}

/**
A hotspot renderer claim for a marker kind or action.
The host resolves renderers before falling back to built-ins.
*/
export interface HotspotRendererContribution {
  id: string;
  kind: 'info' | 'nav' | string;
  action?: string;
}

/**
A document format claim by file extension, without a leading dot.
The host consults claims before reporting a format as unsupported.
*/
export interface DocumentRendererContribution {
  id: string;
  extensions: string[];
}

/**
A project validation rule executed alongside core checks.
Rules must be pure and must never mutate the project.
*/
export interface ValidationRuleContribution {
  id: string;
  validate: (project: TourProject) => ValidationIssue[];
}

/**
Every contribution bucket an extension manifest may declare.
IDs must be namespaced as `publisher.feature` to avoid collisions.
*/
export interface ExtensionContributions {
  menus?: MenuContribution[];
  panels?: PanelContribution[];
  hotspotRenderers?: HotspotRendererContribution[];
  documentRenderers?: DocumentRendererContribution[];
  validationRules?: ValidationRuleContribution[];
}
