import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ENEMY_MOTION_STYLES, EnemyMotionStyle } from '../game/enemyMotion';
import type { LifetimeStats } from '../game/heroUnlocks';
import { getEnemyStyle } from '../game/enemyStyles';
import type { EnemyTier, FrequencyBand } from '../types/game';
import { FREE_STANCES, formatCountdown, nextStance, secondsToNextStance, SECONDS_PER_STANCE, STANCE_UNLOCK_ORDER } from '../game/stanceUnlocks';
import { ArcadeScreen, SlantButton } from './arcade/ui';
import { EnemyFigure } from './arcade/EnemyFigure';
import { wrapIndex } from './arcade/fighterCarousel';
import { GoalBar, heardBeat, InfoName, InfoTags, u, UnlockCarousel, UnlockFooter, UnlockHeader, UnlockInfo, useCarouselKeys, useSeenAfterLook } from './arcade/UnlockCarousel';

/**
 * The Stances tab of Unlocks (how the enemies move), arcade style, like the
 * Fighters tab: every stance in a carousel, each shown by a different enemy
 * from the cast, all moving to the music. The one in focus is big, with a
 * ring thumping on the floor as its feet land. Two are free; the rest open
 * one every 20 minutes of play (the next shows its countdown), or straight
 * away with the pink ad offer in the header. Locked ones are black
 * silhouettes.
 *
 * Keys: Left / Right move, Enter or Space picks, Escape goes back.
 */

interface StancesScreenProps {
  stats: LifetimeStats;
  selected: EnemyMotionStyle;
  isUnlocked: (id: EnemyMotionStyle) => boolean;
  onSelect: (id: EnemyMotionStyle) => void;
  /** Watch an ad to unlock the next stance now; present only when an ad can be shown here */
  onWatchAd?: () => void;
  adBusy?: boolean;
  /** Why ads can't be offered here, shown in place of the ad button */
  adsOffNote?: string | null;
  /** A message after watching an ad (unlocked, or why not) */
  notice?: string | null;
  /** Open but not yet looked at: these wear a NEW tag */
  isNew?: (id: EnemyMotionStyle) => boolean;
  /** The player has looked at this stance */
  onSeen?: (id: EnemyMotionStyle) => void;
  /** The Fighters / Stances / Backdrops tab bar, shown top right */
  tabs?: React.ReactNode;
  onClose: () => void;
}

const ORDER: EnemyMotionStyle[] = [...FREE_STANCES, ...STANCE_UNLOCK_ORDER];
const STANCES = ORDER.map((id) => ENEMY_MOTION_STYLES.find((m) => m.id === id)!);

/** A different enemy for each stance, so the carousel shows off the whole cast. */
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

export const StancesScreen: React.FC<StancesScreenProps> = ({ stats, selected, isUnlocked, onSelect, onWatchAd, adBusy, adsOffNote, notice, isNew, onSeen, tabs, onClose }) => {
  const count = STANCES.length;
  const earned = STANCES.filter((m) => isUnlocked(m.id)).length;
  const next = nextStance(stats);
  const wait = secondsToNextStance(stats);

  // Open on a new stance you haven't looked at yet, if there is one, or else on the one in use
  const [focus, setFocus] = useState(() => {
    const fresh = STANCES.findIndex((m) => isUnlocked(m.id) && isNew?.(m.id));
    return fresh >= 0 ? fresh : Math.max(0, ORDER.indexOf(selected));
  });
  const move = useCallback((step: number) => setFocus((f) => wrapIndex(f, step, count)), [count]);
  // A new stance in use (picked, or just unlocked with an ad and equipped): bring it into focus
  const firstSelected = useRef(true);
  useEffect(() => {
    if (firstSelected.current) {
      firstSelected.current = false;
      return;
    }
    const i = ORDER.indexOf(selected);
    if (i >= 0) setFocus(i);
  }, [selected]);

  const stance = STANCES[focus];
  const unlocked = isUnlocked(stance.id);
  const chosen = stance.id === selected;
  const fresh = unlocked && !!isNew?.(stance.id);
  useSeenAfterLook(stance.id, fresh, onSeen);
  useCarouselKeys(move, unlocked && !chosen ? () => onSelect(stance.id) : null, onClose);

  const [band, tier] = CAST[focus % CAST.length];
  const nextLabel = next ? ENEMY_MOTION_STYLES.find((m) => m.id === next)?.label ?? next : null;
  // A locked stance that isn't next opens after the one before it in the queue
  const before = ORDER[ORDER.indexOf(stance.id) - 1];
  const beforeLabel = ENEMY_MOTION_STYLES.find((m) => m.id === before)?.label;

  return (
    <ArcadeScreen label="Stances" stripes="flat">
      <UnlockHeader
        title="Stances"
        onClose={onClose}
        offer={onWatchAd && nextLabel ? { name: nextLabel, busy: !!adBusy, done: false, onWatch: onWatchAd } : undefined}
        offerNote={next ? adsOffNote : null}
        tabs={tabs}
      />

      <UnlockCarousel
        label="Stances"
        count={count}
        focus={focus}
        onMove={move}
        keyAt={(i) => STANCES[i].id}
        nameAt={(i) => STANCES[i].label}
        isNewAt={(i) => isUnlocked(STANCES[i].id) && !!isNew?.(STANCES[i].id)}
        floorColor={unlocked ? getEnemyStyle(band, tier).color : '#3a3f58'}
        render={(i, inFocus) => {
          const [b, t] = CAST[i % CAST.length];
          return <EnemyFigure stance={STANCES[i].id} band={b} tier={t} beatNow={heardBeat} locked={!isUnlocked(STANCES[i].id)} stomps={inFocus} className="w-full h-full" />;
        }}
      />

      {/* About the stance in focus */}
      <UnlockInfo>
        <InfoTags index={focus} count={count} fresh={fresh} locked={!unlocked} notice={notice} />
        <InfoName name={stance.label} locked={!unlocked} />
        <div className="font-bold text-[color:var(--muted)] line-clamp-2" style={{ fontSize: `max(11px, ${u(2.6)})`, lineHeight: 1.25 }}>
          {stance.description}
        </div>
        {unlocked ? (
          chosen ? (
            <SlantButton variant="selected" size="sm" aria-disabled="true" style={{ padding: `0 ${u(6)}`, cursor: 'default', marginTop: u(0.6) }}>
              ✓ In use
            </SlantButton>
          ) : (
            <SlantButton variant="hot" size="sm" hotkey="ENTER" onClick={() => onSelect(stance.id)} style={{ padding: `0 ${u(8)}`, fontSize: u(4.2), marginTop: u(0.6) }}>
              Pick
            </SlantButton>
          )
        ) : stance.id === next && wait !== null ? (
          <>
            <div className="font-bold text-[color:var(--yellow)]" style={{ fontSize: `max(11px, ${u(2.6)})` }}>
              Opens in {formatCountdown(wait)} of play
            </div>
            <GoalBar fraction={1 - wait / SECONDS_PER_STANCE} text={`${formatCountdown(SECONDS_PER_STANCE - wait)} / ${formatCountdown(SECONDS_PER_STANCE)}`} />
          </>
        ) : (
          <div className="font-bold text-[color:var(--yellow)]" style={{ fontSize: `max(11px, ${u(2.6)})` }}>
            {beforeLabel ? `Opens after ${beforeLabel}` : 'Keep playing to unlock'}
          </div>
        )}
      </UnlockInfo>

      <UnlockFooter earned={earned} count={count} />
    </ArcadeScreen>
  );
};
