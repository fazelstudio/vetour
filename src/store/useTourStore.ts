/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  useTourStore.ts
 *  Global tour state with editing actions, history, and clipboard.
 *-----------------------------------------------------------------------------------------------*/

import { create } from 'zustand';
import { generateHotspotId, HISTORY_LIMIT } from '@/constants';
import { normalizeProject } from '@/lib/projectValidation';
import type { TourProject, TourScene, InfoHotspot, NavigationHotspot, AssetEntry } from '@/types/tour';

export interface HistorySnapshot {
  id: string;
  label: string;
  createdAt: string;
  project: TourProject;
}
type HotspotClipboard = { info: InfoHotspot[]; nav: NavigationHotspot[] };
let hotspotClipboard: HotspotClipboard = { info: [], nav: [] };

interface TourState {
  project: TourProject | null;
  projectLoading: boolean;
  viewerLoading: boolean;
  activeSceneId: string | null;
  selectedHotspotId: string | null;
  selectedHotspotIds: string[];
  unsavedChanges: boolean;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  isPresentMode: boolean;
  savedPath: string | null;
  historyPast: HistorySnapshot[];
  historyFuture: HistorySnapshot[];
  historySnapshots: HistorySnapshot[];
  setProject: (project: TourProject) => void;
  setProjectLoading: (loading: boolean) => void;
  setViewerLoading: (loading: boolean) => void;
  updateProject: (project: TourProject) => void;
  loadProject: (project: TourProject) => void;
  setSavedPath: (path: string | null) => void;
  setActiveScene: (sceneId: string) => void;
  setDefaultScene: (sceneId: string) => void;
  setSelectedHotspot: (hotspotId: string | null) => void;
  setSelectedHotspots: (hotspotIds: string[]) => void;
  setUnsavedChanges: (unsaved: boolean) => void;
  setSaveStatus: (status: 'saved' | 'saving' | 'unsaved') => void;
  setPresentMode: (present: boolean) => void;
  undo: () => void;
  redo: () => void;
  restoreSnapshot: (snapshotId: string) => void;
  addScene: (scene: TourScene) => void;
  updateScene: (sceneId: string, updates: Partial<TourScene>) => void;
  deleteScene: (sceneId: string) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;
  duplicateScene: (sceneId: string) => void;
  addInfoHotspot: (sceneId: string, hotspot: InfoHotspot) => void;
  updateInfoHotspot: (sceneId: string, hotspotId: string, updates: Partial<InfoHotspot>) => void;
  deleteInfoHotspot: (sceneId: string, hotspotId: string) => void;
  addNavHotspot: (sceneId: string, hotspot: NavigationHotspot) => void;
  updateNavHotspot: (sceneId: string, hotspotId: string, updates: Partial<NavigationHotspot>) => void;
  deleteNavHotspot: (sceneId: string, hotspotId: string) => void;
  addAsset: (asset: AssetEntry) => void;
  removeAsset: (id: string) => void;
  renameAsset: (id: string, name: string) => void;
  replaceAsset: (id: string, replacement: Pick<AssetEntry, 'path' | 'size' | 'name'>) => void;
  copySelectedHotspots: () => void;
  pasteHotspots: () => void;
  duplicateSelectedHotspots: () => void;
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const snapshot = (project: TourProject, label: string): HistorySnapshot => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  label,
  createdAt: new Date().toISOString(),
  project: clone(project),
});

function normalizeHotspots(project: TourProject): TourProject {
  const normalized = normalizeProject(project);
  normalized.scenes.forEach((scene) => {
    scene.markers.forEach((marker) => { if (!marker.id) marker.id = generateHotspotId(); });
    scene.links.forEach((link) => { if (!link.id) link.id = generateHotspotId(); });
  });
  return normalized;
}

export const useTourStore = create<TourState>((set) => {
  const commit = (state: TourState, project: TourProject, label: string, extra: Partial<TourState> = {}): Partial<TourState> => {
    const current = state.project ? snapshot(state.project, label) : null;
    const past = current ? [...state.historyPast, current].slice(-HISTORY_LIMIT) : state.historyPast;
    const next = normalizeHotspots(project);
    return { ...extra, project: next, unsavedChanges: true, saveStatus: 'unsaved', historyPast: past, historyFuture: [], historySnapshots: current ? [...state.historySnapshots, current].slice(-HISTORY_LIMIT) : state.historySnapshots };
  };

  const initial = {
    project: null, projectLoading: false, viewerLoading: false, activeSceneId: null,
    selectedHotspotId: null, selectedHotspotIds: [] as string[], unsavedChanges: false, saveStatus: 'saved' as const, isPresentMode: false,
    savedPath: null, historyPast: [] as HistorySnapshot[], historyFuture: [] as HistorySnapshot[], historySnapshots: [] as HistorySnapshot[],
  };

  return {
    ...initial,
    setProjectLoading: (projectLoading) => set({ projectLoading }),
    setViewerLoading: (viewerLoading) => set({ viewerLoading }),
    setProject: (project) => set({ project: normalizeHotspots(project), activeSceneId: project.defaultSceneId || project.scenes[0]?.id || null, projectLoading: false, viewerLoading: project.scenes.length > 0 }),
    loadProject: (project) => set({ project: normalizeHotspots(project), activeSceneId: project.defaultSceneId || project.scenes[0]?.id || null, unsavedChanges: false, saveStatus: 'saved', projectLoading: false, viewerLoading: project.scenes.length > 0, selectedHotspotId: null, selectedHotspotIds: [], historyPast: [], historyFuture: [], historySnapshots: [] }),
    updateProject: (project) => set({ project: normalizeHotspots(project), projectLoading: false }),
    setSavedPath: (savedPath) => set({ savedPath }),
    setActiveScene: (activeSceneId) => set({ activeSceneId, selectedHotspotId: null, selectedHotspotIds: [] }),
    setDefaultScene: (sceneId) => set((state) => state.project ? commit(state, { ...state.project, defaultSceneId: sceneId }, 'Set start scene') : state),
    setSelectedHotspot: (selectedHotspotId) => set({ selectedHotspotId, selectedHotspotIds: selectedHotspotId ? [selectedHotspotId] : [] }),
    setSelectedHotspots: (selectedHotspotIds) => set({ selectedHotspotIds, selectedHotspotId: selectedHotspotIds[0] ?? null }),
    setUnsavedChanges: (unsavedChanges) => set({ unsavedChanges, saveStatus: unsavedChanges ? 'unsaved' : 'saved' }),
    setSaveStatus: (saveStatus) => set({ saveStatus }),
    setPresentMode: (isPresentMode) => set({ isPresentMode, selectedHotspotId: null, selectedHotspotIds: [] }),
    undo: () => set((state) => {
      if (!state.project || state.historyPast.length === 0) return state;
      const previous = state.historyPast[state.historyPast.length - 1];
      return { ...state, project: clone(previous.project), historyPast: state.historyPast.slice(0, -1), historyFuture: [snapshot(state.project, 'Redo change'), ...state.historyFuture].slice(0, HISTORY_LIMIT), unsavedChanges: true, saveStatus: 'unsaved', selectedHotspotId: null, selectedHotspotIds: [] };
    }),
    redo: () => set((state) => {
      if (!state.project || state.historyFuture.length === 0) return state;
      const next = state.historyFuture[0];
      return { ...state, project: clone(next.project), historyFuture: state.historyFuture.slice(1), historyPast: [...state.historyPast, snapshot(state.project, 'Undo change')].slice(-HISTORY_LIMIT), unsavedChanges: true, saveStatus: 'unsaved', selectedHotspotId: null, selectedHotspotIds: [] };
    }),
    restoreSnapshot: (snapshotId) => set((state) => {
      const target = state.historySnapshots.find((item) => item.id === snapshotId);
      return target ? { ...state, project: clone(target.project), unsavedChanges: true, historyPast: [...state.historyPast, snapshot(state.project!, 'Restore snapshot')].slice(-HISTORY_LIMIT), historyFuture: [], selectedHotspotId: null, selectedHotspotIds: [] } : state;
    }),
    addScene: (scene) => set((state) => state.project ? commit(state, { ...state.project, scenes: [...state.project.scenes, scene], defaultSceneId: state.project.defaultSceneId || scene.id }, 'Add scene', { activeSceneId: scene.id, selectedHotspotId: null, selectedHotspotIds: [] }) : state),
    updateScene: (sceneId, updates) => set((state) => state.project ? commit(state, { ...state.project, scenes: state.project.scenes.map((scene) => scene.id === sceneId ? { ...scene, ...updates } : scene) }, 'Update scene') : state),
    deleteScene: (sceneId) => set((state) => {
      if (!state.project) return state;
      const scenes = state.project.scenes.filter((scene) => scene.id !== sceneId);
      const defaultSceneId = state.project.defaultSceneId === sceneId ? scenes[0]?.id : state.project.defaultSceneId;
      return commit(state, { ...state.project, scenes, defaultSceneId }, 'Delete scene', { activeSceneId: state.activeSceneId === sceneId ? scenes[0]?.id ?? null : state.activeSceneId });
    }),
    reorderScenes: (fromIndex, toIndex) => set((state) => {
      if (!state.project || fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= state.project.scenes.length || toIndex >= state.project.scenes.length) return state;
      const scenes = [...state.project.scenes];
      const [moved] = scenes.splice(fromIndex, 1);
      scenes.splice(toIndex, 0, moved);
      return commit(state, { ...state.project, scenes }, 'Reorder scenes');
    }),
    duplicateScene: (sceneId) => set((state) => {
      if (!state.project) return state;
      const source = state.project.scenes.find((scene) => scene.id === sceneId);
      if (!source) return state;
      const copy: TourScene = { ...clone(source), id: `scene_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: `${source.name || 'Scene'} copy`, links: clone(source.links), markers: clone(source.markers) };
      return commit(state, { ...state.project, scenes: [...state.project.scenes, copy] }, 'Duplicate scene', { activeSceneId: copy.id });
    }),
    addInfoHotspot: (sceneId, hotspot) => set((state) => state.project ? commit(state, { ...state.project, scenes: state.project.scenes.map((scene) => scene.id === sceneId ? { ...scene, markers: [...scene.markers, hotspot] } : scene) }, 'Add hotspot') : state),
    updateInfoHotspot: (sceneId, hotspotId, updates) => set((state) => state.project ? commit(state, { ...state.project, scenes: state.project.scenes.map((scene) => scene.id === sceneId ? { ...scene, markers: scene.markers.map((hotspot) => hotspot.id === hotspotId ? { ...hotspot, ...updates } : hotspot) } : scene) }, 'Update hotspot') : state),
    deleteInfoHotspot: (sceneId, hotspotId) => set((state) => state.project ? commit(state, { ...state.project, scenes: state.project.scenes.map((scene) => scene.id === sceneId ? { ...scene, markers: scene.markers.filter((hotspot) => hotspot.id !== hotspotId) } : scene) }, 'Delete hotspot', { selectedHotspotId: state.selectedHotspotId === hotspotId ? null : state.selectedHotspotId }) : state),
    addNavHotspot: (sceneId, hotspot) => set((state) => state.project ? commit(state, { ...state.project, scenes: state.project.scenes.map((scene) => scene.id === sceneId ? { ...scene, links: [...scene.links, hotspot] } : scene) }, 'Add navigation link') : state),
    updateNavHotspot: (sceneId, hotspotId, updates) => set((state) => state.project ? commit(state, { ...state.project, scenes: state.project.scenes.map((scene) => scene.id === sceneId ? { ...scene, links: scene.links.map((hotspot) => hotspot.id === hotspotId ? { ...hotspot, ...updates } : hotspot) } : scene) }, 'Update navigation link') : state),
    deleteNavHotspot: (sceneId, hotspotId) => set((state) => state.project ? commit(state, { ...state.project, scenes: state.project.scenes.map((scene) => scene.id === sceneId ? { ...scene, links: scene.links.filter((hotspot) => hotspot.id !== hotspotId) } : scene) }, 'Delete navigation link', { selectedHotspotId: state.selectedHotspotId === hotspotId ? null : state.selectedHotspotId }) : state),
    addAsset: (asset) => set((state) => state.project ? commit(state, { ...state.project, assets: [...state.project.assets, asset] }, 'Add asset') : state),
    removeAsset: (id) => set((state) => state.project ? commit(state, { ...state.project, assets: state.project.assets.filter((asset) => asset.id !== id) }, 'Remove asset') : state),
    renameAsset: (id, name) => set((state) => state.project ? commit(state, { ...state.project, assets: state.project.assets.map((asset) => asset.id === id ? { ...asset, name } : asset) }, 'Rename asset') : state),
    replaceAsset: (id, replacement) => set((state) => {
      if (!state.project) return state;
      const previous = state.project.assets.find((asset) => asset.id === id);
      if (!previous) return state;
      const scenes = state.project.scenes.map((scene) => ({
        ...scene,
        panorama: scene.panorama === previous.path ? replacement.path : scene.panorama,
        thumbnail: scene.thumbnail === previous.path ? replacement.path : scene.thumbnail,
        markers: scene.markers.map((marker) => ({
          ...marker,
          image: marker.image === previous.path ? replacement.path : marker.image,
          data: marker.data ? Object.fromEntries(Object.entries(marker.data).map(([key, value]) => [key, value === previous.path ? replacement.path : value])) : marker.data,
        })),
      }));
      return commit(state, { ...state.project, scenes, assets: state.project.assets.map((asset) => asset.id === id ? { ...asset, ...replacement } : asset) }, 'Replace asset');
    }),
    copySelectedHotspots: () => {
      const state = useTourStore.getState();
      const scene = state.project?.scenes.find((item) => item.id === state.activeSceneId);
      if (!scene) return;
      const ids = new Set(state.selectedHotspotIds);
      hotspotClipboard = { info: clone(scene.markers.filter((item) => ids.has(item.id))), nav: clone(scene.links.filter((item) => !!item.id && ids.has(item.id))) };
    },
    pasteHotspots: () => set((state) => {
      if (!state.project || !state.activeSceneId || (!hotspotClipboard.info.length && !hotspotClipboard.nav.length)) return state;
      const info = hotspotClipboard.info.map((item) => ({ ...clone(item), id: generateHotspotId() }));
      const nav = hotspotClipboard.nav.map((item) => ({ ...clone(item), id: generateHotspotId() }));
      const selected = [...info.map((item) => item.id), ...nav.map((item) => item.id)];
      return commit(state, { ...state.project, scenes: state.project.scenes.map((scene) => scene.id === state.activeSceneId ? { ...scene, markers: [...scene.markers, ...info], links: [...scene.links, ...nav] } : scene) }, 'Paste hotspots', { selectedHotspotIds: selected, selectedHotspotId: selected[0] ?? null });
    }),
    duplicateSelectedHotspots: () => {
      const state = useTourStore.getState();
      state.copySelectedHotspots();
      state.pasteHotspots();
    },
  };
});
