import { describe, expect, it } from 'vitest';
import { coastSpeed } from './dragScroll';

describe('coastSpeed', () => {
  it('slows a fling down over time, keeping its direction', () => {
    const a = coastSpeed(2000, 0.1);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(2000);
    expect(coastSpeed(-2000, 0.1)).toBeCloseTo(-a);
  });

  it('stops once it is crawling', () => {
    expect(coastSpeed(25, 0.1)).toBe(0);
  });

  it('a fast fling dies out within about a second', () => {
    let speed = 3000;
    let t = 0;
    while (speed !== 0 && t < 5) {
      speed = coastSpeed(speed, 1 / 60);
      t += 1 / 60;
    }
    expect(t).toBeLessThan(1.5);
  });
});
