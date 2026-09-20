/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  App.tsx
 *  Root application shell with window lifecycle, routing, and save handling.
 *-----------------------------------------------------------------------------------------------*/

import { useState, useCallback, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { ThemeProvider } from './contexts/ThemeContext';
import { Titlebar } from './components/Titlebar';
import { EditorLayout } from './components/Editor/EditorLayout';
import { HomePage } from './components/Home/HomePage';
import { PresentWindow } from './components/Present/PresentWindow';
import { ToastContainer } from './components/ui/Toast';
import { Modal } from './components/ui/Modal';
import { Button } from './components/ui/button';
import { useTourStore } from './store/useTourStore';
import { unlockProjectFile } from './lib/fileLock';
import { registerCoreCommands, command } from './commands';

const appWindow = getCurrentWindow();

function App() {
  registerCoreCommands();
  const [page, setPage] = useState<'home' | 'editor'>('home');
  const [isPresent, setIsPresent] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showPresentActiveModal, setShowPresentActiveModal] = useState(false);
  const isPresentModeActive = useTourStore((state) => state.isPresentMode);
  const closeAfterSave = useRef(false);

  const pageRef = useRef(page);
  const isPresentRef = useRef(isPresent);

  useEffect(() => {
    pageRef.current = page;
    isPresentRef.current = isPresent;
  }, [page, isPresent]);

  // Suppress the browser default context menu everywhere.
  useEffect(() => {
    const handler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, []);

  // Sync project changes to the Present window live.
  useEffect(() => {
    const unsub = useTourStore.subscribe((state, prevState) => {
      // Only emit from the Editor window to the Present window.
      if (state.isPresentMode) return;
      if (state.project && state.project !== prevState.project) {
        emit('sync-present-data', JSON.stringify(state.project));
      }
    });
    return unsub;
  }, []);

  // Detect present mode from the URL parameter.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'present') {
      setIsPresent(true);
    }
  }, []);

  /*
  Reveal the main window once the first themed frame is painted.
  The Rust command maximizes the window while it is still hidden,
  then shows and focuses it — the OS never presents a windowed frame,
  so there is no startup flicker.
  */
  useEffect(() => {
    let cancelled = false;
    const reveal = async () => {
      try {
        if (await appWindow.isVisible()) return;
        /*
        Wait two frames so the themed background is painted before the
        Rust command reveals the window. The timeout is a safety net
        for slow machines where rAF may not fire while the window is hidden.
        */
        await Promise.race([
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
          new Promise<void>((resolve) => setTimeout(resolve, 300)),
        ]);
        if (cancelled) return;
        if (await appWindow.isVisible()) return;
        // Delegate to Rust: maximize → show → focus, all while hidden.
        await invoke('show_main_window');
      } catch {
        // Skip when the window API is unavailable in browser dev mode.
      }
    };
    reveal();
    return () => {
      cancelled = true;
    };
  }, []);

  // Intercept window close requests such as Alt+F4 or the OS close button.
  useEffect(() => {
    const unlistenPromise = appWindow.onCloseRequested(async (event) => {
      event.preventDefault(); // Always prevent default because cleanup runs manually.

      if (isPresentRef.current) {
        // Let the Present window close normally while notifying the main window.
        await emit('present-closed');
        appWindow.destroy();
        return;
      }

      const state = useTourStore.getState();
      if (state.isPresentMode) {
        setShowPresentActiveModal(true);
        return;
      }
      
      if (pageRef.current === 'editor' && state.project && state.unsavedChanges) {
        closeAfterSave.current = true;
        setShowExitModal(true);
      } else {
        if (pageRef.current === 'editor') {
          await unlockProjectFile();
        }
        appWindow.destroy();
      }
    });
    return () => { unlistenPromise.then(fn => fn()); };
  }, []);

  const performSaveAndContinue = async () => {
    // Wait for pending debounced edits from PropertyPanel to flush.
    await new Promise(resolve => setTimeout(resolve, 350));

    const state = useTourStore.getState();
    if (!state.project) return true;

    try {
      const hadPath = !!state.savedPath;
      await command('project.save', undefined);
      // A cancelled save-as dialog returns without a path.
      if (!hadPath && !useTourStore.getState().savedPath) return false;
      return true;
    } catch (e) {
      console.error('Save error', e);
      return false;
    }
  };

  const handleCloseRequest = () => {
    appWindow.close();
  };

  const handleCancelExit = () => {
    setShowExitModal(false);
  };

  const handleDontSaveExit = () => {
    setShowExitModal(false);
    if (closeAfterSave.current) {
      /*
      Discard in-memory changes without persisting.
      Clear the dirty flag so the close prompt does not appear again.
      */
      command('project.set-dirty', false);
      // Wait briefly for the modal close animation to finish.
      setTimeout(async () => {
        await unlockProjectFile();
        appWindow.destroy();
      }, 150);
    }
  };

  const handleSaveExit = async () => {
    const ok = await performSaveAndContinue();
    if (!ok) return;
    setShowExitModal(false);
    if (closeAfterSave.current) {
      // The dirty flag was already cleared by performSaveAndContinue.
      setTimeout(() => {
        appWindow.destroy();
      }, 150);
    }
  };

  const handleNavigateToEditor = useCallback(() => {
    setPage('editor');
  }, []);

  const handleNavigateHome = useCallback(async () => {
    const state = useTourStore.getState();
    if (state.isPresentMode) {
      setShowPresentActiveModal(true);
      return;
    }
    await unlockProjectFile();
    setPage('home');
  }, []);

  if (isPresent) {
    return (
      <ThemeProvider>
        <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
          <Titlebar page="present" onCloseRequest={async () => {
            await emit('present-closed');
            appWindow.destroy();
          }} />
          <div className="flex-1 min-h-0 relative">
            <PresentWindow />
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
        <Titlebar page={page} onCloseRequest={handleCloseRequest} />
        <div className="flex-1 min-h-0 relative">
          {page === 'home' ? (
            <HomePage onNavigateToEditor={handleNavigateToEditor} />
          ) : (
            <EditorLayout onNavigateHome={handleNavigateHome} />
          )}

          {isPresentModeActive && page === 'editor' && (
            <div 
              className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
              onClick={() => setShowPresentActiveModal(true)}
            />
          )}
        </div>
      </div>

      <Modal
        open={showExitModal}
        onOpenChange={(open) => { if (!open) handleCancelExit(); }}
        title="Unsaved Changes"
        description="You have unsaved changes. What would you like to do?"
        size="sm"
        actions={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={handleCancelExit}>Cancel</Button>
            <Button variant="ghost" onClick={handleDontSaveExit}>Discard</Button>
            <Button onClick={handleSaveExit}>Save</Button>
          </div>
        }
      >
        <></>
      </Modal>

      <Modal
        open={showPresentActiveModal}
        onOpenChange={setShowPresentActiveModal}
        title="Present Mode is Active"
        description="You cannot edit the project or close the application while Present Mode is active. Please close the Present window first."
        size="sm"
        actions={
          <div className="flex w-full justify-end">
            <Button onClick={() => setShowPresentActiveModal(false)}>Got it</Button>
          </div>
        }
      >
        <></>
      </Modal>

      <ToastContainer />
    </ThemeProvider>
  );
}

export default App;