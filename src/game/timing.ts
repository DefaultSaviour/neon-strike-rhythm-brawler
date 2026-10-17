import { Lane, TimingJudgementType } from '../types/game';

/**
 * Hit windows in seconds. A press this close to an enemy's beat (early OR late)
 * earns the judgement. Anything further away than OK is a MISS.
 */
export const HIT_WINDOWS = {
  PERFECT: 0.055,
  GOOD: 0.105,
  OK: 0.16,
} as const;

/**
 * How late (in seconds) an enemy can be before it breaches the strike line.
 * This matches the OK window, so every press the judge would accept is still
 * possible: you can never be killed by an enemy you were allowed to hit.
 */
export const BREACH_LATE_SEC = HIT_WINDOWS.OK;

/** Turn a timing error (press time minus beat time, in seconds) into a judgement. */
export function judgeOffset(offsetSec: number): TimingJudgementType {
  const d = Math.abs(offsetSec);
  if (d <= HIT_WINDOWS.PERFECT) return 'PERFECT';
  if (d <= HIT_WINDOWS.GOOD) return 'GOOD';
  if (d <= HIT_WINDOWS.OK) return 'OK';
  return 'MISS';
}

interface Targetable {
  targetTime: number;
  defeated: boolean;
  lane: Lane;
}

/**
 * Pick which enemy a press at `time` should hit.
 *
 * Rule (standard for rhythm games): of all enemies inside the hit window, take
 * the one whose beat comes FIRST. Picking "the closest" instead lets a slightly
 * late enemy get skipped over and then kill you a moment later.
 *
 * Pass `lane = null` to search both lanes (one-button mode).
 */
export function pickTarget<T extends Targetable>(
  enemies: readonly T[],
  time: number,
  lane: Lane | null
): T | null {
  let best: T | null = null;
  for (const e of enemies) {
    if (e.defeated) continue;
    if (lane !== null && e.lane !== lane) continue;
    if (Math.abs(e.targetTime - time) > HIT_WINDOWS.OK) continue;
    if (!best || e.targetTime < best.targetTime) best = e;
  }
  return best;
}

/**
 * Suggest a new latency offset (ms) from the player's recorded timing errors.
 *
 * `offsetsSec` are press-minus-beat errors from successful hits. If a player
 * is consistently 30ms late, the game should treat audio as 30ms later, so we
 * ADD the median error to the current offset. The median ignores the odd wild
 * press. Returns null when there isn't enough data to be trustworthy.
 */
export function suggestLatencyOffsetMs(
  currentOffsetMs: number,
  offsetsSec: readonly number[],
  minSamples = 12
): number | null {
  if (offsetsSec.length < minSamples) return null;
  const sorted = [...offsetsSec].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const suggested = currentOffsetMs + median * 1000;
  // Round to 5ms steps (the settings slider granularity) and keep within slider range.
  const rounded = Math.round(suggested / 5) * 5;
  return Math.max(-300, Math.min(300, rounded));
}

/** One button press the player made (song time), and what it did. */
export interface PressRecord {
  time: number;
  /** Lane pressed (one-button mode: the lane it struck toward) */
  lane: Lane;
  /** Name of the enemy it hit, or undefined if it was a MISS */
  hitEnemyName?: string;
}

export interface DeathReport {
  enemyName: string;
  lane: Lane;
  /** One plain-English sentence on what went wrong */
  reason: string;
}

/** How far before/after an enemy's beat we look for the press meant for it. */
const DEATH_LOOKBACK = 0.6;

const sideName = (lane: Lane) => lane.toUpperCase();
const ms = (sec: number) => `${Math.round(Math.abs(sec) * 1000)} ms`;

/**
 * Explain why an enemy got through, from the player's recent presses.
 * Checks, in order: a press on the right side that was too early/late, a
 * press on the right side that hit a different enemy first, a press on the
 * wrong side, and finally no press at all.
 */
export function explainDeath(
  enemy: { name: string; lane: Lane; targetTime: number },
  presses: readonly PressRecord[],
  oneButtonMode = false
): DeathReport {
  const near = presses.filter(
    (p) => p.time >= enemy.targetTime - DEATH_LOOKBACK && p.time <= enemy.targetTime + BREACH_LATE_SEC
  );
  const closest = (list: PressRecord[]) =>
    list.reduce<PressRecord | null>(
      (best, p) => (!best || Math.abs(p.time - enemy.targetTime) < Math.abs(best.time - enemy.targetTime) ? p : best),
      null
    );
  const base = { enemyName: enemy.name, lane: enemy.lane };

  const sameSide = near.filter((p) => oneButtonMode || p.lane === enemy.lane);
  const missed = closest(sameSide.filter((p) => !p.hitEnemyName));
  if (missed) {
    const off = missed.time - enemy.targetTime;
    return { ...base, reason: `You pressed ${ms(off)} too ${off < 0 ? 'early' : 'late'}.` };
  }

  const usedOnOther = closest(sameSide.filter((p) => p.hitEnemyName));
  if (usedOnOther) {
    return { ...base, reason: `Your press hit the ${usedOnOther.hitEnemyName} just ahead of it, so this one got through.` };
  }

  const wrongSide = closest(near.filter((p) => p.lane !== enemy.lane && !p.hitEnemyName));
  if (wrongSide) {
    const off = wrongSide.time - enemy.targetTime;
    const when = Math.abs(off) < 0.005 ? 'right on time' : `${ms(off)} ${off < 0 ? 'before' : 'after'} it arrived`;
    return { ...base, reason: `You pressed ${sideName(wrongSide.lane)} ${when}. Wrong side.` };
  }

  return { ...base, reason: "You didn't press for it." };
}
