import React from 'react';

/** A round pink badge holding how many new unlocks haven't been tapped on yet. Draws nothing at zero. */
export const CountBadge: React.FC<{ count: number; className?: string }> = ({ count, className }) =>
  count > 0 ? (
    <span
      aria-label={`${count} new`}
      className={`inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-pink-500 text-white text-xs font-black tabular-nums leading-none shadow-[0_0_10px_rgba(236,72,153,0.7)] ${className ?? ''}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  ) : null;

/** The "NEW" tag on the corner of a card the player hasn't tapped on yet. */
export const NewTag: React.FC = () => (
  <span className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded-full bg-pink-500 text-white text-[10px] font-black tracking-wider leading-none shadow-[0_0_8px_rgba(236,72,153,0.7)] pointer-events-none">
    NEW
  </span>
);
