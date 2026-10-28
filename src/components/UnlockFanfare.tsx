import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioEngine } from '../audio/audioEngine';
import { BACKDROP_LAYERS, BACKDROP_MILESTONES, BACKDROP_UNLOCK_PATH, BackdropLayer, scoreToNextBackdrop } from '../game/backdrops';
import type { EnemyMotionStyle } from '../game/enemyMotion';
import { HeroId, HEROES } from '../game/heroes';
import { HERO_UNLOCKS, isHeroUnlocked, LifetimeStats, UNLOCK_ORDER } from '../game/heroUnlocks';
import { fighterTier } from '../game/fighterTier';
import { getEnemyStyle } from '../game/enemyStyles';
import { backdropLayerOf, describeUnlock, RunUnlock } from '../game/runUnlocks';
import { isStanceUnlocked, MINUTES_PER_STANCE } from '../game/stanceUnlocks';
import { ArcadeScreen, HeroFigure, SlantButton } from './arcade/ui';
import { EnemyFigure } from './arcade/EnemyFigure';
import { BackdropReveal } from './arcade/BackdropReveal';
import { ShowcaseCounter, showcaseCombo } from './arcade/fighterCarousel';
import { heardBeat, small, u, UnlockCarousel } from './arcade/UnlockCarousel';
import { RevealKind, revealLength, RevealPhase, revealPhase, spinLeft, spinPlaces } from './arcade/unlockReveal';
import { CAST, ORDER as STANCE_ORDER } from './StancesScreen';

/**
 * The popup after a song that unlocked something, arcade style: one unlock
 * at a time ("1 / 3"), each revealed with a spin.
 * - A fighter or a stance: the Fighters / Stances carousel spins fast, slows
 *   and lands on it; then the fighter fights (the combo climbing) or the
 *   enemy moves in the stance.
 * - A backdrop piece: its layer spins alone on a dark stage, lands on the new
 *   piece, and the rest of your backdrop builds round it.
 * A tap or click anywhere while it's revealing skips to the end (and does
 * nothing else). Equip puts it in use and moves straight on to the next.
 *
 * When a rewarded ad can unlock something more (The Bride while she's
 * locked, else the next stance or backdrop piece), the last card offers it,
 * revealed the same way: watch an ad and it's unlocked and equipped, or "No
 * thanks". Every offer can also be earned by playing, as CrazyGames
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
  /** The backdrop in use (a new piece is built into it) */
  backdrop: Record<BackdropLayer, string>;
  isEquipped: (u: RunUnlock) => boolean;
  onEquip: (u: RunUnlock) => void;
  onWatchOffer: () => void;
  onClose: () => void;
}

const FIGHTERS = [...HEROES].sort((a, b) => UNLOCK_ORDER.indexOf(a.id) - UNLOCK_ORDER.indexOf(b.id));

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

/** What the stamp says as it lands: "New fighter!", "New stance!", "New sky!" */
function stampText(u: RunUnlock): string {
  if (u.kind === 'hero') return 'New fighter!';
  if (u.kind === 'stance') return 'New stance!';
  const layer = backdropLayerOf(u.id);
  return `New ${(BACKDROP_LAYERS.find((l) => l.layer === layer)?.label ?? 'backdrop').toLowerCase()}!`;
}

export const UnlockFanfare: React.FC<UnlockFanfareProps> = ({ unlocks, offer, offerTaken, adBusy, notice, stats, backdrop, isEquipped, onEquip, onWatchOffer, onClose }) => {
  const cards = [...unlocks.map((u) => ({ offer: false, u })), ...(offer ? [{ offer: true, u: offer }] : [])];
  const [step, setStep] = useState(0);
  const card = cards[Math.min(step, cards.length - 1)];
  const last = step >= cards.length - 1;
  const kind: RevealKind = card?.u.kind === 'backdrop' ? 'backdrop' : 'carousel';
  const [leaving, setLeaving] = useState(false);
  const next = useCallback(() => {
    setLeaving(false);
    if (last) onClose();
    else setStep((s) => s + 1);
  }, [last, onClose]);

  // The reveal's clock: restarts with each card; a tap moves it to the end
  const startedAt = useRef(performance.now());
  const elapsed = useCallback(() => (performance.now() - startedAt.current) / 1000, []);
  const [phase, setPhase] = useState<RevealPhase>('spin');
  const [spin, setSpin] = useState(0);
  const ring = card?.u.kind === 'hero' ? FIGHTERS.length : STANCE_ORDER.length;
  const places = spinPlaces(ring);
  const skip = useCallback(() => {
    startedAt.current = Math.min(startedAt.current, performance.now() - revealLength(kind) * 1000);
  }, [kind]);
  useEffect(() => {
    startedAt.current = performance.now();
    setPhase('spin');
    setSpin(kind === 'carousel' ? places : 0);
    let raf = 0;
    let was: RevealPhase = 'spin';
    const tick = () => {
      const t = elapsed();
      const now = revealPhase(kind, t);
      if (kind === 'carousel') setSpin(spinLeft(t, places));
      if (now !== was) {
        // A chime as it lands (not for the ad offer: that one chimes when it's taken)
        if (was === 'spin' && !card?.offer) audioEngine.playUnlockFanfare();
        was = now;
        setPhase(now);
      }
      if (now !== 'ready') raf = requestAnimationFrame(tick);
      else setSpin(0);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (offerTaken) audioEngine.playUnlockFanfare();
  }, [offerTaken]);
  const ready = phase === 'ready';
  const landed = phase !== 'spin';

  // A fighter that's landed fights, building a combo, as on the Fighters tab
  const counter = useRef(new ShowcaseCounter());
  const showcaseBeat = useCallback(() => {
    const b = heardBeat();
    return { ...b, beat: counter.current.beatsIn(`${step}`, b.beat) };
  }, [step]);
  const [beatsIn, setBeatsIn] = useState(0);
  useEffect(() => {
    if (!landed || card?.u.kind !== 'hero') return;
    let raf = 0;
    const tick = () => {
      setBeatsIn(showcaseBeat().beat);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [landed, card?.u.kind, showcaseBeat]);
  const hits = showcaseCombo(beatsIn);
  const tier = fighterTier(hits);

  const equip = () => {
    if (!card || leaving) return;
    // Put it in use, and move straight on (to the next unlock, or close on the last)
    onEquip(card.u);
    setLeaving(true);
    window.setTimeout(next, 320);
  };

  // Keys. Space / Enter: skip the reveal, then next (on the offer card: no thanks, so an ad never starts by
  // accident). Escape: close. Captured here so the results screen behind doesn't restart the song.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'Enter' || e.key === 'Escape' || e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (adBusy || e.repeat) return;
        if (e.key === 'Escape') onClose();
        else if (e.code === 'Space' || e.key === 'Enter') {
          if (!ready) skip();
          else if (card?.offer && !offerTaken) onClose();
          else next();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const info = card ? describeUnlock(card.u) : null;
  const layer = card?.u.kind === 'backdrop' ? backdropLayerOf(card.u.id) : null;
  // The carousel this unlock lands on
  const focus = useMemo(() => {
    if (!card) return 0;
    if (card.u.kind === 'hero') return Math.max(0, FIGHTERS.findIndex((h) => h.id === card.u.id));
    return Math.max(0, STANCE_ORDER.indexOf(card.u.id as EnemyMotionStyle));
  }, [card]);
  if (!card || !info) return null;
  const equipped = isEquipped(card.u);
  const isThis = (id: string) => id === card.u.id;

  return (
    <ArcadeScreen label={info.kind} stripes="none">
      {/* A tap or click anywhere while it's still revealing skips to the end, and does nothing else (so it can't equip by accident) */}
      {!ready && <div className="absolute inset-0 cursor-pointer" style={{ zIndex: 40 }} onPointerDown={skip} aria-label="Skip" role="button" />}

      {/* Title */}
      <div className="absolute flex items-baseline" style={{ left: u(5), top: u(4), gap: u(3) }}>
        <h2 className="arc-display arc-skew arc-split m-0 arc-in-left" style={{ fontSize: u(9) }}>
          {card.offer ? (offerTaken ? 'Unlocked!' : 'Bonus unlock') : 'Unlocked!'}
        </h2>
        {cards.length > 1 && (
          <span className="font-black tracking-[0.25em] text-[color:var(--muted)]" style={{ fontSize: small }}>
            {step + 1} / {cards.length}
          </span>
        )}
      </div>

      {/* The reveal */}
      {kind === 'carousel' ? (
        <>
          {/* Turning rays behind it once it's landed */}
          {landed && (
            <div
              aria-hidden="true"
              className="absolute unlock-rays pointer-events-none"
              style={{
                left: `calc(50% - ${u(40)})`,
                top: u(6),
                width: u(80),
                height: u(80),
                borderRadius: '50%',
                opacity: 0.35,
                background: `repeating-conic-gradient(${card.u.kind === 'hero' ? tier.color : getEnemyStyle(CAST[focus % CAST.length][0], CAST[focus % CAST.length][1]).color}88 0deg 10deg, transparent 10deg 30deg)`,
                maskImage: 'radial-gradient(circle, black 15%, transparent 68%)',
                WebkitMaskImage: 'radial-gradient(circle, black 15%, transparent 68%)',
              }}
            />
          )}
          <UnlockCarousel
            key={step}
            label={card.u.kind === 'hero' ? 'Fighters' : 'Stances'}
            count={ring}
            focus={focus}
            onMove={() => {}}
            spin={spin}
            still
            keyAt={(i) => (card.u.kind === 'hero' ? FIGHTERS[i].id : STANCE_ORDER[i])}
            nameAt={(i) => (card.u.kind === 'hero' ? FIGHTERS[i].label : STANCE_ORDER[i])}
            floorColor={landed ? (card.u.kind === 'hero' ? tier.color : getEnemyStyle(CAST[focus % CAST.length][0], CAST[focus % CAST.length][1]).color) : '#3a3f58'}
            render={(i, inFocus) => {
              if (card.u.kind === 'hero') {
                const h = FIGHTERS[i];
                // The unlock (even the ad offer's) is shown in full; the rest as they are for you
                const locked = !isThis(h.id) && !isHeroUnlocked(h.id, stats);
                return (
                  <HeroFigure
                    id={h.id}
                    locked={locked}
                    animate={inFocus && landed}
                    beatNow={inFocus && landed ? showcaseBeat : undefined}
                    comboAt={inFocus && landed ? showcaseCombo : undefined}
                    className="w-full h-full"
                    style={inFocus && landed ? { filter: `drop-shadow(0 0 ${u(1.4)} ${tier.color}66)` } : undefined}
                  />
                );
              }
              const id = STANCE_ORDER[i];
              const [b, t] = CAST[i % CAST.length];
              return <EnemyFigure stance={id} band={b} tier={t} beatNow={heardBeat} locked={!isThis(id) && !isStanceUnlocked(id, stats)} stomps={inFocus && landed} className="w-full h-full" />;
            }}
          />
          {/* The combo a new fighter builds */}
          {landed && card.u.kind === 'hero' && (
            <div className="absolute pointer-events-none arc-in-right" style={{ left: `calc(50% + ${u(19)})`, top: u(19) }} aria-hidden="true">
              <div className="flex items-baseline" style={{ gap: u(1) }}>
                <span key={hits} className="arc-display arc-split" style={{ fontSize: u(10), color: 'var(--yellow)', animation: 'arc-stamp 0.18s cubic-bezier(0.2, 0.9, 0.2, 1) both', ['--tilt' as string]: '0deg' }}>
                  {hits}
                </span>
                <span className="arc-display" style={{ fontSize: u(3.4) }}>
                  HITS
                </span>
              </div>
              <div key={tier.name} className="arc-display arc-stamp whitespace-nowrap" style={{ fontSize: u(3.6), color: tier.color, marginTop: u(0.6), ['--tilt' as string]: '-4deg', textShadow: `${u(0.3)} ${u(0.3)} 0 #000` }}>
                {tier.name}
              </div>
            </div>
          )}
          {landed && (
            <span key={`stamp${step}`} className="absolute arc-display arc-stamp pointer-events-none" style={{ right: `calc(50% + ${u(16)})`, top: u(20), fontSize: u(6.4), color: 'var(--yellow)', ['--tilt' as string]: '-7deg', textShadow: `${u(0.4)} ${u(0.4)} 0 #000`, whiteSpace: 'nowrap' }}>
              {card.offer && !offerTaken ? 'Bonus!' : stampText(card.u)}
            </span>
          )}
        </>
      ) : (
        // A backdrop piece: on a stage like the Backdrops tab's
        <div
          className="absolute overflow-hidden"
          style={{
            left: 0,
            right: 0,
            marginInline: 'auto',
            width: `min(100% - ${u(38)}, ${u(150)})`,
            top: u(17),
            height: u(40),
            clipPath: `polygon(${u(3.4)} 0, 100% 0, calc(100% - ${u(3.4)}) 100%, 0 100%)`,
            background: `linear-gradient(to top, var(--pink) ${u(0.9)}, #000 ${u(0.9)})`,
            paddingBottom: u(0.9),
          }}
        >
          <div className="absolute inset-0" style={{ bottom: u(0.9) }}>
            {layer && <BackdropReveal key={step} layer={layer} id={card.u.id} mix={backdrop} elapsed={elapsed} className="w-full h-full" />}
          </div>
          {landed && (
            <span key={`stamp${step}`} className="absolute arc-display arc-stamp pointer-events-none" style={{ left: u(6), top: u(3), fontSize: u(6), color: 'var(--yellow)', ['--tilt' as string]: '-7deg', textShadow: `${u(0.4)} ${u(0.4)} 0 #000` }}>
              {card.offer && !offerTaken ? 'Bonus!' : stampText(card.u)}
            </span>
          )}
        </div>
      )}

      {/* About it, and what to do */}
      <section className="absolute flex flex-col items-center text-center z-20" aria-live="polite" style={{ left: 0, right: 0, marginInline: 'auto', bottom: u(3.5), width: `min(100% - ${u(36)}, ${u(116)})`, gap: u(0.9) }}>
        {!landed ? (
          <div className="arc-display arc-blink" style={{ fontSize: u(6), color: 'var(--muted)', marginBottom: u(8) }}>
            Unlocking…
          </div>
        ) : (
          <>
            <h3 key={card.u.id} className="arc-display arc-skew arc-split m-0 whitespace-nowrap arc-in-right" style={{ fontSize: u(7.4) }}>
              {info.name}
            </h3>
            <div className="font-bold text-[color:var(--muted)] line-clamp-2 arc-in-left" style={{ fontSize: `max(11px, ${u(2.5)})`, lineHeight: 1.25 }}>
              {info.description}
            </div>
            <div className="font-bold" style={{ fontSize: small, color: card.offer && !offerTaken ? '#9aa3c4' : 'var(--yellow)' }}>
              {card.offer ? (offerTaken ? 'Unlocked and equipped. Enjoy!' : notice ?? earnText(card.u, stats)) : earnedText(card.u)}
            </div>
            <div className="flex arc-in-right" style={{ gap: u(1.6), marginTop: u(0.4), opacity: ready ? 1 : 0.35, transition: 'opacity 0.25s' }}>
              {!card.offer ? (
                <>
                  {equipped ? (
                    <SlantButton variant="selected" size="sm" aria-disabled="true" style={{ padding: `0 ${u(6)}`, cursor: 'default' }}>
                      ✓ Equipped
                    </SlantButton>
                  ) : (
                    <SlantButton variant="hot" size="sm" hotkey="ENTER" onClick={equip} style={{ padding: `0 ${u(7)}`, fontSize: u(4.2) }}>
                      Equip
                    </SlantButton>
                  )}
                  <SlantButton size="sm" onClick={next} style={{ padding: `0 ${u(6)}` }}>
                    {last ? 'Done' : 'Next ›'}
                  </SlantButton>
                </>
              ) : offerTaken ? (
                <SlantButton variant="hot" size="sm" onClick={onClose} style={{ padding: `0 ${u(8)}`, fontSize: u(4.2) }}>
                  Done
                </SlantButton>
              ) : (
                <>
                  <button type="button" className="arc-btn is-offer is-sm" onClick={onWatchOffer} disabled={adBusy} style={{ padding: `0 ${u(5)}` }}>
                    <span className="arc-play" aria-hidden="true">
                      ▶
                    </span>
                    <span className="arc-offer-text">
                      <span>{adBusy ? 'Loading ad…' : 'Unlock now'}</span>
                      <span className="arc-offer-sub">{adBusy ? 'One moment' : 'Watch an ad · equipped at once'}</span>
                    </span>
                  </button>
                  <SlantButton size="sm" onClick={onClose} disabled={adBusy} style={{ padding: `0 ${u(6)}` }}>
                    No thanks
                  </SlantButton>
                </>
              )}
            </div>
          </>
        )}
      </section>
    </ArcadeScreen>
  );
};
