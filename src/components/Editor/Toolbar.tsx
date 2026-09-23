/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  Toolbar.tsx
 *  Project toolbar with file actions, history, and present entry.
 *-----------------------------------------------------------------------------------------------*/

import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import { useTourStore } from '@/store/useTourStore';
import { Play, Save, FolderOpen, Plus, ChevronLeft, Undo2, Redo2, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { save, open } from '@tauri-apps/plugin-dialog';
import { loadObsipanoFile } from '@/lib/obsipanoFile';

import { lockProjectFile } from '@/lib/fileLock';
import { DEFAULT_PROJECT_NAME, FILE_FILTER_NAME, FILE_FILTER_EXTENSIONS } from '@/constants';
import { PROJECT_CATEGORY_OPTIONS } from '@/constants';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/Select';
import { command } from '@/commands';

interface ToolbarProps {
  onNavigateHome?: () => void;
}

export const Toolbar = ({ onNavigateHome }: ToolbarProps) => {
  const project = useTourStore((state) => state.project);
  const unsavedChanges = useTourStore((state) => state.unsavedChanges);
  const savedPath = useTourStore((state) => state.savedPath);
  const canUndo = useTourStore((state) => state.historyPast.length > 0);
  const canRedo = useTourStore((state) => state.historyFuture.length > 0);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');

  const openMetadata = () => {
    setDescription(project?.description || '');
    setCategory(project?.category || 'other');
    setMetadataOpen(true);
  };

  const handleNew = () => {
    if (useTourStore.getState().unsavedChanges) {
      if (!confirm('You have unsaved changes. Create new project anyway?')) return;
    }
    command('project.new', {});
  };

  const handleOpen = async () => {
    try {
      const selected = await open({
        filters: [{ name: FILE_FILTER_NAME, extensions: [...FILE_FILTER_EXTENSIONS] }]
      });
      if (selected && typeof selected === 'string') {
        const data = await loadObsipanoFile(selected);
        const fileName = selected.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || data.name;
        const name = data.name === DEFAULT_PROJECT_NAME ? fileName : data.name;
        const next = { ...data, name };
        command('project.load', next);
        command('project.set-saved-path', selected);
        command('project.recent.add', {
          id: next.id,
          name,
          folderPath: selected,
          createdAt: next.createdAt,
          lastOpenedAt: new Date().toISOString(),
        });
        await lockProjectFile(selected);
      }
    } catch (e) {
      console.error('Error opening project', e);
      command('ui.notify', { type: 'danger', message: 'Failed to open project file.' });
    }
  };

  const doSave = async (targetPath: string) => {
    void targetPath;
    await command('project.save', undefined);
    if (!useTourStore.getState().unsavedChanges) {
      command('ui.notify', { type: 'success', message: 'Project saved successfully!' });
    }
  };

  const handleSave = async () => {
    // Wait for pending debounced edits from PropertyPanel to flush.
    await new Promise(resolve => setTimeout(resolve, 350));

    const currentProject = useTourStore.getState().project;
    if (!currentProject) return;
    try {
      if (savedPath) {
        await doSave(savedPath);
      } else {
        const selected = await save({
          filters: [{ name: FILE_FILTER_NAME, extensions: [...FILE_FILTER_EXTENSIONS] }],
          defaultPath: `${currentProject.name}.obsipano`
        });
        if (selected) {
          await doSave(selected);
        }
      }
    } catch (e) {
      console.error('Error saving project', e);
      if (savedPath && String(e).includes('NotFound')) {
        command('project.set-saved-path', null);
        if (confirm('File was deleted externally. Save to a new location?')) {
          handleSave();
        }
      } else {
        command('ui.notify', { type: 'danger', message: 'Failed to save project.' });
      }
    }
  };

  const hasPanorama = project?.scenes.some((s) => !!s.panorama) ?? false;

  return (
    <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-card">
      <div className="flex items-center gap-2">
        {onNavigateHome && (
          <Tooltip content="Back to Home">
            <Button variant="outline" size="sm" onClick={onNavigateHome}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Home
            </Button>
          </Tooltip>
        )}
        <Tooltip content="New Project">
          <Button variant="outline" size="sm" onClick={handleNew}>
            <Plus className="w-4 h-4 mr-2" /> New
          </Button>
        </Tooltip>
        <Tooltip content="Open Project">
          <Button variant="outline" size="sm" onClick={handleOpen}>
            <FolderOpen className="w-4 h-4 mr-2" /> Open
          </Button>
        </Tooltip>
        <Tooltip content={!unsavedChanges && !!savedPath ? 'No changes to save' : 'Save Project'}>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={!unsavedChanges && !!savedPath}>
            <Save className="w-4 h-4 mr-2" /> Save
          </Button>
        </Tooltip>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 border-r border-border pr-2 mr-1">
          <Tooltip content="Undo">
            <Button variant="ghost" size="sm" onClick={() => command('project.undo', undefined)} disabled={!canUndo}><Undo2 className="w-4 h-4" /></Button>
          </Tooltip>
          <Tooltip content="Redo">
            <Button variant="ghost" size="sm" onClick={() => command('project.redo', undefined)} disabled={!canRedo}><Redo2 className="w-4 h-4" /></Button>
          </Tooltip>
        </div>
        <Tooltip content={hasPanorama ? 'Present Tour' : 'Add a panorama image first'}>
          <Button variant="secondary" size="sm" disabled={!hasPanorama} onClick={() => command('present.open', undefined)}>
            <Play className="w-4 h-4 mr-2" /> Present
          </Button>
        </Tooltip>
        <Tooltip content="Project settings">
          <Button variant="ghost" size="sm" onClick={openMetadata}><Settings2 className="w-4 h-4" /></Button>
        </Tooltip>
      </div>
      <Modal open={metadataOpen} onOpenChange={setMetadataOpen} title="Project metadata" size="sm" actions={<div className="flex w-full justify-end gap-2"><Button variant="outline" onClick={() => setMetadataOpen(false)}>Cancel</Button><Button onClick={() => { if (project) { command('project.update', { ...project, description, category: category as typeof project.category }); command('project.set-dirty', true); } setMetadataOpen(false); }}>Save</Button></div>}>
        <div className="space-y-4">
          <div className="space-y-1"><label className="text-xs font-medium text-text-secondary">Project description</label><Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What is this tour about?" /></div>
          <div className="space-y-1"><label className="text-xs font-medium text-text-secondary">Category</label><Select value={category} onChange={setCategory} options={[...PROJECT_CATEGORY_OPTIONS]} /></div>
        </div>
      </Modal>
    </div>
  );
};