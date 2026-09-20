/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  Toast.tsx
 *  Toast notification container rendered in a portal.
 *-----------------------------------------------------------------------------------------------*/

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Info, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { useToastStore, type ToastType } from '@/store/toastStore';
import { command } from '@/commands';

const DURATION = 5000;

const config: Record<ToastType, { icon: React.ReactNode; bg: string; border: string; text: string }> = {
  info: {
    icon: <Info className="w-4 h-4" />,
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-600',
  },
  success: {
    icon: <CheckCircle className="w-4 h-4" />,
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-600',
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4" />,
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-600',
  },
  danger: {
    icon: <AlertCircle className="w-4 h-4" />,
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-600',
  },
};

function ToastItem({ id, type, message }: { id: string; type: ToastType; message: string }) {
  const c = config[type];

  useEffect(() => {
    const timer = setTimeout(() => command('ui.dismiss-toast', id), DURATION);
    return () => clearTimeout(timer);
  }, [id]);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-md ${c.bg} ${c.border} animate-slide-up`}
      style={{ minWidth: 280, maxWidth: 420 }}
    >
      <span className={`shrink-0 mt-0.5 ${c.text}`}>{c.icon}</span>
      <p className={`flex-1 text-sm ${c.text}`}>{message}</p>
      <button
        onClick={() => command('ui.dismiss-toast', id)}
        className={`shrink-0 mt-0.5 opacity-60 hover:opacity-100 transition-opacity ${c.text}`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem id={t.id} type={t.type} message={t.message} />
        </div>
      ))}
    </div>,
    document.body,
  );
}