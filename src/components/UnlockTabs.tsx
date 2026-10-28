import React from 'react';
import { CountBadge } from './NewBadge';

/** The three things players unlock, as tabs of one Unlocks screen. */
export type UnlockTab = 'heroes' | 'stances' | 'backdrops';

const TABS: Array<{ id: UnlockTab; label: string }> = [
  { id: 'heroes', label: 'Fighters' },
  { id: 'stances', label: 'Stances' },
  { id: 'backdrops', label: 'Backdrops' },
];

const SLANT = 'polygon(calc(var(--u) * 2) 0, 100% 0, calc(100% - calc(var(--u) * 2)) 100%, 0 100%)';

/**
 * The tab bar shown under the header of each unlock screen. `arcade` draws it
 * the arcade way (a slanted switch with a yellow block on the open tab), for
 * the screens that have been redone in that style.
 */
export const UnlockTabs: React.FC<{
  tab: UnlockTab;
  onTab: (tab: UnlockTab) => void;
  /** New unlocks not yet tapped on, per tab: shown as a number badge */
  counts?: Partial<Record<UnlockTab, number>>;
  arcade?: boolean;
}> = ({ tab, onTab, counts, arcade = false }) => {
  if (arcade) {
    const index = Math.max(0, TABS.findIndex((t) => t.id === tab));
    return (
      <div role="tablist" aria-label="Unlocks" className="relative grid grid-cols-3" style={{ height: 'calc(var(--u) * 9)', minHeight: 44, background: '#0b0b14', clipPath: SLANT }}>
        <span
          aria-hidden="true"
          className="absolute top-0 bottom-0"
          style={{ left: `${(index * 100) / 3}%`, width: `${100 / 3}%`, background: 'var(--yellow)', clipPath: SLANT, transition: 'left 0.18s cubic-bezier(0.2, 0.9, 0.2, 1)' }}
        />
        {TABS.map((t, i) => {
          const count = counts?.[t.id] ?? 0;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => onTab(t.id)}
              className="relative flex items-center justify-center arc-display whitespace-nowrap cursor-pointer"
              style={{ gap: 'calc(var(--u) * 0.8)', fontSize: 'calc(var(--u) * 3.4)', color: i === index ? '#000' : '#8d95b3', transition: 'color 0.18s', background: 'none', border: 0, padding: '0 calc(var(--u) * 1.2)' }}
            >
              {t.label}
              {/* New unlocks not yet seen, as a pink chip beside the label (a corner bubble would be cut off by the slant) */}
              {count > 0 && (
                <span
                  aria-label={`${count} new`}
                  className="inline-grid place-items-center font-black not-italic"
                  style={{ fontFamily: 'Outfit, sans-serif', minWidth: 'max(18px, calc(var(--u) * 3.6))', height: 'max(18px, calc(var(--u) * 3.6))', padding: '0 calc(var(--u) * 0.6)', borderRadius: 999, background: 'var(--pink)', color: '#fff', fontSize: 'max(10px, calc(var(--u) * 2.1))' }}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    // Full width, and at least 44px tall: easy to hit with a thumb on a phone
    <div className="px-3 md:px-6 py-2.5 border-b border-slate-800 bg-slate-900/30">
      <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-700 bg-slate-950/60 p-1.5" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => onTab(t.id)}
            className={`relative min-h-11 rounded-lg text-sm md:text-base font-black tracking-wide uppercase cursor-pointer transition-colors ${
              tab === t.id ? 'bg-cyan-400 text-black shadow-[0_0_14px_rgba(0,243,255,0.4)]' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {t.label}
            {/* A corner bubble, so it never squeezes the label on a narrow phone */}
            <CountBadge count={counts?.[t.id] ?? 0} className="absolute -top-2 -right-1.5" />
          </button>
        ))}
      </div>
    </div>
  );
};
