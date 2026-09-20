/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  ColorPickerMenu.tsx
 *  Solid and gradient color picker with presets and eyedropper.
 *-----------------------------------------------------------------------------------------------*/

import { useState, useRef, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Label } from './label';
import { Input } from './input';
import { Pipette } from 'lucide-react';
import ColorPicker from 'react-best-gradient-color-picker';

interface ColorPickerMenuProps {
  label: string;
  bgType?: 'solid' | 'gradient';
  bgColor?: string;
  bgGradient?: string;
  onChange: (type: 'solid' | 'gradient', color: string, gradient: string) => void;
  disableGradient?: boolean;
}

export function ColorPickerMenu({
  label,
  bgType = 'solid',
  bgColor = '#000000',
  bgGradient = 'linear-gradient(90deg, rgba(255,0,0,1) 0%, rgba(0,0,255,1) 100%)',
  onChange,
  disableGradient = false,
}: ColorPickerMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  // Convert RGBA or other formats to HEX when possible.
  const parseHex = (color: string) => {
    if (color.startsWith('#')) return color.substring(0, 7);
    return '#000000';
  };

  const handleEyeDrop = async () => {
    if ('EyeDropper' in window) {
      try {
        // @ts-expect-error EyeDropper API is not fully typed in TS DOM yet
        const eyeDropper = new EyeDropper();
        const result = await eyeDropper.open();
        onChange('solid', result.sRGBHex, bgGradient);
      } catch {
        // Ignore cancelled eyedropper selection.
      }
    } else {
      alert("Eyedropper is not supported in this browser.");
    }
  };

  const displayBg = bgType === 'gradient' ? bgGradient : bgColor;
  const currentHex = parseHex(bgColor);

  return (
    <div ref={ref} className="relative">
      <div className="space-y-1">
        <Label>{label}</Label>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-3 px-3 py-2 border border-border rounded-lg bg-surface text-sm transition-colors hover:border-primary focus:border-primary outline-none"
        >
          <div className="w-5 h-5 rounded-md border border-border shadow-sm" style={{ background: displayBg }} />
          <span className="truncate text-text-primary uppercase">{bgType === 'gradient' ? 'Gradient' : currentHex}</span>
        </button>
      </div>

      {open && (
        <div className="absolute z-50 top-full mt-2 left-0 w-[280px] bg-background border border-border shadow-xl rounded-xl p-4">
          {!disableGradient && (
            <div className="flex gap-2 mb-4 border-b border-border pb-2">
              <button
                type="button"
                onClick={() => onChange('solid', bgColor, bgGradient)}
                className={`flex-1 pb-1 text-sm font-medium transition-colors ${
                  bgType === 'solid' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Solid
              </button>
              <button
                type="button"
                onClick={() => onChange('gradient', bgColor, bgGradient)}
                className={`flex-1 pb-1 text-sm font-medium transition-colors ${
                  bgType === 'gradient' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Gradient
              </button>
            </div>
          )}

          {bgType === 'gradient' && !disableGradient ? (
            <div className="space-y-4">
              <div className="w-full flex justify-center [&_.rbgcp-color-picker]:!w-full [&_.rbgcp-color-picker]:!shadow-none [&_.rbgcp-color-picker]:!bg-transparent">
                <ColorPicker 
                  value={bgGradient} 
                  onChange={(g) => onChange('gradient', bgColor, g)} 
                  hidePresets
                  hideColorTypeBtns
                  hideAdvancedSliders
                  hideColorGuide
                  width={248}
                  height={140}
                />
              </div>
              <div className="pt-2 border-t border-border">
                <Label className="text-xs mb-2 block">Presets</Label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    'linear-gradient(45deg, rgba(255,154,158,1) 0%, rgba(254,207,239,1) 100%)',
                    'linear-gradient(120deg, rgba(161,196,253,1) 0%, rgba(194,233,251,1) 100%)',
                    'linear-gradient(0deg, rgba(255,8,68,1) 0%, rgba(255,177,153,1) 100%)',
                    'linear-gradient(90deg, rgba(79,172,254,1) 0%, rgba(0,242,254,1) 100%)',
                    'linear-gradient(90deg, rgba(67,233,123,1) 0%, rgba(56,249,215,1) 100%)',
                  ].map((g, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onChange('gradient', bgColor, g)}
                      className="w-full aspect-square rounded-md border border-border shadow-sm hover:scale-105 transition-transform"
                      style={{ background: g }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-full flex justify-center custom-color-picker">
                <HexColorPicker color={currentHex} onChange={(c) => onChange('solid', c, bgGradient)} />
              </div>
              
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">#</span>
                  <Input 
                    value={currentHex.replace('#', '')} 
                    onChange={(e) => onChange('solid', '#' + e.target.value, bgGradient)} 
                    className="pl-7 font-mono text-sm uppercase"
                    maxLength={6}
                  />
                </div>
                {'EyeDropper' in window && (
                  <button 
                    type="button" 
                    onClick={handleEyeDrop} 
                    className="p-2 border border-border rounded-lg bg-surface text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <Pipette className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              <div>
                <Label className="text-xs mb-2 block">Presets</Label>
                <div className="grid grid-cols-5 gap-2">
                  {['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'].map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onChange('solid', c, bgGradient)}
                      className="w-full aspect-square rounded-md border border-border shadow-sm hover:scale-105 transition-transform"
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
