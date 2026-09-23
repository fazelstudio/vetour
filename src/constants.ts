/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  constants.ts
 *  Shared application constants, limits, and ID generators.
 *-----------------------------------------------------------------------------------------------*/

export const DEFAULT_PROJECT_NAME = 'Untitled';
export const APP_NAME = 'Obsipano';
export const FAZELSTUDIO_URL = 'https://fazelstudio.vercel.app';

export const PROJECT_ID_PREFIX = 'proj_';
export const SCENE_ID_PREFIX = 'scene_';
export const HOTSPOT_ID_PREFIX = 'hotspot_';
export const ASSET_ID_PREFIX = 'asset_';
export const TOAST_ID_PREFIX = 'toast_';

export const STORAGE_KEY_PROJECTS = 'obsipano-projects';
export const STORAGE_KEY_THEME = 'obsipano-theme';
export const STORAGE_KEY_MEDIA_SETTINGS = 'obsipano-media-settings';

export const PRESENT_WINDOW_SIZE_RATIO = 0.7;
export const PRESENT_WINDOW_MIN_RATIO = 0.6;
export const MAIN_WINDOW_MIN_RATIO = 0.6;

export const MAX_UPLOAD_SIZE = 15 * 1024 * 1024;
export const MAX_UPLOAD_SIZE_MB = 15;
export const MAX_ASSET_LIMITS: Record<string, number> = {
  image: 20,
  video: 5,
  audio: 5,
  document: 5,
  font: 5,
};

export const MAX_TOASTS = 5;
export const MAX_RECENT_PROJECTS_HOME = 5;
export const MAX_RECENT_PROJECTS_MODAL = 10;

export const FILE_FILTER_NAME = 'Obsipano Project';
export const FILE_FILTER_EXTENSIONS = ['obsipano'] as const;
export const PLUGIN_FILE_FILTER_NAME = 'Obsipano Plugin';
export const PLUGIN_FILE_FILTER_EXTENSIONS = ['veix'] as const;

export const MODAL_MAX_HEIGHT_RATIO = 0.7;
export const CURRENT_PROJECT_SCHEMA_VERSION = 3;
export const HISTORY_LIMIT = 80;
export const AUTOSAVE_INTERVAL_MS = 10_000;
export const DEFAULT_PROJECT_CATEGORY = 'other' as const;
export const PROJECT_CATEGORY_OPTIONS = [
  { value: 'real-estate', label: 'Real estate' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'museum', label: 'Museum' },
  { value: 'education', label: 'Education' },
  { value: 'showroom', label: 'Showroom' },
  { value: 'other', label: 'Other' },
] as const;
export const KEYBOARD_SHORTCUTS = {
  undo: 'Ctrl+Z',
  redo: 'Ctrl+Shift+Z',
  save: 'Ctrl+S',
  duplicate: 'Ctrl+D',
  copy: 'Ctrl+C',
  paste: 'Ctrl+V',
} as const;

export const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown',
  csv: 'text/csv', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ttf: 'font/ttf', woff: 'font/woff', woff2: 'font/woff2',
};

export function getMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export function generateId(prefix: string): string {
  return `${prefix}${Math.random().toString(36).substring(2, 9)}`;
}

export function generateProjectId(): string {
  return PROJECT_ID_PREFIX + Date.now();
}

export function generateSceneId(): string {
  return generateId(SCENE_ID_PREFIX);
}

export function generateHotspotId(): string {
  return generateId(HOTSPOT_ID_PREFIX);
}

export function generateAssetId(): string {
  return generateId(ASSET_ID_PREFIX);
}

export function generateToastId(): string {
  return TOAST_ID_PREFIX + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
}

export const HOTSPOT_ACTION_OPTIONS = [
  { value: 'navigate', label: 'Navigate to' },
  { value: 'show_image', label: 'Show Image' },
  { value: 'show_video', label: 'Show Video' },
  { value: 'show_text', label: 'Show Text' },
  { value: 'play_sound', label: 'Play Sound' },
  { value: 'show_document', label: 'Show Document' },
] as const;

export const TEXT_ALIGN_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
] as const;

export const MEDIA_QUALITY_MIN = 10;
export const MEDIA_QUALITY_MAX = 100;
export const MEDIA_QUALITY_DEFAULT = 80;

export const IMAGE_WIDTH_OPTIONS = [
  { value: '2048', label: '2048 px' },
  { value: '4096', label: '4096 px (recommended)' },
  { value: '8192', label: '8192 px (maximum)' },
] as const;

export const AUDIO_BITRATE_OPTIONS = [
  { value: '128', label: '128 kbps' },
  { value: '192', label: '192 kbps (recommended)' },
  { value: '256', label: '256 kbps' },
  { value: '320', label: '320 kbps (maximum)' },
] as const;

export const VIDEO_RESOLUTION_OPTIONS = [
  { value: '1280', label: '720p (1280 px)' },
  { value: '1920', label: '1080p (1920 px, recommended)' },
  { value: '3840', label: '4K (3840 px, maximum)' },
] as const;

export const VIDEO_PRESET_OPTIONS = [
  { value: 'veryfast', label: 'Very fast (larger file)' },
  { value: 'fast', label: 'Fast' },
  { value: 'medium', label: 'Medium (recommended)' },
  { value: 'slow', label: 'Slow (smaller file)' },
  { value: 'veryslow', label: 'Very slow (smallest file)' },
] as const;

export const VIDEO_AUDIO_BITRATE_OPTIONS = [
  { value: '96', label: '96 kbps' },
  { value: '128', label: '128 kbps (recommended)' },
  { value: '192', label: '192 kbps' },
] as const;
