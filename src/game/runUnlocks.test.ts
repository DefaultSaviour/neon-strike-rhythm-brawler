import { describe, expect, it } from 'vitest';
import { BACKDROP_MILESTONES, BACKDROP_UNLOCK_PATH } from './backdrops';
import { EMPTY_STATS, LifetimeStats } from './heroUnlocks';
import { adOffer, backdropLayerOf, unlocksBetween } from './runUnlocks';
import { SECONDS_PER_STANCE, STANCE_UNLOCK_ORDER } from './stanceUnlocks';

const stats = (s: Partial<LifetimeStats>): LifetimeStats => ({ ...EMPTY_STATS, ...s });

describe('what a song unlocked', () => {
  it('nothing, when no goal was reached', () => {
    expect(unlocksBetween(EMPTY_STATS, stats({ enemiesDefeated: 10 }))).toEqual([]);
  });

  it('heroes first, then stances, then backdrop pieces', () => {
    const after = stats({ songsCleared: 1, enemiesDefeated: 400, playSeconds: SECONDS_PER_STANCE + 5, totalScore: BACKDROP_MILESTONES[1] });
    expect(unlocksBetween(EMPTY_STATS, after)).toEqual([
      { kind: 'hero', id: 'theOne' },
      { kind: 'hero', id: 'dragon' },
      { kind: 'stance', id: STANCE_UNLOCK_ORDER[0] },
      { kind: 'backdrop', id: BACKDROP_UNLOCK_PATH[0] },
      { kind: 'backdrop', id: BACKDROP_UNLOCK_PATH[1] },
    ]);
  });

  it('only what is new: things already open before the song are left out', () => {
    const before = stats({ songsCleared: 1, totalScore: BACKDROP_MILESTONES[0] });
    const after = stats({ songsCleared: 2, totalScore: BACKDROP_MILESTONES[1] });
    expect(unlocksBetween(before, after)).toEqual([{ kind: 'backdrop', id: BACKDROP_UNLOCK_PATH[1] }]);
  });
});

describe('the ad offer', () => {
  it('is The Bride while she is locked', () => {
    expect(adOffer(EMPTY_STATS)).toEqual({ kind: 'hero', id: 'bride' });
  });

  it('then the next stance, then the next backdrop piece, then nothing', () => {
    expect(adOffer(stats({ heroAds: 1 }))).toEqual({ kind: 'stance', id: STANCE_UNLOCK_ORDER[0] });
    expect(adOffer(stats({ heroAds: 1, adUnlocks: STANCE_UNLOCK_ORDER.length }))).toEqual({ kind: 'backdrop', id: BACKDROP_UNLOCK_PATH[0] });
    expect(adOffer(stats({ heroAds: 1, adUnlocks: 99, backdropAds: 99 }))).toBeNull();
  });
});

it('knows which backdrop layer a piece goes on', () => {
  expect(backdropLayerOf(BACKDROP_UNLOCK_PATH[0])).not.toBeNull();
  expect(backdropLayerOf('nope')).toBeNull();
});
