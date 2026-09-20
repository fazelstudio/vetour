/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  tour.ts
 *  Core domain types for projects, scenes, hotspots, and assets.
 *-----------------------------------------------------------------------------------------------*/

export type GpsTuple = [number, number, number?];

export type AssetType = 'image' | 'audio' | 'video' | 'document' | 'font';
export type ProjectCategory = 'real-estate' | 'hospitality' | 'museum' | 'education' | 'showroom' | 'other';

export interface ProjectBranding {
  logo?: string;
  favicon?: string;
  loadingScreen?: string;
  primaryColor?: string;
}

export interface AssetEntry {
  id: string;
  name: string;
  path: string;
  type: AssetType;
  size: number;
  addedAt: string;
}

export interface InfoHotspot {
  id: string;
  position?: { yaw: number | string; pitch: number | string };
  html?: string;
  image?: string;
  tooltip?: string | { className?: string; content: string; position?: string; trigger?: "hover" | "click" };
  content?: string;
  className?: string;
  size?: { width: number; height: number };
  anchor?: string;
  style?: Record<string, string>;
  data?: Record<string, unknown>;
}

export interface NavigationHotspot {
  id?: string;
  nodeId: string;
  position?: { yaw: number | string; pitch: number | string };
  gps?: GpsTuple;
  name?: string;
  arrowStyle?: Record<string, unknown>;
  markerStyle?: Record<string, unknown>;
}

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