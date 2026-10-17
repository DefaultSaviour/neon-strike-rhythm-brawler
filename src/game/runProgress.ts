/**
 * How far through a song a run got, and the best attempt per song.
 *
 * Used by the results screen's progress bar: your fighter runs along a line
 * the length of the song and stops where you died (or reaches the flag if you
 * cleared it), next to a marker for your best attempt so far.
 */

export interface RunProgress {
  /** 0..1 share of the song reached */
  fraction: number;
  /** Song time reached (s) */
  reachedSec: number;
  /** Song length (s) */
  durationSec: number;
  cleared: boolean;
  /** Best fraction before this run (null on a first attempt) */
  previousBest: number | null;
  /** True when this run went further than any earlier attempt */
  isNewBest: boolean;
}

/** Minimal storage interface (localStorage fits), so tests can pass a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = 'neon_strike_best_progress_v1';

/** Share of the song reached, clamped to 0..1. Clearing always counts as 1. */
export function progressFraction(reachedSec: number, durationSec: number, cleared: boolean): number {
  if (cleared) return 1;
  if (!(durationSec > 0)) return 0;
  return Math.min(1, Math.max(0, reachedSec / durationSec));
}

function readAll(store: KeyValueStore | undefined): Record<string, number> {
  if (!store) return {};
  try {
    const parsed = JSON.parse(store.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function loadBestProgress(trackId: string, store: KeyValueStore | undefined): number | null {
  const v = readAll(store)[trackId];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Record a finished run and report how it compares with the best attempt.
 * Only saves when the run beat the previous best.
 */
export function recordRunProgress(
  trackId: string,
  reachedSec: number,
  durationSec: number,
  cleared: boolean,
  store: KeyValueStore | undefined
): RunProgress {
  const fraction = progressFraction(reachedSec, durationSec, cleared);
  const previousBest = loadBestProgress(trackId, store);
  const isNewBest = previousBest === null || fraction > previousBest + 1e-6;
  if (isNewBest && store) {
    try {
      const all = readAll(store);
      all[trackId] = fraction;
      store.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // Storage can be full or blocked (private browsing); the bar still works for this run.
    }
  }
  return {
    fraction,
    reachedSec: cleared ? durationSec : Math.min(reachedSec, durationSec),
    durationSec,
    cleared,
    previousBest,
    isNewBest,
  };
}

/** m:ss */
export function formatSongTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Duration of the runner's dash along the bar (seconds). Longer runs take a little longer. */
export function dashDuration(fraction: number): number {
  return 0.6 + 1.0 * Math.min(1, Math.max(0, fraction));
}

/**
 * Where the runner is (0..1 along the bar) `elapsed` seconds into the dash.
 * Fast start, slowing as it nears the end point, so the stop lands with weight.
 */
export function runnerPositionAt(elapsed: number, target: number): number {
  const d = dashDuration(target);
  const t = Math.min(1, Math.max(0, elapsed / d));
  const eased = 1 - Math.pow(1 - t, 3);
  return target * eased;
}

/**
 * The bar is split (behind the scenes) into 4 quarters. The runner levels up
 * through the fighter's combo tiers as he crosses each one, reaching god tier
 * (angel wings) for the final 25%. Values are combos to feed fighterTier().
 */
export const QUARTER_TIER_COMBOS = [0, 16, 30, 50] as const; // basic, cyber ninja, overdrive, god tier

/** Combo-equivalent tier for a runner at `position` (0..1) along the bar. */
export function runnerTierCombo(position: number): number {
  const quarter = Math.min(3, Math.max(0, Math.floor(position * 4 + 1e-9)));
  return QUARTER_TIER_COMBOS[quarter];
}

/**
 * When (seconds into the dash) the runner crosses each quarter line on his way
 * to `target`, so a level-up flash can play right as he passes it.
 */
export function levelUpTimes(target: number): Array<{ position: number; elapsed: number; combo: number }> {
  const d = dashDuration(target);
  const out: Array<{ position: number; elapsed: number; combo: number }> = [];
  for (const q of [0.25, 0.5, 0.75]) {
    if (q > target + 1e-9) break;
    // Invert runnerPositionAt: position = target * (1 - (1 - t)^3)
    const t = 1 - Math.cbrt(Math.max(0, 1 - q / target));
    out.push({ position: q, elapsed: t * d, combo: runnerTierCombo(q) });
  }
  return out;
}
