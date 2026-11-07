import React from 'react';
import { litPips, pipsAt, snapValue } from './optionsControls';

const u = (n: number) => `calc(var(--u) * ${n})`;

/** The fraction (0..1, or past the ends) across an element that a pointer is at. */
function fractionAcross(el: HTMLElement, clientX: number): number {
  const r = el.getBoundingClientRect();
  return (clientX - r.left) / Math.max(1, r.width);
}

/** Pointer handlers for tap-or-drag along a control: `onAt` gets the fraction across it. */
export function dragAlong(onAt: (fraction: number) => void) {
  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      onAt(fractionAcross(e.currentTarget, e.clientX));
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) onAt(fractionAcross(e.currentTarget, e.clientX));
    },
  };
}

/**
 * A volume as a row of slanted pips, rising like a fighting-game meter. Tap
 * a pip, or drag along it (off the left end is 0). Used on Options and the pause screen.
 */
export const PipMeter: React.FC<{ label: string; value: number; color: string; onChange: (v: number) => void }> = ({ label, value, color, onChange }) => {
  const count = 20;
  const lit = litPips(value, 0, 1, count);
  return (
    <div
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={`${Math.round(value * 100)}%`}
      className="flex items-end cursor-pointer select-none"
      style={{ height: u(9), minHeight: 44, gap: u(0.5), touchAction: 'none', paddingLeft: u(1) }}
      {...dragAlong((f) => {
        const next = snapValue(pipsAt(f, count) / count, 0, 1, 0.05);
        if (next !== value) onChange(next);
      })}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="flex-1"
          style={{
            height: `${38 + (62 * i) / (count - 1)}%`,
            transform: 'skewX(-14deg)',
            background: i < lit ? color : '#262638',
            boxShadow: i < lit ? `0 0 ${u(1)} ${color}` : undefined,
            opacity: i < lit ? 0.55 + (0.45 * i) / (count - 1) : 1,
            transition: 'background 0.08s',
          }}
        />
      ))}
    </div>
  );
};
