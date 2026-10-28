import { describe, expect, it } from 'vitest';
import { REVEAL_TIMES, revealLength, revealPhase, spinEase, spinLeft, spinPlaces } from './unlockReveal';

describe('the unlock reveal', () => {
  it('spins, lands, then waits for the player', () => {
    expect(revealPhase('carousel', 0)).toBe('spin');
    expect(revealPhase('carousel', REVEAL_TIMES.carousel.spin + 0.1)).toBe('land');
    expect(revealPhase('carousel', revealLength('carousel'))).toBe('ready');
    // A backdrop piece holds on its own, then builds the rest round it
    expect(revealPhase('backdrop', REVEAL_TIMES.backdrop.spin + REVEAL_TIMES.backdrop.land + 0.5)).toBe('land');
    expect(revealPhase('backdrop', revealLength('backdrop') + 0.01)).toBe('ready');
  });

  it('keeps the whole reveal short', () => {
    expect(revealLength('carousel')).toBeLessThanOrEqual(3.5);
    expect(revealLength('backdrop')).toBeLessThanOrEqual(5);
  });

  it('turns fast at first and slows to a stop on the unlock', () => {
    expect(spinLeft(0, 20)).toBe(20);
    expect(spinLeft(REVEAL_TIMES.carousel.spin, 20)).toBe(0);
    expect(spinLeft(99, 20)).toBe(0);
    // Most of the turning happens early
    expect(spinLeft(REVEAL_TIMES.carousel.spin / 2, 20)).toBeLessThan(2);
    // ...and it never turns back
    let last = Infinity;
    for (let t = 0; t <= 2.5; t += 0.05) {
      const left = spinLeft(t, 20);
      expect(left).toBeLessThanOrEqual(last);
      last = left;
    }
    expect(spinEase(-1)).toBe(0);
    expect(spinEase(2)).toBe(1);
  });

  it('spins at least a whole turn', () => {
    expect(spinPlaces(16)).toBeGreaterThan(16);
    expect(spinPlaces(8)).toBeGreaterThan(8);
  });
});
