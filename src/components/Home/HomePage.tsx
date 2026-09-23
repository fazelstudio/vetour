/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  HomePage.tsx
 *  Landing screen with project creation, opening, and recent list.
 *-----------------------------------------------------------------------------------------------*/

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { exists } from '@tauri-apps/plugin-fs';
import { loadObsipanoFile } from '@/lib/obsipanoFile';
import { clearPanoramaCache } from '@/lib/panorama';
import { open } from '@tauri-apps/plugin-dialog';
import { Plus, FolderOpen, Clock, Trash2, Settings } from 'lucide-react';
import { Button } from '../ui/button';
import { useProjectListStore } from '@/store/projectListStore';
import { TourProject } from '@/types/tour';
import { ProjectEntry } from '@/types/projectEntry';
import { Modal } from '../ui/Modal';
import { SettingsModal } from '../Settings/SettingsModal';
import { Tooltip } from '../ui/Tooltip';
import { ScrollArea } from '../ui/scroll-area';
import { lockProjectFile } from '@/lib/fileLock';
import { DEFAULT_PROJECT_NAME, MAX_RECENT_PROJECTS_HOME, MAX_RECENT_PROJECTS_MODAL, FILE_FILTER_NAME, FILE_FILTER_EXTENSIONS, FAZELSTUDIO_URL } from '@/constants';
import fazelStudioIcon from '@/assets/fazelstudio.png';
import { command } from '@/commands';


function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function isValidTourProject(data: unknown): data is TourProject {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !obj.id) return false;
  if (typeof obj.name !== 'string') return false;
  if (typeof obj.createdAt !== 'string') return false;
  if (typeof obj.updatedAt !== 'string') return false;
  if (!Array.isArray(obj.scenes)) return false;
  return true;
}

interface HomePageProps {
  onNavigateToEditor: (filePath?: string) => void;
  onReady?: () => void;
}

export const HomePage = ({ onNavigateToEditor, onReady }: HomePageProps) => {
  const projects = useProjectListStore((s) => s.projects);
  const loaded = useProjectListStore((s) => s.loaded);
  const [creating, setCreating] = useState(false);
  const [opening, setOpening] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [validProjects, setValidProjects] = useState<ProjectEntry[]>([]);

  useEffect(() => {
    command('project.recent.load', undefined);
  }, []);

  useEffect(() => {
    async function validate() {
      if (!loaded) return;
      const valid: ProjectEntry[] = [];
      for (const p of projects) {
        try {
          const fileExists = await exists(p.folderPath);
          if (fileExists) valid.push(p);
          else {
            command('project.recent.remove', p.id);
          }
        } catch {
          valid.push(p);
        }
      }
      valid.sort((a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime());
      setValidProjects(valid);
      onReady?.();
    }
    validate();
  }, [projects, loaded, onReady]);

  const recentProjects = useMemo(() => validProjects.slice(0, MAX_RECENT_PROJECTS_HOME), [validProjects]);
  const hasMore = validProjects.length > MAX_RECENT_PROJECTS_HOME;

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      command('project.new', {});
      clearPanoramaCache();
      onNavigateToEditor();
    } catch (e) {
      console.error('Error creating project', e);
    } finally {
      setCreating(false);
    }
  };

  const handleOpenVirtualTour = async () => {
    if (opening) return;
    setOpening(true);
    try {
      const selected = await open({
        filters: [{ name: FILE_FILTER_NAME, extensions: [...FILE_FILTER_EXTENSIONS] }],
        multiple: false,
      });
      if (!selected) return;
      const path = typeof selected === 'string' ? selected : selected;
      command('ui.set-project-loading', true);
      let data: TourProject;
      try {
        clearPanoramaCache();
        data = await loadObsipanoFile(path);
      } catch {
        command('ui.set-project-loading', false);
        command('ui.notify', { type: 'danger', message: 'Failed to read file.' });
        return;
      }

      if (!isValidTourProject(data)) {
        command('ui.set-project-loading', false);
        command('ui.notify', { type: 'warning', message: 'Invalid project structure. The file is not a valid Obsipano project.' });
        return;
      }

      const fileName = path.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || data.name;
      const name = data.name === DEFAULT_PROJECT_NAME ? fileName : data.name;
      const project: TourProject = { ...data, name };
      const validation = command('project.validation.validate', project) as { issues: unknown[] };
      if (validation.issues.length > 0) {
        command('ui.notify', { type: 'warning', message: `${validation.issues.length} project issue(s) found. Review the Navigation tab before publishing.` });
      }
      command('project.load', project);
      command('project.set-saved-path', path);
      onNavigateToEditor(path);
      command('project.recent.add', {
        id: project.id,
        name,
        folderPath: path,
        createdAt: project.createdAt,
        lastOpenedAt: new Date().toISOString(),
      });
      await lockProjectFile(path);
    } catch (e) {
      console.error('Error opening virtual tour', e);
      command('ui.notify', { type: 'danger', message: 'Failed to open project.' });
    } finally {
      setOpening(false);
    }
  };

  const handleOpenProject = async (entry: ProjectEntry) => {
    try {
      const fileExists = await exists(entry.folderPath);
      if (!fileExists) {
        command('ui.notify', { type: 'warning', message: `File "${entry.name}" no longer exists. It has been removed from recent.` });
        command('project.recent.remove', entry.id);
        return;
      }

      command('ui.set-project-loading', true);
      let data: TourProject;
      try {
        clearPanoramaCache();
        data = await loadObsipanoFile(entry.folderPath);
        if (!isValidTourProject(data)) throw new Error('Invalid structure');
      } catch {
        command('ui.notify', { type: 'warning', message: 'Failed to read file. Opening empty project.' });
        data = {
          id: entry.id,
          name: entry.name,
          createdAt: entry.createdAt,
          updatedAt: new Date().toISOString(),
          scenes: [],
          assets: [],
        };
      }
      command('project.recent.touch', entry.id);
      command('project.load', data);
      command('project.set-saved-path', entry.folderPath);
      await lockProjectFile(entry.folderPath);
      onNavigateToEditor(entry.folderPath);
    } catch (e) {
      console.error('Error opening project', e);
      command('ui.notify', { type: 'danger', message: 'Failed to open project.' });
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    command('project.recent.remove', id);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0, 1] as const } },
  };

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden bg-background">
      {!loaded ? (
        /*
        Startup splash with the themed background.
        The first visible frame looks intentional while validation loads.
        */
        <div className="flex flex-col items-center justify-center h-full select-none gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-border border-t-primary animate-spin" />
          <div className="text-[10px] tracking-[0.3em] uppercase text-text-secondary">Loading</div>
        </div>
      ) : (
        <motion.div
          className="flex flex-col items-center justify-center h-full select-none px-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="flex flex-col items-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 522 522" className="w-[280px] h-[280px]" style={{ userSelect: 'none' }}>
              <g stroke="currentColor" strokeWidth="18" strokeLinecap="butt" fill="none">
                <line x1="222.3" y1="235.6" x2="158.6" y2="185.1"/>
                <line x1="251.8" y1="233.5" x2="297.5" y2="185.4"/>
                <line x1="257.8" y1="250.8" x2="360.3" y2="265.5"/>
                <line x1="235.5" y1="267.8" x2="223.7" y2="362.2"/>
                <line x1="219.7" y1="256.0" x2="176.5" y2="274.8"/>
              </g>
              <g fill="none" stroke="currentColor" strokeWidth="14">
                <circle cx="238" cy="248" r="20"/>
                <circle cx="132" cy="164" r="34"/>
                <circle cx="314" cy="168" r="24"/>
                <circle cx="392" cy="270" r="32"/>
                <circle cx="220" cy="392" r="30"/>
                <circle cx="160" cy="282" r="18"/>
              </g>
            </svg>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-6 flex flex-col items-center gap-3">
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="w-[280px] py-6 text-[11px] font-semibold tracking-[0.15em] uppercase"
            >
              <Plus className="size-4" />
              {creating ? 'Creating...' : 'Create Virtual Tour'}
            </Button>
            <Button
              onClick={handleOpenVirtualTour}
              disabled={opening}
              variant="outline"
              className="w-[280px] py-6 text-[11px] font-semibold tracking-[0.15em] uppercase"
            >
              <FolderOpen className="size-4" />
              {opening ? 'Opening...' : 'Open Virtual Tour'}
            </Button>
          </motion.div>

          <motion.div variants={itemVariants} className="w-[280px] mt-8 h-[280px]">
            <div className="text-[10px] tracking-[0.3em] uppercase text-text-secondary mb-2 h-[15px]">
              {validProjects.length > 0 ? 'Recent' : ''}
            </div>
            <div className="space-y-1">
              {recentProjects.map((entry) => (
                <RecentItem key={entry.id} entry={entry} onOpen={handleOpenProject} onDelete={handleDelete} />
              ))}
              {hasMore && (
                <button
                  onClick={() => setShowAllModal(true)}
                  className="w-full text-left text-[11px] text-text-secondary hover:text-primary transition-colors py-1"
                >
                  More Recent...
                </button>
              )}
            </div>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="absolute bottom-8 text-[10px] tracking-[0.3em] text-text-secondary opacity-50 flex items-center gap-2"
          >
            Powered by 
            <a 
              href={FAZELSTUDIO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-inherit hover:text-text-primary transition-colors"
            >
              <img src={fazelStudioIcon} alt="Fazel Studio Icon" className="h-4 w-auto object-contain opacity-80" />
              FAZEL STUDIO
            </a>
          </motion.div>

          <motion.div variants={itemVariants} className="absolute bottom-8 left-8">
            <Tooltip content="Settings">
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </Tooltip>
          </motion.div>
        </motion.div>
      )}

      <Modal
        open={showAllModal}
        onOpenChange={setShowAllModal}
        title="All Recent Projects"
        size="sm"
        actions={<></>}
      >
        <ScrollArea className="max-h-[400px] pr-1">
          <div className="space-y-1">
            {validProjects.slice(0, MAX_RECENT_PROJECTS_MODAL).map((entry) => (
              <RecentItem key={entry.id} entry={entry} onOpen={(e) => { setShowAllModal(false); handleOpenProject(e); }} onDelete={handleDelete} />
            ))}
            {validProjects.length > MAX_RECENT_PROJECTS_MODAL && (
              <div className="text-[10px] text-text-secondary text-center py-2">
                Showing {MAX_RECENT_PROJECTS_MODAL} of {validProjects.length} recent projects
              </div>
            )}
          </div>
        </ScrollArea>
      </Modal>

      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
};

function RecentItem({
  entry,
  onOpen,
  onDelete,
}: {
  entry: ProjectEntry;
  onOpen: (entry: ProjectEntry) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}) {
  return (
    <div
      onClick={() => onOpen(entry)}
      className="group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer hover:bg-surface transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-text-primary truncate">{entry.name}</div>
        <div className="text-[10px] text-text-secondary flex items-center gap-1 mt-0.5">
          <Clock className="w-2.5 h-2.5 shrink-0" />
          {formatDate(entry.lastOpenedAt)} &middot; {formatTime(entry.lastOpenedAt)}
        </div>
      </div>
      <button
        onClick={(e) => onDelete(e, entry.id)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded text-text-secondary hover:text-danger transition-all shrink-0 ml-1"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}