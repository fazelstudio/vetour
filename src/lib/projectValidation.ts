/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  projectValidation.ts
 *  Project normalization and validation with detailed issue reporting.
 *-----------------------------------------------------------------------------------------------*/

import { CURRENT_PROJECT_SCHEMA_VERSION, DEFAULT_PROJECT_CATEGORY } from '@/constants';
import type { TourProject, TourScene } from '@/types/tour';

export interface ProjectValidationIssue {
  code: 'missing-panorama' | 'broken-link' | 'duplicate-id' | 'invalid-project';
  message: string;
  sceneId?: string;
}

export interface ProjectValidationResult {
  valid: boolean;
  issues: ProjectValidationIssue[];
}

export function normalizeProject(project: TourProject): TourProject {
  return {
    ...project,
    schemaVersion: project.schemaVersion ?? CURRENT_PROJECT_SCHEMA_VERSION,
    category: project.category ?? DEFAULT_PROJECT_CATEGORY,
    scenes: (project.scenes ?? []).map((scene) => {
      const sceneWithoutCaption = { ...scene } as TourScene & { caption?: string };
      delete sceneWithoutCaption.caption;
      return {
        ...sceneWithoutCaption,
        links: scene.links ?? [],
        markers: scene.markers ?? [],
        description: scene.description ?? '',
        notes: scene.notes ?? '',
      };
    }),
    assets: project.assets ?? [],
  };
}

export function validateProject(project: unknown): ProjectValidationResult {
  const issues: ProjectValidationIssue[] = [];
  if (!project || typeof project !== 'object') {
    return { valid: false, issues: [{ code: 'invalid-project', message: 'Project data is not an object.' }] };
  }

  const candidate = project as Partial<TourProject>;
  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string' || !Array.isArray(candidate.scenes)) {
    issues.push({ code: 'invalid-project', message: 'Project is missing required fields.' });
    return { valid: false, issues };
  }

  const sceneIds = new Set<string>();
  const knownSceneIds = new Set(candidate.scenes.map((scene) => scene.id));
  for (const scene of candidate.scenes) {
    if (sceneIds.has(scene.id)) {
      issues.push({ code: 'duplicate-id', sceneId: scene.id, message: `Duplicate scene id: ${scene.id}` });
    }
    sceneIds.add(scene.id);
    if (!scene.panorama?.trim()) {
      issues.push({ code: 'missing-panorama', sceneId: scene.id, message: `Scene "${scene.name || scene.id}" has no panorama.` });
    }
    for (const link of scene.links ?? []) {
      if (!knownSceneIds.has(link.nodeId)) {
        issues.push({ code: 'broken-link', sceneId: scene.id, message: `Scene "${scene.name || scene.id}" links to a missing scene.` });
      }
    }
  }

  return { valid: issues.length === 0, issues };
}
