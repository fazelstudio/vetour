/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  fileLock.ts
 *  Frontend bindings for exclusive project file locking.
 *-----------------------------------------------------------------------------------------------*/

import { invoke } from '@tauri-apps/api/core';

export const lockProjectFile = async (path: string) => {
  try {
    await invoke('lock_project_file', { path });
  } catch (e) {
    console.error('Failed to lock project file:', e);
  }
};

export const unlockProjectFile = async () => {
  try {
    await invoke('unlock_project_file');
  } catch (e) {
    console.error('Failed to unlock project file:', e);
  }
};