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
  progressText,
  saveStats,
  unlockProgress,
  accuracyPercent,
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

  it('every other hero has a goal, and the goals mix kinds (playing, finishing, combos, perfects, OK hits, time, accuracy, no misses, lots of misses)', () => {
    for (const id of ids) if (id !== DEFAULT_HERO) expect(HERO_UNLOCKS[id], id).toBeDefined();
    const kinds = new Set(Object.values(HERO_UNLOCKS).map((g) => g!.stat));
    expect(kinds).toEqual(new Set(['enemiesDefeated', 'songsCleared', 'bestCombo', 'perfects', 'playSeconds', 'okHits', 'bestClearAccuracy', 'flawlessClears', 'mostMissesCleared', 'songsDied', 'songsQuit', 'bestOkStreak']));
  });

  it('lists every hero once in the unlock path, the free hero first', () => {
    expect([...UNLOCK_ORDER].sort()).toEqual([...ids].sort());
    expect(UNLOCK_ORDER[0]).toBe(DEFAULT_HERO);
  });

  it('uses the goals the player set, hero by hero (2026-10-20)', () => {
    const goals = Object.fromEntries(Object.entries(HERO_UNLOCKS).map(([id, g]) => [id, [g!.stat, g!.target]]));
    expect(goals).toEqual({
      theOne: ['songsCleared', 1],
      dragon: ['enemiesDefeated', 333],
      sawFace: ['perfects', 666],
      stallion: ['songsCleared', 5],
      proWrestler: ['okHits', 200],
      bride: ['songsCleared', 8],
      kid: ['playSeconds', 1800],
      discoKing: ['perfects', 2500],
      scarecrow: ['songsDied', 10],
      lion: ['songsQuit', 5],
      tinMan: ['bestOkStreak', 20],
      drunkenMaster: ['mostMissesCleared', 50],
      spartan: ['bestCombo', 300],
      babaYaga: ['bestClearAccuracy', 98],
      ballerina: ['flawlessClears', 1],
    });
    expect(HERO_UNLOCKS.bride!.ad).toBe(true);
    expect(Object.values(HERO_UNLOCKS).filter((g) => g!.ad)).toHaveLength(1);
  });

  it('dying in a song counts toward The Scarecrow; quitting or finishing does not', () => {
    const base = { enemiesDefeated: 10, perfects: 5, oks: 0, misses: 0, accuracy: 70, maxCombo: 5, seconds: 30, score: 0 };
    let s = addRun(EMPTY_STATS, { ...base, cleared: false, died: true });
    s = addRun(s, { ...base, cleared: false });
    s = addRun(s, { ...base, cleared: true });
    expect(s.songsDied).toBe(1);
  });

  it('quitting counts toward The Lion, and the best OK streak of any song counts toward The Tin Man', () => {
    const base = { enemiesDefeated: 10, perfects: 5, oks: 5, misses: 0, accuracy: 70, maxCombo: 5, seconds: 30, score: 0, cleared: false };
    let s = addRun(EMPTY_STATS, { ...base, quit: true, okStreak: 12 });
    s = addRun(s, { ...base, died: true, okStreak: 7 });
    expect(s).toMatchObject({ songsQuit: 1, songsDied: 1, bestOkStreak: 12 });
  });

  it('one good song no longer unlocks a crowd of heroes: just The One and The Little Dragon', () => {
    // About what one decent clear of a ~500-enemy song earns
    const oneSong = addRun(EMPTY_STATS, { enemiesDefeated: 480, perfects: 330, oks: 30, misses: 12, accuracy: 88, maxCombo: 140, cleared: true, seconds: 190, score: 250000 });
    expect(newlyUnlocked(ids, EMPTY_STATS, oneSong)).toEqual(['dragon', 'theOne']);
  });

  it('unlocks exactly when the goal is reached', () => {
    expect(isHeroUnlocked('dragon', stats({ enemiesDefeated: 332 }))).toBe(false);
    expect(isHeroUnlocked('dragon', stats({ enemiesDefeated: 333 }))).toBe(true);
    expect(isHeroUnlocked('theOne', stats({ songsCleared: 1 }))).toBe(true);
    expect(isHeroUnlocked('proWrestler', stats({ okHits: 199 }))).toBe(false);
    expect(isHeroUnlocked('proWrestler', stats({ okHits: 200 }))).toBe(true);
    expect(isHeroUnlocked('drunkenMaster', stats({ mostMissesCleared: 49 }))).toBe(false);
    expect(isHeroUnlocked('drunkenMaster', stats({ mostMissesCleared: 50 }))).toBe(true);
    expect(isHeroUnlocked('babaYaga', stats({ bestClearAccuracy: 97 }))).toBe(false);
    expect(isHeroUnlocked('babaYaga', stats({ bestClearAccuracy: 98 }))).toBe(true);
    expect(isHeroUnlocked('ballerina', stats({ flawlessClears: 0 }))).toBe(false);
    expect(isHeroUnlocked('ballerina', stats({ flawlessClears: 1 }))).toBe(true);
  });

  it('shows progress toward a locked hero, capped at the goal', () => {
    expect(unlockProgress('dragon', stats({ enemiesDefeated: 40 }))).toMatchObject({ current: 40, done: false });
    expect(unlockProgress('dragon', stats({ enemiesDefeated: 900 }))).toMatchObject({ current: 333, done: true });
    expect(unlockProgress(DEFAULT_HERO, EMPTY_STATS)).toBeNull();
  });

  it('words the progress to suit each goal', () => {
    expect(progressText(HERO_UNLOCKS.dragon!, 40)).toBe('40 / 333');
    expect(progressText(HERO_UNLOCKS.discoKing!, 1200)).toBe('1,200 / 2,500');
    expect(progressText(HERO_UNLOCKS.kid!, 125)).toBe('2 / 30 min');
    expect(progressText(HERO_UNLOCKS.babaYaga!, 91)).toBe('Best 91% / 98%');
    expect(progressText(HERO_UNLOCKS.drunkenMaster!, 12)).toBe('Best 12 / 50 misses');
    expect(progressText(HERO_UNLOCKS.ballerina!, 0)).toBe('Not yet');
  });

  it('the unlock path runs from the play goals to the skill goals, flawless last', () => {
    expect(UNLOCK_ORDER.slice(-4)).toEqual(['spartan', 'tinMan', 'babaYaga', 'ballerina']);
  });
});

describe('lifetime totals', () => {
  it('add up across songs (score and OK hits included), keep the best combo, and count only cleared songs', () => {
    let s = addRun(EMPTY_STATS, { enemiesDefeated: 90, perfects: 40, oks: 9, misses: 5, accuracy: 99, maxCombo: 30, cleared: false, seconds: 61, score: 12000 });
    s = addRun(s, { enemiesDefeated: 80, perfects: 50, oks: 4, misses: 2, accuracy: 85, maxCombo: 22, cleared: true, seconds: 190, score: 30500 });
    // 42,500 total passes two backdrop milestones, one per song
    expect(s).toEqual({ ...EMPTY_STATS, enemiesDefeated: 170, perfects: 90, okHits: 13, bestCombo: 30, songsCleared: 1, playSeconds: 251, totalScore: 42500, backdropsUnlocked: 2, bestClearAccuracy: 85, mostMissesCleared: 2 });
  });

  it('give saves from before the one-backdrop-per-song rule every piece their score had opened', () => {
    const old = { getItem: () => JSON.stringify({ totalScore: 100_000 }) };
    expect(loadStats(old).backdropsUnlocked).toBe(4);
    const current = { getItem: () => JSON.stringify({ totalScore: 100_000, backdropsUnlocked: 1 }) };
    expect(loadStats(current).backdropsUnlocked).toBe(1);
  });

  it('only finished songs count for accuracy and for no-miss songs', () => {
    const died = addRun(EMPTY_STATS, { enemiesDefeated: 40, perfects: 40, oks: 0, misses: 0, accuracy: 100, maxCombo: 40, cleared: false, seconds: 30, score: 0 });
    expect(died).toMatchObject({ bestClearAccuracy: 0, flawlessClears: 0 });
    const flawless = addRun(died, { enemiesDefeated: 400, perfects: 380, oks: 2, misses: 0, accuracy: 98, maxCombo: 400, cleared: true, seconds: 190, score: 0 });
    expect(flawless).toMatchObject({ bestClearAccuracy: 98, flawlessClears: 1 });
    const sloppier = addRun(flawless, { enemiesDefeated: 400, perfects: 200, oks: 50, misses: 3, accuracy: 80, maxCombo: 90, cleared: true, seconds: 190, score: 0 });
    expect(sloppier).toMatchObject({ bestClearAccuracy: 98, flawlessClears: 1 });
  });

  it('keep the most misses in one finished song (Drunken Master), not in songs you died in or the total', () => {
    const died = addRun(EMPTY_STATS, { enemiesDefeated: 40, perfects: 10, oks: 0, misses: 80, accuracy: 20, maxCombo: 5, cleared: false, seconds: 30, score: 0 });
    expect(died.mostMissesCleared).toBe(0);
    const drunk = addRun(died, { enemiesDefeated: 400, perfects: 200, oks: 20, misses: 55, accuracy: 70, maxCombo: 40, cleared: true, seconds: 190, score: 0 });
    expect(drunk.mostMissesCleared).toBe(55);
    const tidy = addRun(drunk, { enemiesDefeated: 400, perfects: 300, oks: 5, misses: 30, accuracy: 85, maxCombo: 90, cleared: true, seconds: 190, score: 0 });
    expect(tidy.mostMissesCleared).toBe(55);
  });

  it('accuracy weighs PERFECT 100, GOOD 70, OK 40 and a miss 0', () => {
    expect(accuracyPercent({ perfect: 10, good: 0, ok: 0, miss: 0 })).toBe(100);
    expect(accuracyPercent({ perfect: 1, good: 1, ok: 1, miss: 1 })).toBe(53);
    expect(accuracyPercent({ perfect: 0, good: 0, ok: 0, miss: 0 })).toBe(0);
  });

  it('report the heroes a run has just unlocked, and only those', () => {
    const before = stats({ enemiesDefeated: 300 });
    const after = addRun(before, { enemiesDefeated: 60, perfects: 0, oks: 0, misses: 3, accuracy: 70, maxCombo: 10, cleared: true, seconds: 120, score: 0 });
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
    // Saves from before the new goals have no OK hits, accuracy or no-miss songs yet: zeros
    store.data['neon_strike_lifetime_v1'] = JSON.stringify({ enemiesDefeated: 50 });
    expect(loadStats(store)).toEqual(stats({ enemiesDefeated: 50 }));
    store.data['neon_strike_lifetime_v1'] = JSON.stringify({ bestClearAccuracy: 250 });
    expect(loadStats(store).bestClearAccuracy).toBe(100);
    expect(loadStats(undefined)).toEqual(EMPTY_STATS);
  });
});
