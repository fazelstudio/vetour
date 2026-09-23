/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  projectListStore.ts
 *  Recent project list persisted to local storage.
 *-----------------------------------------------------------------------------------------------*/

import { create } from 'zustand';
import { ProjectEntry } from '@/types/projectEntry';
import { STORAGE_KEY_PROJECTS } from '@/constants';

const STORAGE_KEY = STORAGE_KEY_PROJECTS;

function loadFromStorage(): ProjectEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('vetour-projects');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProjectEntry[];
    // Migrate from the legacy Vetour key on first run after rename.
    if (!localStorage.getItem(STORAGE_KEY) && raw) {
      try {
        localStorage.setItem(STORAGE_KEY, raw);
      } catch {
        // Ignore migration write errors.
      }
    }
    return parsed;
  } catch {
    return [];
  }
}

function saveToStorage(projects: ProjectEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('Failed to save project list', e);
  }
}

interface ProjectListState {
  projects: ProjectEntry[];
  loaded: boolean;
  loadProjects: () => void;
  addProject: (entry: ProjectEntry) => void;
  removeProject: (id: string) => void;
  updateLastOpened: (id: string) => void;
}

export const useProjectListStore = create<ProjectListState>((set, get) => ({
  projects: [],
  loaded: false,

  loadProjects: () => {
    const projects = loadFromStorage();
    set({ projects, loaded: true });
  },

  addProject: (entry) => {
    const projects = [entry, ...get().projects.filter(p => p.id !== entry.id)];
    set({ projects });
    saveToStorage(projects);
  },

  removeProject: (id) => {
    const projects = get().projects.filter(p => p.id !== id);
    set({ projects });
    saveToStorage(projects);
  },

  updateLastOpened: (id) => {
    const projects = get().projects.map(p =>
      p.id === id ? { ...p, lastOpenedAt: new Date().toISOString() } : p
    );
    projects.sort((a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime());
    set({ projects });
    saveToStorage(projects);
  },
}));