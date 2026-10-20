import React, { useEffect } from 'react';
import { ENEMY_MOTION_STYLES, EnemyMotionStyle } from '../game/enemyMotion';
import type { LifetimeStats } from '../game/heroUnlocks';
import { FREE_STANCES, formatCountdown, MINUTES_PER_STANCE, nextStance, secondsToNextStance, STANCE_UNLOCK_ORDER } from '../game/stanceUnlocks';

/**
 * How the enemies move. Two are free; the rest open one every 20 minutes of
 * play, or straight away by watching an ad.
 */

interface StancesScreenProps {
  stats: LifetimeStats;
  selected: EnemyMotionStyle;
  isUnlocked: (id: EnemyMotionStyle) => boolean;
  onSelect: (id: EnemyMotionStyle) => void;
  /** Present only when an ad can be shown here */
  onWatchAd?: () => void;
  adBusy?: boolean;
  /** Why ads can't be offered here, shown in place of the ad button */
  adsOffNote?: string | null;
  /** A message after watching an ad (unlocked, or why not) */
  notice?: string | null;
  /** The Heroes / Stances / Backdrops tab bar, shown under the header */
  tabs?: React.ReactNode;
  onClose: () => void;
}

const ORDER: EnemyMotionStyle[] = [...FREE_STANCES, ...STANCE_UNLOCK_ORDER];

export const StancesScreen: React.FC<StancesScreenProps> = ({ stats, selected, isUnlocked, onSelect, onWatchAd, adBusy, adsOffNote, notice, tabs, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const stances = ORDER.map((id) => ENEMY_MOTION_STYLES.find((m) => m.id === id)!);
  const next = nextStance(stats);
  const wait = secondsToNextStance(stats);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-4xl bg-[#0b0d1e] border border-pink-500/30 rounded-xl shadow-[0_0_40px_rgba(255,0,127,0.15)] flex flex-col overflow-hidden max-h-[92vh]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div>
            <div className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-amber-300 to-cyan-400">
              ENEMY STANCES
            </div>
            <div className="text-xs text-slate-400">How the enemies move. A new one opens every {MINUTES_PER_STANCE} minutes of play.</div>
          </div>
          {next && wait !== null ? (
            <div className="flex items-center gap-2">
              <div className="text-right font-mono">
                <div className="text-[10px] text-slate-500 uppercase">Next stance in</div>
                <div className="text-lg font-bold text-amber-300 tabular-nums">{formatCountdown(wait)}</div>
              </div>
              {onWatchAd && (
                <button
                  type="button"
                  onClick={onWatchAd}
                  disabled={adBusy}
                  className="px-3 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-black text-xs font-black tracking-wide cursor-pointer"
                >
                  ▶ Watch ad to unlock now
                </button>
              )}
              {!onWatchAd && adsOffNote && <div className="max-w-[12rem] text-[11px] text-slate-500 leading-snug">{adsOffNote}</div>}
            </div>
          ) : (
            <div className="text-sm font-bold text-emerald-300">All stances unlocked!</div>
          )}
        </div>

        {tabs}

        {notice && (
          <div role="status" className="px-6 py-2 text-sm font-bold text-amber-200 bg-amber-500/10 border-b border-amber-400/30">
            {notice}
          </div>
        )}
        <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stances.map((m) => {
            const unlocked = isUnlocked(m.id);
            const chosen = m.id === selected;
            const isNext = m.id === next;
            return (
              <div
                key={m.id}
                className={`rounded-xl border p-3 flex items-center gap-3 ${
                  chosen
                    ? 'border-cyan-400 bg-cyan-950/30'
                    : unlocked
                      ? 'border-slate-700 bg-slate-900/50'
                      : 'border-slate-800 bg-slate-950/70'
                }`}
              >
                <div className="flex-1">
                  <div className={`text-sm font-bold ${unlocked ? 'text-slate-100' : 'text-slate-500'}`}>
                    {!unlocked && <span aria-hidden="true">🔒 </span>}
                    {m.label}
                    {FREE_STANCES.includes(m.id) && <span className="ml-2 text-[10px] font-mono text-emerald-400">FREE</span>}
                  </div>
                  <div className={`text-[11px] leading-snug ${unlocked ? 'text-slate-400' : 'text-slate-600'}`}>
                    {unlocked ? m.description : isNext && wait !== null ? `Next up: opens in ${formatCountdown(wait)} of play` : 'Locked: keep playing'}
                  </div>
                </div>
                {unlocked && (
                  <button
                    type="button"
                    onClick={() => onSelect(m.id)}
                    disabled={chosen}
                    className={`min-h-11 px-4 rounded-md text-sm font-bold shrink-0 ${
                      chosen ? 'bg-cyan-400 text-black cursor-default' : 'bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer'
                    }`}
                  >
                    {chosen ? 'Selected' : 'Select'}
                  </button>
                )}
              </div>
            );
          })}
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
