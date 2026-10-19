import { describe, expect, it } from 'vitest';
import { DEFAULT_ENEMY_MOTION, ENEMY_MOTION_STYLES } from './enemyMotion';
import { EMPTY_STATS, LifetimeStats } from './heroUnlocks';
import {
  FREE_STANCES,
  formatCountdown,
  isStanceUnlocked,
  nextStance,
  SECONDS_PER_STANCE,
  secondsToNextStance,
  STANCE_UNLOCK_ORDER,
  stancesEarned,
} from './stanceUnlocks';

const stats = (s: Partial<LifetimeStats>): LifetimeStats => ({ ...EMPTY_STATS, ...s });

describe('stance unlocks', () => {
  it('covers every stance exactly once: free ones plus the unlock order', () => {
    const all = [...FREE_STANCES, ...STANCE_UNLOCK_ORDER].sort();
    expect(all).toEqual(ENEMY_MOTION_STYLES.map((m) => m.id).sort());
    expect(FREE_STANCES).toContain(DEFAULT_ENEMY_MOTION);
  });

  it('a new player has only the free stances', () => {
    expect(ENEMY_MOTION_STYLES.filter((m) => isStanceUnlocked(m.id, EMPTY_STATS)).map((m) => m.id)).toEqual(['run', 'stand']);
  });

  it('opens one stance every 20 minutes of play, in order', () => {
    expect(SECONDS_PER_STANCE).toBe(20 * 60);
    expect(stancesEarned(stats({ playSeconds: 20 * 60 - 1 }))).toBe(0);
    expect(stancesEarned(stats({ playSeconds: 20 * 60 }))).toBe(1);
    expect(isStanceUnlocked(STANCE_UNLOCK_ORDER[0], stats({ playSeconds: 20 * 60 }))).toBe(true);
    expect(isStanceUnlocked(STANCE_UNLOCK_ORDER[1], stats({ playSeconds: 20 * 60 }))).toBe(false);
    expect(stancesEarned(stats({ playSeconds: 99 * 3600 }))).toBe(STANCE_UNLOCK_ORDER.length);
  });

  it('a watched ad opens the next one straight away', () => {
    expect(stancesEarned(stats({ adUnlocks: 1 }))).toBe(1);
    expect(stancesEarned(stats({ playSeconds: 20 * 60, adUnlocks: 2 }))).toBe(3);
  });

  it('counts down to the next one, and the ad does not reset the clock', () => {
    expect(secondsToNextStance(EMPTY_STATS)).toBe(20 * 60);
    expect(secondsToNextStance(stats({ playSeconds: 5 * 60 }))).toBe(15 * 60);
    expect(secondsToNextStance(stats({ playSeconds: 5 * 60, adUnlocks: 1 }))).toBe(15 * 60);
    expect(nextStance(stats({ adUnlocks: 1 }))).toBe(STANCE_UNLOCK_ORDER[1]);
  });

  it('stops counting once everything is open', () => {
    const done = stats({ adUnlocks: 99 });
    expect(nextStance(done)).toBeNull();
    expect(secondsToNextStance(done)).toBeNull();
  });

  it('formats the countdown as minutes and seconds', () => {
    expect(formatCountdown(20 * 60)).toBe('20:00');
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(0.2)).toBe('0:01');
  });
});
