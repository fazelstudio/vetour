/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  GridCard.tsx
 *  Grid tile for assets and scenes with badge and actions.
 *-----------------------------------------------------------------------------------------------*/

import React from 'react';
import { motion } from 'framer-motion';
import { MoreVertical } from 'lucide-react';

interface GridCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  image?: string;
  badge?: string;
  isAddCard?: boolean;
  onClick?: () => void;
  onActionClick?: (e: React.MouseEvent) => void;
  isActive?: boolean;
}

export const GridCard: React.FC<GridCardProps> = ({
  title,
  subtitle,
  icon,
  image,
  badge,
  isAddCard,
  onClick,
  onActionClick,
  isActive
}) => {
  if (isAddCard) {
    return (
      <motion.div
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className="group relative flex flex-col items-center justify-center aspect-square rounded-2xl cursor-pointer transition-colors shadow-sm bg-surface border border-dashed border-border hover:border-primary hover:bg-primary-subtle"
      >
        <div className="text-text-secondary group-hover:text-primary transition-colors">
          {icon}
        </div>
        <span className="mt-2 text-sm font-medium text-text-secondary group-hover:text-primary transition-colors">
          {title}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -3 }}
      onClick={onClick}
      className={`group relative flex flex-col aspect-square rounded-2xl p-3 cursor-pointer transition-all shadow-sm bg-surface border ${
        isActive ? 'border-primary ring-2 ring-primary ring-opacity-20' : 'border-border'
      } hover:border-primary-subtle`}
    >
      {/* Badge in the top-left corner. */}
      {badge && (
        <div className="absolute top-4 left-5 z-10">
          <div className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary text-background shadow-sm">
            {badge}
          </div>
        </div>
      )}
      {/* Action button in the top-right corner. */}
      {onActionClick && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onActionClick(e);
          }}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-text-secondary hover:text-primary hover:bg-primary-subtle transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      )}

      {/* Main content area. */}
      <div className="flex-1 flex flex-col items-center justify-center overflow-hidden rounded-xl mb-3 bg-background">
        {image ? (
          <img src={image} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="text-text-secondary">
            {icon}
          </div>
        )}
      </div>

      {/* Footer with title and subtitle. */}
      <div className="mt-auto">
        <h3 className="text-sm font-medium text-text-primary truncate" title={title}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-[11px] text-text-secondary truncate mt-0.5" title={subtitle}>
            {subtitle}
          </p>
        )}
      </div>
    </motion.div>
  );
};