/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  SkeletonEditor.tsx
 *  Loading placeholder that mirrors the editor layout.
 *-----------------------------------------------------------------------------------------------*/

export const SkeletonEditor = () => {
  const bar = "bg-border/50 animate-pulse rounded";
  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden select-none pointer-events-none">
      {/* Toolbar placeholder. */}
      <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-card z-10 relative">
        <div className="flex items-center gap-2">
          <div className={`w-20 h-8 ${bar}`} />
          <div className={`w-20 h-8 ${bar}`} />
          <div className={`w-20 h-8 ${bar}`} />
          <div className={`w-20 h-8 ${bar}`} />
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-24 h-8 ${bar}`} />
          <div className={`w-28 h-8 ${bar}`} />
        </div>
      </div>

      <div className="flex flex-1 w-full overflow-hidden">
        {/* Sidebar placeholder. */}
        <div className="shrink-0 flex flex-col bg-surface border-r border-border py-3 px-3 gap-1 w-[200px]">
          <div className={`w-full h-10 ${bar}`} />
          <div className={`w-full h-10 ${bar}`} />
          <div className="flex-1" />
          <div className={`w-full h-10 ${bar}`} />
        </div>

        {/* Panorama workspace placeholder. */}
        <div className="flex h-full w-full bg-background overflow-hidden">
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Center: preview placeholder. */}
            <div className="flex-1 relative bg-background overflow-hidden min-h-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <svg className="w-8 h-8 text-primary animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm font-medium text-text-primary">Loading project...</p>
              </div>
            </div>

            {/* Panorama cards placeholder. */}
            <div className="shrink-0 border-t border-border bg-surface">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border h-10">
                <div className={`w-24 h-4 ${bar}`} />
              </div>
              <div className="flex gap-3 overflow-x-auto px-4 py-3 custom-scroll">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="min-w-[140px] w-[140px] shrink-0">
                    <div className={`w-full h-[110px] ${bar} rounded-xl`} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: properties panel placeholder. */}
          <div className="w-80 shrink-0 border-l border-border bg-card flex flex-col">
            <div className="p-4 border-b border-border font-medium text-text-primary h-[53px] flex items-center">
              <div className={`w-32 h-5 ${bar}`} />
            </div>
            <div className="flex-1 p-4 flex flex-col gap-4">
              <div className={`w-full h-12 ${bar}`} />
              <div className={`w-full h-12 ${bar}`} />
              <div className={`w-3/4 h-12 ${bar}`} />
              <div className={`w-full h-32 ${bar}`} />
              <div className={`w-1/2 h-8 ${bar}`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
