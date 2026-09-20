/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  Tooltip.tsx
 *  Hover tooltip with delayed portal rendering.
 *-----------------------------------------------------------------------------------------------*/

import { useState, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@/contexts/ThemeContext';

interface TooltipProps {
  content: string;
  children: ReactNode;
}

export const Tooltip = ({ content, children }: TooltipProps) => {
  const { resolvedTheme } = useTheme();
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleMouseEnter = (e: React.MouseEvent) => {
    setPos({ x: e.clientX, y: e.clientY });
    timer.current = setTimeout(() => setShow(true), 300);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!show) {
      setPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseLeave = () => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    setShow(false);
  };

  if (!content) return <>{children}</>;

  return (
    <>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="inline-flex"
      >
        {children}
      </div>
      {show && createPortal(
        <div
          key={resolvedTheme}
          className="fixed z-[9999] px-2.5 py-1.5 rounded-md text-[11px] font-medium shadow-md pointer-events-none select-none bg-tooltip-bg text-tooltip-text"
          style={{
            left: pos.x,
            top: pos.y - 4,
            transform: 'translateY(-100%)',
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
};