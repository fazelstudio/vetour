/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  NavigationGraph.tsx
 *  Diagnostic view of scene links, reachability, and start scene.
 *-----------------------------------------------------------------------------------------------*/

import { useMemo } from 'react';
import { AlertTriangle, ArrowRight, Circle, Play } from 'lucide-react';
import { useTourStore } from '@/store/useTourStore';
import { analyzeNavigation } from '@/lib/navigationAnalysis';
import { command } from '@/commands';

interface NavigationGraphProps {
  onOpenScene: () => void;
}

export function NavigationGraph({ onOpenScene }: NavigationGraphProps) {
  const project = useTourStore((state) => state.project);

  const analysis = useMemo(() => analyzeNavigation(project), [project]);

  if (!project) return <div className="h-full flex items-center justify-center text-sm text-text-secondary">Open a project to inspect its navigation.</div>;

  return (
    <div className="flex flex-col h-full bg-background p-8 overflow-y-auto custom-scroll">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Navigation graph</h1>
          <p className="text-sm text-text-secondary mt-1">A fast diagnostic view of how visitors move through the tour.</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-xs text-text-secondary">
          {project.scenes.length} scenes · {project.scenes.reduce((sum, scene) => sum + scene.links.length, 0)} links
        </div>
      </div>

      {analysis.unreachable.length > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div><strong>Unreachable scenes:</strong> {analysis.unreachable.map((scene) => scene.name || scene.id).join(', ')}</div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {project.scenes.map((scene) => {
          const isStart = scene.id === (project.defaultSceneId ?? project.scenes[0]?.id);
          const orphan = (analysis.incoming.get(scene.id) ?? 0) === 0 && !isStart;
          return (
            <button key={scene.id} onClick={() => { command('scene.activate', scene.id); onOpenScene(); }} className="text-left rounded-2xl border border-border bg-card p-4 hover:border-primary/60 hover:shadow-lg transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Circle className={`w-3 h-3 shrink-0 ${isStart ? 'fill-primary text-primary' : 'text-text-secondary'}`} />
                    <span className="font-medium text-text-primary truncate">{scene.name || 'Untitled scene'}</span>
                  </div>
                  {isStart && <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary"><Play className="w-3 h-3" /> Start</span>}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                  <div className="rounded-xl bg-surface p-2"><div className="text-text-secondary">Incoming</div><strong className="text-text-primary">{analysis.incoming.get(scene.id) ?? 0}</strong></div>
                  <div className="rounded-xl bg-surface p-2"><div className="text-text-secondary">Outgoing</div><strong className="text-text-primary">{analysis.outgoing.get(scene.id) ?? 0}</strong></div>
                  <div className={`rounded-xl p-2 ${orphan ? 'bg-amber-500/10' : 'bg-surface'}`}><div className="text-text-secondary">Reachable</div><strong className={orphan ? 'text-amber-600' : 'text-text-primary'}>{analysis.unreachable.includes(scene) ? 'No' : 'Yes'}</strong></div>
                </div>
                {scene.links.length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    {scene.links.map((link) => {
                      const target = project.scenes.find((item) => item.id === link.nodeId);
                      return <div key={link.id || link.nodeId} className="flex items-center gap-2 text-xs text-text-secondary"><ArrowRight className="w-3 h-3 text-primary" />{target?.name || 'Broken link'}</div>;
                    })}
                  </div>
                )}
          </button>
          );
        })}
      </div>
    </div>
  );
}
