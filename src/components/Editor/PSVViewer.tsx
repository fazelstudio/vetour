/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  PSVViewer.tsx
 *  Photo-sphere viewer wrapper with markers, navigation, and scene sync.
 *-----------------------------------------------------------------------------------------------*/

import { useEffect, useRef, useState } from 'react';
import { Viewer } from '@photo-sphere-viewer/core';
import { VirtualTourPlugin } from '@photo-sphere-viewer/virtual-tour-plugin';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';
import { useTourStore } from '@/store/useTourStore';
import { command } from '@/commands';
import { resolvePanoramaUrl } from '@/lib/panorama';
import { getSceneMarkers, getMarkersKey } from '@/lib/hotspotRender';
import type { VirtualTourNode } from '@photo-sphere-viewer/virtual-tour-plugin';
import type { TourProject, TourScene } from '@/types/tour';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';
import '@photo-sphere-viewer/virtual-tour-plugin/index.css';
import type { AssetEntry } from '@/types/tour';

export type { HotspotStyle } from '@/lib/hotspotRender';

/*
Marker rendering lives in lib/hotspotRender.ts so extensions can reuse it.
*/

async function buildNodesLazy(
  project: TourProject,
  activeId: string | undefined,
  onReady: (nodes: VirtualTourNode[], activeId?: string) => void
): Promise<void> {
  const allNodes: VirtualTourNode[] = [];

  if (activeId) {
    const idx = project.scenes.findIndex((s) => s.id === activeId);
    if (idx >= 0) {
      const scene = project.scenes[idx];
      try {
        const panoUrl = await resolvePanoramaUrl(scene.panorama);
        allNodes.push({
          id: scene.id,
          panorama: panoUrl,
          name: scene.name,
          sphereCorrection: scene.sphereCorrection,
          gps: scene.gps,
          map: scene.map as VirtualTourNode['map'],
          plan: scene.plan as VirtualTourNode['plan'],
        });
      } catch (err) {
        console.warn(`[PSV] Active scene "${scene.name || scene.id}" failed:`, err);
      }
    }
  }

  // Load the active scene first to keep node order stable.

  for (const scene of project.scenes) {
    if (allNodes.some((n) => n.id === scene.id)) continue;
    try {
      const panoUrl = await resolvePanoramaUrl(scene.panorama);
      allNodes.push({
        id: scene.id,
        panorama: panoUrl,
        name: scene.name,
        sphereCorrection: scene.sphereCorrection,
        gps: scene.gps,
        map: scene.map as VirtualTourNode['map'],
        plan: scene.plan as VirtualTourNode['plan'],
      });
    } catch (err) {
      console.warn(`[PSV] Skipping scene "${scene.name || scene.id}" — panorama load failed:`, err);
    }
  }

  onReady([...allNodes], activeId);
}

interface PSVViewerProps {
  onPresentMarkerClick?: (markerId: string) => void;
  onRightClickPlace?: (pos: { yaw: number; pitch: number }, screenX: number, screenY: number) => void;
  onCancelPlace?: () => void;
  onHotspotDoubleClick?: (sceneId: string, markerId: string) => void;
}

export const PSVViewer = ({ onPresentMarkerClick, onRightClickPlace, onCancelPlace, onHotspotDoubleClick }: PSVViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const virtualTourRef = useRef<VirtualTourPlugin | null>(null);
  const resetRequestedRef = useRef(false);
  const pendingFocusRef = useRef<{ id: string; position?: { yaw: number; pitch: number } } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const onPresentMarkerClickRef = useRef(onPresentMarkerClick);
  onPresentMarkerClickRef.current = onPresentMarkerClick;
  const onRightClickPlaceRef = useRef(onRightClickPlace);
  onRightClickPlaceRef.current = onRightClickPlace;
  const onCancelPlaceRef = useRef(onCancelPlace);
  onCancelPlaceRef.current = onCancelPlace;
  const onHotspotDoubleClickRef = useRef(onHotspotDoubleClick);
  onHotspotDoubleClickRef.current = onHotspotDoubleClick;
  const prevProjectRef = useRef<TourProject | null>(null);
  const prevActiveSceneRef = useRef<string | null>(null);
  const prevMarkersKeyRef = useRef<string>('');
  const lastClickRef = useRef<{ markerId: string; time: number } | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /*
  Serial load queue: every panorama/node/marker request gets a sequence number
  and runs through a promise chain, so fast clicks can never overlap.
  Stale results are discarded instead of overwriting the newest request.
  */
  const loadSeqRef = useRef(0);
  const loadChainRef = useRef<Promise<void>>(Promise.resolve());

  function enqueueLoad(task: (seq: number) => Promise<void>): number {
    const seq = loadSeqRef.current + 1;
    loadSeqRef.current = seq;
    loadChainRef.current = loadChainRef.current
      .catch(() => {
        // A previous load failed. Keep the chain alive for the next request.
      })
      .then(() => task(seq));
    return seq;
  }

  function refreshSceneMarkers(markersPlugin: MarkersPlugin, scene: TourScene, assets: AssetEntry[] = []) {
    /*
    setMarkers replaces all markers in one call.
    No separate clearMarkers, so there is never a blank frame between clear and set.
    */
    try {
      const markers = getSceneMarkers(scene, assets);
      markersPlugin.setMarkers(markers);
    } catch (err) {
      console.warn('[PSV] Marker refresh failed:', err);
    }
  }

  function isSameScenes(a: TourProject, b: TourProject): boolean {
    if (a.scenes.length !== b.scenes.length) return false;
    return a.scenes.every((s, i) => {
      const o = b.scenes[i];
      /*
      Only reload nodes when the id or panorama changes.
      Names, markers, and links are applied without a full 3D reload.
      */
      return s.id === o.id && s.panorama === o.panorama;
    });
  }

  // Clear loading flags on unmount to avoid stale state across sessions.
  useEffect(() => {
    return () => {
      command('ui.set-viewer-loading', false);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || viewerRef.current) return;

    const state = useTourStore.getState();
    const project = state.project;
    const activeId = state.activeSceneId ?? project?.scenes[0]?.id;
    prevProjectRef.current = project;
    prevActiveSceneRef.current = state.activeSceneId;

    const viewer = new Viewer({
      container: el,
      panorama: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      navbar: [],
      loadingImg: '',
      loadingTxt: '',
      lang: { loadError: '' },
      plugins: [
        [MarkersPlugin, {}],
        [VirtualTourPlugin, { positionMode: 'manual', renderMode: '3d', preload: true, transitionOptions: { showLoader: false } }],
      ],
    });

    const vp = viewer.getPlugin(VirtualTourPlugin) as VirtualTourPlugin;
    const mp = viewer.getPlugin(MarkersPlugin) as MarkersPlugin;

    vp.addEventListener('node-changed', (e) => {
      const s = useTourStore.getState();
      command('scene.activate', e.node.id);
      prevActiveSceneRef.current = e.node.id;

      const scene = s.project?.scenes.find(sc => sc.id === e.node.id);
      if (scene) {
        prevMarkersKeyRef.current = getMarkersKey(scene, s.project?.assets || []);
        refreshSceneMarkers(mp, scene, s.project?.assets || []);
      }
    });

    viewer.addEventListener('click', (e) => {
      const s = useTourStore.getState();
      if (s.isPresentMode) return;

      if (e.data?.rightclick && s.activeSceneId) {
        const pos = { yaw: e.data.yaw ?? 0, pitch: e.data.pitch ?? 0 };
        const sp = viewer.dataHelper.sphericalCoordsToViewerCoords(pos);
        onRightClickPlaceRef.current?.(pos, sp.x, sp.y);
        return;
      }

      if (e.data?.rightclick) return;
      onCancelPlaceRef.current?.();
    });

    viewer.addEventListener('position-updated', () => {
      onCancelPlaceRef.current?.();
    });

    viewer.addEventListener('panorama-load', () => {
      // Loading state is managed in the store subscription to avoid false positives.
    });

    viewer.addEventListener('panorama-loaded', () => {
      command('ui.set-viewer-loading', false);
      setIsLoading(false);
      if (resetRequestedRef.current) {
        resetRequestedRef.current = false;
        window.setTimeout(() => window.dispatchEvent(new Event('viewer-reset-apply')), 0);
      }
    });

    viewer.addEventListener('panorama-error', () => {
      /*
      Keep the previous panorama instead of a blank view.
      Retry once through the queue; a transient decode failure
      often succeeds when the texture is requested again.
      */
      enqueueLoad(async (seq) => {
        if (loadSeqRef.current !== seq) return;
        const s = useTourStore.getState();
        const scene = s.project?.scenes.find((item) => item.id === s.activeSceneId);
        if (!scene || !virtualTourRef.current) {
          setIsLoading(false);
          return;
        }
        try {
          await new Promise((resolve) => setTimeout(resolve, 500));
          if (loadSeqRef.current !== seq || !virtualTourRef.current) return;
          await virtualTourRef.current.setCurrentNode(scene.id);
        } catch (err) {
          console.warn('[PSV] Panorama retry failed:', err);
        } finally {
          if (loadSeqRef.current === seq) setIsLoading(false);
        }
      });
    });

    mp.addEventListener('select-marker', (e) => {
      const s = useTourStore.getState();
      const markerId = e.marker?.id ?? null;
      if (!markerId) return;

      const marker = mp.getMarker(markerId);
      const isNav = marker?.config.data?.isNav;
      const targetId = marker?.config.data?.targetId;

      const prev = lastClickRef.current;
      if (prev && prev.markerId === markerId && Date.now() - prev.time < 350) {
        if (clickTimerRef.current) {
          clearTimeout(clickTimerRef.current);
          clickTimerRef.current = null;
        }
        lastClickRef.current = null;

        if (!s.isPresentMode && !isNav && s.activeSceneId) {
          onHotspotDoubleClickRef.current?.(s.activeSceneId, markerId);
        }
        return;
      }

      lastClickRef.current = { markerId, time: Date.now() };

      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        const state = useTourStore.getState();

        if (isNav) {
          if (state.isPresentMode) {
            if (state.project?.scenes.some(sc => sc.id === targetId)) {
              mp.clearMarkers();
              setTimeout(() => {
                try { vp.setCurrentNode(targetId); } catch(err) { console.warn(err); }
              }, 50);
            }
          } else {
            command('selection.set-hotspot', markerId);
          }
          return;
        }

        if (state.isPresentMode) {
          onPresentMarkerClickRef.current?.(markerId);
          return;
        }
        command('selection.set-hotspot', markerId);
      }, 300);
    });

    let hoveredMarkerId: string | null = null;
    let draggingMarkerId: string | null = null;
    let draggingInitialPos: Parameters<MarkersPlugin['updateMarker']>[0]['position'] | null = null;

    mp.addEventListener('enter-marker', (e) => {
      if (useTourStore.getState().isPresentMode) return;
      hoveredMarkerId = e.marker.id;
    });

    mp.addEventListener('leave-marker', (e) => {
      if (hoveredMarkerId === e.marker.id) {
        hoveredMarkerId = null;
      }
    });

    let hasDraggedRightClick = false;

    const isInsideViewer = (target: EventTarget | null) => {
      if (!target || !el) return false;
      return el.contains(target as Node);
    };

    const handleWindowPointerDown = (e: PointerEvent) => {
      if (!isInsideViewer(e.target)) return;
      if (e.button === 1 || e.button === 2) {
        viewerRef.current?.setOption('mousemove', false);
      }
      
      if (e.button === 2) {
        hasDraggedRightClick = false;
        if (hoveredMarkerId) {
          draggingMarkerId = hoveredMarkerId;
          const marker = mp.getMarker(hoveredMarkerId);
          if (marker && marker.config.position) {
            draggingInitialPos = marker.config.position;
          }
        }
      }
    };

    const handleWindowPointerMove = (e: PointerEvent) => {
      if (draggingMarkerId) {
        hasDraggedRightClick = true;
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
          const pos = viewer.dataHelper.viewerCoordsToSphericalCoords({ x, y });
          if (pos) {
            mp.updateMarker({ id: draggingMarkerId, position: { yaw: pos.yaw, pitch: pos.pitch } });
          }
        }
      }
    };

    const handleWindowPointerUp = (e: PointerEvent) => {
      if (e.button === 1 || e.button === 2) {
        viewerRef.current?.setOption('mousemove', true);
      }

      if (e.button === 2 && draggingMarkerId) {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        let validPos = null;
        if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
          validPos = viewer.dataHelper.viewerCoordsToSphericalCoords({ x, y });
        }

        const state = useTourStore.getState();
        const activeSceneId = state.activeSceneId;

        if (validPos && activeSceneId) {
          const marker = mp.getMarker(draggingMarkerId);
          if (marker?.config.data?.isNav) {
            command('hotspot.update-nav', { sceneId: activeSceneId, hotspotId: draggingMarkerId, updates: { position: { yaw: validPos.yaw, pitch: validPos.pitch } } });
          } else {
            command('hotspot.update-info', { sceneId: activeSceneId, hotspotId: draggingMarkerId, updates: { position: { yaw: validPos.yaw, pitch: validPos.pitch } } });
          }
        } else if (draggingInitialPos) {
          mp.updateMarker({ id: draggingMarkerId, position: draggingInitialPos });
        }

        draggingMarkerId = null;
        draggingInitialPos = null;
      }
    };

    const handleWindowContextMenu = (e: MouseEvent) => {
      if (!isInsideViewer(e.target)) return;
      e.preventDefault();

      if (hasDraggedRightClick || draggingMarkerId) {
        hasDraggedRightClick = false;
        return;
      }

      const s = useTourStore.getState();
      if (s.isPresentMode || !s.activeSceneId) return;

      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const pos = viewer.dataHelper.viewerCoordsToSphericalCoords({ x, y });
      
      if (pos) {
        const sp = viewer.dataHelper.sphericalCoordsToViewerCoords(pos);
        onRightClickPlaceRef.current?.(pos, sp.x, sp.y);
      }
    };

    window.addEventListener('pointerdown', handleWindowPointerDown, true);
    window.addEventListener('pointermove', handleWindowPointerMove, true);
    window.addEventListener('pointerup', handleWindowPointerUp, true);
    window.addEventListener('contextmenu', handleWindowContextMenu, true);

    const focusPendingMarker = () => {
      const request = pendingFocusRef.current;
      if (!request) return;

      const marker = mp.getMarker(request.id);
      const position = request.position ?? (marker?.config.position as { yaw: number; pitch: number } | undefined);
      if (!position) return;

      viewer.stopAnimation();
      viewer.rotate({ yaw: position.yaw, pitch: position.pitch });
      pendingFocusRef.current = null;
    };

    const handleFocusMarker = (e: Event) => {
      const ce = e as CustomEvent<string | { id: string; position?: { yaw: number; pitch: number } }>;
      const request = typeof ce.detail === 'string'
        ? { id: ce.detail }
        : ce.detail;
      pendingFocusRef.current = request;
      focusPendingMarker();

      [50, 150, 350, 700, 1200].forEach((delay) => {
        window.setTimeout(focusPendingMarker, delay);
      });
    };
    window.addEventListener('focus-marker', handleFocusMarker);
    const handleViewerZoom = (e: Event) => {
      const delta = (e as CustomEvent<number>).detail;
      viewer.zoom(Math.max(0, Math.min(100, viewer.getZoomLevel() + delta)));
    };
    const applyViewerReset = () => {
      const state = useTourStore.getState();
      const scene = state.project?.scenes.find((item) => item.id === state.activeSceneId);
      const position = scene?.data && typeof scene.data === 'object'
        ? (scene.data as { initialView?: { yaw?: number; pitch?: number; zoom?: number } }).initialView
        : undefined;
      viewer.stopAnimation();
      viewer.rotate({ yaw: position?.yaw ?? 0, pitch: position?.pitch ?? 0 });
      viewer.zoom(position?.zoom ?? 50);
    };
    const handleViewerReset = () => {
      resetRequestedRef.current = true;
      applyViewerReset();
      window.setTimeout(applyViewerReset, 100);
    };
    window.addEventListener('viewer-zoom', handleViewerZoom);
    window.addEventListener('viewer-reset', handleViewerReset);
    window.addEventListener('viewer-reset-apply', applyViewerReset);

    viewerRef.current = viewer;
    virtualTourRef.current = vp;

    // Clear loading state every time a panorama finishes rendering.
    const onPanoramaLoaded = () => {
      setTimeout(() => {
        command('ui.set-viewer-loading', false);
        setIsLoading(false);
        // Force a resize after the skeleton overlay unmounts.
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        }, 50);
      }, 300);
    };
    viewer.addEventListener('panorama-loaded', onPanoramaLoaded);

    const initNodes = () => {
      if (project && project.scenes.length > 0) {
        setIsLoading(true);
        command('ui.set-viewer-loading', true);
        const snapshot = project;
        const snapshotActiveId = activeId;
        prevMarkersKeyRef.current = getMarkersKey(
          snapshot.scenes.find((s) => s.id === snapshotActiveId),
          snapshot.assets || [],
        );
        enqueueLoad(async (seq) => {
          if (loadSeqRef.current !== seq || !virtualTourRef.current || !viewerRef.current) return;
          const mpNow = viewerRef.current.getPlugin(MarkersPlugin) as MarkersPlugin;
          const nodes = await new Promise<VirtualTourNode[]>((resolve) => {
            void buildNodesLazy(snapshot, snapshotActiveId, (built) => resolve(built));
          });
          if (loadSeqRef.current !== seq || !virtualTourRef.current || !viewerRef.current) return;
          if (nodes.length === 0) {
            setIsLoading(false);
            command('ui.set-viewer-loading', false);
            return;
          }
          try {
            /*
            Suppress harmless viewer warnings about missing links.
            Links are rendered manually as custom markers.
            */
            const originalWarn = console.warn;
            console.warn = (...args) => {
              if (typeof args[0] === 'string') {
                if (args[0].includes('Multiple instances of Three.js')) return;
                if (args[0].includes('has no links')) return;
                if (args[0].includes('is never linked to')) return;
                if (args[0].includes("Couldn't find callback id")) return;
              }
              originalWarn.apply(console, args);
            };

            try {
              virtualTourRef.current.setNodes(nodes, snapshotActiveId);
            } finally {
              // Restore the original warning handler after load settles.
              setTimeout(() => {
                console.warn = originalWarn;
              }, 1000);
            }

            // Resize the WebGL canvas to fill its container.
            setTimeout(() => {
              window.dispatchEvent(new Event('resize'));
            }, 50);

            // Show markers for the initial scene once the node exists.
            if (snapshotActiveId && loadSeqRef.current === seq) {
              const initialScene = snapshot.scenes.find(s => s.id === snapshotActiveId);
              if (initialScene && mpNow) refreshSceneMarkers(mpNow, initialScene, snapshot.assets || []);
            }
          } catch (err) {
            console.error('[PSV] setNodes failed:', err);
          }
          /*
          The panorama-loaded listener clears loading state.
          The fallback below covers cached or instant renders.
          A stale request never clears a newer load in progress.
          */
          if (nodes.length === snapshot.scenes.length && loadSeqRef.current === seq) {
            setTimeout(() => {
              if (loadSeqRef.current !== seq) return;
              setIsLoading(false);
              command('ui.set-viewer-loading', false);
              setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
              }, 50);
            }, 800);
          }
        });
      } else {
        setIsLoading(false);
        command('ui.set-viewer-loading', false);
      }
    };

    let isReady = false;
    viewer.addEventListener('ready', () => {
      if (isReady) return;
      isReady = true;
      initNodes();
    }, { once: true });

    // Fallback when the ready event is missed or never fires.
    setTimeout(() => {
      if (!isReady) {
        isReady = true;
        initNodes();
      }
    }, 250);

    return () => {
      window.removeEventListener('pointerdown', handleWindowPointerDown, true);
      window.removeEventListener('pointermove', handleWindowPointerMove, true);
      window.removeEventListener('pointerup', handleWindowPointerUp, true);
      window.removeEventListener('contextmenu', handleWindowContextMenu, true);
      window.removeEventListener('focus-marker', handleFocusMarker);
      window.removeEventListener('viewer-zoom', handleViewerZoom);
      window.removeEventListener('viewer-reset', handleViewerReset);
      window.removeEventListener('viewer-reset-apply', applyViewerReset);
      
      viewer.destroy();
      viewerRef.current = null;
      virtualTourRef.current = null;
    };
  }, []);

  useEffect(() => {
    const unsub = useTourStore.subscribe((state) => {
      if (state.isPresentMode || !virtualTourRef.current || !viewerRef.current || !state.project) return;

      const projectChanged = state.project !== prevProjectRef.current;
      const activeChanged = state.activeSceneId !== prevActiveSceneRef.current;
      let scenesChanged = false;

      if (projectChanged) {
        scenesChanged = !prevProjectRef.current || !isSameScenes(state.project, prevProjectRef.current);
        prevProjectRef.current = state.project;
      }

      const snapshot = state.project;
      const snapshotActiveId = state.activeSceneId ?? snapshot.scenes[0]?.id;
      const activeScene = snapshot.scenes.find(s => s.id === snapshotActiveId);
      const markersKey = getMarkersKey(activeScene, snapshot.assets || []);
      const markersChanged = markersKey !== prevMarkersKeyRef.current;
      if (markersChanged) prevMarkersKeyRef.current = markersKey;

      if (projectChanged && scenesChanged) {
        /*
        Structure changed (open file, add/remove scene, panorama replaced):
        rebuild nodes through the serial queue. Stale builds are discarded.
        */
        setIsLoading(true);
        command('ui.set-viewer-loading', true);
        enqueueLoad(async (seq) => {
          if (loadSeqRef.current !== seq || !virtualTourRef.current || !viewerRef.current) return;
          const mpNow = viewerRef.current.getPlugin(MarkersPlugin) as MarkersPlugin;
          const nodes = await new Promise<VirtualTourNode[]>((resolve) => {
            void buildNodesLazy(snapshot, snapshotActiveId, (built) => resolve(built));
          });
          if (loadSeqRef.current !== seq || !virtualTourRef.current || !viewerRef.current) return;
          if (nodes.length === 0) {
            setIsLoading(false);
            command('ui.set-viewer-loading', false);
            return;
          }
          try {
            // Suppress harmless viewer warnings about missing links.
            const originalWarn = console.warn;
            console.warn = (...args) => {
              if (typeof args[0] === 'string') {
                if (args[0].includes('Multiple instances of Three.js')) return;
                if (args[0].includes('has no links')) return;
                if (args[0].includes('is never linked to')) return;
              }
              originalWarn.apply(console, args);
            };

            try {
              virtualTourRef.current.setNodes(nodes, snapshotActiveId);
            } finally {
              setTimeout(() => {
                console.warn = originalWarn;
              }, 1000);
            }

            // Resize the WebGL canvas to fill its container.
            setTimeout(() => {
              window.dispatchEvent(new Event('resize'));
            }, 50);

            if (snapshotActiveId && loadSeqRef.current === seq) {
              const nextScene = snapshot.scenes.find(s => s.id === snapshotActiveId);
              if (nextScene && mpNow) refreshSceneMarkers(mpNow, nextScene, snapshot.assets || []);
            }
            prevActiveSceneRef.current = snapshotActiveId ?? null;
          } catch (err) {
            console.error('[PSV] setNodes (subscribe) failed:', err);
          }
          /*
          Loading is cleared by the panorama-loaded listener.
          Keep a fallback for cached renders that skip the event.
          */
          if (loadSeqRef.current === seq) {
            setTimeout(() => {
              if (loadSeqRef.current !== seq) return;
              setIsLoading(false);
              command('ui.set-viewer-loading', false);
              setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
              }, 50);
            }, 800);
          }
        });
        return;
      }

      if (activeChanged) {
        prevActiveSceneRef.current = state.activeSceneId;
        if (virtualTourRef.current && state.activeSceneId) {
          enqueueLoad(async (seq) => {
            if (loadSeqRef.current !== seq || !virtualTourRef.current || !viewerRef.current) return;
            try {
              if (virtualTourRef.current.getCurrentNode()?.id !== state.activeSceneId) {
                /*
                Never clear markers before the new node is confirmed.
                Markers refresh on node-changed, so a failed switch
                keeps the old panorama and markers instead of a blank view.
                */
                setIsLoading(true);
                await virtualTourRef.current.setCurrentNode(state.activeSceneId!);
              }
              if (loadSeqRef.current !== seq || !viewerRef.current) return;
              const mpNow = viewerRef.current.getPlugin(MarkersPlugin) as MarkersPlugin;
              const nextScene = useTourStore.getState().project?.scenes.find(s => s.id === state.activeSceneId);
              if (nextScene && mpNow) {
                prevMarkersKeyRef.current = getMarkersKey(nextScene, useTourStore.getState().project?.assets || []);
                refreshSceneMarkers(mpNow, nextScene, useTourStore.getState().project?.assets || []);
              }
            } catch (e) {
              console.warn('[PSV] setCurrentNode failed:', e);
            } finally {
              if (loadSeqRef.current === seq) {
                setIsLoading(false);
                command('ui.set-viewer-loading', false);
              }
            }
          });
        }
        return;
      }

      if (projectChanged && markersChanged) {
        /*
        Only hotspot metadata changed (name, icon, color, font, style):
        the panorama is already correct, so refresh markers in place.
        This is the real-time path for PropertyPanel edits.
        */
        setIsLoading(false);
        command('ui.set-viewer-loading', false);
        const mpNow = viewerRef.current.getPlugin(MarkersPlugin) as MarkersPlugin;
        if (mpNow && activeScene) {
          refreshSceneMarkers(mpNow, activeScene, snapshot.assets || []);
        }
      }
    });
    return unsub;
  }, []);

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <svg className="w-8 h-8 text-primary animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm font-medium text-text-primary">Loading panorama...</p>
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full [&_.psv-navbar]:!hidden [&_.psv-loader-container]:!hidden [&_.psv-overlay]:!hidden [&_.psv-notification]:!hidden [&_.psv-error]:!hidden" />
    </div>
  );
};