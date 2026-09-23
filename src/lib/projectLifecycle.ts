/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  projectLifecycle.ts
 *  Project creation and atomic save orchestration shared by commands and UI.
 *-----------------------------------------------------------------------------------------------*/

import { save } from '@tauri-apps/plugin-dialog';
import { saveObsipanoFile } from '@/lib/obsipanoFile';
import { lockProjectFile, unlockProjectFile } from '@/lib/fileLock';
import { useTourStore } from '@/store/useTourStore';
import { useProjectListStore } from '@/store/projectListStore';
import { useToastStore } from '@/store/toastStore';
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  DEFAULT_PROJECT_NAME,
  FILE_FILTER_EXTENSIONS,
  FILE_FILTER_NAME,
  generateProjectId,
} from '@/constants';
import type { TourProject } from '@/types/tour';

// Extract a display name from a file path when the project still uses the default name.
function fileNameFromPath(path: string, fallback: string): string {
  return path.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || fallback;
}

// Persist the project atomically and sync store flags plus the recent list.
async function persistToPath(path: string, project: TourProject): Promise<void> {
  const updated: TourProject = { ...project, updatedAt: new Date().toISOString() };
  await unlockProjectFile();
  await saveObsipanoFile(path, updated);
  await lockProjectFile(path);
  const tour = useTourStore.getState();
  tour.updateProject(updated);
  tour.setSavedPath(path);
  tour.setUnsavedChanges(false);
  const displayName =
    updated.name === DEFAULT_PROJECT_NAME ? fileNameFromPath(path, updated.name) : updated.name;
  // Keep the stored project name in sync when it was still the default name.
  if (displayName !== updated.name) {
    tour.updateProject({ ...updated, name: displayName });
  }
  useProjectListStore.getState().addProject({
    id: updated.id,
    name: displayName,
    folderPath: path,
    createdAt: updated.createdAt,
    lastOpenedAt: new Date().toISOString(),
  });
}

// Build a fresh empty project without touching the store.
export function buildNewProject(name?: string): TourProject {
  const now = new Date().toISOString();
  return {
    id: generateProjectId(),
    name: name?.trim() || DEFAULT_PROJECT_NAME,
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    scenes: [],
    assets: [],
  };
}

// Create a new project and load it into the store.
export function createAndLoadProject(name?: string): void {
  const tour = useTourStore.getState();
  tour.loadProject(buildNewProject(name));
  tour.setSavedPath(null);
}

// Save to the current path, falling back to a dialog when no path exists yet.
export async function saveCurrentProject(): Promise<void> {
  const tour = useTourStore.getState();
  const project = tour.project;
  if (!project) return;
  try {
    if (tour.savedPath) {
      await persistToPath(tour.savedPath, project);
      return;
    }
    await saveCurrentProjectAs();
  } catch (e) {
    console.error('Save error', e);
    useToastStore.getState().addToast({ type: 'danger', message: 'Failed to save project.' });
  }
}

// Always prompt for a path, returning false when the user cancels.
export async function saveCurrentProjectAs(): Promise<boolean> {
  const tour = useTourStore.getState();
  const project = tour.project;
  if (!project) return false;
  try {
    const selected = await save({
      filters: [{ name: FILE_FILTER_NAME, extensions: [...FILE_FILTER_EXTENSIONS] }],
      defaultPath: `${project.name}.obsipano`,
    });
    if (!selected) return false;
    await persistToPath(selected, project);
    return true;
  } catch (e) {
    console.error('Save error', e);
    useToastStore.getState().addToast({ type: 'danger', message: 'Failed to save project.' });
    return false;
  }
}
