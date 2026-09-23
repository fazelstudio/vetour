/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  presentWindow.ts
 *  Platform helper for opening the separate Present window.
 *-----------------------------------------------------------------------------------------------*/

import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { TourProject } from '@/types/tour';
import { blobUrlCache } from './obsipanoFile';
import { DEFAULT_PROJECT_NAME, PRESENT_WINDOW_SIZE_RATIO, PRESENT_WINDOW_MIN_RATIO } from '@/constants';

export interface PresentWindowEvents {
  onCreated?: () => void;
  onDestroyed?: () => void;
  onError?: (message: string) => void;
}

// Open the Present window without touching UI stores; callers sync state via commands.
export async function openPresentWindow(project: TourProject | null, events?: PresentWindowEvents) {
  const name = project?.name?.trim();
  const title = name ? (name === DEFAULT_PROJECT_NAME ? `Present - ${DEFAULT_PROJECT_NAME}` : `Present - ${name}`) : `Present - ${DEFAULT_PROJECT_NAME}`;

  const width = Math.floor(window.screen.width * PRESENT_WINDOW_SIZE_RATIO);
  const height = Math.floor(window.screen.height * PRESENT_WINDOW_SIZE_RATIO);

  const label = 'present-' + Date.now();


  const presentData = {
    project,
    assetMap: Object.fromEntries(blobUrlCache.entries())
  };

  // Store project data in Rust global state for access from any webview.
  await invoke('store_present_data', { data: JSON.stringify(presentData) });

  const w = new WebviewWindow(label, {
    url: '/?mode=present',
    title,
    width,
    height,
    minWidth: Math.floor(window.screen.width * PRESENT_WINDOW_MIN_RATIO),
    minHeight: Math.floor(window.screen.height * PRESENT_WINDOW_MIN_RATIO),
    center: true,
    focus: true,
    decorations: false,
    visible: false,
  });

  w.once('tauri://created', async () => {
    await w.show();
    await w.setFocus();
    events?.onCreated?.();
  });

  w.once('tauri://destroyed', () => {
    events?.onDestroyed?.();
  });

  const unlisten = await listen('present-closed', () => {
    events?.onDestroyed?.();
    w.close().catch(() => {});
  });

  w.once('tauri://error', (e) => {
    console.error('Present window error:', e);
    events?.onError?.('Failed to open present window.');
  });

  return () => unlisten();
}
