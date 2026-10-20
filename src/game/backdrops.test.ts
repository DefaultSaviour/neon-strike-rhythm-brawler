import { describe, expect, it } from 'vitest';
import {
  activeBackdrop,
  BACKDROP_ITEMS,
  BACKDROP_LAYERS,
  BACKDROP_MILESTONES,
  BACKDROP_UNLOCK_PATH,
  backdropsEarned,
  DEFAULT_BACKDROP,
  isBackdropUnlocked,
  nextBackdrop,
  scoreToNextBackdrop,
} from './backdrops';
import { EMPTY_STATS, LifetimeStats } from './heroUnlocks';

const stats = (s: Partial<LifetimeStats>): LifetimeStats => ({ ...EMPTY_STATS, ...s });

describe('backdrops', () => {
  it('has four layers with five pieces each, one of them free', () => {
    for (const { layer } of BACKDROP_LAYERS) {
      const items = BACKDROP_ITEMS.filter((b) => b.layer === layer);
      expect(items, layer).toHaveLength(5);
      expect(items.some((b) => b.id === DEFAULT_BACKDROP[layer])).toBe(true);
    }
    expect(new Set(BACKDROP_ITEMS.map((b) => b.id)).size).toBe(BACKDROP_ITEMS.length);
  });

  it('unlocks every non-free piece exactly once along the path, the layers taking turns', () => {
    const free = Object.values(DEFAULT_BACKDROP);
    expect([...BACKDROP_UNLOCK_PATH].sort()).toEqual(BACKDROP_ITEMS.map((b) => b.id).filter((id) => !free.includes(id)).sort());
    expect(BACKDROP_MILESTONES).toHaveLength(BACKDROP_UNLOCK_PATH.length);
    for (let i = 1; i < BACKDROP_UNLOCK_PATH.length; i++) {
      const layer = (id: string) => BACKDROP_ITEMS.find((b) => b.id === id)!.layer;
      expect(layer(BACKDROP_UNLOCK_PATH[i])).not.toBe(layer(BACKDROP_UNLOCK_PATH[i - 1]));
    }
    expect([...BACKDROP_MILESTONES].sort((a, b) => a - b)).toEqual(BACKDROP_MILESTONES);
  });

  it('opens one piece per total-score milestone', () => {
    expect(backdropsEarned(stats({ totalScore: 9_999 }))).toBe(0);
    expect(isBackdropUnlocked('dusk', EMPTY_STATS)).toBe(true);
    expect(isBackdropUnlocked(BACKDROP_UNLOCK_PATH[0], stats({ totalScore: 10_000 }))).toBe(true);
    expect(isBackdropUnlocked(BACKDROP_UNLOCK_PATH[1], stats({ totalScore: 10_000 }))).toBe(false);
    expect(backdropsEarned(stats({ totalScore: 1e12 }))).toBe(BACKDROP_UNLOCK_PATH.length);
    expect(nextBackdrop(stats({ totalScore: 1e12 }))).toBeNull();
  });

  it('an ad opens the next piece straight away, and the next milestone still counts', () => {
    expect(nextBackdrop(stats({ backdropAds: 1 }))!.id).toBe(BACKDROP_UNLOCK_PATH[1]);
    expect(backdropsEarned(stats({ totalScore: 10_000, backdropAds: 1 }))).toBe(2);
    expect(scoreToNextBackdrop(stats({ totalScore: 4_000 }))).toBe(6_000);
  });

  it('draws the chosen pieces, swapping anything locked (or unknown) for the free piece of that layer', () => {
    expect(activeBackdrop(undefined, EMPTY_STATS)).toEqual(DEFAULT_BACKDROP);
    const all = stats({ totalScore: 1e12 });
    expect(activeBackdrop({ sky: 'storm', floor: 'lava' }, all)).toEqual({ ...DEFAULT_BACKDROP, sky: 'storm', floor: 'lava' });
    expect(activeBackdrop({ sky: 'storm' }, EMPTY_STATS).sky).toBe('dusk');
    expect(activeBackdrop({ sky: 'lava' }, all).sky).toBe('dusk'); // a floor isn't a sky
    expect(activeBackdrop({ sky: 'nope' }, all).sky).toBe('dusk');
  });
});
