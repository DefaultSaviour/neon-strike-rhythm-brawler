import { describe, expect, it } from 'vitest';
import { BACKDROP_MILESTONES, BACKDROP_UNLOCK_PATH } from './backdrops';
import type { HeroId } from './heroes';
import { AD_HERO_BITS, addRun, EMPTY_STATS, HERO_UNLOCKS, heroesOpenedByAd, isHeroUnlocked, LifetimeStats, loadStats, saveStats, UNLOCK_ORDER, withAdHero } from './heroUnlocks';
import { adOffer, backdropLayerOf, unlocksBetween } from './runUnlocks';
import { SECONDS_PER_STANCE, STANCE_UNLOCK_ORDER } from './stanceUnlocks';

const stats = (s: Partial<LifetimeStats>): LifetimeStats => ({ ...EMPTY_STATS, ...s });

describe('what a song unlocked', () => {
  it('nothing, when no goal was reached', () => {
    expect(unlocksBetween(EMPTY_STATS, stats({ enemiesDefeated: 10 }))).toEqual([]);
  });

  it('heroes first, then stances, then backdrop pieces', () => {
    const after = stats({ songsCleared: 1, enemiesDefeated: 400, playSeconds: SECONDS_PER_STANCE + 5, totalScore: BACKDROP_MILESTONES[1], backdropsUnlocked: 2 });
    expect(unlocksBetween(EMPTY_STATS, after)).toEqual([
      { kind: 'hero', id: 'theOne' },
      { kind: 'hero', id: 'dragon' },
      { kind: 'stance', id: STANCE_UNLOCK_ORDER[0] },
      { kind: 'backdrop', id: BACKDROP_UNLOCK_PATH[0] },
      { kind: 'backdrop', id: BACKDROP_UNLOCK_PATH[1] },
    ]);
  });

  it('only what is new: things already open before the song are left out', () => {
    const before = stats({ songsCleared: 1, totalScore: BACKDROP_MILESTONES[0], backdropsUnlocked: 1 });
    const after = stats({ songsCleared: 2, totalScore: BACKDROP_MILESTONES[1], backdropsUnlocked: 2 });
    expect(unlocksBetween(before, after)).toEqual([{ kind: 'backdrop', id: BACKDROP_UNLOCK_PATH[1] }]);
  });
});

describe('the ad offer', () => {
  it('is The Bride while she is locked', () => {
    expect(adOffer(EMPTY_STATS)).toEqual({ kind: 'hero', id: 'bride' });
  });

  it('then takes turns: a stance, a hero, a stance, a hero', () => {
    let s = stats({ heroAds: 1 });
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      const offer = adOffer(s)!;
      seen.push(offer.kind);
      s = offer.kind === 'stance' ? { ...s, adUnlocks: s.adUnlocks + 1 } : withAdHero(s, offer.id as HeroId);
      expect(isHeroUnlocked('bride', s)).toBe(true);
    }
    expect(seen).toEqual(['stance', 'hero', 'stance', 'hero', 'stance', 'hero']);
  });

  it('starts with a stance after The Bride, however she was earned', () => {
    expect(adOffer(stats({ songsCleared: 8 }))?.kind).toBe('stance');
  });

  it('offers the next locked hero on the path, skipping ones already earned by playing', () => {
    // One stance bought, so it's a hero's turn: The One (complete a song) is already earned
    expect(adOffer(stats({ heroAds: 1, adUnlocks: 1, songsCleared: 1 }))).toEqual({ kind: 'hero', id: 'dragon' });
  });

  it('when one kind runs out it is the other; when both have, backdrop pieces; then nothing', () => {
    const allHeroes = AD_HERO_BITS.reduce((s, id) => withAdHero(s, id), stats({ heroAds: 1 }));
    expect(adOffer(stats({ heroAds: 1, adUnlocks: STANCE_UNLOCK_ORDER.length }))?.kind).toBe('hero');
    expect(adOffer({ ...allHeroes, adUnlocks: 1 })?.kind).toBe('stance');
    expect(adOffer({ ...allHeroes, adUnlocks: STANCE_UNLOCK_ORDER.length })).toEqual({ kind: 'backdrop', id: BACKDROP_UNLOCK_PATH[0] });
    expect(adOffer({ ...allHeroes, adUnlocks: 99, backdropAds: 99 })).toBeNull();
  });
});

describe('heroes opened by an ad', () => {
  it('every hero with a play goal (except The Bride, who has her own ad) has a saved bit', () => {
    const locked = UNLOCK_ORDER.filter((id) => HERO_UNLOCKS[id] && !HERO_UNLOCKS[id]!.ad);
    expect([...AD_HERO_BITS].sort()).toEqual([...locked].sort());
  });

  it('opens just that hero, once', () => {
    const s = withAdHero(EMPTY_STATS, 'spartan');
    expect(isHeroUnlocked('spartan', s)).toBe(true);
    expect(isHeroUnlocked('dragon', s)).toBe(false);
    expect(withAdHero(s, 'spartan')).toBe(s);
    expect(heroesOpenedByAd(s)).toBe(1);
  });

  it('survives a save and load, and songs played afterwards', () => {
    const store = new Map<string, string>();
    const s = withAdHero(withAdHero(EMPTY_STATS, 'ballerina'), 'theOne');
    saveStats({ setItem: (k, v) => void store.set(k, v) }, s);
    const loaded = loadStats({ getItem: (k) => store.get(k) ?? null });
    const played = addRun(loaded, { enemiesDefeated: 1, perfects: 0, oks: 0, misses: 0, accuracy: 100, maxCombo: 1, cleared: false, seconds: 10, score: 10 });
    expect(isHeroUnlocked('ballerina', played)).toBe(true);
    expect(isHeroUnlocked('theOne', played)).toBe(true);
    expect(heroesOpenedByAd(played)).toBe(2);
  });
});

it('knows which backdrop layer a piece goes on', () => {
  expect(backdropLayerOf(BACKDROP_UNLOCK_PATH[0])).not.toBeNull();
  expect(backdropLayerOf('nope')).toBeNull();
});
