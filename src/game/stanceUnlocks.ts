import { EnemyMotionStyle } from './enemyMotion';
import type { LifetimeStats } from './heroUnlocks';

/**
 * Enemy stances (how the enemies move) unlock with time: every 20 minutes
 * spent playing songs opens the next one, or the player can watch a
 * rewarded ad to open it straight away. Menus don't count, only songs.
 *
 * Two stances are always free: the default run, and "Just stand", the
 * calmest and easiest to read the beat from.
 */

/** Minutes of play per stance. */
export const MINUTES_PER_STANCE = 20;
export const SECONDS_PER_STANCE = MINUTES_PER_STANCE * 60;

export const FREE_STANCES: EnemyMotionStyle[] = ['run', 'stand'];

/** The rest, in the order they unlock (the zombie saved for last). */
export const STANCE_UNLOCK_ORDER: EnemyMotionStyle[] = ['sway', 'dance', 'robot', 'headbang', 'handstand', 'zombie'];

/** How many of the locked stances are open: one per 20 minutes played, plus one per ad watched. */
export function stancesEarned(stats: LifetimeStats): number {
  const byTime = Math.floor(stats.playSeconds / SECONDS_PER_STANCE);
  return Math.min(STANCE_UNLOCK_ORDER.length, byTime + stats.adUnlocks);
}

export function isStanceUnlocked(id: EnemyMotionStyle, stats: LifetimeStats): boolean {
  if (FREE_STANCES.includes(id)) return true;
  const place = STANCE_UNLOCK_ORDER.indexOf(id);
  return place >= 0 && place < stancesEarned(stats);
}

/** The next stance to unlock, or null when they're all open. */
export function nextStance(stats: LifetimeStats): EnemyMotionStyle | null {
  return STANCE_UNLOCK_ORDER[stancesEarned(stats)] ?? null;
}

/**
 * Seconds of play until the next stance unlocks on its own, or null when
 * they're all open. Watching an ad opens a stance now but doesn't reset
 * the clock: the timer keeps counting toward the one after.
 */
export function secondsToNextStance(stats: LifetimeStats): number | null {
  if (nextStance(stats) === null) return null;
  return SECONDS_PER_STANCE - (stats.playSeconds % SECONDS_PER_STANCE);
}

/** "12:05" style countdown. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
