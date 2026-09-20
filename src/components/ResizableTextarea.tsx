/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  ResizableTextarea.tsx
 *  Auto-growing textarea with line limits for property forms.
 *-----------------------------------------------------------------------------------------------*/

import React, { useRef, useEffect, useCallback } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';

interface ResizableTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minLines?: number;
  maxLines?: number;
  defaultLines?: number;
}

export const ResizableTextarea = React.forwardRef<HTMLTextAreaElement, ResizableTextareaProps>(
  ({ className, minLines = 1, maxLines = 10, defaultLines = 3, value, onChange, ...props }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;

    const adjustHeight = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }, [textareaRef]);

    useEffect(() => {
      adjustHeight();
    }, [value, adjustHeight]);

    // Approximate line height + padding. Assuming text-sm (14px) and line-height normal (~20px)
    // padding-y is 16px (py-2 is 8px top + 8px bottom).
    const lineHeight = 20;
    const paddingY = 16;
    const minHeight = `${minLines * lineHeight + paddingY}px`;
    const maxHeight = `${maxLines * lineHeight + paddingY}px`;
    const initialHeight = `${defaultLines * lineHeight + paddingY}px`;

    return (
      <div 
        className={cn(
          "relative resize-y overflow-hidden rounded-xl border border-input bg-background focus-within:ring-[3px] focus-within:ring-ring/40",
          className
        )}
        style={{ minHeight, maxHeight, height: initialHeight }}
      >
        <ScrollArea className="h-full w-full">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              adjustHeight();
              onChange?.(e);
            }}
            className="w-full min-h-full resize-none bg-transparent px-3 py-2 text-sm text-text-primary outline-none flex-1"
            style={{ overflow: 'hidden' }}
            {...props}
          />
        </ScrollArea>
      </div>
    );
  }
);

ResizableTextarea.displayName = 'ResizableTextarea';
