/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  Modal.tsx
 *  Application modal and confirmation dialog wrappers.
 *-----------------------------------------------------------------------------------------------*/

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './dialog';
import { Button } from './button';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'half' | 'image-fit';
  contentClassName?: string;
  bodyClassName?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  contentClassName,
  bodyClassName,
  children,
  actions
}) => {
  const sizeClasses = {
    sm: 'sm:max-w-[425px]',
    md: 'sm:max-w-[600px]',
    lg: 'sm:max-w-[800px]',
    xl: 'sm:max-w-[1000px]',
    half: 'sm:max-w-[50vw] h-[50vh] flex flex-col',
    'image-fit': 'w-auto sm:max-w-[90vw] h-[50vh] flex flex-col !p-4'
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={`${sizeClasses[size]} bg-surface border-border text-text-primary ${contentClassName ?? ''}`}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-text-primary">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-sm text-text-secondary">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className={`py-4 flex-1 min-h-0 flex flex-col ${bodyClassName ?? ''}`}>
          {children}
        </div>
        {actions && (
          <DialogFooter className="mt-2">
            {actions}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const ConfirmModal: React.FC<Omit<ModalProps, 'children' | 'actions'> & {
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
}> = ({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDanger = true,
}) => {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      actions={
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" onClick={onCancel} className="text-text-secondary border-border hover:bg-background">
            {cancelLabel}
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className={isDanger ? 'bg-danger hover:bg-red-600 text-white' : 'bg-primary hover:bg-primary-hover text-white'}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {/* No body content because the description is shown in the header. */}
    </Modal>
  );
};