/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  domain.ts
 *  Structural domain contracts mirrored from the host application.
 *-----------------------------------------------------------------------------------------------*/

/**
Geographic position as latitude, longitude, and optional altitude.
Matches the host TourProject tuple shape exactly.
*/
export type GpsTuple = [number, number, number?];

/** Media kinds accepted by the asset library. */
export type AssetType = 'image' | 'audio' | 'video' | 'document' | 'font';

/** Showcase categories offered on the home screen. */
export type ProjectCategory =
  | 'real-estate'
  | 'hospitality'
  | 'museum'
  | 'education'
  | 'showroom'
  | 'other';

/** Optional white-label branding stored on the project. */
export interface ProjectBranding {
  logo?: string;
  favicon?: string;
  loadingScreen?: string;
  primaryColor?: string;
}

/** One file tracked by the asset library. */
export interface AssetEntry {
  id: string;
  name: string;
  path: string;
  type: AssetType;
  size: number;
  addedAt: string;
}

/** Content hotspot rendered on top of a panorama. */
export interface InfoHotspot {
  id: string;
  position?: { yaw: number | string; pitch: number | string };
  html?: string;
  image?: string;
  tooltip?: string | { className?: string; content: string; position?: string; trigger?: 'hover' | 'click' };
  content?: string;
  className?: string;
  size?: { width: number; height: number };
  anchor?: string;
  style?: Record<string, string>;
  data?: Record<string, unknown>;
}

/** Navigation hotspot linking one scene to another. */
export interface NavigationHotspot {
  id?: string;
  nodeId: string;
  position?: { yaw: number | string; pitch: number | string };
  gps?: GpsTuple;
  name?: string;
  arrowStyle?: Record<string, unknown>;
  markerStyle?: Record<string, unknown>;
}

/** One panorama node in the tour graph. */
export interface TourScene {
  id: string;
  panorama: string;
  assetId?: string;
  name?: string;
  description?: string;
  notes?: string;
  thumbnail?: string;
  gps?: GpsTuple;
  links: NavigationHotspot[];
  markers: InfoHotspot[];
  panoData?: unknown;
  sphereCorrection?: { pan?: number; tilt?: number; roll?: number };
  showInGallery?: boolean;
  map?: unknown;
  plan?: unknown;
  data?: unknown;
}

/** The persisted tour document, serializable without transformation. */
export interface TourProject {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  category?: ProjectCategory;
  branding?: ProjectBranding;
  schemaVersion?: number;
  createdAt: string;
  updatedAt: string;
  scenes: TourScene[];
  assets: AssetEntry[];
  defaultSceneId?: string;
  gallery?: boolean;
  compass?: boolean;
  map?: unknown;
  plan?: unknown;
}

/** One row of the recent-projects list on the home screen. */
export interface ProjectEntry {
  id: string;
  name: string;
  folderPath: string;
  createdAt: string;
  lastOpenedAt: string;
}

/** Severity levels for user-facing notifications. */
export type ToastKind = 'info' | 'success' | 'warning' | 'danger';

/** Machine-readable validation finding, stable across releases. */
export interface ValidationIssue {
  code: 'missing-panorama' | 'broken-link' | 'duplicate-id' | 'invalid-project' | string;
  message: string;
  sceneId?: string;
}

/** Result of validating a project, including extension rules. */
export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/** Theme preference values shared with the host provider. */
export type Theme = 'light' | 'dark' | 'black' | 'system';

/** Resolved paint theme after system preference is applied. */
export type ResolvedTheme = 'light' | 'dark' | 'black';
