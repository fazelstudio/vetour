/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  EditorLayout.tsx
 *  Editor shell with view tabs, autosave, and exit handling.
 *-----------------------------------------------------------------------------------------------*/

import { useState, useEffect } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';
import { Tooltip } from '../ui/Tooltip';
import { Toolbar } from './Toolbar';
import { PanoramaPage } from './PanoramaPage';
import { NavigationGraph } from './NavigationGraph';
import { AssetsView } from './AssetsView';
import { SkeletonEditor } from './SkeletonEditor';
import { useTourStore } from '@/store/useTourStore';
import { useFileWatch } from '@/lib/useFileWatch';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/button';
import { Image, FolderArchive, Menu, GitBranch, Settings } from 'lucide-react';
import { SettingsModal } from '../Settings/SettingsModal';
import { AUTOSAVE_INTERVAL_MS } from '@/constants';
import { command } from '@/commands';

type EditorView = 'panorama' | 'graph' | 'assets';

interface EditorLayoutProps {
  onNavigateHome?: () => void;
}

export const EditorLayout = ({ onNavigateHome }: EditorLayoutProps) => {
  const project = useTourStore((state) => state.project);
  const unsavedChanges = useTourStore((state) => state.unsavedChanges);
  const savedPath = useTourStore((state) => state.savedPath);

  useEffect(() => {
    if (!savedPath) return;
    const timer = window.setInterval(async () => {
      const state = useTourStore.getState();
      if (!state.project || !state.unsavedChanges || state.saveStatus === 'saving') return;
      command('project.set-save-status', 'saving');
      try {
        await command('project.save', undefined);
      } catch (error) {
        console.error('Autosave error', error);
        command('project.set-save-status', 'unsaved');
      }
    }, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [savedPath]);

  const [view, setView] = useState<EditorView>('panorama');
  const [exitModal, setExitModal] = useState<{ action: () => void } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [fileWarning, setFileWarning] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) command('project.redo', undefined); else command('project.undo', undefined);
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault();
        command('project.redo', undefined);
      } else if (event.key.toLowerCase() === 'c') {
        command('hotspot.copy', undefined);
      } else if (event.key.toLowerCase() === 'v') {
        command('hotspot.paste', undefined);
      } else if (event.key.toLowerCase() === 'd') {
        event.preventDefault();
        command('hotspot.duplicate', undefined);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (view !== 'panorama') return;
    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [view]);

  useFileWatch((event) => {
    if (event.kind === 'removed') {
      command('project.set-saved-path', null);
      command('project.set-dirty', true);
      setFileWarning('File was deleted externally. Save to a new location?');
    } else if (event.kind === 'renamed') {
      command('project.set-saved-path', event.newPath);
      command('project.set-dirty', true);
      setFileWarning('File was renamed externally. Path updated.');
    } else {
      setFileWarning('File was modified externally. Reload to see changes?');
    }
  });

  const handleNavigateHome = () => {
    if (!unsavedChanges || !project) {
      onNavigateHome?.();
      return;
    }
    setExitModal({
      action: () => onNavigateHome?.(),
    });
  };

  const handleDontSaveAndExit = () => {
    /*
    Discard unsaved changes and keep the pre-save state.
    Only the dirty flag is cleared before navigating away.
    */
    command('project.set-dirty', false);
    exitModal?.action();
    setExitModal(null);
  };

  const handleSaveAndExit = async () => {
    /*
    Save through the shared project.save command.
    Cancel keeps the dialog open.
    */
    // Wait for pending debounced edits from PropertyPanel to flush.
    await new Promise(resolve => setTimeout(resolve, 350));

    const currentProject = useTourStore.getState().project;
    if (!currentProject) return;
    try {
      const hadPath = !!useTourStore.getState().savedPath;
      await command('project.save', undefined);
      // A cancelled save-as leaves no path and keeps the dialog open.
      if (!hadPath && !useTourStore.getState().savedPath) return;
    } catch (e) {
      console.error('Save error', e);
      return;
    }
    exitModal?.action();
    setExitModal(null);
  };

  const tabs = [
    { id: 'panorama' as const, label: 'Panorama', icon: <Image className="w-5 h-5" /> },
    { id: 'graph' as const, label: 'Navigation', icon: <GitBranch className="w-5 h-5" /> },
    { id: 'assets' as const, label: 'Assets', icon: <FolderArchive className="w-5 h-5" /> },
  ];

  const projectLoading = useTourStore((s) => s.projectLoading);
  const viewerLoading = useTourStore((s) => s.viewerLoading);

  return (
    <div className="relative flex flex-col h-full w-full bg-background text-text-primary overflow-hidden">
      {(projectLoading || viewerLoading) && (
        <div className="absolute inset-0 z-[100] bg-background">
          <SkeletonEditor />
        </div>
      )}
      
      <Toolbar onNavigateHome={handleNavigateHome} />

      {fileWarning && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-sm text-amber-600 shrink-0">
          <span>{fileWarning}</span>
          <button onClick={() => setFileWarning(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      <div className="relative flex flex-1 w-full overflow-hidden">
        <div className={`shrink-0 flex flex-col bg-surface border-r border-border py-3 transition-all duration-300 overflow-hidden gap-1 ${sidebarOpen ? 'w-[200px]' : 'w-[60px]'}`}>
          {tabs.map((tab) => {
            const isActive = view === tab.id;
            return (
              <Tooltip key={tab.id} content={sidebarOpen ? '' : tab.label}>
                <button onClick={() => setView(tab.id)}
                  className={`flex items-center w-full rounded-xl text-sm transition-all shrink-0 py-2.5 pl-[20px] ${isActive ? 'bg-primary-subtle text-primary shadow-sm' : 'text-text-secondary hover:bg-surface hover:text-text-primary'}`}>
                  <span className={`shrink-0 transition-all duration-300 ${sidebarOpen ? 'mr-3' : ''}`}>{tab.icon}</span>
                  <span className={`font-medium truncate transition-all duration-300 overflow-hidden whitespace-nowrap ${sidebarOpen ? 'max-w-[200px] opacity-100' : 'max-w-0 opacity-0'}`}>{tab.label}</span>
                </button>
              </Tooltip>
            );
          })}
          <div className="flex-1" />
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center w-full rounded-xl text-sm transition-all shrink-0 py-2.5 pl-[20px] text-text-secondary hover:bg-surface hover:text-text-primary mt-2">
            <span className={`shrink-0 transition-all duration-300 ${sidebarOpen ? 'mr-3' : ''}`}>
              <Menu className={`w-5 h-5 transition-transform duration-300 ${sidebarOpen ? 'rotate-90' : ''}`} />
            </span>
            <span className={`font-medium truncate transition-all duration-300 overflow-hidden whitespace-nowrap ${sidebarOpen ? 'max-w-[200px] opacity-100' : 'max-w-0 opacity-0'}`}>Collapse</span>
          </button>
          <Tooltip content={sidebarOpen ? '' : 'Settings'}>
            <button onClick={() => setShowSettings(true)}
              className="flex items-center w-full rounded-xl text-sm transition-all shrink-0 py-2.5 pl-[20px] text-text-secondary hover:bg-surface hover:text-text-primary">
              <span className={`shrink-0 transition-all duration-300 ${sidebarOpen ? 'mr-3' : ''}`}>
                <Settings className="w-5 h-5" />
              </span>
              <span className={`font-medium truncate transition-all duration-300 overflow-hidden whitespace-nowrap ${sidebarOpen ? 'max-w-[200px] opacity-100' : 'max-w-0 opacity-0'}`}>Settings</span>
            </button>
          </Tooltip>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <div className={`absolute inset-0 overflow-hidden transition-opacity duration-150 ${view === 'panorama' ? 'z-10 visible opacity-100 pointer-events-auto' : 'z-0 invisible opacity-0 pointer-events-none'}`}>
            <ErrorBoundary><PanoramaPage /></ErrorBoundary>
          </div>
          <div className={`absolute inset-0 overflow-hidden transition-opacity duration-150 ${view === 'graph' ? 'z-10 visible opacity-100 pointer-events-auto' : 'z-0 invisible opacity-0 pointer-events-none'}`}>
            <ErrorBoundary><NavigationGraph onOpenScene={() => setView('panorama')} /></ErrorBoundary>
          </div>
          <div className={`absolute inset-0 overflow-auto transition-opacity duration-150 ${view === 'assets' ? 'z-10 visible opacity-100 pointer-events-auto' : 'z-0 invisible opacity-0 pointer-events-none'}`}>
            <ErrorBoundary><AssetsView /></ErrorBoundary>
          </div>
        </div>
      </div>

      <Modal
        open={!!exitModal}
        onOpenChange={(open) => { if (!open) setExitModal(null); }}
        title="Unsaved Changes"
        description="You have unsaved changes. What would you like to do?"
        size="sm"
        actions={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={() => setExitModal(null)}>Cancel</Button>
            <Button variant="ghost" onClick={handleDontSaveAndExit}>Discard</Button>
            <Button onClick={handleSaveAndExit}>Save</Button>
          </div>
        }
      >
        <></>
      </Modal>
      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
};