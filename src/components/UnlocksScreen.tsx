import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HeroId, HEROES } from '../game/heroes';
import { LifetimeStats, progressText, UNLOCK_ORDER, unlockProgress } from '../game/heroUnlocks';
import { fighterTier } from '../game/fighterTier';
import { AdOffer, ArcadeScreen, FitText, HeroFigure, SlantButton } from './arcade/ui';
import { ShowcaseCounter, showcaseCombo, wrapIndex } from './arcade/fighterCarousel';
import { GoalBar, heardBeat, InfoName, InfoTags, u, UnlockCarousel, UnlockFooter, UnlockHeader, UnlockInfo, useCarouselKeys, useSeenAfterLook } from './arcade/UnlockCarousel';

/**
 * The Fighters tab of Unlocks, arcade style: every fighter in a carousel, in
 * the order they're earned (it wraps round). The one in focus stands big in
 * the middle and fights to the music, building a combo: the hit count climbs
 * and they level up through the glow tiers to their top form, then start
 * again. Locked fighters are black silhouettes, with their goal and progress.
 * The pink offer (what an ad would unlock now) sits in the header between
 * the title and the tabs, so it's always there.
 *
 * Swipe, tap a fighter at the side, or use the ‹ › buttons to move.
 * Keys: Left / Right move, Enter or Space picks, Escape goes back.
 */

interface UnlocksScreenProps {
  stats: LifetimeStats;
  /** The fighter you'll play as */
  selectedHero: HeroId;
  isUnlocked: (id: HeroId) => boolean;
  onSelect: (id: HeroId) => void;
  /** What a rewarded ad would unlock now (only when ads can play) */
  adOffer?: AdOffer;
  /** A message after watching an ad (unlocked, or why not) */
  notice?: string | null;
  /** Open but not yet looked at: these wear a NEW tag */
  isNew?: (id: HeroId) => boolean;
  /** The player has looked at this fighter */
  onSeen?: (id: HeroId) => void;
  /** The Fighters / Stances / Backdrops tab bar, shown top right */
  tabs?: React.ReactNode;
  onClose: () => void;
}

export const UnlocksScreen: React.FC<UnlocksScreenProps> = ({ stats, selectedHero, isUnlocked, onSelect, adOffer, notice, isNew, onSeen, tabs, onClose }) => {
  const fighters = useMemo(() => [...HEROES].sort((a, b) => UNLOCK_ORDER.indexOf(a.id) - UNLOCK_ORDER.indexOf(b.id)), []);
  const count = fighters.length;
  const earned = fighters.filter((h) => isUnlocked(h.id)).length;

  // Open on a new fighter you haven't looked at yet, if there is one, or else on yours
  const [focus, setFocus] = useState(() => {
    const fresh = fighters.findIndex((h) => isUnlocked(h.id) && isNew?.(h.id));
    return fresh >= 0 ? fresh : Math.max(0, fighters.findIndex((h) => h.id === selectedHero));
  });
  const move = useCallback((step: number) => setFocus((f) => wrapIndex(f, step, count)), [count]);
  // A new fighter of yours (picked, or just unlocked with the ad offer and equipped): bring them into focus
  const firstSelected = useRef(true);
  useEffect(() => {
    if (firstSelected.current) {
      firstSelected.current = false;
      return;
    }
    const i = fighters.findIndex((h) => h.id === selectedHero);
    if (i >= 0) setFocus(i);
  }, [selectedHero, fighters]);

  const hero = fighters[focus];
  const unlocked = isUnlocked(hero.id);
  const chosen = hero.id === selectedHero;
  const progress = unlockProgress(hero.id, stats);
  const fresh = unlocked && !!isNew?.(hero.id);
  useSeenAfterLook(hero.id, fresh, onSeen);
  useCarouselKeys(move, unlocked && !chosen ? () => onSelect(hero.id) : null, onClose);

  // The showcase: beats since this fighter came into focus, shared by the drawing and the hit counter
  const counter = useRef(new ShowcaseCounter());
  const focusKey = useRef(hero.id);
  focusKey.current = hero.id;
  const showcaseBeat = useCallback(() => {
    const b = heardBeat();
    return { ...b, beat: counter.current.beatsIn(focusKey.current, b.beat) };
  }, []);
  const [beatsIn, setBeatsIn] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setBeatsIn(showcaseBeat().beat);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [showcaseBeat]);
  const hits = showcaseCombo(beatsIn);
  const tier = fighterTier(hits);

  return (
    <ArcadeScreen label="Fighters" stripes="flat">
      <UnlockHeader title="Fighters" onClose={onClose} offer={adOffer} tabs={tabs} />

      <UnlockCarousel
        label="Fighters"
        count={count}
        focus={focus}
        onMove={move}
        keyAt={(i) => fighters[i].id}
        nameAt={(i) => fighters[i].label}
        isNewAt={(i) => isUnlocked(fighters[i].id) && !!isNew?.(fighters[i].id)}
        floorColor={unlocked ? tier.color : '#3a3f58'}
        render={(i, inFocus) => {
          const h = fighters[i];
          const locked = !isUnlocked(h.id);
          return (
            <HeroFigure
              id={h.id}
              locked={locked}
              animate={!locked}
              beatNow={inFocus ? showcaseBeat : undefined}
              // Locked fighters show their moves, but they don't level up
              comboAt={inFocus ? (locked ? () => 0 : showcaseCombo) : undefined}
              className="w-full h-full"
              style={inFocus && !locked ? { filter: `drop-shadow(0 0 ${u(1.4)} ${tier.color}66)` } : undefined}
            />
          );
        }}
      />

      {/* The combo the fighter in focus is building */}
      {unlocked && (
        <div className="absolute pointer-events-none arc-in-right" style={{ left: `calc(50% + ${u(19)})`, top: u(19), animationDelay: '0.2s' }} aria-hidden="true">
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

      {/* About the fighter in focus */}
      <UnlockInfo>
        <InfoTags index={focus} count={count} fresh={fresh} locked={!unlocked} notice={notice} />
        <InfoName name={hero.label} locked={!unlocked} />
        {unlocked ? (
          <>
            <FitText className="font-bold italic text-[color:var(--muted)]" style={{ fontSize: `max(11px, ${u(2.6)})` }} title={hero.description}>
              {hero.tagline}
            </FitText>
            {chosen ? (
              <SlantButton variant="selected" size="sm" aria-disabled="true" style={{ padding: `0 ${u(6)}`, cursor: 'default', marginTop: u(0.6) }}>
                ✓ Your fighter
              </SlantButton>
            ) : (
              <SlantButton variant="hot" size="sm" hotkey="ENTER" onClick={() => onSelect(hero.id)} style={{ padding: `0 ${u(8)}`, fontSize: u(4.2), marginTop: u(0.6) }}>
                Pick
              </SlantButton>
            )}
          </>
        ) : (
          progress && (
            <>
              <div className="font-bold text-[color:var(--yellow)]" style={{ fontSize: `max(11px, ${u(2.6)})` }}>
                {progress.goal.label}
              </div>
              <GoalBar fraction={progress.current / progress.goal.target} text={progressText(progress.goal, progress.current)} />
            </>
          )
        )}
      </UnlockInfo>

      <UnlockFooter earned={earned} count={count} />
    </ArcadeScreen>
  );
};
