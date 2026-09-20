/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  Titlebar.tsx
 *  Custom window titlebar with navigation state and window controls.
 *-----------------------------------------------------------------------------------------------*/

import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, Copy, X } from 'lucide-react';
import appIcon from '/src-tauri/icons/icon.png';
import { useTourStore } from '@/store/useTourStore';
import { APP_NAME, DEFAULT_PROJECT_NAME } from '@/constants';

const appWindow = getCurrentWindow();

interface TitlebarProps {
  page: 'home' | 'editor' | 'present';
  onCloseRequest?: () => void;
}

export const Titlebar = ({ page, onCloseRequest }: TitlebarProps) => {
  const [maximized, setMaximized] = useState(false);
  const project = useTourStore((state) => state.project);
  const unsavedChanges = useTourStore((state) => state.unsavedChanges);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    appWindow.isMaximized().then(setMaximized);
    const unlisten = appWindow.onResized(() => {
      /*
      Debounce the isMaximized query so it only runs after the OS
      maximize/restore animation has settled. Querying mid-animation
      can return a stale value and cause the icon to be wrong.
      */
      clearTimeout(timer);
      timer = setTimeout(() => {
        appWindow.isMaximized().then(setMaximized);
      }, 50);
    });
    return () => {
      clearTimeout(timer);
      unlisten.then(fn => fn());
    };
  }, []);

  useEffect(() => {
    if (page === 'home') {
      appWindow.setTitle(APP_NAME);
      return;
    }
    if (page === 'present') {
      const name = project?.name?.trim();
      appWindow.setTitle(name ? `Present - ${name}` : `Present - ${DEFAULT_PROJECT_NAME}`);
      return;
    }
    const name = project?.name?.trim();
    const title = name ? `${APP_NAME} — ${name}${unsavedChanges ? '*' : ''}` : `${APP_NAME} — ${DEFAULT_PROJECT_NAME}`;
    appWindow.setTitle(title);
  }, [page, project?.name, unsavedChanges]);

  const displayTitle = () => {
    if (page === 'home') return APP_NAME;
    if (page === 'present') {
      const name = project?.name?.trim();
      return name ? `Present - ${name}` : `Present - ${DEFAULT_PROJECT_NAME}`;
    }
    const name = project?.name?.trim();
    if (name) return `${APP_NAME} — ${name}${unsavedChanges ? '*' : ''}`;
    return `${APP_NAME} — ${DEFAULT_PROJECT_NAME}`;
  };

  return (
    <div
      data-tauri-drag-region
      className="h-10 flex items-center justify-between bg-surface border-b border-border select-none shrink-0 pl-4"
    >
      <div data-tauri-drag-region className="flex items-center gap-2.5">
        <img src={appIcon} className="w-5 h-5" draggable={false} alt="" />
        <span data-tauri-drag-region className="text-sm font-semibold text-text-primary tracking-wide">
          {displayTitle()}
        </span>
      </div>

      <div className="flex items-center">
        <div className="flex items-stretch">
          <button
            onClick={() => appWindow.minimize()}
            className="w-[46px] h-10 flex items-center justify-center text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            id="titlebar-maximize"
            onClick={() => appWindow.toggleMaximize()}
            className="w-[46px] h-10 flex items-center justify-center text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
          >
            {maximized ? <Copy className="w-3.5 h-3.5" /> : <Square className="w-3 h-3" />}
          </button>
          <button
            onClick={() => onCloseRequest?.()}
            className="w-[46px] h-10 flex items-center justify-center text-text-secondary hover:bg-danger hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};