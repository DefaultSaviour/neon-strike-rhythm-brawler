import React from 'react';
import { CountBadge } from './NewBadge';

/** The three things players unlock, as tabs of one Unlocks screen. */
export type UnlockTab = 'heroes' | 'stances' | 'backdrops';

const TABS: Array<{ id: UnlockTab; label: string }> = [
  { id: 'heroes', label: 'Heroes' },
  { id: 'stances', label: 'Stances' },
  { id: 'backdrops', label: 'Backdrops' },
];

/** The tab bar shown under the header of each unlock screen. */
export const UnlockTabs: React.FC<{
  tab: UnlockTab;
  onTab: (tab: UnlockTab) => void;
  /** New unlocks not yet tapped on, per tab: shown as a number badge */
  counts?: Partial<Record<UnlockTab, number>>;
}> = ({ tab, onTab, counts }) => (
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
