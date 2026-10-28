import React from 'react';

/** The three things players unlock, as tabs of one Unlocks screen. */
export type UnlockTab = 'heroes' | 'stances' | 'backdrops';

const TABS: Array<{ id: UnlockTab; label: string }> = [
  { id: 'heroes', label: 'Fighters' },
  { id: 'stances', label: 'Stances' },
  { id: 'backdrops', label: 'Backdrops' },
];

const SLANT = 'polygon(calc(var(--u) * 2) 0, 100% 0, calc(100% - calc(var(--u) * 2)) 100%, 0 100%)';

/**
 * The tab bar at the top right of each unlock screen: a slanted switch with
 * a yellow block on the open tab, and a pink chip counting new unlocks not
 * yet looked at.
 */
export const UnlockTabs: React.FC<{
  tab: UnlockTab;
  onTab: (tab: UnlockTab) => void;
  /** New unlocks not yet looked at, per tab: shown as a number chip */
  counts?: Partial<Record<UnlockTab, number>>;
}> = ({ tab, onTab, counts }) => {
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
};
