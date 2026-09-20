/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  useFileWatch.ts
 *  Hook that watches the saved project file and reports external changes as events.
 *-----------------------------------------------------------------------------------------------*/

import { useEffect, useRef } from 'react';
import { watch, type WatchEvent } from '@tauri-apps/plugin-fs';
import { useTourStore } from '@/store/useTourStore';

export type FileWatchEvent =
  | { kind: 'removed' }
  | { kind: 'renamed'; newPath: string | null }
  | { kind: 'modified' };

export function useFileWatch(onEvent?: (event: FileWatchEvent) => void) {
  const savedPath = useTourStore((state) => state.savedPath);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!savedPath) return;

    let unwatch: (() => void) | null = null;
    let cancelled = false;

    const handleWatchEvent = (event: WatchEvent) => {
      const type = event.type;
      if (typeof type !== 'object') return;

      if ('remove' in type) {
        console.warn('File deleted externally:', savedPath);
        onEventRef.current?.({ kind: 'removed' });
        return;
      }

      if ('modify' in type) {
        const modify = type.modify;
        if (modify.kind === 'rename') {
          console.warn('File renamed externally:', savedPath);
          onEventRef.current?.({ kind: 'renamed', newPath: event.paths?.[0] ?? null });
          return;
        }
        /*
        Ignore data and metadata modifications for the proprietary format.
        External change warnings would conflict with internal saves.
        */
      }
    };

    const startWatch = async () => {
      try {
        unwatch = await watch(savedPath, (event: WatchEvent) => {
          if (cancelled) return;
          handleWatchEvent(event);
        });
      } catch (e) {
        console.error('Failed to watch file:', e);
      }
    };

    startWatch();

    return () => {
      cancelled = true;
      if (unwatch) unwatch();
    };
  }, [savedPath]);
}
