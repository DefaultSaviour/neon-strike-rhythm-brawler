/**
 * The end-of-song boss (prototype).
 *
 * Over the last stretch of a song a big boss stands on one side and throws
 * punches (energy fists) on the beat. Hitting a fist on time damages the boss:
 * PERFECTs hurt most. Every few bars it leaps over the player to the other side.
 * It fights alone: once it arrives, every beat is a fist from its side.
 *
 * Letting a fist through is the same as letting any enemy through, so surviving
 * isn't enough to win: the KO needs good timing.
 */
import { Lane, TimingJudgementType } from '../types/game';

/** How long the boss section lasts, counted back from the last note (seconds). */
export const BOSS_SECONDS = 24;
/** Beats the boss stays on one side before leaping over. */
export const SWITCH_BEATS = 8;
/** Damage a fist does to the boss when hit, by timing. */
export const BOSS_DAMAGE: Record<TimingJudgementType, number> = { PERFECT: 3, GOOD: 2, OK: 1, MISS: 0 };
/** Boss health per fist it throws: all GOODs fall short, so the KO needs some PERFECTs. */
export const HP_PER_ATTACK = 2.2;
/** Fists land at least this many beats apart (so no frantic runs on one key). */
export const MIN_GAP_BEATS = 0.5;
/** Songs shorter than this (or with fewer notes) get no boss. */
const MIN_SONG_SEC = 60;
const MIN_NOTES = 40;

export interface BossPlan {
  /** Hit time of the first fist (song seconds) */
  start: number;
  /** Hit time of the last note */
  end: number;
  /** Seconds the boss stays on one side */
  switchSec: number;
  firstSide: Lane;
  maxHp: number;
  /** Per note: the lane it comes from (notes in the boss section are moved) */
  lanes: Lane[];
  /** Per note: true when the boss throws it */
  attack: boolean[];
  /** Per note: false when the boss section drops it (too close to the fist before) */
  keep: boolean[];
}

/** Which side the boss's fists land on at song time `time`. */
export function bossSideAt(plan: Pick<BossPlan, 'start' | 'switchSec' | 'firstSide'>, time: number): Lane {
  const segment = Math.max(0, Math.floor((time - plan.start) / plan.switchSec));
  const other: Lane = plan.firstSide === 'left' ? 'right' : 'left';
  return segment % 2 === 0 ? plan.firstSide : other;
}

/** Plan the boss section for a chart, or null when the song is too short for one. */
export function planBoss(notes: { time: number; lane: Lane }[], bpm: number): BossPlan | null {
  if (notes.length < MIN_NOTES) return null;
  const end = notes[notes.length - 1].time;
  if (end - notes[0].time < MIN_SONG_SEC) return null;

  const firstIndex = notes.findIndex((n) => n.time >= end - BOSS_SECONDS);
  const plan: BossPlan = {
    start: notes[firstIndex].time,
    end,
    switchSec: (SWITCH_BEATS * 60) / bpm,
    firstSide: 'right',
    maxHp: 0,
    lanes: notes.map((n) => n.lane),
    attack: notes.map(() => false),
    keep: notes.map(() => true),
  };

  // Every note becomes a fist from the boss's side, except ones too close to the fist before.
  const minGap = (MIN_GAP_BEATS * 60) / bpm - 0.01;
  let lastFist = -Infinity;
  for (let i = firstIndex; i < notes.length; i++) {
    const { time } = notes[i];
    if (time - lastFist < minGap) {
      plan.keep[i] = false;
      continue;
    }
    plan.lanes[i] = bossSideAt(plan, time);
    plan.attack[i] = true;
    lastFist = time;
  }

  const attacks = plan.attack.filter(Boolean).length;
  plan.maxHp = Math.round(attacks * HP_PER_ATTACK);
  return plan;
}

/** How big the boss is drawn, next to a normal enemy. */
export const BOSS_SCALE = 1.7;
/** World x where the boss stands (it throws its fists from here). */
export const BOSS_STAND_X = 235;
/** How long the leap over the player takes (seconds). */
export const LEAP_SEC = 0.55;
/** How long the boss takes to crash down when it arrives (seconds). */
export const ENTRANCE_SEC = 1.2;

/**
 * Where the boss is at song time `time`. Its side follows the fists it is
 * throwing now (they land `approach` seconds later). Between sides it leaps in
 * an arc over the middle. `visible` is false before it arrives.
 */
export function bossStage(plan: BossPlan, time: number, approach: number): { x: number; lift: number; side: Lane; visible: boolean } {
  const throwing = time + approach;
  const side = bossSideAt(plan, throwing);
  const sign = side === 'left' ? -1 : 1;

  const arrive = plan.start - approach;
  if (time < arrive - ENTRANCE_SEC) return { x: sign * BOSS_STAND_X, lift: 0, side, visible: false };
  if (time < arrive) {
    // Crashes down from above
    const u = (time - (arrive - ENTRANCE_SEC)) / ENTRANCE_SEC;
    return { x: sign * BOSS_STAND_X, lift: 320 * (1 - u) * (1 - u), side, visible: true };
  }

  // Leap to the other side in the last LEAP_SEC before the next segment, while
  // there are still fists to throw.
  const intoSegment = (throwing - plan.start) % plan.switchSec;
  const nextSegmentAt = throwing - intoSegment + plan.switchSec;
  const leapStart = plan.switchSec - LEAP_SEC;
  if (intoSegment > leapStart && nextSegmentAt <= plan.end) {
    const u = (intoSegment - leapStart) / LEAP_SEC;
    const ease = u * u * (3 - 2 * u);
    return { x: sign * BOSS_STAND_X * (1 - 2 * ease), lift: Math.sin(u * Math.PI) * 150, side, visible: true };
  }
  return { x: sign * BOSS_STAND_X, lift: 0, side, visible: true };
}
