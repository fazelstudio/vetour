/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  hotspotRender.ts
 *  Pure hotspot marker rendering shared by the viewer and future extensions.
 *-----------------------------------------------------------------------------------------------*/

import { LUCIDE_ICONS } from '@/icons';
import { getAssetUrl } from '@/lib/panorama';
import type { AssetEntry, InfoHotspot, NavigationHotspot, TourScene } from '@/types/tour';

export interface HotspotStyle {
  bgType?: 'solid' | 'gradient';
  bgColor?: string;
  bgGradient?: string;
  textColor?: string;
  iconColor?: string;
  radius?: string;
  icon?: string;
  fontFamilyAssetId?: string;
  opacity?: number;
}

export function getActionMarkerIcon(action: string, label: string, style?: HotspotStyle, fontUrl?: string): string {
  let iconSvg: string;

  if (style?.icon && LUCIDE_ICONS[style.icon]) {
    iconSvg = LUCIDE_ICONS[style.icon];
  } else {
    switch (action) {
      case 'navigate': iconSvg = LUCIDE_ICONS['arrow-up']; break;
      case 'show_image': iconSvg = LUCIDE_ICONS['image']; break;
      case 'show_video': iconSvg = LUCIDE_ICONS['video']; break;
      case 'show_text': iconSvg = LUCIDE_ICONS['file-text']; break;
      case 'show_document': iconSvg = LUCIDE_ICONS['file-text']; break;
      case 'play_sound': iconSvg = LUCIDE_ICONS['music']; break;
      default: iconSvg = LUCIDE_ICONS['info'];
    }
  }
  const bgOpacity = style?.opacity ?? 0.6; // Default opacity for backward compatibility.
  let bg = style?.bgType === 'gradient' ? (style.bgGradient || 'linear-gradient(90deg, rgba(255,0,0,1) 0%, rgba(0,0,255,1) 100%)') : (style?.bgColor || '#000000');

  // Convert a solid HEX color to RGBA so background opacity can be applied.
  if (style?.bgType !== 'gradient') {
    const hex = bg.startsWith('#') ? bg : '#000000';
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    bg = `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
  } else {
    /*
    Gradient backgrounds keep their own opacity.
    Opacity is applied through the element style instead.
    */
  }

  /*
  Hotspot opacity controls the background fill only, so the label text stays readable.
  Solid colors use RGBA. Gradients rely on their own stops plus the element opacity fallback.
  */

  const textColor = style?.textColor || '#ffffff';
  const iconColor = style?.iconColor || '#ffffff';
  const radius = style?.radius || '9999px';
  const fontFamily = fontUrl ? `'CustomFont_${style?.fontFamilyAssetId}', sans-serif` : 'sans-serif';

  const fontFormat = fontUrl ? (() => {
    const ext = fontUrl.split('.').pop()?.toLowerCase();
    if (ext === 'woff2') return 'woff2';
    if (ext === 'woff') return 'woff';
    return 'truetype';
  })() : '';
  const fontFaceStyle = fontUrl ? `<style>
    @font-face {
      font-family: 'CustomFont_${style!.fontFamilyAssetId}';
      src: url('${fontUrl}') format('${fontFormat}');
    }
  </style>` : '';

  return `
    ${fontFaceStyle}
    <div style="
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: ${bg};
      ${style?.bgType === 'gradient' ? `opacity: ${bgOpacity};` : ''}
      color: ${textColor};
      border-radius: ${radius};
      font-family: ${fontFamily};
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(4px);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      transition: all 0.2s ease-in-out;
      white-space: nowrap;
    " onmouseover="this.style.filter='brightness(1.2)';" onmouseout="this.style.filter='brightness(1)';">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${iconSvg}
      </svg>
      <span>${label}</span>
    </div>
  `;
}

export function getMarkerId(m: NavigationHotspot | InfoHotspot): string {
  if ('nodeId' in m) return m.id || 'nav_' + m.nodeId;
  return m.id || `hotspot_${Math.random().toString(36).substring(2, 9)}`;
}

export function getMarkerData(m: NavigationHotspot | InfoHotspot, assets: AssetEntry[] = []): { id: string; position: { yaw: number; pitch: number }; html: string; anchor?: string, data?: Record<string, unknown> } {
  const id = getMarkerId(m);
  const pos = m.position
    ? { yaw: Number(m.position.yaw) || 0, pitch: Number(m.position.pitch) || 0 }
    : { yaw: 0, pitch: 0 };

  const md = ('data' in m ? (m.data ?? {}) : {}) as Record<string, unknown>;
  /*
  Navigation hotspots historically stored style in markerStyle.
  Newer saves use data.style. Read both so old and new projects render identically.
  */
  const markerStyleHolder = m as unknown as { markerStyle?: HotspotStyle };
  const style = (md.style as HotspotStyle | undefined) ?? markerStyleHolder.markerStyle;

  let fontUrl = '';
  if (style?.fontFamilyAssetId) {
    const fontAsset = assets.find(a => a.id === style.fontFamilyAssetId);
    if (fontAsset) {
      fontUrl = getAssetUrl(fontAsset.path);
    }
  }

  if ('nodeId' in m) {
    const name = m.name || 'Navigate';
    return {
      id,
      position: pos,
      html: getActionMarkerIcon('navigate', name, style, fontUrl),
      anchor: 'center center',
      data: { isNav: true, targetId: m.nodeId, style }
    };
  }

  const action = (md.action as string) || (m.image ? 'show_image' : m.content ? 'show_text' : 'show_text');
  const tooltip = typeof m.tooltip === 'string' ? m.tooltip : m.tooltip?.content || 'Hotspot';
  return {
    id,
    position: pos,
    html: getActionMarkerIcon(action, tooltip, style, fontUrl),
    anchor: 'center center',
    data: m.data
  };
}

export function getSceneMarkers(scene: TourScene, assets: AssetEntry[] = []) {
  const markers: Array<ReturnType<typeof getMarkerData>> = [];
  for (const link of scene.links) {
    if (link.nodeId === scene.id) continue;
    markers.push(getMarkerData(link, assets));
  }
  for (const m of scene.markers) {
    markers.push(getMarkerData(m, assets));
  }
  return markers;
}

/*
Fingerprint of everything rendered on top of the panorama: hotspot ids,
positions, labels, actions, styles, and font assets. When only this key
changes, the panorama is already correct and only markers need a refresh.
*/
export function getMarkersKey(scene: TourScene | undefined, assets: AssetEntry[] = []): string {
  if (!scene) return '';
  try {
    return JSON.stringify({
      markers: getSceneMarkers(scene, assets),
      assets: assets.map((a) => `${a.id}:${a.path}`),
    });
  } catch {
    return `${scene.markers.length}:${scene.links.length}:${assets.length}`;
  }
}
