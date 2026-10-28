import { describe, expect, it } from 'vitest';
import { dialStep, FLAT_ANGLE, SLASH_ANGLE, STRIPE_ANGLES, stripeLayout, THROB, throbAfter, waveLevel } from './musicLines';

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

  it('turn like a dial: the same widths and the same gap at any angle, turned about the middle', () => {
    const slash = stripeLayout(844, 390);
    const flat = stripeLayout(844, 390, FLAT_ANGLE);
    const gap = (l: typeof slash) => Math.hypot(l.stripes[1].x - l.stripes[0].x, l.stripes[1].y - l.stripes[0].y);
    expect(gap(flat)).toBeCloseTo(gap(slash), 6);
    expect(flat.stripes[0].width).toBeCloseTo(slash.stripes[0].width, 6);
    expect(flat.stripes[1].width).toBeCloseTo(slash.stripes[1].width, 6);
    // Each stripe stays the same distance from the middle of the screen
    const fromMid = (p: { x: number; y: number }) => Math.hypot(p.x - 422, p.y - 195);
    expect(fromMid(flat.stripes[0])).toBeCloseTo(fromMid(slash.stripes[0]), 6);
    expect(fromMid(flat.stripes[1])).toBeCloseTo(fromMid(slash.stripes[1]), 6);
  });

  it('lie flat for the Fighters screen: pink on top, cyan below, rising a touch to the right', () => {
    expect(SLASH_ANGLE).toBeCloseTo(25, 0);
    const { stripes, along } = stripeLayout(844, 390, FLAT_ANGLE);
    const [pink, cyan] = stripes;
    expect(pink.y).toBeLessThan(cyan.y);
    // Nearly level...
    expect(Math.abs(along.x)).toBeGreaterThan(0.99);
    // ...and higher at the right end than the left
    const right = along.x > 0 ? along : { x: -along.x, y: -along.y };
    expect(right.y).toBeLessThan(0);
  });

  it('swing round to a new angle like a dial, overshoot a touch and settle', () => {
    let s = { angle: SLASH_ANGLE, speed: 0 };
    let most = s.angle;
    for (let i = 0; i < 120; i++) {
      s = dialStep(s.angle, s.speed, FLAT_ANGLE, 1 / 60);
      most = Math.max(most, s.angle);
    }
    expect(s.angle).toBeCloseTo(FLAT_ANGLE, 1);
    expect(most).toBeGreaterThan(FLAT_ANGLE);
    expect(most - FLAT_ANGLE).toBeLessThan(6);
  });

  it('swing back the other way just as well, even from a slow frame', () => {
    let s = { angle: FLAT_ANGLE, speed: 0 };
    s = dialStep(s.angle, s.speed, SLASH_ANGLE, 0.25);
    for (let i = 0; i < 120; i++) s = dialStep(s.angle, s.speed, SLASH_ANGLE, 1 / 60);
    expect(s.angle).toBeCloseTo(SLASH_ANGLE, 1);
  });

  it('give each menu screen its own way round, so every switch turns them', () => {
    const angles = Object.values(STRIPE_ANGLES);
    expect(new Set(angles).size).toBe(angles.length);
    // No two are close (even half a turn apart, which would swap pink and cyan in the same lines)
    for (const a of angles) for (const b of angles) if (a !== b) expect(Math.abs(a - b)).toBeGreaterThanOrEqual(20);
    // ...and each still keeps the same widths and gap
    const gap = (l: ReturnType<typeof stripeLayout>) => Math.hypot(l.stripes[1].x - l.stripes[0].x, l.stripes[1].y - l.stripes[0].y);
    for (const a of angles) expect(gap(stripeLayout(1366, 768, a))).toBeCloseTo(gap(stripeLayout(1366, 768)), 6);
  });
});
