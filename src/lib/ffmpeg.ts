/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  ffmpeg.ts
 *  Frontend bindings for FFmpeg status, download, and progress events.
 *-----------------------------------------------------------------------------------------------*/

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';

export interface FfmpegStatus {
  installed: boolean;
  path?: string | null;
  sizeBytes?: number | null;
  version?: string | null;
  downloading: boolean;
  downloadedBytes: number;
  totalBytes?: number | null;
  /*
  Where the binary was found: app-data (on-demand download),
  imported (user-provided file via Settings > Media),
  dev-sidecar (src-tauri/binaries in debug builds), bundled, or system PATH.
  */
  source?: string | null;
}

export interface FfmpegAssetInfo {
  supported: boolean;
  os: string;
  arch: string;
  asset?: string | null;
  url?: string | null;
  releasePage: string;
  reason?: string | null;
}

export interface FfmpegProgress {
  downloadedBytes: number;
  totalBytes?: number | null;
}

export async function getFfmpegStatus(): Promise<FfmpegStatus> {
  return invoke<FfmpegStatus>('get_ffmpeg_status');
}

export async function getFfmpegAssetInfo(): Promise<FfmpegAssetInfo> {
  return invoke<FfmpegAssetInfo>('get_ffmpeg_asset_info');
}

export async function checkFfmpegConnection(): Promise<boolean> {
  return invoke<boolean>('check_ffmpeg_connection');
}

export async function downloadFfmpeg(): Promise<FfmpegStatus> {
  return invoke<FfmpegStatus>('download_ffmpeg');
}

export async function importLocalFfmpeg(sourcePath: string): Promise<FfmpegStatus> {
  return invoke<FfmpegStatus>('import_local_ffmpeg', { sourcePath });
}

/*
Ask the user to locate an FFmpeg binary on their device.
Any file name works: the backend validates by running the file and copies
it to the canonical local name, so no manual rename is ever needed.
*/
export async function pickLocalFfmpegFile(): Promise<string | null> {
  const selected = await open({ multiple: false, title: 'Select FFmpeg binary' });
  if (!selected) return null;
  if (Array.isArray(selected)) return selected[0] ?? null;
  return selected;
}

export async function cancelFfmpegDownload(): Promise<void> {
  return invoke('cancel_ffmpeg_download');
}

export async function deleteFfmpeg(): Promise<FfmpegStatus> {
  return invoke<FfmpegStatus>('delete_ffmpeg');
}

export function onFfmpegProgress(
  callback: (progress: FfmpegProgress) => void,
): Promise<UnlistenFn> {
  return listen<FfmpegProgress>('ffmpeg-download-progress', (event) => {
    callback(event.payload);
  });
}

export function formatBytes(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isCancelError(message: unknown): boolean {
  const text = String(message ?? '').toLowerCase();
  return text.includes('cancel');
}
