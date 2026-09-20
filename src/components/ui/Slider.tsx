/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  Slider.tsx
 *  Accessible range slider with value display for settings sections.
 *-----------------------------------------------------------------------------------------------*/

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  formatValue,
  onChange,
}: SliderProps) {
  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : undefined}>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm text-text-primary">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-text-primary">
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-primary"
      />
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-text-secondary">
        <span>{formatValue ? formatValue(min) : min}</span>
        <span>{formatValue ? formatValue(max) : max}</span>
      </div>
    </div>
  );
}
