/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  panorama.ts
 *  Asset URL resolution with local file and blob URL caching.
 *-----------------------------------------------------------------------------------------------*/

import { convertFileSrc } from '@tauri-apps/api/core';
import { readFile } from '@tauri-apps/plugin-fs';
import { getMime } from '@/constants';

import { blobUrlCache } from './vetourFile';

export function getAssetUrl(path: string): string {
  if (!path) return '';
  if (blobUrlCache.has(path)) return blobUrlCache.get(path)!;
  if (path.startsWith('http') || path.startsWith('asset:') || path.startsWith('blob:')) return path;
  try { return convertFileSrc(path); } catch { return path; }
}

const panoramaBlobCache = new Map<string, string>();

/*
Clear cached panorama blob URLs, e.g. when a new project file is opened.
Revokes object URLs to free memory and prevents stale URLs from surviving a reload.
*/
export function clearPanoramaCache(): void {
  for (const url of panoramaBlobCache.values()) {
    if (url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore revoke failures for already-released URLs.
      }
    }
  }
  panoramaBlobCache.clear();
}

const FILE_READ_TIMEOUT = 30000;

async function readFileWithTimeout(path: string): Promise<Uint8Array> {
  return Promise.race([
    readFile(path),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`File read timed out after ${FILE_READ_TIMEOUT / 1000}s: ${path}`)), FILE_READ_TIMEOUT)
    ),
  ]);
}

export async function resolvePanoramaUrl(path: string): Promise<string> {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('blob:')) return path;

  if (blobUrlCache.has(path)) return blobUrlCache.get(path)!;
  const cached = panoramaBlobCache.get(path);
  if (cached) return cached;

  try {
    const bytes = await readFileWithTimeout(path);
    const mime = getMime(path) || 'image/jpeg';
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    panoramaBlobCache.set(path, url);
    return url;
  } catch (err) {
    console.warn('[PSV] File read failed, falling back to asset URL:', err);
    /*
    Do not cache the fallback so a transient read failure can succeed on retry.
    Caching a fallback would pin the failure permanently until restart.
    */
    return getAssetUrl(path);
  }
}
