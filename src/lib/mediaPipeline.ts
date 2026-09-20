/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  mediaPipeline.ts
 *  Backend media conversion orchestration shared by the UI and extensions.
 *-----------------------------------------------------------------------------------------------*/

import { invoke } from '@tauri-apps/api/core';
import { stat } from '@tauri-apps/plugin-fs';
import { appDataDir } from '@tauri-apps/api/path';
import { loadMediaSettings, qualityToCrf } from '@/lib/mediaSettings';
import type { AssetType } from '@/types/tour';

export interface ConversionInput {
  path: string;
  type: AssetType;
  id: string;
  fallbackName: string;
  fallbackSize: number;
}

export interface ConversionResult {
  path: string;
  name: string;
  size: number;
}

export const FFMPEG_MISSING_MESSAGE =
  'FFmpeg is not installed. Original file will be used. You can install it in Settings > Media.';

function joinDir(dir: string, child: string): string {
  return dir.endsWith('/') || dir.endsWith('\\') ? dir + child : dir + '/' + child;
}

// Convert one asset through the backend pipeline, falling back to the original.
export async function convertAsset(
  input: ConversionInput,
  onProgress?: (status: string, progress: number) => void,
): Promise<{ result: ConversionResult; notice?: string }> {
  const { path, type, id, fallbackName, fallbackSize } = input;
  let finalPath = path;
  let finalName = fallbackName;
  let finalSize = fallbackSize;

  try {
    const appDir = await appDataDir();
    let outputPath: string | null = null;
    const media = loadMediaSettings();

    if (type === 'image' && media.image.autoConvert) {
      const resolutions = await invoke('process_panorama', {
        sceneId: 'asset_' + id,
        sourcePath: path,
        outputDir: joinDir(appDir, 'panoramas'),
        quality: media.image.quality,
        maxWidth: media.image.maxWidth,
      }) as Array<{ label: string; path: string }>;
      const high = resolutions.find((resolution) => resolution.label === 'high') || resolutions[0];
      if (high) outputPath = high.path;
    } else if (type === 'audio' && media.audio.autoConvert) {
      onProgress?.('Converting Audio...', 50);
      outputPath = await invoke('convert_audio', {
        sourcePath: path,
        outputDir: joinDir(appDir, 'media'),
        bitrateKbps: media.audio.bitrateKbps,
      }) as string;
    } else if (type === 'video' && media.video.autoConvert) {
      onProgress?.('Converting Video...', 50);
      outputPath = await invoke('convert_video', {
        sourcePath: path,
        outputDir: joinDir(appDir, 'media'),
        options: {
          crf: qualityToCrf(media.video.quality),
          maxWidth: media.video.maxWidth,
          preset: media.video.preset,
          audioBitrateKbps: media.video.audioBitrateKbps,
          faststart: media.video.faststart,
        },
      }) as string;
    }

    if (outputPath && outputPath !== path) {
      const extMap: Record<AssetType, string> = {
        image: 'webp',
        audio: 'mp3',
        video: 'mp4',
        document: '',
        font: '',
      };
      const baseName = fallbackName.includes('.') ? fallbackName.substring(0, fallbackName.lastIndexOf('.')) : fallbackName;
      finalName = extMap[type] ? `${baseName}.${extMap[type]}` : fallbackName;
      finalPath = outputPath;
      try {
        finalSize = (await stat(outputPath)).size;
      } catch {
        // Keep the source size when the optimized output cannot be inspected.
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Conversion failed for ${fallbackName}, using original:`, error);
    if (message.includes('FFmpeg is not installed')) {
      return { result: { path: finalPath, name: finalName, size: finalSize }, notice: FFMPEG_MISSING_MESSAGE };
    }
  }

  return { result: { path: finalPath, name: finalName, size: finalSize } };
}
