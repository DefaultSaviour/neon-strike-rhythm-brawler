import React from 'react';

/** The three things players unlock, as tabs of one Unlocks screen. */
export type UnlockTab = 'heroes' | 'stances' | 'backdrops';

const TABS: Array<{ id: UnlockTab; label: string }> = [
  { id: 'heroes', label: 'Heroes' },
  { id: 'stances', label: 'Stances' },
  { id: 'backdrops', label: 'Backdrops' },
];

/** The tab bar shown under the header of each unlock screen. */
export const UnlockTabs: React.FC<{ tab: UnlockTab; onTab: (tab: UnlockTab) => void }> = ({ tab, onTab }) => (
  <div className="px-6 py-2.5 border-b border-slate-800 bg-slate-900/30">
    <div className="inline-flex rounded-lg border border-slate-700 overflow-hidden" role="tablist">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          onClick={() => onTab(t.id)}
          className={`px-4 py-1.5 text-xs font-bold cursor-pointer ${tab === t.id ? 'bg-cyan-400 text-black' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  </div>
);
