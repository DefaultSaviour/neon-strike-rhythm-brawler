import React, { useEffect, useState } from 'react';
import { audioEngine } from '../audio/audioEngine';
import type { BackdropLayer } from '../game/backdrops';
import { BACKDROP_MILESTONES, BACKDROP_UNLOCK_PATH, scoreToNextBackdrop } from '../game/backdrops';
import type { EnemyMotionStyle } from '../game/enemyMotion';
import type { HeroId } from '../game/heroes';
import { HERO_UNLOCKS, LifetimeStats } from '../game/heroUnlocks';
import { backdropLayerOf, describeUnlock, RunUnlock } from '../game/runUnlocks';
import { MINUTES_PER_STANCE } from '../game/stanceUnlocks';
import { BackdropCanvas } from './BackdropCanvas';
import { StancePortrait } from './StancePortrait';
import { HeroPortrait } from './HeroPortrait';

/**
 * The popup after a song that unlocked something: one card per unlock
 * ("1 / 3"), each with a fanfare (a pop, turning rays, a chime) and an Equip
 * button. When a rewarded ad can unlock something more (The Bride while
 * she's locked, else the next stance or backdrop piece), the last card
 * offers it: watch an ad and it's unlocked and equipped straight away, or
 * "No thanks". Every offer can also be earned by playing, as CrazyGames
 * requires, and the card says how.
 */

interface UnlockFanfareProps {
  unlocks: RunUnlock[];
  /** What an ad would unlock now (null: no ads here, or nothing left) */
  offer: RunUnlock | null;
  /** The offer was watched and unlocked */
  offerTaken: boolean;
  adBusy: boolean;
  /** Why the last ad gave nothing, if it didn't */
  notice?: string | null;
  stats: LifetimeStats;
  /** The backdrop in use (a new piece is shown in place on it) */
  backdrop: Record<BackdropLayer, string>;
  isEquipped: (u: RunUnlock) => boolean;
  onEquip: (u: RunUnlock) => void;
  onWatchOffer: () => void;
  onClose: () => void;
}

/** The unlock itself, drawn big: the hero, an enemy in the stance, or the backdrop with the new piece. */
const UnlockArt: React.FC<{ unlock: RunUnlock; backdrop: Record<BackdropLayer, string> }> = ({ unlock, backdrop }) => {
  // Portraits are drawn at card size: shown bigger here
  const big = 'scale-[1.35] [@media(max-height:479px)]:scale-[0.7]';
  if (unlock.kind === 'hero') return <div className={big}><HeroPortrait id={unlock.id as HeroId} locked={false} /></div>;
  if (unlock.kind === 'stance') return <div className={big}><StancePortrait stance={unlock.id as EnemyMotionStyle} band="bass" tier={2} locked={false} /></div>;
  const layer = backdropLayerOf(unlock.id);
  return <BackdropCanvas pieces={layer ? { ...backdrop, [layer]: unlock.id } : backdrop} animated closeUp className="w-56 h-32 rounded-lg border border-slate-700" />;
};

/** How it was earned (on an unlock card). */
function earnedText(u: RunUnlock): string {
  if (u.kind === 'hero') return `${HERO_UNLOCKS[u.id as HeroId]?.label ?? 'Goal reached'}: done!`;
  if (u.kind === 'stance') return `${MINUTES_PER_STANCE} more minutes of play: done!`;
  const milestone = BACKDROP_MILESTONES[BACKDROP_UNLOCK_PATH.indexOf(u.id)];
  return milestone ? `Total score passed ${milestone.toLocaleString()}` : 'Total score milestone passed';
}

/** How to earn the offer without an ad (on the offer card). */
function earnText(u: RunUnlock, stats: LifetimeStats): string {
  if (u.kind === 'hero') return `Or earn it by playing: ${HERO_UNLOCKS[u.id as HeroId]?.label.toLowerCase() ?? 'keep playing'}.`;
  if (u.kind === 'stance') return `Or earn it by playing: a new stance opens every ${MINUTES_PER_STANCE} minutes.`;
  const toGo = scoreToNextBackdrop(stats);
  if (toGo === 0) return 'Or earn it by playing: it opens after your next song.';
  return toGo ? `Or earn it by playing: ${toGo.toLocaleString()} more points.` : 'Or earn it by playing.';
}

export const UnlockFanfare: React.FC<UnlockFanfareProps> = ({ unlocks, offer, offerTaken, adBusy, notice, stats, backdrop, isEquipped, onEquip, onWatchOffer, onClose }) => {
  const cards = [...unlocks.map((u) => ({ offer: false, u })), ...(offer ? [{ offer: true, u: offer }] : [])];
  const [step, setStep] = useState(0);
  const card = cards[Math.min(step, cards.length - 1)];
  const last = step >= cards.length - 1;
  const next = () => (last ? onClose() : setStep((s) => s + 1));

  // A chime for every new unlock (not for the ad offer, nor while an ad is playing)
  useEffect(() => {
    if (card && !card.offer) audioEngine.playUnlockFanfare();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (offerTaken) audioEngine.playUnlockFanfare();
  }, [offerTaken]);

  // Space / Enter: next (on the offer card: no thanks, so an ad never starts by accident). Escape: close.
  // Captured here so the results screen behind doesn't restart the song.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'Enter' || e.key === 'Escape' || e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (adBusy) return;
        if (e.key === 'Escape') onClose();
        else if (e.code === 'Space' || e.key === 'Enter') next();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  if (!card) return null;
  const info = describeUnlock(card.u);
  const equipped = isEquipped(card.u);
  const gold = !card.offer || offerTaken;

  return (
    // Short screens (a phone held sideways) get a tighter card, and can scroll if it still doesn't fit
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={info.kind}>
      <div className="flex min-h-full items-center justify-center p-4 [@media(max-height:479px)]:p-1">
        <div
          key={`${step}-${offerTaken}`}
          className={`unlock-pop relative w-full max-w-sm overflow-hidden rounded-2xl border-2 bg-[#0b0d1e] p-5 [@media(max-height:479px)]:p-3 text-center ${
            gold ? 'border-amber-400/80 shadow-[0_0_60px_rgba(255,194,58,0.35)]' : 'border-cyan-400/70 shadow-[0_0_50px_rgba(0,243,255,0.3)]'
          }`}
        >
          {cards.length > 1 && <div className="absolute top-3 right-4 text-xs font-mono font-bold text-slate-400">{step + 1} / {cards.length}</div>}
          <div className={`px-10 text-[11px] font-black tracking-[0.25em] uppercase ${gold ? 'text-amber-300' : 'text-cyan-300'}`}>
            {card.offer ? (offerTaken ? 'Unlocked!' : 'Bonus unlock') : `${info.kind} unlocked!`}
          </div>

          {/* The art, with turning rays and a few sparkles behind it */}
          <div className="relative my-3 h-44 [@media(max-height:479px)]:my-1 [@media(max-height:479px)]:h-24 flex items-center justify-center">
            <div
              className="unlock-rays absolute w-72 h-72 rounded-full opacity-40"
              style={{
                background: `repeating-conic-gradient(${gold ? 'rgba(255,194,58,0.55)' : 'rgba(0,243,255,0.45)'} 0deg 10deg, transparent 10deg 30deg)`,
                maskImage: 'radial-gradient(circle, black 20%, transparent 70%)',
                WebkitMaskImage: 'radial-gradient(circle, black 20%, transparent 70%)',
              }}
            />
            {[
              [12, 18, 0],
              [82, 24, 0.5],
              [20, 78, 0.9],
              [86, 72, 0.3],
              [50, 6, 1.2],
            ].map(([x, y, delay], i) => (
              <span
                key={i}
                className={`unlock-twinkle absolute w-2 h-2 rotate-45 ${gold ? 'bg-amber-200' : 'bg-cyan-200'}`}
                style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s` }}
              />
            ))}
            <div className="relative">
              <UnlockArt unlock={card.u} backdrop={backdrop} />
            </div>
          </div>

          <div className="text-2xl font-black text-white">{info.name}</div>
          <div className="mt-1 text-sm [@media(max-height:479px)]:text-xs text-slate-300">{info.description}</div>

          {!card.offer && (
            <>
              <div className="mt-2 text-xs text-amber-300/90">{earnedText(card.u)}</div>
              <div className="mt-4 [@media(max-height:479px)]:mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // Equip it and move straight on (to the next card, or close on the last)
                    onEquip(card.u);
                    next();
                  }}
                  disabled={equipped}
                  className="flex-1 min-h-11 rounded-lg font-bold text-sm bg-amber-400 text-slate-900 hover:bg-amber-300 disabled:bg-emerald-400 disabled:cursor-default cursor-pointer"
                >
                  {equipped ? 'Equipped ✓' : 'Equip'}
                </button>
                <button type="button" onClick={next} className="flex-1 min-h-11 rounded-lg font-bold text-sm bg-slate-800 text-slate-100 border border-slate-600 hover:bg-slate-700 cursor-pointer">
                  {last ? 'Done' : 'Next'}
                </button>
              </div>
            </>
          )}

          {card.offer && !offerTaken && (
            <>
              <div className="mt-3 [@media(max-height:479px)]:mt-1 text-sm [@media(max-height:479px)]:text-xs text-cyan-200">Watch a short ad to unlock it now. It's equipped straight away.</div>
              <div className="mt-1 text-[11px] text-slate-400">{earnText(card.u, stats)}</div>
              {notice && <div className="mt-2 text-xs text-pink-300">{notice}</div>}
              <div className="mt-4 [@media(max-height:479px)]:mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={onWatchOffer}
                  disabled={adBusy}
                  className="flex-1 min-h-11 rounded-lg font-bold text-sm bg-cyan-400 text-slate-900 hover:bg-cyan-300 disabled:opacity-60 cursor-pointer"
                >
                  {adBusy ? 'Loading ad…' : '▶ Watch ad'}
                </button>
                <button type="button" onClick={onClose} disabled={adBusy} className="flex-1 min-h-11 rounded-lg font-bold text-sm bg-slate-800 text-slate-300 border border-slate-600 hover:bg-slate-700 cursor-pointer">
                  No thanks
                </button>
              </div>
            </>
          )}

          {card.offer && offerTaken && (
            <>
              <div className="mt-2 text-xs text-amber-300/90">Unlocked and equipped. Enjoy!</div>
              <button type="button" onClick={onClose} className="mt-4 w-full min-h-11 rounded-lg font-bold text-sm bg-amber-400 text-slate-900 hover:bg-amber-300 cursor-pointer">
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
