/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  mediaSettings.ts
 *  Persistent media conversion settings with defaults and quality mapping.
 *-----------------------------------------------------------------------------------------------*/

import {
  MEDIA_QUALITY_DEFAULT,
  MEDIA_QUALITY_MAX,
  MEDIA_QUALITY_MIN,
  STORAGE_KEY_MEDIA_SETTINGS,
} from '@/constants';

export interface ImageMediaSettings {
  autoConvert: boolean;
  quality: number;
  maxWidth: number;
}

export interface AudioMediaSettings {
  autoConvert: boolean;
  bitrateKbps: number;
}

export interface VideoMediaSettings {
  autoConvert: boolean;
  quality: number;
  maxWidth: number;
  preset: string;
  audioBitrateKbps: number;
  faststart: boolean;
}

export interface MediaSettings {
  version: 1;
  image: ImageMediaSettings;
  audio: AudioMediaSettings;
  video: VideoMediaSettings;
}

export const DEFAULT_MEDIA_SETTINGS: MediaSettings = {
  version: 1,
  image: { autoConvert: true, quality: MEDIA_QUALITY_DEFAULT, maxWidth: 4096 },
  audio: { autoConvert: true, bitrateKbps: 192 },
  video: {
    autoConvert: true,
    quality: MEDIA_QUALITY_DEFAULT,
    maxWidth: 1920,
    preset: 'medium',
    audioBitrateKbps: 128,
    faststart: true,
  },
};

function clampQuality(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MEDIA_QUALITY_MAX, Math.max(MEDIA_QUALITY_MIN, Math.round(n)));
}

function clampOneOf(value: unknown, allowed: number[], fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (allowed.includes(n)) return n;
  return fallback;
}

/*
Map a 10-100 quality percentage to an x264 CRF value.
Quality 80 maps to CRF 23, matching the previous fixed behavior.
Higher quality means a lower CRF and a larger file.
*/
export function qualityToCrf(quality: number): number {
  const q = Math.min(MEDIA_QUALITY_MAX, Math.max(MEDIA_QUALITY_MIN, quality));
  return Math.min(34, Math.max(16, Math.round(38 - q * 0.19)));
}

export function loadMediaSettings(): MediaSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MEDIA_SETTINGS) ?? localStorage.getItem('vetour-media-settings');
    if (!raw) return structuredClone(DEFAULT_MEDIA_SETTINGS);
    const parsed = JSON.parse(raw) as Partial<MediaSettings>;
    return {
      version: 1,
      image: {
        autoConvert: parsed.image?.autoConvert ?? true,
        quality: clampQuality(parsed.image?.quality, DEFAULT_MEDIA_SETTINGS.image.quality),
        maxWidth: clampOneOf(parsed.image?.maxWidth, [2048, 4096, 8192], 4096),
      },
      audio: {
        autoConvert: parsed.audio?.autoConvert ?? true,
        bitrateKbps: clampOneOf(parsed.audio?.bitrateKbps, [128, 192, 256, 320], 192),
      },
      video: {
        autoConvert: parsed.video?.autoConvert ?? true,
        quality: clampQuality(parsed.video?.quality, DEFAULT_MEDIA_SETTINGS.video.quality),
        maxWidth: clampOneOf(parsed.video?.maxWidth, [1280, 1920, 3840], 1920),
        preset: typeof parsed.video?.preset === 'string' && parsed.video.preset ? parsed.video.preset : 'medium',
        audioBitrateKbps: clampOneOf(parsed.video?.audioBitrateKbps, [96, 128, 192], 128),
        faststart: parsed.video?.faststart ?? true,
      },
    };
  } catch {
    return structuredClone(DEFAULT_MEDIA_SETTINGS);
  }
}

export function saveMediaSettings(settings: MediaSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_MEDIA_SETTINGS, JSON.stringify(settings));
  } catch {
    // Storage may be unavailable; settings still apply for this session.
  }
}
