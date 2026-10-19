import React, { useEffect, useRef } from 'react';
import { HeroId, HEROES } from '../game/heroes';
import { LifetimeStats, UNLOCK_ORDER, unlockProgress } from '../game/heroUnlocks';
import { fighterTier } from '../game/fighterTier';
import { drawFighter } from './fighterArt';

/**
 * Every hero in the order they're earned: unlocked ones drawn in their
 * stance with a Select button, locked ones as dark silhouettes with their
 * goal and progress. Your lifetime totals sit at the top.
 */

interface UnlocksScreenProps {
  stats: LifetimeStats;
  /** The hero you'll play as */
  selectedHero: HeroId;
  isUnlocked: (id: HeroId) => boolean;
  onSelect: (id: HeroId) => void;
  onClose: () => void;
}

/** A hero drawn in their fighting stance (dark and grey when still locked). */
const HeroPortrait: React.FC<{ id: HeroId; locked: boolean }> = ({ id, locked }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = 120;
    const h = 150;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const hero = HEROES.find((x) => x.id === id)!;
    ctx.save();
    ctx.translate(w / 2, 100);
    ctx.scale(0.95, 0.95);
    if (locked) {
      ctx.filter = 'grayscale(1) brightness(0.35)';
      ctx.globalAlpha = 0.8;
    }
    drawFighter(ctx, hero.idlePose, { tier: fighterTier(0), facing: 1, time: 0.4, hero: id, random: () => 0.5 });
    ctx.restore();
  }, [id, locked]);
  return <canvas ref={ref} style={{ width: 120, height: 150 }} aria-hidden="true" />;
};

export const UnlocksScreen: React.FC<UnlocksScreenProps> = ({ stats, selectedHero, isUnlocked, onSelect, onClose }) => {
  const heroes = [...HEROES].sort((a, b) => UNLOCK_ORDER.indexOf(a.id) - UNLOCK_ORDER.indexOf(b.id));
  const unlockedCount = heroes.filter((h) => isUnlocked(h.id)).length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const totals: Array<[string, number]> = [
    ['Enemies defeated', stats.enemiesDefeated],
    ['PERFECT hits', stats.perfects],
    ['Best combo', stats.bestCombo],
    ['Songs cleared', stats.songsCleared],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-4xl bg-[#0b0d1e] border border-amber-400/30 rounded-xl shadow-[0_0_40px_rgba(255,194,58,0.15)] flex flex-col overflow-hidden max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div>
            <div className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-pink-500 to-cyan-400">
              UNLOCKS
            </div>
            <div className="text-xs text-slate-400">
              {unlockedCount} of {heroes.length} heroes earned
            </div>
          </div>
          <div className="hidden sm:grid grid-cols-4 gap-4 text-right font-mono">
            {totals.map(([label, value]) => (
              <div key={label}>
                <div className="text-[10px] text-slate-500 uppercase">{label}</div>
                <div className="text-sm font-bold text-slate-100 tabular-nums">{value.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {heroes.map((h) => {
            const unlocked = isUnlocked(h.id);
            const progress = unlockProgress(h.id, stats);
            const chosen = h.id === selectedHero;
            return (
              <div
                key={h.id}
                className={`rounded-xl border p-3 flex flex-col items-center text-center gap-2 ${
                  chosen
                    ? 'border-cyan-400 bg-cyan-950/30 shadow-[0_0_18px_rgba(0,243,255,0.25)]'
                    : unlocked
                      ? 'border-slate-700 bg-slate-900/50'
                      : 'border-slate-800 bg-slate-950/70'
                }`}
              >
                <HeroPortrait id={h.id} locked={!unlocked} />
                <div className={`text-sm font-bold ${unlocked ? 'text-slate-100' : 'text-slate-500'}`}>
                  {!unlocked && <span aria-hidden="true">🔒 </span>}
                  {h.label}
                </div>
                {unlocked ? (
                  <>
                    <div className="text-[11px] text-slate-400 leading-snug flex-1">{h.description}</div>
                    <button
                      type="button"
                      onClick={() => onSelect(h.id)}
                      disabled={chosen}
                      className={`w-full py-1.5 rounded-md text-xs font-bold transition-colors ${
                        chosen ? 'bg-cyan-400 text-black cursor-default' : 'bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer'
                      }`}
                    >
                      {chosen ? 'Selected' : 'Select'}
                    </button>
                  </>
                ) : (
                  progress && (
                    <div className="w-full flex flex-col gap-1 flex-1 justify-end">
                      <div className="text-[11px] text-amber-300/90">{progress.goal.label}</div>
                      <div className="w-full h-1.5 rounded bg-slate-800 overflow-hidden">
                        <div className="h-full bg-amber-400/80" style={{ width: `${(progress.current / progress.goal.target) * 100}%` }} />
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {progress.current.toLocaleString()} / {progress.goal.target.toLocaleString()}
                      </div>
                    </div>
                  )
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
