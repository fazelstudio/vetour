/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  ContextMenu.tsx
 *  Floating context menu anchored to a source rectangle.
 *-----------------------------------------------------------------------------------------------*/

import { useEffect, useRef } from 'react';

interface ContextMenuAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
}

interface ContextMenuProps {
  open: boolean;
  onClose: () => void;
  actions: ContextMenuAction[];
  anchorRect?: DOMRect;
}

export const ContextMenu = ({ open, onClose, actions, anchorRect }: ContextMenuProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [open, onClose]);

  if (!open) return null;

  const top = anchorRect ? anchorRect.bottom + 4 : 0;
  const right = anchorRect ? window.innerWidth - anchorRect.right : 0;

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[160px] rounded-xl border border-border bg-background shadow-lg py-1"
      style={{ top: Math.min(top, window.innerHeight - actions.length * 36 - 8), right }}
    >
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={() => { action.onClick(); onClose(); }}
          className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-surface ${action.danger ? 'text-danger hover:bg-danger-subtle' : 'text-text-primary'}`}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  );
};