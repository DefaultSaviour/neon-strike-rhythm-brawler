import React, { useEffect, useState } from 'react';
import type { LifetimeStats } from '../game/heroUnlocks';
import { byCombo, byScore, SongRecord } from '../game/records';

/**
 * The player's own records, in three tabs: best single-song score, total
 * score over every song, and biggest combo. (On CrazyGames, the best
 * single-song score also goes to the site's leaderboard.)
 */

interface RecordsScreenProps {
  stats: LifetimeStats;
  /** Every song played, with its best score and combo */
  songs: SongRecord[];
  onClose: () => void;
}

type Tab = 'song' | 'total' | 'combo';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'song', label: 'Best Song' },
  { id: 'total', label: 'Total Score' },
  { id: 'combo', label: 'Biggest Combo' },
];

/** The big headline number at the top of a tab. */
const Headline: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="flex flex-col items-center text-center py-4">
    <div className="text-[11px] uppercase tracking-widest text-slate-400">{label}</div>
    <div className="text-4xl md:text-5xl font-black font-mono tabular-nums text-transparent bg-clip-text bg-gradient-to-b from-white via-amber-200 to-amber-400 drop-shadow-[0_0_18px_rgba(255,194,58,0.35)]">
      {value}
    </div>
    {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
  </div>
);

/** A ranked list of songs, showing one number per song. */
const SongList: React.FC<{ songs: SongRecord[]; value: (s: SongRecord) => string }> = ({ songs, value }) => (
  <ol className="flex flex-col gap-2">
    {songs.map((s, i) => (
      <li key={s.trackId} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${i === 0 ? 'border-amber-400/50 bg-amber-400/10' : 'border-slate-800 bg-slate-900/50'}`}>
        <span className={`w-6 text-center font-black font-mono ${i === 0 ? 'text-amber-300' : 'text-slate-500'}`}>{i + 1}</span>
        <span className="flex-1 font-bold text-slate-100 truncate">{s.title}</span>
        <span className="text-[11px] font-mono text-slate-500">{s.grade}</span>
        <span className="font-black font-mono tabular-nums text-slate-100">{value(s)}</span>
      </li>
    ))}
  </ol>
);

export const RecordsScreen: React.FC<RecordsScreenProps> = ({ stats, songs, onClose }) => {
  const [tab, setTab] = useState<Tab>('song');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ranked = byScore(songs);
  const best = ranked[0];
  const hours = Math.floor(stats.playSeconds / 3600);
  const minutes = Math.floor((stats.playSeconds % 3600) / 60);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-[#0b0d1e] border border-amber-400/30 rounded-xl shadow-[0_0_40px_rgba(255,194,58,0.15)] flex flex-col overflow-hidden max-h-[92vh]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div>
            <div className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-pink-500 to-cyan-400">RECORDS</div>
            <div className="text-xs text-slate-400">Your best runs. Your best song score also goes on the CrazyGames leaderboard.</div>
          </div>
        </div>

        {/* Full width, and at least 44px tall: easy to hit with a thumb on a phone */}
        <div className="px-3 md:px-6 py-2.5 border-b border-slate-800 bg-slate-900/30">
          <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-700 bg-slate-950/60 p-1.5" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`min-h-11 rounded-lg text-xs sm:text-sm md:text-base font-black tracking-wide uppercase cursor-pointer transition-colors ${
                  tab === t.id ? 'bg-amber-400 text-black shadow-[0_0_14px_rgba(255,194,58,0.4)]' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          {songs.length === 0 ? (
            <div className="py-10 text-center text-slate-400">No records yet: play a song to set your first.</div>
          ) : tab === 'song' ? (
            <>
              <Headline label="Best single song" value={best.score.toLocaleString()} sub={best.title} />
              <SongList songs={ranked} value={(s) => s.score.toLocaleString()} />
            </>
          ) : tab === 'total' ? (
            <>
              <Headline label="Total score, every song" value={stats.totalScore.toLocaleString()} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
                {[
                  ['Songs cleared', stats.songsCleared.toLocaleString()],
                  ['Enemies defeated', stats.enemiesDefeated.toLocaleString()],
                  ['PERFECT hits', stats.perfects.toLocaleString()],
                  ['Time played', hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/50 py-3">
                    <div className="text-[10px] uppercase text-slate-500">{label}</div>
                    <div className="text-lg font-bold text-slate-100 tabular-nums">{value}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <Headline label="Biggest combo ever" value={`${stats.bestCombo.toLocaleString()}x`} />
              <SongList songs={byCombo(songs)} value={(s) => `${s.combo.toLocaleString()}x`} />
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-sm tracking-wide cursor-pointer"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
};
