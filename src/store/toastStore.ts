/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  toastStore.ts
 *  Global toast notification queue with size limiting.
 *-----------------------------------------------------------------------------------------------*/

import { create } from 'zustand';
import { MAX_TOASTS, generateToastId } from '@/constants';

export type ToastType = 'info' | 'success' | 'warning' | 'danger';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = generateToastId();
    set((state) => {
      const next = [...state.toasts, { ...toast, id }];
      if (next.length > MAX_TOASTS) {
        next.splice(0, next.length - MAX_TOASTS);
      }
      return { toasts: next };
    });
    return id;
  },

  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id),
  })),

  // Clear the whole queue, used by the ui.clear-toasts command.
  clearToasts: () => set({ toasts: [] }),
}));