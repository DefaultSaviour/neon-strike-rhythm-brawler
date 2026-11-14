import { getMoveForCombo } from '../../game/animations';
import { STILL_DRIFT } from '../../game/combo';
import type { HeroDefinition } from '../../game/heroes';
import type { AttackMove, SkeletonPose } from '../../types/game';
import type { BeatNote, EnemyTier, FrequencyBand } from '../../types/game';
import { resolveBandTier } from '../../game/enemyStyles';
import { SPAWN_DISTANCE } from '../../game/layout';

/**
 * The title screen's fight: the title song's real chart, every enemy the
 * game would send, but all of them floating in from the right. Each comes in
 * at the game's own speed and reaches the fighter exactly on its note, is hit,
 * then breaks into pieces like in the game (TitleFight does the pieces).
 * Where an enemy is comes from the song time alone (no state kept frame to
 * frame), so it can't drift from the music.
 *
 * World units are the game's (feet at y = 68, a fighter about 150 tall).
 * The fighter stands at x = 0, facing right.
 */

/** Where an enemy is when it gets hit (the game's strike distance) */
export const TITLE_HIT_X = 78;
/** How long a hit enemy stays "hit" (s): its burst shows this long */
export const HIT_FLASH_SEC = 0.11;

/**
 * How fast enemies come in (world units per second): the game's speed, where
 * they cross from the spawn point to the strike line in one bar (4 beats,
 * kept between 1.1 and 2.2 seconds).
 */
export function approachSpeed(period: number): number {
  const approach = Math.max(1.1, Math.min(2.2, period * 4));
  return (SPAWN_DISTANCE - TITLE_HIT_X) / approach;
}

export interface TitleEnemyLook {
  band: FrequencyBand;
  tier: EnemyTier;
}

/** What an enemy looks like: from its note, the same way the game picks. */
export function titleEnemyLook(note: BeatNote): TitleEnemyLook {
  return resolveBandTier(note);
}

export interface TitleEnemyState {
  /** Coming in, or just hit (then it breaks apart) */
  phase: 'coming' | 'hit';
  x: number;
  /** Up is negative, like the canvas */
  y: number;
  /** Seconds until its note (negative once hit), for the wind-up lean */
  timeLeft: number;
}

/**
 * Where the enemy for a note at `noteTime` is when the song is at
 * `songTime`, coming in at `speed`. `seed` varies its float. Null once it's
 * been hit and broken up.
 */
export function titleEnemyAt(noteTime: number, songTime: number, speed: number, seed = 0): TitleEnemyState | null {
  const timeLeft = noteTime - songTime;
  if (timeLeft > 0) {
    // Floating in, a little up and down so it isn't stiff
    const y = Math.sin(songTime * 3 + seed * 1.7) * 3;
    return { phase: 'coming', x: TITLE_HIT_X + timeLeft * speed, y, timeLeft };
  }
  if (-timeLeft < HIT_FLASH_SEC) return { phase: 'hit', x: TITLE_HIT_X, y: 0, timeLeft };
  return null;
}

/** The first note at or after `time` (notes sorted by time). */
export function firstNoteFrom(notes: ReadonlyArray<{ time: number }>, time: number): number {
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid].time < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Which notes' enemies could be on screen at `songTime` (as an index range,
 * end not included): the ones just hit, and the ones on the way in, out to
 * `rightEdge` (world units).
 */
export function titleEnemyRange(notes: ReadonlyArray<{ time: number }>, songTime: number, speed: number, rightEdge: number): [number, number] {
  const from = firstNoteFrom(notes, songTime - HIT_FLASH_SEC);
  const to = firstNoteFrom(notes, songTime + (rightEdge + 40 - TITLE_HIT_X) / speed);
  return [from, to];
}

/**
 * How many hits the title screen's fighter takes to go through all five
 * tiers before starting again from the first: 6 hits of tier 1, 10 of
 * tier 2, 14 of tier 3, then 20 each of tier 4 and the top form.
 */
export const TITLE_COMBO_LOOP = 70;

/**
 * The combo the title screen shows after this many hits in a row. In a song
 * the combo only climbs, so the fighter would reach the top form in seconds
 * and stay there; here it goes round, so every tier (and its tier 4 twist)
 * gets its turn on show.
 */
export function titleCombo(hitsInRun: number): number {
  return Math.max(0, hitsInRun) % TITLE_COMBO_LOOP;
}

/**
 * The move the title screen's fighter throws on a note, played the way the
 * game plays it: the move for the combo's tier (so the tier 4 twist and the
 * finishers show up as the run builds), the pose they wait in between
 * attacks in that tier, how long they hold the last pose, and how far
 * a hero who never turns drifts toward the enemy.
 */
export function titleStrike(hero: HeroDefinition, combo: number, noteIndex: number, periodSec: number): TitleStrike {
  const move = getMoveForCombo(combo, noteIndex, hero.moves);
  return {
    move,
    rest: move.restPose ?? hero.idlePose,
    // About two beats, as in the game
    holdSec: hero.holdsPose ? Math.min(1.4, Math.max(0.6, periodSec * 2)) : 0,
    still: !!move.still,
    lunge: move.still ? STILL_DRIFT : 0,
  };
}

export interface TitleStrike {
  move: AttackMove;
  rest: SkeletonPose;
  holdSec: number;
  still: boolean;
  lunge: number;
}
