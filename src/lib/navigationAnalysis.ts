/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  navigationAnalysis.ts
 *  Pure navigation diagnostics shared by the editor and future extensions.
 *-----------------------------------------------------------------------------------------------*/

import type { TourProject, TourScene } from '@/types/tour';

export interface NavigationAnalysis {
  incoming: Map<string, number>;
  outgoing: Map<string, number>;
  reachable: Set<string>;
  unreachable: TourScene[];
  startSceneId?: string;
}

// Compute incoming/outgoing link counts and reachability from the start scene.
export function analyzeNavigation(project: TourProject | null): NavigationAnalysis {
  const scenes = project?.scenes ?? [];
  const incoming = new Map(scenes.map((scene) => [scene.id, 0]));
  const outgoing = new Map(scenes.map((scene) => [scene.id, scene.links.length]));
  for (const scene of scenes) {
    for (const link of scene.links) {
      if (incoming.has(link.nodeId)) {
        incoming.set(link.nodeId, (incoming.get(link.nodeId) ?? 0) + 1);
      }
    }
  }
  const startSceneId = project?.defaultSceneId ?? scenes[0]?.id;
  const reachable = new Set<string>();
  const queue = startSceneId ? [startSceneId] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const scene = scenes.find((item) => item.id === id);
    scene?.links.forEach((link) => {
      if (!reachable.has(link.nodeId)) queue.push(link.nodeId);
    });
  }
  return {
    incoming,
    outgoing,
    reachable,
    unreachable: scenes.filter((scene) => !reachable.has(scene.id)),
    startSceneId,
  };
}
