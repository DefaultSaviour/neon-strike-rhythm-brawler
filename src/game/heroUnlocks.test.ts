import { describe, expect, it } from 'vitest';
import { DEFAULT_HERO, HEROES } from './heroes';
import {
  UNLOCK_ORDER,
  addRun,
  EMPTY_STATS,
  HERO_UNLOCKS,
  isHeroUnlocked,
  LifetimeStats,
  loadStats,
  newlyUnlocked,
  saveStats,
  unlockProgress,
} from './heroUnlocks';

const ids = HEROES.map((h) => h.id);
const stats = (s: Partial<LifetimeStats>): LifetimeStats => ({ ...EMPTY_STATS, ...s });

function memoryStore() {
  const data: Record<string, string> = {};
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), data };
}

describe('hero unlocks', () => {
  it('a brand-new player has only the default hero', () => {
    expect(ids.filter((id) => isHeroUnlocked(id, EMPTY_STATS))).toEqual([DEFAULT_HERO]);
  });

  it('every other hero has a goal, and the goals mix kinds (playing, finishing, combos, perfects, time trained)', () => {
    for (const id of ids) if (id !== DEFAULT_HERO) expect(HERO_UNLOCKS[id], id).toBeDefined();
    const kinds = new Set(Object.values(HERO_UNLOCKS).map((g) => g!.stat));
    expect(kinds).toEqual(new Set(['enemiesDefeated', 'songsCleared', 'bestCombo', 'perfects', 'playSeconds']));
  });

  it('lists every hero once in the unlock path, the free hero first', () => {
    expect([...UNLOCK_ORDER].sort()).toEqual([...ids].sort());
    expect(UNLOCK_ORDER[0]).toBe(DEFAULT_HERO);
  });

  it('uses the goals the player asked for', () => {
    expect(HERO_UNLOCKS.dragon).toMatchObject({ stat: 'enemiesDefeated', target: 150 });
    expect(HERO_UNLOCKS.theOne).toMatchObject({ stat: 'songsCleared', target: 1 });
    expect(HERO_UNLOCKS.ballerina).toMatchObject({ stat: 'perfects', target: 200 });
  });

  it('unlocks exactly when the goal is reached', () => {
    expect(isHeroUnlocked('dragon', stats({ enemiesDefeated: 149 }))).toBe(false);
    expect(isHeroUnlocked('dragon', stats({ enemiesDefeated: 150 }))).toBe(true);
    expect(isHeroUnlocked('theOne', stats({ songsCleared: 1 }))).toBe(true);
  });

  it('shows progress toward a locked hero, capped at the goal', () => {
    expect(unlockProgress('dragon', stats({ enemiesDefeated: 40 }))).toMatchObject({ current: 40, done: false });
    expect(unlockProgress('dragon', stats({ enemiesDefeated: 900 }))).toMatchObject({ current: 150, done: true });
    expect(unlockProgress(DEFAULT_HERO, EMPTY_STATS)).toBeNull();
  });
});

describe('lifetime totals', () => {
  it('add up across songs (score included), keep the best combo, and count only cleared songs', () => {
    let s = addRun(EMPTY_STATS, { enemiesDefeated: 90, perfects: 40, maxCombo: 30, cleared: false, seconds: 61, score: 12000 });
    s = addRun(s, { enemiesDefeated: 80, perfects: 50, maxCombo: 22, cleared: true, seconds: 190, score: 30500 });
    expect(s).toEqual({ ...EMPTY_STATS, enemiesDefeated: 170, perfects: 90, bestCombo: 30, songsCleared: 1, playSeconds: 251, totalScore: 42500 });
  });

  it('report the heroes a run has just unlocked, and only those', () => {
    const before = stats({ enemiesDefeated: 120 });
    const after = addRun(before, { enemiesDefeated: 60, perfects: 0, maxCombo: 10, cleared: true, seconds: 120, score: 0 });
    expect(newlyUnlocked(ids, before, after)).toEqual(['dragon', 'theOne']);
    expect(newlyUnlocked(ids, after, after)).toEqual([]);
  });

  it('survive a save and load, and treat missing or broken saves as zero', () => {
    const store = memoryStore();
    expect(loadStats(store)).toEqual(EMPTY_STATS);
    saveStats(store, stats({ enemiesDefeated: 12, bestCombo: 7 }));
    expect(loadStats(store)).toEqual(stats({ enemiesDefeated: 12, bestCombo: 7 }));
    store.data['neon_strike_lifetime_v1'] = '{not json';
    expect(loadStats(store)).toEqual(EMPTY_STATS);
    store.data['neon_strike_lifetime_v1'] = JSON.stringify({ perfects: -5, bestCombo: 'lots' });
    expect(loadStats(store)).toEqual(EMPTY_STATS);
    expect(loadStats(undefined)).toEqual(EMPTY_STATS);
  });
});
