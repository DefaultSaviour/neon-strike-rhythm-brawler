import React, { useEffect, useRef } from 'react';
import {
  BACKDROP_ITEMS,
  BACKDROP_LAYERS,
  BACKDROP_MILESTONES,
  BACKDROP_UNLOCK_PATH,
  BackdropLayer,
  nextBackdrop,
  scoreToNextBackdrop,
} from '../game/backdrops';
import type { LifetimeStats } from '../game/heroUnlocks';
import { drawBackdropLayers } from './backdropArt';
import { NewTag } from './NewBadge';

/**
 * Build your backdrop: a live preview at the top, then a row of pieces for
 * each layer (sky, skyline, centrepiece, floor). Locked pieces show the total
 * score that opens them; the next one can also be unlocked with an ad.
 */

interface BackdropScreenProps {
  stats: LifetimeStats;
  /** The pieces in use, one per layer */
  selected: Record<BackdropLayer, string>;
  isUnlocked: (id: string) => boolean;
  onSelect: (layer: BackdropLayer, id: string) => void;
  /** Present only when an ad can be shown here */
  onWatchAd?: () => void;
  adBusy?: boolean;
  /** Why ads can't be offered here, shown in place of the ad button */
  adsOffNote?: string | null;
  /** A message after watching an ad (unlocked, or why not) */
  notice?: string | null;
  /** Open but not yet tapped on: these wear a NEW tag */
  isNew?: (id: string) => boolean;
  /** The player tapped on a piece */
  onSeen?: (id: string) => void;
  /** The Heroes / Stances / Backdrops tab bar, shown under the header */
  tabs?: React.ReactNode;
  onClose: () => void;
}

/** Draws a backdrop onto a canvas: animated (the live preview) or a still (a piece's thumbnail). */
const BackdropCanvas: React.FC<{ pieces: Record<BackdropLayer, string>; animated?: boolean; className?: string; dim?: boolean; closeUp?: boolean }> = ({
  pieces,
  animated,
  className,
  dim,
  closeUp,
}) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let frame = 0;
    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const time = animated ? performance.now() / 1000 : 2.4;
      // A gentle pretend beat for the preview (about 120 BPM)
      const pulse = animated ? Math.max(0, 1 - ((time * 2) % 1) * 2.5) : 0.6;
      // Thumbnails are a close-up on the horizon, so a small piece still reads
      const view = closeUp ? { hy: h * 0.62, s: h / 95, beltTop: h * 1.4 } : { hy: h * 0.42, s: h / 230, beltTop: h * 0.92 };
      drawBackdropLayers({ ctx, width: w, cx: w / 2, ...view, pulse, bass: pulse * 0.8, time }, pieces);
      if (animated) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [pieces, animated, closeUp]);
  return <canvas ref={ref} className={`${className ?? ''} ${dim ? 'opacity-30 grayscale' : ''}`} />;
};

export const BackdropScreen: React.FC<BackdropScreenProps> = ({ stats, selected, isUnlocked, onSelect, onWatchAd, adBusy, adsOffNote, notice, isNew, onSeen, tabs, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const next = nextBackdrop(stats);
  const toGo = scoreToNextBackdrop(stats);
  const milestoneFor = (id: string) => BACKDROP_MILESTONES[BACKDROP_UNLOCK_PATH.indexOf(id)];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-4xl bg-[#0b0d1e] border border-cyan-400/30 rounded-xl shadow-[0_0_40px_rgba(0,243,255,0.15)] flex flex-col overflow-hidden h-[min(92vh,880px)]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 min-h-[128px] sm:min-h-[112px] lg:min-h-[88px] border-b border-slate-800 bg-slate-900/50">
          <div>
            <div className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-pink-500 to-amber-300">BACKDROP</div>
            <div className="text-xs text-slate-400">Mix your own: a sky, a skyline, a centrepiece and a floor. New pieces open as your total score grows.</div>
          </div>
          {next && toGo !== null ? (
            <div className="flex items-center gap-2">
              <div className="text-right font-mono">
                <div className="text-[10px] text-slate-500 uppercase">Next: {next.label}</div>
                <div className="text-sm font-bold text-amber-300 tabular-nums">{toGo.toLocaleString()} points to go</div>
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
            <div className="text-sm font-bold text-emerald-300">Every piece unlocked!</div>
          )}
        </div>

        {tabs}

        {notice && (
          <div role="status" className="px-6 py-2 text-sm font-bold text-amber-200 bg-amber-500/10 border-b border-amber-400/30">
            {notice}
          </div>
        )}

        <div className="flex-1 min-h-0 p-4 md:p-6 overflow-y-auto flex flex-col gap-4">
          <BackdropCanvas pieces={selected} animated className="w-full h-36 md:h-48 rounded-lg border border-slate-700" />

          {BACKDROP_LAYERS.map(({ layer, label }) => (
            <div key={layer}>
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">{label}</div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {BACKDROP_ITEMS.filter((b) => b.layer === layer).map((b) => {
                  const unlocked = isUnlocked(b.id);
                  const chosen = selected[layer] === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      disabled={!unlocked || chosen}
                      onClick={() => {
                        onSeen?.(b.id);
                        onSelect(layer, b.id);
                      }}
                      title={b.description}
                      className={`relative flex flex-col rounded-lg border overflow-hidden text-left ${
                        chosen ? 'border-cyan-400 shadow-[0_0_12px_rgba(0,243,255,0.35)]' : unlocked ? 'border-slate-700 hover:border-cyan-400 cursor-pointer' : 'border-slate-800 cursor-default'
                      }`}
                    >
                      {unlocked && isNew?.(b.id) && <NewTag />}
                      <BackdropCanvas pieces={{ ...selected, [layer]: b.id }} dim={!unlocked} closeUp className="w-full h-14" />
                      <div className="px-2 py-1.5 bg-slate-950/80">
                        <div className={`text-[11px] font-bold truncate ${unlocked ? 'text-slate-100' : 'text-slate-500'}`}>
                          {!unlocked && '🔒 '}
                          {b.label}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">
                          {chosen ? 'In use' : unlocked ? 'Use' : `${(milestoneFor(b.id) ?? 0).toLocaleString()} pts`}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
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
