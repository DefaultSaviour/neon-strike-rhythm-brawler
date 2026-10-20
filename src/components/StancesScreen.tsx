import React, { useEffect, useRef } from 'react';
import { NewTag } from './NewBadge';
import { ENEMY_MOTION_STYLES, EnemyMotionStyle } from '../game/enemyMotion';
import type { LifetimeStats } from '../game/heroUnlocks';
import { getActiveAnimations } from '../game/animationLibrary';
import { enemyPoseFor } from '../game/customAnimation';
import { getEnemyStyle } from '../game/enemyStyles';
import type { EnemyTier, FrequencyBand } from '../types/game';
import { drawEnemyArt } from './enemyArt';
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
  /** Open but not yet tapped on: these wear a NEW tag */
  isNew?: (id: EnemyMotionStyle) => boolean;
  /** The player tapped on a card */
  onSeen?: (id: EnemyMotionStyle) => void;
  /** The Heroes / Stances / Backdrops tab bar, shown under the header */
  tabs?: React.ReactNode;
  onClose: () => void;
}

const ORDER: EnemyMotionStyle[] = [...FREE_STANCES, ...STANCE_UNLOCK_ORDER];

/** A different enemy on each card, so the grid shows off the whole cast. */
const CAST: Array<[FrequencyBand, EnemyTier]> = [
  ['bass', 2],
  ['sub', 1],
  ['high', 1],
  ['bass', 3],
  ['sub', 3],
  ['high', 2],
  ['bass', 1],
  ['high', 3],
];

/** An enemy moving in a stance, on a steady beat (dark and grey when the stance is still locked). Same size as a hero portrait. */
export const StancePortrait: React.FC<{ stance: EnemyMotionStyle; band: FrequencyBand; tier: EnemyTier; locked: boolean }> = ({ stance, band, tier, locked }) => {
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
    const style = getEnemyStyle(band, tier);
    let frame = 0;
    const draw = () => {
      // Locked stances stand still; unlocked ones move on a beat of about 120 BPM
      const beat = locked ? 0.25 : (performance.now() / 1000) * 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, 62);
      // Facing left, like the enemies coming at you down the right lane; feet on the floor (y = 68)
      const scale = 0.8 * style.scale;
      ctx.translate(0, 68);
      ctx.scale(-scale, scale);
      ctx.translate(0, -68);
      if (locked) {
        ctx.filter = 'grayscale(1) brightness(0.35)';
        ctx.globalAlpha = 0.8;
      }
      ctx.strokeStyle = style.color;
      ctx.shadowColor = style.color;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const pose = enemyPoseFor(stance, beat, band, tier, getActiveAnimations());
      drawEnemyArt(ctx, pose, band, tier, { main: style.color, accent: style.accent }, beat, false);
      ctx.restore();
      if (!locked) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [stance, band, tier, locked]);
  return <canvas ref={ref} style={{ width: 120, height: 150 }} aria-hidden="true" />;
};

export const StancesScreen: React.FC<StancesScreenProps> = ({ stats, selected, isUnlocked, onSelect, onWatchAd, adBusy, adsOffNote, notice, isNew, onSeen, tabs, onClose }) => {
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
      <div className="w-full max-w-4xl bg-[#0b0d1e] border border-pink-500/30 rounded-xl shadow-[0_0_40px_rgba(255,0,127,0.15)] flex flex-col overflow-hidden h-[min(92vh,880px)]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 min-h-[128px] sm:min-h-[112px] lg:min-h-[88px] border-b border-slate-800 bg-slate-900/50">
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
        <div className="flex-1 min-h-0 content-start p-3 sm:p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {stances.map((m, i) => {
            const unlocked = isUnlocked(m.id);
            const chosen = m.id === selected;
            const isNext = m.id === next;
            const [band, tier] = CAST[i % CAST.length];
            return (
              <div
                key={m.id}
                onClick={() => unlocked && onSeen?.(m.id)}
                className={`relative rounded-xl border p-2 sm:p-3 flex flex-col items-center text-center gap-2 ${
                  chosen
                    ? 'border-cyan-400 bg-cyan-950/30 shadow-[0_0_18px_rgba(0,243,255,0.25)]'
                    : unlocked
                      ? 'border-slate-700 bg-slate-900/50'
                      : 'border-slate-800 bg-slate-950/70'
                }`}
              >
                {unlocked && isNew?.(m.id) && <NewTag />}
                <StancePortrait stance={m.id} band={band} tier={tier} locked={!unlocked} />
                <div className={`text-sm font-bold ${unlocked ? 'text-slate-100' : 'text-slate-500'}`}>
                  {!unlocked && <span aria-hidden="true">🔒 </span>}
                  {m.label}
                  {FREE_STANCES.includes(m.id) && <span className="ml-1.5 text-[10px] font-mono text-emerald-400">FREE</span>}
                </div>
                {unlocked ? (
                  <>
                    <div className="text-[11px] text-slate-400 leading-snug flex-1">{m.description}</div>
                    <button
                      type="button"
                      onClick={() => onSelect(m.id)}
                      disabled={chosen}
                      className={`w-full min-h-11 rounded-md text-sm font-bold transition-colors ${
                        chosen ? 'bg-cyan-400 text-black cursor-default' : 'bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer'
                      }`}
                    >
                      {chosen ? 'Selected' : 'Select'}
                    </button>
                  </>
                ) : (
                  <div className="w-full flex flex-col gap-1 flex-1 justify-end">
                    <div className="text-[11px] text-amber-300/90">
                      {isNext && wait !== null ? `Opens in ${formatCountdown(wait)} of play` : 'Keep playing to unlock'}
                    </div>
                  </div>
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
