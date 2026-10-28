import { describe, expect, it } from 'vitest';
import { fighterTier, FIGHTER_TIERS } from '../../game/fighterTier';
import { carouselOffset, placeAt, releaseSteps, SHOWCASE_BEATS, ShowcaseCounter, showcaseCombo, wrapIndex, wrapOffset } from './fighterCarousel';

describe('carouselOffset', () => {
  it('counts places from the one in focus', () => {
    expect(carouselOffset(5, 5, 16)).toBe(0);
    expect(carouselOffset(6, 5, 16)).toBe(1);
    expect(carouselOffset(3, 5, 16)).toBe(-2);
  });

  it('wraps the short way round', () => {
    expect(carouselOffset(15, 0, 16)).toBe(-1);
    expect(carouselOffset(0, 15, 16)).toBe(1);
    expect(carouselOffset(14, 1, 16)).toBe(-3);
  });

  it('gives every fighter its own place', () => {
    const places = Array.from({ length: 16 }, (_, i) => carouselOffset(i, 7, 16));
    expect(new Set(places).size).toBe(16);
  });
});

describe('wrapIndex', () => {
  it('steps round the ring both ways', () => {
    expect(wrapIndex(15, 1, 16)).toBe(0);
    expect(wrapIndex(0, -1, 16)).toBe(15);
    expect(wrapIndex(4, 2, 16)).toBe(6);
  });
});

describe('placeAt', () => {
  it('puts the one in focus big in the middle and the others smaller out to each side', () => {
    expect(placeAt(0)).toEqual({ x: 0, scale: 1, opacity: 1 });
    expect(placeAt(1).x).toBe(44);
    expect(placeAt(-1).x).toBe(-44);
    expect(placeAt(2).scale).toBeLessThan(placeAt(1).scale);
  });

  it('moves smoothly between places, so a drag grows the one coming in', () => {
    const half = placeAt(0.5);
    expect(half.x).toBeCloseTo(22, 6);
    expect(half.scale).toBeCloseTo(0.8, 6);
    // Getting bigger all the way in to the middle
    let last = 0;
    for (let off = 3; off >= 0; off -= 0.25) {
      const s = placeAt(off).scale;
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
  });

  it('is hidden well out to the side', () => {
    expect(placeAt(3).opacity).toBe(0);
    expect(placeAt(7).opacity).toBe(0);
  });
});

describe('wrapOffset', () => {
  it('wraps fractions the short way round', () => {
    expect(wrapOffset(15.5, 16)).toBeCloseTo(-0.5, 6);
    expect(wrapOffset(-8.4, 16)).toBeCloseTo(7.6, 6);
    expect(wrapOffset(1.25, 16)).toBeCloseTo(1.25, 6);
  });
});

describe('releaseSteps', () => {
  it('settles on the nearest place: dragging left brings the next ones in', () => {
    expect(releaseSteps(-300, 200)).toBe(2);
    expect(releaseSteps(-90, 200)).toBe(0);
    expect(releaseSteps(250, 200)).toBe(-1);
    expect(releaseSteps(-1000, 200)).toBe(5);
  });

  it('moves one on a quick flick, even a short one', () => {
    expect(releaseSteps(-40, 200, -0.9)).toBe(1);
    expect(releaseSteps(40, 200, 0.9)).toBe(-1);
  });

  it('treats a tiny drag as a tap', () => {
    expect(releaseSteps(-5, 200, -2)).toBe(0);
  });
});

describe('the showcase combo', () => {
  it('climbs through every tier to the top form before it starts again', () => {
    const tiers = new Set<string>();
    for (let b = 0; b < SHOWCASE_BEATS; b++) tiers.add(fighterTier(showcaseCombo(b)).name);
    expect(tiers.size).toBe(FIGHTER_TIERS.length);
    // ...and holds the top form for a good stretch at the end
    const top = FIGHTER_TIERS[FIGHTER_TIERS.length - 1];
    const held = Array.from({ length: SHOWCASE_BEATS }, (_, b) => b).filter((b) => fighterTier(showcaseCombo(b)) === top).length;
    expect(held).toBeGreaterThanOrEqual(12);
  });

  it('counts beats from when the fighter came into focus', () => {
    const c = new ShowcaseCounter();
    expect(c.beatsIn('dragon', 120)).toBe(0);
    expect(c.beatsIn('dragon', 123)).toBe(3);
    expect(c.beatsIn('kid', 124)).toBe(0);
    expect(c.beatsIn('kid', 124 + SHOWCASE_BEATS + 2)).toBe(2);
  });

  it('starts again when the music loops back', () => {
    const c = new ShowcaseCounter();
    c.beatsIn('dragon', 50);
    expect(c.beatsIn('dragon', 4)).toBe(0);
    expect(c.beatsIn('dragon', 5)).toBe(1);
  });
});
