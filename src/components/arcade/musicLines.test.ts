import { describe, expect, it } from 'vitest';
import { stripeLayout, THROB, throbAfter, waveLevel } from './musicLines';

describe('the music lines', () => {
  it('throb: jump up on a hit, then ease back down', () => {
    let t = throbAfter(0, 1, 1 / 60);
    expect(t).toBe(1);
    for (let i = 0; i < 6; i++) t = throbAfter(t, 0, 1 / 60);
    expect(t).toBeGreaterThan(0.2);
    expect(t).toBeLessThan(1);
    for (let i = 0; i < 60; i++) t = throbAfter(t, 0, 1 / 60);
    expect(t).toBeLessThan(0.01);
  });

  it('never get more than 30% fatter, however loud', () => {
    expect(THROB).toBe(0.3);
    expect(throbAfter(0, 5, 1 / 60)).toBe(1);
  });

  it('stay plain in silence', () => {
    expect(throbAfter(0, 0, 1 / 60)).toBe(0);
    expect(waveLevel(new Float32Array(64))).toBe(0);
  });

  it('sit where the old slashes were: pink (thick) left of cyan (thin), running top-right to bottom-left', () => {
    const { stripes, along, halfLength } = stripeLayout(1366, 768);
    const [pink, cyan] = stripes;
    expect(pink.kind).toBe('bass');
    expect(cyan.kind).toBe('mid');
    expect(pink.width).toBeCloseTo(cyan.width * 3, 5);
    expect(pink.x).toBeLessThan(cyan.x);
    expect(along.x).toBeLessThan(0);
    expect(along.y).toBeGreaterThan(0);
    // Long enough to run off the screen at both ends
    expect(halfLength).toBeGreaterThanOrEqual(Math.hypot(1366, 768));
  });
});
