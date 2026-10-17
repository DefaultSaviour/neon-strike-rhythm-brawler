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
