import { describe, expect, it } from 'vitest';
import {
  activeBackdrop,
  BACKDROP_ITEMS,
  BACKDROP_LAYERS,
  BACKDROP_MILESTONES,
  BACKDROP_UNLOCK_PATH,
  backdropGoalScore,
  backdropsAfterRun,
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

  it('opens a piece at each total-score milestone, but never more than one per song', () => {
    expect(backdropsAfterRun(0, 9_999)).toBe(0);
    expect(backdropsAfterRun(0, 10_000)).toBe(1);
    // One big song passing four milestones still opens just one piece...
    expect(backdropsAfterRun(0, 100_000)).toBe(1);
    // ...and the others follow one per song, even a song that scores nothing new
    expect(backdropsAfterRun(1, 100_000)).toBe(2);
    expect(backdropsAfterRun(3, 100_000)).toBe(4);
    expect(backdropsAfterRun(4, 100_000)).toBe(4);
    expect(isBackdropUnlocked('dusk', EMPTY_STATS)).toBe(true);
    expect(isBackdropUnlocked(BACKDROP_UNLOCK_PATH[0], stats({ backdropsUnlocked: 1 }))).toBe(true);
    expect(isBackdropUnlocked(BACKDROP_UNLOCK_PATH[1], stats({ backdropsUnlocked: 1 }))).toBe(false);
    expect(backdropsEarned(stats({ backdropsUnlocked: 99 }))).toBe(BACKDROP_UNLOCK_PATH.length);
    expect(nextBackdrop(stats({ backdropsUnlocked: 99 }))).toBeNull();
  });

  it('an ad opens the next piece straight away, and the next milestone still counts', () => {
    expect(nextBackdrop(stats({ backdropAds: 1 }))!.id).toBe(BACKDROP_UNLOCK_PATH[1]);
    expect(backdropsEarned(stats({ backdropsUnlocked: 1, backdropAds: 1 }))).toBe(2);
    expect(scoreToNextBackdrop(stats({ totalScore: 4_000 }))).toBe(6_000);
    // Milestone already passed, piece still to come: it opens after the next song
    expect(scoreToNextBackdrop(stats({ totalScore: 100_000, backdropsUnlocked: 1 }))).toBe(0);
  });

  it('draws the chosen pieces, swapping anything locked (or unknown) for the free piece of that layer', () => {
    expect(activeBackdrop(undefined, EMPTY_STATS)).toEqual(DEFAULT_BACKDROP);
    const all = stats({ backdropsUnlocked: 99 });
    expect(activeBackdrop({ sky: 'storm', floor: 'lava' }, all)).toEqual({ ...DEFAULT_BACKDROP, sky: 'storm', floor: 'lava' });
    expect(activeBackdrop({ sky: 'storm' }, EMPTY_STATS).sky).toBe('dusk');
    expect(activeBackdrop({ sky: 'lava' }, all).sky).toBe('dusk'); // a floor isn't a sky
    expect(activeBackdrop({ sky: 'nope' }, all).sky).toBe('dusk');
  });

  it('says the score that opens each locked piece, the next one matching the countdown', () => {
    const s = stats({ backdropsUnlocked: 3, totalScore: 80_000 });
    const next = nextBackdrop(s)!;
    expect(backdropGoalScore(next.id, s)).toBe(BACKDROP_MILESTONES[3]);
    expect(backdropGoalScore(next.id, s)! - s.totalScore).toBe(scoreToNextBackdrop(s));
    expect(backdropGoalScore(BACKDROP_UNLOCK_PATH[5], s)).toBe(BACKDROP_MILESTONES[5]);
    // Open and free pieces have no goal
    expect(backdropGoalScore(BACKDROP_UNLOCK_PATH[0], s)).toBeNull();
    expect(backdropGoalScore('dusk', s)).toBeNull();
  });

  it('moves the goals along when ads have opened pieces early', () => {
    const s = stats({ backdropsUnlocked: 3, backdropAds: 2, totalScore: 80_000 });
    const next = nextBackdrop(s)!;
    expect(next.id).toBe(BACKDROP_UNLOCK_PATH[5]);
    expect(backdropGoalScore(next.id, s)).toBe(BACKDROP_MILESTONES[3]);
    expect(backdropGoalScore(BACKDROP_UNLOCK_PATH[6], s)).toBe(BACKDROP_MILESTONES[4]);
    // The very last piece has the last milestone still to come at most
    expect(backdropGoalScore(BACKDROP_UNLOCK_PATH[15], s)).toBe(BACKDROP_MILESTONES[13]);
  });
});
